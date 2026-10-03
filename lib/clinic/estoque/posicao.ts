/**
 * FORK clinic (estoque E0) — a posição de estoque: por produto, os lotes e o
 * saldo de cada lote em cada local. Saldo = soma dos movimentos (view
 * `clinic_estoque_saldos`); aqui só se agrupa o que o banco somou.
 *
 * `montarPosicao` é pura (testável); `lerPosicao` busca com o client da
 * SESSÃO — a RLS só devolve a quem tem `estoque.ver`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ConfigDoProduto {
  id: string;
  product_id: string;
  ean: string | null;
  ncm: string | null;
  registro_anvisa: string | null;
  unidade_estoque: string;
  unidade_aplicacao: string;
  fator_conversao: number;
  fracionavel: boolean;
  validade_pos_abertura_horas: number | null;
  rastreado: boolean;
  controlado: boolean;
  conselhos_permitidos: string[];
  estoque_minimo: number;
  ponto_pedido: number | null;
  gerenciado: boolean;
  versao: number;
}

export interface LocalDeEstoque {
  id: string;
  nome: string;
  tipo: string;
  resource_id: string | null;
  padrao: boolean;
  ativo: boolean;
}

interface ProdutoCru {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
}
interface LoteCru {
  id: string;
  product_id: string;
  codigo: string | null;
  validade: string | null;
  custo_unitario_cents: number | string | null;
}
interface SaldoCru {
  product_id: string;
  lote_id: string;
  local_id: string;
  saldo: number | string;
}

export interface LoteNaPosicao {
  lote_id: string;
  codigo: string | null;
  validade: string | null;
  vencido: boolean;
  custo_unitario_cents: number | null;
  saldo: number;
  por_local: Array<{ local_id: string; saldo: number }>;
}

export interface ProdutoNaPosicao {
  product_id: string;
  codigo: string;
  nome: string;
  config: ConfigDoProduto | null;
  saldo: number;
  abaixo_do_minimo: boolean;
  proxima_validade: string | null;
  lotes: LoteNaPosicao[];
}

const num = (v: number | string | null | undefined): number =>
  v === null || v === undefined ? 0 : Number(v);
const arred = (v: number): number => Math.round(v * 1000) / 1000;

export function montarPosicao(
  entrada: {
    produtos: ProdutoCru[];
    configs: ConfigDoProduto[];
    lotes: LoteCru[];
    saldos: SaldoCru[];
  },
  opcoes: { hoje: string; verCustos: boolean },
): ProdutoNaPosicao[] {
  const configDe = new Map(entrada.configs.map((c) => [c.product_id, c]));
  const lotesDe = new Map<string, LoteCru[]>();
  for (const l of entrada.lotes)
    lotesDe.set(l.product_id, [...(lotesDe.get(l.product_id) ?? []), l]);
  const saldosDoLote = new Map<string, SaldoCru[]>();
  for (const s of entrada.saldos)
    saldosDoLote.set(s.lote_id, [...(saldosDoLote.get(s.lote_id) ?? []), s]);

  return entrada.produtos
    .filter((p) => p.ativo || configDe.has(p.id))
    .map((p) => {
      const config = configDe.get(p.id) ?? null;
      const lotes: LoteNaPosicao[] = (lotesDe.get(p.id) ?? [])
        .map((l) => {
          const porLocal = (saldosDoLote.get(l.id) ?? [])
            .map((s) => ({ local_id: s.local_id, saldo: arred(num(s.saldo)) }))
            .filter((s) => s.saldo !== 0);
          return {
            lote_id: l.id,
            codigo: l.codigo,
            validade: l.validade,
            vencido: !!l.validade && l.validade < opcoes.hoje,
            custo_unitario_cents:
              opcoes.verCustos && l.custo_unitario_cents !== null
                ? num(l.custo_unitario_cents)
                : null,
            saldo: arred(porLocal.reduce((t, s) => t + s.saldo, 0)),
            por_local: porLocal,
          };
        })
        .filter((l) => l.saldo !== 0)
        // FEFO: o que vence primeiro aparece primeiro; sem validade por último.
        .sort((a, b) => (a.validade ?? "9999-12-31").localeCompare(b.validade ?? "9999-12-31"));
      const saldo = arred(lotes.reduce((t, l) => t + l.saldo, 0));
      return {
        product_id: p.id,
        codigo: p.codigo,
        nome: p.nome,
        config,
        saldo,
        abaixo_do_minimo: !!config && config.estoque_minimo > 0 && saldo < config.estoque_minimo,
        proxima_validade: lotes.find((l) => l.validade && !l.vencido)?.validade ?? null,
        lotes,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export const COLUNAS_DA_CONFIG =
  "id, product_id, ean, ncm, registro_anvisa, unidade_estoque, unidade_aplicacao, fator_conversao, fracionavel, " +
  "validade_pos_abertura_horas, rastreado, controlado, conselhos_permitidos, estoque_minimo, ponto_pedido, gerenciado, versao";

export function paraConfig(c: Record<string, unknown>): ConfigDoProduto {
  return {
    ...(c as unknown as ConfigDoProduto),
    fator_conversao: num(c.fator_conversao as number | string),
    estoque_minimo: num(c.estoque_minimo as number | string),
    ponto_pedido:
      c.ponto_pedido === null || c.ponto_pedido === undefined
        ? null
        : num(c.ponto_pedido as number | string),
  };
}

export async function lerPosicao(
  supabase: SupabaseClient,
  org: string,
  opcoes: { hoje: string; verCustos: boolean; productId?: string },
): Promise<{ locais: LocalDeEstoque[]; produtos: ProdutoNaPosicao[] }> {
  const pid = opcoes.productId;
  let produtosQ = supabase
    .from("catalog_products")
    .select("id, codigo, nome, ativo")
    .eq("organization_id", org);
  let configsQ = supabase
    .from("clinic_produto_estoque")
    .select(COLUNAS_DA_CONFIG)
    .eq("organization_id", org);
  let lotesQ = supabase
    .from("clinic_estoque_lotes")
    .select("id, product_id, codigo, validade, custo_unitario_cents")
    .eq("organization_id", org);
  let saldosQ = supabase
    .from("clinic_estoque_saldos")
    .select("product_id, lote_id, local_id, saldo")
    .eq("organization_id", org);
  if (pid) {
    produtosQ = produtosQ.eq("id", pid);
    configsQ = configsQ.eq("product_id", pid);
    lotesQ = lotesQ.eq("product_id", pid);
    saldosQ = saldosQ.eq("product_id", pid);
  }
  const [locais, produtos, configs, lotes, saldos] = await Promise.all([
    supabase
      .from("clinic_estoque_locais")
      .select("id, nome, tipo, resource_id, padrao, ativo")
      .eq("organization_id", org)
      .order("padrao", { ascending: false })
      .order("nome", { ascending: true }),
    produtosQ.order("nome", { ascending: true }).limit(2000),
    configsQ,
    lotesQ,
    saldosQ,
  ]);
  const erro = locais.error ?? produtos.error ?? configs.error ?? lotes.error ?? saldos.error;
  if (erro) throw new Error(erro.message);
  return {
    locais: (locais.data ?? []) as LocalDeEstoque[],
    produtos: montarPosicao(
      {
        produtos: (produtos.data ?? []) as ProdutoCru[],
        configs: ((configs.data ?? []) as unknown as Record<string, unknown>[]).map(paraConfig),
        lotes: (lotes.data ?? []) as LoteCru[],
        saldos: (saldos.data ?? []) as SaldoCru[],
      },
      opcoes,
    ),
  };
}
