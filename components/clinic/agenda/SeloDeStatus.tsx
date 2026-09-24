"use client";

/**
 * O selo do status de exibição (Agenda do dia) — cor + ícone + texto, nunca só
 * cor (WCAG 1.4.1). Os tons são os tokens semânticos do tema, que já têm
 * contraste medido nos dois modos.
 */
import type { Icon } from "@phosphor-icons/react";

import { useT } from "@/hooks/i18n/useT";
import { ROTULO_DE_EXIBICAO, type StatusDeExibicao } from "@/lib/clinic/visitas/exibicao";
import { Bell, CalendarBlank, CheckCircle, DoorOpen, Stethoscope, UserMinus, XCircle } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const ESTILO: Record<StatusDeExibicao, { classe: string; Icone: Icon }> = {
  agendado: { classe: "border-transparent bg-info-bg text-info-fg", Icone: CalendarBlank },
  na_recepcao: { classe: "border-transparent bg-warning-bg text-warning-fg", Icone: DoorOpen },
  pronto: { classe: "border-warning bg-warning-bg text-warning-fg", Icone: Bell },
  em_atendimento: { classe: "border-transparent bg-accent-soft text-accent", Icone: Stethoscope },
  finalizado: { classe: "border-transparent bg-success-bg text-success-fg", Icone: CheckCircle },
  faltou: { classe: "border-transparent bg-error-bg text-error-fg", Icone: UserMinus },
  cancelado: { classe: "border-border bg-surface-elevated text-text-muted line-through", Icone: XCircle },
};

export const ICONE_DO_STATUS: Record<StatusDeExibicao, Icon> = Object.fromEntries(
  Object.entries(ESTILO).map(([k, v]) => [k, v.Icone]),
) as Record<StatusDeExibicao, Icon>;

export function SeloDeStatus({ status, complemento }: { status: StatusDeExibicao; complemento?: string | null }) {
  const t = useT();
  const { classe, Icone } = ESTILO[status];
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", classe)}
      data-testid="selo-de-status"
      data-status={status}
    >
      <Icone aria-hidden size={14} weight="bold" />
      <span className={status === "cancelado" ? "no-underline" : undefined}>{t(ROTULO_DE_EXIBICAO[status])}</span>
      {complemento ? <span className="font-normal">· {complemento}</span> : null}
    </span>
  );
}
