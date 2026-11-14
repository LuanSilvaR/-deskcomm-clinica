"use client";

/**
 * FORK clinic (estoque E7) — alertas do estoque.
 *
 * Mantidos em dia por uma varredura de hora em hora: abaixo do mínimo, ponto de
 * pedido, validade em 30/60/90 dias, lote vencido, frasco aberto vencido (com
 * "Registrar perda", que encerra o frasco) e pendências da baixa. O que deixa
 * de valer some sozinho; "Dispensar" pede motivo e silencia por 7 dias.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

import { CHAVE_DO_ESTOQUE, quantidade } from "./tipos";

export interface Alerta {
  id: string;
  tipo: "abaixo_minimo" | "ponto_pedido" | "validade_proxima" | "lote_vencido" | "frasco_vencido" | "pendencias_baixa";
  produto: string | null;
  lote: string | null;
  frasco_id: string | null;
  detalhe: Record<string, unknown>;
  aberto_em: string;
}

export const CHAVE_DOS_ALERTAS = ["clinic", "estoque", "alertas"] as const;

const ROTULO: Record<Alerta["tipo"], string> = {
  abaixo_minimo: "Abaixo do mínimo",
  ponto_pedido: "Hora de comprar (ponto de pedido)",
  validade_proxima: "Validade próxima",
  lote_vencido: "Lote vencido com saldo",
  frasco_vencido: "Frasco aberto vencido",
  pendencias_baixa: "Pendências da baixa pelo prontuário",
};

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

export function useAlertasDoEstoque(ativo: boolean) {
  return useQuery({
    queryKey: [...CHAVE_DOS_ALERTAS],
    enabled: ativo,
    queryFn: async () =>
      (await apiClient.get<{ data: { alertas: Alerta[]; pode_movimentar: boolean } }>("/api/v1/clinic/estoque/alertas")).data,
  });
}

export function AlertasDoEstoque() {
  const t = useT();
  const tag = useTagDeIdioma();
  const qc = useQueryClient();
  const q = useAlertasDoEstoque(true);
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: [...CHAVE_DOS_ALERTAS] });
    void qc.invalidateQueries({ queryKey: [...CHAVE_DO_ESTOQUE] });
  };
  const dispensar = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      apiClient.post(`/api/v1/clinic/estoque/alertas/${id}/dispensar`, { motivo }),
    onSuccess: recarregar,
    onError: showApiError,
  });
  const registrarPerda = useMutation({
    mutationFn: (frasco: string) =>
      apiClient.post(`/api/v1/clinic/estoque/frascos/${frasco}/encerrar`, { motivo: "Frasco vencido" }),
    onSuccess: recarregar,
    onError: showApiError,
  });

  if (q.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (q.isError || !q.data) return <p className="text-sm text-destructive">{t("Não foi possível ler os alertas.")}</p>;
  const { alertas, pode_movimentar } = q.data;
  if (alertas.length === 0) {
    return (
      <p className="text-sm text-text-muted" data-testid="estoque-sem-alertas">
        {t("Nenhum alerta. A lista é atualizada de hora em hora.")}
      </p>
    );
  }
  const dia = (iso: unknown) => (typeof iso === "string" ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(tag) : "");

  const descricao = (a: Alerta): string => {
    const d = a.detalhe;
    switch (a.tipo) {
      case "abaixo_minimo":
        return `${t("saldo")} ${quantidade(num(d.saldo), tag)} ${String(d.unidade ?? "")} · ${t("mínimo")} ${quantidade(num(d.minimo), tag)}`;
      case "ponto_pedido":
        return `${t("saldo")} ${quantidade(num(d.saldo), tag)} ${String(d.unidade ?? "")} · ${t("ponto de pedido")} ${quantidade(num(d.ponto_pedido), tag)}`;
      case "validade_proxima":
        return `${t("vence em")} ${dia(d.validade)} (${num(d.dias)} ${t("dias")}) · ${t("saldo")} ${quantidade(num(d.saldo), tag)}`;
      case "lote_vencido":
        return `${t("venceu em")} ${dia(d.validade)} · ${t("saldo")} ${quantidade(num(d.saldo), tag)}`;
      case "frasco_vencido":
        return `${t("sobra")} ${quantidade(num(d.conteudo), tag)}`;
      case "pendencias_baixa":
        return `${num(d.quantidade)} ${t("pendência(s) em Estoque › Pendências")}`;
    }
  };

  return (
    <ul className="divide-y rounded-xl border" data-testid="estoque-alertas">
      {alertas.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm" data-testid="estoque-alerta">
          <span className="space-y-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant={a.tipo === "lote_vencido" || a.tipo === "frasco_vencido" || a.tipo === "abaixo_minimo" ? "error" : "warning"}>
                {t(ROTULO[a.tipo])}
              </Badge>
              {a.produto ? <span className="font-medium">{a.produto}</span> : null}
              {a.lote ? (
                <span className="text-xs text-text-muted">
                  {t("lote")} {a.lote}
                </span>
              ) : null}
            </span>
            <span className="block text-xs text-text-muted">{descricao(a)}</span>
          </span>
          {pode_movimentar ? (
            <span className="flex gap-1">
              {a.tipo === "frasco_vencido" && a.frasco_id ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => registrarPerda.mutate(a.frasco_id!)}
                  disabled={registrarPerda.isPending}
                  data-testid="estoque-alerta-perda"
                >
                  {t("Registrar perda")}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const motivo = window.prompt(t("Por que dispensar este alerta? (não volta por 7 dias)"));
                  if (motivo && motivo.trim().length >= 3) dispensar.mutate({ id: a.id, motivo: motivo.trim() });
                }}
                disabled={dispensar.isPending}
                data-testid="estoque-alerta-dispensar"
              >
                {t("Dispensar")}
              </Button>
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
