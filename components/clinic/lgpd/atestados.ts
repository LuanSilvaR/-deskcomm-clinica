"use client";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";

/** FORK clinic (#87): a chave da clínica "Atestado de anonimização". */
export function useAtestadoLigado() {
  return useQuery({
    queryKey: ["clinic-config", "atestado_anonimizacao"],
    queryFn: async () => {
      const r = await apiClient.get<{ data: { atestado_anonimizacao?: boolean } }>("/api/v1/clinic/config");
      return r.data.atestado_anonimizacao === true;
    },
    staleTime: 30_000,
  });
}

export interface AtestadoLinha {
  id: string;
  contact_id: string;
  anonimizado_em: string;
  emitido_em: string;
  codigo_curto: string;
  executor_nome: string | null;
}

/** Atestados da clínica; com `contactId`, só os daquele paciente. Só roda com a chave ligada. */
export function useAtestados(ligado: boolean, contactId?: string) {
  return useQuery({
    queryKey: ["clinic-atestados", contactId ?? "todos"],
    enabled: ligado,
    queryFn: async () => {
      const q = contactId ? `?contact_id=${encodeURIComponent(contactId)}` : "";
      const r = await apiClient.get<{ data: { atestados: AtestadoLinha[] } }>(`/api/v1/clinic/lgpd/atestados${q}`);
      return r.data.atestados;
    },
  });
}

/** Pede o link assinado (vale 15 min) e abre o PDF. */
export async function baixarAtestado(id: string): Promise<void> {
  try {
    const r = await apiClient.get<{ data: { url: string } }>(`/api/v1/clinic/lgpd/atestados/${id}`);
    const a = document.createElement("a");
    a.href = r.data.url;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    showApiError(e);
  }
}
