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

export async function idsDeOrgsParadas(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin.from("organizations").select("id").neq("status", STATUS_OPERANTE);
  if (error) throw new Error(`idsDeOrgsParadas: ${error.message}`);
  return ((data ?? []) as Array<{ id: string }>).map((linha) => linha.id);
}
