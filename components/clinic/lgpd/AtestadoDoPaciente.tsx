"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useT } from "@/hooks/i18n/useT";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { baixarAtestado, useAtestadoLigado, useAtestados } from "./atestados";

/** FORK clinic (#87): na ficha do paciente anonimizado, baixa ou gera o atestado. */
export function AtestadoDoPaciente({ contactId }: { contactId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const ligado = useAtestadoLigado().data === true;
  const lista = useAtestados(ligado, contactId);

  const gerar = useMutation({
    mutationFn: () => apiClient.post("/api/v1/clinic/lgpd/atestados", { contact_id: contactId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clinic-atestados"] }),
    onError: showApiError,
  });

  if (!ligado || lista.isLoading || !lista.data) return null;
  const existente = lista.data[0];

  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="atestado-do-paciente">
      {existente ? (
        <>
          <span className="text-sm text-muted-foreground">
            {t("Código do atestado")}: <strong>{existente.codigo_curto}</strong>
          </span>
          <Button variant="outline" data-testid="atestado-baixar" onClick={() => void baixarAtestado(existente.id)}>
            {t("Baixar atestado")}
          </Button>
        </>
      ) : (
        <Button variant="outline" data-testid="atestado-gerar" disabled={gerar.isPending} onClick={() => gerar.mutate()}>
          {gerar.isPending ? t("Gerando…") : t("Gerar atestado")}
        </Button>
      )}
    </div>
  );
}
