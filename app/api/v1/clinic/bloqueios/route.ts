/**
 * /api/v1/clinic/bloqueios — bloqueio de agenda por período, recorrente e da
 * clínica toda (`clinic_agenda_blocks`, migration 9001).
 *
 * GET (agent): os bloqueios que ainda valem (terminam hoje ou depois).
 * POST (agent): cria. Sem `user_id` e sem `clinica_toda` = a própria agenda;
 *   `user_id` de colega ou `clinica_toda` exigem manager+ — quem recusa é a RLS
 *   (403), a mesma régua de /api/v1/agenda/excecoes.
 * DELETE (agent): remove pelo id (a RLS decide se pode).
 *
 * O motor de horários livres só lê estes bloqueios com o módulo ligado
 * (organizations.settings.clinic.profissionais).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { eMembroDaOrg, falhaDoBanco } from "@/lib/clinic/api";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const COLUNAS = "id, user_id, starts_on, ends_on, start_minute, end_minute, weekdays, reason, created_at";
const DATA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use uma data em AAAA-MM-DD");
const MSG_PROIBIDO = "Você só pode bloquear a sua própria agenda. Agenda de colega e da clínica toda é com a gerência.";

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "clinic_agenda_blocks" });
  if (!authz.ok) return authz.response;

  const desde = new URL(req.url).searchParams.get("desde") ?? new Date().toISOString().slice(0, 10);
  if (!DATA.safeParse(desde).success) return fail("validation_failed", "data inválida", 422, { requestId });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_agenda_blocks")
    .select(COLUNAS)
    .eq("organization_id", authz.org.orgId)
    .gte("ends_on", desde)
    .order("starts_on", { ascending: true })
    .limit(500);
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok(data ?? [], { requestId });
}

const criarSchema = z
  .object({
    user_id: z.string().uuid().optional(),
    clinica_toda: z.boolean().default(false),
    starts_on: DATA,
    ends_on: DATA,
    start_minute: z.number().int().min(0).max(1440).default(0),
    end_minute: z.number().int().min(0).max(1440).default(1440),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).nullish(),
    reason: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.end_minute > v.start_minute, {
    message: "O fim precisa ser depois do começo.",
    path: ["end_minute"],
  })
  .refine((v) => v.ends_on >= v.starts_on, {
    message: "A data final precisa ser igual ou depois da inicial.",
    path: ["ends_on"],
  })
  .refine(
    (v) => (Date.parse(`${v.ends_on}T00:00:00Z`) - Date.parse(`${v.starts_on}T00:00:00Z`)) / 86_400_000 <= 366,
    { message: "O período pode ter no máximo um ano.", path: ["ends_on"] },
  )
  .refine((v) => !(v.clinica_toda && v.user_id), {
    message: "Escolha um profissional OU a clínica toda.",
    path: ["user_id"],
  });

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "clinic_agenda_blocks" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const lido = criarSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return fail("validation_failed", t(lido.error.issues[0]?.message ?? "corpo inválido"), 422, { requestId });
  }
  const org = authz.org.orgId;
  const dono = lido.data.clinica_toda ? null : (lido.data.user_id ?? authz.user.id);

  // Agenda de colega e da clínica toda é de manager+. A RLS também recusa, mas
  // aqui a resposta é clara — e evita que a checagem de membro abaixo, que para
  // um atendente só enxerga a própria linha, responda "não é membro".
  const gerencia = authz.org.role === "manager" || authz.org.role === "admin";
  if (dono !== authz.user.id && !gerencia) {
    return fail("forbidden", t(MSG_PROIBIDO), 403, { requestId });
  }

  const supabase = await createClient();
  if (dono !== null && dono !== authz.user.id && !(await eMembroDaOrg(supabase, org, dono))) {
    return fail("validation_failed", t("Essa pessoa não é membro da equipe."), 422, { requestId });
  }

  const weekdays = lido.data.weekdays ? [...new Set(lido.data.weekdays)].sort() : null;
  const { data, error } = await supabase
    .from("clinic_agenda_blocks")
    .insert({
      organization_id: org,
      user_id: dono,
      starts_on: lido.data.starts_on,
      ends_on: lido.data.ends_on,
      start_minute: lido.data.start_minute,
      end_minute: lido.data.end_minute,
      weekdays,
      reason: lido.data.reason || null,
      created_by: authz.user.id,
    })
    .select(COLUNAS)
    .single();
  if (error) return falhaDoBanco(error, requestId, t, { proibido: MSG_PROIBIDO });

  void audit({
    action: "clinic.bloqueio_criado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_agenda_block",
    resourceId: data.id,
    requestId,
    metadata: {
      dono,
      clinica_toda: dono === null,
      starts_on: lido.data.starts_on,
      ends_on: lido.data.ends_on,
      recorrente: weekdays !== null,
      dia_inteiro: lido.data.start_minute === 0 && lido.data.end_minute === 1440,
    },
  });
  return ok(data, { requestId, status: 201 });
}

const apagarSchema = z.object({ id: z.string().uuid() });

export async function DELETE(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "clinic_agenda_blocks" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const lido = apagarSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("id inválido."), 422, { requestId });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_agenda_blocks")
    .delete()
    .eq("id", lido.data.id)
    .eq("organization_id", authz.org.orgId)
    .select("id, user_id, starts_on, ends_on")
    .maybeSingle();
  if (error) return falhaDoBanco(error, requestId, t, { proibido: MSG_PROIBIDO });
  // A RLS esconde de quem não pode apagar: sem linha = não achou OU não pode.
  if (!data) return fail("not_found", t("Bloqueio não encontrado."), 404, { requestId });

  void audit({
    action: "clinic.bloqueio_removido",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "clinic_agenda_block",
    resourceId: data.id,
    requestId,
    metadata: { dono: data.user_id, starts_on: data.starts_on, ends_on: data.ends_on },
  });
  return ok({ id: data.id }, { requestId });
}
