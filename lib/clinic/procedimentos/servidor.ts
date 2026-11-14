/**
 * FORK clinic (9015) — leitura e gravação de procedimentos pelas rotas.
 *
 * Sempre pelo client da SESSÃO (a RLS de quem pede vale) e com filtro EXPLÍCITO
 * de organização (a org vem de `requirePermission`, nunca do corpo).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { idsSaoDaOrg } from "@/lib/clinic/api";

import { profissionaisSemEspecialidade } from "./coerencia";

export const COLUNAS_DO_PROCEDIMENTO =
  "id, name, code, short_description, description, duration_minutes, is_active, created_at, created_by, updated_at, updated_by, " +
  "clinic_procedure_specialties(specialty_id), clinic_procedure_professionals(professional_id), " +
  "clinic_pops(id, code, clinic_pop_versions(id, major, minor, status))";

export interface ResumoDoPop {
  id: string;
  code: string;
  vigente: { id: string; versao: string } | null;
  rascunho: { id: string; versao: string } | null;
}

export interface Procedimento {
  id: string;
  name: string;
  code: string | null;
  short_description: string;
  description: string | null;
  duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  specialty_ids: string[];
  professional_ids: string[];
  pop: ResumoDoPop | null;
}

type Linha = Omit<Procedimento, "specialty_ids" | "professional_ids" | "pop"> & {
  clinic_procedure_specialties: { specialty_id: string }[] | null;
  clinic_procedure_professionals: { professional_id: string }[] | null;
  clinic_pops:
    | { id: string; code: string; clinic_pop_versions: { id: string; major: number; minor: number; status: string }[] | null }
    | { id: string; code: string; clinic_pop_versions: { id: string; major: number; minor: number; status: string }[] | null }[]
    | null;
};

export const rotuloDaVersao = (major: number, minor: number) => `${major}.${minor}`;

export function paraProcedimento(l: Linha): Procedimento {
  const { clinic_procedure_specialties: esp, clinic_procedure_professionals: prof, clinic_pops: pops, ...resto } = l;
  const pop = Array.isArray(pops) ? (pops[0] ?? null) : pops;
  const versoes = pop?.clinic_pop_versions ?? [];
  const achar = (status: string) => {
    const v = versoes.find((x) => x.status === status);
    return v ? { id: v.id, versao: rotuloDaVersao(v.major, v.minor) } : null;
  };
  return {
    ...resto,
    specialty_ids: (esp ?? []).map((e) => e.specialty_id),
    professional_ids: (prof ?? []).map((p) => p.professional_id),
    pop: pop ? { id: pop.id, code: pop.code, vigente: achar("approved"), rascunho: achar("draft") } : null,
  };
}

export type FalhaDosVinculos =
  | { ok: true }
  | { ok: false; motivo: "ids_de_outra_empresa" }
  | { ok: false; motivo: "sem_especialidade"; profissionais: string[] }
  | { ok: false; motivo: "banco"; erro: { code?: string; message: string } };

/**
 * Troca os vínculos do procedimento pelo conjunto pedido. Confere antes que os
 * ids são da empresa e que cada profissional tem uma das especialidades (o
 * banco confere de novo no INSERT).
 */
export async function salvarVinculos(
  supabase: SupabaseClient,
  org: string,
  procedimentoId: string,
  especialidades: readonly string[],
  profissionais: readonly string[],
): Promise<FalhaDosVinculos> {
  const esp = [...new Set(especialidades)];
  const prof = [...new Set(profissionais)];
  if (!(await idsSaoDaOrg(supabase, "clinic_specialties", org, esp)) || !(await idsSaoDaOrg(supabase, "clinic_professionals", org, prof))) {
    return { ok: false, motivo: "ids_de_outra_empresa" };
  }
  if (esp.length && prof.length) {
    const { data, error } = await supabase
      .from("clinic_professional_specialties")
      .select("professional_id, specialty_id")
      .eq("organization_id", org)
      .in("professional_id", prof);
    if (error) return { ok: false, motivo: "banco", erro: error };
    const porProfissional = new Map<string, string[]>();
    for (const l of (data ?? []) as { professional_id: string; specialty_id: string }[]) {
      porProfissional.set(l.professional_id, [...(porProfissional.get(l.professional_id) ?? []), l.specialty_id]);
    }
    const fora = profissionaisSemEspecialidade(
      esp,
      prof,
      prof.map((id) => ({ id, specialty_ids: porProfissional.get(id) ?? [] })),
    );
    if (fora.length) return { ok: false, motivo: "sem_especialidade", profissionais: fora };
  }

  const passos = [
    () => supabase.from("clinic_procedure_professionals").delete().eq("organization_id", org).eq("procedure_id", procedimentoId),
    () => supabase.from("clinic_procedure_specialties").delete().eq("organization_id", org).eq("procedure_id", procedimentoId),
    () =>
      esp.length
        ? supabase.from("clinic_procedure_specialties").insert(esp.map((specialty_id) => ({ organization_id: org, procedure_id: procedimentoId, specialty_id })))
        : Promise.resolve({ error: null }),
    () =>
      prof.length
        ? supabase
            .from("clinic_procedure_professionals")
            .insert(prof.map((professional_id) => ({ organization_id: org, procedure_id: procedimentoId, professional_id })))
        : Promise.resolve({ error: null }),
  ];
  for (const passo of passos) {
    const { error } = await passo();
    if (error) return { ok: false, motivo: "banco", erro: error };
  }
  return { ok: true };
}
