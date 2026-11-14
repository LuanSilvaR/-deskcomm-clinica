/**
 * FORK clinic (ACL-004) — as permissões EFETIVAS de quem está logado numa empresa.
 *
 * Uma pergunta ao banco (`fn_member_permissions`, migration 9009), pelo client
 * de SESSÃO: a função só responde sobre o próprio auth.uid(). Modo desligado =
 * as permissões do nível legado; ligado = a união dos papéis ativos; suporte =
 * todas (acesso total) ou as de leitura. Sem cache compartilhado e nada no JWT:
 * revogação vale na próxima requisição (decisão D6 do plano ACL).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function permissoesEfetivas(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ ok: true; permissoes: ReadonlySet<string> } | { ok: false; erro: string }> {
  const { data, error } = await supabase.rpc("fn_member_permissions", { p_org: organizationId });
  if (error) return { ok: false, erro: error.message };
  const chaves = ((data ?? []) as unknown[]).map((l) => (typeof l === "string" ? l : String((l as Record<string, unknown>).fn_member_permissions ?? "")));
  return { ok: true, permissoes: new Set(chaves.filter(Boolean)) };
}
