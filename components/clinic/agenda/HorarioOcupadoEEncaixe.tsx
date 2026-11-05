"use client";

/**
 * FORK clinic (agenda S6b, issue #69) — o 409 `agenda_horario_ocupado` do painel de
 * marcar: lista quem ocupa o horário e, com a chave `agenda.encaixe` e `pode_encaixar`,
 * oferece "Encaixar" com motivo obrigatório (5–500). Sem a chave: só a lista.
 */
import * as React from "react";

import { Button } from "@/components/ui/button";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";

export interface OcupanteDoHorario {
  id: string;
  paciente: string | null;
  inicio: string;
  fim: string;
  status: string;
}

export interface HorarioOcupado {
  agendamentos: OcupanteDoHorario[];
  pode_encaixar: boolean;
}

export const MOTIVO_MIN = 5;
export const MOTIVO_MAX = 500;

const ROTULO_DO_STATUS: Record<string, string> = {
  pending: "Aguardando confirmação",
  confirmed: "Confirmado",
  completed: "Realizado",
};

export function HorarioOcupadoEEncaixe({
  ocupado,
  podeEncaixar,
  enviando = false,
  erro,
  onEncaixar,
}: {
  ocupado: HorarioOcupado;
  /** `can("agenda.encaixe")`. */
  podeEncaixar: boolean;
  enviando?: boolean;
  erro?: string | null;
  onEncaixar: (motivo: string) => void | Promise<unknown>;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const [abrindo, setAbrindo] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const limpo = motivo.trim();
  const valido = limpo.length >= MOTIVO_MIN && limpo.length <= MOTIVO_MAX;
  const hora = (iso: string) => new Date(iso).toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" });
  const mostrarEncaixe = podeEncaixar && ocupado.pode_encaixar;

  return (
    <section
      role="alert"
      className="shrink-0 space-y-2 rounded-lg border border-warning/40 bg-warning-bg p-3 text-sm"
      data-testid="horario-ocupado"
    >
      <p className="font-medium">{t("Horário ocupado")}</p>
      <ul className="space-y-1 text-xs" aria-label={t("Quem ocupa este horário")}>
        {ocupado.agendamentos.map((a) => (
          <li key={a.id} data-testid="ocupante-do-horario">
            {a.paciente ?? t("Sem paciente")} · {hora(a.inicio)}–{hora(a.fim)} · {t(ROTULO_DO_STATUS[a.status] ?? a.status)}
          </li>
        ))}
      </ul>
      {mostrarEncaixe && !abrindo ? (
        <Button size="sm" variant="outline" data-testid="encaixar" onClick={() => setAbrindo(true)}>
          {t("Encaixar")}
        </Button>
      ) : null}
      {mostrarEncaixe && abrindo ? (
        <div className="space-y-2">
          <label className="block text-xs font-medium" htmlFor="motivo-do-encaixe">
            {t("Motivo do encaixe")}
          </label>
          <textarea
            id="motivo-do-encaixe"
            data-testid="motivo-do-encaixe"
            value={motivo}
            maxLength={MOTIVO_MAX}
            rows={3}
            required
            aria-describedby="motivo-do-encaixe-ajuda"
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full rounded-md border border-border bg-surface p-2 text-sm outline-hidden focus:border-border-strong"
          />
          <p id="motivo-do-encaixe-ajuda" className="text-xs text-text-muted tabular-nums">
            {limpo.length}/{MOTIVO_MAX} · {t("mínimo de 5 caracteres")}
          </p>
          {erro ? (
            <p className="text-xs text-destructive" data-testid="erro-do-encaixe">
              {erro}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAbrindo(false)}>
              {t("Voltar")}
            </Button>
            <Button
              size="sm"
              data-testid="confirmar-encaixe"
              disabled={!valido || enviando}
              onClick={() => void onEncaixar(limpo)}
            >
              {enviando ? t("Encaixando…") : t("Confirmar encaixe")}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
