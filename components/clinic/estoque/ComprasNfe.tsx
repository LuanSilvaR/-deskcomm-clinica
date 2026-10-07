"use client";

/**
 * FORK clinic (estoque E5) — Compras pelo XML da NF-e.
 *
 * Enviar o XML → a nota entra em CONFERÊNCIA com o produto sugerido em cada
 * item (EAN, histórico do fornecedor ou nome — sempre sugestão). Quem compra
 * confere item a item (produto, quantas unidades de aplicação vêm em 1 unidade
 * da nota, lote e validade) ou ignora (frete, brinde). Lançar dá entrada no
 * local escolhido e, se pedido, cria a conta a pagar pendente.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";

import { CHAVE_DO_ESTOQUE, quantidade } from "./tipos";

interface NotaResumo {
  id: string;
  numero: string;
  serie: string;
  emissao: string | null;
  emitente_nome: string;
  total_cents: number;
  status: "conferencia" | "lancada" | "cancelada";
  created_at: string;
}
interface Item {
  id: string;
  numero: number;
  codigo: string;
  descricao: string;
  ean: string | null;
  unidade: string;
  quantidade: number;
  custo_total_cents: number;
  registro_anvisa: string | null;
  rastro: Array<{ lote: string; validade: string | null; quantidade?: number | null }>;
  product_id: string | null;
  origem_casamento: string | null;
  fator: number | null;
  lote: string | null;
  validade: string | null;
  ignorado: boolean;
  conferido: boolean;
}
interface Produto {
  id: string;
  nome: string;
  unidade_estoque: string | null;
  unidade_aplicacao: string | null;
  fator: number | null;
  rastreado: boolean;
}
interface Detalhe {
  nota: NotaResumo & { chave: string; emitente_cnpj: string | null; motivo: string | null; financial_entry_id: string | null };
  itens: Item[];
  produtos: Produto[];
  locais: Array<{ id: string; nome: string; padrao: boolean }>;
  contas: Array<{ id: string; nome: string }>;
  pode: { comprar: boolean; financeiro: boolean };
}

const CHAVE_DAS_NOTAS = ["clinic", "estoque", "nfe"] as const;
const SELECT = "h-11 w-full rounded-md border bg-surface px-2 text-sm md:h-9";

const ROTULO_DA_ORIGEM: Record<string, string> = {
  ean: "pelo EAN",
  historico: "pelo histórico do fornecedor",
  nome: "pelo nome (confira)",
  ia: "sugestão da IA (confira)",
  manual: "escolhido na conferência",
};
const ROTULO_DO_STATUS: Record<NotaResumo["status"], string> = {
  conferencia: "Em conferência",
  lancada: "Lançada",
  cancelada: "Cancelada",
};

async function enviarXml(arquivo: File): Promise<{ id: string; outro_destinatario: boolean; sugeridos: number }> {
  const form = new FormData();
  form.append("arquivo", arquivo, arquivo.name);
  const r = await fetch("/api/v1/clinic/estoque/nfe", { method: "POST", body: form, credentials: "same-origin" });
  const corpo = (await r.json().catch(() => null)) as {
    data?: { id: string; outro_destinatario: boolean; sugeridos: number };
    error?: { code?: string; message?: string; request_id?: string };
  } | null;
  if (!r.ok || !corpo?.data) {
    throw new ApiError(r.status, corpo?.error?.code ?? "internal_error", undefined, corpo?.error?.request_id ?? "", corpo?.error?.message ?? "");
  }
  return corpo.data;
}

const reais = (cents: number, tag: string) => (cents / 100).toLocaleString(tag, { style: "currency", currency: "BRL" });

export function ComprasNfe({ podeComprar }: { podeComprar: boolean }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const qc = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const q = useQuery({
    queryKey: [...CHAVE_DAS_NOTAS],
    queryFn: async () => (await apiClient.get<{ data: { notas: NotaResumo[] } }>("/api/v1/clinic/estoque/nfe")).data,
  });
  const enviar = useMutation({
    mutationFn: enviarXml,
    onSuccess: (r) => {
      setAviso(
        r.outro_destinatario
          ? t("Atenção: o CNPJ do destinatário desta nota não é o da clínica. Confira antes de lançar.")
          : null,
      );
      setAberta(r.id);
      void qc.invalidateQueries({ queryKey: [...CHAVE_DAS_NOTAS] });
    },
    onError: showApiError,
  });

  if (aberta) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setAberta(null)} data-testid="nfe-voltar">
          ← {t("Voltar às notas")}
        </Button>
        {aviso ? <p className="rounded-md border border-warning p-2 text-sm">{aviso}</p> : null}
        <ConferenciaDaNota id={aberta} />
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="estoque-compras">
      {podeComprar ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={entrada}
            type="file"
            accept=".xml,application/xml,text/xml"
            className="hidden"
            data-testid="nfe-arquivo"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) enviar.mutate(f);
              e.target.value = "";
            }}
          />
          <Button onClick={() => entrada.current?.click()} disabled={enviar.isPending} data-testid="nfe-enviar">
            {enviar.isPending ? t("Lendo a nota…") : t("Importar XML da NF-e")}
          </Button>
          <span className="text-xs text-text-muted">{t("O arquivo .xml que o fornecedor envia (até 1 MB).")}</span>
        </div>
      ) : null}
      {q.isLoading ? <p className="text-sm text-text-muted">{t("Carregando…")}</p> : null}
      {q.data && q.data.notas.length === 0 ? (
        <p className="text-sm text-text-muted">{t("Nenhuma nota importada ainda.")}</p>
      ) : null}
      <ul className="divide-y rounded-xl border">
        {(q.data?.notas ?? []).map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => setAberta(n.id)}
              className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left text-sm"
              data-testid="nfe-nota"
            >
              <span>
                <span className="font-medium">
                  {t("NF-e")} {n.numero}/{n.serie}
                </span>{" "}
                · {n.emitente_nome}
              </span>
              <span className="flex items-center gap-2">
                <span>{reais(n.total_cents, tag)}</span>
                <Badge variant={n.status === "conferencia" ? "warning" : n.status === "lancada" ? "success" : "secondary"}>
                  {t(ROTULO_DO_STATUS[n.status])}
                </Badge>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConferenciaDaNota({ id }: { id: string }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const qc = useQueryClient();
  const chave = [...CHAVE_DAS_NOTAS, id];
  const q = useQuery({
    queryKey: chave,
    queryFn: async () => (await apiClient.get<{ data: Detalhe }>(`/api/v1/clinic/estoque/nfe/${id}`)).data,
  });
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: [...CHAVE_DAS_NOTAS] });
    void qc.invalidateQueries({ queryKey: [...CHAVE_DO_ESTOQUE] });
  };
  const [local, setLocal] = useState("");
  const [conta, setConta] = useState("");
  const lancar = useMutation({
    mutationFn: (d: Detalhe) =>
      apiClient.post(`/api/v1/clinic/estoque/nfe/${id}/lancar`, {
        local_id: local || d.locais.find((l) => l.padrao)?.id || d.locais[0]?.id,
        conta_id: conta || null,
      }),
    onSuccess: recarregar,
    onError: showApiError,
  });
  const cancelar = useMutation({
    mutationFn: (motivo: string) => apiClient.post(`/api/v1/clinic/estoque/nfe/${id}/cancelar`, { motivo }),
    onSuccess: recarregar,
    onError: showApiError,
  });

  if (q.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (q.isError || !q.data) return <p className="text-sm text-destructive">{t("Não foi possível ler a nota.")}</p>;
  const d = q.data;
  const aberta = d.nota.status === "conferencia" && d.pode.comprar;
  const faltam = d.itens.filter((i) => !i.conferido).length;

  return (
    <div className="space-y-3" data-testid="nfe-conferencia">
      <header className="text-sm">
        <p className="font-medium">
          {t("NF-e")} {d.nota.numero}/{d.nota.serie} · {d.nota.emitente_nome} · {reais(d.nota.total_cents, tag)}
        </p>
        <p className="text-xs text-text-muted">
          {t(ROTULO_DO_STATUS[d.nota.status])}
          {d.nota.motivo ? ` · ${d.nota.motivo}` : ""}
          {d.nota.financial_entry_id ? ` · ${t("conta a pagar criada")}` : ""}
        </p>
      </header>
      <ul className="space-y-2">
        {d.itens.map((i) => (
          <ItemDaNota key={i.id} notaId={id} item={i} produtos={d.produtos} editavel={aberta} aoSalvar={() => void qc.invalidateQueries({ queryKey: chave })} />
        ))}
      </ul>
      {aberta ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
          <label className="grid gap-1 text-xs">
            {t("Dar entrada em")}
            <select className={SELECT} value={local} onChange={(e) => setLocal(e.target.value)} data-testid="nfe-local">
              {d.locais.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
          </label>
          {d.pode.financeiro ? (
            <label className="grid gap-1 text-xs">
              {t("Conta a pagar (opcional)")}
              <select className={SELECT} value={conta} onChange={(e) => setConta(e.target.value)} data-testid="nfe-conta">
                <option value="">{t("Não gerar conta a pagar")}</option>
                {d.contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Button onClick={() => lancar.mutate(d)} disabled={faltam > 0 || lancar.isPending} data-testid="nfe-lancar">
            {faltam > 0 ? `${t("Faltam conferir")} ${faltam}` : t("Lançar no estoque")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const motivo = window.prompt(t("Motivo para cancelar a importação desta nota"));
              if (motivo && motivo.trim().length >= 3) cancelar.mutate(motivo.trim());
            }}
            disabled={cancelar.isPending}
            data-testid="nfe-cancelar"
          >
            {t("Cancelar importação")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ItemDaNota({
  notaId,
  item: i,
  produtos,
  editavel,
  aoSalvar,
}: {
  notaId: string;
  item: Item;
  produtos: Produto[];
  editavel: boolean;
  aoSalvar: () => void;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const rastroUnico = i.rastro.length === 1 ? i.rastro[0] : null;
  // estoque E10: vários lotes no XML entram um a um, como a nota diz
  const variosLotes = i.rastro.length > 1;
  const [produto, setProduto] = useState(i.product_id ?? "");
  const p = produtos.find((x) => x.id === produto);
  const [fator, setFator] = useState(String(i.fator ?? p?.fator ?? 1));
  const [lote, setLote] = useState(i.lote ?? rastroUnico?.lote ?? "");
  const [validade, setValidade] = useState(i.validade ?? rastroUnico?.validade ?? "");
  const salvar = useMutation({
    mutationFn: (corpo: Record<string, unknown>) => apiClient.patch(`/api/v1/clinic/estoque/nfe/${notaId}/itens/${i.id}`, corpo),
    onSuccess: aoSalvar,
    onError: showApiError,
  });
  const nFator = Number(fator.replace(",", "."));
  const total = i.quantidade * (nFator > 0 ? nFator : 0);

  return (
    <li className="space-y-2 rounded-lg border p-3 text-sm" data-testid="nfe-item">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="font-medium">{i.descricao}</span>
          <span className="ml-2 text-xs text-text-muted">
            {i.codigo}
            {i.ean ? ` · EAN ${i.ean}` : ""}
            {i.registro_anvisa ? ` · ${t("Reg. ANVISA")} ${i.registro_anvisa}` : ""}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span>
            {quantidade(i.quantidade, tag)} {i.unidade} · {reais(i.custo_total_cents, tag)}
          </span>
          {i.ignorado ? <Badge variant="secondary">{t("ignorado")}</Badge> : i.conferido ? <Badge variant="success">{t("conferido")}</Badge> : null}
        </span>
      </div>
      {i.product_id && i.origem_casamento ? (
        <p className="text-xs text-text-muted">
          {t("Produto sugerido")} {t(ROTULO_DA_ORIGEM[i.origem_casamento] ?? i.origem_casamento)}
        </p>
      ) : null}
      {editavel ? (
        <div className="grid gap-2 sm:grid-cols-6">
          <select
            aria-label={t("Produto")}
            className={`${SELECT} sm:col-span-2`}
            value={produto}
            onChange={(e) => {
              setProduto(e.target.value);
              const novo = produtos.find((x) => x.id === e.target.value);
              if (novo?.fator) setFator(String(novo.fator));
            }}
            data-testid="nfe-item-produto"
          >
            <option value="">{t("Escolha o produto…")}</option>
            {produtos.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
          <label className="grid gap-1 text-xs">
            {t("Unidades de aplicação por")} {i.unidade}
            <Input inputMode="decimal" className="h-11 md:h-9" value={fator} onChange={(e) => setFator(e.target.value)} data-testid="nfe-item-fator" />
          </label>
          {variosLotes ? (
            <ul className="text-xs sm:col-span-2" data-testid="nfe-item-lotes">
              {i.rastro.map((r) => (
                <li key={r.lote}>
                  {t("Lote")} {r.lote} · {r.quantidade ?? "—"} {i.unidade}
                  {r.validade ? ` · ${new Date(`${r.validade}T12:00:00`).toLocaleDateString(tag)}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <>
            <Input
              aria-label={t("Lote")}
              placeholder={p?.rastreado ? t("Lote (obrigatório)") : t("Lote")}
              className="h-11 md:h-9"
              maxLength={60}
              value={lote}
              onChange={(e) => setLote(e.target.value)}
              data-testid="nfe-item-lote"
            />
            <Input
              type="date"
              aria-label={t("Validade")}
              className="h-11 md:h-9"
              value={validade}
              onChange={(e) => setValidade(e.target.value)}
              data-testid="nfe-item-validade"
            />
            </>
          )}
          <span className="flex gap-1">
            <Button
              size="sm"
              onClick={() =>
                salvar.mutate(
                  variosLotes
                    ? { product_id: produto, fator: nFator }
                    : { product_id: produto, fator: nFator, lote: lote.trim() || null, validade: validade || null },
                )
              }
              disabled={!produto || !(nFator > 0) || salvar.isPending}
              data-testid="nfe-item-conferir"
            >
              {t("Conferir")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => salvar.mutate({ ignorar: true })} disabled={salvar.isPending}>
              {t("Ignorar")}
            </Button>
          </span>
          {produto && p?.unidade_aplicacao ? (
            <p className="text-xs text-text-muted sm:col-span-6">
              {t("Entram")} {quantidade(total, tag)} {p.unidade_aplicacao}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
