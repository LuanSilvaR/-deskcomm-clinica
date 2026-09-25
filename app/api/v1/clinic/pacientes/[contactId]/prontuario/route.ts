/**
 * GET /api/v1/clinic/pacientes/:contactId/prontuario?antes=<ISO>&limite=20
 *
 * A linha do tempo clínica do paciente: atendimentos do mais novo para o mais
 * antigo, cada um com anamnese, avaliação, evolução e adendos. Paginada por
 * cursor (`antes` = início do último atendimento recebido), nunca o histórico
 * inteiro de uma vez. Exige `prontuario.ver`; toda leitura é auditada (só
 * metadados).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { registrosDosAtendimentos } from "@/lib/clinic/prontuario/leitura";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ contactId: string }> };
type Um<T> = T | T[] | null;
const primeiro = <T,>(v: Um<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

const query = z
  .object({
    antes: z.string().datetime({ offset: true }).optional(),
    limite: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

export async function GET(req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("prontuario.ver", { requestId, resource: "clinic_atendimentos" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);

  const { contactId } = await ctx.params;
  if (!z.string().uuid().safeParse(contactId).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!lido.success) return fail("validation_failed", t("Parâmetros inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const limite = lido.data.limite ?? 20;

  const supabase = await createClient();
  let consulta = supabase
    .from("clinic_atendimentos")
    .select("id, status, started_at, finished_at, professional_user_id, calendar_event_types(name), clinic_specialties(name)")
    .eq("organization_id", org)
    .eq("contact_id", contactId)
    .neq("status", "anulado")
    .order("started_at", { ascending: false })
    .limit(limite + 1);
  if (lido.data.antes) consulta = consulta.lt("started_at", lido.data.antes);
  const { data, error } = await consulta;
  if (error) return fail("internal_error", error.message, 500, { requestId });

  const linhas = (data ?? []).slice(0, limite) as unknown as Array<{
    id: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    professional_user_id: string | null;
    calendar_event_types: Um<{ name: string | null }>;
    clinic_specialties: Um<{ name: string | null }>;
  }>;
  const temMais = (data ?? []).length > limite;

  const profIds = [...new Set(linhas.map((l) => l.professional_user_id).filter((x): x is string => !!x))];
  const [{ data: profs }, registros] = await Promise.all([
    profIds.length
      ? supabase.from("clinic_professionals").select("user_id, display_name").eq("organization_id", org).in("user_id", profIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string; display_name: string | null }> }),
    registrosDosAtendimentos(
      supabase,
      org,
      linhas.map((l) => l.id),
    ).catch(() => null),
  ]);
  if (!registros) return fail("internal_error", t("Não foi possível ler o prontuário."), 500, { requestId });
  const nomeDe = new Map((profs ?? []).map((p) => [p.user_id as string, (p.display_name as string | null) ?? null]));

  void audit({
    action: "clinic.prontuario_visto",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "contact",
    resourceId: contactId,
    requestId,
    metadata: { atendimentos: linhas.length, pagina: lido.data.antes ? "seguinte" : "primeira" },
  });

  return ok(
    {
      atendimentos: linhas.map((l) => ({
        id: l.id,
        status: l.status,
        inicio: l.started_at,
        fim: l.finished_at,
        profissional: l.professional_user_id ? (nomeDe.get(l.professional_user_id) ?? null) : null,
        servico: primeiro(l.calendar_event_types)?.name ?? null,
        especialidade: primeiro(l.clinic_specialties)?.name ?? null,
        ...registros.get(l.id)!,
      })),
      proximo: temMais ? linhas.at(-1)!.started_at : null,
    },
    { requestId },
  );
}
