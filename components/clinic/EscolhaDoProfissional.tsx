"use client";

/**
 * Na tela de marcar (app/app/agenda/_client.tsx), com as regras de
 * profissionais LIGADAS:
 *   - escolher QUEM atende, entre os habilitados para o tipo de atendimento;
 *   - bloquear o horário clicado na grade, sem ir até Configurações;
 *   - ver o PRIMEIRO horário livre de cada profissional habilitado (E1.3) e
 *     escolher profissional e horário num clique.
 *
 * Com as regras desligadas não renderiza nada e devolve `null` como escolha —
 * a tela segue exatamente como no upstream (dono padrão do tipo).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { faixaDoBloqueio, instanteNaParede } from "@/lib/clinic/agenda/instante-local";

interface Pessoa {
  id: string;
  nome: string;
}

interface Props {
  tipoId: string;
  donoPadraoId: string | null;
  pessoas: readonly Pessoa[];
  valor: string | null;
  onChange: (userId: string | null) => void;
  /** O horário clicado na grade, quando houver. */
  instante: string | null;
  duracaoMin: number;
  /** Fuso da regra (o da jornada), vindo da consulta de horários. */
  fuso: string | undefined;
  /**
   * E1.3: escolher o próximo horário livre de alguém escolhe o profissional E o
   * horário. Ausente (remarcação), a lista não aparece.
   */
  onEscolherHorario?: (userId: string, instante: string) => void;
}

interface ProximoLivre {
  profissional_id: string;
  inicio: string;
}

export function useRegrasDeProfissionaisLigadas(): boolean {
  const q = useQuery({
    queryKey: ["clinic", "config"],
    queryFn: async () =>
      (await apiClient.get<{ data: { profissionais: boolean } }>("/api/v1/clinic/config")).data.profissionais,
    staleTime: 60_000,
  });
  return q.data === true;
}

/** FORK clinic (9014): a opção "Agenda do dia" — a Agenda mostra o botão só ligada. */
export function useAgendaDoDiaLigada(): boolean {
  const q = useQuery({
    queryKey: ["clinic", "config", "agenda_do_dia"],
    queryFn: async () =>
      (await apiClient.get<{ data: { agenda_do_dia?: boolean } }>("/api/v1/clinic/config")).data.agenda_do_dia === true,
    staleTime: 60_000,
  });
  return q.data === true;
}

export function EscolhaDoProfissional(props: Props) {
  const { tipoId, donoPadraoId, pessoas, valor, onChange, instante, duracaoMin, fuso, onEscolherHorario } = props;
  const t = useT();
  const tagDoIdioma = useTagDeIdioma();
  const qc = useQueryClient();
  const ligado = useRegrasDeProfissionaisLigadas();

  const habilitados = useQuery({
    queryKey: ["clinic", "habilitados", tipoId],
    enabled: ligado,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { habilitados: string[] | null } }>(
          `/api/v1/clinic/profissionais?tipo=${encodeURIComponent(tipoId)}`,
        )
      ).data.habilitados,
  });

  const proximos = useQuery({
    queryKey: ["clinic", "proximos-livres", tipoId],
    enabled: ligado && !!onEscolherHorario,
    staleTime: 30_000,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { proximos: ProximoLivre[]; sem_horario: string[] } }>(
          `/api/v1/clinic/proximos-livres?event_type_id=${encodeURIComponent(tipoId)}`,
        )
      ).data,
  });

  const opcoes = useMemo(() => {
    if (!ligado || habilitados.data === undefined) return [];
    const ids = habilitados.data;
    return ids === null ? [...pessoas] : pessoas.filter((p) => ids.includes(p.id));
  }, [ligado, habilitados.data, pessoas]);

  // Escolha padrão: o dono do tipo, se habilitado; senão o primeiro habilitado.
  useEffect(() => {
    if (!ligado) {
      if (valor !== null) onChange(null);
      return;
    }
    if (habilitados.data === undefined) return;
    if (valor && opcoes.some((p) => p.id === valor)) return;
    const padrao = opcoes.find((p) => p.id === donoPadraoId) ?? opcoes[0] ?? null;
    onChange(padrao ? padrao.id : null);
  }, [ligado, habilitados.data, opcoes, valor, donoPadraoId, onChange]);

  const bloquear = useMutation({
    mutationFn: () => {
      if (!instante || !fuso || !valor) throw new Error("sem horário");
      const { data, minuto } = instanteNaParede(instante, fuso);
      return apiClient.post("/api/v1/clinic/bloqueios", {
        user_id: valor,
        starts_on: data,
        ends_on: data,
        ...faixaDoBloqueio(minuto, duracaoMin),
        reason: t("Bloqueado pela agenda"),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["agenda"] });
      void qc.invalidateQueries({ queryKey: ["clinic"] });
    },
    onError: showApiError,
  });

  if (!ligado) return null;

  return (
    <div className="space-y-2" data-testid="clinic-escolha-do-profissional">
      <label className="block">
        <span className="block text-sm">{t("Profissional")}</span>
        {habilitados.isLoading ? (
          <p className="text-sm text-text-muted">{t("Carregando…")}</p>
        ) : opcoes.length === 0 ? (
          <p className="text-sm text-destructive" data-testid="clinic-sem-habilitados">
            {t("Nenhum profissional tem a especialidade que este atendimento exige.")}
          </p>
        ) : (
          <select
            aria-label={t("Profissional")}
            className="mt-1 w-full rounded-md border bg-surface p-2"
            data-testid="clinic-profissional"
            value={valor ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
          >
            {opcoes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        )}
      </label>
      {onEscolherHorario ? (
        <div data-testid="clinic-proximos-livres">
          <span className="block text-sm">{t("Próximos horários livres")}</span>
          {proximos.isLoading ? (
            <p className="text-sm text-text-muted">{t("Carregando…")}</p>
          ) : (proximos.data?.proximos.length ?? 0) === 0 ? (
            <p className="text-sm text-text-muted">{t("Nenhum profissional tem horário livre nos próximos 30 dias.")}</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {proximos.data?.proximos.slice(0, 6).map((p) => (
                <li key={p.profissional_id}>
                  <button
                    type="button"
                    data-testid="clinic-proximo-livre"
                    data-profissional={p.profissional_id}
                    className="flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1 text-left text-sm hover:bg-muted"
                    onClick={() => onEscolherHorario(p.profissional_id, p.inicio)}
                  >
                    <span className="truncate">{pessoas.find((x) => x.id === p.profissional_id)?.nome ?? t("Profissional")}</span>
                    <span className="shrink-0 text-text-muted">
                      {new Date(p.inicio).toLocaleString(tagDoIdioma, {
                        timeZone: fuso,
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {instante && valor && fuso ? (
        <Button
          size="sm"
          variant="outline"
          data-testid="clinic-bloquear-horario"
          disabled={bloquear.isPending}
          onClick={() => bloquear.mutate()}
        >
          {bloquear.isSuccess ? t("Horário bloqueado") : t("Bloquear este horário")}
        </Button>
      ) : null}
    </div>
  );
}
