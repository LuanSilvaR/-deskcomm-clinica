/**
 * FORK clinic (estoque E0) — a forma do GET /api/v1/clinic/estoque/posicao.
 */
import type { FrascoAberto, LocalDeEstoque, ProdutoNaPosicao } from "@/lib/clinic/estoque/posicao";

export interface DadosDoEstoque {
  ligado: boolean;
  locais: LocalDeEstoque[];
  produtos: ProdutoNaPosicao[];
  /** Frascos abertos (estoque E4). */
  frascos?: FrascoAberto[];
  pode: {
    movimentar: boolean;
    inventariar: boolean;
    configurar: boolean;
    estornar: boolean;
    custos: boolean;
  };
}

export const CHAVE_DO_ESTOQUE = ["clinic", "estoque", "posicao"] as const;

export const ROTULO_DO_TIPO_DE_LOCAL: Record<string, string> = {
  central: "Estoque central",
  sala: "Sala",
  carrinho: "Carrinho",
  farmacia: "Farmácia",
  outro: "Outro",
};

export const ROTULO_DA_OPERACAO: Record<string, string> = {
  entrada: "Entrada",
  consumo: "Consumo no atendimento",
  transferencia: "Transferência",
  perda: "Perda",
  ajuste: "Ajuste",
  inventario: "Inventário",
  abertura_frasco: "Abertura de frasco",
  estorno: "Estorno",
};

/** 1234.5 → "1.234,5" (pt-BR) / conforme o idioma da tela. */
export function quantidade(v: number, tag: string): string {
  return v.toLocaleString(tag, { maximumFractionDigits: 3 });
}
