/**
 * FORK clinic (prontuário F2/F8) — a linha do tempo clínica de um paciente.
 *
 * Atendimentos do mais novo para o mais antigo, cada um com os registros
 * (formulários, conduta, procedimentos, evolução, adendos). Client da SESSÃO:
 * a RLS só devolve a quem tem `prontuario.ver`. Usada pela rota paginada e pela
 * exportação imprimível.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  registrosDosAtendimentos,
  type RegistrosDoAtendimento,
} from "@/lib/clinic/prontuario/leitura";

type Um<T> = T | T[] | null;
const primeiro = <T>(v: Um<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export interface AtendimentoNaLinhaDoTempo extends RegistrosDoAtendimento {
  id: string;
  status: string;
  inicio: string;
  fim: string | null;
  profissional: string | null;
  servico: string | null;
  especialidade: string | null;
}

export interface FiltrosDaLinhaDoTempo {
  /** AAAA-MM-DD, inclusive. */
  desde?: string;
  /** AAAA-MM-DD, inclusive. */
  ate?: string;
  profissional?: string;
  plano?: string;
}

/** "2026-01-31" → "2026-02-01T00:00:00Z" (limite exclusivo do dia final). */
export function proximoDia(data: string): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

export async function lerLinhaDoTempo(
  supabase: SupabaseClient,
  org: string,
  contactId: string,
  opcoes: FiltrosDaLinhaDoTempo & { antes?: string; limite: number },
): Promise<{ atendimentos: AtendimentoNaLinhaDoTempo[]; proximo: string | null }> {
  // Filtro por plano: os atendimentos que cumpriram sessões dele + o que o originou.
  let doPlano: string[] | null = null;
  if (opcoes.plano) {
    const [sessoes, plano] = await Promise.all([
      supabase
        .from("clinic_plano_sessoes")
        .select("atendimento_id")
        .eq("organization_id", org)
        .eq("plano_id", opcoes.plano),
      supabase
        .from("clinic_planos_tratamento")
        .select("atendimento_origem_id")
        .eq("organization_id", org)
        .eq("id", opcoes.plano)
        .maybeSingle(),
    ]);
    doPlano = [
      ...(sessoes.data ?? []).map((s) => s.atendimento_id as string | null),
      (plano.data?.atendimento_origem_id as string | null) ?? null,
    ].filter((x): x is string => !!x);
    if (doPlano.length === 0) return { atendimentos: [], proximo: null };
  }
  let consulta = supabase
    .from("clinic_atendimentos")
    .select(
      "id, status, started_at, finished_at, professional_user_id, calendar_event_types(name), clinic_specialties(name)",
    )
    .eq("organization_id", org)
    .eq("contact_id", contactId)
    .neq("status", "anulado")
    .order("started_at", { ascending: false })
    .limit(opcoes.limite + 1);
  if (opcoes.antes) consulta = consulta.lt("started_at", opcoes.antes);
  if (opcoes.desde) consulta = consulta.gte("started_at", `${opcoes.desde}T00:00:00Z`);
  if (opcoes.ate) consulta = consulta.lt("started_at", proximoDia(opcoes.ate));
  if (opcoes.profissional) consulta = consulta.eq("professional_user_id", opcoes.profissional);
  if (doPlano) consulta = consulta.in("id", doPlano);
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);

  const linhas = (data ?? []).slice(0, opcoes.limite) as unknown as Array<{
    id: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    professional_user_id: string | null;
    calendar_event_types: Um<{ name: string | null }>;
    clinic_specialties: Um<{ name: string | null }>;
  }>;
  const temMais = (data ?? []).length > opcoes.limite;
  const profIds = [
    ...new Set(linhas.map((l) => l.professional_user_id).filter((x): x is string => !!x)),
  ];
  const [{ data: profs }, registros] = await Promise.all([
    profIds.length
      ? supabase
          .from("clinic_professionals")
          .select("user_id, display_name")
          .eq("organization_id", org)
          .in("user_id", profIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string; display_name: string | null }> }),
    registrosDosAtendimentos(
      supabase,
      org,
      linhas.map((l) => l.id),
    ),
  ]);
  const nomeDe = new Map(
    (profs ?? []).map((p) => [p.user_id as string, (p.display_name as string | null) ?? null]),
  );
  return {
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
  };
}
