/**
 * GET /api/v1/clinic/atendimentos/fila?dia=YYYY-MM-DD&todos=1 — "Meus atendimentos".
 *
 * Os agendamentos com paciente do dia (no fuso da clínica) e o status da visita
 * de cada um, agrupados em Aguardando / Em atendimento / Próximos / Finalizados
 * (`lib/clinic/atendimento/fila.ts`). Padrão: só onde EU sou o profissional;
 * `todos=1` mostra a clínica. Sem conteúdo clínico — basta `atendimento.ver_fila`.
 * O id do atendimento só volta para quem pode ver o prontuário (a RLS esconde).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { primeiroInstanteDoDia } from "@/lib/agenda/google/tempo";
import { somarDias } from "@/lib/automation/gatilho-de-data-do-funil";
import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { montarFila, type ItemDaFila } from "@/lib/clinic/atendimento/fila";
import { prontuarioLigado } from "@/lib/clinic/flags";
import { ehStatusDaVisita } from "@/lib/clinic/visitas/status";
import { nomeDoContato } from "@/lib/contacts/rotulo-do-contato";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FUSO_PADRAO = "America/Sao_Paulo";
const query = z
  .object({
    dia: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    todos: z.enum(["0", "1"]).optional(),
  })
  .strict();

function hojeNoFuso(fuso: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_PADRAO }).format(new Date());
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("atendimento.ver_fila", { requestId, resource: "clinic_atendimentos" });
  if (!authz.ok) return authz.response;

  const lido = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!lido.success) return fail("validation_failed", "Parâmetros inválidos.", 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();

  const { data: orgRow } = await supabase.from("organizations").select("settings, timezone").eq("id", org).maybeSingle();
  const fuso = ((orgRow as { timezone?: string | null } | null)?.timezone || FUSO_PADRAO) as string;
  const ligado = prontuarioLigado((orgRow as { settings?: unknown } | null)?.settings);
  const dia = lido.data.dia ?? hojeNoFuso(fuso);
  const de = primeiroInstanteDoDia(dia, fuso) ?? primeiroInstanteDoDia(dia, FUSO_PADRAO);
  const ate = primeiroInstanteDoDia(somarDias(dia, 1), fuso) ?? primeiroInstanteDoDia(somarDias(dia, 1), FUSO_PADRAO);
  if (!de || !ate) return fail("validation_failed", "Dia inválido.", 422, { requestId });
  const todos = lido.data.todos === "1";

  let consulta = supabase
    .from("calendar_appointments")
    .select("id, starts_at, ends_at, owner_user_id, contact_id, calendar_event_types(name), contacts(name, display_name)")
    .eq("organization_id", org)
    .not("contact_id", "is", null)
    .not("status", "in", "(cancelled,no_show)")
    .gte("starts_at", de.toISOString())
    .lt("starts_at", ate.toISOString())
    .order("starts_at", { ascending: true })
    .limit(300);
  if (!todos) consulta = consulta.eq("owner_user_id", authz.user.id);
  const { data: agendamentos, error } = await consulta;
  if (error) return fail("internal_error", error.message, 500, { requestId });

  const ids = (agendamentos ?? []).map((a) => a.id as string);
  const [{ data: visitas, error: e2 }, { data: atendimentos }] = ids.length
    ? await Promise.all([
        supabase
          .from("clinic_appointment_visits")
          .select("appointment_id, status, arrived_at, ready_at")
          .eq("organization_id", org)
          .in("appointment_id", ids),
        // RLS: sem `prontuario.ver` volta vazio, e a fila segue sem o link.
        supabase.from("clinic_atendimentos").select("id, appointment_id").eq("organization_id", org).in("appointment_id", ids),
      ])
    : [{ data: [], error: null }, { data: [] }];
  if (e2) return fail("internal_error", e2.message, 500, { requestId });

  const visitaPor = new Map((visitas ?? []).map((v) => [v.appointment_id as string, v]));
  const atendimentoPor = new Map((atendimentos ?? []).map((a) => [a.appointment_id as string, a.id as string]));

  const itens: ItemDaFila[] = (agendamentos ?? []).map((a) => {
    const v = visitaPor.get(a.id as string);
    const tipo = a.calendar_event_types as { name?: string | null } | { name?: string | null }[] | null;
    const servico = (Array.isArray(tipo) ? tipo[0]?.name : tipo?.name) ?? null;
    return {
      appointment_id: a.id as string,
      inicio: a.starts_at as string,
      fim: a.ends_at as string,
      paciente_id: a.contact_id as string,
      paciente: nomeDoContato(a.contacts as { name?: string | null; display_name?: string | null } | null),
      servico,
      profissional_id: (a.owner_user_id as string | null) ?? null,
      status: v && ehStatusDaVisita(v.status) ? v.status : "agendado",
      chegou_em: (v?.arrived_at as string | null) ?? null,
      pronto_em: (v?.ready_at as string | null) ?? null,
      atendimento_id: atendimentoPor.get(a.id as string) ?? null,
    };
  });

  return ok(
    {
      dia,
      todos,
      ligado,
      pode_iniciar: ligado && authz.permissoes.has("atendimento.iniciar"),
      pode_abrir: authz.permissoes.has("prontuario.ver"),
      fila: montarFila(itens, new Date()),
    },
    { requestId },
  );
}
