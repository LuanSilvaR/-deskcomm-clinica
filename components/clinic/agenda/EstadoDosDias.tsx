"use client";

/**
 * FORK clinic (agenda S3 #68) — a faixa "Próximos dias" do painel "Novo
 * agendamento": cada um dos próximos 14 dias do profissional com o seu estado
 * (Disponível · Sem agenda · Bloqueado · Lotado). Clicar num dia disponível
 * leva o calendário do painel a ele (`onEscolher`).
 *
 * Jornada e bloqueios vêm de `useDisponibilidadeDaAgenda`; os horários livres,
 * do mesmo `horariosPorDia` que o painel já carregou — dia fora da janela
 * carregada não é chamado de "Lotado" (ver `lib/clinic/agenda/estado-do-dia.ts`).
 */
import { addDays, format } from "date-fns";
import * as React from "react";

import { useDisponibilidadeDaAgenda } from "@/hooks/clinic/useContextoDaAgenda";
import { useLocaleDeData } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { ROTULO_DO_ESTADO_DO_DIA, estadoDoDia, type EstadoDoDia } from "@/lib/clinic/agenda/estado-do-dia";
import { cn } from "@/lib/utils";

const DIAS = 14;

const COR: Record<EstadoDoDia, string> = {
  disponivel: "border-success/40 bg-success/10",
  sem_agenda: "border-border bg-muted/40 text-text-muted",
  bloqueado: "border-warning/40 bg-warning/10",
  lotado: "border-danger/40 bg-danger/10",
};

export function EstadoDosDias({
  profissional,
  horariosPorDia,
  hoje,
  onEscolher,
}: {
  profissional: string | null;
  horariosPorDia: Record<string, unknown[]>;
  hoje: Date;
  onEscolher?: (dia: string) => void;
}) {
  const t = useT();
  const locale = useLocaleDeData();
  const de = format(hoje, "yyyy-MM-dd");
  const ate = format(addDays(hoje, DIAS - 1), "yyyy-MM-dd");
  const { data } = useDisponibilidadeDaAgenda(profissional ? { profissional, de, ate } : null);
  const dias = React.useMemo(() => {
    if (!data) return [];
    const carregados = Object.keys(horariosPorDia).sort();
    const primeiro = carregados[0];
    const ultimo = carregados.at(-1);
    return data.dias.map((d) => {
      const dentro = primeiro !== undefined && ultimo !== undefined && d.dia >= primeiro && d.dia <= ultimo;
      const livres = horariosPorDia[d.dia]?.length ?? (dentro ? 0 : null);
      return { dia: d.dia, estado: estadoDoDia({ jornada: d.jornada, bloqueios: d.bloqueios, livres }) };
    });
  }, [data, horariosPorDia]);

  if (!profissional || dias.length === 0) return null;
  return (
    <div data-testid="estado-dos-dias" className="mt-4">
      <p className="text-xs font-medium text-text-muted">{t("Próximos dias")}</p>
      <ul className="mt-1 flex gap-1 overflow-x-auto pb-1">
        {dias.map(({ dia, estado }) => {
          const data = new Date(`${dia}T12:00:00`);
          return (
            <li key={dia}>
              <button
                type="button"
                data-testid={`estado-do-dia-${dia}`}
                data-estado={estado}
                disabled={estado !== "disponivel" || !onEscolher}
                onClick={() => onEscolher?.(dia)}
                title={t(ROTULO_DO_ESTADO_DO_DIA[estado])}
                className={cn("flex w-14 flex-col items-center rounded-md border px-1 py-1 text-center text-[11px] leading-tight", COR[estado])}
              >
                <span className="font-medium">{format(data, "EEE", { locale })}</span>
                <span>{format(data, "dd/MM")}</span>
                <span className="mt-0.5 truncate">{t(ROTULO_DO_ESTADO_DO_DIA[estado])}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
