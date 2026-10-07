"use client";

/**
 * FORK clinic (financeiro FN2) — o fechamento da comanda com o financeiro da
 * clínica ligado: PAGAMENTO DIVIDIDO, parcelas e bandeira, e o simulador AO
 * VIVO (o mesmo motor que o banco usa ao gravar, sem ida ao servidor a cada
 * tecla): taxa, líquido, quando entra e a margem depois do custo direto, com
 * alerta abaixo do mínimo da clínica.
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { AdquirenteNaTela, ConfigFinanceiro, FormaNaTela } from "@/lib/clinic/financeiro/servidor";
import { BANDEIRAS, calcularRecebimento, ErroDeTaxa, type Bandeira, type Modalidade } from "@/lib/clinic/financeiro/taxas";
import { formatCents, parseReaisToCents } from "@/lib/money";

type Forma = { id: string; name: string; account_id: string | null };

interface Linha {
  formaId: string;
  valor: string;
  parcelas: number;
  bandeira: Bandeira | "";
}

const CAMPO = "rounded-md border border-border bg-surface-elevated p-2 text-sm text-text min-h-11 md:min-h-9";
const hojeLocal = () => new Intl.DateTimeFormat("en-CA").format(new Date());
const reais = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export function FechamentoComTaxas({
  comandaId,
  totalCents,
  moeda,
  formas,
  maquininhas,
  config,
  temContato,
  pendente,
  onFinalizar,
  onCancelar,
}: {
  comandaId: string;
  totalCents: number;
  moeda: string;
  formas: Forma[];
  maquininhas: { adquirentes: AdquirenteNaTela[]; formas: FormaNaTela[] };
  config: ConfigFinanceiro;
  temContato: boolean;
  pendente: boolean;
  onFinalizar: (corpo: Record<string, unknown>) => void;
  onCancelar: () => void;
}) {
  const t = useT();
  const [linhas, setLinhas] = useState<Linha[]>([{ formaId: "", valor: reais(totalCents), parcelas: 1, bandeira: "" }]);
  const [pontos, setPontos] = useState("");
  const custo = useQuery({
    queryKey: ["clinic", "financeiro", "custo", comandaId, totalCents],
    queryFn: async () =>
      (
        await apiClient.get<{ data: { comissao_cents: number; insumos_cents: number | null; insumos_visiveis: boolean } }>(
          `/api/v1/clinic/financeiro/comandas/${comandaId}/custo`,
        )
      ).data,
  });

  const calc = useMemo(() => {
    const hoje = hojeLocal();
    return linhas.map((l) => {
      const valor = parseReaisToCents(l.valor) ?? 0;
      const extra = maquininhas.formas.find((f) => f.id === l.formaId);
      const tipo = extra?.tipo ?? null;
      const adq =
        tipo && ["pix", "debito", "credito"].includes(tipo)
          ? maquininhas.adquirentes.find((a) => a.id === extra?.adquirente_id)
          : undefined;
      if (!l.formaId || valor <= 0) return { valor, tipo, adq, r: null, erro: null as string | null };
      if (!adq) return { valor, tipo, adq, r: null, erro: null };
      try {
        const r = calcularRecebimento({
          adquirente: adq,
          tabelas: adq.tabelas,
          modalidade: tipo as Modalidade,
          bandeira: l.bandeira || null,
          parcelas: tipo === "credito" ? l.parcelas : 1,
          bruto_cents: valor,
          data: hoje,
        });
        return { valor, tipo, adq, r, erro: null };
      } catch (e) {
        return { valor, tipo, adq, r: null, erro: e instanceof ErroDeTaxa ? e.codigo : "erro" };
      }
    });
  }, [linhas, maquininhas]);

  const soma = calc.reduce((s, c) => s + c.valor, 0);
  const falta = totalCents - soma;
  const taxa = calc.reduce((s, c) => s + (c.r?.taxa_cents ?? 0), 0);
  const liquido = calc.reduce((s, c) => s + (c.r ? c.r.liquido_cents : c.valor), 0);
  const algumErro = calc.some((c) => c.erro);
  const semConta = linhas.some((l) => l.formaId && !formas.find((f) => f.id === l.formaId)?.account_id);
  const comissaoEstimada = custo.data
    ? config.comissao_base === "liquido" && totalCents > 0
      ? Math.floor((custo.data.comissao_cents * liquido) / totalCents)
      : custo.data.comissao_cents
    : null;
  const custoDireto = comissaoEstimada !== null ? comissaoEstimada + (custo.data?.insumos_cents ?? 0) : null;
  const margem =
    custoDireto !== null && totalCents > 0 ? Math.round(((liquido - custoDireto) * 10_000) / totalCents) / 100 : null;
  const alerta = margem !== null && margem < config.margem_minima_pct;
  const parcelado = linhas.some((l, i) => calc[i]?.tipo === "credito" && l.parcelas > 1);
  const pontosNumero = Number(pontos);
  const pontosValidos = pontos === "" || (Number.isInteger(pontosNumero) && pontosNumero >= 0);
  const pode = !pendente && falta === 0 && !algumErro && !semConta && pontosValidos && linhas.every((l) => l.formaId);

  const podeDividir = linhas.length < 6;
  const mudar = (i: number, p: Partial<Linha>) => setLinhas(linhas.map((l, j) => (j === i ? { ...l, ...p } : l)));

  return (
    <div className="space-y-3 border-t border-border pt-3" data-testid="fechamento-com-taxas">
      <ul className="space-y-2">
        {linhas.map((l, i) => {
          const c = calc[i];
          return (
            <li key={i} className="flex flex-wrap items-end gap-2" data-testid="pagamento-linha">
              <label className="flex flex-col gap-1 text-xs text-text-muted">
                {t("Forma de pagamento")}
                <select
                  value={l.formaId}
                  data-testid="forma-de-pagamento"
                  onChange={(e) => mudar(i, { formaId: e.target.value, parcelas: 1 })}
                  className={CAMPO}
                >
                  <option value="">{t("Escolha")}</option>
                  {formas.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              {c?.tipo === "credito" && c.adq ? (
                <label className="flex flex-col gap-1 text-xs text-text-muted">
                  {t("Parcelas")}
                  <select
                    value={l.parcelas}
                    data-testid="pagamento-parcelas"
                    onChange={(e) => mudar(i, { parcelas: Number(e.target.value) })}
                    className={CAMPO}
                  >
                    {Array.from({ length: 21 }, (_, k) => k + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}x
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {c?.adq && c.tipo !== "pix" ? (
                <label className="flex flex-col gap-1 text-xs text-text-muted">
                  {t("Bandeira")}
                  <select value={l.bandeira} onChange={(e) => mudar(i, { bandeira: e.target.value as Bandeira | "" })} className={CAMPO}>
                    <option value="">{t("Qualquer")}</option>
                    {BANDEIRAS.map((b) => (
                      <option key={b} value={b}>
                        {b === "outras" ? t("Outras") : b.charAt(0).toUpperCase() + b.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="flex flex-col gap-1 text-xs text-text-muted">
                {t("Valor")}
                <input
                  value={l.valor}
                  inputMode="decimal"
                  data-testid="pagamento-valor"
                  onChange={(e) => mudar(i, { valor: e.target.value })}
                  className={`${CAMPO} w-32`}
                />
              </label>
              {linhas.length > 1 ? (
                <Button variant="ghost" size="sm" onClick={() => setLinhas(linhas.filter((_, j) => j !== i))}>
                  {t("Remover")}
                </Button>
              ) : null}
              <p className="w-full text-xs text-text-muted" data-testid="pagamento-resumo">
                {c?.erro === "fin_taxa_ausente"
                  ? t("Esta maquininha não tem taxa para essa forma e número de parcelas. Complete a tabela.")
                  : c?.erro
                    ? t("Valores inválidos.")
                    : c?.r
                      ? `${t("Taxa")} ${formatCents(c.r.taxa_cents, moeda)} · ${t("líquido")} ${formatCents(c.r.liquido_cents, moeda)} · ${
                          c.r.parcelas.length > 1
                            ? `${c.r.parcelas.length}x ${t("até")} ${c.r.parcelas[c.r.parcelas.length - 1]?.vencimento}`
                            : `${t("entra em")} ${c.r.parcelas[0]?.vencimento}`
                        }`
                      : l.formaId && c && !c.adq
                        ? t("Entra na hora, sem taxa.")
                        : ""}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          data-testid="dividir-pagamento"
          disabled={!podeDividir}
          onClick={() => setLinhas([...linhas, { formaId: "", valor: reais(Math.max(falta, 0)), parcelas: 1, bandeira: "" }])}
        >
          {t("Dividir em outra forma")}
        </Button>
        <span className={`text-sm ${falta === 0 ? "text-text-muted" : "font-medium text-danger"}`} data-testid="falta-pagar">
          {falta === 0
            ? t("Soma confere com o total.")
            : falta > 0
              ? `${t("Falta")}: ${formatCents(falta, moeda)}`
              : `${t("Passou do total em")} ${formatCents(-falta, moeda)}`}
        </span>
      </div>

      <dl className="grid gap-1 rounded-xl border p-3 text-sm sm:grid-cols-2" data-testid="fechamento-simulacao">
        <div className="flex justify-between gap-4">
          <dt>{t("Taxas")}</dt>
          <dd className="tabular-nums" data-testid="fechamento-taxas">
            {formatCents(taxa, moeda)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 font-medium">
          <dt>{t("Líquido")}</dt>
          <dd className="tabular-nums" data-testid="fechamento-liquido">
            {formatCents(liquido, moeda)}
          </dd>
        </div>
        {custoDireto !== null ? (
          <div className="flex justify-between gap-4 text-text-muted">
            <dt>
              {custo.data?.insumos_visiveis ? t("Custo direto (insumos + comissão)") : t("Comissão estimada")}
            </dt>
            <dd className="tabular-nums">{formatCents(custoDireto, moeda)}</dd>
          </div>
        ) : null}
        {margem !== null ? (
          <div className={`flex justify-between gap-4 ${alerta ? "font-medium text-danger" : ""}`} data-testid="fechamento-margem">
            <dt>{alerta ? t("Margem abaixo do mínimo da clínica") : t("Margem")}</dt>
            <dd className="tabular-nums">
              {margem.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% ({t("mínimo")} {config.margem_minima_pct}%)
            </dd>
          </div>
        ) : null}
        {parcelado ? (
          <p className="text-xs text-text-muted sm:col-span-2">
            {t("Parcelado \"sem juros\" é custo da clínica: o paciente não paga juros, mas a taxa maior sai da sua margem.")}
          </p>
        ) : null}
      </dl>

      <div className="flex flex-wrap items-end gap-2">
        {temContato ? (
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            {t("Pontos de fidelidade")}
            <input
              value={pontos}
              inputMode="numeric"
              placeholder="0"
              data-testid="pontos-de-fidelidade"
              onChange={(e) => setPontos(e.target.value)}
              className={`${CAMPO} w-24`}
            />
          </label>
        ) : null}
        <Button
          disabled={!pode}
          data-testid="finalizar-comanda"
          onClick={() =>
            onFinalizar({
              pagamentos: linhas.map((l, i) => ({
                payment_method_id: l.formaId,
                valor_cents: calc[i]?.valor ?? 0,
                parcelas: calc[i]?.tipo === "credito" && calc[i]?.adq ? l.parcelas : 1,
                bandeira: calc[i]?.adq && l.bandeira ? l.bandeira : null,
              })),
              loyalty_points: temContato && pontos !== "" ? pontosNumero : 0,
            })
          }
        >
          {t("Finalizar")}
        </Button>
        <Button variant="ghost" onClick={onCancelar} data-testid="cancelar-comanda">
          {t("Cancelar comanda")}
        </Button>
      </div>
      {semConta ? (
        <p className="text-xs text-danger" data-testid="aviso-forma-sem-conta">
          {t("Esta forma de pagamento ainda não tem conta de destino. Defina em Configurações › Financeiro.")}
        </p>
      ) : null}
    </div>
  );
}
