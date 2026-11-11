/** GET /api/v1/clinic/lgpd/atestados/[id]: link temporário do PDF. Sem checar a chave: o já emitido continua baixável. */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { BUCKET_DO_ATESTADO } from "@/lib/clinic/lgpd/emitir-atestado";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const EXPIRA_EM_SEGUNDOS = 900;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "clinic_atestados_anonimizacao" });
  if (!authz.ok) return authz.response;
  const orgId = authz.org.orgId;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("not_found", "Atestado não encontrado.", 404, { requestId });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("clinic_atestados_anonimizacao")
    .select("id, codigo_curto, pdf_path")
    .eq("organization_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) return fail("internal_error", "Não foi possível ler o atestado.", 500, { requestId });
  const linha = data as { id: string; codigo_curto: string; pdf_path: string | null } | null;
  if (!linha || !linha.pdf_path) return fail("not_found", "Atestado não encontrado.", 404, { requestId });

  const { data: assinado, error: erroUrl } = await admin.storage
    .from(BUCKET_DO_ATESTADO)
    .createSignedUrl(linha.pdf_path, EXPIRA_EM_SEGUNDOS);
  if (erroUrl || !assinado?.signedUrl) return fail("internal_error", "Não foi possível gerar o link.", 500, { requestId });
  return ok(
    { url: assinado.signedUrl, expira_em_segundos: EXPIRA_EM_SEGUNDOS, codigo_curto: linha.codigo_curto },
    { requestId },
  );
}
