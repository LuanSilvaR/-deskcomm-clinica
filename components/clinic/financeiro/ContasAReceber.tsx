"use client";

/**
 * FORK clinic (financeiro FN2) — Contas a receber: as parcelas de cartão e Pix
 * por vencimento, quanto entra em 30/60/90 dias, a baixa manual e a
 * antecipação (simula o custo antes de confirmar). Sem dado de paciente.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { ParcelaNaTela, Recebiveis } from "@/lib/clinic/financeiro/servidor";
import { formatCentsBRL } from "@/lib/money";

const CHAVE = ["clinic", "financeiro", "recebiveis"] as const;
const SELECT = "h-11 rounded-md border bg-surface px-2 text-sm md:h-9";

const ROTULO_DO_STATUS: Record<ParcelaNaTela["status"], string> = {
  prevista: "A receber",
  recebida: "Recebida",
  antecipada: "Antecipada",
  estornada: "Estornada",
};

export function ContasAReceber({ podeLancar }: { podeLancar: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const [status, setStatus] = useState<ParcelaNaTela["status"] | "">("prevista");
  const q = useQuery({
    queryKey: [...CHAVE, status],
    queryFn: async () =>
      (await apiClient.get<{ data: Recebiveis }>(`/api/v1/clinic/financeiro/recebiveis${status ? `?status=${status}` : ""}`)).data,
  });
  const recarregar = () => void qc.invalidateQueries({ queryKey: [...CHAVE] });
  const receber = useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/v1/clinic/financeiro/parcelas/${id}/receber`, {}),
    onSuccess: recarregar,
    onError: showApiError,
  });
  const [simulacao, setSimulacao] = useState<{ pagamento: string; parcelas: number; custo_cents: number; liquido_cents: number } | null>(
    null,
  );
  const simular = useMutation({
    mutationFn: async (pagamento: string) =>
      ({
        pagamento,
        ...(
          await apiClient.get<{ data: { parcelas: number; custo_cents: number; liquido_cents: number } }>(
            `/api/v1/clinic/financeiro/pagamentos/${pagamento}/antecipar`,
          )
        ).data,
      }),
    onSuccess: setSimulacao,
    onError: showApiError,
  });
  const antecipar = useMutation({
    mutationFn: (pagamento: string) => apiClient.post(`/api/v1/clinic/financeiro/pagamentos/${pagamento}/antecipar`, {}),
    onSuccess: () => {
      setSimulacao(null);
      recarregar();
    },
    onError: showApiError,
  });

  const d = q.data;
  return (
    <div className="space-y-4">
      {d ? (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="recebiveis-resumo">
          {(
            [
              ["Em 30 dias", d.a_receber.em_30],
              ["Em 60 dias", d.a_receber.em_60],
              ["Em 90 dias", d.a_receber.em_90],
              ["Total a receber", d.a_receber.total],
            ] as const
          ).map(([rotulo, valor]) => (
            <li key={rotulo} className="rounded-xl border p-3">
              <p className="text-xs text-text-muted">{t(rotulo)}</p>
              <p className="text-lg font-semibold tabular-nums">{formatCentsBRL(valor)}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        {t("Mostrar")}
        <select className={SELECT} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} data-testid="recebiveis-status">
          <option value="prevista">{t("A receber")}</option>
          <option value="recebida">{t("Recebidas")}</option>
          <option value="antecipada">{t("Antecipadas")}</option>
          <option value="estornada">{t("Estornadas")}</option>
          <option value="">{t("Todas")}</option>
        </select>
      </label>

      {simulacao ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted p-3 text-sm" data-testid="recebiveis-simulacao">
          <span>
            {t("Antecipar")} {simulacao.parcelas} {t("parcela(s)")}: {t("custo")} {formatCentsBRL(simulacao.custo_cents)} ·{" "}
            {t("entra hoje")} {formatCentsBRL(simulacao.liquido_cents)}
          </span>
          <Button size="sm" disabled={antecipar.isPending} onClick={() => antecipar.mutate(simulacao.pagamento)} data-testid="recebiveis-confirmar-antecipacao">
            {t("Confirmar antecipação")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSimulacao(null)}>
            {t("Cancelar")}
          </Button>
        </div>
      ) : null}

      {q.isLoading ? (
        <p className="text-sm text-text-muted">{t("Carregando…")}</p>
      ) : !d || d.parcelas.length === 0 ? (
        <p className="text-sm text-text-muted">{t("Nenhuma parcela aqui.")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[40rem] text-sm" data-testid="recebiveis-tabela">
            <thead>
              <tr className="text-left text-xs text-text-muted">
                <th className="p-2 font-medium">{t("Vencimento")}</th>
                <th className="p-2 font-medium">{t("Comanda")}</th>
                <th className="p-2 font-medium">{t("Parcela")}</th>
                <th className="p-2 font-medium">{t("Forma")}</th>
                <th className="p-2 text-right font-medium">{t("Bruto")}</th>
                <th className="p-2 text-right font-medium">{t("Taxa")}</th>
                <th className="p-2 text-right font-medium">{t("Líquido")}</th>
                <th className="p-2 font-medium">{t("Situação")}</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {d.parcelas.map((p) => (
                <tr key={p.id} className="border-t" data-testid="recebivel">
                  <td className="p-2 tabular-nums">{p.vencimento}</td>
                  <td className="p-2">{p.comanda ? `#${p.comanda}` : "—"}</td>
                  <td className="p-2">
                    {p.n}/{p.de}
                  </td>
                  <td className="p-2">
                    {p.forma ?? "—"}
                    {p.maquininha ? <span className="block text-xs text-text-muted">{p.maquininha}</span> : null}
                  </td>
                  <td className="p-2 text-right tabular-nums">{formatCentsBRL(p.bruto_cents)}</td>
                  <td className="p-2 text-right tabular-nums">{formatCentsBRL(p.taxa_cents + p.antecipacao_cents)}</td>
                  <td className="p-2 text-right tabular-nums">{formatCentsBRL(p.liquido_cents - p.antecipacao_cents)}</td>
                  <td className="p-2">
                    <Badge variant={p.status === "prevista" ? "info" : "secondary"}>{t(ROTULO_DO_STATUS[p.status])}</Badge>
                  </td>
                  <td className="p-2">
                    {p.status === "prevista" && podeLancar ? (
                      <span className="flex flex-wrap justify-end gap-1">
                        <Button size="sm" variant="ghost" disabled={receber.isPending} onClick={() => receber.mutate(p.id)} data-testid="recebivel-receber">
                          {t("Recebi")}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={simular.isPending} onClick={() => simular.mutate(p.pagamento_id)} data-testid="recebivel-antecipar">
                          {t("Antecipar")}
                        </Button>
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
