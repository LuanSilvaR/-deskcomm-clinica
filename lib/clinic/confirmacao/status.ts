import { MAX_TENTATIVAS_DO_LEMBRETE, type FalhaDoLembreteComReserva } from "@/lib/clinic/lembrete-com-reserva/regra";

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

/** #83: por que o lembrete com reserva não saiu (`calendar_appointments.reminder_falha`, migration 8023). */
export const ROTULO_DA_FALHA_COM_RESERVA: Record<FalhaDoLembreteComReserva, string> = {
  sem_caminho: "Lembrete não saiu: nenhum número conectado — ligar",
  fora_do_horario: "Lembrete aguardando o horário de envio",
  meta_sem_modelo: "Lembrete não saiu: janela fechada e sem modelo aprovado — ligar",
  erro_apos_tentativas: "Lembrete não saiu após 3 tentativas — ligar",
  envio_nao_confirmado: "Lembrete com envio não confirmado — conferir",
};

export function ehFalhaDoLembreteComReserva(v: unknown): v is FalhaDoLembreteComReserva {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(ROTULO_DA_FALHA_COM_RESERVA, v);
}

/** Rótulos neutros enquanto o cron ainda tenta de novo (chaves fixas para o dicionário em espanhol). */
export const ROTULO_TENTANDO_DE_NOVO: Record<number, string> = {
  1: "Lembrete não saiu — tentando de novo (1/3)",
  2: "Lembrete não saiu — tentando de novo (2/3)",
};

/**
 * O rótulo do selo: `erro_apos_tentativas` só pede ligação com as tentativas
 * esgotadas (ou sem a contagem); antes disso, é "tentando de novo".
 */
export function rotuloDaFalhaDoLembrete(motivo: FalhaDoLembreteComReserva, tentativas: number | null | undefined): string {
  if (motivo === "erro_apos_tentativas" && typeof tentativas === "number" && tentativas < MAX_TENTATIVAS_DO_LEMBRETE) {
    return ROTULO_TENTANDO_DE_NOVO[Math.max(1, tentativas)] ?? ROTULO_DA_FALHA_COM_RESERVA[motivo];
  }
  return ROTULO_DA_FALHA_COM_RESERVA[motivo];
}
