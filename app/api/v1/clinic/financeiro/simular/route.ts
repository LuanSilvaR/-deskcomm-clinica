/**
 * GET /api/v1/clinic/financeiro/simular?… — FORK clinic (financeiro FN1): o
 * simulador de recebimento líquido. Mesmo motor que o banco usa ao gravar
 * (`lib/clinic/financeiro/taxas.ts`); devolve taxa, líquido, parcelas com data,
 * antecipação, margem (se vier o custo), preço sugerido e o comparativo entre
 * as maquininhas. Só calcula — não grava nada (por isso GET). `financeiro.ver`.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { simularSchema } from "@/lib/clinic/financeiro/schemas";
import { lerMaquininhas, simular } from "@/lib/clinic/financeiro/servidor";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NUMEROS = ["parcelas", "bruto_cents", "custo_cents", "margem_pct"] as const;

/** Query string → objeto do schema: números e booleanos convertidos, vazios fora. */
function lerConsulta(p: URLSearchParams): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of p.entries()) {
    if (v === "") continue;
    if ((NUMEROS as readonly string[]).includes(k)) o[k] = Number(v);
    else if (k === "antecipar") o[k] = v === "true";
    else if (k === "bandeira" && v === "null") o[k] = null;
    else o[k] = v;
  }
  return o;
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("financeiro.ver", { requestId, resource: "clinic_fin_adquirentes" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const lido = simularSchema.safeParse(lerConsulta(req.nextUrl.searchParams));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const supabase = await createClient();
  let maq;
  try {
    maq = await lerMaquininhas(supabase, authz.org.orgId);
  } catch {
    return fail("internal_error", t("Não foi possível carregar as maquininhas."), 500, { requestId });
  }
  const r = simular(maq, lido.data, authz.org.timezone ?? null);
  if (!r) return fail("not_found", t("Maquininha não encontrada."), 404, { requestId });
  return ok(r, { requestId });
}
