/**
 * FORK clinic (prontuário F6) — o termo aberto pelo LINK, sem login.
 *
 * GET  — o texto do termo e as opções (nada do prontuário).
 * POST — o aceite: nome digitado e sim/não em cada opção.
 *
 * Quem prova o direito de abrir é o TOKEN (32 bytes aleatórios; o banco só tem
 * o hash), de uso único e com prazo. A organização vem do documento ligado ao
 * token, nunca do corpo. Limite por IP contra adivinhação.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { audit } from "@/lib/audit";
import { erroDoBanco } from "@/lib/clinic/atendimento/servidor";
import { FORMATO_DO_TOKEN, hashDoToken } from "@/lib/clinic/documentos/token";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { escolhasSchema } from "@/lib/clinic/documentos/tipos";
import { ipDoCliente } from "@/lib/http/ip-do-cliente";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

const corpo = z.object({ nome: z.string().trim().min(3).max(160), escolhas: escolhasSchema }).strict();

// IP pela régua única do repo (lib/http/ip-do-cliente.ts): serve de balde de
// rate limit e de evidência do aceite, nunca de autorização. Sem proxy à frente
// (null), o balde é o próprio link.
async function barrado(req: NextRequest, requestId: string, token: string): Promise<Response | null> {
  const balde = ipDoCliente(req.headers) ?? `link:${hashDoToken(token).slice(0, 16)}`;
  const r = await checkRateLimit(`clinic-termo:${balde}`, 30, 600);
  return r.allowed ? null : fail("rate_limited", "Muitas tentativas. Tente de novo em alguns minutos.", 429, { requestId });
}

export async function GET(req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = crypto.randomUUID();
  const { token } = await ctx.params;
  const limite = await barrado(req, requestId, token);
  if (limite) return limite;
  if (!FORMATO_DO_TOKEN.test(token)) return fail("not_found", "Link inválido.", 404, { requestId });
  const { data, error } = await createAdminClient().rpc("fn_clinic_documento_publico_ler", { p_token_hash: hashDoToken(token) });
  if (error) return fail("internal_error", "Não foi possível abrir o termo.", 500, { requestId });
  if (!data) return fail("token_expired", "Este link expirou ou já foi usado.", 410, { requestId });
  return ok(data as Record<string, unknown>, { requestId });
}

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  // Visitante sem sessão (o paciente) passa; um acompanhamento administrativo em
  // modo leitura que abra o link não registra aceite em nome de ninguém.
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = crypto.randomUUID();
  const { token } = await ctx.params;
  const limite = await barrado(req, requestId, token);
  if (limite) return limite;
  if (!FORMATO_DO_TOKEN.test(token)) return fail("not_found", "Link inválido.", 404, { requestId });
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", "Digite seu nome completo e responda cada opção.", 422, { requestId });
  const { data, error } = await createAdminClient().rpc("fn_clinic_documento_publico_aceitar", {
    p_token_hash: hashDoToken(token),
    p_nome: lido.data.nome,
    p_escolhas: lido.data.escolhas,
    p_ip: ipDoCliente(req.headers)?.slice(0, 64) ?? null,
    p_user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
  });
  if (error) {
    const e = erroDoBanco(error, requestId);
    return fail(e.code, e.message, e.status, { requestId });
  }
  const r = data as { documento_id: string; organization_id: string };
  void audit({
    action: "clinic.documento_aceito",
    actorUserId: null,
    organizationId: r.organization_id,
    resourceType: "clinic_documento",
    resourceId: r.documento_id,
    requestId,
    metadata: { canal: "link" },
  });
  return ok({ aceito: true }, { requestId });
}
