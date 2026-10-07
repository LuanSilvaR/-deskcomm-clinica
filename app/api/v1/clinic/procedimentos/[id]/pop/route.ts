/**
 * POST /api/v1/clinic/procedimentos/:id/pop — FORK clinic (9015): cria o POP do
 * procedimento, versão 1.0 em rascunho, com o MODELO padrão ou em BRANCO.
 * `pops.editar` (conferido de novo no banco por fn_pop_criar).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { DOCUMENTO_VAZIO, textoPuro } from "@/lib/clinic/pops/documento";
import { modeloPadrao } from "@/lib/clinic/pops/modelo";
import { falhaDoPop } from "@/lib/clinic/pops/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corpoSchema = z
  .object({
    modelo: z.enum(["padrao", "branco"]),
    codigo: z.string().trim().max(30).nullish(),
  })
  .strict();

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requirePermission("pops.editar", { requestId, resource: "clinic_pops" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", "id inválido", 422, { requestId });

  const lido = corpoSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Escolha o modelo padrão ou o documento em branco."), 422, { requestId });

  const supabase = await createClient();
  // A org da sessão: o procedimento tem de ser dela (a função confere de novo).
  const { data: proc } = await supabase.from("clinic_procedures").select("id").eq("organization_id", authz.org.orgId).eq("id", id).maybeSingle();
  if (!proc) return fail("not_found", t("Procedimento não encontrado."), 404, { requestId });

  const conteudo = lido.data.modelo === "padrao" ? modeloPadrao(authz.user.idioma) : DOCUMENTO_VAZIO;
  const { data, error } = await supabase.rpc("fn_pop_criar", {
    p_procedure: id,
    p_code: lido.data.codigo?.trim() || null,
    p_content: conteudo,
    p_content_text: textoPuro(conteudo),
  });
  if (error) return falhaDoPop(error, requestId, t);
  const r = data as { pop_id: string; versao_id: string; codigo: string };

  void audit({
    action: "clinic.pop_criado",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "clinic_pop",
    resourceId: r.pop_id,
    requestId,
    metadata: { procedimento: id, codigo: r.codigo, modelo: lido.data.modelo, versao: "1.0" },
  });
  return ok(r, { requestId, status: 201 });
}
