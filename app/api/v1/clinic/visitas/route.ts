/**
 * GET /api/v1/clinic/visitas?dia=YYYY-MM-DD — o dia da recepção.
 *
 * Os agendamentos COM paciente do dia (no fuso da clínica), com o status da
 * visita de cada um. É o que o painel da recepção mostra; o Realtime da tabela
 * `clinic_appointment_visits` só avisa a tela para perguntar de novo.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { prontuarioLigado } from "@/lib/clinic/flags";
import { ehStatusDaVisita } from "@/lib/clinic/visitas/status";
import { nomeDoContato } from "@/lib/contacts/rotulo-do-contato";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DIA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Meia-noite de `dia` em São Paulo, como instante UTC (sem horário de verão desde 2019). */
function inicioDoDia(dia: string): Date {
  return new Date(`${dia}T00:00:00-03:00`);
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("recepcao.ver_painel", { requestId, resource: "clinic_appointment_visits" });
  if (!authz.ok) return authz.response;

  const dia =
    new URL(req.url).searchParams.get("dia") ??
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  if (!DIA.safeParse(dia).success) return fail("validation_failed", "dia inválido", 422, { requestId });
  const de = inicioDoDia(dia);
  const ate = new Date(de.getTime() + 86_400_000);
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data: agendamentos, error } = await supabase
    .from("calendar_appointments")
    .select("id, title, starts_at, ends_at, status, owner_user_id, contact_id, contacts(name, display_name)")
    .eq("organization_id", org)
    .not("contact_id", "is", null)
    .neq("status", "cancelled")
    .gte("starts_at", de.toISOString())
    .lt("starts_at", ate.toISOString())
    .order("starts_at", { ascending: true })
    .limit(300);
  if (error) return fail("internal_error", error.message, 500, { requestId });

  const ids = (agendamentos ?? []).map((a) => a.id as string);
  const { data: visitas, error: e2 } = ids.length
    ? await supabase
        .from("clinic_appointment_visits")
        .select("appointment_id, status, changed_at, arrived_at, ready_at, started_at, finished_at")
        .eq("organization_id", org)
        .in("appointment_id", ids)
    : { data: [], error: null };
  if (e2) return fail("internal_error", e2.message, 500, { requestId });
  // FORK clinic (9004): a confirmação do paciente, quando houve pedido.
  const { data: confirmacoes } = ids.length
    ? await supabase
        .from("clinic_confirmation_requests")
        .select("appointment_id, status, falha")
        .eq("organization_id", org)
        .in("appointment_id", ids)
    : { data: [] };
  const confirmacaoPorAgendamento = new Map(
    (confirmacoes ?? []).map((c) => [c.appointment_id as string, { status: c.status as string, falha: (c.falha as string | null) ?? null }]),
  );
  const porAgendamento = new Map((visitas ?? []).map((v) => [v.appointment_id as string, v]));

  const itens = (agendamentos ?? []).map((a) => {
    const v = porAgendamento.get(a.id as string);
    const c = a.contacts as { name?: string | null; display_name?: string | null } | null;
    return {
      appointment_id: a.id,
      titulo: a.title,
      inicio: a.starts_at,
      fim: a.ends_at,
      status_do_agendamento: a.status,
      profissional_id: a.owner_user_id,
      paciente_id: a.contact_id,
      paciente: nomeDoContato(c),
      status: v && ehStatusDaVisita(v.status) ? v.status : "agendado",
      desde: v?.changed_at ?? null,
      confirmacao: confirmacaoPorAgendamento.get(a.id as string)?.status ?? null,
      confirmacao_falha: confirmacaoPorAgendamento.get(a.id as string)?.falha ?? null,
    };
  });
  // FORK clinic (prontuário F1): a tela esconde "Iniciar/Finalizar" quando é o profissional quem faz.
  const { data: orgRow } = await supabase.from("organizations").select("settings").eq("id", org).maybeSingle();
  return ok({ dia, itens, prontuario: prontuarioLigado((orgRow as { settings?: unknown } | null)?.settings) }, { requestId });
}
