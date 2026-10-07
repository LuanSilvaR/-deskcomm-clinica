"use client";

/**
 * FORK clinic (estoque E6) — inventário por local.
 *
 * Abrir fotografa o saldo de cada lote do local; cada um conta o que vê
 * (contagem salva ao sair do campo); fechar acerta o sistema pela contagem, numa
 * só movimentação, com motivo. Lote não contado fica como está. Cancelar não
 * mexe no saldo.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { LocalDeEstoque } from "@/lib/clinic/estoque/posicao";

import { CHAVE_DO_ESTOQUE, quantidade } from "./tipos";

interface InventarioResumo {
  id: string;
  local_id: string;
  status: "aberto" | "fechado" | "cancelado";
  motivo: string | null;
  created_at: string;
}
interface ItemDoInventario {
  id: string;
  produto: string;
  unidade: string;
  lote: string | null;
  validade: string | null;
  quantidade_sistema: number;
  contado: number | null;
}

const CHAVE = ["clinic", "estoque", "inventarios"] as const;
const SELECT = "h-11 rounded-md border bg-surface px-2 text-sm md:h-9";
const ROTULO: Record<InventarioResumo["status"], string> = { aberto: "Aberto", fechado: "Fechado", cancelado: "Cancelado" };

export function Inventarios({ locais }: { locais: LocalDeEstoque[] }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const qc = useQueryClient();
  const ativos = locais.filter((l) => l.ativo);
  const [local, setLocal] = useState(ativos.find((l) => l.padrao)?.id ?? ativos[0]?.id ?? "");
  const [aberto, setAberto] = useState<string | null>(null);
  const q = useQuery({
    queryKey: [...CHAVE],
    queryFn: async () =>
      (await apiClient.get<{ data: { inventarios: InventarioResumo[]; pode_inventariar: boolean } }>("/api/v1/clinic/estoque/inventarios")).data,
  });
  const abrir = useMutation({
    mutationFn: () => apiClient.post<{ data: { id: string } }>("/api/v1/clinic/estoque/inventarios", { local_id: local }),
    onSuccess: (r) => {
      setAberto(r.data.id);
      void qc.invalidateQueries({ queryKey: [...CHAVE] });
    },
    onError: showApiError,
  });
  const nomeDoLocal = (id: string) => locais.find((l) => l.id === id)?.nome ?? "—";

  if (aberto) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setAberto(null)} data-testid="inventario-voltar">
          ← {t("Voltar aos inventários")}
        </Button>
        <DetalheDoInventario id={aberto} nomeDoLocal={nomeDoLocal} podeInventariar={Boolean(q.data?.pode_inventariar)} />
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="estoque-inventarios">
      {q.data?.pode_inventariar ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs">
            {t("Local a contar")}
            <select className={SELECT} value={local} onChange={(e) => setLocal(e.target.value)} data-testid="inventario-local">
              {ativos.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={() => abrir.mutate()} disabled={!local || abrir.isPending} data-testid="inventario-abrir">
            {t("Abrir inventário")}
          </Button>
        </div>
      ) : null}
      {q.isLoading ? <p className="text-sm text-text-muted">{t("Carregando…")}</p> : null}
      {q.data && q.data.inventarios.length === 0 ? <p className="text-sm text-text-muted">{t("Nenhum inventário ainda.")}</p> : null}
      <ul className="divide-y rounded-xl border">
        {(q.data?.inventarios ?? []).map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => setAberto(i.id)}
              className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left text-sm"
              data-testid="inventario"
            >
              <span>
                {nomeDoLocal(i.local_id)} · {new Date(i.created_at).toLocaleString(tag, { dateStyle: "short", timeStyle: "short" })}
              </span>
              <Badge variant={i.status === "aberto" ? "warning" : i.status === "fechado" ? "success" : "secondary"}>{t(ROTULO[i.status])}</Badge>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetalheDoInventario({
  id,
  nomeDoLocal,
  podeInventariar,
}: {
  id: string;
  nomeDoLocal: (id: string) => string;
  podeInventariar: boolean;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const qc = useQueryClient();
  const chave = [...CHAVE, id];
  const q = useQuery({
    queryKey: chave,
    queryFn: async () =>
      (await apiClient.get<{ data: { inventario: InventarioResumo; itens: ItemDoInventario[] } }>(`/api/v1/clinic/estoque/inventarios/${id}`)).data,
  });
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: [...CHAVE] });
    void qc.invalidateQueries({ queryKey: [...CHAVE_DO_ESTOQUE] });
    void qc.invalidateQueries({ queryKey: ["clinic", "estoque", "movimentos"] });
  };
  const contar = useMutation({
    mutationFn: ({ item, contado }: { item: string; contado: number | null }) =>
      apiClient.patch(`/api/v1/clinic/estoque/inventarios/${id}/itens/${item}`, { contado }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chave }),
    onError: showApiError,
  });
  const fechar = useMutation({
    mutationFn: (motivo: string | null) => apiClient.post(`/api/v1/clinic/estoque/inventarios/${id}/fechar`, { motivo }),
    onSuccess: recarregar,
    onError: showApiError,
  });
  const cancelar = useMutation({
    mutationFn: () => apiClient.post(`/api/v1/clinic/estoque/inventarios/${id}/cancelar`, {}),
    onSuccess: recarregar,
    onError: showApiError,
  });

  if (q.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (q.isError || !q.data) return <p className="text-sm text-destructive">{t("Não foi possível ler o inventário.")}</p>;
  const { inventario, itens } = q.data;
  const editavel = inventario.status === "aberto" && podeInventariar;
  const contados = itens.filter((i) => i.contado !== null).length;

  return (
    <div className="space-y-3" data-testid="inventario-detalhe">
      <p className="text-sm">
        <span className="font-medium">{nomeDoLocal(inventario.local_id)}</span> · {t(ROTULO[inventario.status])}
        {inventario.motivo ? ` · ${inventario.motivo}` : ""}
      </p>
      {itens.length === 0 ? <p className="text-sm text-text-muted">{t("Nenhum lote com saldo neste local.")}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-text-muted">
            <tr>
              <th className="py-1 pr-2">{t("Produto")}</th>
              <th className="py-1 pr-2">{t("Lote")}</th>
              <th className="py-1 pr-2 text-right">{t("No sistema")}</th>
              <th className="py-1 pr-2">{t("Contado")}</th>
              <th className="py-1 text-right">{t("Diferença")}</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => {
              const diferenca = i.contado === null ? null : i.contado - i.quantidade_sistema;
              return (
                <tr key={i.id} className="border-t" data-testid="inventario-item">
                  <td className="py-1 pr-2">{i.produto}</td>
                  <td className="py-1 pr-2">
                    {i.lote ?? t("sem lote")}
                    {i.validade ? ` · ${new Date(`${i.validade}T12:00:00`).toLocaleDateString(tag)}` : ""}
                  </td>
                  <td className="py-1 pr-2 text-right">
                    {quantidade(i.quantidade_sistema, tag)} {i.unidade}
                  </td>
                  <td className="py-1 pr-2">
                    {editavel ? (
                      <Input
                        key={`${i.id}-${i.contado}`}
                        inputMode="decimal"
                        aria-label={t("Quantidade contada")}
                        className="h-11 w-28 md:h-9"
                        defaultValue={i.contado === null ? "" : String(i.contado)}
                        onBlur={(e) => {
                          const v = e.target.value.trim().replace(",", ".");
                          const contado = v === "" ? null : Number(v);
                          if (contado !== null && !(contado >= 0)) return;
                          if (contado !== i.contado) contar.mutate({ item: i.id, contado });
                        }}
                        data-testid="inventario-contado"
                      />
                    ) : i.contado === null ? (
                      "—"
                    ) : (
                      quantidade(i.contado, tag)
                    )}
                  </td>
                  <td className={`py-1 text-right ${diferenca && diferenca < 0 ? "text-destructive" : ""}`}>
                    {diferenca === null ? "—" : `${diferenca > 0 ? "+" : ""}${quantidade(diferenca, tag)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editavel ? (
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              const motivo = window.prompt(t("Motivo do inventário (opcional, fica no histórico)"), t("Contagem do estoque"));
              if (motivo !== null) fechar.mutate(motivo.trim().length >= 3 ? motivo.trim() : null);
            }}
            disabled={contados === 0 || fechar.isPending}
            data-testid="inventario-fechar"
          >
            {t("Fechar e acertar o estoque")} ({contados}/{itens.length})
          </Button>
          <Button variant="ghost" onClick={() => cancelar.mutate()} disabled={cancelar.isPending} data-testid="inventario-cancelar">
            {t("Cancelar inventário")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
