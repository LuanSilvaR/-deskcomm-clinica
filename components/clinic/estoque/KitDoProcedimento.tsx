"use client";

/**
 * FORK clinic (estoque E3) — o kit do procedimento: o que ele costuma gastar.
 * No atendimento, escolher o procedimento pré-preenche os insumos com o kit e,
 * com o estoque ligado, reserva essas quantidades até finalizar.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

interface DadosDoKit {
  itens: Array<{ product_id: string; quantidade: number; unidade: string | null }>;
  produtos: Array<{ id: string; nome: string; unidade: string | null }>;
}
interface Linha {
  product_id: string;
  quantidade: string;
}

const SELECT = "h-11 w-full rounded-md border bg-surface px-2 text-sm md:h-9";

function Editor({ procedimentoId, dados, podeGerenciar }: { procedimentoId: string; dados: DadosDoKit; podeGerenciar: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const [linhas, setLinhas] = useState<Linha[]>(
    dados.itens.map((i) => ({ product_id: i.product_id, quantidade: String(i.quantidade) })),
  );
  const salvar = useMutation({
    mutationFn: () =>
      apiClient.put(`/api/v1/clinic/procedimentos/${procedimentoId}/kit`, {
        itens: linhas
          .filter((l) => l.product_id)
          .map((l) => ({ product_id: l.product_id, quantidade: Number(l.quantidade.replace(",", ".")) })),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clinic", "procedimentos", procedimentoId, "kit"] }),
    onError: showApiError,
  });
  const usados = new Set(linhas.map((l) => l.product_id));
  const validas = linhas.every((l) => !l.product_id || Number(l.quantidade.replace(",", ".")) > 0);
  const unidade = (id: string) => dados.produtos.find((p) => p.id === id)?.unidade ?? "";

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
      data-testid="kit-do-procedimento"
    >
      <p className="text-sm text-text-muted">
        {t("O que este procedimento costuma gastar. No atendimento, os insumos já vêm preenchidos e, com o estoque ligado, ficam reservados até finalizar.")}
      </p>
      {linhas.length === 0 ? <p className="text-sm text-text-muted">{t("Nenhum item no kit.")}</p> : null}
      {linhas.map((l, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_8rem_4rem_auto]" data-testid="kit-item">
          <select
            aria-label={t("Produto")}
            className={SELECT}
            value={l.product_id}
            disabled={!podeGerenciar}
            onChange={(e) => setLinhas((x) => x.map((y, j) => (j === i ? { ...y, product_id: e.target.value } : y)))}
            data-testid="kit-produto"
          >
            <option value="">{t("Escolha…")}</option>
            {dados.produtos.map((p) => (
              <option key={p.id} value={p.id} disabled={p.id !== l.product_id && usados.has(p.id)}>
                {p.nome}
              </option>
            ))}
          </select>
          <Input
            aria-label={t("Quantidade")}
            inputMode="decimal"
            className="h-11 md:h-9"
            value={l.quantidade}
            disabled={!podeGerenciar}
            onChange={(e) => setLinhas((x) => x.map((y, j) => (j === i ? { ...y, quantidade: e.target.value } : y)))}
            data-testid="kit-quantidade"
          />
          <span className="self-center text-sm text-text-muted">{unidade(l.product_id)}</span>
          {podeGerenciar ? (
            <Button type="button" variant="ghost" onClick={() => setLinhas((x) => x.filter((_, j) => j !== i))}>
              {t("Remover")}
            </Button>
          ) : null}
        </div>
      ))}
      {podeGerenciar ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setLinhas((x) => [...x, { product_id: "", quantidade: "1" }])}
            disabled={linhas.length >= 50}
            data-testid="kit-adicionar"
          >
            {t("Adicionar item")}
          </Button>
          <Button type="submit" size="sm" disabled={!validas || salvar.isPending} data-testid="kit-salvar">
            {salvar.isPending ? t("Salvando…") : t("Salvar kit")}
          </Button>
          {salvar.isSuccess ? <span className="self-center text-xs text-success">{t("Kit salvo.")}</span> : null}
        </div>
      ) : null}
    </form>
  );
}

export function KitDoProcedimento({ procedimentoId, podeGerenciar }: { procedimentoId: string; podeGerenciar: boolean }) {
  const t = useT();
  const q = useQuery({
    queryKey: ["clinic", "procedimentos", procedimentoId, "kit"],
    queryFn: async () =>
      (await apiClient.get<{ data: DadosDoKit }>(`/api/v1/clinic/procedimentos/${procedimentoId}/kit`)).data,
  });
  if (q.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (q.isError || !q.data) return <p className="text-sm text-destructive">{t("Não foi possível ler o kit.")}</p>;
  return <Editor key={q.dataUpdatedAt} procedimentoId={procedimentoId} dados={q.data} podeGerenciar={podeGerenciar} />;
}
