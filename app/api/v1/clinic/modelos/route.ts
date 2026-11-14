/**
 * FORK clinic (prontuário F3) — o editor de modelos clínicos.
 *
 * GET  /api/v1/clinic/modelos — todos os modelos (ativos e inativos, dos dois
 *      tipos), com os campos da versão atual e as especialidades.
 * POST /api/v1/clinic/modelos — cria um modelo (versão 1).
 *
 * `modelos_clinicos.gerenciar`: configuração, sem acesso a paciente.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoBanco } from "@/lib/clinic/atendimento/servidor";
import { camposPublicaveisSchema } from "@/lib/clinic/formularios/campos";
import { lerCampos } from "@/lib/clinic/prontuario/leitura";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corpo = z
  .object({
    tipo: z.enum(["anamnese", "avaliacao"]),
    nome: z.string().trim().min(1).max(80),
    descricao: z.string().trim().max(300).nullish(),
    especialidades: z.array(z.string().uuid()).max(50).default([]),
    campos: camposPublicaveisSchema,
  })
  .strict();

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("modelos_clinicos.gerenciar", { requestId, resource: "clinic_modelos_formulario" });
  if (!authz.ok) return authz.response;
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_modelos_formulario")
    .select("id, tipo, nome, descricao, especialidades, ativo, padrao, versao_atual, clinic_modelos_formulario_versoes(id, numero, campos, created_at)")
    .eq("organization_id", org)
    .order("tipo", { ascending: true })
    .order("nome", { ascending: true });
  if (error) return fail("internal_error", error.message, 500, { requestId });

  const modelos = (data ?? []).map((m) => {
    const versoes = (m.clinic_modelos_formulario_versoes as Array<{ id: string; numero: number; campos: unknown; created_at: string }> | null) ?? [];
    const atual = versoes.find((v) => v.numero === m.versao_atual);
    return {
      id: m.id as string,
      tipo: m.tipo as "anamnese" | "avaliacao",
      nome: m.nome as string,
      descricao: (m.descricao as string | null) ?? null,
      especialidades: (m.especialidades as string[] | null) ?? [],
      ativo: m.ativo as boolean,
      padrao: m.padrao as boolean,
      versao_atual: m.versao_atual as number,
      publicada_em: atual?.created_at ?? null,
      campos: lerCampos(atual?.campos),
    };
  });
  return ok({ modelos }, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("modelos_clinicos.gerenciar", { requestId, resource: "clinic_modelos_formulario" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return fail("validation_failed", t(lido.error.issues[0]?.message ?? "Dados inválidos."), 422, { requestId });
  }
  const org = authz.org.orgId;
  const d = lido.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_modelo_criar", {
    p_org: org,
    p_tipo: d.tipo,
    p_nome: d.nome,
    p_descricao: d.descricao ?? null,
    p_especialidades: d.especialidades,
    p_campos: d.campos,
  });
  if (error) {
    const e = erroDoBanco(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { id: string; versao_id: string; numero: number };
  void audit({
    action: "clinic.modelo_criado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_modelo_formulario",
    resourceId: r.id,
    requestId,
    metadata: { tipo: d.tipo, campos: d.campos.length },
  });
  return ok(r, { requestId });
}
