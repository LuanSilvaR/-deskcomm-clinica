"use client";

/**
 * Quanto do horário aberto do profissional já está ocupado — `role="meter"`
 * com o texto ao lado ("6 consultas · 60%"), para quem não vê a barra.
 */
import { useT } from "@/hooks/i18n/useT";

export function BarraDeOcupacao({ ocupados, abertos, consultas }: { ocupados: number; abertos: number; consultas: number }) {
  const t = useT();
  const pct = abertos > 0 ? Math.min(100, Math.round((ocupados / abertos) * 100)) : 0;
  const texto = `${consultas} ${consultas === 1 ? t("consulta") : t("consultas")} · ${pct}% ${t("ocupado")}`;
  return (
    <div className="flex items-center gap-2" data-testid="ocupacao" data-pct={pct}>
      <div
        role="meter"
        aria-label={t("Ocupação do dia")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={texto}
        className="h-2 w-24 overflow-hidden rounded-full bg-muted"
      >
        <div className={`h-full ${pct >= 100 ? "bg-error" : pct >= 80 ? "bg-warning" : "bg-success"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-text-muted">{texto}</span>
    </div>
  );
}
