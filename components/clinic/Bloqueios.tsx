"use client";

/**
 * Bloqueios de agenda (módulo clinic): por PERÍODO (férias, congresso), com
 * RECORRÊNCIA semanal opcional e para a CLÍNICA TODA (feriado). Complementa os
 * "Dias fora da rotina" do núcleo, que continuam valendo dia a dia.
 *
 * Quem não é gerência só bloqueia a própria agenda — a RLS e a rota recusam o
 * resto; a tela nem oferece.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { useAttendants } from "@/hooks/team/useAttendants";
import { apiClient } from "@/lib/api/client";
import { ROTULO_DO_TIPO_DE_BLOQUEIO } from "@/lib/clinic/agenda/conflito-do-bloqueio";

import { FormularioDeBloqueio } from "./FormularioDeBloqueio";
import { dataBr, DIAS_DA_SEMANA, emHora, type BloqueioDeAgenda } from "./tipos";

export function Bloqueios({ usuarioAtualId, ehGerencia }: { usuarioAtualId: string; ehGerencia: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const membros = useAttendants();
  const lista = useQuery({
    queryKey: ["clinic", "bloqueios"],
    queryFn: async () => (await apiClient.get<{ data: BloqueioDeAgenda[] }>("/api/v1/clinic/bloqueios")).data,
  });

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ["clinic"] });
    // Bloqueio tira horários da agenda: a grade precisa perguntar de novo.
    void qc.invalidateQueries({ queryKey: ["agenda"] });
  };

  const remover = useMutation({
    mutationFn: (id: string) => apiClient.delete("/api/v1/clinic/bloqueios", { id }),
    onSuccess: invalidar,
    onError: showApiError,
  });

  const nomes = new Map((membros.data?.data ?? []).map((m) => [m.user_id, m.name ?? m.email ?? m.user_id.slice(0, 8)]));

  return (
    <section className="space-y-3 rounded-xl border p-4" data-testid="clinic-bloqueios">
      <h2 className="font-semibold">{t("Bloqueios de agenda")}</h2>
      <p className="text-sm text-text-muted">
        {t("Feche um período (férias, congresso), um horário que se repete toda semana ou a clínica toda num feriado. O que já estava marcado continua marcado.")}
      </p>

      <FormularioDeBloqueio usuarioAtualId={usuarioAtualId} ehGerencia={ehGerencia} />

      {lista.isLoading ? (
        <p className="text-sm text-text-muted">{t("Carregando…")}</p>
      ) : lista.isError ? (
        <p className="text-sm text-destructive">{t("Não foi possível carregar os bloqueios.")}</p>
      ) : (lista.data ?? []).length === 0 ? (
        <p className="text-sm text-text-muted">{t("Nenhum bloqueio em vigor.")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {(lista.data ?? []).map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 p-2" data-testid="bloqueio">
              <span className="text-sm">
                <strong>{b.user_id === null ? t("Clínica toda") : (nomes.get(b.user_id) ?? t("Profissional"))}</strong>
                {" · "}
                {b.starts_on === b.ends_on ? dataBr(b.starts_on) : `${dataBr(b.starts_on)} – ${dataBr(b.ends_on)}`}
                {" · "}
                {b.start_minute === 0 && b.end_minute === 1440
                  ? t("dia inteiro")
                  : `${emHora(b.start_minute)}–${emHora(b.end_minute)}`}
                {b.weekdays && b.weekdays.length > 0
                  ? ` · ${b.weekdays.map((d) => t(DIAS_DA_SEMANA[d] ?? "")).join(", ")}`
                  : ""}
                {b.tipo ? ` · ${t(ROTULO_DO_TIPO_DE_BLOQUEIO[b.tipo])}` : ""}
                {b.reason ? ` · ${b.reason}` : ""}
              </span>
              {ehGerencia || b.user_id === usuarioAtualId ? (
                <Button size="sm" variant="ghost" disabled={remover.isPending} onClick={() => remover.mutate(b.id)}>
                  {t("Remover")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
