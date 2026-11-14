/**
 * FORK clinic (estoque E9) — a IA consulta o estoque da clínica.
 *
 * Só LEITURA e só o que é do produto: saldo, reservado, disponível, próxima
 * validade e alertas abertos. Nada de paciente, atendimento, profissional ou
 * custo — as colunas do movimento que ligam ao paciente nem são lidas.
 *
 * Service role bypassa RLS: TODA query filtra `organization_id`, e a fonte é
 * sempre `ctx.organizationId` (token/cookie), NUNCA o input. Com o módulo de
 * estoque desligado na clínica, a tool responde que não há estoque — não lê.
 * O papel mínimo (`agent`) é o mesmo nível base de `estoque.ver`.
 */
import { z } from "zod";

import type { McpToolDefinition } from "../types";
import { estoqueLigado } from "@/lib/clinic/flags";

const LIMITE_DE_PRODUTOS = 10;

const consultarInputShape = {
  busca: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .describe("Nome ou código do produto, do jeito que a pessoa escreveu (ex.: 'toxina', 'luva M')."),
};

interface ProdutoCru {
  id: string;
  codigo: string;
  nome: string;
}
interface ConfigCru {
  product_id: string;
  unidade_aplicacao: string;
  estoque_minimo: number | string;
  ponto_pedido: number | string | null;
}
interface SaldoCru {
  product_id: string;
  lote_id: string;
  saldo: number | string;
}
interface LoteCru {
  id: string;
  validade: string | null;
}
interface ReservaCru {
  product_id: string;
  quantidade: number | string;
}
interface AlertaCru {
  product_id: string | null;
  tipo: string;
}

export interface ProdutoNoEstoque {
  nome: string;
  codigo: string;
  unidade: string;
  saldo: number;
  reservado: number;
  disponivel: number;
  estoque_minimo: number;
  ponto_pedido: number | null;
  proxima_validade: string | null;
  quantidade_vencida: number;
  alertas: string[];
}

const num = (v: number | string | null | undefined) => (v === null || v === undefined ? 0 : Number(v));
const arred = (n: number) => Math.round(n * 1000) / 1000;

/** Tira os curingas do `ilike` e os separadores do filtro `or` do PostgREST. */
export function limparBusca(busca: string): string {
  return busca.replace(/[%_,()\\*]/g, " ").replace(/\s+/g, " ").trim();
}

/** Monta o resumo por produto. Pura (testável). */
export function resumirEstoque(
  dados: {
    produtos: ProdutoCru[];
    configs: ConfigCru[];
    saldos: SaldoCru[];
    lotes: LoteCru[];
    reservas: ReservaCru[];
    alertas: AlertaCru[];
  },
  hoje: string,
): ProdutoNoEstoque[] {
  const validade = new Map(dados.lotes.map((l) => [l.id, l.validade]));
  return dados.produtos.flatMap((p) => {
    const cfg = dados.configs.find((c) => c.product_id === p.id);
    if (!cfg) return [];
    let saldo = 0;
    let vencida = 0;
    let proxima: string | null = null;
    for (const s of dados.saldos.filter((x) => x.product_id === p.id)) {
      const q = num(s.saldo);
      saldo += q;
      const v = validade.get(s.lote_id) ?? null;
      if (v && v < hoje) vencida += q;
      else if (v && q > 0 && (proxima === null || v < proxima)) proxima = v;
    }
    const reservado = dados.reservas.filter((r) => r.product_id === p.id).reduce((a, r) => a + num(r.quantidade), 0);
    return [
      {
        nome: p.nome,
        codigo: p.codigo,
        unidade: cfg.unidade_aplicacao,
        saldo: arred(saldo),
        reservado: arred(reservado),
        // o vencido não serve para atender: fica fora do disponível
        disponivel: arred(Math.max(0, saldo - vencida - reservado)),
        estoque_minimo: num(cfg.estoque_minimo),
        ponto_pedido: cfg.ponto_pedido === null ? null : num(cfg.ponto_pedido),
        proxima_validade: proxima,
        quantidade_vencida: arred(vencida),
        alertas: [...new Set(dados.alertas.filter((a) => a.product_id === p.id).map((a) => a.tipo))].sort(),
      },
    ];
  });
}

export const crmConsultarEstoque: McpToolDefinition<typeof consultarInputShape> = {
  name: "crm_estoque_consultar",
  description:
    "Consulta o ESTOQUE da clínica por nome ou código do produto e devolve, por produto: saldo, " +
    "quanto já está reservado para atendimentos, quanto está disponível, a próxima validade, o que " +
    "está vencido e os alertas abertos (abaixo do mínimo, ponto de pedido, validade). Use para " +
    "responder à equipe se há material para um procedimento ou se é hora de comprar. " +
    "Não traz paciente nem custo. Se a clínica não usa o controle de estoque, a resposta diz isso — " +
    "não invente quantidade.",
  inputSchema: consultarInputShape,
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (input, ctx) => {
    const org = ctx.organizationId;
    const { data: organizacao, error: erroOrg } = await ctx.supabase
      .from("organizations")
      .select("settings")
      .eq("id", org)
      .maybeSingle();
    if (erroOrg) throw new Error(erroOrg.message);
    if (!estoqueLigado(organizacao?.settings)) {
      return { estoque_ligado: false, produtos: [], aviso: "A clínica não usa o controle de estoque." };
    }
    const termo = limparBusca(input.busca);
    if (termo.length < 2) return { estoque_ligado: true, produtos: [] };

    const { data: achados, error: erroProd } = await ctx.supabase
      .from("catalog_products")
      .select("id, codigo, nome")
      .eq("organization_id", org)
      .or(`nome.ilike.%${termo}%,codigo.ilike.%${termo}%`)
      .order("nome", { ascending: true })
      .limit(LIMITE_DE_PRODUTOS * 3);
    if (erroProd) throw new Error(erroProd.message);
    const candidatos = (achados ?? []) as ProdutoCru[];
    if (candidatos.length === 0) return { estoque_ligado: true, produtos: [] };
    const ids = candidatos.map((p) => p.id);

    const [configs, saldos, reservas, alertas] = await Promise.all([
      ctx.supabase
        .from("clinic_produto_estoque")
        .select("product_id, unidade_aplicacao, estoque_minimo, ponto_pedido")
        .eq("organization_id", org)
        .in("product_id", ids),
      ctx.supabase
        .from("clinic_estoque_saldos")
        .select("product_id, lote_id, saldo")
        .eq("organization_id", org)
        .in("product_id", ids),
      ctx.supabase
        .from("clinic_estoque_reservas")
        .select("product_id, quantidade")
        .eq("organization_id", org)
        .eq("status", "ativa")
        .in("product_id", ids),
      ctx.supabase
        .from("clinic_estoque_alertas")
        .select("product_id, tipo")
        .eq("organization_id", org)
        .eq("status", "aberto")
        .in("product_id", ids),
    ]);
    const erro = configs.error ?? saldos.error ?? reservas.error ?? alertas.error;
    if (erro) throw new Error(erro.message);
    const loteIds = [...new Set(((saldos.data ?? []) as SaldoCru[]).map((s) => s.lote_id))];
    const lotes = loteIds.length
      ? await ctx.supabase.from("clinic_estoque_lotes").select("id, validade").eq("organization_id", org).in("id", loteIds)
      : { data: [], error: null };
    if (lotes.error) throw new Error(lotes.error.message);

    const produtos = resumirEstoque(
      {
        produtos: candidatos,
        configs: (configs.data ?? []) as ConfigCru[],
        saldos: (saldos.data ?? []) as SaldoCru[],
        lotes: (lotes.data ?? []) as LoteCru[],
        reservas: (reservas.data ?? []) as ReservaCru[],
        alertas: (alertas.data ?? []) as AlertaCru[],
      },
      new Date().toISOString().slice(0, 10),
    ).slice(0, LIMITE_DE_PRODUTOS);
    return { estoque_ligado: true, produtos };
  },
};
