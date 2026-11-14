"use client";

/**
 * FORK clinic (estoque E0) — os locais onde o estoque fica (central, sala,
 * carrinho, farmácia). Um é o padrão (entrada e baixa usam ele quando não há
 * outro). Local desativado não recebe entrada nem transferência.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { LocalDeEstoque } from "@/lib/clinic/estoque/posicao";
import { TIPOS_DE_LOCAL } from "@/lib/clinic/estoque/schemas";

import { CHAVE_DO_ESTOQUE, ROTULO_DO_TIPO_DE_LOCAL } from "./tipos";

const SELECT = "h-11 rounded-md border bg-surface px-2 text-sm md:h-9";

export function LocaisDeEstoque({
  locais,
  podeConfigurar,
}: {
  locais: LocalDeEstoque[];
  podeConfigurar: boolean;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<(typeof TIPOS_DE_LOCAL)[number]>("sala");
  const recarregar = () => void qc.invalidateQueries({ queryKey: [...CHAVE_DO_ESTOQUE] });

  const criar = useMutation({
    mutationFn: () => apiClient.post("/api/v1/clinic/estoque/locais", { nome: nome.trim(), tipo }),
    onSuccess: () => {
      setNome("");
      recarregar();
    },
    onError: showApiError,
  });
  const alterar = useMutation({
    mutationFn: (l: LocalDeEstoque & { padrao: boolean; ativo: boolean }) =>
      apiClient.patch(`/api/v1/clinic/estoque/locais/${l.id}`, {
        nome: l.nome,
        tipo: l.tipo,
        resource_id: l.resource_id,
        padrao: l.padrao,
        ativo: l.ativo,
      }),
    onSuccess: recarregar,
    onError: showApiError,
  });

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-xl border" data-testid="estoque-locais">
        {locais.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{l.nome}</span>
              <span className="text-xs text-text-muted">
                {t(ROTULO_DO_TIPO_DE_LOCAL[l.tipo] ?? l.tipo)}
              </span>
              {l.padrao ? <Badge variant="info">{t("padrão")}</Badge> : null}
              {!l.ativo ? <Badge variant="secondary">{t("inativo")}</Badge> : null}
            </span>
            {podeConfigurar ? (
              <span className="flex gap-1">
                {!l.padrao && l.ativo ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => alterar.mutate({ ...l, padrao: true, ativo: true })}
                    disabled={alterar.isPending}
                  >
                    {t("Tornar padrão")}
                  </Button>
                ) : null}
                {!l.padrao ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => alterar.mutate({ ...l, padrao: false, ativo: !l.ativo })}
                    disabled={alterar.isPending}
                  >
                    {l.ativo ? t("Desativar") : t("Reativar")}
                  </Button>
                ) : null}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {podeConfigurar ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (nome.trim()) criar.mutate();
          }}
        >
          <label className="space-y-1 text-xs">
            <span className="block font-medium">{t("Novo local")}</span>
            <Input
              value={nome}
              maxLength={80}
              onChange={(e) => setNome(e.target.value)}
              placeholder={t("Ex.: Sala 2, Carrinho de procedimentos")}
              className="h-11 w-64 md:h-9"
              data-testid="estoque-local-nome"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="block font-medium">{t("Tipo")}</span>
            <select
              className={SELECT}
              value={tipo}
              onChange={(e) => setTipo(e.target.value as typeof tipo)}
            >
              {TIPOS_DE_LOCAL.map((x) => (
                <option key={x} value={x}>
                  {t(ROTULO_DO_TIPO_DE_LOCAL[x] ?? x)}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="submit"
            size="sm"
            disabled={criar.isPending || !nome.trim()}
            data-testid="estoque-local-criar"
          >
            {t("Adicionar local")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
