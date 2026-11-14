/**
 * /api/v1/clinic/orcamentos — FORK clinic (orçamento O2, migration 8007).
 *
 * GET (`orcamentos.ver`) `?contact_id=` — os orçamentos do paciente, com os
 * itens, mais o limite de desconto da clínica e se a opção está ligada.
 * POST (`orcamentos.criar`) — cria o rascunho por `fn_clinic_orcamento_salvar`:
 * o preço de cada item vem da tabela de preços, nunca do corpo. A organização
 * vem da sessão; o banco confere permissão, MFA e a opção de novo.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { descontoMaxDaConfig, orcamentosLigado } from "@/lib/clinic/flags";
import { erroDoOrcamento } from "@/lib/clinic/orcamentos/erros";
import { COLUNAS_DO_ORCAMENTO, criarOrcamentoSchema } from "@/lib/clinic/orcamentos/orcamento";
import { pacienteNoEscopo } from "@/lib/clinic/pacientes/escopo-de-pacientes";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const filtroSchema = z.object({ contact_id: z.string().uuid() });

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("orcamentos.ver", { requestId, resource: "clinic_orcamentos" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const filtro = filtroSchema.safeParse({ contact_id: req.nextUrl.searchParams.get("contact_id") });
  if (!filtro.success) return fail("validation_failed", t("Informe o paciente."), 422, { requestId });
  const org = authz.org.orgId;

  const supabase = await createClient();
  // FORK clinic (O5, revisão security-lgpd): só pacientes do escopo de quem pede.
  if (!(await pacienteNoEscopo(supabase, org, authz.user.id, filtro.data.contact_id))) {
    return fail("not_found", t("Paciente não encontrado."), 404, { requestId });
  }
  const [config, lista] = await Promise.all([
    supabase.from("organizations").select("settings").eq("id", org).maybeSingle(),
    supabase
      .from("clinic_orcamentos")
      .select(COLUNAS_DO_ORCAMENTO)
      .eq("organization_id", org)
      .eq("contact_id", filtro.data.contact_id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (lista.error) return fail("internal_error", t("Não foi possível carregar os orçamentos."), 500, { requestId });
  const settings = (config.data as { settings?: unknown } | null)?.settings;
  return ok(
    {
      ligado: orcamentosLigado(settings),
      desconto_max_pct: descontoMaxDaConfig(settings),
      orcamentos: lista.data ?? [],
    },
    { requestId },
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("orcamentos.criar", { requestId, resource: "clinic_orcamentos" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const lido = criarOrcamentoSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return fail("validation_failed", t(lido.error.issues[0]?.message ?? "Dados inválidos."), 422, { requestId });
  }
  const org = authz.org.orgId;
  const supabase = await createClient();
  if (!(await pacienteNoEscopo(supabase, org, authz.user.id, lido.data.contact_id))) {
    return fail("not_found", t("Paciente não encontrado."), 404, { requestId });
  }
  const { data, error } = await supabase.rpc("fn_clinic_orcamento_salvar", { p_org: org, p_id: null, p_dados: lido.data });
  if (error) {
    const e = erroDoOrcamento(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { id: string; numero: number; total_cents: number; desconto_pendente: boolean };
  void audit({
    action: "clinic.orcamento_salvo",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_orcamento",
    resourceId: r.id,
    requestId,
    metadata: { numero: r.numero, total_cents: r.total_cents, itens: lido.data.itens.length, criado: true },
  });
  return ok(r, { requestId, status: 201 });
}
