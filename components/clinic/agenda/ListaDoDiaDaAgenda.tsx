"use client";

/**
 * FORK clinic (melhorias da Agenda) — a visão Dia em LISTA, um bloco por
 * profissional: especialidades, conselho, estado do dia (disponível, lotado,
 * bloqueado, fora da jornada), ocupação e as linhas em ordem de horário — o
 * compromisso com o selo do status, a confirmação e as faltas, e o horário
 * livre com "Marcar". Os mesmos filtros da grade valem aqui.
 *
 * Dados: GET /api/v1/clinic/agenda-do-dia (montado por `montarAgendaDoDia`).
 * Marcar e abrir usam as MESMAS portas da grade (`onMarcarEm`, `onAbrir`).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import { SeloDaConfirmacao } from "@/components/clinic/SeloDaConfirmacao";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { useRealtimeChannel } from "@/hooks/realtime/useRealtimeChannel";
import { instanteDe } from "@/lib/agenda/fuso";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";
import type { BlocoDoProfissional, EstadoDoDia, LinhaDoDia } from "@/lib/clinic/agenda/agenda-do-dia";
import { horaDoMinuto } from "@/lib/clinic/agenda/dia-por-profissional";
import type { FiltrosDaAgenda } from "@/lib/clinic/agenda/filtros-da-agenda";
import { usePermissoes } from "@/lib/clinic/acesso/use-permissoes";
import { ROTULO_DE_EXIBICAO, periodoDoMinuto } from "@/lib/clinic/visitas/exibicao";
import { ACAO_PARA_AVANCAR, ROTULO_DO_STATUS, ehStatusDaVisita } from "@/lib/clinic/visitas/status";
import { ArrowSquareOut, Plus } from "@/lib/ui/icons";

import { BarraDeOcupacao } from "./BarraDeOcupacao";
import { SeloDeStatus } from "./SeloDeStatus";

interface Resposta {
  dia: string;
  hoje: string;
  fuso: string;
  blocos: BlocoDoProfissional[];
  pacientes_da_busca: string[] | null;
}

const ROTULO_DO_ESTADO: Record<EstadoDoDia, string> = {
  disponivel: "Disponível",
  lotado: "Lotado",
  bloqueado: "Bloqueado",
  fora_da_jornada: "Fora da jornada",
};
const VARIANTE_DO_ESTADO: Record<EstadoDoDia, "success" | "warning" | "neutral" | "info"> = {
  disponivel: "success",
  lotado: "warning",
  bloqueado: "neutral",
  fora_da_jornada: "info",
};

function minutosDesde(iso: string | null, agora: number): number | null {
  if (!iso) return null;
  const m = Math.floor((agora - Date.parse(iso)) / 60_000);
  return Number.isFinite(m) && m >= 0 ? m : null;
}

/** "12 min", "1 h 05" — a espera na recepção, legível de relance. */
function duracao(min: number): string {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

export function ListaDoDiaDaAgenda({
  orgId,
  dia,
  filtros,
  isolada,
  nomeDaPessoa,
  onAbrir,
  onMarcarEm,
}: {
  orgId: string;
  /** `yyyy-MM-dd` do dia mostrado. */
  dia: string;
  filtros: FiltrosDaAgenda;
  /** O filtro de pessoa do núcleo (avatares): só este profissional. */
  isolada: string | null;
  nomeDaPessoa: (id: string) => string | undefined;
  onAbrir: (id: string) => void;
  /** Ausente para quem não pode marcar. */
  onMarcarEm?: (profissionalId: string, instante: string) => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const { can } = usePermissoes();

  const consulta = useQuery({
    queryKey: ["clinic", "agenda-do-dia", dia, filtros.q],
    queryFn: async () => {
      const u = new URLSearchParams({ dia });
      if (filtros.q) u.set("q", filtros.q);
      return (await apiClient.get<{ data: Resposta }>(`/api/v1/clinic/agenda-do-dia?${u}`)).data;
    },
    refetchInterval: 120_000,
    placeholderData: (anterior) => anterior,
  });
  const recarregar = React.useCallback(() => void qc.invalidateQueries({ queryKey: ["clinic", "agenda-do-dia"] }), [qc]);
  useRealtimeChannel({
    name: `agenda-lista-visitas-${orgId}`,
    postgresChanges: { event: "*", schema: "public", table: "clinic_appointment_visits", filter: `organization_id=eq.${orgId}` },
    onChange: recarregar,
  });
  useRealtimeChannel({
    name: `agenda-lista-agenda-${orgId}`,
    postgresChanges: { event: "*", schema: "public", table: "calendar_appointments", filter: `organization_id=eq.${orgId}` },
    onChange: recarregar,
  });

  const [agora, setAgora] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const avancar = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string; paciente: string }) =>
      apiClient.post(`/api/v1/clinic/agendamentos/${id}/visita`, { status }),
    onSuccess: (_r, v) => {
      toast.success(`${t("Status de")} ${v.paciente} ${t("atualizado para")} ${t(ehStatusDaVisita(v.status) ? ROTULO_DO_STATUS[v.status] : v.status)}.`);
      recarregar();
      void qc.invalidateQueries({ queryKey: ["clinic", "agenda-info"] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "ficha_incompleta") {
        showApiError(new ApiError(err.status, err.code, err.details, err.requestId, t("Complete a ficha do paciente (abra o agendamento na Agenda).")));
        return;
      }
      showApiError(err);
    },
  });

  const r = consulta.data;
  const nomeDe = (b: BlocoDoProfissional) => b.ficha?.nome ?? nomeDaPessoa(b.profissional_id) ?? t("Profissional");
  const buscaIds = r?.pacientes_da_busca ? new Set(r.pacientes_da_busca) : null;
  const passa = (l: LinhaDoDia): boolean => {
    if (filtros.periodos.length && !filtros.periodos.includes(periodoDoMinuto(l.inicio_minuto))) return false;
    if (l.tipo === "livre") return !buscaIds && (filtros.soLivres ? !l.passou : true);
    if (filtros.soLivres) return false;
    if (buscaIds && !(l.paciente_id && buscaIds.has(l.paciente_id))) return false;
    return filtros.status.includes(l.status);
  };
  const blocos = (r?.blocos ?? [])
    .filter((b) => !isolada || b.profissional_id === isolada)
    .filter((b) => !filtros.especialidade || (b.ficha?.especialidades ?? []).some((e) => e.id === filtros.especialidade))
    .map((b) => ({ ...b, visiveis: b.linhas.filter(passa) }))
    .filter((b) => !(filtros.soLivres || buscaIds) || b.visiveis.length > 0)
    .sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), "pt-BR"));
  const ehHoje = r ? r.dia === r.hoje : false;
  const instanteDoMinuto = (minuto: number): string => {
    const [ano, mes, d] = (r?.dia ?? dia).split("-").map(Number) as [number, number, number];
    return instanteDe({ ano, mes, dia: d, hora: Math.floor(minuto / 60), minuto: minuto % 60 }, r?.fuso ?? "America/Sao_Paulo").toISOString();
  };

  if (consulta.isLoading) {
    return (
      <div className="space-y-3" aria-hidden data-testid="lista-do-dia-carregando">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }
  if (consulta.isError) return <p className="text-sm text-destructive">{t("Não foi possível carregar a agenda do dia.")}</p>;
  if ((r?.blocos ?? []).length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-sm" data-testid="lista-do-dia-vazia">
        {t("Nenhum profissional com agenda aberta nesta data.")}
      </div>
    );
  }
  if (blocos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-sm" data-testid="lista-do-dia-sem-resultado">
        {t("Nada com esses filtros.")}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${consulta.isFetching ? "opacity-80" : ""}`} data-testid="lista-do-dia">
      {blocos.map((b) => (
        <section key={b.profissional_id} className="rounded-xl border bg-surface" data-testid="bloco-profissional" data-profissional={b.profissional_id} data-estado={b.estado}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
            <span className="font-medium">{nomeDe(b)}</span>
            {b.ficha?.especialidades.length ? (
              <span className="text-sm text-text-muted" title={b.ficha.especialidades.map((e) => e.nome).join(", ")}>
                {b.ficha.especialidades
                  .slice(0, 3)
                  .map((e) => e.nome)
                  .join(", ")}
                {b.ficha.especialidades.length > 3 ? ` +${b.ficha.especialidades.length - 3}` : ""}
              </span>
            ) : null}
            {b.ficha?.conselho ? <span className="text-xs text-text-muted">{b.ficha.conselho}</span> : null}
            <span className="ml-auto flex flex-wrap items-center gap-3">
              <Badge variant={VARIANTE_DO_ESTADO[b.estado]} data-testid="estado-do-dia">
                {t(ROTULO_DO_ESTADO[b.estado])}
                {b.estado === "disponivel" ? ` · ${b.ocupacao.livres} ${b.ocupacao.livres === 1 ? t("livre") : t("livres")}` : ""}
              </Badge>
              <BarraDeOcupacao ocupados={b.ocupacao.minutos_ocupados} abertos={b.ocupacao.minutos_abertos} consultas={b.ocupacao.consultas} />
            </span>
          </div>
          {b.visiveis.length === 0 ? (
            <p className="border-t px-3 py-2 text-sm text-text-muted">{t("Nenhum horário com esses filtros.")}</p>
          ) : (
            <ul className="divide-y border-t" aria-label={`${t("Horários de")} ${nomeDe(b)}`}>
              {b.visiveis.map((l) =>
                l.tipo === "livre" ? (
                  <li
                    key={`livre-${l.inicio_minuto}`}
                    className={`flex items-center gap-3 px-3 py-2 text-sm ${l.passou ? "opacity-50" : ""}`}
                    data-testid="linha-livre"
                    data-inicio={horaDoMinuto(l.inicio_minuto)}
                  >
                    <span className="w-12 font-mono tabular-nums">{horaDoMinuto(l.inicio_minuto)}</span>
                    <span className="flex-1 text-text-muted">— {t("Livre")} —</span>
                    {!l.passou && onMarcarEm ? (
                      <Button size="sm" variant="outline" data-testid="linha-livre-marcar" onClick={() => onMarcarEm(b.profissional_id, instanteDoMinuto(l.inicio_minuto))}>
                        <Plus aria-hidden /> {t("Marcar")}
                      </Button>
                    ) : null}
                  </li>
                ) : (
                  <LinhaDoCompromisso
                    key={l.id}
                    linha={l}
                    agora={agora}
                    ehHoje={ehHoje}
                    podeAvancar={can("recepcao.mudar_status_visita")}
                    ocupado={avancar.isPending}
                    onAbrir={onAbrir}
                    onAvancar={(status) => avancar.mutate({ id: l.id, status, paciente: l.paciente ?? t("Paciente") })}
                  />
                ),
              )}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function LinhaDoCompromisso({
  linha: l,
  agora,
  ehHoje,
  podeAvancar,
  ocupado,
  onAbrir,
  onAvancar,
}: {
  linha: Extract<LinhaDoDia, { tipo: "compromisso" }>;
  agora: number;
  /** A espera ("há 12 min") só faz sentido no dia de hoje. */
  ehHoje: boolean;
  podeAvancar: boolean;
  ocupado: boolean;
  onAbrir: (id: string) => void;
  onAvancar: (status: string) => void;
}) {
  const t = useT();
  const proximo = ehStatusDaVisita(l.status) ? ACAO_PARA_AVANCAR[l.status] : null;
  const min = ehHoje && (l.status === "na_recepcao" || l.status === "pronto") ? minutosDesde(l.desde, agora) : null;
  const paciente = l.paciente ?? t("Sem paciente");
  return (
    <li
      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
      data-testid="linha-compromisso"
      data-id={l.id}
      data-status={l.status}
      aria-label={`${horaDoMinuto(l.inicio_minuto)}, ${paciente}, ${t(ROTULO_DE_EXIBICAO[l.status])}`}
    >
      <span className="w-12 font-mono tabular-nums">{horaDoMinuto(l.inicio_minuto)}</span>
      <span className="min-w-0 flex-1">
        <span className={`font-medium ${l.status === "cancelado" ? "text-text-muted line-through" : ""}`}>{paciente}</span>
        <span className="ml-2 text-xs text-text-muted">{l.titulo}</span>
      </span>
      <span className="flex flex-wrap items-center gap-1">
        <SeloDeStatus status={l.status} complemento={min !== null ? duracao(min) : null} />
        <SeloDaConfirmacao status={l.confirmacao} />
        {l.faltas > 0 ? (
          <span className="rounded-full bg-error-bg px-2 py-0.5 text-xs text-error-fg" data-testid="selo-faltas">
            {t("faltou")} {l.faltas}×
          </span>
        ) : null}
      </span>
      <span className="flex items-center gap-1">
        {podeAvancar && proximo ? (
          <Button size="sm" data-testid="linha-avancar" disabled={ocupado} onClick={() => onAvancar(proximo.para)}>
            {t(proximo.rotulo)}
          </Button>
        ) : null}
        <Button size="icon" variant="ghost" data-testid="linha-abrir" aria-label={`${t("Abrir compromisso (remarcar ou cancelar)")}: ${paciente}`} onClick={() => onAbrir(l.id)}>
          <ArrowSquareOut aria-hidden />
        </Button>
      </span>
    </li>
  );
}
