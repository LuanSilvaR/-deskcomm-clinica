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
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { useAttendants } from "@/hooks/team/useAttendants";
import { apiClient } from "@/lib/api/client";

import { dataBr, DIAS_DA_SEMANA, emHora, emMinutos, type BloqueioDeAgenda } from "./tipos";

const CLINICA_TODA = "__clinica_toda__";

export function Bloqueios({ usuarioAtualId, ehGerencia }: { usuarioAtualId: string; ehGerencia: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const membros = useAttendants();
  const [quem, setQuem] = useState(usuarioAtualId);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [diaInteiro, setDiaInteiro] = useState(true);
  const [horaDe, setHoraDe] = useState("12:00");
  const [horaAte, setHoraAte] = useState("13:00");
  const [dias, setDias] = useState<number[]>([]);
  const [motivo, setMotivo] = useState("");

  const lista = useQuery({
    queryKey: ["clinic", "bloqueios"],
    queryFn: async () => (await apiClient.get<{ data: BloqueioDeAgenda[] }>("/api/v1/clinic/bloqueios")).data,
  });

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ["clinic"] });
    // Bloqueio tira horários da agenda: a grade precisa perguntar de novo.
    void qc.invalidateQueries({ queryKey: ["agenda"] });
  };

  const faixaInvalida = !diaInteiro && emMinutos(horaAte) <= emMinutos(horaDe);
  const periodoInvalido = !de || (ate !== "" && ate < de);

  const criar = useMutation({
    mutationFn: () =>
      apiClient.post("/api/v1/clinic/bloqueios", {
        ...(quem === CLINICA_TODA ? { clinica_toda: true } : { user_id: quem }),
        starts_on: de,
        ends_on: ate || de,
        start_minute: diaInteiro ? 0 : emMinutos(horaDe),
        end_minute: diaInteiro ? 1440 : emMinutos(horaAte),
        weekdays: dias.length > 0 ? dias : null,
        ...(motivo.trim() ? { reason: motivo.trim() } : {}),
      }),
    onSuccess: () => {
      setDe("");
      setAte("");
      setDias([]);
      setMotivo("");
      invalidar();
    },
    onError: showApiError,
  });

  const remover = useMutation({
    mutationFn: (id: string) => apiClient.delete("/api/v1/clinic/bloqueios", { id }),
    onSuccess: invalidar,
    onError: showApiError,
  });

  const nomes = new Map((membros.data?.data ?? []).map((m) => [m.user_id, m.name ?? m.email ?? m.user_id.slice(0, 8)]));
  const opcoes = ehGerencia
    ? (membros.data?.data ?? []).map((m) => m.user_id)
    : [usuarioAtualId];

  return (
    <section className="space-y-3 rounded-xl border p-4" data-testid="clinic-bloqueios">
      <h2 className="font-semibold">{t("Bloqueios de agenda")}</h2>
      <p className="text-sm text-text-muted">
        {t("Feche um período (férias, congresso), um horário que se repete toda semana ou a clínica toda num feriado. O que já estava marcado continua marcado.")}
      </p>

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!periodoInvalido && !faixaInvalida) criar.mutate();
        }}
      >
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="block text-sm">{t("Agenda de")}</span>
            <select
              aria-label={t("Agenda de")}
              className="mt-1 rounded-md border p-2"
              data-testid="bloqueio-quem"
              value={quem}
              onChange={(e) => setQuem(e.target.value)}
            >
              {opcoes.map((id) => (
                <option key={id} value={id}>
                  {id === usuarioAtualId ? t("Minha agenda") : (nomes.get(id) ?? id.slice(0, 8))}
                </option>
              ))}
              {ehGerencia ? <option value={CLINICA_TODA}>{t("Clínica toda")}</option> : null}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm">{t("De")}</span>
            <input
              aria-label={t("De")}
              className="mt-1 rounded-md border p-2"
              data-testid="bloqueio-de"
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="block text-sm">{t("Até (opcional)")}</span>
            <input
              aria-label={t("Até (opcional)")}
              className="mt-1 rounded-md border p-2"
              data-testid="bloqueio-ate"
              type="date"
              min={de || undefined}
              value={ate}
              onChange={(e) => setAte(e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={diaInteiro} onChange={(e) => setDiaInteiro(e.target.checked)} />
            {t("Dia inteiro")}
          </label>
          {diaInteiro ? null : (
            <>
              <label className="block">
                <span className="block text-sm">{t("Das")}</span>
                <input
                  aria-label={t("Das")}
                  className="mt-1 rounded-md border p-2"
                  type="time"
                  value={horaDe}
                  onChange={(e) => setHoraDe(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="block text-sm">{t("Às")}</span>
                <input
                  aria-label={t("Às")}
                  className="mt-1 rounded-md border p-2"
                  type="time"
                  value={horaAte}
                  onChange={(e) => setHoraAte(e.target.value)}
                />
              </label>
            </>
          )}
        </div>

        <fieldset>
          <legend className="text-sm">{t("Repetir só nestes dias da semana (opcional)")}</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {DIAS_DA_SEMANA.map((rotulo, dow) => (
              <label key={rotulo} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={dias.includes(dow)}
                  onChange={(e) => setDias(e.target.checked ? [...dias, dow] : dias.filter((d) => d !== dow))}
                />
                {t(rotulo)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-end gap-2">
          <label className="block grow">
            <span className="block text-sm">{t("Motivo (opcional)")}</span>
            <input
              aria-label={t("Motivo (opcional)")}
              className="mt-1 w-full rounded-md border p-2"
              maxLength={200}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
          <Button type="submit" data-testid="bloqueio-salvar" disabled={periodoInvalido || faixaInvalida || criar.isPending}>
            {t("Bloquear")}
          </Button>
        </div>
        {faixaInvalida ? <p className="text-sm text-destructive">{t("O fim precisa ser depois do começo.")}</p> : null}
      </form>

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
