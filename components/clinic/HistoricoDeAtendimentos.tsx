"use client";

/**
 * Histórico de agendamentos e atendimentos do paciente — no topo da aba
 * Timeline (fork clinic, migration 9003). Cada agendamento com tipo, data,
 * profissional, situação e os marcos da visita (quem mudou e quando).
 */
import { useInfiniteQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { usePessoasDaAgenda } from "@/hooks/agenda/usePessoasDaAgenda";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { ROTULO_DO_STATUS, type StatusDaVisita } from "@/lib/clinic/visitas/status";

import { SeloDaVisita } from "./VisitaDoPaciente";

interface Marco {
  from_status: StatusDaVisita | null;
  to_status: StatusDaVisita;
  is_correction: boolean;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
}

interface ItemDoHistorico {
  appointment_id: string;
  titulo: string;
  tipo: string | null;
  inicio: string;
  status_do_agendamento: string;
  motivo_do_cancelamento: string | null;
  profissional_id: string | null;
  status_da_visita: StatusDaVisita;
  marcos: Marco[];
}

const SITUACAO_DO_AGENDAMENTO: Record<string, string> = {
  pending: "Aguardando confirmação",
  confirmed: "Agendado",
  completed: "Compareceu",
  no_show: "Faltou",
  cancelled: "Cancelado",
};

export function HistoricoDeAtendimentos({ contactId }: { contactId: string }) {
  const t = useT();
  const tagDoIdioma = useTagDeIdioma();
  const { data: pessoas = [] } = usePessoasDaAgenda();
  const nome = (id: string | null) => pessoas.find((p) => p.id === id)?.nome ?? t("Equipe");

  const q = useInfiniteQuery({
    queryKey: ["clinic", "historico", contactId],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const url = `/api/v1/clinic/pacientes/${contactId}/historico${pageParam ? `?antes=${encodeURIComponent(pageParam)}` : ""}`;
      return apiClient.get<{ data: { itens: ItemDoHistorico[] }; meta?: { has_more?: boolean; cursor?: string | null } }>(url);
    },
    getNextPageParam: (ultima) => (ultima.meta?.has_more ? (ultima.meta.cursor ?? null) : null),
  });

  const itens = q.data?.pages.flatMap((p) => p.data.itens) ?? [];
  const dataHora = (iso: string) =>
    new Date(iso).toLocaleString(tagDoIdioma, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const hora = (iso: string) => new Date(iso).toLocaleTimeString(tagDoIdioma, { hour: "2-digit", minute: "2-digit" });

  return (
    <section className="space-y-3 rounded-xl border p-4" data-testid="historico-de-atendimentos">
      <h2 className="font-semibold">{t("Histórico de agendamentos e atendimentos")}</h2>
      {q.isLoading ? (
        <p className="text-sm text-text-muted">{t("Carregando…")}</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">{t("Não foi possível carregar o histórico.")}</p>
      ) : itens.length === 0 ? (
        <p className="text-sm text-text-muted">{t("Nenhum agendamento ainda.")}</p>
      ) : (
        <ol className="space-y-3">
          {itens.map((i) => (
            <li key={i.appointment_id} className="rounded-lg border p-3" data-testid="item-do-historico">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{i.tipo ?? i.titulo}</p>
                  <p className="text-sm text-text-muted">
                    {dataHora(i.inicio)} · {nome(i.profissional_id)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-text-muted">
                    {t(SITUACAO_DO_AGENDAMENTO[i.status_do_agendamento] ?? i.status_do_agendamento)}
                  </span>
                  {i.status_do_agendamento !== "cancelled" ? <SeloDaVisita status={i.status_da_visita} /> : null}
                </div>
              </div>
              {i.status_do_agendamento === "cancelled" && i.motivo_do_cancelamento ? (
                <p className="mt-1 text-xs text-text-muted">
                  {t("Motivo do cancelamento")}: {i.motivo_do_cancelamento}
                </p>
              ) : null}
              {i.marcos.length > 0 ? (
                <ol className="mt-2 space-y-0.5 border-l pl-3 text-xs text-text-muted" data-testid="marcos-da-visita">
                  {i.marcos.map((m) => (
                    <li key={`${m.created_at}-${m.to_status}`}>
                      {hora(m.created_at)} — {t(ROTULO_DO_STATUS[m.to_status])} · {nome(m.changed_by)}
                      {m.is_correction ? ` · ${t("correção")}: ${m.reason ?? ""}` : ""}
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {q.hasNextPage ? (
        <Button size="sm" variant="outline" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
          {t("Ver mais antigos")}
        </Button>
      ) : null}
    </section>
  );
}
