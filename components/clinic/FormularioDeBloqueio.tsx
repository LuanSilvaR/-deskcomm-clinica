"use client";

/**
 * FORK clinic (agenda S5, PF18–PF19) — o formulário de bloqueio, extraído de
 * `Bloqueios.tsx` para servir também à Agenda ("Bloquear horário", com a data e
 * a faixa já preenchidas pelo horário clicado).
 *
 * Bloqueio em cima de paciente marcado volta 409 `bloqueio_com_agendamento`:
 * a tela lista quem está marcado e, para a gerência, oferece gravar assim mesmo.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { useAttendants } from "@/hooks/team/useAttendants";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";
import { ROTULO_DO_TIPO_DE_BLOQUEIO, TIPOS_DE_BLOQUEIO, type TipoDeBloqueio } from "@/lib/clinic/agenda/conflito-do-bloqueio";

import { DIAS_DA_SEMANA, emMinutos } from "./tipos";

const CLINICA_TODA = "__clinica_toda__";

export interface ValoresIniciaisDoBloqueio {
  /** `YYYY-MM-DD` */
  data?: string;
  /** `HH:MM` — com as duas, o bloqueio nasce com faixa, não dia inteiro. */
  horaDe?: string;
  horaAte?: string;
  /** Agenda de quem (a gerência bloqueia a de colega). */
  usuarioId?: string;
}

interface Conflito {
  id: string;
  inicio: string;
  paciente: string | null;
}

export function FormularioDeBloqueio({
  usuarioAtualId,
  ehGerencia,
  inicial,
  simples = false,
  onCriado,
}: {
  usuarioAtualId: string;
  ehGerencia: boolean;
  inicial?: ValoresIniciaisDoBloqueio;
  /** Na Agenda: sem recorrência semanal (fica na tela de bloqueios). */
  simples?: boolean;
  onCriado?: () => void;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const qc = useQueryClient();
  const membros = useAttendants();
  const comFaixa = !!(inicial?.horaDe && inicial?.horaAte);
  const [quem, setQuem] = useState(inicial?.usuarioId ?? usuarioAtualId);
  const [de, setDe] = useState(inicial?.data ?? "");
  const [ate, setAte] = useState("");
  const [diaInteiro, setDiaInteiro] = useState(!comFaixa);
  const [horaDe, setHoraDe] = useState(inicial?.horaDe ?? "12:00");
  const [horaAte, setHoraAte] = useState(inicial?.horaAte ?? "13:00");
  const [dias, setDias] = useState<number[]>([]);
  const [tipo, setTipo] = useState<TipoDeBloqueio>("indisponivel");
  const [motivo, setMotivo] = useState("");
  const [conflitos, setConflitos] = useState<Conflito[] | null>(null);

  const faixaInvalida = !diaInteiro && emMinutos(horaAte) <= emMinutos(horaDe);
  const periodoInvalido = !de || (ate !== "" && ate < de);

  const criar = useMutation({
    mutationFn: (forcar: boolean) =>
      apiClient.post("/api/v1/clinic/bloqueios", {
        ...(quem === CLINICA_TODA ? { clinica_toda: true } : { user_id: quem }),
        starts_on: de,
        ends_on: ate || de,
        start_minute: diaInteiro ? 0 : emMinutos(horaDe),
        end_minute: diaInteiro ? 1440 : emMinutos(horaAte),
        weekdays: dias.length > 0 ? dias : null,
        tipo,
        ...(motivo.trim() ? { reason: motivo.trim() } : {}),
        ...(forcar ? { forcar: true } : {}),
      }),
    onSuccess: () => {
      setDe(inicial?.data ?? "");
      setAte("");
      setDias([]);
      setMotivo("");
      setConflitos(null);
      void qc.invalidateQueries({ queryKey: ["clinic"] });
      // Bloqueio tira horários da agenda: a grade precisa perguntar de novo.
      void qc.invalidateQueries({ queryKey: ["agenda"] });
      onCriado?.();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "bloqueio_com_agendamento") {
        setConflitos(((e.details?.agendamentos as Conflito[] | undefined) ?? []).slice(0, 20));
        return;
      }
      showApiError(e);
    },
  });

  const nomes = new Map((membros.data?.data ?? []).map((m) => [m.user_id, m.name ?? m.email ?? m.user_id.slice(0, 8)]));
  const opcoes = ehGerencia ? (membros.data?.data ?? []).map((m) => m.user_id) : [usuarioAtualId];
  const quando = (iso: string) =>
    new Date(iso).toLocaleString(tag, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <form
      className="space-y-2"
      data-testid="formulario-bloqueio"
      onSubmit={(e) => {
        e.preventDefault();
        if (!periodoInvalido && !faixaInvalida) criar.mutate(false);
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
            {(opcoes.includes(usuarioAtualId) ? opcoes : [usuarioAtualId, ...opcoes]).map((id) => (
              <option key={id} value={id}>
                {id === usuarioAtualId ? t("Minha agenda") : (nomes.get(id) ?? id.slice(0, 8))}
              </option>
            ))}
            {ehGerencia ? <option value={CLINICA_TODA}>{t("Clínica toda")}</option> : null}
          </select>
        </label>
        <label className="block">
          <span className="block text-sm">{t("Tipo")}</span>
          <select
            aria-label={t("Tipo")}
            className="mt-1 rounded-md border p-2"
            data-testid="bloqueio-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoDeBloqueio)}
          >
            {TIPOS_DE_BLOQUEIO.map((k) => (
              <option key={k} value={k}>
                {t(ROTULO_DO_TIPO_DE_BLOQUEIO[k])}
              </option>
            ))}
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
                data-testid="bloqueio-hora-de"
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
                data-testid="bloqueio-hora-ate"
                type="time"
                value={horaAte}
                onChange={(e) => setHoraAte(e.target.value)}
              />
            </label>
          </>
        )}
      </div>

      {simples ? null : (
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
      )}

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

      {conflitos ? (
        <div role="alert" className="space-y-2 rounded-md border border-warning bg-warning-bg p-3 text-sm" data-testid="bloqueio-conflito">
          <p className="font-medium">{t("Há paciente marcado nesse horário. Remarque antes de bloquear.")}</p>
          <ul className="list-inside list-disc">
            {conflitos.map((c) => (
              <li key={c.id}>
                {quando(c.inicio)} — {c.paciente ?? t("Paciente")}
              </li>
            ))}
          </ul>
          {ehGerencia ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid="bloqueio-forcar"
              disabled={criar.isPending}
              onClick={() => criar.mutate(true)}
            >
              {t("Bloquear assim mesmo")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
