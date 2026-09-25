/**
 * /api/v1/clinic/procedimentos — FORK clinic (9015): o catálogo de procedimentos.
 *
 * GET (`procedimentos.ver`): todos, ativos primeiro, com especialidades,
 * profissionais e o resumo do POP. POST (`procedimentos.gerenciar`): cria, e
 * grava os vínculos se vierem. A organização vem da sessão; a RLS decide de novo.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { falhaDoBanco } from "@/lib/clinic/api";
import { codigoOuNulo, criarProcedimentoSchema } from "@/lib/clinic/procedimentos/schemas";
import { COLUNAS_DO_PROCEDIMENTO, paraProcedimento, salvarVinculos } from "@/lib/clinic/procedimentos/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

import { falhaDosVinculos } from "./_falhas";

export const dynamic = "force-dynamic";

const MSG_CONFLITO = "Já existe um procedimento com esse nome ou código.";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("procedimentos.ver", { requestId, resource: "clinic_procedures" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_procedures")
    .select(COLUNAS_DO_PROCEDIMENTO)
    .eq("organization_id", authz.org.orgId)
    .order("is_active", { ascending: false })
    .order("name", { ascending: true })
    .limit(1000);
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok(((data ?? []) as unknown as Parameters<typeof paraProcedimento>[0][]).map(paraProcedimento), { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requirePermission("procedimentos.gerenciar", { requestId, resource: "clinic_procedures" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const lido = criarProcedimentoSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return fail("validation_failed", t(lido.error.issues[0]?.message ?? "corpo inválido"), 422, { requestId });
  }
  const { specialty_ids, professional_ids, ...dados } = lido.data;
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_procedures")
    .insert({ ...dados, code: codigoOuNulo(dados.code), organization_id: org })
    .select("id")
    .single();
  if (error) return falhaDoBanco(error, requestId, t, { conflito: MSG_CONFLITO });
  const id = (data as { id: string }).id;

  if (specialty_ids?.length || professional_ids?.length) {
    const r = await salvarVinculos(supabase, org, id, specialty_ids ?? [], professional_ids ?? []);
    if (!r.ok) {
      // Sem vínculo válido o cadastro não fica pela metade: desfaz o procedimento.
      await supabase.from("clinic_procedures").delete().eq("organization_id", org).eq("id", id);
      return falhaDosVinculos(r, requestId, t);
    }
  }

  void audit({
    action: "clinic.procedimento_criado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_procedure",
    resourceId: id,
    requestId,
    metadata: { name: dados.name, code: codigoOuNulo(dados.code) },
  });

  const { data: criado } = await supabase.from("clinic_procedures").select(COLUNAS_DO_PROCEDIMENTO).eq("organization_id", org).eq("id", id).single();
  return ok(paraProcedimento(criado as unknown as Parameters<typeof paraProcedimento>[0]), { requestId, status: 201 });
}
