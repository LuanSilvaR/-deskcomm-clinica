"use client";
/**
 * FORK clinic (orçamento O5) — o painel de orçamentos: indicadores do mês e a
 * lista, com filtro por status. Cada linha abre a aba Orçamentos do paciente.
 */
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { Indicadores } from "@/lib/clinic/orcamentos/indicadores";
import {
  ROTULO_DA_FORMA,
  ROTULO_DO_STATUS_DO_ORCAMENTO,
  STATUS_DO_ORCAMENTO,
  type FormaDePagamento,
  type StatusDoOrcamento,
} from "@/lib/clinic/orcamentos/orcamento";
import { formatarReais } from "@/lib/clinic/orcamentos/precos";

type Linha = {
  id: string;
  contact_id: string;
  paciente: string | null;
  numero: number;
  versao: number;
  status: StatusDoOrcamento;
  total_cents: number;
  forma: FormaDePagamento | null;
  parcelas: number;
  validade_ate: string;
  created_at: string;
};
type Dados = { ligado: boolean; mes: string; indicadores: Indicadores; orcamentos: Linha[] };

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function PainelDeOrcamentos() {
  const t = useT();
  const tag = useTagDeIdioma();
  const [mes, setMes] = useState(mesAtual());
  const [status, setStatus] = useState<"" | StatusDoOrcamento>("");
  const q = useQuery({
    queryKey: ["clinic", "orcamentos", "painel", mes, status],
    queryFn: async () =>
      (
        await apiClient.get<{ data: Dados }>(
          `/api/v1/clinic/orcamentos/painel?mes=${mes}${status ? `&status=${status}` : ""}`,
        )
      ).data,
  });

  if (q.isLoading) return <p className="text-sm text-text-muted">{t("Carregando...")}</p>;
  if (q.isError || !q.data) return <p className="text-sm text-danger">{t("Não foi possível carregar os orçamentos.")}</p>;
  const d = q.data;
  if (!d.ligado) {
    return (
      <p className="rounded-xl border bg-muted p-4 text-sm" data-testid="painel-orcamentos-desligado">
        {t("Os orçamentos estão desligados nesta clínica. Ligue em Configurações › Profissionais.")}
      </p>
    );
  }
  const i = d.indicadores;
  const cartoes: Array<{ id: string; rotulo: string; valor: string; detalhe?: string }> = [
    { id: "enviados", rotulo: t("Enviados no mês"), valor: String(i.enviados) },
    {
      id: "conversao",
      rotulo: t("Conversão"),
      valor: i.conversao_pct === null ? "—" : `${String(i.conversao_pct).replace(".", ",")}%`,
      detalhe: `${i.aprovados_dos_enviados} ${t("de")} ${i.enviados} ${t("enviados viraram contrato")}`,
    },
    { id: "valor", rotulo: t("Valor aprovado no mês"), valor: formatarReais(i.valor_aprovado_cents), detalhe: `${i.aprovados} ${t("aprovados")}` },
    { id: "ticket", rotulo: t("Ticket médio"), valor: i.ticket_medio_cents === null ? "—" : formatarReais(i.ticket_medio_cents) },
    { id: "aberto", rotulo: t("Aguardando aceite"), valor: String(i.em_aberto) },
    { id: "perdidos", rotulo: t("Recusados / expirados no mês"), valor: `${i.recusados} / ${i.expirados}` },
  ];

  return (
    <div className="space-y-4" data-testid="painel-orcamentos">
      <div className="flex flex-wrap items-end gap-2">
        <label className="block space-y-1 text-sm">
          <span>{t("Mês")}</span>
          <input
            type="month"
            className="min-h-11 rounded-md border p-2"
            value={mes}
            onChange={(e) => e.target.value && setMes(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{t("Status")}</span>
          <select
            className="min-h-11 rounded-md border p-2"
            value={status}
            onChange={(e) => setStatus(e.target.value as "" | StatusDoOrcamento)}
          >
            <option value="">{t("Todos")}</option>
            {STATUS_DO_ORCAMENTO.map((s) => (
              <option key={s} value={s}>
                {t(ROTULO_DO_STATUS_DO_ORCAMENTO[s])}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {cartoes.map((c) => (
          <div key={c.id} className="rounded-xl border p-3" data-testid={`indicador-${c.id}`}>
            <p className="text-xs text-text-muted">{c.rotulo}</p>
            <p className="text-xl font-semibold">{c.valor}</p>
            {c.detalhe ? <p className="text-xs text-text-muted">{c.detalhe}</p> : null}
          </div>
        ))}
      </div>
      <p className="text-xs text-text-muted">
        {t("Conversão = dos orçamentos enviados no mês, quantos estão aprovados. Valor e ticket médio contam os aprovados no mês.")}
      </p>

      {d.orcamentos.length === 0 ? (
        <p className="text-sm text-text-muted">{t("Nenhum orçamento neste período.")}</p>
      ) : (
        <ul className="divide-y rounded-xl border" data-testid="lista-orcamentos">
          {d.orcamentos.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm" data-testid="painel-orcamento">
              <div className="min-w-0">
                <Link className="font-medium underline-offset-4 hover:underline" href={`/app/contacts/${o.contact_id}?aba=orcamentos`}>
                  {o.paciente ?? t("Paciente")}
                </Link>
                <p className="text-xs text-text-muted">
                  {o.versao > 1 ? `Nº ${o.numero} v${o.versao}` : `Nº ${o.numero}`} · {t("válido até")}{" "}
                  {new Date(`${o.validade_ate}T12:00:00`).toLocaleDateString(tag)}
                  {o.forma
                    ? ` · ${t(ROTULO_DA_FORMA[o.forma])}${o.forma === "parcelado" ? ` ${o.parcelas}×` : ""}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{t(ROTULO_DO_STATUS_DO_ORCAMENTO[o.status])}</Badge>
                <span className="font-semibold">{formatarReais(o.total_cents)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
