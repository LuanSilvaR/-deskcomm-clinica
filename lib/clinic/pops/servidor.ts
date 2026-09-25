/**
 * FORK clinic (9015) — peças das rotas do POP.
 *
 * Nomes de quem criou/alterou/aprovou: o auth.users não é legível pela sessão,
 * então sai pelo service role — SEMPRE restrito a quem é membro da organização
 * resolvida pela sessão (nunca do corpo), como a rota da Equipe faz.
 */
import { fail } from "@/lib/api/wrappers";
import { isServiceRoleConfigured } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const COLUNAS_DA_VERSAO =
  "id, pop_id, major, minor, status, revision_reason, lock_version, created_at, created_by, updated_at, updated_by, approved_at, approved_by, superseded_at";

export interface VersaoDoPop {
  id: string;
  pop_id: string;
  major: number;
  minor: number;
  status: "draft" | "approved" | "superseded" | "archived";
  revision_reason: string | null;
  lock_version: number;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  superseded_at: string | null;
}

/** user_id → nome (ou e-mail), só para membros da organização. */
export async function nomesDosMembros(organizationId: string, ids: readonly (string | null)[]): Promise<Record<string, string>> {
  const unicos = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (unicos.length === 0 || !isServiceRoleConfigured()) return {};
  const admin = createAdminClient();
  const { data } = await admin.from("user_organizations").select("user_id").eq("organization_id", organizationId).in("user_id", unicos);
  const membros = ((data ?? []) as { user_id: string }[]).map((m) => m.user_id);
  const pares = await Promise.all(
    membros.map(async (id) => {
      const { data: r } = await admin.auth.admin.getUserById(id);
      const u = r?.user;
      const nome = ((u?.user_metadata?.full_name as string | undefined) ?? "").trim() || u?.email || null;
      return [id, nome] as const;
    }),
  );
  return Object.fromEntries(pares.filter((p): p is readonly [string, string] => Boolean(p[1])));
}

/** Erro das funções fn_pop_* → resposta com a mensagem que a tela mostra. */
export function falhaDoPop(error: { code?: string; message: string }, requestId: string, t: (s: string) => string): Response {
  const m = error.message;
  if (m.includes("acesso_mfa_exigido")) return fail("mfa_required", t("Confirme a verificação em duas etapas para esta ação."), 403, { requestId });
  if (m.includes("acesso_proibido")) return fail("forbidden_permission", t("Você não tem permissão para esta ação."), 403, { requestId });
  if (m.includes("procedimento_nao_encontrado") || m.includes("pop_nao_encontrado") || m.includes("pop_versao_nao_encontrada")) {
    return fail("not_found", t("POP não encontrado."), 404, { requestId });
  }
  if (m.includes("pop_ja_existe")) return fail("conflict", t("Este procedimento já tem um POP."), 409, { requestId });
  if (m.includes("pop_ja_tem_rascunho")) return fail("pop_ja_tem_rascunho", t("Já existe uma versão em rascunho. Termine ou descarte antes de criar outra."), 409, { requestId });
  if (m.includes("pop_sem_versao_aprovada")) return fail("pop_sem_versao_aprovada", t("Aprove a primeira versão antes de criar uma nova."), 409, { requestId });
  if (m.includes("pop_editado_por_outra_pessoa")) {
    return fail("pop_editado_por_outra_pessoa", t("Outra pessoa alterou este rascunho. Recarregue para ver a versão atual."), 409, { requestId });
  }
  if (m.includes("pop_versao_nao_e_rascunho") || m.includes("pop_versao_imutavel") || m.includes("pop_transicao_so_pela_funcao")) {
    return fail("pop_versao_imutavel", t("Esta versão já foi aprovada e não pode ser alterada. Crie uma nova versão."), 409, { requestId });
  }
  if (error.code === "23505") return fail("conflict", t("Já existe um POP com esse código."), 409, { requestId });
  return fail("internal_error", m, 500, { requestId });
}
