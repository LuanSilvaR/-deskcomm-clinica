"use client";

/**
 * A fila "Meus atendimentos" (fork clinic, prontuário F1).
 *
 * Quatro seções na ordem em que o profissional olha — Aguardando (quem espera
 * há mais tempo primeiro), Em atendimento, Próximos, Finalizados. Realtime na
 * mesma tabela do painel da recepção (`clinic_appointment_visits`): um evento só
 * avisa a tela para perguntar de novo. Quando um paciente MEU entra em
 * Aguardando, aparece o aviso "Paciente chegou".
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { SeloDaVisita } from "@/components/clinic/VisitaDoPaciente";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { useRealtimeChannel } from "@/hooks/realtime/useRealtimeChannel";
import { apiClient } from "@/lib/api/client";
import { ROTULO_DA_SECAO, SECOES_DA_FILA, type ItemNaFila, type SecaoDaFila } from "@/lib/clinic/atendimento/fila";

interface RespostaDaFila {
  dia: string;
  todos: boolean;
  ligado: boolean;
  pode_iniciar: boolean;
  pode_abrir: boolean;
  fila: Record<SecaoDaFila, ItemNaFila[]>;
}

const CHAVE_BASE = ["clinic", "atendimentos", "fila"] as const;

export function FilaDeAtendimentos({
  orgId,
  usuarioAtualId,
  todosInicial,
}: {
  orgId: string;
  usuarioAtualId: string;
  todosInicial: boolean;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const router = useRouter();
  const qc = useQueryClient();
  const [todos, setTodos] = useState(todosInicial);
  const chave = [...CHAVE_BASE, todos ? "todos" : "meus"];

  const fila = useQuery({
    queryKey: chave,
    queryFn: async () =>
      (await apiClient.get<{ data: RespostaDaFila }>(`/api/v1/clinic/atendimentos/fila${todos ? "?todos=1" : ""}`)).data,
    refetchInterval: 60_000,
  });

  const recarregar = useCallback(() => void qc.invalidateQueries({ queryKey: CHAVE_BASE }), [qc]);
  const { status: statusDoTempoReal } = useRealtimeChannel({
    name: `atendimentos-visitas-${orgId}`,
    postgresChanges: { event: "*", schema: "public", table: "clinic_appointment_visits", filter: `organization_id=eq.${orgId}` },
    onChange: recarregar,
  });

  // "Paciente chegou": só quando um paciente MEU entra em Aguardando depois da
  // primeira carga (a primeira carga não é novidade para ninguém).
  const aguardandoAntes = useRef<Set<string> | null>(null);
  const dados = fila.data;
  useEffect(() => {
    if (!dados) return;
    const agora = new Set(dados.fila.aguardando.filter((i) => i.profissional_id === usuarioAtualId).map((i) => i.appointment_id));
    const antes = aguardandoAntes.current;
    if (antes) {
      for (const i of dados.fila.aguardando) {
        if (agora.has(i.appointment_id) && !antes.has(i.appointment_id)) {
          toast.info(`${t("Paciente chegou")}: ${i.paciente ?? t("Paciente")}`);
        }
      }
    }
    aguardandoAntes.current = agora;
  }, [dados, usuarioAtualId, t]);

  const iniciar = useMutation({
    mutationFn: async (appointmentId: string) =>
      (await apiClient.post<{ data: { id: string } }>(`/api/v1/clinic/agendamentos/${appointmentId}/atendimento`, {})).data,
    onSuccess: (r) => {
      recarregar();
      router.push(`/app/atendimentos/${r.id}`);
    },
    onError: showApiError,
  });

  const hora = (iso: string) => new Date(iso).toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-4" data-testid="fila-de-atendimentos" data-realtime-status={statusDoTempoReal}>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("Mostrar")}>
        <Button size="sm" variant={todos ? "outline" : "default"} aria-pressed={!todos} onClick={() => setTodos(false)}>
          {t("Meus")}
        </Button>
        <Button size="sm" variant={todos ? "default" : "outline"} aria-pressed={todos} onClick={() => setTodos(true)}>
          {t("Todos os profissionais")}
        </Button>
      </div>

      {dados && !dados.ligado ? (
        <p className="rounded-lg border bg-muted p-3 text-sm" data-testid="prontuario-desligado">
          {t("O módulo de prontuário está desligado nesta clínica. Quem administra pode ligá-lo nas opções da clínica.")}
        </p>
      ) : null}

      {fila.isLoading ? (
        <p className="text-sm text-text-muted">{t("Carregando…")}</p>
      ) : fila.isError ? (
        <p className="text-sm text-destructive">{t("Não foi possível carregar a fila de atendimentos.")}</p>
      ) : null}

      {dados ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {SECOES_DA_FILA.map((secao) => {
            const itens = dados.fila[secao];
            return (
              <section
                key={secao}
                aria-labelledby={`fila-${secao}`}
                className={`min-w-0 rounded-xl border p-3 ${secao === "aguardando" && itens.length ? "border-success" : ""}`}
                data-testid={`fila-${secao}`}
              >
                <h2 id={`fila-${secao}`} className="mb-2 flex items-center justify-between text-sm font-semibold">
                  <span>{t(ROTULO_DA_SECAO[secao])}</span>
                  <span className="text-xs text-text-muted">{itens.length}</span>
                </h2>
                {itens.length === 0 ? <p className="text-xs text-text-muted">{t("Ninguém por aqui.")}</p> : null}
                <ul className="space-y-2">
                  {itens.map((i) => (
                    <li key={i.appointment_id} className="space-y-1 rounded-lg border p-2 text-sm" data-testid="item-da-fila">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{i.paciente ?? t("Paciente")}</span>
                        <span className="shrink-0 text-xs text-text-muted">{hora(i.inicio)}</span>
                      </div>
                      {i.servico ? <p className="truncate text-xs text-text-muted">{i.servico}</p> : null}
                      <div className="flex items-center justify-between gap-2">
                        <SeloDaVisita status={i.status} />
                        {i.espera_min !== null ? (
                          <span className="text-xs text-text-muted">
                            {t("espera")} {i.espera_min} {t("min")}
                          </span>
                        ) : null}
                      </div>
                      {secao === "aguardando" && dados.pode_iniciar ? (
                        <Button
                          size="sm"
                          className="h-11 w-full md:h-9"
                          disabled={iniciar.isPending}
                          data-testid="fila-iniciar"
                          onClick={() => iniciar.mutate(i.appointment_id)}
                        >
                          {t("Iniciar atendimento")}
                        </Button>
                      ) : null}
                      {i.atendimento_id && dados.pode_abrir && secao !== "aguardando" ? (
                        <Link
                          href={`/app/atendimentos/${i.atendimento_id}`}
                          className="block text-center text-xs underline-offset-4 hover:underline"
                          data-testid="fila-abrir"
                        >
                          {secao === "em_atendimento" ? t("Continuar atendimento") : t("Abrir atendimento")}
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
