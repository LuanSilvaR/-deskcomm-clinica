"use client";

/**
 * FORK clinic (9015) — a lista de procedimentos: busca, filtro ativo/inativo e,
 * por linha, código, especializações, profissionais, duração e o POP vigente.
 */
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";

import { useCadastrosDaClinica } from "@/components/clinic/procedimentos/EditorDoProcedimento";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { usePermissoes } from "@/lib/clinic/acesso/use-permissoes";
import type { Procedimento } from "@/lib/clinic/procedimentos/servidor";
import { MagnifyingGlass, Plus } from "@/lib/ui/icons";

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function ListaDeProcedimentos() {
  const t = useT();
  const { can } = usePermissoes();
  const { especialidades } = useCadastrosDaClinica();
  const lista = useQuery({
    queryKey: ["clinic", "procedimentos"],
    queryFn: async () => (await apiClient.get<{ data: Procedimento[] }>("/api/v1/clinic/procedimentos")).data,
  });
  const [busca, setBusca] = React.useState("");
  const [situacao, setSituacao] = React.useState<"ativos" | "inativos" | "todos">("ativos");

  const nomeDaEsp = new Map((especialidades.data ?? []).map((e) => [e.id, e.name]));
  const termo = normalizar(busca);
  const visiveis = (lista.data ?? []).filter(
    (p) =>
      (situacao === "todos" || (situacao === "ativos" ? p.is_active : !p.is_active)) &&
      (!termo || normalizar(`${p.name} ${p.code ?? ""} ${p.short_description}`).includes(termo)),
  );

  return (
    <div className="space-y-3" data-testid="lista-de-procedimentos">
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-64 flex-1">
          <label htmlFor="proc-busca" className="sr-only block">
            {t("Buscar procedimento")}
          </label>
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input id="proc-busca" data-testid="proc-busca" type="search" className="pl-8" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t("Nome ou código")} />
        </div>
        <label htmlFor="proc-situacao" className="sr-only block">
          {t("Situação")}
        </label>
        <select
          id="proc-situacao"
          data-testid="proc-situacao"
          className="h-9 rounded-md border bg-transparent px-2 text-sm"
          value={situacao}
          onChange={(e) => setSituacao(e.target.value as typeof situacao)}
        >
          <option value="ativos">{t("Ativos")}</option>
          <option value="inativos">{t("Inativos")}</option>
          <option value="todos">{t("Todos")}</option>
        </select>
        {can("procedimentos.gerenciar") ? (
          <Button asChild data-testid="proc-novo">
            <Link href="/app/procedimentos/novo">
              <Plus aria-hidden /> {t("Novo procedimento")}
            </Link>
          </Button>
        ) : null}
      </div>

      {lista.isLoading ? (
        <p className="text-sm text-text-muted">{t("Carregando…")}</p>
      ) : lista.isError ? (
        <p className="text-sm text-destructive">{t("Não foi possível carregar os procedimentos.")}</p>
      ) : visiveis.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-sm text-text-muted" data-testid="proc-vazio">
          {(lista.data ?? []).length === 0 ? t("Nenhum procedimento cadastrado ainda.") : t("Nenhum procedimento com esse filtro.")}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-surface">
          {visiveis.map((p) => (
            <li key={p.id} data-testid="proc-linha" data-nome={p.name}>
              <Link
                href={`/app/procedimentos/${p.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {p.name}
                    {p.code ? <span className="ml-2 text-xs text-text-muted">{p.code}</span> : null}
                    {!p.is_active ? <Badge variant="neutral" className="ml-2">{t("Inativo")}</Badge> : null}
                  </span>
                  <span className="block truncate text-xs text-text-muted">{p.short_description}</span>
                </span>
                <span className="text-xs text-text-muted">
                  {p.specialty_ids.map((id) => nomeDaEsp.get(id)).filter(Boolean).join(", ") || t("Qualquer especialização")}
                </span>
                <span className="text-xs text-text-muted">
                  {p.professional_ids.length} {p.professional_ids.length === 1 ? t("profissional") : t("profissionais")}
                </span>
                {p.duration_minutes ? <span className="text-xs text-text-muted">{p.duration_minutes} min</span> : null}
                <span className="text-xs">
                  {p.pop?.vigente ? (
                    <Badge variant="success">
                      {p.pop.code} · v{p.pop.vigente.versao}
                    </Badge>
                  ) : p.pop ? (
                    <Badge variant="warning">
                      {p.pop.code} · {t("rascunho")}
                    </Badge>
                  ) : (
                    <Badge variant="neutral">{t("Sem POP")}</Badge>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
