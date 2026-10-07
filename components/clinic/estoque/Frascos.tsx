"use client";

/**
 * FORK clinic (estoque E4) — frascos abertos de um produto fracionável.
 *
 * Abrir passa 1 unidade de estoque (ex.: 1 frasco = 100 U) do lacrado para o
 * frasco, sem mudar o saldo; a baixa pelo prontuário usa o frasco aberto
 * primeiro. Frasco vencido não entra mais na baixa e fica destacado aqui até
 * alguém encerrar — a sobra vira perda, com motivo.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { FrascoAberto } from "@/lib/clinic/estoque/posicao";

import { CHAVE_DO_ESTOQUE, quantidade } from "./tipos";

function useRecarregar() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: [...CHAVE_DO_ESTOQUE] });
    void qc.invalidateQueries({ queryKey: ["clinic", "estoque", "movimentos"] });
  };
}

export function BotaoAbrirFrasco({ loteId, localId }: { loteId: string; localId: string }) {
  const t = useT();
  const recarregar = useRecarregar();
  const abrir = useMutation({
    mutationFn: () => apiClient.post("/api/v1/clinic/estoque/frascos", { lote_id: loteId, local_id: localId }),
    onSuccess: recarregar,
    onError: showApiError,
  });
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => abrir.mutate()}
      disabled={abrir.isPending}
      data-testid="estoque-abrir-frasco"
    >
      {t("Abrir frasco")}
    </Button>
  );
}

export function FrascosDoProduto({
  frascos,
  unidade,
  codigoDoLote,
  nomeDoLocal,
  podeMovimentar,
}: {
  frascos: FrascoAberto[];
  unidade: string;
  codigoDoLote: (id: string) => string | null;
  nomeDoLocal: (id: string) => string;
  podeMovimentar: boolean;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const recarregar = useRecarregar();
  const encerrar = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      apiClient.post(`/api/v1/clinic/estoque/frascos/${id}/encerrar`, { motivo }),
    onSuccess: recarregar,
    onError: showApiError,
  });
  if (frascos.length === 0) return null;
  const quando = (iso: string) => new Date(iso).toLocaleString(tag, { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-1" data-testid="estoque-frascos">
      <p className="text-xs font-medium text-text-muted">{t("Frascos abertos")}</p>
      <ul className="divide-y rounded-md border text-sm">
        {frascos.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-2" data-testid="estoque-frasco">
            <span className="flex flex-wrap items-center gap-2">
              <span>
                {t("lote")} {codigoDoLote(f.lote_id) ?? t("sem lote")} · {nomeDoLocal(f.local_id)}
              </span>
              <span className="font-medium">
                {quantidade(f.conteudo, tag)} {unidade}
              </span>
              {f.vencido ? (
                <Badge variant="error">{t("vencido — registre a perda")}</Badge>
              ) : f.vence_em ? (
                <span className="text-xs text-text-muted">
                  {t("vence")} {quando(f.vence_em)}
                </span>
              ) : null}
            </span>
            {podeMovimentar ? (
              <Button
                size="sm"
                variant={f.vencido ? "destructive" : "ghost"}
                onClick={() => {
                  const motivo = window.prompt(t("Motivo para encerrar o frasco (a sobra vira perda)"));
                  if (motivo && motivo.trim().length >= 3) encerrar.mutate({ id: f.id, motivo: motivo.trim() });
                }}
                disabled={encerrar.isPending}
                data-testid="estoque-encerrar-frasco"
              >
                {t("Encerrar")}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
