"use client";

/**
 * O painel da recepção: colunas por status da visita, com o tempo no estado e o
 * profissional. Quem é profissional vê destacados os "Prontos" da AGENDA DELE.
 *
 * Realtime: `clinic_appointment_visits` está na publicação `supabase_realtime`
 * (migration 9003) e `calendar_appointments` também (0183). Um evento em
 * qualquer uma só avisa a tela para perguntar de novo — o dado vem da rota.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { SeloDaVisita } from "@/components/clinic/VisitaDoPaciente";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { usePessoasDaAgenda } from "@/hooks/agenda/usePessoasDaAgenda";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { useRealtimeChannel } from "@/hooks/realtime/useRealtimeChannel";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";
import { ACAO_PARA_AVANCAR, ROTULO_DO_STATUS, STATUS_DA_VISITA, type StatusDaVisita } from "@/lib/clinic/visitas/status";

interface ItemDoDia {
  appointment_id: string;
  titulo: string;
  inicio: string;
  profissional_id: string | null;
  paciente_id: string;
  paciente: string | null;
  status: StatusDaVisita;
  desde: string | null;
}

const CHAVE_BASE = ["clinic", "recepcao"] as const;

function minutosDesde(iso: string | null, agora: number): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((agora - Date.parse(iso)) / 60_000));
}

export function PainelDaRecepcao({
  orgId,
  dia: diaEscolhido,
  usuarioAtualId,
  podeMudar,
}: {
  orgId: string;
  /** `?dia=AAAA-MM-DD` para ver outro dia; ausente = hoje. */
  dia: string | null;
  usuarioAtualId: string;
  podeMudar: boolean;
}) {
  const CHAVE = [...CHAVE_BASE, diaEscolhido ?? "hoje"];
  const t = useT();
  const tagDoIdioma = useTagDeIdioma();
  const qc = useQueryClient();
  const { data: pessoas = [] } = usePessoasDaAgenda();
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const dia = useQuery({
    queryKey: CHAVE,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { dia: string; itens: ItemDoDia[] } }>(
          `/api/v1/clinic/visitas${diaEscolhido ? `?dia=${diaEscolhido}` : ""}`,
        )
      ).data,
    refetchInterval: 120_000,
  });

  const recarregar = useCallback(() => void qc.invalidateQueries({ queryKey: CHAVE_BASE }), [qc]);
  const { status: statusDoTempoReal } = useRealtimeChannel({
    name: `recepcao-visitas-${orgId}`,
    postgresChanges: { event: "*", schema: "public", table: "clinic_appointment_visits", filter: `organization_id=eq.${orgId}` },
    onChange: recarregar,
  });
  useRealtimeChannel({
    name: `recepcao-agenda-${orgId}`,
    postgresChanges: { event: "*", schema: "public", table: "calendar_appointments", filter: `organization_id=eq.${orgId}` },
    onChange: recarregar,
  });

  const mudar = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusDaVisita }) =>
      apiClient.post(`/api/v1/clinic/agendamentos/${id}/visita`, { status }),
    onSuccess: recarregar,
    onError: (err) => {
      if (err instanceof ApiError && err.code === "ficha_incompleta") {
        showApiError(new ApiError(err.status, err.code, err.details, err.requestId, t("Complete a ficha do paciente (abra o agendamento na Agenda).")));
        return;
      }
      showApiError(err);
    },
  });

  const nome = (id: string | null) => pessoas.find((p) => p.id === id)?.nome ?? t("Sem profissional");
  const itens = dia.data?.itens ?? [];

  return (
    <div className="space-y-3" data-testid="painel-da-recepcao" data-realtime-status={statusDoTempoReal}>
      {dia.isLoading ? (
        <p className="text-sm text-text-muted">{t("Carregando…")}</p>
      ) : dia.isError ? (
        <p className="text-sm text-destructive">{t("Não foi possível carregar os pacientes de hoje.")}</p>
      ) : itens.length === 0 ? (
        <p className="text-sm text-text-muted">{t("Nenhum paciente agendado para hoje.")}</p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-5">
        {STATUS_DA_VISITA.map((coluna) => {
          const daColuna = itens.filter((i) => i.status === coluna);
          return (
            <section key={coluna} className="min-w-0 rounded-xl border p-2" data-testid={`coluna-${coluna}`}>
              <h2 className="mb-2 flex items-center justify-between text-sm font-semibold">
                <span>{t(ROTULO_DO_STATUS[coluna])}</span>
                <span className="text-xs text-text-muted">{daColuna.length}</span>
              </h2>
              <ul className="space-y-2">
                {daColuna.map((i) => {
                  const meu = i.profissional_id === usuarioAtualId;
                  const destaque = coluna === "pronto" && meu;
                  const proximo = ACAO_PARA_AVANCAR[i.status];
                  const min = minutosDesde(i.desde, agora);
                  return (
                    <li
                      key={i.appointment_id}
                      className={`space-y-1 rounded-lg border p-2 text-sm ${destaque ? "border-success ring-2 ring-success/40" : ""}`}
                      data-testid="cartao-da-recepcao"
                      data-meu-pronto={destaque ? "sim" : undefined}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/app/contacts/${i.paciente_id}`} className="truncate font-medium hover:underline">
                          {i.paciente ?? t("Paciente")}
                        </Link>
                        <span className="shrink-0 text-xs text-text-muted">
                          {new Date(i.inicio).toLocaleTimeString(tagDoIdioma, { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="truncate text-xs text-text-muted">
                        {i.titulo} · {nome(i.profissional_id)}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <SeloDaVisita status={i.status} />
                        {min !== null && coluna !== "agendado" && coluna !== "finalizado" ? (
                          <span className="text-xs text-text-muted">
                            {t("há")} {min} {t("min")}
                          </span>
                        ) : null}
                      </div>
                      {podeMudar && proximo ? (
                        <Button
                          size="sm"
                          variant={destaque ? "default" : "outline"}
                          className="w-full"
                          disabled={mudar.isPending}
                          data-testid={`recepcao-${proximo.para}`}
                          onClick={() => mudar.mutate({ id: i.appointment_id, status: proximo.para })}
                        >
                          {t(proximo.rotulo)}
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
