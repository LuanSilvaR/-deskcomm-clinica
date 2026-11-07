/**
 * /api/v1/clinic/precos — FORK clinic (orçamento O1, migration 8006): a tabela
 * de preços.
 *
 * GET (`orcamentos.ver`): a tabela vigente (com o histórico de cada item) e as
 * opções de item (procedimentos e tipos de serviço ativos). POST
 * (`orcamentos.precos`): publica uma vigência nova por `fn_clinic_preco_publicar`
 * — o preço antigo fica no histórico. A organização vem da sessão; o banco
 * confere permissão, MFA e a opção de novo.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { orcamentosLigado } from "@/lib/clinic/flags";
import { erroDoOrcamento } from "@/lib/clinic/orcamentos/erros";
import { COLUNAS_DO_PRECO, publicarPrecoSchema, tabelaVigente, type LinhaDePreco } from "@/lib/clinic/orcamentos/precos";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("orcamentos.ver", { requestId, resource: "clinic_precos" });
  if (!authz.ok) return authz.response;
  const org = authz.org.orgId;

  const supabase = await createClient();
  const [config, precos, procedimentos, servicos] = await Promise.all([
    supabase.from("organizations").select("settings").eq("id", org).maybeSingle(),
    supabase
      .from("clinic_precos")
      .select(COLUNAS_DO_PRECO)
      .eq("organization_id", org)
      .order("vigente_desde", { ascending: false })
      .limit(5000),
    supabase
      .from("clinic_procedures")
      .select("id, name, is_active")
      .eq("organization_id", org)
      .order("name", { ascending: true })
      .limit(1000),
    supabase
      .from("calendar_event_types")
      .select("id, name, is_active, default_price_cents")
      .eq("organization_id", org)
      .order("name", { ascending: true })
      .limit(1000),
  ]);
  if (precos.error) return fail("internal_error", precos.error.message, 500, { requestId });

  return ok(
    {
      ligado: orcamentosLigado((config.data as { settings?: unknown } | null)?.settings),
      itens: tabelaVigente((precos.data ?? []) as unknown as LinhaDePreco[], new Date().toISOString()),
      // Sem permissão de ver procedimentos, a lista vem vazia (RLS) — a tabela continua.
      procedimentos: (procedimentos.data ?? []) as { id: string; name: string; is_active: boolean }[],
      servicos: (servicos.data ?? []) as { id: string; name: string; is_active: boolean; default_price_cents: number | null }[],
    },
    { requestId },
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requirePermission("orcamentos.precos", { requestId, resource: "clinic_precos" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const lido = publicarPrecoSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return fail("validation_failed", t(lido.error.issues[0]?.message ?? "Dados inválidos."), 422, { requestId });
  }
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_preco_publicar", { p_org: org, p_dados: lido.data });
  if (error) {
    const e = erroDoOrcamento(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { id: string; mudou: boolean; anterior_cents?: number | null };
  if (r.mudou) {
    void audit({
      action: "clinic.preco_publicado",
      actorUserId: authz.user.id,
      organizationId: org,
      resourceType: "clinic_preco",
      resourceId: r.id,
      requestId,
      metadata: {
        sessoes: lido.data.sessoes,
        preco_cents: lido.data.preco_cents,
        anterior_cents: r.anterior_cents ?? null,
        ativo: lido.data.ativo,
      },
    });
  }
  return ok({ id: r.id, mudou: r.mudou }, { requestId, status: r.mudou ? 201 : 200 });
}
