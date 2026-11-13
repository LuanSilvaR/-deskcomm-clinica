/**
 * FORK (card #159, migration 8026; origem upstream `lib/cobranca/vocabulario.ts`,
 * migrations 0583/0679) — o VOCABULÁRIO DA COBRANÇA DA PLATAFORMA: o lado
 * TypeScript dos CHECKs de `cobranca_planos` e `cobranca_assinaturas`. Valor
 * novo entra no CHECK (migration + apêndice do baseline) e aqui, no MESMO commit.
 *
 * Card #160a: os erros de leitura do provedor e os avisos da régua (estes
 * passam a ser usados no 160c).
 */

export const ESTADOS_DA_ASSINATURA = ["trial", "ativa", "em_atraso", "cancelada"] as const;
export type EstadoDaAssinatura = (typeof ESTADOS_DA_ASSINATURA)[number];

export const PROVEDORES_DE_COBRANCA = ["stripe", "asaas"] as const;
export type ProvedorDeCobranca = (typeof PROVEDORES_DE_COBRANCA)[number];

export const MODOS = ["teste", "producao"] as const;
export type Modo = (typeof MODOS)[number];

export const INTERVALOS = ["mes", "ano"] as const;
export type Intervalo = (typeof INTERVALOS)[number];

/** O Asaas não tem moeda e o boleto da Stripe é só BRL. Alargar = alargar o CHECK. */
export const MOEDAS = ["BRL"] as const;
export type Moeda = (typeof MOEDAS)[number];

export const AVISOS_DA_REGUA = ["trial_acabando", "venceu", "suspende_em_breve", "suspensa"] as const;
export type AvisoDaRegua = (typeof AVISOS_DA_REGUA)[number];

export const ERROS_DE_LEITURA = [
  "credencial_invalida",
  "provedor_fora",
  "pagamento_de_assinatura_cancelada",
  "leitura_invalida",
] as const;
export type ErroDeLeitura = (typeof ERROS_DE_LEITURA)[number];

/**
 * O RECURSO DO PLANO: onde o teto é guardado (`cobranca_planos.<coluna>`), o
 * piso do CHECK e como o admin o chama. Fonte única do eixo: o schema zod e a
 * tela saem daqui. Os limites passam a VALER (bloquear) no card #162.
 */
export interface DeclaracaoDeRecurso {
  readonly coluna: string;
  readonly minimo: number;
  readonly rotulo: string;
}

export const RECURSOS = {
  assentos: { coluna: "max_assentos", minimo: 1, rotulo: "Pessoas" },
  canais: { coluna: "max_canais", minimo: 1, rotulo: "Números conectados" },
  ia_usd_cents: { coluna: "teto_ia_usd_cents", minimo: 100, rotulo: "IA" },
} as const satisfies Record<string, DeclaracaoDeRecurso>;

export type RecursoDoPlano = keyof typeof RECURSOS;

export const RECURSOS_DO_PLANO = Object.keys(RECURSOS) as readonly RecursoDoPlano[];
