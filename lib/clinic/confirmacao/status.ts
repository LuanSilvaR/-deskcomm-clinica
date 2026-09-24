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

/** Por que o paciente não pôde responder (migration 9006). */
export const FALHAS_DO_LEMBRETE = ["envio_falhou", "nao_enviado"] as const;
export type FalhaDoLembrete = (typeof FALHAS_DO_LEMBRETE)[number];

export function ehFalhaDoLembrete(v: unknown): v is FalhaDoLembrete {
  return typeof v === "string" && (FALHAS_DO_LEMBRETE as readonly string[]).includes(v);
}

export const ROTULO_DA_FALHA: Record<FalhaDoLembrete, string> = {
  envio_falhou: "Lembrete não chegou — ligar",
  nao_enviado: "Lembrete não saiu — ligar",
};
