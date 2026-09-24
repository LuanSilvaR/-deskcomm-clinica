/**
 * Peças comuns das rotas `app/api/v1/clinic/*`.
 *
 * ⚠️ A RLS confere a organização da LINHA escrita, não a das linhas que ela
 * referencia: um gerente de duas organizações poderia vincular a especialidade
 * da org B a um profissional da org A. Por isso toda rota confere, com filtro
 * EXPLÍCITO de organização, que os ids referenciados são da organização ativa
 * (`idsSaoDaOrg`) antes de gravar.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { fail } from "@/lib/api/wrappers";

/** Confere que TODOS os `ids` existem em `tabela` dentro de `organizationId`. */
export async function idsSaoDaOrg(
  supabase: SupabaseClient,
  tabela: "clinic_specialties" | "clinic_professionals" | "calendar_event_types" | "clinic_resources",
  organizationId: string,
  ids: readonly string[],
): Promise<boolean> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return true;
  const { data, error } = await supabase
    .from(tabela)
    .select("id")
    .eq("organization_id", organizationId)
    .in("id", unicos);
  if (error) return false;
  return (data ?? []).length === unicos.length;
}

/** O usuário é membro (convite aceito e não revogado) da organização? */
export async function eMembroDaOrg(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_organizations")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .not("accepted_at", "is", null)
    .is("revoked_at", null)
    .maybeSingle();
  return !error && data !== null;
}

/** Erro do Postgres → resposta da API, com as mensagens que a tela mostra. */
export function falhaDoBanco(
  error: { code?: string; message: string },
  requestId: string,
  t: (texto: string) => string,
  mensagens: { conflito?: string; proibido?: string } = {},
): Response {
  if (error.code === "23505") {
    return fail("conflict", t(mensagens.conflito ?? "Já existe um cadastro igual."), 409, { requestId });
  }
  if (error.code === "42501") {
    return fail("forbidden", t(mensagens.proibido ?? "Você não tem permissão para esta ação."), 403, {
      requestId,
    });
  }
  if (error.code === "23514") {
    return fail("validation_failed", t("Os dados não passaram na validação do banco."), 422, { requestId });
  }
  return fail("internal_error", error.message, 500, { requestId });
}
