"use client";
/**
 * As regras de comissão, fora do catálogo financeiro — mesmo componente e mesma
 * API (`/api/v1/financeiro/catalogo/regras_de_comissao`) da tela de origem.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";

import { RegrasDeComissao, type Pessoa, type Regra, type Servico } from "../settings/tenant/financeiro/_comissao";

const TIPO = "regras_de_comissao";

export function ComissoesDaClinica({ podeEditar }: { podeEditar: boolean }) {
  const qc = useQueryClient();
  const regras = useQuery({
    queryKey: ["financeiro", "catalogo", TIPO],
    queryFn: async () => (await apiClient.get<{ data: Regra[] }>(`/api/v1/financeiro/catalogo/${TIPO}`)).data,
  });
  const pessoas = useQuery({
    queryKey: ["team", "assignable"],
    queryFn: async () => (await apiClient.get<{ data: Pessoa[] }>("/api/v1/team/assignable")).data,
  });
  const servicos = useQuery({
    queryKey: ["agenda", "tipos"],
    queryFn: async () => (await apiClient.get<{ data: Servico[] }>("/api/v1/agenda/tipos")).data,
  });
  const invalidar = () => void qc.invalidateQueries({ queryKey: ["financeiro", "catalogo", TIPO] });
  const criar = useMutation({
    mutationFn: (corpo: Record<string, unknown>) => apiClient.post(`/api/v1/financeiro/catalogo/${TIPO}`, corpo),
    onSuccess: invalidar,
    onError: showApiError,
  });
  const inativar = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/financeiro/catalogo/${TIPO}`, { id }),
    onSuccess: invalidar,
    onError: showApiError,
  });
  return (
    <RegrasDeComissao
      regras={regras.data ?? []}
      pessoas={pessoas.data ?? []}
      servicos={servicos.data ?? []}
      podeEditar={podeEditar}
      carregando={regras.isLoading}
      onCriar={(corpo) => criar.mutate(corpo)}
      onInativar={(id) => inativar.mutate(id)}
    />
  );
}
