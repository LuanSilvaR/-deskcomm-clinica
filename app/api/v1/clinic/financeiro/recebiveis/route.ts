/**
 * GET /api/v1/clinic/financeiro/recebiveis?status=&de=&ate= — FORK clinic
 * (financeiro FN2): as parcelas a receber (e as já recebidas, antecipadas e
 * estornadas) com a comanda, a forma e a maquininha; e o líquido previsto em
 * 30, 60 e 90 dias. Sem dado de paciente. `financeiro.ver`.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { STATUS_DE_PARCELA } from "@/lib/clinic/financeiro/schemas";
import { lerRecebiveis } from "@/lib/clinic/financeiro/servidor";
import { hojeNoFuso } from "@/lib/clinic/navegacao/resumo-do-dia";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const filtroSchema = z
  .object({ status: z.enum(STATUS_DE_PARCELA).optional(), de: data.optional(), ate: data.optional() })
  .strict();

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("financeiro.ver", { requestId, resource: "clinic_fin_parcelas" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const bruto = Object.fromEntries([...req.nextUrl.searchParams.entries()].filter(([, v]) => v !== ""));
  const lido = filtroSchema.safeParse(bruto);
  if (!lido.success) return fail("validation_failed", t("Filtro inválido."), 422, { requestId });
  try {
    const r = await lerRecebiveis(
      await createClient(),
      authz.org.orgId,
      lido.data,
      hojeNoFuso(new Date(), authz.org.timezone || "America/Sao_Paulo"),
    );
    return ok(r, { requestId });
  } catch {
    return fail("internal_error", t("Não foi possível carregar as contas a receber."), 500, { requestId });
  }
}
