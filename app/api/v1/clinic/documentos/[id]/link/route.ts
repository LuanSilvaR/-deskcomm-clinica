/**
 * POST /api/v1/clinic/documentos/:id/link — gera o link de aceite à distância
 * (FORK clinic, prontuário F6). O token aparece UMA vez, nesta resposta; o banco
 * guarda só o hash. Expira (padrão 72 h) e morre no primeiro uso.
 * F9: devolve também o telefone do paciente (lido da empresa ativa) para o
 * botão "Enviar pelo WhatsApp".
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoBanco } from "@/lib/clinic/atendimento/servidor";
import { gerarToken } from "@/lib/clinic/documentos/token";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { env } from "@/lib/env";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const corpo = z.object({ horas: z.number().int().min(1).max(720).default(72) }).strict();

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("documentos.colher_aceite", {
    requestId,
    resource: "clinic_documentos_emitidos",
  });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success)
    return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const { token, hash } = gerarToken();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_documento_link_criar", {
    p_org: org,
    p_documento: id,
    p_token_hash: hash,
    p_horas: lido.data.horas,
  });
  if (error) {
    const e = erroDoBanco(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.documento_link_criado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_documento",
    resourceId: id,
    requestId,
    metadata: { horas: lido.data.horas },
  });
  const { data: doc } = await supabase
    .from("clinic_documentos_emitidos")
    .select("contacts(phone_number)")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  const contato = doc?.contacts as
    { phone_number: string | null } | Array<{ phone_number: string | null }> | null | undefined;
  const telefone = (Array.isArray(contato) ? contato[0] : contato)?.phone_number ?? null;
  // Endereço público configurado da instalação (atrás de proxy, req.url pode ser interno).
  const origem = (env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/+$/, "");
  return ok(
    {
      url: `${origem}/termo/${token}`,
      expira_em: (data as { expira_em: string }).expira_em,
      telefone,
    },
    { requestId },
  );
}
