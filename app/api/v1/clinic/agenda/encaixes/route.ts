/**
 * GET /api/v1/clinic/agenda/encaixes?de=&ate= — FORK clinic (agenda S6b, issue #69).
 *
 * As marcas "Encaixe" de um intervalo: appointment_id, motivo, ator e quando. Lê
 * `clinic_agenda_encaixes` pela SESSÃO (RLS por organização). Sem `agenda.ver_outros`
 * só entram os encaixes de compromissos do próprio profissional.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { escopoDaLeitura } from "@/lib/clinic/agenda/escopo-da-agenda";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const consulta = z.object({
  de: z.string().datetime({ offset: true }),
  ate: z.string().datetime({ offset: true }),
});

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("agenda.ver", { requestId, resource: "clinic_agenda_encaixes" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const url = new URL(req.url);
  const lido = consulta.safeParse({ de: url.searchParams.get("de"), ate: url.searchParams.get("ate") });
  if (!lido.success || new Date(lido.data.ate) <= new Date(lido.data.de)) {
    return fail("validation_failed", t("Consulta inválida."), 422, { requestId });
  }
  const org = authz.org.orgId;
  const escopo = escopoDaLeitura({ permissoes: authz.permissoes, usuarioId: authz.user.id, pedido: null });
  if (!escopo.ok) return fail("forbidden_permission", t("Você só pode ver a sua própria agenda."), 403, { requestId });

  const supabase = await createClient();
  let busca = supabase
    .from("calendar_appointments")
    .select("id, owner_user_id")
    .eq("organization_id", org)
    .lt("starts_at", lido.data.ate)
    .gt("ends_at", lido.data.de)
    .limit(1000);
  if (escopo.dono) busca = busca.eq("owner_user_id", escopo.dono);
  const { data: ags, error: erroAg } = await busca;
  if (erroAg) return fail("internal_error", erroAg.message, 500, { requestId });
  const ids = ((ags ?? []) as Array<{ id: string }>).map((a) => a.id);
  if (ids.length === 0) return ok({ encaixes: [] }, { requestId });

  const { data, error } = await supabase
    .from("clinic_agenda_encaixes")
    .select("appointment_id, motivo, ator, created_at")
    .eq("organization_id", org)
    .in("appointment_id", ids)
    .order("created_at", { ascending: true });
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok({ encaixes: data ?? [] }, { requestId });
}
