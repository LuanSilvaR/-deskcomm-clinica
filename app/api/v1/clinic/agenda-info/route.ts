/**
 * GET /api/v1/clinic/agenda-info?de=ISO&ate=ISO&q=… — FORK clinic (melhorias da Agenda).
 *
 * O que a tela da Agenda do núcleo não sabe e a clínica precisa ver nela, para a
 * janela que a grade mostra:
 *   - por compromisso: status da visita (9003) + desde quando, resposta da
 *     confirmação (9004), faltas do paciente (12 meses) e o id do paciente;
 *   - por profissional: nome da ficha, conselho e especialidades (9001);
 *   - `q` (opcional): nome, telefone, CPF ou nascimento → ids dos pacientes da
 *     janela que batem. O CPF nunca volta;
 *   - S2 (#67): as salas reservadas por compromisso e a lista de salas ativas (filtro "Sala");
 *   - S3 (#68): os procedimentos de cada compromisso (8016) e o catálogo ativo
 *     (painel "Novo agendamento" e filtro "Procedimento").
 * Leitura (`agenda.ver`), pela sessão — a RLS de quem pede vale.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { textoDoConselho, type FichaDoProfissional } from "@/lib/clinic/agenda/agenda-do-dia";
import { contarFaltas } from "@/lib/clinic/agenda/faltas";
import { compromissosDePrimeiraVez, compromissosRemarcados } from "@/lib/clinic/agenda/primeira-vez";
import { PERMISSAO_VER_OUTROS } from "@/lib/clinic/agenda/escopo-da-agenda";
import type { InfoDoCompromisso, ProcedimentoDaAgenda, SalaDaAgenda } from "@/lib/clinic/agenda/filtros-da-agenda";
import { filtrarContatosPelaBusca } from "@/lib/clinic/pacientes/busca-no-banco";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const consultaSchema = z
  .object({
    de: z.iso.datetime({ offset: true }),
    ate: z.iso.datetime({ offset: true }),
    q: z.string().trim().max(100).optional(),
  })
  .refine((v) => Date.parse(v.ate) > Date.parse(v.de) && Date.parse(v.ate) - Date.parse(v.de) <= 45 * 86_400_000);

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("agenda.ver", { requestId, resource: "agenda" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const org = authz.org.orgId;

  const lido = consultaSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!lido.success) return fail("validation_failed", t("Consulta inválida."), 422, { requestId });

  const supabase = await createClient();
  // FORK clinic (9042): sem `agenda.ver_outros`, só os compromissos da própria agenda.
  const soOProprio = !authz.permissoes.has(PERMISSAO_VER_OUTROS);
  let consultaDosCompromissos = supabase
    .from("calendar_appointments")
    .select("id, contact_id, starts_at")
    .eq("organization_id", org)
    .lt("starts_at", lido.data.ate)
    .gt("ends_at", lido.data.de);
  if (soOProprio) consultaDosCompromissos = consultaDosCompromissos.eq("owner_user_id", authz.user.id);
  const [ags, recursos, profs, catalogo] = await Promise.all([
    consultaDosCompromissos.limit(1000),
    supabase.from("clinic_resources").select("id, name, category").eq("organization_id", org).eq("is_active", true).order("name"),
    supabase
      .from("clinic_professionals")
      .select("user_id, display_name, council, council_number, council_uf, is_active, clinic_professional_specialties(clinic_specialties(id, name))")
      .eq("organization_id", org),
    supabase.from("clinic_procedures").select("id, name").eq("organization_id", org).eq("is_active", true).order("name"),
  ]);
  const erro = ags.error ?? profs.error ?? recursos.error ?? catalogo.error;
  const procedimentos: ProcedimentoDaAgenda[] = ((catalogo.data ?? []) as Array<{ id: string; name: string }>).map((p) => ({ id: p.id, nome: p.name }));
  if (erro) return fail("internal_error", erro.message, 500, { requestId });

  const lista = (ags.data ?? []) as Array<{ id: string; contact_id: string | null; starts_at: string }>;
  const ids = lista.map((a) => a.id);
  const pacientes = [...new Set(lista.map((a) => a.contact_id).filter((x): x is string => Boolean(x)))];

  // Sala = recurso da categoria "Sala" (texto livre do cadastro; compara sem caixa nem espaços).
  const salas: SalaDaAgenda[] = ((recursos.data ?? []) as Array<{ id: string; name: string; category: string | null }>)
    .filter((r) => (r.category ?? "").trim().toLowerCase() === "sala")
    .map((r) => ({ id: r.id, nome: r.name }));
  const idsDasSalas = new Set(salas.map((x) => x.id));

  const [visitas, confirmacoes, faltas, busca, primeiraVez, remarcados, reservas, procsDosAgs] = await Promise.all([
    ids.length
      ? supabase.from("clinic_appointment_visits").select("appointment_id, status, changed_at").eq("organization_id", org).in("appointment_id", ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabase.from("clinic_confirmation_requests").select("appointment_id, status").eq("organization_id", org).in("appointment_id", ids)
      : Promise.resolve({ data: [], error: null }),
    contarFaltas(supabase, org, pacientes),
    lido.data.q && pacientes.length
      ? filtrarContatosPelaBusca(supabase.from("contacts").select("id").eq("organization_id", org).in("id", pacientes), lido.data.q)
      : Promise.resolve({ data: [], error: null }),
    // FORK clinic (agenda S4): "1ª vez" e "remarcado" — informação a mais, nunca derruba a rota.
    compromissosDePrimeiraVez(supabase, org, lista.map((a) => ({ id: a.id, contact_id: a.contact_id, inicio: a.starts_at }))),
    compromissosRemarcados(supabase, org, ids),
    ids.length && idsDasSalas.size
      ? supabase.from("clinic_appointment_resources").select("appointment_id, resource_id").eq("organization_id", org).in("appointment_id", ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabase.from("clinic_agendamento_procedimentos").select("appointment_id, procedure_id, ordem").eq("organization_id", org).in("appointment_id", ids).order("ordem")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (visitas.error) return fail("internal_error", visitas.error.message, 500, { requestId });

  const visitaPor = new Map(
    ((visitas.data ?? []) as Array<{ appointment_id: string; status: string; changed_at: string | null }>).map((v) => [v.appointment_id, v]),
  );
  const salasPor = new Map<string, string[]>();
  for (const r of (reservas.data ?? []) as Array<{ appointment_id: string; resource_id: string }>) {
    if (!idsDasSalas.has(r.resource_id)) continue;
    const l = salasPor.get(r.appointment_id) ?? [];
    l.push(r.resource_id);
    salasPor.set(r.appointment_id, l);
  }
  const procsPor = new Map<string, string[]>();
  for (const r of (procsDosAgs.data ?? []) as Array<{ appointment_id: string; procedure_id: string }>) {
    const l = procsPor.get(r.appointment_id) ?? [];
    l.push(r.procedure_id);
    procsPor.set(r.appointment_id, l);
  }
  const confirmacaoPor = new Map(((confirmacoes.data ?? []) as Array<{ appointment_id: string; status: string }>).map((c) => [c.appointment_id, c.status]));

  const compromissos: Record<string, InfoDoCompromisso> = {};
  for (const a of lista) {
    const v = visitaPor.get(a.id);
    compromissos[a.id] = {
      paciente_id: a.contact_id,
      visita: v?.status ?? null,
      desde: v?.changed_at ?? null,
      confirmacao: confirmacaoPor.get(a.id) ?? null,
      faltas: a.contact_id ? (faltas.get(a.contact_id) ?? 0) : 0,
      primeira_vez: primeiraVez.has(a.id),
      remarcado: remarcados.has(a.id),
      salas: salasPor.get(a.id) ?? [],
      procedimentos: procsPor.get(a.id) ?? [],
    };
  }

  const profissionais: Record<string, FichaDoProfissional> = {};
  for (const p of (profs.data ?? []) as Array<Record<string, unknown>>) {
    if (p.is_active === false) continue;
    const vinculos = (p.clinic_professional_specialties ?? []) as Array<{ clinic_specialties: { id: string; name: string } | { id: string; name: string }[] | null }>;
    profissionais[p.user_id as string] = {
      nome: (p.display_name as string | null) ?? null,
      conselho: textoDoConselho(p.council as string | null, p.council_number as string | null, p.council_uf as string | null),
      especialidades: vinculos
        .flatMap((v) => (Array.isArray(v.clinic_specialties) ? v.clinic_specialties : v.clinic_specialties ? [v.clinic_specialties] : []))
        .map((s) => ({ id: s.id, nome: s.name })),
    };
  }

  return ok(
    {
      compromissos,
      profissionais,
      pacientes_da_busca: lido.data.q ? ((busca.data ?? []) as Array<{ id: string }>).map((c) => c.id) : null,
      salas,
      procedimentos,
    },
    { requestId },
  );
}
