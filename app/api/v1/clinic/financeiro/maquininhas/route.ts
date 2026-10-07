/**
 * GET /api/v1/clinic/financeiro/maquininhas — FORK clinic (financeiro FN1):
 * adquirentes, vigências das tabelas de taxa e as formas de pagamento com tipo
 * e adquirente. `financeiro.ver` (a RLS também exige).
 */
import { randomUUID } from "node:crypto";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { lerMaquininhas } from "@/lib/clinic/financeiro/servidor";
import { financeiroAvancadoLigado } from "@/lib/clinic/flags";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("financeiro.ver", { requestId, resource: "clinic_fin_adquirentes" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("settings").eq("id", authz.org.orgId).maybeSingle();
  try {
    const maq = await lerMaquininhas(supabase, authz.org.orgId);
    return ok({ ligado: financeiroAvancadoLigado((org as { settings?: unknown } | null)?.settings), ...maq }, { requestId });
  } catch {
    return fail("internal_error", traduzir("Não foi possível carregar as maquininhas.", authz.user.idioma), 500, { requestId });
  }
}
