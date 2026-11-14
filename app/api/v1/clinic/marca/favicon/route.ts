/**
 * POST/DELETE /api/v1/clinic/marca/favicon — o favicon da empresa (FORK clinic, 8012).
 *
 * Irmã da rota do logo (`app/api/v1/marca/logo/route.ts`), só no escopo da
 * ORGANIZAÇÃO, e com os mesmos gates na mesma ordem:
 *   suporte de escrita → sessão → organização ativa → admin → MFA → teto de trocas
 *   → tamanho → não-SVG → régua do PNG (`conferirFavicon`) → upload → ponteiro
 *   (`fn_clinic_definir_favicon`, que re-confere papel e prefixo) → apaga o anterior.
 *
 * A organização vem da sessão (`resolveActiveOrg`), nunca do corpo. O caminho
 * é `<org>/<uuid v4>.png` no bucket `brand-logos` — o mesmo do logo, então a
 * guarda `podeApagar` e a política do bucket valem igual.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { loadAuthUser, mfaEmDivida, resolveActiveOrg } from "@/lib/auth/server";
import { roleAtLeast } from "@/lib/auth/types";
import { baseDoStorage, BUCKET_DE_LOGOS, caminhoNovoDoLogo, prefixoDaOrganizacao, urlPublicaDoLogo } from "@/lib/branding/logo";
import { pareceSvg, podeApagar } from "@/lib/branding/logo-arquivo";
import { conferirFavicon, faviconDeSettings, TAMANHO_MAXIMO_DO_FAVICON } from "@/lib/clinic/marca/favicon";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TETO_POR_USUARIO = 10;
const JANELA_SEGUNDOS = 300;

type Ctx = { userId: string; orgId: string; prefixo: string };
type Recusa = { codigo: string; mensagem: string; status: number };

async function abrir(): Promise<{ ctx: Ctx } | { recusa: Recusa }> {
  const user = await loadAuthUser();
  if (!user) return { recusa: { codigo: "unauthenticated", mensagem: "Faça login.", status: 401 } };
  const org = await resolveActiveOrg(user);
  if (!org) return { recusa: { codigo: "forbidden_tenant", mensagem: "Sem organização ativa.", status: 403 } };
  if (!user.is_platform_admin && !roleAtLeast(org.role, "admin")) {
    return {
      recusa: { codigo: "forbidden_role", mensagem: "Só quem administra a empresa pode trocar o favicon dela.", status: 403 },
    };
  }
  if (await mfaEmDivida()) {
    return {
      recusa: { codigo: "mfa_required", mensagem: "Confirme o segundo fator nesta sessão para trocar o favicon.", status: 403 },
    };
  }
  return { ctx: { userId: user.id, orgId: org.orgId, prefixo: prefixoDaOrganizacao(org.orgId) } };
}

async function teto(ctx: Ctx, requestId: string): Promise<Response | null> {
  const limite = await checkRateLimit(`marca-favicon:${ctx.userId}`, TETO_POR_USUARIO, JANELA_SEGUNDOS);
  if (limite.allowed) return null;
  return fail("rate_limited", "Muitas trocas de favicon seguidas. Tente em alguns minutos.", 429, {
    requestId,
    headers: { "Retry-After": String(JANELA_SEGUNDOS) },
  });
}

async function caminhoGravado(ctx: Ctx): Promise<string | null> {
  const { data } = await createAdminClient().from("organizations").select("settings").eq("id", ctx.orgId).maybeSingle();
  return faviconDeSettings(data?.settings ?? null);
}

async function gravar(ctx: Ctx, caminho: string | null): Promise<Recusa | null> {
  const { data, error } = await createAdminClient().rpc("fn_clinic_definir_favicon", {
    p_org: ctx.orgId,
    p_actor: ctx.userId,
    p_path: caminho,
  });
  if (error) {
    if (error.code === "42501") {
      return { codigo: "forbidden_role", mensagem: "Só quem administra a empresa pode trocar o favicon dela.", status: 403 };
    }
    logger.error("[marca/favicon] gravação falhou", { codigo: error.code, detalhe: error.message });
    return { codigo: "internal_error", mensagem: "Erro ao gravar o favicon.", status: 500 };
  }
  if (data !== 1) return { codigo: "internal_error", mensagem: "O favicon não foi gravado.", status: 500 };
  return null;
}

async function apagarAnterior(ctx: Ctx, anterior: string | null): Promise<void> {
  if (!anterior) return;
  if (!podeApagar(anterior, ctx.prefixo)) {
    logger.error("[marca/favicon] recusei apagar arquivo fora do escopo", { caminho_recusado: anterior });
    return;
  }
  const { error } = await createAdminClient().storage.from(BUCKET_DE_LOGOS).remove([anterior]);
  if (error) logger.warn("[marca/favicon] arquivo anterior ficou órfão", { detalhe: error.message, caminho: anterior });
}

async function auditar(ctx: Ctx, req: NextRequest, requestId: string, definido: boolean): Promise<void> {
  await audit({
    action: "org.branding_updated",
    actorUserId: ctx.userId,
    organizationId: ctx.orgId,
    resourceType: "organization",
    resourceId: ctx.orgId,
    requestId,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent") ?? null,
    metadata: { fields_changed: ["favicon_path"], favicon_definido: definido },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();

  const aberto = await abrir();
  if ("recusa" in aberto) return fail(aberto.recusa.codigo, aberto.recusa.mensagem, aberto.recusa.status, { requestId });
  const ctx = aberto.ctx;
  const limitado = await teto(ctx, requestId);
  if (limitado) return limitado;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return fail("validation_failed", "Campo 'file' (multipart) obrigatório.", 422, { requestId });
  }
  if (file.size > TAMANHO_MAXIMO_DO_FAVICON) {
    return fail("payload_too_large", "O favicon precisa ter até 256 KB.", 413, { requestId });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (pareceSvg(bytes)) {
    return fail("favicon_svg_recusado", "SVG não é aceito: exporte o ícone em PNG (fundo transparente).", 415, { requestId });
  }
  const recusaDoArquivo = conferirFavicon(bytes);
  if (recusaDoArquivo) {
    const status = recusaDoArquivo.codigo === "favicon_nao_png" ? 415 : 422;
    return fail(recusaDoArquivo.codigo, recusaDoArquivo.mensagem, status, { requestId });
  }

  const anterior = await caminhoGravado(ctx);
  const caminho = caminhoNovoDoLogo(ctx.prefixo, "png");
  const { error: erroUp } = await createAdminClient()
    .storage.from(BUCKET_DE_LOGOS)
    .upload(caminho, bytes, { contentType: "image/png", upsert: false });
  if (erroUp) {
    logger.error("[marca/favicon] upload falhou", { detalhe: erroUp.message, requestId });
    return fail("internal_error", "Erro ao subir o favicon.", 500, { requestId });
  }
  const recusa = await gravar(ctx, caminho);
  if (recusa) {
    void createAdminClient().storage.from(BUCKET_DE_LOGOS).remove([caminho]);
    return fail(recusa.codigo, recusa.mensagem, recusa.status, { requestId });
  }
  await apagarAnterior(ctx, anterior);
  await auditar(ctx, req, requestId, true);
  return ok({ favicon_path: caminho, favicon_url: urlPublicaDoLogo(caminho, baseDoStorage()) }, { requestId });
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();

  const aberto = await abrir();
  if ("recusa" in aberto) return fail(aberto.recusa.codigo, aberto.recusa.mensagem, aberto.recusa.status, { requestId });
  const ctx = aberto.ctx;
  const limitado = await teto(ctx, requestId);
  if (limitado) return limitado;

  const anterior = await caminhoGravado(ctx);
  const recusa = await gravar(ctx, null);
  if (recusa) return fail(recusa.codigo, recusa.mensagem, recusa.status, { requestId });
  await apagarAnterior(ctx, anterior);
  await auditar(ctx, req, requestId, false);
  return ok({ favicon_path: null, favicon_url: null }, { requestId });
}
