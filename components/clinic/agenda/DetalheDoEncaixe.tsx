"use client";

/**
 * FORK clinic (agenda S6b, issue #69) — no detalhe do compromisso: se ele foi um
 * ENCAIXE, mostra "Encaixe · motivo · por <autor> em <data hora>". Sem encaixe
 * (ou sem permissão de leitura) não desenha nada.
 */
import { useQuery } from "@tanstack/react-query";

import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

interface Rastro {
  motivo: string;
  autor: { id: string; nome: string };
  quando: string;
}

export function DetalheDoEncaixe({ appointmentId }: { appointmentId: string }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const consulta = useQuery({
    queryKey: ["agenda", "encaixe", appointmentId],
    retry: false,
    queryFn: async () =>
      (await apiClient.get<{ data: { encaixe: Rastro | null } }>(`/api/v1/clinic/agendamentos/${appointmentId}/encaixe`)).data
        .encaixe,
  });
  const e = consulta.data;
  if (!e) return null;
  const quando = new Date(e.quando).toLocaleString(tag, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <p className="rounded-lg border border-warning/40 bg-warning-bg p-3 text-sm" data-testid="detalhe-do-encaixe">
      <span className="font-medium">{t("Encaixe")}</span> · {e.motivo} · {t("por")} {e.autor.nome} {t("em")} {quando}
    </p>
  );
}
