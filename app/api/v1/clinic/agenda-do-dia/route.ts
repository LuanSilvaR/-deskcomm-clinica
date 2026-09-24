/**
 * GET /api/v1/clinic/agenda-do-dia?dia=AAAA-MM-DD&q=… — FORK clinic (Agenda do dia).
 *
 * O dia da clínica em LISTA, um bloco por profissional: ficha (nome, conselho,
 * especialidades), ocupação, estado do dia, compromissos com o status de
 * exibição (visita + cancelado/faltou), confirmação, faltas e horários livres.
 * Monta com `montarColunas` (dia-por-profissional) e `montarAgendaDoDia`.
 *
 * `q` (opcional): nome, telefone, CPF ou nascimento — devolve em
 * `pacientes_da_busca` os ids que batem, e a tela filtra. O CPF nunca volta.
 *
 * Só com a opção `clinic.agenda_do_dia` (9014); desligada, `ligado: false`.
 * Leitura (`agenda.ver`), pela sessão — a RLS de quem pede vale.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { diaLocalISO, instanteDe } from "@/lib/agenda/fuso";
import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { minutoNoDia, montarAgendaDoDia, textoDoConselho, type FichaDoProfissional, type Visita } from "@/lib/clinic/agenda/agenda-do-dia";
import {
  montarColunas,
  type BloqueioComMotivo,
  type CompromissoDoDia,
  type Disponibilidade,
  type ExcecaoDoNucleo,
} from "@/lib/clinic/agenda/dia-por-profissional";
import { contarFaltas } from "@/lib/clinic/agenda/faltas";
import { agendaDoDiaLigada } from "@/lib/clinic/flags";
import { filtrarContatosPelaBusca } from "@/lib/clinic/pacientes/busca-no-banco";
import { nomeDoContato } from "@/lib/contacts/rotulo-do-contato";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const consultaSchema = z.object({
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().trim().max(100).optional(),
  passo: z.coerce.number().int().refine((n) => [15, 20, 30, 45, 60].includes(n)).optional(),
});

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("agenda.ver", { requestId, resource: "agenda" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const org = authz.org.orgId;

  const lido = consultaSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!lido.success) return fail("validation_failed", t("Consulta inválida."), 422, { requestId });

  const supabase = await createClient();
  const { data: organizacao } = await supabase.from("organizations").select("settings, timezone").eq("id", org).maybeSingle();
  const fuso = (organizacao as { timezone?: string | null } | null)?.timezone || "America/Sao_Paulo";
  if (!agendaDoDiaLigada((organizacao as { settings?: unknown } | null)?.settings)) {
    return ok({ ligado: false, dia: null, fuso, blocos: [], pacientes_da_busca: null }, { requestId });
  }

  const agora = new Date();
  const hoje = diaLocalISO(agora, fuso);
  const pedido = lido.data.dia ?? hoje;
  const [ano, mes, dia] = pedido.split("-").map(Number) as [number, number, number];
  const de = instanteDe({ ano, mes, dia }, fuso);
  const proximo = new Date(Date.UTC(ano, mes - 1, dia + 1));
  const ate = instanteDe({ ano: proximo.getUTCFullYear(), mes: proximo.getUTCMonth() + 1, dia: proximo.getUTCDate() }, fuso);

  const [disp, exc, bloq, ags, profs] = await Promise.all([
    supabase.from("attendant_availability").select("user_id, schedule").eq("organization_id", org),
    supabase
      .from("calendar_availability_exceptions")
      .select("user_id, is_unavailable, start_minute, end_minute, reason")
      .eq("organization_id", org)
      .eq("exception_date", pedido),
    supabase
      .from("clinic_agenda_blocks")
      .select("user_id, starts_on, ends_on, start_minute, end_minute, weekdays, reason")
      .eq("organization_id", org)
      .lte("starts_on", pedido)
      .gte("ends_on", pedido),
    // Cancelados entram: a tela os mostra (filtro "Cancelado"), mas não ocupam horário.
    supabase
      .from("calendar_appointments")
      .select("id, owner_user_id, title, starts_at, ends_at, status, contact_id, contacts(name, display_name)")
      .eq("organization_id", org)
      .lt("starts_at", ate.toISOString())
      .gt("ends_at", de.toISOString())
      .order("starts_at", { ascending: true })
      .limit(500),
    supabase
      .from("clinic_professionals")
      .select("id, user_id, display_name, council, council_number, council_uf, is_active, clinic_professional_specialties(clinic_specialties(id, name))")
      .eq("organization_id", org),
  ]);
  const erro = disp.error ?? exc.error ?? bloq.error ?? ags.error ?? profs.error;
  if (erro) return fail("internal_error", erro.message, 500, { requestId });

  const compromissos: CompromissoDoDia[] = (ags.data ?? []).map((a) => ({
    id: a.id as string,
    owner_user_id: (a.owner_user_id as string | null) ?? null,
    titulo: a.title as string,
    inicio: a.starts_at as string,
    fim: a.ends_at as string,
    status: a.status as string,
    paciente: nomeDoContato(a.contacts as { name?: string | null; display_name?: string | null } | null),
    paciente_id: (a.contact_id as string | null) ?? null,
  }));
  const ids = compromissos.map((c) => c.id);
  const pacientes = [...new Set(compromissos.map((c) => c.paciente_id).filter((x): x is string => Boolean(x)))];

  const [visitas, confirmacoes, faltas, busca] = await Promise.all([
    ids.length
      ? supabase.from("clinic_appointment_visits").select("appointment_id, status, changed_at").eq("organization_id", org).in("appointment_id", ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabase.from("clinic_confirmation_requests").select("appointment_id, status").eq("organization_id", org).in("appointment_id", ids)
      : Promise.resolve({ data: [], error: null }),
    contarFaltas(supabase, org, pacientes),
    lido.data.q && pacientes.length
      ? filtrarContatosPelaBusca(supabase.from("contacts").select("id").eq("organization_id", org).in("id", pacientes), lido.data.q)
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (visitas.error) return fail("internal_error", visitas.error.message, 500, { requestId });

  const fichas = new Map<string, FichaDoProfissional>();
  for (const p of (profs.data ?? []) as Array<Record<string, unknown>>) {
    if (p.is_active === false) continue;
    const vinculos = (p.clinic_professional_specialties ?? []) as Array<{ clinic_specialties: { id: string; name: string } | { id: string; name: string }[] | null }>;
    fichas.set(p.user_id as string, {
      nome: (p.display_name as string | null) ?? null,
      conselho: textoDoConselho(p.council as string | null, p.council_number as string | null, p.council_uf as string | null),
      especialidades: vinculos
        .flatMap((v) => (Array.isArray(v.clinic_specialties) ? v.clinic_specialties : v.clinic_specialties ? [v.clinic_specialties] : []))
        .map((s) => ({ id: s.id, nome: s.name })),
    });
  }

  const colunas = montarColunas({
    dia: pedido,
    disponibilidades: (disp.data ?? []) as unknown as Disponibilidade[],
    excecoes: (exc.data ?? []) as unknown as ExcecaoDoNucleo[],
    bloqueios: (bloq.data ?? []) as unknown as BloqueioComMotivo[],
    compromissos,
  });
  const blocos = montarAgendaDoDia({
    dia: pedido,
    fuso,
    colunas,
    visitas: new Map(
      ((visitas.data ?? []) as Array<{ appointment_id: string; status: string; changed_at: string | null }>).map((v) => [
        v.appointment_id,
        { status: v.status, desde: v.changed_at } satisfies Visita,
      ]),
    ),
    confirmacoes: new Map(((confirmacoes.data ?? []) as Array<{ appointment_id: string; status: string }>).map((c) => [c.appointment_id, c.status])),
    faltas,
    fichas,
    passo: lido.data.passo,
    agoraMinuto: pedido === hoje ? minutoNoDia(agora.toISOString(), pedido, fuso) : null,
  });

  const pacientesDaBusca = lido.data.q ? ((busca.data ?? []) as Array<{ id: string }>).map((c) => c.id) : null;
  return ok({ ligado: true, dia: pedido, hoje, fuso, blocos, pacientes_da_busca: pacientesDaBusca }, { requestId });
}
