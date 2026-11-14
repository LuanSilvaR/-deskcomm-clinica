"use client";

/**
 * O selo "ficha completa / incompleta" dos pacientes que a lista está
 * mostrando — uma consulta por página, pela rota `/api/v1/clinic/pacientes/situacao`.
 * Falha de leitura não quebra a lista: sem dado, o selo simplesmente não aparece.
 */
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

export type SituacaoResumida = { completa: boolean; faltando: number };

export function useSituacaoDasFichas(ids: readonly string[]) {
  const chave = ids.slice(0, 200);
  return useQuery({
    queryKey: ["clinic", "situacao", chave.join(",")],
    enabled: chave.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      try {
        return (
          await apiClient.get<{ data: Record<string, SituacaoResumida> }>(
            `/api/v1/clinic/pacientes/situacao?ids=${chave.join(",")}`,
          )
        ).data;
      } catch {
        return {} as Record<string, SituacaoResumida>;
      }
    },
  });
}
