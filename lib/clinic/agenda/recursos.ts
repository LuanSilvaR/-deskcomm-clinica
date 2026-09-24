/**
 * FORK clinic (migration 9007, épico E4.2) — quando falta sala ou equipamento.
 *
 * A consulta de horários livres (lib/agenda/consulta.ts) recebe daqui os
 * intervalos em que alguma exigência do tipo de atendimento NÃO tem recurso
 * livre, e os trata como ocupação do profissional: o motor não muda, e a grade,
 * a IA e o "próximo livre" deixam de oferecer horário sem sala.
 *
 * Quem ALOCA é o banco (trg_clinic_alocar_recursos), no mesmo comando do
 * compromisso — esta leitura só decide o que oferecer. As duas usam a mesma
 * régua: recurso ativo, da categoria (sem diferenciar maiúsculas) ou o
 * específico, e ocupação estrita (encostar não é ocupar).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Ocupado } from "@/lib/agenda/horarios-livres";

export interface Exigencia {
  category: string | null;
  resource_id: string | null;
}

export interface Recurso {
  id: string;
  category: string;
  is_active: boolean;
}

export interface Alocacao {
  resource_id: string;
  starts_at: string;
  ends_at: string;
}

const norm = (s: string) => s.trim().toLowerCase();

/** `settings.clinic.recursos === true`. Nasce desligada. */
export function recursosLigados(settings: unknown): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return false;
  const clinic = (settings as Record<string, unknown>).clinic;
  if (!clinic || typeof clinic !== "object" || Array.isArray(clinic)) return false;
  return (clinic as Record<string, unknown>).recursos === true;
}

/**
 * Os intervalos, dentro de [de, ate), em que alguma exigência fica sem recurso.
 *
 * Exigências iguais somam: "duas salas" é a categoria com k = 2, e o intervalo
 * entra quando livres < k. Exigência sem nenhum recurso cadastrado bloqueia a
 * janela inteira — oferecer horário que o banco vai recusar é pior que não
 * oferecer.
 */
export function intervalosSemRecurso(args: {
  exigencias: readonly Exigencia[];
  recursos: readonly Recurso[];
  alocacoes: readonly Alocacao[];
  de: Date;
  ate: Date;
}): Ocupado[] {
  const ativos = args.recursos.filter((r) => r.is_active);
  const grupos = new Map<string, { candidatos: string[]; k: number }>();
  for (const e of args.exigencias) {
    const chave = e.resource_id ? `r:${e.resource_id}` : `c:${norm(e.category ?? "")}`;
    const g = grupos.get(chave);
    if (g) {
      g.k += 1;
      continue;
    }
    const candidatos = e.resource_id
      ? ativos.filter((r) => r.id === e.resource_id).map((r) => r.id)
      : ativos.filter((r) => norm(r.category) === norm(e.category ?? "")).map((r) => r.id);
    grupos.set(chave, { candidatos, k: 1 });
  }

  const de = args.de.getTime();
  const ate = args.ate.getTime();
  const saida: { inicio: number; fim: number }[] = [];
  for (const { candidatos, k } of grupos.values()) {
    if (candidatos.length < k) {
      saida.push({ inicio: de, fim: ate });
      continue;
    }
    const doGrupo = new Set(candidatos);
    const ocup = args.alocacoes
      .filter((a) => doGrupo.has(a.resource_id))
      .map((a) => ({ id: a.resource_id, inicio: Math.max(de, new Date(a.starts_at).getTime()), fim: Math.min(ate, new Date(a.ends_at).getTime()) }))
      .filter((a) => a.fim > a.inicio);
    const pontos = [...new Set([de, ate, ...ocup.flatMap((a) => [a.inicio, a.fim])])].sort((x, y) => x - y);
    for (let i = 0; i < pontos.length - 1; i++) {
      const p0 = pontos[i]!;
      const p1 = pontos[i + 1]!;
      const ocupados = new Set(ocup.filter((a) => a.inicio <= p0 && a.fim >= p1).map((a) => a.id));
      if (candidatos.length - ocupados.size < k) saida.push({ inicio: p0, fim: p1 });
    }
  }

  // Junta os pedaços contíguos ou sobrepostos.
  saida.sort((a, b) => a.inicio - b.inicio);
  const juntos: { inicio: number; fim: number }[] = [];
  for (const s of saida) {
    const ultimo = juntos.at(-1);
    if (ultimo && s.inicio <= ultimo.fim) ultimo.fim = Math.max(ultimo.fim, s.fim);
    else juntos.push({ ...s });
  }
  return juntos.map((s) => ({ inicio: new Date(s.inicio), fim: new Date(s.fim) }));
}

/**
 * Lê o que a organização exige e ocupa, e devolve os intervalos sem recurso.
 * Opção desligada ou tipo sem exigência: nada. Nunca lança; erro de leitura
 * volta como `{ ok: false }` para a consulta recusar em vez de oferecer às cegas.
 */
export async function ocupadosPorFaltaDeRecurso(
  supabase: SupabaseClient,
  organizationId: string,
  args: { eventTypeId: string; de: Date; ate: Date; ignorarAgendamentoId?: string },
): Promise<{ ok: true; ocupados: Ocupado[] } | { ok: false; erro: string }> {
  try {
    const { data: org, error: e0 } = await supabase.from("organizations").select("settings").eq("id", organizationId).maybeSingle();
    if (e0) return { ok: false, erro: e0.message };
    if (!recursosLigados((org as { settings?: unknown } | null)?.settings)) return { ok: true, ocupados: [] };

    const { data: exigencias, error: e1 } = await supabase
      .from("clinic_event_type_resources")
      .select("category, resource_id")
      .eq("organization_id", organizationId)
      .eq("event_type_id", args.eventTypeId);
    if (e1) return { ok: false, erro: e1.message };
    if (!exigencias || exigencias.length === 0) return { ok: true, ocupados: [] };

    let q = supabase
      .from("clinic_appointment_resources")
      .select("resource_id, starts_at, ends_at")
      .eq("organization_id", organizationId)
      .lt("starts_at", args.ate.toISOString())
      .gt("ends_at", args.de.toISOString());
    if (args.ignorarAgendamentoId) q = q.neq("appointment_id", args.ignorarAgendamentoId);
    const [{ data: recursos, error: e2 }, { data: alocacoes, error: e3 }] = await Promise.all([
      supabase.from("clinic_resources").select("id, category, is_active").eq("organization_id", organizationId),
      q,
    ]);
    if (e2 || e3) return { ok: false, erro: (e2 ?? e3)!.message };

    return {
      ok: true,
      ocupados: intervalosSemRecurso({
        exigencias: exigencias as Exigencia[],
        recursos: (recursos ?? []) as Recurso[],
        alocacoes: (alocacoes ?? []) as Alocacao[],
        de: args.de,
        ate: args.ate,
      }),
    };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : String(err) };
  }
}
