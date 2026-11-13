/**
 * PATCH /api/v1/admin/cobranca/planos/[id] — FORK (card #159; origem upstream,
 * spec da cobrança §2.2): editar, marcar como plano do cadastro, arquivar e
 * desarquivar.
 *
 * Preço e intervalo NÃO mudam enquanto houver assinatura apontando para o plano
 * (em `plano_id` ou `plano_agendado_id`): 409 `plano_com_assinantes`, "arquive e
 * crie outro". Nome, limites, dias de teste e o padrão do cadastro mudam sempre.
 * `arquivado: true` grava `arquivado_em`: o plano sai do cadastro e quem já
 * assina segue nele. Dois planos do cadastro → 409 `state_conflict`. Toda
 * mudança é auditada (`cobranca.plano_salvo` / `cobranca.plano_arquivado`).
 */
import { type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { guardaDaCobranca } from "@/lib/cobranca/guarda";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { COLUNAS_DO_PLANO, edicaoDoPlanoSchema } from "@/lib/schemas/cobranca-plano";

interface PlanoAtual {
  id: string;
  preco_cents: number;
  intervalo: string;
  arquivado_em: string | null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const g = await guardaDaCobranca(requestId, true);
  if (!g.ok) return g.resposta;

  const { id } = await params;
  // O id entra no filtro `.or()` abaixo como TEXTO: só uuid passa daqui.
  if (!z.string().uuid().safeParse(id).success) {
    return fail("not_found", "Plano não encontrado", 404, { requestId });
  }

  const corpo = edicaoDoPlanoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", "Edição de plano inválida", 400, { requestId, details: corpo.error.flatten() });
  }

  const { data: lido, error: erroDeLeitura } = await g.admin
    .from("cobranca_planos")
    .select("id, preco_cents, intervalo, arquivado_em")
    .eq("id", id)
    .maybeSingle();
  if (erroDeLeitura) return fail("internal_error", "Não foi possível ler o plano", 500, { requestId });
  const atual = lido as PlanoAtual | null;
  if (!atual) return fail("not_found", "Plano não encontrado", 404, { requestId });

  const { arquivado, ...campos } = corpo.data;
  const mudaACobranca =
    (campos.preco_cents !== undefined && campos.preco_cents !== Number(atual.preco_cents)) ||
    (campos.intervalo !== undefined && campos.intervalo !== atual.intervalo);
  if (mudaACobranca) {
    const { count, error } = await g.admin
      .from("cobranca_assinaturas")
      .select("organization_id", { count: "exact", head: true })
      .or(`plano_id.eq.${id},plano_agendado_id.eq.${id}`);
    if (error) return fail("internal_error", "Não foi possível conferir os assinantes", 500, { requestId });
    if ((count ?? 0) > 0) {
      return fail(
        "plano_com_assinantes",
        "Este plano tem assinantes: o preço e o intervalo não mudam mais. Arquive-o e crie outro.",
        409,
        { requestId, details: { assinantes: count } },
      );
    }
  }

  const agora = new Date().toISOString();
  const arquivadoEm =
    arquivado === undefined ? {} : { arquivado_em: arquivado ? (atual.arquivado_em ?? agora) : null };
  // Arquivar tira o plano do cadastro: um arquivado não pode seguir como padrão.
  const semPadrao = arquivado === true ? { padrao_no_cadastro: false } : {};
  const { data: plano, error } = await g.admin
    .from("cobranca_planos")
    .update({ ...campos, ...arquivadoEm, ...semPadrao, updated_at: agora, updated_by: g.ctx.user.id })
    .eq("id", id)
    .select(COLUNAS_DO_PLANO)
    .single();
  if (error?.code === "23505") {
    return fail("state_conflict", "Já existe um plano do cadastro. Desmarque o outro antes.", 409, { requestId });
  }
  if (error || !plano) return fail("internal_error", "Não foi possível salvar o plano", 500, { requestId });

  const arquivou = arquivado === true && atual.arquivado_em === null;
  await audit({
    action: arquivou ? "cobranca.plano_arquivado" : "cobranca.plano_salvo",
    actorUserId: g.ctx.user.id,
    actingAsPlatformAdmin: true,
    bypassedRls: true,
    resourceType: "cobranca_plano",
    resourceId: id,
    requestId,
    metadata: { ...corpo.data, antes: { preco_cents: atual.preco_cents, intervalo: atual.intervalo } },
  });
  return ok(plano, { requestId });
}
