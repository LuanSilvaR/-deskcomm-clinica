/**
 * O vocabulário da confirmação de consulta (migration 9004) — espelha o CHECK
 * de `clinic_confirmation_requests.status`. Puro: serve tela e servidor.
 */
export const STATUS_DA_CONFIRMACAO = ["aguardando", "confirmado", "recusado", "sem_resposta"] as const;
export type StatusDaConfirmacao = (typeof STATUS_DA_CONFIRMACAO)[number];

export function ehStatusDaConfirmacao(v: unknown): v is StatusDaConfirmacao {
  return typeof v === "string" && (STATUS_DA_CONFIRMACAO as readonly string[]).includes(v);
}

/** Rótulos em português; a tela passa por `t()` (espanhol em lib/i18n/dicionario.ts). */
export const ROTULO_DA_CONFIRMACAO: Record<StatusDaConfirmacao, string> = {
  aguardando: "Confirmação pedida",
  confirmado: "Paciente confirmou",
  recusado: "Pediu para remarcar",
  sem_resposta: "Sem resposta — ligar",
};
