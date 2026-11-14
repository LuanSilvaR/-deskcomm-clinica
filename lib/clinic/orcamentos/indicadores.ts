/**
 * FORK clinic (orçamento O5) — os indicadores comerciais do período.
 *
 * Régua (declarada na tela):
 *   • enviados  = orçamentos com `enviado_em` no período (qualquer status hoje);
 *   • aprovados = desses enviados, os que estão aprovados — a CONVERSÃO é
 *     aprovados ÷ enviados (a mesma coorte, para não passar de 100%);
 *   • valor aprovado e ticket médio = orçamentos com `aprovado_em` no período;
 *   • recusados/expirados = com `recusado_em`/`expirado_em` no período.
 * Versões substituídas não contam como enviadas de novo: só a versão que
 * terminou o ciclo (a substituída não aprova nem recusa). Sem dado clínico.
 */
export interface LinhaDoIndicador {
  status: string;
  total_cents: number;
  enviado_em: string | null;
  aprovado_em: string | null;
  recusado_em: string | null;
  expirado_em: string | null;
}

export interface Indicadores {
  enviados: number;
  aprovados_dos_enviados: number;
  conversao_pct: number | null;
  aprovados: number;
  valor_aprovado_cents: number;
  ticket_medio_cents: number | null;
  recusados: number;
  expirados: number;
  em_aberto: number;
}

const dentro = (iso: string | null, de: number, ate: number) => {
  if (!iso) return false;
  const t = Date.parse(iso);
  return t >= de && t < ate;
};

/** `de` inclusivo, `ate` exclusivo (ISO). */
export function calcularIndicadores(linhas: readonly LinhaDoIndicador[], deIso: string, ateIso: string): Indicadores {
  const de = Date.parse(deIso);
  const ate = Date.parse(ateIso);
  const enviados = linhas.filter((l) => l.status !== "substituido" && dentro(l.enviado_em, de, ate));
  const aprovadosDosEnviados = enviados.filter((l) => l.status === "aprovado").length;
  const aprovados = linhas.filter((l) => l.status === "aprovado" && dentro(l.aprovado_em, de, ate));
  const valor = aprovados.reduce((s, l) => s + Number(l.total_cents), 0);
  return {
    enviados: enviados.length,
    aprovados_dos_enviados: aprovadosDosEnviados,
    conversao_pct: enviados.length > 0 ? Math.round((aprovadosDosEnviados * 1000) / enviados.length) / 10 : null,
    aprovados: aprovados.length,
    valor_aprovado_cents: valor,
    ticket_medio_cents: aprovados.length > 0 ? Math.round(valor / aprovados.length) : null,
    recusados: linhas.filter((l) => l.status === "recusado" && dentro(l.recusado_em, de, ate)).length,
    expirados: linhas.filter((l) => l.status === "expirado" && dentro(l.expirado_em, de, ate)).length,
    em_aberto: linhas.filter((l) => l.status === "enviado").length,
  };
}

/** Primeiro dia do mês (UTC, ISO) e o primeiro do mês seguinte. `mes` = "AAAA-MM". */
export function intervaloDoMes(mes: string): { de: string; ate: string } {
  const [a, m] = mes.split("-").map(Number);
  const de = new Date(Date.UTC(a!, m! - 1, 1));
  const ate = new Date(Date.UTC(a!, m!, 1));
  return { de: de.toISOString(), ate: ate.toISOString() };
}
