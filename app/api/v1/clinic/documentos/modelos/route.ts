/**
 * FORK clinic (prontuário F6) — modelos de documento (termos e contratos).
 *
 * GET  — modelos com o texto e as opções da versão atual (`documentos.ver`:
 *        quem emite escolhe daqui).
 * POST — cria um modelo, versão 1 (`modelos_clinicos.gerenciar`).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoBanco } from "@/lib/clinic/atendimento/servidor";
import { opcoesDoTermoSchema, TIPOS_DE_DOCUMENTO } from "@/lib/clinic/documentos/tipos";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corpo = z
  .object({
    tipo: z.enum(TIPOS_DE_DOCUMENTO),
    nome: z.string().trim().min(1).max(120),
    conteudo: z.string().min(1).max(50_000),
    opcoes: opcoesDoTermoSchema,
    ativo: z.boolean().default(true),
  })
  .strict();

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("documentos.ver", { requestId, resource: "clinic_modelos_documento" });
  if (!authz.ok) return authz.response;
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_modelos_documento")
    .select("id, tipo, nome, ativo, padrao, versao_atual, clinic_modelos_documento_versoes(id, numero, conteudo, opcoes, sha256)")
    .eq("organization_id", org)
    .order("tipo")
    .order("nome");
  if (error) return fail("internal_error", error.message, 500, { requestId });
  const modelos = (data ?? []).map((m) => {
    const versoes = (m.clinic_modelos_documento_versoes as Array<{ id: string; numero: number; conteudo: string; opcoes: unknown; sha256: string }> | null) ?? [];
    const atual = versoes.find((v) => v.numero === m.versao_atual);
    const opcoes = opcoesDoTermoSchema.safeParse(atual?.opcoes);
    return {
      id: m.id as string,
      tipo: m.tipo as (typeof TIPOS_DE_DOCUMENTO)[number],
      nome: m.nome as string,
      ativo: m.ativo as boolean,
      padrao: m.padrao as boolean,
      versao_atual: m.versao_atual as number,
      versao_id: atual?.id ?? null,
      conteudo: atual?.conteudo ?? "",
      opcoes: opcoes.success ? opcoes.data : [],
    };
  });
  return ok({ modelos, pode_gerenciar: authz.permissoes.has("modelos_clinicos.gerenciar") }, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("modelos_clinicos.gerenciar", { requestId, resource: "clinic_modelos_documento" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const d = lido.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_documento_modelo_salvar", {
    p_org: org,
    p_modelo: null,
    p_tipo: d.tipo,
    p_nome: d.nome,
    p_conteudo: d.conteudo,
    p_opcoes: d.opcoes,
    p_ativo: d.ativo,
    p_versao_esperada: 0,
  });
  if (error) {
    const e = erroDoBanco(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { id: string; versao_id: string; numero: number };
  void audit({
    action: "clinic.documento_modelo_salvo",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_modelo_documento",
    resourceId: r.id,
    requestId,
    metadata: { tipo: d.tipo, numero: r.numero },
  });
  return ok(r, { requestId });
}
