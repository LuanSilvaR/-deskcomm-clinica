"use client";

/**
 * A resposta do paciente ao pedido de confirmação (migration 9004), num selo.
 * Sem pedido (confirmação desligada ou lembrete ainda não saiu), não aparece.
 */
import { useT } from "@/hooks/i18n/useT";
import {
  ehFalhaDoLembrete,
  ehFalhaDoLembreteComReserva,
  ehStatusDaConfirmacao,
  ROTULO_DA_CONFIRMACAO,
  ROTULO_DA_FALHA,
  rotuloDaFalhaDoLembrete,
  type StatusDaConfirmacao,
} from "@/lib/clinic/confirmacao/status";
import { MAX_TENTATIVAS_DO_LEMBRETE } from "@/lib/clinic/lembrete-com-reserva/regra";

const COR: Record<StatusDaConfirmacao, string> = {
  aguardando: "bg-muted text-text-muted",
  confirmado: "bg-success/15 text-success",
  recusado: "bg-error/15 text-error",
  sem_resposta: "bg-warning/15 text-warning",
};

export function SeloDaConfirmacao({
  status,
  falha,
  falhaDoLembrete,
  tentativasDoLembrete,
}: {
  status: string | null | undefined;
  /** 9006: o lembrete não chegou ou nem saiu — o rótulo diz por que ligar. */
  falha?: string | null;
  /** #83: motivo do lembrete com reserva. Só aparece quando NÃO há pedido de confirmação (um aviso só). */
  falhaDoLembrete?: string | null;
  /** #83: tentativas já gastas (`reminder_tentativas`); decide entre "tentando de novo" e "ligar". */
  tentativasDoLembrete?: number | null;
}) {
  const t = useT();
  if (!ehStatusDaConfirmacao(status)) {
    if (!ehFalhaDoLembreteComReserva(falhaDoLembrete)) return null;
    const tentandoDeNovo =
      falhaDoLembrete === "erro_apos_tentativas" &&
      typeof tentativasDoLembrete === "number" &&
      tentativasDoLembrete < MAX_TENTATIVAS_DO_LEMBRETE;
    const cor =
      falhaDoLembrete === "fora_do_horario" || tentandoDeNovo ? "bg-muted text-text-muted" : "bg-warning/15 text-warning";
    return (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${cor}`}
        data-testid="selo-da-confirmacao"
        data-falha-do-lembrete={falhaDoLembrete}
      >
        {t(rotuloDaFalhaDoLembrete(falhaDoLembrete, tentativasDoLembrete))}
      </span>
    );
  }
  const rotulo = status === "sem_resposta" && ehFalhaDoLembrete(falha) ? ROTULO_DA_FALHA[falha] : ROTULO_DA_CONFIRMACAO[status];
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${COR[status]}`}
      data-testid="selo-da-confirmacao"
      data-status={status}
      data-falha={falha ?? undefined}
    >
      {t(rotulo)}
    </span>
  );
}
