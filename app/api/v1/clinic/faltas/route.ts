/**
 * GET /api/v1/clinic/faltas — FORK clinic (E5.1).
 *
 * Os pacientes REINCIDENTES (2 faltas ou mais nos últimos 12 meses), do que mais
 * faltou para o que menos, com a última falta e o próximo horário marcado.
 * Leitura (viewer), pela sessão — a RLS de quem pede vale.
 */
import { randomUUID } from "node:crypto";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { agruparFaltosos, inicioDaJanela } from "@/lib/clinic/agenda/faltas";
import { nomeDoContato } from "@/lib/contacts/rotulo-do-contato";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "agenda" });
  if (!authz.ok) return authz.response;
  const org = authz.org.orgId;
  const agora = new Date();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_appointments")
    .select("contact_id, starts_at")
    .eq("organization_id", org)
    .eq("status", "no_show")
    .not("contact_id", "is", null)
    .gte("starts_at", inicioDaJanela(agora).toISOString())
    .limit(5000);
  if (error) return fail("internal_error", error.message, 500, { requestId });

  const faltosos = agruparFaltosos((data ?? []) as { contact_id: string | null; starts_at: string }[]).slice(0, 200);
  const ids = faltosos.map((f) => f.contact_id);
  const [{ data: contatos }, { data: proximos }] = ids.length
    ? await Promise.all([
        supabase.from("contacts").select("id, name, display_name, phone_number").eq("organization_id", org).in("id", ids),
        supabase
          .from("calendar_appointments")
          .select("id, contact_id, starts_at, title")
          .eq("organization_id", org)
          .in("status", ["pending", "confirmed"])
          .gt("starts_at", agora.toISOString())
          .in("contact_id", ids)
          .order("starts_at", { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }];

  const porId = new Map(((contatos ?? []) as { id: string; name: string | null; display_name: string | null; phone_number: string | null }[]).map((c) => [c.id, c]));
  const proximoDe = new Map<string, { id: string; starts_at: string; title: string }>();
  for (const p of (proximos ?? []) as { id: string; contact_id: string; starts_at: string; title: string }[]) {
    if (!proximoDe.has(p.contact_id)) proximoDe.set(p.contact_id, p);
  }

  return ok(
    {
      itens: faltosos.map((f) => {
        const c = porId.get(f.contact_id);
        const p = proximoDe.get(f.contact_id);
        return {
          ...f,
          paciente: nomeDoContato(c ?? null),
          telefone: c?.phone_number ?? null,
          proximo: p ? { id: p.id, inicio: p.starts_at, titulo: p.title } : null,
        };
      }),
    },
    { requestId },
  );
}
