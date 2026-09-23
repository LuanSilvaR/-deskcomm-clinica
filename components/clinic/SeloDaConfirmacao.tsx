"use client";

/**
 * A resposta do paciente ao pedido de confirmação (migration 9004), num selo.
 * Sem pedido (confirmação desligada ou lembrete ainda não saiu), não aparece.
 */
import { useT } from "@/hooks/i18n/useT";
import { ehStatusDaConfirmacao, ROTULO_DA_CONFIRMACAO, type StatusDaConfirmacao } from "@/lib/clinic/confirmacao/status";

const COR: Record<StatusDaConfirmacao, string> = {
  aguardando: "bg-muted text-text-muted",
  confirmado: "bg-success/15 text-success",
  recusado: "bg-error/15 text-error",
  sem_resposta: "bg-warning/15 text-warning",
};

export function SeloDaConfirmacao({ status }: { status: string | null | undefined }) {
  const t = useT();
  if (!ehStatusDaConfirmacao(status)) return null;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${COR[status]}`}
      data-testid="selo-da-confirmacao"
      data-status={status}
    >
      {t(ROTULO_DA_CONFIRMACAO[status])}
    </span>
  );
}
