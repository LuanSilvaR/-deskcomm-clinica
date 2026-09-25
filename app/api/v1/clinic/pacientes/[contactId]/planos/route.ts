/**
 * FORK clinic (prontuário F4) — planos de tratamento do paciente.
 *
 * GET  — os planos com as sessões (`planos.ver`), os agendamentos do paciente
 *        que ainda podem virar sessão e os tipos de atendimento (para a tela).
 * POST — cria um plano (`planos.gerenciar`); `atendimento_origem_id` liga o
 *        plano à conduta que o gerou.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoBanco } from "@/lib/clinic/atendimento/servidor";
import { planosDoPaciente } from "@/lib/clinic/planos/leitura";
import { leituraClinicaPermitida } from "@/lib/clinic/prontuario/limite";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ contactId: string }> };

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish();
const corpo = z
  .object({
    titulo: z.string().trim().min(1).max(120),
    objetivo: z.string().max(2000).nullish(),
    observacoes: z.string().max(2000).nullish(),
    inicio: data,
    previsao_fim: data,
    atendimento_origem_id: z.string().uuid().nullish(),
  })
  .strict();

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("planos.ver", { requestId, resource: "clinic_planos_tratamento" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { contactId } = await ctx.params;
  if (!z.string().uuid().safeParse(contactId).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  if (!(await leituraClinicaPermitida(authz.user.id, "planos"))) {
    return fail("rate_limited", t("Muitas leituras seguidas. Aguarde alguns minutos."), 429, { requestId });
  }
  const org = authz.org.orgId;

  const supabase = await createClient();
  try {
    const planos = await planosDoPaciente(supabase, org, contactId);
    const ligados = new Set(planos.flatMap((p) => p.sessoes.map((s) => s.appointment_id)).filter(Boolean));
    const desde = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [ags, tipos] = await Promise.all([
      supabase
        .from("calendar_appointments")
        .select("id, starts_at, title, status")
        .eq("organization_id", org)
        .eq("contact_id", contactId)
        .gte("starts_at", desde)
        .not("status", "in", "(cancelled,no_show)")
        .order("starts_at", { ascending: true })
        .limit(50),
      supabase.from("calendar_event_types").select("id, name").eq("organization_id", org).order("name", { ascending: true }),
    ]);
    if (ags.error ?? tipos.error) return fail("internal_error", (ags.error ?? tipos.error)!.message, 500, { requestId });
    void audit({
      action: "clinic.prontuario_visto",
      actorUserId: authz.user.id,
      organizationId: org,
      resourceType: "contact",
      resourceId: contactId,
      requestId,
      metadata: { area: "planos" },
    });
    return ok(
      {
        planos,
        agendamentos: (ags.data ?? [])
          .filter((a) => !ligados.has(a.id as string))
          .map((a) => ({ id: a.id as string, inicio: a.starts_at as string, titulo: (a.title as string | null) ?? null })),
        tipos: (tipos.data ?? []).map((x) => ({ id: x.id as string, nome: x.name as string })),
        pode_gerenciar: authz.permissoes.has("planos.gerenciar"),
      },
      { requestId },
    );
  } catch (e) {
    return fail("internal_error", (e as Error).message, 500, { requestId });
  }
}

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("planos.gerenciar", { requestId, resource: "clinic_planos_tratamento" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { contactId } = await ctx.params;
  if (!z.string().uuid().safeParse(contactId).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const d = lido.data;

  const supabase = await createClient();
  const { data: r, error } = await supabase.rpc("fn_clinic_plano_salvar", {
    p_org: org,
    p_plano: null,
    p_contact: contactId,
    p_titulo: d.titulo,
    p_objetivo: d.objetivo ?? null,
    p_observacoes: d.observacoes ?? null,
    p_inicio: d.inicio ?? null,
    p_previsao_fim: d.previsao_fim ?? null,
    p_specialty: null,
    p_atendimento_origem: d.atendimento_origem_id ?? null,
    p_status: "ativo",
    p_versao_esperada: 0,
  });
  if (error) {
    const e = erroDoBanco(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const res = r as { id: string; versao: number };
  void audit({
    action: "clinic.plano_criado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_plano_tratamento",
    resourceId: res.id,
    requestId,
    metadata: { contact_id: contactId, da_conduta: !!d.atendimento_origem_id },
  });
  return ok(res, { requestId });
}
