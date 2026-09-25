"use client";

/** "Salvando… / Salvo às 15:42 / Erro ao salvar — tentar de novo / Outra pessoa alterou" (fork clinic, F2). */
import { Button } from "@/components/ui/button";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import type { EstadoDoAutosave } from "@/lib/clinic/atendimento/autosave";

export function IndicadorDeSalvamento({
  estado,
  aoTentarDeNovo,
  aoRecarregar,
}: {
  estado: EstadoDoAutosave;
  aoTentarDeNovo: () => void;
  aoRecarregar: () => void;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  return (
    <div role="status" aria-live="polite" className="flex min-h-8 flex-wrap items-center gap-2 text-xs" data-testid="autosave-estado">
      {estado.tipo === "salvando" ? <span className="text-text-muted">{t("Salvando…")}</span> : null}
      {estado.tipo === "salvo" ? (
        <span className="text-text-muted">
          {t("Salvo às")} {estado.em.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" })}
        </span>
      ) : null}
      {estado.tipo === "erro" ? (
        <>
          <span className="text-destructive">{t("Erro ao salvar")}</span>
          <Button size="sm" variant="outline" onClick={aoTentarDeNovo}>
            {t("Tentar de novo")}
          </Button>
        </>
      ) : null}
      {estado.tipo === "conflito" ? (
        <>
          <span className="text-destructive">{t("Outra pessoa alterou este registro. Nada foi sobrescrito.")}</span>
          <Button size="sm" variant="outline" onClick={aoRecarregar}>
            {t("Recarregar")}
          </Button>
        </>
      ) : null}
    </div>
  );
}
