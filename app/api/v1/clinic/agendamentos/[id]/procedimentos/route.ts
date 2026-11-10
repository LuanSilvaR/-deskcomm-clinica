/**
 * /api/v1/clinic/agendamentos/[id]/procedimentos — FORK clinic (agenda S3 #68, migration 8016).
 *
 * GET: os procedimentos do agendamento, na ordem (`agenda.ver`; o de um colega
 *      exige `agenda.ver_outros`).
 * PUT: troca a lista inteira (`{ procedimentos: uuid[] }`, até 50, ordem = posição).
 *      Exige `agenda.marcar` (quem acabou de marcar) ou `agenda.remarcar`. A
 *      gravação é por `fn_clinic_agendamento_procedimentos_salvar` (service role),
 *      com a organização da SESSÃO — nunca do corpo. A duração NÃO é somada.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { escopoDaLeitura } from "@/lib/clinic/agenda/escopo-da-agenda";
import { traduzir } from "@/lib/i18n/dicionario";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export interface ProcedimentoDoAgendamento {
  id: string;
  nome: string;
  ordem: number;
}

const corpoSchema = z.object({ procedimentos: z.array(z.string().uuid()).max(50) }).strict();

async function lerDono(org: string, id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("calendar_appointments").select("owner_user_id").eq("organization_id", org).eq("id", id).maybeSingle();
  return { supabase, dono: data ? ((data as { owner_user_id: string | null }).owner_user_id ?? null) : undefined };
}

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("agenda.ver", { requestId, resource: "calendar_appointments" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("Consulta inválida."), 422, { requestId });
  const org = authz.org.orgId;

  const { supabase, dono } = await lerDono(org, id);
  if (dono === undefined) return fail("not_found", t("Agendamento não encontrado."), 404, { requestId });
  if (!escopoDaLeitura({ permissoes: authz.permissoes, usuarioId: authz.user.id, pedido: dono }).ok) {
    return fail("forbidden_permission", t("Você só pode ver a sua própria agenda."), 403, { requestId, details: { permissao: "agenda.ver_outros" } });
  }

  const { data, error } = await supabase
    .from("clinic_agendamento_procedimentos")
    .select("procedure_id, ordem, clinic_procedures(name)")
    .eq("organization_id", org)
    .eq("appointment_id", id)
    .order("ordem", { ascending: true });
  if (error) return fail("internal_error", error.message, 500, { requestId });
  const procedimentos: ProcedimentoDoAgendamento[] = ((data ?? []) as Array<Record<string, unknown>>).map((l) => {
    const p = l.clinic_procedures as { name: string } | { name: string }[] | null;
    return { id: l.procedure_id as string, ordem: l.ordem as number, nome: (Array.isArray(p) ? p[0]?.name : p?.name) ?? "" };
  });
  return ok({ procedimentos }, { requestId });
}

export async function PUT(req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("agenda.ver", { requestId, resource: "calendar_appointments" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  if (!authz.permissoes.has("agenda.marcar") && !authz.permissoes.has("agenda.remarcar")) {
    return fail("forbidden_permission", t("Você não tem permissão para mudar este agendamento."), 403, {
      requestId,
      details: { permissao: "agenda.marcar" },
    });
  }
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("Consulta inválida."), 422, { requestId });
  const lido = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!lido.success) return fail("validation_failed", t("Lista de procedimentos inválida."), 422, { requestId });
  const org = authz.org.orgId;

  const { dono } = await lerDono(org, id);
  if (dono === undefined) return fail("not_found", t("Agendamento não encontrado."), 404, { requestId });
  if (!escopoDaLeitura({ permissoes: authz.permissoes, usuarioId: authz.user.id, pedido: dono }).ok) {
    return fail("forbidden_permission", t("Você só pode ver a sua própria agenda."), 403, { requestId, details: { permissao: "agenda.ver_outros" } });
  }

  const { data, error } = await createAdminClient().rpc("fn_clinic_agendamento_procedimentos_salvar", {
    p_org: org,
    p_appointment: id,
    p_procedimentos: lido.data.procedimentos,
    p_autor: authz.user.id,
  });
  if (error) {
    if (error.message.includes("procedimento_de_outra_organizacao")) {
      return fail("validation_failed", t("Procedimento não encontrado."), 422, { requestId });
    }
    if (error.message.includes("agendamento_nao_encontrado")) return fail("not_found", t("Agendamento não encontrado."), 404, { requestId });
    return fail("internal_error", error.message, 500, { requestId });
  }
  return ok({ total: data as number }, { requestId });
}
