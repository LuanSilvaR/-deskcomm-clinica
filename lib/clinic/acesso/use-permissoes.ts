"use client";

/**
 * FORK clinic (ACL-007) — `const { can } = usePermissoes(); can("pacientes.criar")`.
 *
 * Lê as permissões EFETIVAS de `/api/v1/clinic/acesso/eu` (o servidor decide;
 * nada vem do JWT). Serve para esconder botão e evitar carregar tela — nunca é
 * trava: a rota e a RLS negam de qualquer jeito. Enquanto carrega, `can` é
 * falso (deny by default também na UX).
 */
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { apiClient } from "@/lib/api/client";

import type { ChaveDePermissao } from "./catalogo";

export function usePermissoes() {
  const q = useQuery({
    queryKey: ["clinic", "acesso", "eu"],
    queryFn: async () =>
      (await apiClient.get<{ data: { modo_ligado: boolean; permissoes: string[] } }>("/api/v1/clinic/acesso/eu")).data,
    staleTime: 30_000,
  });
  const permissoes = q.data?.permissoes;
  const can = useCallback((chave: ChaveDePermissao) => !!permissoes?.includes(chave), [permissoes]);
  const canAny = useCallback((prefixo: string) => !!permissoes?.some((k) => k.startsWith(prefixo)), [permissoes]);
  return { can, canAny, modoLigado: q.data?.modo_ligado === true, carregando: q.isLoading };
}
