/**
 * FORK clinic (financeiro FN1) — leitura das maquininhas e o simulador.
 *
 * Lê pelo cliente do usuário (RLS: financeiro.ver na própria empresa) e entrega
 * no formato do motor (`taxas.ts`), para a tela simular com a MESMA régua que o
 * banco usa ao gravar.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { hojeNoFuso } from "@/lib/clinic/navegacao/resumo-do-dia";

import {
  calcularRecebimento,
  compararAdquirentes,
  ErroDeTaxa,
  precoComMargem,
  type Adquirente,
  type Bandeira,
  type ComparativoDaAdquirente,
  type LinhaDeTaxa,
  type Modalidade,
  type Recebimento,
  type TabelaDeTaxas,
} from "./taxas";

export interface AdquirenteNaTela extends Adquirente {
  modelo: string | null;
  ativo: boolean;
  /** vigências não canceladas, da mais nova para a mais antiga */
  tabelas: Array<TabelaDeTaxas & { id: string }>;
}

export interface FormaNaTela {
  id: string;
  nome: string;
  ativa: boolean;
  tipo: string | null;
  adquirente_id: string | null;
}

export interface Maquininhas {
  adquirentes: AdquirenteNaTela[];
  formas: FormaNaTela[];
}

export async function lerMaquininhas(supabase: SupabaseClient, orgId: string): Promise<Maquininhas> {
  const [adqs, tabs, linhas, formas, extras] = await Promise.all([
    supabase
      .from("clinic_fin_adquirentes")
      .select("id, nome, modelo, prazo_pix_dias, prazo_debito_dias, prazo_credito_dias, tarifa_fixa_cents, antecipacao_pct, antecipacao_modo, ativo")
      .eq("organization_id", orgId)
      .order("nome"),
    supabase
      .from("clinic_fin_tabelas")
      .select("id, adquirente_id, vigente_desde")
      .eq("organization_id", orgId)
      .is("cancelada_em", null)
      .order("vigente_desde", { ascending: false }),
    supabase
      .from("clinic_fin_taxas")
      .select("tabela_id, bandeira, modalidade, parcelas_de, parcelas_ate, mdr_pct")
      .eq("organization_id", orgId)
      .order("modalidade")
      .order("parcelas_de"),
    supabase.from("payment_methods").select("id, name, is_active").eq("organization_id", orgId).order("name"),
    supabase.from("clinic_fin_forma_extras").select("payment_method_id, tipo, adquirente_id").eq("organization_id", orgId),
  ]);
  for (const r of [adqs, tabs, linhas, formas, extras]) if (r.error) throw r.error;

  const linhasPorTabela = new Map<string, LinhaDeTaxa[]>();
  for (const l of (linhas.data ?? []) as Array<LinhaDeTaxa & { tabela_id: string; mdr_pct: number | string }>) {
    const lista = linhasPorTabela.get(l.tabela_id) ?? [];
    lista.push({
      bandeira: l.bandeira,
      modalidade: l.modalidade,
      parcelas_de: l.parcelas_de,
      parcelas_ate: l.parcelas_ate,
      mdr_pct: Number(l.mdr_pct),
    });
    linhasPorTabela.set(l.tabela_id, lista);
  }
  const tabelasPorAdq = new Map<string, AdquirenteNaTela["tabelas"]>();
  for (const t of (tabs.data ?? []) as Array<{ id: string; adquirente_id: string; vigente_desde: string }>) {
    const lista = tabelasPorAdq.get(t.adquirente_id) ?? [];
    lista.push({ id: t.id, vigente_desde: t.vigente_desde, linhas: linhasPorTabela.get(t.id) ?? [] });
    tabelasPorAdq.set(t.adquirente_id, lista);
  }
  const extraPorForma = new Map(
    ((extras.data ?? []) as Array<{ payment_method_id: string; tipo: string; adquirente_id: string | null }>).map((e) => [
      e.payment_method_id,
      e,
    ]),
  );
  return {
    adquirentes: ((adqs.data ?? []) as Array<Omit<AdquirenteNaTela, "tabelas"> & { antecipacao_pct: number | string }>).map(
      (a) => ({
        ...a,
        tarifa_fixa_cents: Number(a.tarifa_fixa_cents),
        antecipacao_pct: Number(a.antecipacao_pct),
        tabelas: tabelasPorAdq.get(a.id) ?? [],
      }),
    ),
    formas: ((formas.data ?? []) as Array<{ id: string; name: string; is_active: boolean }>).map((f) => ({
      id: f.id,
      nome: f.name,
      ativa: f.is_active,
      tipo: extraPorForma.get(f.id)?.tipo ?? null,
      adquirente_id: extraPorForma.get(f.id)?.adquirente_id ?? null,
    })),
  };
}

export interface Simulacao {
  data: string;
  recebimento: Recebimento | null;
  erro: ErroDeTaxa["codigo"] | null;
  /** margem depois da taxa e do custo, sobre o bruto (%), quando o custo veio */
  margem_pct: number | null;
  alerta_margem: boolean;
  /** menor preço que mantém a margem desejada nesta forma e parcelas */
  preco_sugerido_cents: number | null;
  comparativo: ComparativoDaAdquirente[];
}

export const MARGEM_MINIMA_PADRAO = 30;

export function simular(
  maq: Maquininhas,
  pedido: {
    adquirente_id: string;
    modalidade: Modalidade;
    bandeira: Bandeira | null;
    parcelas: number;
    bruto_cents: number;
    data?: string;
    antecipar: boolean;
    custo_cents?: number;
    margem_pct?: number;
  },
  fuso: string | null,
  agora: Date = new Date(),
): Simulacao | null {
  const adq = maq.adquirentes.find((a) => a.id === pedido.adquirente_id);
  if (!adq) return null;
  const data = pedido.data ?? hojeNoFuso(agora, fuso || "America/Sao_Paulo");
  let recebimento: Recebimento | null = null;
  let erro: Simulacao["erro"] = null;
  try {
    recebimento = calcularRecebimento({
      adquirente: adq,
      tabelas: adq.tabelas,
      modalidade: pedido.modalidade,
      bandeira: pedido.bandeira,
      parcelas: pedido.parcelas,
      bruto_cents: pedido.bruto_cents,
      data,
      antecipar: pedido.antecipar,
    });
  } catch (e) {
    if (!(e instanceof ErroDeTaxa)) throw e;
    erro = e.codigo;
  }
  const margemDesejada = pedido.margem_pct ?? MARGEM_MINIMA_PADRAO;
  const recebido = recebimento ? (pedido.antecipar ? recebimento.liquido_antecipado_cents : recebimento.liquido_cents) : null;
  const margem =
    recebido !== null && pedido.custo_cents !== undefined
      ? Math.round(((recebido - pedido.custo_cents) * 10_000) / pedido.bruto_cents) / 100
      : null;
  const preco =
    recebimento && pedido.custo_cents !== undefined
      ? precoComMargem({
          custo_cents: pedido.custo_cents,
          margem_pct: margemDesejada,
          mdr_pct: recebimento.mdr_pct,
          tarifa_cents: recebimento.tarifa_cents,
        })
      : null;
  const comparativo = compararAdquirentes(
    [{ modalidade: pedido.modalidade, parcelas: pedido.parcelas, bandeira: pedido.bandeira, valor_cents: pedido.bruto_cents }],
    maq.adquirentes.filter((a) => a.ativo).map((a) => ({ adquirente: a, tabelas: a.tabelas })),
    data,
  );
  return {
    data,
    recebimento,
    erro,
    margem_pct: margem,
    alerta_margem: margem !== null && margem < margemDesejada,
    preco_sugerido_cents: preco,
    comparativo,
  };
}

// ─── FN2: configuração e contas a receber ───────────────────────────────────

export interface ConfigFinanceiro {
  ligado: boolean;
  comissao_base: "liquido" | "bruto";
  margem_minima_pct: number;
}

export function lerConfigFinanceiro(settings: unknown): ConfigFinanceiro {
  const clinic =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? ((settings as Record<string, unknown>).clinic as Record<string, unknown> | undefined)
      : undefined;
  const fin = (clinic?.fin ?? {}) as Record<string, unknown>;
  const margem = typeof fin.margem_minima_pct === "number" ? fin.margem_minima_pct : MARGEM_MINIMA_PADRAO;
  return {
    ligado: clinic?.financeiro_avancado === true,
    comissao_base: fin.comissao_base === "bruto" ? "bruto" : "liquido",
    margem_minima_pct: margem,
  };
}

export interface ParcelaNaTela {
  id: string;
  pagamento_id: string;
  sale_id: string;
  comanda: number | null;
  n: number;
  de: number;
  vencimento: string;
  bruto_cents: number;
  taxa_cents: number;
  liquido_cents: number;
  antecipacao_cents: number;
  status: "prevista" | "recebida" | "antecipada" | "estornada";
  forma: string | null;
  maquininha: string | null;
}

export interface Recebiveis {
  parcelas: ParcelaNaTela[];
  /** líquido previsto por janela a partir de hoje */
  a_receber: { em_30: number; em_60: number; em_90: number; total: number };
}

export async function lerRecebiveis(
  supabase: SupabaseClient,
  orgId: string,
  filtro: { status?: ParcelaNaTela["status"]; de?: string; ate?: string },
  hoje: string,
): Promise<Recebiveis> {
  let q = supabase
    .from("clinic_fin_parcelas")
    .select(
      "id, pagamento_id, sale_id, n, vencimento, bruto_cents, mdr_cents, tarifa_cents, liquido_cents, antecipacao_cents, status, " +
        "pagamento:clinic_fin_pagamentos!clinic_fin_parcelas_pagamento_fk(parcelas, payment_method:payment_methods(name), adquirente:clinic_fin_adquirentes!clinic_fin_pagamentos_adquirente_fk(nome)), " +
        "venda:sales(number)",
    )
    .eq("organization_id", orgId)
    .order("vencimento")
    .order("n")
    .limit(500);
  if (filtro.status) q = q.eq("status", filtro.status);
  if (filtro.de) q = q.gte("vencimento", filtro.de);
  if (filtro.ate) q = q.lte("vencimento", filtro.ate);
  const [lista, previstas] = await Promise.all([
    q,
    supabase
      .from("clinic_fin_parcelas")
      .select("vencimento, liquido_cents")
      .eq("organization_id", orgId)
      .eq("status", "prevista")
      .limit(10000),
  ]);
  if (lista.error) throw lista.error;
  if (previstas.error) throw previstas.error;
  type Linha = {
    id: string;
    pagamento_id: string;
    sale_id: string;
    n: number;
    vencimento: string;
    bruto_cents: number;
    mdr_cents: number;
    tarifa_cents: number;
    liquido_cents: number;
    antecipacao_cents: number;
    status: ParcelaNaTela["status"];
    pagamento: { parcelas: number; payment_method: { name: string } | null; adquirente: { nome: string } | null } | null;
    venda: { number: number } | null;
  };
  const dias = (iso: string) => (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000;
  const a = { em_30: 0, em_60: 0, em_90: 0, total: 0 };
  for (const p of (previstas.data ?? []) as Array<{ vencimento: string; liquido_cents: number }>) {
    const d = dias(p.vencimento);
    const v = Number(p.liquido_cents);
    a.total += v;
    if (d <= 30) a.em_30 += v;
    if (d <= 60) a.em_60 += v;
    if (d <= 90) a.em_90 += v;
  }
  return {
    parcelas: ((lista.data ?? []) as unknown as Linha[]).map((p) => ({
      id: p.id,
      pagamento_id: p.pagamento_id,
      sale_id: p.sale_id,
      comanda: p.venda?.number ?? null,
      n: p.n,
      de: p.pagamento?.parcelas ?? 1,
      vencimento: p.vencimento,
      bruto_cents: Number(p.bruto_cents),
      taxa_cents: Number(p.mdr_cents) + Number(p.tarifa_cents),
      liquido_cents: Number(p.liquido_cents),
      antecipacao_cents: Number(p.antecipacao_cents),
      status: p.status,
      forma: p.pagamento?.payment_method?.name ?? null,
      maquininha: p.pagamento?.adquirente?.nome ?? null,
    })),
    a_receber: a,
  };
}
