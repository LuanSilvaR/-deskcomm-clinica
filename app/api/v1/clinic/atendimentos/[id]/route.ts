/**
 * GET /api/v1/clinic/atendimentos/:id — o cabeçalho do atendimento.
 *
 * Paciente (nome e idade), serviço, profissional, especialidade, horários e
 * status. Exige `prontuario.ver` (chave clínica) e a RLS da 9017 confere de
 * novo. Toda leitura fica no registro de auditoria — só metadados.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { nomeDoContato } from "@/lib/contacts/rotulo-do-contato";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

type Um<T> = T | T[] | null;
const primeiro = <T,>(v: Um<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** Idade em anos completos na data de hoje, a partir de `AAAA-MM-DD`. */
function idade(nascimento: string | null, hoje = new Date()): number | null {
  if (!nascimento) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(nascimento);
  if (!m) return null;
  let anos = hoje.getUTCFullYear() - Number(m[1]);
  const mes = hoje.getUTCMonth() + 1;
  if (mes < Number(m[2]) || (mes === Number(m[2]) && hoje.getUTCDate() < Number(m[3]))) anos -= 1;
  return anos >= 0 && anos < 150 ? anos : null;
}

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("prontuario.ver", { requestId, resource: "clinic_atendimentos" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data: at, error } = await supabase
    .from("clinic_atendimentos")
    .select(
      "id, status, started_at, finished_at, appointment_id, contact_id, professional_user_id, versao, " +
        "contacts(name, display_name, birthdate), calendar_event_types(name), clinic_specialties(name)",
    )
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!at) return fail("not_found", t("Atendimento não encontrado."), 404, { requestId });

  const linha = at as unknown as {
    id: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    appointment_id: string | null;
    contact_id: string;
    professional_user_id: string | null;
    versao: number;
    contacts: Um<{ name?: string | null; display_name?: string | null; birthdate?: string | null }>;
    calendar_event_types: Um<{ name?: string | null }>;
    clinic_specialties: Um<{ name?: string | null }>;
  };
  const paciente = primeiro(linha.contacts);

  const { data: prof } = linha.professional_user_id
    ? await supabase
        .from("clinic_professionals")
        .select("display_name")
        .eq("organization_id", org)
        .eq("user_id", linha.professional_user_id)
        .maybeSingle()
    : { data: null };

  void audit({
    action: "clinic.atendimento_visto",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_atendimento",
    resourceId: linha.id,
    requestId,
  });

  return ok(
    {
      id: linha.id,
      status: linha.status,
      versao: linha.versao,
      inicio: linha.started_at,
      fim: linha.finished_at,
      appointment_id: linha.appointment_id,
      paciente: {
        id: linha.contact_id,
        nome: nomeDoContato(paciente),
        idade: idade(paciente?.birthdate ?? null),
      },
      servico: primeiro(linha.calendar_event_types)?.name ?? null,
      especialidade: primeiro(linha.clinic_specialties)?.name ?? null,
      profissional: (prof as { display_name?: string | null } | null)?.display_name ?? null,
      pode_finalizar: linha.status === "em_andamento" && authz.permissoes.has("atendimento.finalizar"),
    },
    { requestId },
  );
}
