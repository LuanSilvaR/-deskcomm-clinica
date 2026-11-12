/**
 * O VOCABULÁRIO do aviso de agendamento no WhatsApp — espelho dos CHECKs de
 * `entregas_de_aviso_de_agendamento` (migration 0753).
 *
 * Tupla `as const` e não union solta, pelo mesmo motivo do aviso de caso
 * (`lib/escalacao/vocabulario-do-aviso.ts`): o invariante
 * `tests/invariants/vocabulario-banco-x-typescript.test.ts` compara valor a
 * valor com o CHECK. Um status só no CHECK vira linha que a tela não sabe
 * rotular; só aqui vira `23514` no UPDATE que o handler faz DEPOIS do envio.
 *
 * O código de ERRO não é redeclarado: é o MESMO de
 * `ERROS_DA_ENTREGA_DE_AVISO`, porque as causas são as mesmas (o mesmo canal,
 * o mesmo transporte, o mesmo anti-ban). Duas listas para o mesmo fato
 * divergiriam no primeiro código novo.
 */

export const STATUS_DA_ENTREGA_DE_AGENDAMENTO = [
  "pendente",
  "enviado",
  "falhou",
  "cancelado",
  /**
   * Chegou entre 22h e 7h no fuso da organização: não sai aviso individual, e
   * o agendamento entra no resumo das 7h.
   */
  "para_o_resumo",
  /** Já foi contado no resumo das 7h. */
  "no_resumo",
] as const;
export type StatusDaEntregaDeAgendamento = (typeof STATUS_DA_ENTREGA_DE_AGENDAMENTO)[number];

/** O que a linha de entrega representa: um aviso de evento ou o resumo do dia. */
export const TIPOS_DA_ENTREGA_DE_AGENDAMENTO = ["aviso", "resumo"] as const;
export type TipoDaEntregaDeAgendamento = (typeof TIPOS_DA_ENTREGA_DE_AGENDAMENTO)[number];

/** Para onde a entrega foi: o número do dono ou o grupo da equipe (migration 9060). */
export const ALVOS_DA_ENTREGA_DE_AGENDAMENTO = ["numero", "grupo"] as const;
export type AlvoDaEntregaDeAgendamento = (typeof ALVOS_DA_ENTREGA_DE_AGENDAMENTO)[number];

/** Os três eventos de `lib/agenda/laco.ts` que este aviso consome. */
/**
 * Os erros da entrega do aviso de agendamento — a `check` de
 * `entregas_de_aviso_de_agendamento.erro_codigo` (migration 8020). Fork #84: são
 * os do aviso de caso MAIS `canal_desativado` e `destino_da_propria_organizacao`,
 * que o aviso de caso do fork ainda não tem (ele é anterior ao do upstream). Lista
 * própria para o vocabulário banco × TypeScript bater com a tabela.
 */
export const ERROS_DA_ENTREGA_DE_AGENDAMENTO = [
  "canal_desconectado",
  "canal_arquivado",
  "canal_nao_aceita_aviso_livre",
  "canal_desativado",
  "transporte_ausente",
  "destino_invalido",
  "destino_da_propria_organizacao",
  "teto_diario_do_numero",
  "sem_endereco_publico",
  "titular_anonimizado",
  "expirou",
  "falha_no_envio",
  "indeterminado",
] as const;
export type ErroDaEntregaDeAgendamento = (typeof ERROS_DA_ENTREGA_DE_AGENDAMENTO)[number];

export const EVENTOS_DO_AVISO_DE_AGENDAMENTO = [
  "appointment.created",
  "appointment.rescheduled",
  "appointment.cancelled",
] as const;
export type EventoDoAvisoDeAgendamento = (typeof EVENTOS_DO_AVISO_DE_AGENDAMENTO)[number];

/** A frase de cada status, para a lista de entregas da tela. */
export const FRASE_DO_STATUS_DE_AGENDAMENTO = {
  pendente: "Aguardando envio",
  enviado: "Enviado",
  falhou: "Não saiu",
  cancelado: "Cancelado",
  para_o_resumo: "Vai no resumo das 7h",
  no_resumo: "Entrou no resumo das 7h",
} as const satisfies Record<StatusDaEntregaDeAgendamento, string>;
