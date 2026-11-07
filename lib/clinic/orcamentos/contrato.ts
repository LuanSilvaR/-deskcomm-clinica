/**
 * FORK clinic (orçamento O3, migration 8008) — o texto do contrato a partir do
 * orçamento.
 *
 * O servidor preenche os marcadores `orcamento.*` do modelo de contrato da
 * clínica com o que está GRAVADO no orçamento (itens, valores, forma de
 * pagamento, parcelas, validade) — nunca com o corpo da requisição. Se o modelo
 * não usa `{{orcamento.itens}}` nem `{{orcamento.pagamento}}` (ex.: o modelo
 * padrão antigo), o texto ganha um ANEXO com os itens e a forma de pagamento,
 * para o paciente sempre aceitar sabendo o quê, quanto e como paga. O banco
 * congela o resultado com sha256.
 *
 * Sempre em pt-BR: é o texto jurídico que o paciente assina.
 */
import type { DadosDoTermo } from "@/lib/clinic/documentos/render";
import { renderizarTermo } from "@/lib/clinic/documentos/render";
import { ROTULO_DA_FORMA, rotuloDoNumero, type Orcamento } from "@/lib/clinic/orcamentos/orcamento";
import { formatarReais } from "@/lib/clinic/orcamentos/precos";
import { tagDeIdioma } from "@/lib/i18n/datas";

/** O contrato é texto jurídico em pt-BR, qualquer que seja o idioma de quem envia. */
const IDIOMA_DO_CONTRATO = tagDeIdioma("pt-BR");

const ROTULO_DA_ENTRADA = { dinheiro: "dinheiro", pix: "Pix", debito: "cartão de débito" } as const;
const COMO_PAGA_A_VISTA: Record<Exclude<Orcamento["condicao_pagamento"]["forma"], "parcelado">, string> = {
  dinheiro: "em dinheiro",
  pix: "via Pix",
  debito: "no cartão de débito",
  credito: "no cartão de crédito",
};

export function dataPorExtenso(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a!, (m ?? 1) - 1, d ?? 1, 12)).toLocaleDateString(IDIOMA_DO_CONTRATO, { dateStyle: "long", timeZone: "UTC" });
}

export type OrcamentoDoContrato = Pick<
  Orcamento,
  "numero" | "versao" | "subtotal_cents" | "desconto_cents" | "total_cents" | "condicao_pagamento" | "validade_ate"
> & { clinic_orcamento_itens: Orcamento["clinic_orcamento_itens"] };

/** Os valores dos marcadores `orcamento.*`. */
export function marcadoresDoOrcamento(o: OrcamentoDoContrato): DadosDoTermo {
  const c = o.condicao_pagamento;
  const itens = (o.clinic_orcamento_itens ?? [])
    .slice()
    .sort((a, b) => a.posicao - b.posicao)
    .map((i) =>
      `- ${i.quantidade > 1 ? `${i.quantidade} × ` : ""}${i.descricao}: ${formatarReais(i.total_cents)}` +
      (i.quantidade > 1 ? ` (${formatarReais(i.preco_unit_cents)} cada)` : ""),
    )
    .join("\n");
  const entrada = c.entrada ? `${formatarReais(c.entrada.valor_cents)} em ${ROTULO_DA_ENTRADA[c.entrada.forma]}` : "sem entrada";
  const parcelas =
    c.forma === "parcelado"
      ? `${c.parcelas} × ${formatarReais(c.valor_parcela_cents)} no cartão de crédito` +
        (c.primeira_parcela_cents !== c.valor_parcela_cents
          ? ` (1ª parcela de ${formatarReais(c.primeira_parcela_cents)})`
          : "")
      : "à vista";
  const pagamento =
    c.forma === "parcelado"
      ? `Total de ${formatarReais(o.total_cents)}` +
        (c.entrada ? `, com entrada de ${entrada} e o restante` : ",") +
        ` em ${parcelas}.`
      : `Total de ${formatarReais(o.total_cents)}, pago à vista ${COMO_PAGA_A_VISTA[c.forma]}.`;
  return {
    "orcamento.numero": rotuloDoNumero(o),
    "orcamento.itens": itens,
    "orcamento.subtotal": formatarReais(o.subtotal_cents),
    "orcamento.desconto": o.desconto_cents > 0 ? formatarReais(o.desconto_cents) : "sem desconto",
    "orcamento.total": formatarReais(o.total_cents),
    "orcamento.forma_pagamento": ROTULO_DA_FORMA[c.forma],
    "orcamento.entrada": entrada,
    "orcamento.parcelas": parcelas,
    "orcamento.pagamento": pagamento,
    "orcamento.validade": dataPorExtenso(o.validade_ate),
  };
}

/** O anexo que entra quando o modelo não traz itens nem pagamento. */
export function anexoDoOrcamento(m: DadosDoTermo): string {
  return [
    `ANEXO — ORÇAMENTO ${m["orcamento.numero"]}`,
    "",
    "Serviços contratados:",
    m["orcamento.itens"],
    "",
    `Subtotal: ${m["orcamento.subtotal"]}`,
    `Desconto: ${m["orcamento.desconto"]}`,
    `Total: ${m["orcamento.total"]}`,
    "",
    `Forma de pagamento: ${m["orcamento.forma_pagamento"]}`,
    `Entrada: ${m["orcamento.entrada"]}`,
    `Parcelas: ${m["orcamento.parcelas"]}`,
    "",
    String(m["orcamento.pagamento"]),
    "",
    `Proposta válida até ${m["orcamento.validade"]}.`,
  ].join("\n");
}

/** Renderiza o contrato: marcadores do termo + do orçamento; anexo se faltar. */
export function renderizarContrato(modelo: string, dadosDoTermo: DadosDoTermo, o: OrcamentoDoContrato): string {
  const m = marcadoresDoOrcamento(o);
  const texto = renderizarTermo(modelo, { ...dadosDoTermo, ...m });
  const usaItens = /\{\{\s*orcamento\.(itens|pagamento)\s*\}\}/.test(modelo);
  return usaItens ? texto : `${texto.trimEnd()}\n\n${anexoDoOrcamento(m)}`;
}
