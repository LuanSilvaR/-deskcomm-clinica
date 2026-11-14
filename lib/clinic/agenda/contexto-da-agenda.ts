/**
 * FORK clinic (agenda por profissional, S1) — o CONTEXTO da Agenda.
 *
 * A agenda mostra UM profissional por vez: ele não é filtro, é o contexto da
 * tela (EMPRESA → PROFISSIONAL → AGENDA → FILTROS). Este módulo é puro:
 * decide QUEM está em contexto, lê e escreve a URL (`profissional`, `data`,
 * `visao`) e guarda o último e os recentes por usuário e empresa.
 */
/** O mesmo vocabulário de `components/agenda/tipos.ts` (lib não importa de componente). */
export type VisaoDaAgenda = "dia" | "semana" | "mes";

export interface ProfissionalDaAgenda {
  user_id: string;
  nome: string;
  especialidades: string[];
  ativo: boolean;
  /** É quem está logado. */
  eu: boolean;
  /**
   * Tipos de agendamento que ele NÃO atende (a especialidade exigida não é
   * dele). Lista de exclusão: tipo novo ou sem regra continua oferecido.
   */
  tipos_restritos: string[];
}

/** Os tipos que este profissional atende, na ordem em que vieram. */
export function tiposDoProfissional<T extends { id: string }>(
  tipos: readonly T[],
  profissional: Pick<ProfissionalDaAgenda, "tipos_restritos"> | null,
): T[] {
  if (!profissional) return [...tipos];
  const fora = new Set(profissional.tipos_restritos);
  return tipos.filter((t) => !fora.has(t.id));
}

/** As chaves da URL que este contexto possui (os filtros têm as deles). */
export const CHAVES_DO_CONTEXTO = ["profissional", "data", "visao"] as const;

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const VISOES: readonly VisaoDaAgenda[] = ["dia", "semana", "mes"];

export interface ContextoDaUrl {
  profissional: string | null;
  data: string | null;
  visao: VisaoDaAgenda | null;
}

/** O que a URL diz — só valores bem-formados; o resto vira `null`. */
export function lerContextoDaUrl(params: URLSearchParams): ContextoDaUrl {
  const profissional = params.get("profissional");
  const data = params.get("data");
  const visao = params.get("visao");
  return {
    profissional: profissional && /^[0-9a-f-]{36}$/i.test(profissional) ? profissional : null,
    data: data && DATA.test(data) ? data : null,
    visao: VISOES.includes(visao as VisaoDaAgenda) ? (visao as VisaoDaAgenda) : null,
  };
}

/**
 * QUEM a agenda mostra. Ordem: o que a URL pede → o último que a pessoa viu →
 * a própria agenda, se ela atende → o primeiro da lista. Só vale quem está na
 * lista que a API devolveu (ela já aplicou `agenda.ver_outros`) e está ativo;
 * pedido fora dela cai no próximo da ordem, nunca vira tela vazia por engano.
 */
export function resolverProfissional(args: {
  daUrl: string | null;
  ultimo: string | null;
  lista: readonly ProfissionalDaAgenda[];
}): string | null {
  const ativos = args.lista.filter((p) => p.ativo);
  const existe = (id: string | null) => (id && ativos.some((p) => p.user_id === id) ? id : null);
  return existe(args.daUrl) ?? existe(args.ultimo) ?? ativos.find((p) => p.eu)?.user_id ?? ativos[0]?.user_id ?? null;
}

/** Busca por parte do nome, sem acento e sem caixa ("ana" acha "Dra. Ana Carolina"). */
export function buscarProfissionais(
  lista: readonly ProfissionalDaAgenda[],
  texto: string,
): ProfissionalDaAgenda[] {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const termos = norm(texto).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return [...lista];
  return lista.filter((p) => {
    const alvo = norm(`${p.nome} ${p.especialidades.join(" ")}`);
    return termos.every((t) => alvo.includes(t));
  });
}

// ─── preferências no navegador (por usuário E empresa) ────────────────────────

export interface PreferenciasDaAgenda {
  ultimo: string | null;
  recentes: string[];
}

export const MAXIMO_DE_RECENTES = 5;

export function chaveDasPreferencias(orgId: string, usuarioId: string): string {
  return `agenda:${orgId}:${usuarioId}`;
}

/** Lê com tolerância: storage bloqueado, vazio ou com lixo vira "sem preferência". */
export function lerPreferencias(storage: Pick<Storage, "getItem"> | null, chave: string): PreferenciasDaAgenda {
  const vazio: PreferenciasDaAgenda = { ultimo: null, recentes: [] };
  try {
    const bruto = storage?.getItem(chave);
    if (!bruto) return vazio;
    const v = JSON.parse(bruto) as Partial<PreferenciasDaAgenda>;
    return {
      ultimo: typeof v.ultimo === "string" ? v.ultimo : null,
      recentes: Array.isArray(v.recentes) ? v.recentes.filter((x): x is string => typeof x === "string").slice(0, MAXIMO_DE_RECENTES) : [],
    };
  } catch {
    return vazio;
  }
}

/** O profissional aberto agora vira o último e sobe para o topo dos recentes. */
export function registrarVisita(prefs: PreferenciasDaAgenda, id: string): PreferenciasDaAgenda {
  return { ultimo: id, recentes: [id, ...prefs.recentes.filter((x) => x !== id)].slice(0, MAXIMO_DE_RECENTES) };
}

export function gravarPreferencias(storage: Pick<Storage, "setItem"> | null, chave: string, prefs: PreferenciasDaAgenda): void {
  try {
    storage?.setItem(chave, JSON.stringify(prefs));
  } catch {
    // Modo privado ou cota cheia: a agenda funciona igual, só não lembra.
  }
}

/** As iniciais para o avatar ("Dra. Ana Carolina Mendes" → "AM"). */
export function iniciais(nome: string): string {
  const partes = nome
    .replace(/^(dra?|dr)\.?\s+/i, "")
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-ZÀ-Ú]/.test(p));
  const primeira = partes[0]?.[0] ?? "?";
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return `${primeira}${ultima}`.toUpperCase();
}
