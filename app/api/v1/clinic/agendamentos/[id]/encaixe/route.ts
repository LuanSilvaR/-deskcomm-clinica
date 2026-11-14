/**
 * GET /api/v1/clinic/agendamentos/[id]/encaixe — FORK clinic (agenda S6b, issue #69).
 *
 * O rastro do encaixe de UM compromisso: motivo, quem encaixou (nome), quando e
 * sobre quais compromissos. `agenda.ver`; compromisso de colega exige `agenda.ver_outros` (C9).
 * Sem encaixe = `encaixe: null`.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { isServiceRoleConfigured } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { escopoDaLeitura } from "@/lib/clinic/agenda/escopo-da-agenda";
import { traduzir } from "@/lib/i18n/dicionario";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("agenda.ver", { requestId, resource: "clinic_agenda_encaixes" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("Consulta inválida."), 422, { requestId });
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data: ag } = await supabase
    .from("calendar_appointments")
    .select("owner_user_id")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (!ag) return fail("not_found", t("Agendamento não encontrado."), 404, { requestId });
  const escopo = escopoDaLeitura({
    permissoes: authz.permissoes,
    usuarioId: authz.user.id,
    pedido: (ag as { owner_user_id: string | null }).owner_user_id,
  });
  if (!escopo.ok) {
    return fail("forbidden_permission", t("Você só pode ver a sua própria agenda."), 403, {
      requestId,
      details: { permissao: "agenda.ver_outros" },
    });
  }

  const { data: enc, error } = await supabase
    .from("clinic_agenda_encaixes")
    .select("motivo, ator, created_at, sobrepostos")
    .eq("organization_id", org)
    .eq("appointment_id", id)
    .maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!enc) return ok({ encaixe: null }, { requestId });

  const linha = enc as { motivo: string; ator: string; created_at: string; sobrepostos: string[] };
  // O ator já é filtrado pela organização acima (linha do encaixe da empresa do cookie).
  const nome = isServiceRoleConfigured()
    ? ((await createAdminClient().auth.admin.getUserById(linha.ator)).data?.user?.user_metadata?.full_name as string | undefined)
    : undefined;
  return ok(
    {
      encaixe: {
        motivo: linha.motivo,
        autor: { id: linha.ator, nome: nome?.trim() || "Sem nome" },
        quando: linha.created_at,
        sobrepostos: linha.sobrepostos,
      },
    },
    { requestId },
  );
}
