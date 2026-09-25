"use client";

/**
 * FORK clinic (prontuário F5) — os procedimentos EXECUTADOS no atendimento, com
 * os insumos gastos (produto, quantidade, lote, validade).
 *
 * Diferente de conduta e evolução, aqui há vários itens: cada um salva com o
 * botão (versão esperada; conflito não sobrescreve). Lançado por engano com o
 * atendimento aberto → "Anular" com motivo (fica no histórico). Finalizado →
 * leitura + adendo.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ListaDeAdendos, NovoAdendo } from "@/components/clinic/atendimento/Adendos";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { AdendoLido, InsumoLido, ProcedimentoLido } from "@/lib/clinic/prontuario/leitura";

interface Opcoes {
  procedimentos: Array<{ id: string; nome: string }>;
  produtos: Array<{ id: string; nome: string; codigo: string }>;
}
interface InsumoEditavel {
  descricao: string;
  quantidade: string;
  unidade: string;
  product_id: string;
  lote: string;
  validade: string;
}
interface Parametro {
  chave: string;
  valor: string;
}

const SELECT = "h-11 w-full rounded-md border bg-surface px-2 text-sm md:h-9";
const vazioInsumo = (): InsumoEditavel => ({ descricao: "", quantidade: "1", unidade: "un", product_id: "", lote: "", validade: "" });

export function ProcedimentoLidoView({ p }: { p: ProcedimentoLido }) {
  const t = useT();
  const tag = useTagDeIdioma();
  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium">
        {p.descricao}
        {p.regiao ? <span className="text-text-muted"> · {p.regiao}</span> : null}
      </p>
      {Object.keys(p.parametros).length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {Object.entries(p.parametros).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {p.intercorrencias ? (
        <p>
          <span className="text-xs text-text-muted">{t("Intercorrências")}: </span>
          <span className="whitespace-pre-wrap">{p.intercorrencias}</span>
        </p>
      ) : null}
      {p.observacoes ? <p className="whitespace-pre-wrap text-text-muted">{p.observacoes}</p> : null}
      {p.insumos.length > 0 ? (
        <table className="w-full text-xs">
          <caption className="text-left text-text-muted">{t("Insumos")}</caption>
          <tbody>
            {p.insumos.map((i: InsumoLido) => (
              <tr key={i.id} className="border-t">
                <td className="py-1">{i.descricao}</td>
                <td className="py-1 text-right">
                  {i.quantidade.toLocaleString(tag)} {i.unidade}
                </td>
                <td className="py-1 pl-2">{i.lote ? `${t("Lote")} ${i.lote}` : ""}</td>
                <td className="py-1 pl-2">
                  {i.validade ? `${t("Validade")} ${new Date(`${i.validade}T12:00:00`).toLocaleDateString(tag)}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

function Editor({
  atendimentoId,
  inicial,
  opcoes,
  chaveParaRecarregar,
  aoFechar,
}: {
  atendimentoId: string;
  inicial: ProcedimentoLido | null;
  opcoes: Opcoes;
  chaveParaRecarregar: readonly unknown[];
  aoFechar: () => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [procId, setProcId] = useState(inicial?.procedure_id ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [regiao, setRegiao] = useState(inicial?.regiao ?? "");
  const [parametros, setParametros] = useState<Parametro[]>(
    Object.entries(inicial?.parametros ?? {}).map(([chave, valor]) => ({ chave, valor })),
  );
  const [intercorrencias, setIntercorrencias] = useState(inicial?.intercorrencias ?? "");
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? "");
  const [insumos, setInsumos] = useState<InsumoEditavel[]>(
    (inicial?.insumos ?? []).map((i) => ({
      descricao: i.descricao,
      quantidade: String(i.quantidade),
      unidade: i.unidade,
      product_id: i.product_id ?? "",
      lote: i.lote ?? "",
      validade: i.validade ?? "",
    })),
  );

  const salvar = useMutation({
    mutationFn: () =>
      apiClient.put(`/api/v1/clinic/atendimentos/${atendimentoId}/procedimentos`, {
        id: inicial?.id ?? null,
        versao: inicial?.versao ?? 0,
        procedimento: {
          descricao: descricao.trim(),
          procedure_id: procId || null,
          regiao: regiao.trim() || null,
          parametros: Object.fromEntries(parametros.filter((p) => p.chave.trim() && p.valor.trim()).map((p) => [p.chave.trim(), p.valor.trim()])),
          intercorrencias: intercorrencias.trim() || null,
          observacoes: observacoes.trim() || null,
        },
        insumos: insumos
          .filter((i) => i.descricao.trim())
          .map((i) => ({
            descricao: i.descricao.trim(),
            quantidade: Number(i.quantidade.replace(",", ".")),
            unidade: i.unidade.trim() || "un",
            product_id: i.product_id || null,
            lote: i.lote.trim() || null,
            validade: i.validade || null,
          })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chaveParaRecarregar });
      aoFechar();
    },
    onError: showApiError,
  });
  const insumosValidos = insumos.every((i) => !i.descricao.trim() || Number(i.quantidade.replace(",", ".")) > 0);

  return (
    <form
      className="space-y-3 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
      data-testid="procedimento-editor"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="block font-medium">{t("Procedimento do catálogo")}</span>
          <select
            className={`mt-1 ${SELECT}`}
            value={procId}
            onChange={(e) => {
              setProcId(e.target.value);
              const nome = opcoes.procedimentos.find((p) => p.id === e.target.value)?.nome;
              if (nome && !descricao.trim()) setDescricao(nome);
            }}
          >
            <option value="">—</option>
            {opcoes.procedimentos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="block font-medium">{t("O que foi feito")}</span>
          <Input className="mt-1 h-11 md:h-9" value={descricao} maxLength={200} onChange={(e) => setDescricao(e.target.value)} required data-testid="procedimento-descricao" />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="block font-medium">{t("Região")}</span>
          <Input className="mt-1 h-11 md:h-9" value={regiao} maxLength={200} onChange={(e) => setRegiao(e.target.value)} />
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("Parâmetros técnicos")}</legend>
        {parametros.map((p, i) => (
          <div key={i} className="flex gap-2">
            <Input
              aria-label={t("Parâmetro")}
              placeholder={t("Parâmetro")}
              className="h-11 md:h-9"
              maxLength={60}
              value={p.chave}
              onChange={(e) => setParametros((l) => l.map((x, j) => (j === i ? { ...x, chave: e.target.value } : x)))}
            />
            <Input
              aria-label={t("Valor")}
              placeholder={t("Valor")}
              className="h-11 md:h-9"
              maxLength={500}
              value={p.valor}
              onChange={(e) => setParametros((l) => l.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))}
            />
            <Button type="button" variant="ghost" onClick={() => setParametros((l) => l.filter((_, j) => j !== i))}>
              {t("Remover")}
            </Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={() => setParametros((l) => [...l, { chave: "", valor: "" }])} disabled={parametros.length >= 30}>
          {t("Adicionar parâmetro")}
        </Button>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("Insumos")}</legend>
        {insumos.map((ins, i) => {
          const mudar = (parcial: Partial<InsumoEditavel>) => setInsumos((l) => l.map((x, j) => (j === i ? { ...x, ...parcial } : x)));
          return (
            <div key={i} className="grid gap-2 rounded-md border p-2 sm:grid-cols-6" data-testid="insumo">
              <select
                aria-label={t("Produto")}
                className={`${SELECT} sm:col-span-2`}
                value={ins.product_id}
                onChange={(e) => {
                  const prod = opcoes.produtos.find((p) => p.id === e.target.value);
                  mudar({ product_id: e.target.value, descricao: ins.descricao || prod?.nome || "" });
                }}
              >
                <option value="">{t("Produto (opcional)")}</option>
                {opcoes.produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
              <Input aria-label={t("Descrição do insumo")} placeholder={t("Descrição")} className="h-11 sm:col-span-2 md:h-9" maxLength={200} value={ins.descricao} onChange={(e) => mudar({ descricao: e.target.value })} data-testid="insumo-descricao" />
              <Input aria-label={t("Quantidade")} inputMode="decimal" className="h-11 md:h-9" value={ins.quantidade} onChange={(e) => mudar({ quantidade: e.target.value })} />
              <Input aria-label={t("Unidade")} className="h-11 md:h-9" maxLength={20} value={ins.unidade} onChange={(e) => mudar({ unidade: e.target.value })} />
              <Input aria-label={t("Lote")} placeholder={t("Lote")} className="h-11 sm:col-span-2 md:h-9" maxLength={60} value={ins.lote} onChange={(e) => mudar({ lote: e.target.value })} data-testid="insumo-lote" />
              <label className="flex items-center gap-2 text-xs sm:col-span-3">
                {t("Validade")}
                <Input type="date" className="h-11 md:h-9" value={ins.validade} onChange={(e) => mudar({ validade: e.target.value })} />
              </label>
              <Button type="button" variant="ghost" onClick={() => setInsumos((l) => l.filter((_, j) => j !== i))}>
                {t("Remover")}
              </Button>
            </div>
          );
        })}
        <Button type="button" size="sm" variant="outline" onClick={() => setInsumos((l) => [...l, vazioInsumo()])} disabled={insumos.length >= 50} data-testid="insumo-novo">
          {t("Adicionar insumo")}
        </Button>
      </fieldset>

      <label className="block text-sm">
        <span className="block font-medium">{t("Intercorrências")}</span>
        <Textarea className="mt-1" rows={2} maxLength={2000} value={intercorrencias} onChange={(e) => setIntercorrencias(e.target.value)} />
      </label>
      <label className="block text-sm">
        <span className="block font-medium">{t("Observações")}</span>
        <Textarea className="mt-1" rows={2} maxLength={2000} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={!descricao.trim() || !insumosValidos || salvar.isPending} data-testid="procedimento-salvar">
          {salvar.isPending ? t("Salvando…") : t("Salvar procedimento")}
        </Button>
        <Button type="button" variant="ghost" onClick={aoFechar}>
          {t("Cancelar")}
        </Button>
      </div>
    </form>
  );
}

export function SecaoProcedimentos({
  atendimentoId,
  procedimentos,
  adendos,
  podeRegistrar,
  podeAdendo,
  obrigatoria,
  chaveParaRecarregar,
}: {
  atendimentoId: string;
  procedimentos: readonly ProcedimentoLido[];
  adendos: readonly AdendoLido[];
  podeRegistrar: boolean;
  podeAdendo: boolean;
  obrigatoria: boolean;
  chaveParaRecarregar: readonly unknown[];
}) {
  const t = useT();
  const qc = useQueryClient();
  const [editando, setEditando] = useState<string | "novo" | null>(null);
  const opcoes = useQuery({
    queryKey: ["clinic", "procedimentos", "opcoes"],
    enabled: podeRegistrar,
    queryFn: async () => (await apiClient.get<{ data: Opcoes }>("/api/v1/clinic/procedimentos/opcoes")).data,
  });
  const anular = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      apiClient.post(`/api/v1/clinic/atendimentos/${atendimentoId}/procedimentos/${id}/anular`, { motivo }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chaveParaRecarregar }),
    onError: showApiError,
  });
  const validos = procedimentos.filter((p) => p.status !== "anulado");

  return (
    <section className="space-y-3" data-testid="secao-procedimentos">
      <h2 className="text-lg font-semibold">{t("Procedimentos")}</h2>
      {obrigatoria && validos.length === 0 && podeRegistrar ? (
        <p className="text-xs text-destructive">{t("Registrar ao menos um procedimento é obrigatório para finalizar este atendimento.")}</p>
      ) : null}
      {procedimentos.length === 0 && !podeRegistrar ? <p className="text-sm text-text-muted">{t("Nada registrado.")}</p> : null}
      <ul className="space-y-3">
        {procedimentos.map((p) =>
          editando === p.id && opcoes.data ? (
            <li key={p.id}>
              <Editor atendimentoId={atendimentoId} inicial={p} opcoes={opcoes.data} chaveParaRecarregar={chaveParaRecarregar} aoFechar={() => setEditando(null)} />
            </li>
          ) : (
            <li key={p.id} className={`rounded-lg border p-3 ${p.status === "anulado" ? "opacity-60" : ""}`} data-testid="procedimento">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                {p.status === "anulado" ? (
                  <Badge variant="secondary">
                    {t("Anulado")}: {p.anulado_motivo}
                  </Badge>
                ) : (
                  <span />
                )}
                {podeRegistrar && p.status === "rascunho" ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditando(p.id)}>
                      {t("Editar")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const motivo = window.prompt(t("Motivo para anular este procedimento"));
                        if (motivo && motivo.trim().length >= 3) anular.mutate({ id: p.id, motivo: motivo.trim() });
                      }}
                    >
                      {t("Anular")}
                    </Button>
                  </div>
                ) : null}
              </div>
              <ProcedimentoLidoView p={p} />
              <ListaDeAdendos adendos={adendos.filter((a) => a.alvo_id === p.id)} />
              {podeAdendo && p.status === "finalizado" ? (
                <NovoAdendo atendimentoId={atendimentoId} alvoTipo="procedimento" alvoId={p.id} chaveParaRecarregar={chaveParaRecarregar} />
              ) : null}
            </li>
          ),
        )}
      </ul>
      {podeRegistrar ? (
        editando === "novo" && opcoes.data ? (
          <Editor atendimentoId={atendimentoId} inicial={null} opcoes={opcoes.data} chaveParaRecarregar={chaveParaRecarregar} aoFechar={() => setEditando(null)} />
        ) : (
          <Button variant="outline" onClick={() => setEditando("novo")} disabled={!opcoes.data} data-testid="procedimento-novo">
            {t("Registrar procedimento")}
          </Button>
        )
      ) : null}
    </section>
  );
}
