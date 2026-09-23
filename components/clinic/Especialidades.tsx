"use client";

/**
 * Cadastro de especialidades (módulo clinic). Não se apaga especialidade:
 * desativar tira dela o poder de habilitar e de ser exigida, e preserva o
 * histórico de quem a tinha.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

import type { Especialidade } from "./tipos";

export const CHAVE_ESPECIALIDADES = ["clinic", "especialidades"] as const;

export function useEspecialidades() {
  return useQuery({
    queryKey: CHAVE_ESPECIALIDADES,
    queryFn: async () =>
      (await apiClient.get<{ data: Especialidade[] }>("/api/v1/clinic/especialidades")).data,
  });
}

export function Especialidades({ podeEditar }: { podeEditar: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const query = useEspecialidades();
  const invalidar = () => void qc.invalidateQueries({ queryKey: ["clinic"] });

  const criar = useMutation({
    mutationFn: () => apiClient.post("/api/v1/clinic/especialidades", { name: nome.trim() }),
    onSuccess: () => {
      setNome("");
      invalidar();
    },
    onError: showApiError,
  });

  const alternar = useMutation({
    mutationFn: (e: Especialidade) =>
      apiClient.patch("/api/v1/clinic/especialidades", { id: e.id, is_active: !e.is_active }),
    onSuccess: invalidar,
    onError: showApiError,
  });

  const lista = query.data ?? [];

  return (
    <section className="space-y-3 rounded-xl border p-4" data-testid="clinic-especialidades">
      <h2 className="font-semibold">{t("Especialidades")}</h2>
      <p className="text-sm text-text-muted">
        {t("O que cada profissional sabe fazer. Um atendimento que exige uma especialidade só é marcado com quem a tem.")}
      </p>

      {podeEditar ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (nome.trim()) criar.mutate();
          }}
        >
          <label className="block">
            <span className="block text-sm">{t("Nova especialidade")}</span>
            <input
              aria-label={t("Nova especialidade")}
              className="mt-1 rounded-md border p-2"
              data-testid="nova-especialidade"
              maxLength={80}
              placeholder={t("Ex.: Harmonização facial")}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </label>
          <Button type="submit" disabled={!nome.trim() || criar.isPending}>
            {t("Adicionar")}
          </Button>
        </form>
      ) : null}

      {query.isLoading ? (
        <p className="text-sm text-text-muted">{t("Carregando…")}</p>
      ) : query.isError ? (
        <p className="text-sm text-destructive">{t("Não foi possível carregar as especialidades.")}</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-text-muted">{t("Nenhuma especialidade cadastrada ainda.")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {lista.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 p-2" data-testid="especialidade">
              <span className={e.is_active ? "" : "text-text-muted line-through"}>{e.name}</span>
              {podeEditar ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={alternar.isPending}
                  onClick={() => alternar.mutate(e)}
                >
                  {e.is_active ? t("Desativar") : t("Reativar")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
