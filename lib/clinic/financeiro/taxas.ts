/**
 * FORK clinic (financeiro FN1) — o motor de taxas de maquininha.
 *
 * Função pura: recebe a adquirente, as tabelas de taxas (com vigência) e a
 * venda, e devolve centavo a centavo quanto a clínica recebe, quando, e quanto
 * custa antecipar. O banco tem o espelho exato (`fn_clinic_fin_calcular`,
 * migration 9039) e um teste de paridade garante que os dois concordam.
 *
 * Regras (documentadas em docs/tarefas/financeiro/requisitos.md):
 *   • vale a tabela de MAIOR `vigente_desde` que não seja posterior à data da
 *     venda — editar taxas cria vigência nova, o passado não muda;
 *   • linha da bandeira vence a linha genérica (bandeira nula); entre linhas
 *     que servem, a faixa de parcelas mais estreita, depois a de menor início;
 *   • MDR = bruto × %, meio para cima; a tarifa fixa é por transação e cai na
 *     1ª parcela; bruto e MDR são rateados com o resto na 1ª parcela;
 *   • recebimento: Pix D+prazo_pix, débito D+prazo_debito, crédito parcela i
 *     em D+prazo_credito+30×(i−1);
 *   • antecipação "por_mes": juros simples por mês antecipado, parcela a
 *     parcela (líquido × % × dias ÷ 30); "fixa": % único sobre o líquido de
 *     cada parcela que ainda não venceu.
 */
import { aplicarPercentual, dividirArredondando, percentualEmMilionesimos, ratear } from "./dinheiro";

export const MODALIDADES = ["pix", "debito", "credito"] as const;
export type Modalidade = (typeof MODALIDADES)[number];

export const BANDEIRAS = ["visa", "mastercard", "elo", "amex", "hipercard", "outras"] as const;
export type Bandeira = (typeof BANDEIRAS)[number];

export const MAX_PARCELAS = 24;

export interface Adquirente {
  id: string;
  nome: string;
  prazo_pix_dias: number;
  prazo_debito_dias: number;
  prazo_credito_dias: number;
  tarifa_fixa_cents: number;
  antecipacao_pct: number;
  antecipacao_modo: "por_mes" | "fixa";
}

export interface LinhaDeTaxa {
  bandeira: Bandeira | null;
  modalidade: Modalidade;
  parcelas_de: number;
  parcelas_ate: number;
  mdr_pct: number;
}

export interface TabelaDeTaxas {
  id?: string;
  /** AAAA-MM-DD */
  vigente_desde: string;
  linhas: LinhaDeTaxa[];
}

export class ErroDeTaxa extends Error {
  constructor(public readonly codigo: "fin_taxa_ausente" | "fin_parcelas_invalidas" | "fin_taxa_maior_que_valor" | "fin_valor_invalido") {
    super(codigo);
  }
}

export interface ParcelaCalculada {
  n: number;
  vencimento: string;
  bruto_cents: number;
  mdr_cents: number;
  tarifa_cents: number;
  liquido_cents: number;
  antecipacao_cents: number;
  liquido_antecipado_cents: number;
}

export interface Recebimento {
  mdr_pct: number;
  vigente_desde: string;
  bruto_cents: number;
  mdr_cents: number;
  tarifa_cents: number;
  taxa_cents: number;
  liquido_cents: number;
  antecipacao_cents: number;
  liquido_antecipado_cents: number;
  /** taxa + antecipação (quando antecipa). */
  custo_total_cents: number;
  /** custo total ÷ bruto, em %, 2 casas. */
  custo_total_pct: number;
  parcelas: ParcelaCalculada[];
}

const DIA_MS = 86_400_000;

function paraDia(iso: string): number {
  const [a = 0, m = 1, d = 1] = iso.split("-").map(Number);
  return Date.UTC(a, m - 1, d) / DIA_MS;
}

export function somarDias(iso: string, dias: number): string {
  return new Date((paraDia(iso) + dias) * DIA_MS).toISOString().slice(0, 10);
}

export function diasEntre(de: string, ate: string): number {
  return paraDia(ate) - paraDia(de);
}

/** A tabela vigente na data: maior `vigente_desde` ≤ data. */
export function tabelaVigente(tabelas: readonly TabelaDeTaxas[], data: string): TabelaDeTaxas | null {
  let melhor: TabelaDeTaxas | null = null;
  for (const t of tabelas) {
    if (t.vigente_desde > data) continue;
    if (!melhor || t.vigente_desde > melhor.vigente_desde) melhor = t;
  }
  return melhor;
}

/** A linha que vale para a venda (bandeira específica vence a genérica). */
export function encontrarTaxa(
  linhas: readonly LinhaDeTaxa[],
  modalidade: Modalidade,
  bandeira: Bandeira | null,
  parcelas: number,
): LinhaDeTaxa | null {
  const servem = linhas.filter(
    (l) =>
      l.modalidade === modalidade &&
      parcelas >= l.parcelas_de &&
      parcelas <= l.parcelas_ate &&
      (l.bandeira === null || l.bandeira === bandeira),
  );
  servem.sort(
    (a, b) =>
      Number(a.bandeira === null) - Number(b.bandeira === null) ||
      a.parcelas_ate - a.parcelas_de - (b.parcelas_ate - b.parcelas_de) ||
      a.parcelas_de - b.parcelas_de,
  );
  return servem[0] ?? null;
}

function prazoDaParcela(adq: Adquirente, modalidade: Modalidade, n: number): number {
  if (modalidade === "pix") return adq.prazo_pix_dias;
  if (modalidade === "debito") return adq.prazo_debito_dias;
  return adq.prazo_credito_dias + 30 * (n - 1);
}

export function custoDeAntecipar(
  adq: Pick<Adquirente, "antecipacao_pct" | "antecipacao_modo">,
  liquidoCents: number,
  dias: number,
): number {
  if (dias <= 0 || liquidoCents <= 0 || adq.antecipacao_pct <= 0) return 0;
  if (adq.antecipacao_modo === "fixa") return aplicarPercentual(liquidoCents, adq.antecipacao_pct);
  // líquido × (% ÷ 100) × dias ÷ 30, meio para cima
  return Number(
    dividirArredondando(
      BigInt(liquidoCents) * percentualEmMilionesimos(adq.antecipacao_pct) * BigInt(dias),
      30n * 1_000_000n,
    ),
  );
}

export interface EntradaDoCalculo {
  adquirente: Adquirente;
  tabelas: readonly TabelaDeTaxas[];
  modalidade: Modalidade;
  bandeira: Bandeira | null;
  parcelas: number;
  bruto_cents: number;
  /** data da venda, AAAA-MM-DD */
  data: string;
  antecipar?: boolean;
  /** quando antecipa (padrão: a data da venda) */
  data_antecipacao?: string;
}

export function calcularRecebimento(e: EntradaDoCalculo): Recebimento {
  if (!Number.isInteger(e.bruto_cents) || e.bruto_cents <= 0) throw new ErroDeTaxa("fin_valor_invalido");
  if (
    !Number.isInteger(e.parcelas) ||
    e.parcelas < 1 ||
    e.parcelas > MAX_PARCELAS ||
    (e.modalidade !== "credito" && e.parcelas !== 1)
  ) {
    throw new ErroDeTaxa("fin_parcelas_invalidas");
  }
  const tabela = tabelaVigente(e.tabelas, e.data);
  const linha = tabela ? encontrarTaxa(tabela.linhas, e.modalidade, e.bandeira, e.parcelas) : null;
  if (!tabela || !linha) throw new ErroDeTaxa("fin_taxa_ausente");

  const mdr = aplicarPercentual(e.bruto_cents, linha.mdr_pct);
  const tarifa = e.adquirente.tarifa_fixa_cents;
  if (mdr + tarifa > e.bruto_cents) throw new ErroDeTaxa("fin_taxa_maior_que_valor");

  const brutos = ratear(e.bruto_cents, e.parcelas);
  const mdrs = ratear(mdr, e.parcelas);
  const dataAnt = e.data_antecipacao ?? e.data;
  const parcelas: ParcelaCalculada[] = brutos.map((bruto, i) => {
    const n = i + 1;
    const tarifaDaParcela = n === 1 ? tarifa : 0;
    const mdrDaParcela = mdrs[i] ?? 0;
    const liquido = bruto - mdrDaParcela - tarifaDaParcela;
    const vencimento = somarDias(e.data, prazoDaParcela(e.adquirente, e.modalidade, n));
    const antecipacao = e.antecipar ? custoDeAntecipar(e.adquirente, liquido, diasEntre(dataAnt, vencimento)) : 0;
    return {
      n,
      vencimento,
      bruto_cents: bruto,
      mdr_cents: mdrDaParcela,
      tarifa_cents: tarifaDaParcela,
      liquido_cents: liquido,
      antecipacao_cents: antecipacao,
      liquido_antecipado_cents: liquido - antecipacao,
    };
  });
  const liquido = parcelas.reduce((s, p) => s + p.liquido_cents, 0);
  const antecipacao = parcelas.reduce((s, p) => s + p.antecipacao_cents, 0);
  const custo = mdr + tarifa + antecipacao;
  return {
    mdr_pct: linha.mdr_pct,
    vigente_desde: tabela.vigente_desde,
    bruto_cents: e.bruto_cents,
    mdr_cents: mdr,
    tarifa_cents: tarifa,
    taxa_cents: mdr + tarifa,
    liquido_cents: liquido,
    antecipacao_cents: antecipacao,
    liquido_antecipado_cents: liquido - antecipacao,
    custo_total_cents: custo,
    custo_total_pct: Math.round((custo * 10_000) / e.bruto_cents) / 100,
    parcelas,
  };
}

// ─── ferramentas da gestora ─────────────────────────────────────────────────

/**
 * Menor preço P em que, depois da taxa, sobra a margem desejada sobre o preço:
 * (P − MDR(P) − tarifa − custo) ≥ margem% × P. `null` se a taxa + margem
 * passam de 100% (nenhum preço resolve).
 */
export function precoComMargem(opts: {
  custo_cents: number;
  margem_pct: number;
  mdr_pct: number;
  tarifa_cents: number;
}): number | null {
  const fracao = 1 - opts.mdr_pct / 100 - opts.margem_pct / 100;
  if (fracao <= 0) return null;
  const atende = (p: number) =>
    (p - aplicarPercentual(p, opts.mdr_pct) - opts.tarifa_cents - opts.custo_cents) * 10_000 >=
    Math.round(opts.margem_pct * 100) * p;
  let p = Math.max(1, Math.ceil((opts.custo_cents + opts.tarifa_cents) / fracao));
  while (p > 1 && atende(p - 1)) p -= 1;
  while (!atende(p)) p += 1;
  return p;
}

/** Menor preço cobrado que deixa pelo menos `liquido_cents` líquido. */
export function precoParaLiquido(opts: { liquido_cents: number; mdr_pct: number; tarifa_cents: number }): number | null {
  return precoComMargem({ custo_cents: opts.liquido_cents, margem_pct: 0, mdr_pct: opts.mdr_pct, tarifa_cents: opts.tarifa_cents });
}

export interface ItemDoMix {
  modalidade: Modalidade;
  parcelas: number;
  bandeira: Bandeira | null;
  /** quanto da receita passa por aqui, em centavos */
  valor_cents: number;
}

export interface ComparativoDaAdquirente {
  adquirente_id: string;
  nome: string;
  taxa_cents: number;
  taxa_pct: number;
  /** modalidades do mix que esta adquirente não cobre */
  sem_taxa: Array<Pick<ItemDoMix, "modalidade" | "parcelas">>;
}

/** Quanto cada adquirente cobraria sobre o mesmo mix de vendas (mais barata primeiro). */
export function compararAdquirentes(
  mix: readonly ItemDoMix[],
  opcoes: ReadonlyArray<{ adquirente: Adquirente; tabelas: readonly TabelaDeTaxas[] }>,
  data: string,
): ComparativoDaAdquirente[] {
  const total = mix.reduce((s, i) => s + i.valor_cents, 0);
  return opcoes
    .map(({ adquirente, tabelas }) => {
      let taxa = 0;
      const sem: ComparativoDaAdquirente["sem_taxa"] = [];
      for (const item of mix) {
        if (item.valor_cents <= 0) continue;
        try {
          taxa += calcularRecebimento({
            adquirente: { ...adquirente, tarifa_fixa_cents: 0 },
            tabelas,
            modalidade: item.modalidade,
            bandeira: item.bandeira,
            parcelas: item.parcelas,
            bruto_cents: item.valor_cents,
            data,
          }).taxa_cents;
        } catch {
          sem.push({ modalidade: item.modalidade, parcelas: item.parcelas });
        }
      }
      return {
        adquirente_id: adquirente.id,
        nome: adquirente.nome,
        taxa_cents: taxa,
        taxa_pct: total > 0 ? Math.round((taxa * 10_000) / total) / 100 : 0,
        sem_taxa: sem,
      };
    })
    .sort((a, b) => a.sem_taxa.length - b.sem_taxa.length || a.taxa_cents - b.taxa_cents);
}
