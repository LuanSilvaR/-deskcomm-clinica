/**
 * SINCRONIZAR — a releitura da assinatura no provedor. FORK (card #160, parte
 * 160b; origem upstream `lib/cobranca/sincronizar.ts`, spec da cobrança §3.2, §7c).
 *
 * O ÚNICO lugar que grava `estado`, `vencida_desde`, `relida_em` e
 * `link_de_pagamento`. Regras (as do upstream):
 *   - o provedor é lido FORA de qualquer transação ou lock;
 *   - a leitura é gravada por compare-and-set em `updated_at`/`relida_em`: sinal
 *     e releitura manual podem correr juntos, e a leitura mais velha perde;
 *   - leitura que falha grava só `ultimo_erro`: o estado fica intacto.
 * O `service_role` ignora RLS: toda cadeia filtra `organization_id`, que vem do
 * evento ou da sessão — nunca de um corpo de requisição.
 *
 * ── O que fica de fora no 160b ──────────────────────────────────────────────
 * A RÉGUA (avisos, suspensão e reativação por cobrança, e-mails, itens da
 * Central) chega no 160c: aqui `aplicarRegua` não age (`"nada"`), e por isso
 * ninguém é suspenso por esta leitura. A troca de plano com ajuste proporcional
 * (upstream `troca.ts`) também não entrou.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { audit } from "@/lib/audit";
import type { AuditAction } from "@/lib/audit/actions";
import { aplicarLeitura } from "@/lib/cobranca/estado";
import { adaptador as adaptadorPadrao } from "@/lib/cobranca/provedores";
import {
  paraErroDeLeitura,
  ErroDoProvedor,
  type AdaptadorDeCobranca,
  type ProvedorDeCobranca,
  type Situacao,
} from "@/lib/cobranca/provedores/contrato";
import type { AvisoDaRegua, ErroDeLeitura, EstadoDaAssinatura } from "@/lib/cobranca/vocabulario";
import { logger } from "@/lib/logger";

/** O que a régua fez depois da leitura. No 160b ela ainda não age: sempre `"nada"`. */
export type AcaoDaRegua = "nada";

export interface DependenciasDaCobranca {
  adaptador?: (id: ProvedorDeCobranca) => AdaptadorDeCobranca;
  agora?: () => Date;
}

export type ResultadoDaSincronizacao =
  | { tipo: "isenta" }
  | { tipo: "sem_provedor"; acao: AcaoDaRegua }
  | { tipo: "aplicada"; estado: EstadoDaAssinatura; mudou: boolean; acao: AcaoDaRegua }
  | { tipo: "descartada" }
  | { tipo: "falhou"; erro: ErroDeLeitura; transitorio: boolean };

const COLUNAS =
  "organization_id, plano_id, plano_agendado_id, estado, trial_ate, provedor, provedor_cliente_id, provedor_assinatura_id, " +
  "vencida_desde, proximo_vencimento, cancela_no_fim, prazo_extra_ate, ultimo_aviso, ultimo_aviso_em, relida_em, " +
  "link_de_pagamento, assinaturas_vivas, checkout_url, checkout_expira_em, checkout_sessao_id, periodo_pago_desde, " +
  "plano_troca_pendente_id, troca_id, troca_status, troca_pagamento_ref, troca_reserva_ate, pagamento_inicial_pendente, updated_at";

interface Linha {
  checkout_url: string | null;
  checkout_expira_em: string | null;
  checkout_sessao_id: string | null;
  periodo_pago_desde: string | null;
  plano_troca_pendente_id: string | null;
  troca_id: string | null;
  troca_status: string | null;
  troca_pagamento_ref: string | null;
  /** Com a troca `aguardando_pagamento`: o fim do período em que o ajuste foi calculado. */
  troca_reserva_ate: string | null;
  pagamento_inicial_pendente: boolean;
  organization_id: string;
  plano_id: string;
  plano_agendado_id: string | null;
  estado: EstadoDaAssinatura;
  trial_ate: string | null;
  provedor: ProvedorDeCobranca | null;
  provedor_cliente_id: string | null;
  provedor_assinatura_id: string | null;
  vencida_desde: string | null;
  proximo_vencimento: string | null;
  cancela_no_fim: boolean;
  prazo_extra_ate: string | null;
  ultimo_aviso: AvisoDaRegua | null;
  ultimo_aviso_em: string | null;
  relida_em: string | null;
  link_de_pagamento: string | null;
  assinaturas_vivas: number;
  /** Carimbado pelo gatilho `fn_touch_updated_at` em TODA escrita: é a versão da linha. */
  updated_at: string;
}

const emData = (v: string | null) => (v === null ? null : new Date(v));
const emTexto = (d: Date | null) => (d === null ? null : d.toISOString());

async function lerLinha(admin: SupabaseClient, orgId: string): Promise<Linha | null> {
  const { data, error } = await admin.from("cobranca_assinaturas").select(COLUNAS).eq("organization_id", orgId).maybeSingle();
  if (error) throw new Error(`cobranca: leitura da assinatura falhou (${error.code ?? "sem_codigo"})`);
  return (data as Linha | null) ?? null;
}

function auditar(action: AuditAction, orgId: string, metadata: Record<string, unknown>): void {
  void audit({
    action,
    actorUserId: null,
    organizationId: orgId,
    bypassedRls: true,
    resourceType: "cobranca_assinatura",
    resourceId: orgId,
    metadata,
  });
}

export async function sincronizar(
  admin: SupabaseClient,
  orgId: string,
  deps: DependenciasDaCobranca = {},
): Promise<ResultadoDaSincronizacao> {
  const agora = deps.agora ?? (() => new Date());
  const primeira = await lerLinha(admin, orgId);
  if (!primeira) return { tipo: "isenta" };
  if (primeira.provedor === null || primeira.provedor_cliente_id === null) {
    return { tipo: "sem_provedor", acao: await aplicarRegua(admin, orgId, deps) };
  }
  const provedor = primeira.provedor;
  const cliente = primeira.provedor_cliente_id;

  // FORK (160b): a troca de plano com ajuste proporcional (upstream 0679/troca.ts)
  // ainda não entrou no fork; `troca_*` segue nulo e não há o que reler aqui.

  const lidoEm = agora();
  let situacao: Situacao;
  try {
    situacao = await (deps.adaptador ?? adaptadorPadrao)(provedor).lerSituacao({ clienteRef: cliente });
  } catch (e) {
    const erro = paraErroDeLeitura(e);
    const { error } = await admin
      .from("cobranca_assinaturas")
      .update({ ultimo_erro: erro, ultimo_erro_em: lidoEm.toISOString() })
      .eq("organization_id", orgId)
      .eq("provedor_cliente_id", cliente);
    logger.warn("cobranca.leitura_falhou", {
      organization_id: orgId,
      erro,
      status: e instanceof ErroDoProvedor ? e.status : null,
      codigo: e instanceof ErroDoProvedor ? e.codigo : "fora_do_adaptador",
      erro_gravado: !error,
    });
    return { tipo: "falhou", erro, transitorio: erro === "provedor_fora" };
  }

  // Concorrência otimista na linha INTEIRA: `updated_at` é a versão dela. Se
  // alguém gravou entre a leitura da linha e agora (troca de plano, publicação,
  // prazo, outra releitura), relê a linha e recalcula UMA vez — sem isso a
  // escrita, calculada sobre a linha velha, apagaria a do outro (o
  // `plano_agendado_id` recém-agendado, ou o "voltou ao teste" da publicação).
  // O provedor NÃO é relido: a leitura dele é o dado mais novo que existe.
  let linha: Linha | null = primeira;
  for (let tentativa = 1; ; tentativa += 1) {
    // Isentada, publicada ou com outro cliente no meio: esta leitura é de outra
    // conta ou de ninguém. Aplicá-la daria "ativa" a quem voltou ao teste.
    if (!linha || linha.provedor !== provedor || linha.provedor_cliente_id !== cliente) return { tipo: "descartada" };
    const r = aplicarLeitura(
      {
        estado: linha.estado,
        planoId: linha.plano_id,
        planoAgendadoId: linha.plano_agendado_id,
        trialAte: emData(linha.trial_ate),
        vencidaDesde: emData(linha.vencida_desde),
        proximoVencimento: emData(linha.proximo_vencimento),
        provedorAssinaturaId: linha.provedor_assinatura_id,
      },
      situacao,
      lidoEm,
    );
    const campos: Record<string, unknown> = {
      estado: r.estado,
      vencida_desde: emTexto(r.vencidaDesde),
      proximo_vencimento: emTexto(r.proximoVencimento),
      periodo_pago_desde: situacao.periodoPagoDesde?.toISOString() ?? null,
      cancela_no_fim: r.cancelaNoFim,
      provedor_assinatura_id: r.provedorAssinaturaId,
      assinaturas_vivas: r.assinaturasVivas,
      relida_em: lidoEm.toISOString(),
      ...(linha.pagamento_inicial_pendente && situacao.existe ? { pagamento_inicial_pendente: false } : {}),
      ultimo_erro: r.ultimoErro,
      ultimo_erro_em: r.ultimoErro === null ? null : lidoEm.toISOString(),
      link_de_pagamento: situacao.linkDePagamento,
      updated_at: lidoEm.toISOString(),
      // O plano só existe no nosso banco: a leitura o toca só quando o agendado virou.
      ...(r.planoAplicado ? { plano_id: r.planoId, plano_agendado_id: r.planoAgendadoId } : {}),
      // Assinatura morta: o agendado era dela. Sem gravar o descarte, ele viraria na renovação seguinte.
      ...(r.descartarAgendado ? { plano_agendado_id: null } : {}),
      ...(r.zerarAviso ? { ultimo_aviso: null, ultimo_aviso_em: null } : {}),
      // Reserva de checkout EM ANDAMENTO (sem link, prazo vivo) não é desta leitura: o
      // checkout a fecha na fase 3 por compare-and-set nela. No Asaas o cliente é gravado
      // ANTES de criar a assinatura, e o aviso dela pode chegar aqui no meio — limpar
      // agora dava "link de pagamento não gravado" (500 falso) a quem acabou de assinar.
      ...(r.limparCheckout && !reservaEmAndamento(linha, lidoEm)
        ? { checkout_url: null, checkout_expira_em: null, checkout_sessao_id: null }
        : {}),
    };
    // Duas guardas: a linha é a que foi lida (updated_at) e nenhuma leitura
    // mais NOVA já foi aplicada (relida_em) — sinal e cron correm juntos.
    const { data: aplicada, error } = await admin
      .from("cobranca_assinaturas")
      .update(campos)
      .eq("organization_id", orgId)
      .eq("updated_at", linha.updated_at)
      .or(`relida_em.is.null,relida_em.lt."${lidoEm.toISOString()}"`)
      .select("organization_id")
      .maybeSingle();
    if (error) throw new Error(`cobranca: gravação da leitura falhou (${error.code ?? "sem_codigo"})`);
    if (aplicada) {
      if (r.mudouEstado) {
        auditar("cobranca.estado_mudou", orgId, { de: linha.estado, para: r.estado, status_bruto: situacao.statusBruto });
      }
      if (r.planoAplicado) {
        auditar("cobranca.plano_trocado", orgId, { de: linha.plano_id, para: r.planoId, quando: "aplicado" });
      }
      // #2609: a releitura também CONFERE o preço — é a única hora em que o
      // provedor foi lido, então é aqui ou nunca.
      await conferirPreco(admin, orgId, {
        provedor,
        planoId: r.planoAgendadoId ?? r.planoId,
        precoDoProvedor: situacao.precoCents,
        assinaturaRef: situacao.assinaturaRef,
      });
      return { tipo: "aplicada", estado: r.estado, mudou: r.mudouEstado, acao: await aplicarRegua(admin, orgId, deps) };
    }
    if (tentativa === 2) return { tipo: "descartada" };
    linha = await lerLinha(admin, orgId);
  }
}

/**
 * #2609 — o preço da assinatura NO PROVEDOR contra o preço do PLANO gravado.
 * O alvo é o AGENDADO, senão o atual: é o mesmo que `troca.ts` leva ao provedor
 * (e que `reconciliar` usa para desfazer), então depois de uma troca os dois são
 * o mesmo número — divergir é drift, e drift é o que se quer ver.
 *
 * Só AUDITA: mexer no preço de quem já assinou a partir de um cron seria pior que
 * o defeito (uma edição do preço do PLANO depois da assinatura também aparece
 * aqui, e quem julga é quem administra). Os DOIS números vão no metadata, mais o
 * plano e a assinatura — a conferência nunca derruba a leitura que a originou.
 */
async function conferirPreco(
  admin: SupabaseClient,
  orgId: string,
  p: { provedor: ProvedorDeCobranca; planoId: string; precoDoProvedor: number | null; assinaturaRef: string | null },
): Promise<void> {
  if (p.precoDoProvedor === null) return;
  const { data, error } = await admin.from("cobranca_planos").select("preco_cents").eq("id", p.planoId).maybeSingle();
  if (error || !data) return;
  const precoDoPlano = (data as { preco_cents: number }).preco_cents;
  if (precoDoPlano === p.precoDoProvedor) return;
  auditar("cobranca.preco_divergente", orgId, {
    plano_id: p.planoId,
    preco_plano_cents: precoDoPlano,
    preco_provedor_cents: p.precoDoProvedor,
    provedor: p.provedor,
    assinatura_ref: p.assinaturaRef,
  });
}

/**
 * A RÉGUA ainda não age no fork (160c): sem aviso, sem suspensão, sem reativação.
 * Mantida como ponto único para o 160c preencher sem mexer em quem chama.
 */
export async function aplicarRegua(_admin: SupabaseClient, _orgId: string, _deps: DependenciasDaCobranca = {}): Promise<AcaoDaRegua> {
  return "nada";
}

function reservaEmAndamento(linha: Linha, agora: Date): boolean {
  return linha.checkout_url === null && linha.checkout_expira_em !== null && new Date(linha.checkout_expira_em).getTime() > agora.getTime();
}
