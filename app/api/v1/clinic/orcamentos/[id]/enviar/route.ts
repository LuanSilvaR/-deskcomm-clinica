/**
 * POST /api/v1/clinic/orcamentos/[id]/enviar — FORK clinic (orçamento O3,
 * migration 8008): congela o rascunho e emite o CONTRATO.
 *
 * O corpo só escolhe o modelo de contrato (opcional: sem ele vale o modelo de
 * contrato ativo da clínica). O texto é montado AQUI, a partir do que está
 * gravado no orçamento (itens, valores, forma de pagamento, parcelas) e do
 * paciente/clínica/profissional — nunca do corpo. `fn_clinic_orcamento_enviar`
 * confere permissão, opção, desconto pendente e validade, e emite pelo módulo
 * de documentos (documentos.emitir, prontuário ligado, sha256).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { dataPorExtenso, renderizarContrato, type OrcamentoDoContrato } from "@/lib/clinic/orcamentos/contrato";
import { erroDoOrcamento } from "@/lib/clinic/orcamentos/erros";
import { COLUNAS_DO_ORCAMENTO, enviarOrcamentoSchema, rotuloDoNumero } from "@/lib/clinic/orcamentos/orcamento";
import { pacienteNoEscopo } from "@/lib/clinic/pacientes/escopo-de-pacientes";
import { nomeDoContato } from "@/lib/contacts/rotulo-do-contato";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("orcamentos.criar", { requestId, resource: "clinic_orcamentos" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("not_found", t("Orçamento não encontrado."), 404, { requestId });
  const lido = enviarOrcamentoSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();

  const { data: orc } = await supabase
    .from("clinic_orcamentos")
    .select(COLUNAS_DO_ORCAMENTO)
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (!orc) return fail("not_found", t("Orçamento não encontrado."), 404, { requestId });
  const o = orc as unknown as OrcamentoDoContrato & { contact_id: string; status: string };
  // FORK clinic (agenda S5): sem pacientes.ver_todos, só os pacientes da própria agenda.
  if (!(await pacienteNoEscopo(supabase, org, authz.user.id, o.contact_id))) {
    return fail("not_found", t("Paciente não encontrado."), 404, { requestId });
  }

  // O modelo: o pedido, ou a versão mais nova do modelo de contrato ativo da clínica.
  let versaoId = lido.data.modelo_versao_id ?? null;
  if (!versaoId) {
    const { data: modelos } = await supabase
      .from("clinic_modelos_documento")
      .select("id, clinic_modelos_documento_versoes(id, numero)")
      .eq("organization_id", org)
      .eq("tipo", "contrato")
      .eq("ativo", true)
      .order("created_at", { ascending: true })
      .limit(1);
    const versoes =
      ((modelos?.[0] as { clinic_modelos_documento_versoes?: { id: string; numero: number }[] } | undefined)
        ?.clinic_modelos_documento_versoes ?? []).slice();
    versoes.sort((a, b) => b.numero - a.numero);
    versaoId = versoes[0]?.id ?? null;
  }
  if (!versaoId) {
    return fail("validation_failed", t("Escolha um modelo de contrato ativo em Configurações › Modelos clínicos."), 422, { requestId });
  }

  const [versao, contato, empresa, prof] = await Promise.all([
    supabase
      .from("clinic_modelos_documento_versoes")
      .select("conteudo, clinic_modelos_documento(nome)")
      .eq("organization_id", org)
      .eq("id", versaoId)
      .maybeSingle(),
    supabase.from("contacts").select("name, display_name, phone_number").eq("organization_id", org).eq("id", o.contact_id).maybeSingle(),
    supabase.from("organizations").select("display_name").eq("id", org).maybeSingle(),
    supabase.from("clinic_professionals").select("nome:display_name").eq("organization_id", org).eq("user_id", authz.user.id).maybeSingle(),
  ]);
  if (!versao.data || !contato.data) {
    return fail("validation_failed", t("Escolha um modelo de contrato ativo em Configurações › Modelos clínicos."), 422, { requestId });
  }
  const modelo = versao.data.clinic_modelos_documento as { nome: string } | { nome: string }[] | null;
  const nomeDoModelo = (Array.isArray(modelo) ? modelo[0]?.nome : modelo?.nome) ?? "Contrato";
  const titulo = `${nomeDoModelo} — Orçamento ${rotuloDoNumero(o)}`.slice(0, 160);
  const itens = (o.clinic_orcamento_itens ?? []).map((i) => i.descricao);
  const conteudo = renderizarContrato(
    versao.data.conteudo as string,
    {
      "paciente.nome": nomeDoContato(contato.data as { name: string | null; display_name: string | null; phone_number: string | null }),
      "clinica.nome": (empresa.data?.display_name as string | null) ?? null,
      "profissional.nome": (prof.data as { nome?: string | null } | null)?.nome ?? null,
      procedimento: itens.join("; ") || null,
      data: dataPorExtenso(new Date().toISOString()),
    },
    o,
  );

  const { data, error } = await supabase.rpc("fn_clinic_orcamento_enviar", {
    p_org: org,
    p_id: id,
    p_modelo_versao: versaoId,
    p_titulo: titulo,
    p_conteudo: conteudo,
  });
  if (error) {
    const e = erroDoOrcamento(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { id: string; documento_id: string; sha256: string };
  void audit({
    action: "clinic.orcamento_enviado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_orcamento",
    resourceId: id,
    requestId,
    metadata: { documento_id: r.documento_id, sha256: r.sha256, total_cents: o.total_cents },
  });
  return ok(r, { requestId });
}
