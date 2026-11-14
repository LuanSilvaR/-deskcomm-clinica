/**
 * FORK clinic (estoque E9) — a IA sugere o produto de itens da NF-e que o
 * de/para (histórico → EAN → nome) não casou.
 *
 * Ponto de IA `estoque_nfe_depara` (lib/ai/pontos/registro.ts): o modelo é o
 * que a clínica escolheu no painel de provedores (inclusive Groq, DeepSeek ou
 * OpenRouter); sem binding, o padrão da organização. Só vai para o modelo o
 * texto da NOTA (descrição, código, EAN, unidade) e o NOME dos produtos da
 * clínica — nada de paciente. A resposta é SUGESTÃO: só ids da lista enviada,
 * só com confiança alta, e a conferência humana continua obrigatória.
 * Falhou (sem chave, tempo, resposta fora do formato)? Os itens seguem sem
 * sugestão — a importação nunca trava por causa da IA.
 *
 * NASCE DESLIGADO: só roda quando a clínica escolheu um modelo para este ponto
 * no painel de IA (binding próprio) — nunca na chave da instalação por
 * padrão. Respeita o teto mensal de IA no modo "bloquear" e registra cada
 * chamada em `llm_calls` (purpose `estoque_nfe_depara`), para o gasto aparecer
 * no consumo e contar no orçamento.
 */
import { generateObject } from "ai";
import { z } from "zod";

import { costCents } from "@/lib/agent-engine/edge/llm/pricing";
import { getBudgetStatus } from "@/lib/ai/budget/check";
import { DEFAULT_CLASSIFIER_MODEL } from "@/lib/ai/gateway";
import { resolverModeloDoPonto } from "@/lib/ai/gateway-binding";
import { providerDoModelo } from "@/lib/ai/log-invocation";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const PONTO_DEPARA_NFE = "estoque_nfe_depara";
export const CONFIANCA_MINIMA = 0.6;
const LIMITE_DE_ITENS = 40;
const LIMITE_DE_PRODUTOS = 300;
const TEMPO_MAXIMO_MS = 15_000;

export interface ItemSemCasamento {
  numero: number;
  descricao: string;
  codigo: string;
  ean: string | null;
  unidade: string;
}

const respostaSchema = z.object({
  sugestoes: z
    .array(
      z.object({
        numero: z.number().int().describe("o número do item da nota"),
        product_id: z.string().nullable().describe("o id do produto da lista, ou null se nenhum serve"),
        confianca: z.number().min(0).max(1).describe("0 a 1: quão certo você está"),
      }),
    )
    .max(LIMITE_DE_ITENS),
});

const INSTRUCOES =
  "Você casa itens de uma nota fiscal de compra de uma clínica de estética com os produtos que a clínica já cadastrou. " +
  "Para cada item, devolva o id do produto da lista que é o MESMO produto (mesmo fabricante/princípio e apresentação), " +
  "ou null se nenhum é. Não invente ids: use só os da lista. Na dúvida, devolva null ou confiança baixa.";

/** Filtra a resposta do modelo: só ids conhecidos, só com confiança suficiente. Pura (testável). */
export function aceitarSugestoes(
  resposta: z.infer<typeof respostaSchema>,
  itens: readonly ItemSemCasamento[],
  produtos: ReadonlyArray<{ id: string }>,
): Map<number, string> {
  const validos = new Set(produtos.map((p) => p.id));
  const numeros = new Set(itens.map((i) => i.numero));
  const aceitas = new Map<number, string>();
  for (const s of resposta.sugestoes) {
    if (!numeros.has(s.numero) || !s.product_id || !validos.has(s.product_id)) continue;
    if (s.confianca < CONFIANCA_MINIMA) continue;
    aceitas.set(s.numero, s.product_id);
  }
  return aceitas;
}

/** Teto do mês atingido com a parada ligada? Pura (testável). */
export function orcamentoEsgotado(b: {
  enforcement_mode: string;
  monthly_limit_cents: number;
  current_month_consumed_cents: number;
}): boolean {
  return b.enforcement_mode === "bloquear" && b.monthly_limit_cents > 0 && b.current_month_consumed_cents >= b.monthly_limit_cents;
}

async function registrarChamada(
  organizationId: string,
  modelo: { modelId: string; provider: string },
  uso: { inputTokens?: number; outputTokens?: number } | undefined,
  inicio: number,
  status: "ok" | "erro",
): Promise<void> {
  const input = uso?.inputTokens ?? 0;
  const output = uso?.outputTokens ?? 0;
  const { error } = await createAdminClient().from("llm_calls").insert({
    organization_id: organizationId,
    purpose: PONTO_DEPARA_NFE,
    provider: modelo.provider,
    model: modelo.modelId,
    input_tokens: input,
    output_tokens: output,
    // null = preço desconhecido — nunca inventar 0
    cost_cents: costCents(modelo.modelId, { inputTokens: input, outputTokens: output, cacheReadTokens: 0, cacheWriteTokens: 0 }),
    latency_ms: Date.now() - inicio,
    status,
  });
  if (error) logger.warn("[estoque-nfe-ia] registro do uso falhou", { organization_id: organizationId, codigo: error.code });
}

export async function sugerirComIa(
  organizationId: string,
  itens: readonly ItemSemCasamento[],
  produtos: ReadonlyArray<{ id: string; nome: string }>,
): Promise<Map<number, string>> {
  if (itens.length === 0 || produtos.length === 0) return new Map();
  const lote = itens.slice(0, LIMITE_DE_ITENS);
  const catalogo = produtos.slice(0, LIMITE_DE_PRODUTOS);
  try {
    const resolvido = await resolverModeloDoPonto(PONTO_DEPARA_NFE, organizationId, DEFAULT_CLASSIFIER_MODEL);
    // Só com o modelo escolhido pela clínica para este ponto (opt-in).
    if (!resolvido || resolvido.origem !== "binding") return new Map();
    if (orcamentoEsgotado(await getBudgetStatus(organizationId))) return new Map();
    const modelo = {
      modelId: resolvido.modelId,
      provider:
        typeof resolvido.model === "object" && resolvido.model && "provider" in resolvido.model
          ? String(resolvido.model.provider).split(".")[0]!
          : providerDoModelo(resolvido.modelId),
    };
    const inicio = Date.now();
    try {
      const { object, usage } = await generateObject({
        model: resolvido.model,
        schema: respostaSchema,
        system: INSTRUCOES,
        prompt: JSON.stringify({
          produtos: catalogo.map((p) => ({ id: p.id, nome: p.nome })),
          itens: lote.map((i) => ({ numero: i.numero, descricao: i.descricao, codigo: i.codigo, ean: i.ean, unidade: i.unidade })),
        }),
        temperature: 0,
        maxOutputTokens: 1500,
        abortSignal: AbortSignal.timeout(TEMPO_MAXIMO_MS),
      });
      await registrarChamada(organizationId, modelo, usage, inicio, "ok");
      return aceitarSugestoes(object, lote, catalogo);
    } catch (e) {
      await registrarChamada(organizationId, modelo, undefined, inicio, "erro");
      throw e;
    }
  } catch (e) {
    // Só o tipo do erro: nada da nota nem do catálogo no log.
    logger.warn("[estoque-nfe-ia] sugestão por IA indisponível", {
      organization_id: organizationId,
      erro: e instanceof Error ? e.name : "desconhecido",
    });
    return new Map();
  }
}
