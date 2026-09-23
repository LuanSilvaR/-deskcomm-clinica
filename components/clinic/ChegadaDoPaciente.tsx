"use client";

/**
 * "Paciente chegou" — no detalhe do compromisso (components/agenda/DetalheDoCompromisso.tsx).
 *
 * Com a ficha completa (ou com a regra desligada) registra na hora. Com a ficha
 * obrigatória e incompleta, o servidor responde 422 `ficha_incompleta` e a ficha
 * abre ALI MESMO, na recepção; salva completa, a chegada é registrada sem
 * segundo clique.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";

import { FichaDoPaciente } from "./FichaDoPaciente";

interface Chegada {
  id: string;
  arrived_at: string;
}

export function ChegadaDoPaciente({
  appointmentId,
  contactId,
  status,
  podeRegistrar,
}: {
  appointmentId: string;
  contactId: string | null;
  status: string;
  podeRegistrar: boolean;
}) {
  const t = useT();
  const tagDoIdioma = useTagDeIdioma();
  const qc = useQueryClient();
  const [fichaAberta, setFichaAberta] = useState(false);
  const chave = ["clinic", "chegada", appointmentId];

  const chegada = useQuery({
    queryKey: chave,
    enabled: !!contactId,
    queryFn: async () =>
      (await apiClient.get<{ data: Chegada | null }>(`/api/v1/clinic/agendamentos/${appointmentId}/chegada`)).data,
  });

  const registrar = useMutation({
    mutationFn: () => apiClient.post<{ data: Chegada }>(`/api/v1/clinic/agendamentos/${appointmentId}/chegada`, {}),
    onSuccess: (r) => {
      qc.setQueryData(chave, r.data);
      setFichaAberta(false);
      void qc.invalidateQueries({ queryKey: ["agenda"] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "ficha_incompleta") {
        setFichaAberta(true);
        return;
      }
      showApiError(err);
    },
  });

  if (!contactId || status === "cancelled") return null;

  if (chegada.data) {
    return (
      <p className="text-sm text-success" data-testid="chegada-registrada">
        {t("Paciente chegou às")}{" "}
        {new Date(chegada.data.arrived_at).toLocaleTimeString(tagDoIdioma, { hour: "2-digit", minute: "2-digit" })}
      </p>
    );
  }

  return (
    <>
      {podeRegistrar ? (
        <Button
          size="sm"
          data-testid="paciente-chegou"
          disabled={registrar.isPending || chegada.isLoading}
          onClick={() => registrar.mutate()}
        >
          {t("Paciente chegou")}
        </Button>
      ) : null}
      <Dialog open={fichaAberta} onOpenChange={setFichaAberta}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Complete a ficha do paciente")}</DialogTitle>
            <DialogDescription>
              {t("A clínica exige a ficha cadastral completa para registrar a chegada. Ao salvar completa, a chegada é registrada.")}
            </DialogDescription>
          </DialogHeader>
          <FichaDoPaciente
            contactId={contactId}
            podeEditar={podeRegistrar}
            onSalva={(situacao) => {
              if (situacao.completa) registrar.mutate();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
