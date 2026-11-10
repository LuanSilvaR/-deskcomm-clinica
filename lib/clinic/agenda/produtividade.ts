/**
 * FORK clinic (agenda S7 #70) — produtividade da Agenda, sem tela: favoritos,
 * vizinho na lista de profissionais, atalhos de teclado e preferências.
 *
 * Favoritos e preferências são POR USUÁRIO e por empresa, guardados no
 * navegador (conveniência pessoal, como os "Recentes" da S1). Ler/gravar nunca
 * derruba a tela: storage bloqueado = padrão. Puro e testado.
 */
import type { VisaoDaAgenda } from "@/components/agenda/tipos";

/** Favoritos primeiro (na ordem em que foram marcados), depois o resto na ordem da lista. */
export function ordenarComFavoritos<T extends { user_id: string }>(lista: readonly T[], favoritos: readonly string[]): T[] {
  const fav = favoritos.map((id) => lista.find((p) => p.user_id === id)).filter((p): p is T => Boolean(p));
  const ids = new Set(fav.map((p) => p.user_id));
  return [...fav, ...lista.filter((p) => !ids.has(p.user_id))];
}

/** O profissional anterior (-1) ou seguinte (+1), dando a volta. `null` com menos de 2. */
export function vizinho<T extends { user_id: string }>(lista: readonly T[], atual: string | null, direcao: -1 | 1): T | null {
  if (lista.length < 2) return null;
  const i = lista.findIndex((p) => p.user_id === atual);
  const base = i < 0 ? (direcao === 1 ? -1 : 0) : i;
  return lista[(base + direcao + lista.length) % lista.length] ?? null;
}

export function alternarFavorito(favoritos: readonly string[], id: string): string[] {
  return favoritos.includes(id) ? favoritos.filter((x) => x !== id) : [...favoritos, id];
}

export type AcaoDeAtalho = "novo" | "hoje" | "dia" | "semana" | "mes" | "anterior" | "seguinte" | "ajuda";

export const ATALHOS_DA_AGENDA: ReadonlyArray<{ tecla: string; acao: AcaoDeAtalho; rotulo: string }> = [
  { tecla: "N", acao: "novo", rotulo: "Novo agendamento" },
  { tecla: "T", acao: "hoje", rotulo: "Ir para hoje" },
  { tecla: "D", acao: "dia", rotulo: "Visão do dia" },
  { tecla: "S", acao: "semana", rotulo: "Visão da semana" },
  { tecla: "M", acao: "mes", rotulo: "Visão do mês" },
  { tecla: "[", acao: "anterior", rotulo: "Profissional anterior" },
  { tecla: "]", acao: "seguinte", rotulo: "Próximo profissional" },
  { tecla: "?", acao: "ajuda", rotulo: "Mostrar atalhos" },
];

/** A ação de uma tecla — nunca dentro de campo de texto, nunca com Ctrl/Cmd/Alt. */
export function acaoDoAtalho(e: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  alvo?: { tagName?: string; isContentEditable?: boolean } | null;
}): AcaoDeAtalho | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const tag = (e.alvo?.tagName ?? "").toUpperCase();
  if (e.alvo?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return null;
  const tecla = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  return ATALHOS_DA_AGENDA.find((a) => a.tecla === tecla)?.acao ?? null;
}

export interface PreferenciasDaAgenda {
  visao: VisaoDaAgenda | null;
  mostrarFimDeSemana: boolean;
}
export const PREFERENCIAS_PADRAO: PreferenciasDaAgenda = { visao: null, mostrarFimDeSemana: true };

export function lerPreferencias(cru: string | null): PreferenciasDaAgenda {
  try {
    const p = cru ? (JSON.parse(cru) as Partial<PreferenciasDaAgenda>) : {};
    return {
      visao: p.visao === "dia" || p.visao === "semana" || p.visao === "mes" ? p.visao : null,
      mostrarFimDeSemana: typeof p.mostrarFimDeSemana === "boolean" ? p.mostrarFimDeSemana : true,
    };
  } catch {
    return PREFERENCIAS_PADRAO;
  }
}

export function lerFavoritos(cru: string | null): string[] {
  try {
    const v: unknown = cru ? JSON.parse(cru) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 50) : [];
  } catch {
    return [];
  }
}

export const chaveDaAgenda = (tipo: "favoritos" | "preferencias", orgId: string, usuarioId: string) =>
  `deskcomm.agenda.${tipo}.${orgId}.${usuarioId}`;

/** Resumo do agendamento para colar (WhatsApp, e-mail): paciente, dia, hora e profissional. */
export function resumoDoAgendamento(a: { paciente: string | null; inicio: Date; profissional: string | null; titulo: string }, formatar: (d: Date) => string): string {
  return [a.titulo, a.paciente, formatar(a.inicio), a.profissional ? `com ${a.profissional}` : null].filter(Boolean).join(" · ");
}
