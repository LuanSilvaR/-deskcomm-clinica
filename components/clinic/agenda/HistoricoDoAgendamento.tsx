"use client";

/**
 * FORK clinic (agenda S4) — o HISTÓRICO COMPLETO do agendamento, no detalhe.
 * Na agenda aparece só o último status; aqui, cada passo com quem e quando:
 * criado, confirmado, remarcado (de → para), chegada, pronto, atendimento,
 * correções e cancelamento com motivo. Recolhido por padrão.
 */
import { useQuery } from "@tanstack/react-query";
import * as React from "react";

import { usePessoasDaAgenda } from "@/hooks/agenda/usePessoasDaAgenda";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { ROTULO_DO_STATUS, ehStatusDaVisita } from "@/lib/clinic/visitas/status";

interface Marco {
  origem: "agendamento" | "visita";
  tipo: string;
  quando: string;
  por: string | null;
  motivo: string | null;
  inicio_antes?: string | null;
  inicio_depois?: string | null;
  correcao?: boolean;
}

const ROTULO_DO_AGENDAMENTO: Record<string, string> = {
  criado: "Agendado",
  confirmado: "Confirmado",
  pendente: "Voltou a aguardar confirmação",
  remarcado: "Remarcado",
  cancelado: "Cancelado",
  faltou: "Faltou",
  realizado: "Realizado",
  profissional_trocado: "Profissional trocado",
  encaixe: "Encaixe",
};

export function HistoricoDoAgendamento({ appointmentId }: { appointmentId: string }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const [aberto, setAberto] = React.useState(false);
  const { data: pessoas = [] } = usePessoasDaAgenda();
  const consulta = useQuery({
    queryKey: ["agenda", "historico", appointmentId],
    enabled: aberto,
    queryFn: async () =>
      (await apiClient.get<{ data: { marcos: Marco[] } }>(`/api/v1/clinic/agendamentos/${appointmentId}/historico`)).data,
  });
  const quando = (iso: string) =>
    new Date(iso).toLocaleString(tag, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const nome = (id: string | null) => (id ? (pessoas.find((p) => p.id === id)?.nome ?? t("Equipe")) : t("Sistema"));

  return (
    <details
      className="rounded-lg border p-3"
      data-testid="historico-do-agendamento"
      onToggle={(e) => setAberto((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer text-sm font-medium">{t("Histórico completo")}</summary>
      {consulta.isLoading ? <p className="mt-2 text-xs text-text-muted">{t("Carregando…")}</p> : null}
      {consulta.data ? (
        <ol className="mt-2 space-y-1 text-xs text-text-muted">
          {consulta.data.marcos.map((m, i) => {
            const rotulo =
              m.origem === "visita"
                ? ehStatusDaVisita(m.tipo)
                  ? t(ROTULO_DO_STATUS[m.tipo])
                  : m.tipo
                : t(ROTULO_DO_AGENDAMENTO[m.tipo] ?? m.tipo);
            return (
              <li key={`${m.quando}-${i}`} data-testid="marco-do-historico" data-tipo={m.tipo}>
                <span className="tabular-nums">{quando(m.quando)}</span> — <span className="font-medium text-text">{rotulo}</span>
                {m.tipo === "remarcado" && m.inicio_antes && m.inicio_depois
                  ? ` (${quando(m.inicio_antes)} → ${quando(m.inicio_depois)})`
                  : ""}{" "}
                · {nome(m.por)}
                {m.correcao ? ` · ${t("correção")}` : ""}
                {m.motivo ? `: ${m.motivo}` : ""}
              </li>
            );
          })}
        </ol>
      ) : null}
    </details>
  );
}
