/**
 * FORK clinic (estoque E5) — de/para dos itens da NF-e com os produtos.
 *
 * Ordem de confiança (a primeira que casar vence):
 *   1. histórico — este fornecedor já mandou este código e alguém conferiu;
 *   2. EAN — o código de barras do item bate com o EAN configurado no estoque;
 *   3. nome — similaridade por palavras (≥ 60 %), só como sugestão.
 * Sem casamento, o item fica para a conferência escolher (a IA entra na E9).
 * Tudo aqui é SUGESTÃO: lançar exige conferir item a item.
 *
 * `casarItens` é puro (testável); `sugerirCasamentos` lê com o client da SESSÃO.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ItemDaNfe, NfeLida } from "./parser";

export type OrigemDoCasamento = "historico" | "ean" | "nome";

export interface Sugestao {
  product_id: string | null;
  origem_casamento: OrigemDoCasamento | null;
  fator: number | null;
  lote: string | null;
  validade: string | null;
}

export interface BaseDeCasamento {
  produtos: Array<{ id: string; nome: string }>;
  configs: Array<{ product_id: string; ean: string | null; fator_conversao: number }>;
  historico: Array<{ codigo: string; product_id: string; fator: number }>;
}

const SEM_ACENTO = /[̀-ͯ]/g;
const palavras = (s: string): Set<string> =>
  new Set(
    s
      .normalize("NFD")
      .replace(SEM_ACENTO, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 2),
  );

/** Jaccard das palavras (0..1). */
export function semelhanca(a: string, b: string): number {
  const pa = palavras(a);
  const pb = palavras(b);
  if (pa.size === 0 || pb.size === 0) return 0;
  let comum = 0;
  for (const p of pa) if (pb.has(p)) comum++;
  return comum / (pa.size + pb.size - comum);
}

export const LIMIAR_DO_NOME = 0.6;

export function casarItens(itens: readonly ItemDaNfe[], base: BaseDeCasamento): Sugestao[] {
  const fatorDoProduto = new Map(base.configs.map((c) => [c.product_id, Number(c.fator_conversao) || 1]));
  const porEan = new Map(base.configs.filter((c) => c.ean).map((c) => [c.ean!, c.product_id]));
  const porCodigo = new Map(base.historico.map((h) => [h.codigo, h]));
  const ativos = new Set(base.produtos.map((p) => p.id));

  return itens.map((item) => {
    const rastro = item.rastro.length === 1 ? item.rastro[0]! : null;
    const extra = { lote: rastro?.lote || null, validade: rastro?.validade ?? null };
    const h = porCodigo.get(item.codigo);
    if (h && ativos.has(h.product_id)) {
      return { product_id: h.product_id, origem_casamento: "historico", fator: Number(h.fator) || 1, ...extra };
    }
    const pEan = item.ean ? porEan.get(item.ean) : undefined;
    if (pEan && ativos.has(pEan)) {
      return { product_id: pEan, origem_casamento: "ean", fator: fatorDoProduto.get(pEan) ?? 1, ...extra };
    }
    let melhor: { id: string; nota: number } | null = null;
    for (const p of base.produtos) {
      const nota = semelhanca(item.descricao, p.nome);
      if (nota >= LIMIAR_DO_NOME && (!melhor || nota > melhor.nota)) melhor = { id: p.id, nota };
    }
    if (melhor) {
      return { product_id: melhor.id, origem_casamento: "nome", fator: fatorDoProduto.get(melhor.id) ?? 1, ...extra };
    }
    return { product_id: null, origem_casamento: null, fator: null, ...extra };
  });
}

export async function sugerirCasamentos(supabase: SupabaseClient, org: string, nfe: NfeLida): Promise<Sugestao[]> {
  const [produtos, configs, fornecedor] = await Promise.all([
    supabase.from("catalog_products").select("id, nome").eq("organization_id", org).eq("ativo", true).limit(5000),
    supabase.from("clinic_produto_estoque").select("product_id, ean, fator_conversao").eq("organization_id", org),
    nfe.emitente.cnpj
      ? supabase
          .from("clinic_estoque_fornecedores")
          .select("id")
          .eq("organization_id", org)
          .eq("cnpj", nfe.emitente.cnpj)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const fornecedorId = (fornecedor.data as { id: string } | null)?.id;
  const historico = fornecedorId
    ? (
        await supabase
          .from("clinic_estoque_fornecedor_produtos")
          .select("codigo, product_id, fator")
          .eq("organization_id", org)
          .eq("fornecedor_id", fornecedorId)
      ).data ?? []
    : [];
  return casarItens(nfe.itens, {
    produtos: (produtos.data ?? []) as BaseDeCasamento["produtos"],
    configs: (configs.data ?? []) as BaseDeCasamento["configs"],
    historico: historico as BaseDeCasamento["historico"],
  });
}
