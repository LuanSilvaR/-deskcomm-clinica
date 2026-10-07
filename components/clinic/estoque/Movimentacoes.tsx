"use client";

/**
 * FORK clinic (estoque E0) — o histórico de movimentações, mais nova antes.
 * Nada se apaga: corrigir é estornar (gera outra movimentação, com motivo).
 */
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

import { CHAVE_DO_ESTOQUE, ROTULO_DA_OPERACAO, quantidade } from "./tipos";

interface Operacao {
  id: string;
  tipo: string;
  motivo: string | null;
  estorna_operacao_id: string | null;
  estornada: boolean;
  created_at: string;
  linhas: Array<{
    produto: string | null;
    lote: string | null;
    local: string | null;
    quantidade: number;
  }>;
}

export function Movimentacoes({ podeEstornar }: { podeEstornar: boolean }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ["clinic", "estoque", "movimentos"],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      (
        await apiClient.get<{ data: { operacoes: Operacao[]; proximo: string | null } }>(
          `/api/v1/clinic/estoque/movimentos${pageParam ? `?antes=${encodeURIComponent(pageParam)}` : ""}`,
        )
      ).data,
    getNextPageParam: (p) => p.proximo,
  });
  const estornar = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      apiClient.post(`/api/v1/clinic/estoque/operacoes/${id}/estorno`, { motivo }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clinic", "estoque", "movimentos"] });
      void qc.invalidateQueries({ queryKey: [...CHAVE_DO_ESTOQUE] });
    },
    onError: showApiError,
  });

  if (q.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (q.isError)
    return (
      <p className="text-sm text-destructive">{t("Não foi possível ler as movimentações.")}</p>
    );
  const ops = (q.data?.pages ?? []).flatMap((p) => p.operacoes);
  if (ops.length === 0)
    return <p className="text-sm text-text-muted">{t("Nenhuma movimentação ainda.")}</p>;

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-xl border" data-testid="estoque-movimentacoes">
        {ops.map((o) => (
          <li key={o.id} className="space-y-1 p-3 text-sm" data-testid="estoque-operacao">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t(ROTULO_DA_OPERACAO[o.tipo] ?? o.tipo)}</span>
                {o.estornada ? <Badge variant="secondary">{t("estornada")}</Badge> : null}
                <span className="text-xs text-text-muted">
                  {new Date(o.created_at).toLocaleString(tag, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </span>
              {podeEstornar && o.tipo !== "estorno" && !o.estornada ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={estornar.isPending}
                  onClick={() => {
                    const motivo = window.prompt(
                      t("Motivo do estorno (a movimentação original continua no histórico)"),
                    );
                    if (motivo && motivo.trim().length >= 3)
                      estornar.mutate({ id: o.id, motivo: motivo.trim() });
                  }}
                  data-testid="estoque-estornar"
                >
                  {t("Estornar")}
                </Button>
              ) : null}
            </div>
            {o.motivo ? <p className="text-xs text-text-muted">{o.motivo}</p> : null}
            <ul className="text-xs">
              {o.linhas.map((l, i) => (
                <li key={i} className={l.quantidade < 0 ? "text-destructive" : "text-success"}>
                  {l.quantidade > 0 ? "+" : "−"}
                  {quantidade(Math.abs(l.quantidade), tag)} · {l.produto ?? "—"} · {t("lote")}{" "}
                  {l.lote ?? t("sem lote")} · {l.local ?? "—"}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {q.hasNextPage ? (
        <Button
          variant="outline"
          onClick={() => void q.fetchNextPage()}
          disabled={q.isFetchingNextPage}
        >
          {q.isFetchingNextPage ? t("Carregando…") : t("Carregar mais")}
        </Button>
      ) : null}
    </div>
  );
}
