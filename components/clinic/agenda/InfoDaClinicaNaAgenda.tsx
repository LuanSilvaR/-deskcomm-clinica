"use client";

/**
 * FORK clinic (melhorias da Agenda) — o que a clínica acrescenta à tela da
 * Agenda do núcleo, por CONTEXTO (a grade e o histórico ganham só uma linha
 * cada, sem props novas atravessando componentes):
 *   - `useInfoDaClinica(recorte, q)`: busca /api/v1/clinic/agenda-info e
 *     acompanha em tempo real visita, agenda e confirmação;
 *   - `<ProvedorDaInfoDaClinica>`: entrega a informação para baixo;
 *   - `<StatusNoBloco>` (grade) e `<StatusNaLinha>` (histórico): o selo do
 *     status de exibição, a confirmação e as faltas.
 * Sem provedor, tudo devolve null e a Agenda é a do núcleo.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { SeloDaConfirmacao } from "@/components/clinic/SeloDaConfirmacao";
import { useT } from "@/hooks/i18n/useT";
import { useRealtimeChannel } from "@/hooks/realtime/useRealtimeChannel";
import { apiClient } from "@/lib/api/client";
import type { InfoDaClinica } from "@/lib/clinic/agenda/filtros-da-agenda";
import { ROTULO_DE_EXIBICAO, statusDeExibicao, type StatusDeExibicao } from "@/lib/clinic/visitas/exibicao";

import { ICONE_DO_STATUS, SeloDeStatus } from "./SeloDeStatus";

const Contexto = React.createContext<InfoDaClinica | null>(null);

export function ProvedorDaInfoDaClinica({ valor, children }: { valor: InfoDaClinica | null; children: React.ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useInfoDaClinica(orgId: string, recorte: { de: string; ate: string }, q: string) {
  const qc = useQueryClient();
  const consulta = useQuery({
    queryKey: ["clinic", "agenda-info", recorte.de, recorte.ate, q],
    queryFn: async () => {
      const u = new URLSearchParams({ de: recorte.de, ate: recorte.ate });
      if (q) u.set("q", q);
      return (await apiClient.get<{ data: InfoDaClinica }>(`/api/v1/clinic/agenda-info?${u}`)).data;
    },
    refetchInterval: 120_000,
    placeholderData: (anterior) => anterior,
    // Sem organização (vitrine, testes do núcleo), a Agenda fica a do núcleo.
    enabled: Boolean(orgId),
  });
  const recarregar = React.useCallback(() => void qc.invalidateQueries({ queryKey: ["clinic", "agenda-info"] }), [qc]);
  useRealtimeChannel({
    name: `agenda-info-visitas-${orgId}`,
    postgresChanges: { event: "*", schema: "public", table: "clinic_appointment_visits", filter: `organization_id=eq.${orgId}` },
    onChange: recarregar,
    enabled: Boolean(orgId),
  });
  useRealtimeChannel({
    name: `agenda-info-confirmacao-${orgId}`,
    postgresChanges: { event: "*", schema: "public", table: "clinic_confirmation_requests", filter: `organization_id=eq.${orgId}` },
    onChange: recarregar,
    enabled: Boolean(orgId),
  });
  return consulta;
}

/** O status de exibição do compromisso, ou null sem a informação da clínica. */
export function useStatusNaAgenda(a: { id: string; situacao: string; origem?: string }): StatusDeExibicao | null {
  const info = React.useContext(Contexto);
  if (!info || a.origem === "google_sync") return null;
  return statusDeExibicao(a.situacao, info.compromissos[a.id]?.visita);
}

/** O rótulo do status para o `aria-label` do bloco (", Na recepção"). Vazio sem contexto. */
export function useRotuloDoStatusNaAgenda(a: { id: string; situacao: string; origem?: string }): string {
  const t = useT();
  const status = useStatusNaAgenda(a);
  return status ? `, ${t(ROTULO_DE_EXIBICAO[status])}` : "";
}

/** Na clínica, o bloco da grade abre pelo PACIENTE ("Maria · Consulta"); fora dela, o título de sempre. */
export function useTituloDoBloco(a: { titulo: string; quemSeraAtendido?: string }): string {
  const info = React.useContext(Contexto);
  return info && a.quemSeraAtendido ? `${a.quemSeraAtendido} · ${a.titulo}` : a.titulo;
}

/** Na grade: só o ícone do status (o bloco é estreito); o texto vai no aria-label. */
export function StatusNoBloco({ agendamento }: { agendamento: { id: string; situacao: string; origem?: string } }) {
  const status = useStatusNaAgenda(agendamento);
  if (!status) return null;
  const Icone = ICONE_DO_STATUS[status];
  return (
    <span aria-hidden data-testid="status-no-bloco" data-status={status} className="mr-0.5 inline-flex align-[-2px]">
      <Icone size={11} weight="bold" />
    </span>
  );
}

/** No histórico: selo do status + confirmação + faltas. */
export function StatusNaLinha({ agendamento }: { agendamento: { id: string; situacao: string; origem?: string } }) {
  const t = useT();
  const info = React.useContext(Contexto);
  const status = useStatusNaAgenda(agendamento);
  if (!info || !status) return null;
  const c = info.compromissos[agendamento.id];
  return (
    <span className="flex shrink-0 flex-wrap items-center gap-1" data-testid="status-na-linha">
      <SeloDeStatus status={status} />
      <SeloDaConfirmacao status={c?.confirmacao} />
      {c && c.faltas > 0 ? (
        <span className="rounded-full bg-error-bg px-2 py-0.5 text-xs text-error-fg" data-testid="selo-faltas">
          {t("faltou")} {c.faltas}×
        </span>
      ) : null}
    </span>
  );
}
