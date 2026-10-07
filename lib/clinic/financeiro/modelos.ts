/**
 * FORK clinic (financeiro FN1) — tabelas de REFERÊNCIA de adquirentes.
 *
 * Ponto de partida para a gestora não digitar do zero. São valores públicos de
 * referência (2026) e NUNCA valem sozinhos: a tela mostra "ajuste ao seu
 * contrato" e só grava o que a gestora salvar. Onde a fonte não traz uma faixa
 * (ex.: Cielo 4x–5x), a linha não existe — o simulador avisa que falta.
 */
import type { Adquirente, LinhaDeTaxa } from "./taxas";

export interface ModeloDeAdquirente {
  chave: "ton" | "cielo_smart" | "mercado_pago";
  nome: string;
  observacao: string;
  adquirente: Omit<Adquirente, "id" | "nome">;
  linhas: LinhaDeTaxa[];
}

const linha = (modalidade: LinhaDeTaxa["modalidade"], de: number, ate: number, mdr: number): LinhaDeTaxa => ({
  bandeira: null,
  modalidade,
  parcelas_de: de,
  parcelas_ate: ate,
  mdr_pct: mdr,
});

export const MODELOS_DE_ADQUIRENTE: readonly ModeloDeAdquirente[] = [
  {
    chave: "ton",
    nome: "Ton",
    observacao: "Plano para novos clientes. Ajuste ao seu contrato.",
    adquirente: {
      prazo_pix_dias: 0,
      prazo_debito_dias: 1,
      prazo_credito_dias: 1,
      tarifa_fixa_cents: 0,
      antecipacao_pct: 0,
      antecipacao_modo: "por_mes",
    },
    linhas: [
      linha("debito", 1, 1, 0.57),
      linha("credito", 1, 1, 0.57),
      linha("credito", 2, 3, 3.97),
      linha("credito", 4, 4, 4.97),
      linha("credito", 5, 5, 5.97),
      linha("credito", 6, 6, 6.97),
      linha("credito", 7, 12, 7.97),
      linha("credito", 13, 21, 14.87),
    ],
  },
  {
    chave: "cielo_smart",
    nome: "Cielo Smart",
    observacao: "Faturamento até R$ 15 mil/mês, sem aluguel. Pix 0,99% após 30 dias. Ajuste ao seu contrato.",
    adquirente: {
      prazo_pix_dias: 0,
      prazo_debito_dias: 1,
      prazo_credito_dias: 30,
      tarifa_fixa_cents: 0,
      antecipacao_pct: 0,
      antecipacao_modo: "por_mes",
    },
    linhas: [
      linha("pix", 1, 1, 0.99),
      linha("debito", 1, 1, 1.9),
      linha("credito", 1, 1, 4.3),
      linha("credito", 2, 2, 6.5),
      linha("credito", 3, 3, 7.7),
      linha("credito", 6, 6, 11.3),
      linha("credito", 12, 12, 19),
    ],
  },
  {
    chave: "mercado_pago",
    nome: "Mercado Pago Point Smart 2",
    observacao:
      "Referência: 2x de 6,29% a 9,90% e 18x de 19,39% a 29,12%, conforme o plano. Aqui vai o menor valor; ajuste ao seu contrato.",
    adquirente: {
      prazo_pix_dias: 0,
      prazo_debito_dias: 1,
      prazo_credito_dias: 30,
      tarifa_fixa_cents: 0,
      antecipacao_pct: 0,
      antecipacao_modo: "por_mes",
    },
    linhas: [linha("credito", 2, 2, 6.29), linha("credito", 18, 18, 19.39)],
  },
];
