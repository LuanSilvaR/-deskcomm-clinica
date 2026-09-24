/**
 * FORK clinic (épico E5.1) — as faltas de cada paciente.
 *
 * Falta = compromisso com `status = 'no_show'` (registrado pela equipe). Conta
 * os últimos 12 meses: quem faltou há três anos não é o mesmo risco de quem
 * faltou mês passado. A partir de 2 é REINCIDENTE — a tela destaca.
 *
 * Toda consulta filtra `organization_id` explicitamente (a mesma função roda
 * com o client de sessão nas rotas).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const JANELA_DE_FALTAS_DIAS = 365;
export const REINCIDENTE_A_PARTIR_DE = 2;

export function ehReincidente(faltas: number): boolean {
  return faltas >= REINCIDENTE_A_PARTIR_DE;
}

export function inicioDaJanela(agora: Date): Date {
  return new Date(agora.getTime() - JANELA_DE_FALTAS_DIAS * 86_400_000);
}

/** Quantas faltas cada paciente tem na janela. Paciente sem falta não aparece no mapa. */
export async function contarFaltas(
  supabase: SupabaseClient,
  organizationId: string,
  contactIds: readonly string[],
  agora: Date = new Date(),
): Promise<Map<string, number>> {
  const ids = [...new Set(contactIds)];
  const contagem = new Map<string, number>();
  if (ids.length === 0) return contagem;
  const { data, error } = await supabase
    .from("calendar_appointments")
    .select("contact_id")
    .eq("organization_id", organizationId)
    .eq("status", "no_show")
    .gte("starts_at", inicioDaJanela(agora).toISOString())
    .in("contact_id", ids)
    .limit(5000);
  if (error) return contagem;
  for (const l of (data ?? []) as { contact_id: string | null }[]) {
    if (l.contact_id) contagem.set(l.contact_id, (contagem.get(l.contact_id) ?? 0) + 1);
  }
  return contagem;
}

export interface Faltoso {
  contact_id: string;
  faltas: number;
  ultima_falta: string;
}

/** Os reincidentes da organização, do que mais faltou para o que menos. */
export function agruparFaltosos(linhas: readonly { contact_id: string | null; starts_at: string }[]): Faltoso[] {
  const por = new Map<string, Faltoso>();
  for (const l of linhas) {
    if (!l.contact_id) continue;
    const f = por.get(l.contact_id) ?? { contact_id: l.contact_id, faltas: 0, ultima_falta: l.starts_at };
    f.faltas += 1;
    if (l.starts_at > f.ultima_falta) f.ultima_falta = l.starts_at;
    por.set(l.contact_id, f);
  }
  return [...por.values()]
    .filter((f) => ehReincidente(f.faltas))
    .sort((a, b) => b.faltas - a.faltas || b.ultima_falta.localeCompare(a.ultima_falta));
}
