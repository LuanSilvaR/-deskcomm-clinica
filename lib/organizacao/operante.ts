/**
 * A organização está OPERANTE? (recorte do upstream `lib/organizacao/operante.ts`, #84)
 *
 * O fork trouxe só o que o resumo diário do aviso de agendamento usa: a lista
 * de organizações paradas (`organizations.status` diferente de `active`:
 * suspensa, redigida ou arquivada). Organização parada não recebe o resumo das
 * 7h; o resto do módulo do upstream (suspensão por cobrança, erro de API)
 * depende de partes que o fork não tem.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const STATUS_OPERANTE = "active" as const;

// FORK (card #160c, migration 8028): a suspensão TIPADA do upstream (0501).
/** Por que a organização está suspensa. Par de `organizations_suspended_kind_check` (0501). */
export const TIPOS_DE_SUSPENSAO = ["administrativa", "cobranca"] as const;
export type TipoDeSuspensao = (typeof TIPOS_DE_SUSPENSAO)[number];

export function ehOperante(status: string | null | undefined): boolean {
  return status === STATUS_OPERANTE;
}

/**
 * A organização está SUSPENSA (e não só "parada"): `redacted`/`archived` também não
 * operam, mas não são suspensões. Quem decide "só a suspensa pode X" (excluir pelo
 * painel, reativar) pergunta aqui, para a comparação com o texto morar num lugar só.
 */
export function estaSuspensa(status: string | null | undefined): boolean {
  return status === "suspended";
}

/**
 * Por que a organização está suspensa, ou `null` quando ela não está suspensa
 * (inclusive redigida ou arquivada com o tipo residual). Tipo nulo em org
 * suspensa vale como `administrativa`, como nas funções de estado. A comparação
 * com o literal da suspensão mora em `estaSuspensa`.
 */
export function tipoDaSuspensao(
  status: string | null | undefined,
  kind: string | null | undefined,
): TipoDeSuspensao | null {
  if (!estaSuspensa(status)) return null;
  return kind === "cobranca" ? "cobranca" : "administrativa";
}

export async function idsDeOrgsParadas(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin.from("organizations").select("id").neq("status", STATUS_OPERANTE);
  if (error) throw new Error(`idsDeOrgsParadas: ${error.message}`);
  return ((data ?? []) as Array<{ id: string }>).map((linha) => linha.id);
}
