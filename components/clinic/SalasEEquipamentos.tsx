"use client";

/**
 * Salas e equipamentos (migration 9007) em Configurações › Profissionais:
 *   - o cadastro (nome + categoria; desativar em vez de apagar);
 *   - o que cada tipo de atendimento exige: "uma de <categoria>" ou "este
 *     recurso". Repetir a categoria pede mais de um ao mesmo tempo.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

import type { TipoDeAtendimento } from "./tipos";

interface Recurso {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
}

interface Exigencia {
  category: string | null;
  resource_id: string | null;
}

const CHAVE_RECURSOS = ["clinic", "recursos"];

function useRecursos() {
  return useQuery({
    queryKey: CHAVE_RECURSOS,
    queryFn: async () => (await apiClient.get<{ data: Recurso[] }>("/api/v1/clinic/recursos")).data,
  });
}

function ExigenciasDoTipo({ tipo, recursos, podeEditar }: { tipo: TipoDeAtendimento; recursos: Recurso[]; podeEditar: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const chave = ["clinic", "tipo", tipo.id, "recursos"];
  const atuais = useQuery({
    queryKey: chave,
    queryFn: async () =>
      (await apiClient.get<{ data: { exigencias: Exigencia[] } }>(`/api/v1/clinic/tipos/${tipo.id}/recursos`)).data.exigencias,
  });
  const [nova, setNova] = useState("");

  const salvar = useMutation({
    mutationFn: (exigencias: Exigencia[]) =>
      apiClient.put(`/api/v1/clinic/tipos/${tipo.id}/recursos`, {
        exigencias: exigencias.map((e) => (e.resource_id ? { resource_id: e.resource_id } : { category: e.category })),
      }),
    onSuccess: (_r, exigencias) => {
      qc.setQueryData(chave, exigencias);
      setNova("");
    },
    onError: showApiError,
  });

  const ativos = recursos.filter((r) => r.is_active);
  const categorias = [...new Set(ativos.map((r) => r.category.trim()))].sort();
  const lista = atuais.data ?? [];
  const rotulo = (e: Exigencia) =>
    e.resource_id ? (recursos.find((r) => r.id === e.resource_id)?.name ?? t("Recurso removido")) : `${t("Uma de")} ${e.category}`;

  return (
    <li className="space-y-2 p-3" data-testid="recursos-do-tipo" data-tipo={tipo.id}>
      <div className="font-medium">
        {tipo.name}
        {tipo.is_active ? null : <span className="ml-2 text-sm text-text-muted">({t("desativado")})</span>}
      </div>
      {lista.length === 0 ? (
        <p className="text-xs text-text-muted">{t("Não exige sala nem equipamento.")}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {lista.map((e, i) => (
            <li key={`${e.resource_id ?? e.category}-${i}`} className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm">
              {rotulo(e)}
              {podeEditar ? (
                <button
                  type="button"
                  aria-label={t("Remover exigência")}
                  className="text-text-muted hover:text-destructive"
                  disabled={salvar.isPending}
                  onClick={() => salvar.mutate(lista.filter((_x, j) => j !== i))}
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {podeEditar && ativos.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={t("Exigir sala ou equipamento")}
            data-testid="recursos-do-tipo-nova"
            className="rounded-md border bg-surface p-1.5 text-sm"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
          >
            <option value="">{t("Exigir…")}</option>
            {categorias.map((c) => (
              <option key={`c:${c}`} value={`c:${c}`}>
                {t("Uma de")} {c}
              </option>
            ))}
            {ativos.map((r) => (
              <option key={`r:${r.id}`} value={`r:${r.id}`}>
                {r.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            data-testid="recursos-do-tipo-adicionar"
            disabled={!nova || salvar.isPending}
            onClick={() => {
              const e: Exigencia = nova.startsWith("r:") ? { category: null, resource_id: nova.slice(2) } : { category: nova.slice(2), resource_id: null };
              salvar.mutate([...lista, e]);
            }}
          >
            {t("Adicionar")}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export function SalasEEquipamentos({ podeEditar }: { podeEditar: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const recursos = useRecursos();
  const tipos = useQuery({
    queryKey: ["clinic", "tipos-de-atendimento"],
    queryFn: async () => (await apiClient.get<{ data: TipoDeAtendimento[] }>("/api/v1/agenda/tipos")).data,
  });
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");

  const criar = useMutation({
    mutationFn: () => apiClient.post("/api/v1/clinic/recursos", { name: nome, category: categoria }),
    onSuccess: () => {
      setNome("");
      void qc.invalidateQueries({ queryKey: CHAVE_RECURSOS });
    },
    onError: showApiError,
  });
  const alternar = useMutation({
    mutationFn: (r: Recurso) => apiClient.patch("/api/v1/clinic/recursos", { id: r.id, is_active: !r.is_active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: CHAVE_RECURSOS }),
    onError: showApiError,
  });

  const lista = recursos.data ?? [];
  const categorias = [...new Set(lista.map((r) => r.category.trim()))].sort();

  return (
    <div className="space-y-4" data-testid="clinic-salas-e-equipamentos">
      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="font-semibold">{t("Salas e equipamentos")}</h2>
        <p className="text-sm text-text-muted">
          {t("Cadastre as salas e os equipamentos. A categoria agrupa os que servem para a mesma coisa (ex.: Sala).")}
        </p>
        {recursos.isLoading ? (
          <p className="text-sm text-text-muted">{t("Carregando…")}</p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-text-muted">{t("Nenhuma sala ou equipamento cadastrado.")}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {lista.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 p-2 text-sm" data-testid="recurso">
                <span>
                  <span className="font-medium">{r.name}</span> <span className="text-text-muted">· {r.category}</span>
                  {r.is_active ? null : <span className="ml-2 text-text-muted">({t("desativado")})</span>}
                </span>
                {podeEditar ? (
                  <Button size="sm" variant="outline" disabled={alternar.isPending} onClick={() => alternar.mutate(r)}>
                    {r.is_active ? t("Desativar") : t("Reativar")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {podeEditar ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (nome.trim() && categoria.trim()) criar.mutate();
            }}
          >
            <label className="text-sm">
              <span className="block">{t("Nome")}</span>
              <input
                className="rounded-md border bg-surface p-1.5"
                data-testid="recurso-nome"
                value={nome}
                maxLength={80}
                onChange={(e) => setNome(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="block">{t("Categoria")}</span>
              <input
                className="rounded-md border bg-surface p-1.5"
                data-testid="recurso-categoria"
                list="categorias-de-recurso"
                value={categoria}
                maxLength={40}
                onChange={(e) => setCategoria(e.target.value)}
              />
              <datalist id="categorias-de-recurso">
                {categorias.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <Button type="submit" size="sm" data-testid="recurso-salvar" disabled={criar.isPending || !nome.trim() || !categoria.trim()}>
              {t("Cadastrar")}
            </Button>
          </form>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="font-semibold">{t("O que cada atendimento exige")}</h2>
        <p className="text-sm text-text-muted">
          {t("A agenda, a tela de marcar e o agente de IA só oferecem horário com sala e equipamento livres, e o compromisso já reserva os dois.")}
        </p>
        {tipos.isLoading || recursos.isLoading ? (
          <p className="text-sm text-text-muted">{t("Carregando…")}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {(tipos.data ?? []).map((tipo) => (
              <ExigenciasDoTipo key={tipo.id} tipo={tipo} recursos={lista} podeEditar={podeEditar} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
