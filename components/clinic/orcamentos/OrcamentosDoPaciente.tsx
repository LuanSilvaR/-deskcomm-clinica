"use client";

/**
 * FORK clinic (orçamento O2, migration 8007) — os orçamentos do paciente.
 *
 * Na seção "Orçamento" do atendimento (novo orçamento já ligado a ele) e na aba
 * "Orçamentos" da ficha. Monta o rascunho com itens da Tabela de preços,
 * desconto e a condição de pagamento (dinheiro, Pix, débito, crédito ou
 * parcelado); mostra a prévia dos totais e das parcelas. O banco recalcula
 * tudo ao salvar — a prévia é só espelho. Envio e contrato chegam na O3.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { usePermissoes } from "@/lib/clinic/acesso/use-permissoes";
import {
  calcularCondicao,
  descontoPrecisaAprovar,
  ErroDaCondicao,
  FORMAS_DA_ENTRADA,
  FORMAS_DE_PAGAMENTO,
  MAX_PARCELAS,
  percentualDoDesconto,
  ROTULO_DA_FORMA,
  ROTULO_DO_STATUS_DO_ORCAMENTO,
  rotuloDoNumero,
  type CondicaoCalculada,
  type CondicaoDePagamento,
  type FormaDaEntrada,
  type FormaDePagamento,
  type Orcamento,
} from "@/lib/clinic/orcamentos/orcamento";
import { formatarReais, reaisParaCentavos, type ItemDaTabela } from "@/lib/clinic/orcamentos/precos";

type Opcao = { id: string; name: string };
type Tabela = { ligado: boolean; itens: ItemDaTabela[]; procedimentos: Opcao[]; servicos: Opcao[] };
type Lista = { ligado: boolean; desconto_max_pct: number; orcamentos: Orcamento[] };
type LinhaDoEditor = { preco_id: string; quantidade: number };
type Editor = {
  id: string | null;
  itens: LinhaDoEditor[];
  desconto: string;
  forma: FormaDePagamento;
  parcelas: string;
  entrada: string;
  entradaForma: FormaDaEntrada;
  validade: string;
  observacao: string;
};

const ROTULO_DA_ENTRADA: Record<FormaDaEntrada, string> = { dinheiro: "Dinheiro", pix: "Pix", debito: "Cartão de débito" };

function emDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function editorVazio(): Editor {
  return {
    id: null,
    itens: [],
    desconto: "",
    forma: "pix",
    parcelas: "2",
    entrada: "",
    entradaForma: "pix",
    validade: emDias(15),
    observacao: "",
  };
}

function editorDe(o: Orcamento): Editor {
  const c = o.condicao_pagamento;
  return {
    id: o.id,
    itens: (o.clinic_orcamento_itens ?? [])
      .slice()
      .sort((a, b) => a.posicao - b.posicao)
      .map((i) => ({ preco_id: i.preco_id, quantidade: i.quantidade })),
    desconto: o.desconto_cents > 0 ? (o.desconto_cents / 100).toFixed(2).replace(".", ",") : "",
    forma: c.forma,
    parcelas: String(c.forma === "parcelado" ? c.parcelas : 2),
    entrada: c.entrada ? (c.entrada.valor_cents / 100).toFixed(2).replace(".", ",") : "",
    entradaForma: c.entrada?.forma ?? "pix",
    validade: o.validade_ate,
    observacao: o.observacao ?? "",
  };
}

export function OrcamentosDoPaciente({ contactId, atendimentoId }: { contactId: string; atendimentoId?: string }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const qc = useQueryClient();
  const { can } = usePermissoes();
  const chave = ["clinic", "orcamentos", contactId];
  const lista = useQuery({
    queryKey: chave,
    queryFn: async () =>
      (await apiClient.get<{ data: Lista }>(`/api/v1/clinic/orcamentos?contact_id=${encodeURIComponent(contactId)}`)).data,
  });
  const tabela = useQuery({
    queryKey: ["clinic", "precos"],
    queryFn: async () => (await apiClient.get<{ data: Tabela }>("/api/v1/clinic/precos")).data,
  });
  const [editor, setEditor] = useState<Editor | null>(null);

  const recarregar = () => void qc.invalidateQueries({ queryKey: chave });
  const salvar = useMutation({
    mutationFn: (args: { id: string | null; corpo: Record<string, unknown> }) =>
      args.id
        ? apiClient.patch(`/api/v1/clinic/orcamentos/${args.id}`, args.corpo)
        : apiClient.post("/api/v1/clinic/orcamentos", { contact_id: contactId, ...args.corpo }),
    onSuccess: () => {
      setEditor(null);
      recarregar();
    },
    onError: showApiError,
  });
  const aprovar = useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/v1/clinic/orcamentos/${id}/aprovar-desconto`, {}),
    onSuccess: recarregar,
    onError: showApiError,
  });
  const cancelar = useMutation({
    mutationFn: (args: { id: string; motivo: string }) =>
      apiClient.post(`/api/v1/clinic/orcamentos/${args.id}/cancelar`, { motivo: args.motivo }),
    onSuccess: recarregar,
    onError: showApiError,
  });
  // FORK clinic (orçamento O3, 8008): o envio gera o contrato.
  const recarregarComDocumentos = () => {
    recarregar();
    void qc.invalidateQueries({ queryKey: ["clinic", "documentos"] });
  };
  const enviar = useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/v1/clinic/orcamentos/${id}/enviar`, {}),
    onSuccess: recarregarComDocumentos,
    onError: showApiError,
  });
  const recusar = useMutation({
    mutationFn: (args: { id: string; motivo: string }) =>
      apiClient.post(`/api/v1/clinic/orcamentos/${args.id}/recusar`, { motivo: args.motivo }),
    onSuccess: recarregarComDocumentos,
    onError: showApiError,
  });
  const novaVersao = useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/v1/clinic/orcamentos/${id}/nova-versao`, {}),
    onSuccess: recarregarComDocumentos,
    onError: showApiError,
  });
  // FORK clinic (orçamento O4, 8009): o aceite gera plano e comanda; se falhou, reprocessa.
  const reprocessar = useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/v1/clinic/orcamentos/${id}/reprocessar`, {}),
    onSuccess: () => {
      recarregar();
      void qc.invalidateQueries({ queryKey: ["clinic", "planos"] });
    },
    onError: showApiError,
  });
  const pedirMotivo = (pergunta: string): string | null => {
    const motivo = window.prompt(pergunta);
    return motivo && motivo.trim().length >= 3 ? motivo.trim() : null;
  };

  if (lista.isLoading || tabela.isLoading) return <p className="text-sm text-text-muted">{t("Carregando...")}</p>;
  if (lista.isError || !lista.data) {
    return <p className="text-sm text-danger">{t("Não foi possível carregar os orçamentos.")}</p>;
  }
  const dados = lista.data;
  if (!dados.ligado) {
    return (
      <p className="text-sm text-text-muted" data-testid="orcamentos-desligado">
        {t("Os orçamentos estão desligados nesta clínica. Ligue em Configurações › Profissionais.")}
      </p>
    );
  }

  const precos = tabela.data?.itens ?? [];
  const nomeDoItem = (it: ItemDaTabela) => {
    const lista = it.tipo === "procedimento" ? tabela.data?.procedimentos : tabela.data?.servicos;
    const nome = lista?.find((o) => o.id === it.item_id)?.name ?? t("Item");
    return it.descricao ?? (it.sessoes > 1 ? `${nome} — ${it.sessoes} ${t("sessões")}` : nome);
  };
  const dataCurta = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(tag);

  const resumoDoPagamento = (c: CondicaoCalculada) => {
    if (c.forma !== "parcelado") return `${t(ROTULO_DA_FORMA[c.forma])} · ${t("à vista")}`;
    const entrada = c.entrada ? `${t("entrada de")} ${formatarReais(c.entrada.valor_cents)} (${t(ROTULO_DA_ENTRADA[c.entrada.forma])}) + ` : "";
    return `${entrada}${c.parcelas}× ${formatarReais(c.valor_parcela_cents)} ${t("no cartão de crédito")}`;
  };

  const visiveis = atendimentoId ? dados.orcamentos.filter((o) => o.atendimento_id === atendimentoId) : dados.orcamentos;

  return (
    <div className="space-y-4" data-testid="orcamentos-do-paciente">
      {can("orcamentos.criar") && !editor ? (
        <Button data-testid="orcamento-novo" onClick={() => setEditor(editorVazio())}>
          {t("Novo orçamento")}
        </Button>
      ) : null}

      {editor ? (
        <EditorDeOrcamento
          editor={editor}
          setEditor={setEditor}
          precos={precos}
          nomeDoItem={nomeDoItem}
          descontoMaxPct={dados.desconto_max_pct}
          podeAprovarDesconto={can("orcamentos.aprovar_desconto")}
          salvando={salvar.isPending}
          onSalvar={(corpo) => salvar.mutate({ id: editor.id, corpo: { ...corpo, ...(atendimentoId ? { atendimento_id: atendimentoId } : {}) } })}
        />
      ) : null}

      {visiveis.length === 0 ? (
        <p className="text-sm text-text-muted">{t("Nenhum orçamento ainda.")}</p>
      ) : (
        <ul className="space-y-3">
          {visiveis.map((o) => (
            <li key={o.id} className="space-y-2 rounded-xl border p-4 text-sm" data-testid="orcamento">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{rotuloDoNumero(o)}</span>
                  <Badge variant="outline" data-testid="orcamento-status">
                    {t(ROTULO_DO_STATUS_DO_ORCAMENTO[o.status])}
                  </Badge>
                  {o.desconto_pendente ? (
                    <Badge variant="outline" data-testid="orcamento-desconto-pendente">
                      {t("Desconto aguardando aprovação")}
                    </Badge>
                  ) : null}
                </div>
                <span className="text-base font-semibold" data-testid="orcamento-total">
                  {formatarReais(o.total_cents)}
                </span>
              </div>
              <ul className="space-y-0.5 text-text-muted">
                {(o.clinic_orcamento_itens ?? [])
                  .slice()
                  .sort((a, b) => a.posicao - b.posicao)
                  .map((i) => (
                    <li key={i.id}>
                      {i.quantidade > 1 ? `${i.quantidade}× ` : ""}
                      {i.descricao} · {formatarReais(i.total_cents)}
                    </li>
                  ))}
              </ul>
              {o.desconto_cents > 0 ? (
                <p className="text-xs text-text-muted">
                  {t("Subtotal")} {formatarReais(o.subtotal_cents)} · {t("desconto")} {formatarReais(o.desconto_cents)} (
                  {percentualDoDesconto(o.desconto_cents, o.subtotal_cents).toFixed(1).replace(".", ",")}%)
                </p>
              ) : null}
              <p data-testid="orcamento-pagamento">{resumoDoPagamento(o.condicao_pagamento)}</p>
              <p className="text-xs text-text-muted">
                {t("Válido até")} {dataCurta(o.validade_ate)}
                {o.motivo_cancelamento ? ` · ${t("Motivo")}: ${o.motivo_cancelamento}` : ""}
                {o.motivo_recusa ? ` · ${t("Motivo")}: ${o.motivo_recusa}` : ""}
              </p>
              {o.status === "enviado" ? (
                <p className="text-xs" data-testid="orcamento-contrato-emitido">
                  {t("Contrato emitido. Colha o aceite do paciente (no tablet ou pelo link) em Documentos — o aceite aprova o orçamento.")}{" "}
                  <Link className="underline" href={`/app/contacts/${contactId}?aba=documentos`}>
                    {t("Abrir Documentos")}
                  </Link>
                </p>
              ) : null}
              {o.status === "aprovado" && o.aprovado_em ? (
                <p className="text-xs" data-testid="orcamento-aprovado-em">
                  {t("Contrato aceito em")} {new Date(o.aprovado_em).toLocaleString(tag)}
                </p>
              ) : null}
              {o.status === "aprovado" ? (
                <div className="flex flex-wrap items-center gap-3 text-xs" data-testid="orcamento-pos-aceite">
                  {o.plano_id ? (
                    <Link className="underline" href={`/app/contacts/${contactId}?aba=planos`} data-testid="orcamento-ver-plano">
                      {t("Ver plano de tratamento")}
                    </Link>
                  ) : null}
                  {o.clinic_orcamento_vendas && (Array.isArray(o.clinic_orcamento_vendas) ? o.clinic_orcamento_vendas.length > 0 : true) ? (
                    <Link className="underline" href="/app/comandas" data-testid="orcamento-ver-comanda">
                      {t("Comanda aberta — abrir comandas")}
                    </Link>
                  ) : null}
                  {o.pos_aceite_erro ? (
                    <span className="text-danger" data-testid="orcamento-pos-aceite-erro">
                      {t("O plano e a comanda não foram gerados.")}
                    </span>
                  ) : null}
                  {o.pos_aceite_erro && can("orcamentos.criar") ? (
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="orcamento-reprocessar"
                      disabled={reprocessar.isPending}
                      onClick={() => reprocessar.mutate(o.id)}
                    >
                      {t("Gerar plano e comanda")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {o.documento_id && ["enviado", "aprovado"].includes(o.status) ? (
                <a
                  className="text-xs underline"
                  data-testid="orcamento-baixar-contrato"
                  href={`/api/v1/clinic/orcamentos/${o.id}/contrato`}
                >
                  {t("Baixar contrato (PDF)")}
                </a>
              ) : null}
              {["enviado", "recusado", "expirado"].includes(o.status) && can("orcamentos.criar") ? (
                <div className="flex flex-wrap gap-2">
                  {o.status === "enviado" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="orcamento-recusar"
                      disabled={recusar.isPending}
                      onClick={() => {
                        const motivo = pedirMotivo(t("Por que o paciente recusou?"));
                        if (motivo) recusar.mutate({ id: o.id, motivo });
                      }}
                    >
                      {t("Paciente recusou")}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="orcamento-nova-versao"
                    disabled={novaVersao.isPending}
                    onClick={() => novaVersao.mutate(o.id)}
                  >
                    {t("Nova versão")}
                  </Button>
                  {o.status === "enviado" && can("orcamentos.cancelar") ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={cancelar.isPending}
                      onClick={() => {
                        const motivo = pedirMotivo(t("Motivo do cancelamento"));
                        if (motivo) cancelar.mutate({ id: o.id, motivo });
                      }}
                    >
                      {t("Cancelar orçamento")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {o.status === "rascunho" ? (
                <div className="flex flex-wrap gap-2">
                  {can("orcamentos.criar") ? (
                    <Button size="sm" variant="outline" onClick={() => setEditor(editorDe(o))}>
                      {t("Editar")}
                    </Button>
                  ) : null}
                  {can("orcamentos.criar") ? (
                    <Button
                      size="sm"
                      data-testid="orcamento-enviar"
                      disabled={enviar.isPending || o.desconto_pendente}
                      title={o.desconto_pendente ? t("O desconto ainda espera a aprovação de um gerente.") : undefined}
                      onClick={() => enviar.mutate(o.id)}
                    >
                      {t("Enviar e gerar contrato")}
                    </Button>
                  ) : null}
                  {o.desconto_pendente && can("orcamentos.aprovar_desconto") ? (
                    <Button
                      size="sm"
                      data-testid="orcamento-aprovar-desconto"
                      disabled={aprovar.isPending}
                      onClick={() => aprovar.mutate(o.id)}
                    >
                      {t("Aprovar desconto")}
                    </Button>
                  ) : null}
                  {can("orcamentos.cancelar") ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={cancelar.isPending}
                      onClick={() => {
                        const motivo = pedirMotivo(t("Motivo do cancelamento"));
                        if (motivo) cancelar.mutate({ id: o.id, motivo });
                      }}
                    >
                      {t("Cancelar orçamento")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditorDeOrcamento({
  editor,
  setEditor,
  precos,
  nomeDoItem,
  descontoMaxPct,
  podeAprovarDesconto,
  salvando,
  onSalvar,
}: {
  editor: Editor;
  setEditor: (e: Editor | null) => void;
  precos: ItemDaTabela[];
  nomeDoItem: (it: ItemDaTabela) => string;
  descontoMaxPct: number;
  podeAprovarDesconto: boolean;
  salvando: boolean;
  onSalvar: (corpo: Record<string, unknown>) => void;
}) {
  const t = useT();
  const [escolhido, setEscolhido] = useState("");
  const muda = (parcial: Partial<Editor>) => setEditor({ ...editor, ...parcial });
  const porId = new Map(precos.map((p) => [p.preco_id, p]));

  const subtotal = editor.itens.reduce((s, l) => s + (porId.get(l.preco_id)?.preco_cents ?? 0) * l.quantidade, 0);
  const itemForaDaTabela = editor.itens.some((l) => !porId.has(l.preco_id));
  const desconto = editor.desconto.trim() === "" ? 0 : reaisParaCentavos(editor.desconto);
  const descontoValido = desconto !== null && desconto <= subtotal;
  const total = subtotal - (descontoValido ? (desconto ?? 0) : 0);
  const entrada = editor.forma === "parcelado" && editor.entrada.trim() !== "" ? reaisParaCentavos(editor.entrada) : 0;

  let condicao: CondicaoDePagamento | null = null;
  let calculada: CondicaoCalculada | null = null;
  let erroDaCondicao: string | null = null;
  if (entrada === null) {
    erroDaCondicao = t("Entrada inválida.");
  } else {
    condicao = {
      forma: editor.forma,
      parcelas: editor.forma === "parcelado" ? Number(editor.parcelas) : 1,
      ...(entrada > 0 ? { entrada: { valor_cents: entrada, forma: editor.entradaForma } } : {}),
    };
    try {
      calculada = calcularCondicao(condicao, total);
    } catch (e) {
      erroDaCondicao = e instanceof ErroDaCondicao ? t(e.message) : t("Condição de pagamento inválida.");
    }
  }
  const pendente = descontoValido && descontoPrecisaAprovar(desconto ?? 0, subtotal, descontoMaxPct);
  const podeSalvar = editor.itens.length > 0 && !itemForaDaTabela && descontoValido && !!calculada && !salvando;

  return (
    <section className="space-y-3 rounded-xl border p-4" data-testid="orcamento-editor">
      <h3 className="font-semibold">{editor.id ? t("Editar orçamento") : t("Novo orçamento")}</h3>

      <div className="flex flex-wrap items-end gap-2">
        <select
          aria-label={t("Item da tabela de preços")}
          className="min-h-11 min-w-56 flex-1 rounded-md border p-2"
          value={escolhido}
          onChange={(e) => setEscolhido(e.target.value)}
        >
          <option value="">{t("Escolha um item da tabela de preços")}</option>
          {precos.map((p) => (
            <option key={p.preco_id} value={p.preco_id}>
              {nomeDoItem(p)} · {formatarReais(p.preco_cents)}
            </option>
          ))}
        </select>
        <Button
          className="min-h-11"
          data-testid="orcamento-adicionar-item"
          disabled={!escolhido}
          onClick={() => {
            const ja = editor.itens.find((l) => l.preco_id === escolhido);
            muda({
              itens: ja
                ? editor.itens.map((l) => (l.preco_id === escolhido ? { ...l, quantidade: Math.min(50, l.quantidade + 1) } : l))
                : [...editor.itens, { preco_id: escolhido, quantidade: 1 }],
            });
            setEscolhido("");
          }}
        >
          {t("Adicionar item")}
        </Button>
      </div>
      {precos.length === 0 ? (
        <p className="text-xs text-text-muted">{t("A tabela de preços está vazia. Cadastre em Configurações › Tabela de preços.")}</p>
      ) : null}

      {editor.itens.length > 0 ? (
        <ul className="space-y-1" data-testid="orcamento-itens">
          {editor.itens.map((l) => {
            const p = porId.get(l.preco_id);
            return (
              <li key={l.preco_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <span>{p ? nomeDoItem(p) : t("Item fora da tabela de preços — remova")}</span>
                <span className="flex items-center gap-2">
                  <input
                    aria-label={t("Quantidade")}
                    className="w-16 rounded-md border p-1"
                    inputMode="numeric"
                    value={l.quantidade}
                    onChange={(e) => {
                      const n = Math.max(1, Math.min(50, Number(e.target.value) || 1));
                      muda({ itens: editor.itens.map((x) => (x.preco_id === l.preco_id ? { ...x, quantidade: n } : x)) });
                    }}
                  />
                  <span>{p ? formatarReais(p.preco_cents * l.quantidade) : "—"}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t("Remover item")}
                    onClick={() => muda({ itens: editor.itens.filter((x) => x.preco_id !== l.preco_id) })}
                  >
                    ×
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>{t("Desconto (R$)")}</span>
          <input
            className="min-h-11 w-full rounded-md border p-2"
            inputMode="decimal"
            placeholder="0,00"
            value={editor.desconto}
            onChange={(e) => muda({ desconto: e.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>{t("Válido até")}</span>
          <input
            type="date"
            className="min-h-11 w-full rounded-md border p-2"
            value={editor.validade}
            onChange={(e) => muda({ validade: e.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>{t("Forma de pagamento")}</span>
          <select
            className="min-h-11 w-full rounded-md border p-2"
            value={editor.forma}
            onChange={(e) => muda({ forma: e.target.value as FormaDePagamento })}
          >
            {FORMAS_DE_PAGAMENTO.map((f) => (
              <option key={f} value={f}>
                {t(ROTULO_DA_FORMA[f])}
              </option>
            ))}
          </select>
        </label>
        {editor.forma === "parcelado" ? (
          <label className="space-y-1 text-sm">
            <span>{t("Parcelas no cartão")}</span>
            <select
              className="min-h-11 w-full rounded-md border p-2"
              value={editor.parcelas}
              onChange={(e) => muda({ parcelas: e.target.value })}
            >
              {Array.from({ length: MAX_PARCELAS - 1 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n}×
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {editor.forma === "parcelado" ? (
          <label className="space-y-1 text-sm">
            <span>{t("Entrada (R$, opcional)")}</span>
            <input
              className="min-h-11 w-full rounded-md border p-2"
              inputMode="decimal"
              placeholder="0,00"
              value={editor.entrada}
              onChange={(e) => muda({ entrada: e.target.value })}
            />
          </label>
        ) : null}
        {editor.forma === "parcelado" && editor.entrada.trim() !== "" ? (
          <label className="space-y-1 text-sm">
            <span>{t("Forma da entrada")}</span>
            <select
              className="min-h-11 w-full rounded-md border p-2"
              value={editor.entradaForma}
              onChange={(e) => muda({ entradaForma: e.target.value as FormaDaEntrada })}
            >
              {FORMAS_DA_ENTRADA.map((f) => (
                <option key={f} value={f}>
                  {t(ROTULO_DA_ENTRADA[f])}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <label className="block space-y-1 text-sm">
        <span>{t("Observação (sem informação clínica)")}</span>
        <input
          className="min-h-11 w-full rounded-md border p-2"
          maxLength={500}
          value={editor.observacao}
          onChange={(e) => muda({ observacao: e.target.value })}
        />
      </label>

      <div className="space-y-1 rounded-md bg-muted p-3 text-sm" data-testid="orcamento-previa">
        <p>
          {t("Subtotal")}: {formatarReais(subtotal)}
        </p>
        {!descontoValido ? (
          <p className="text-danger">{t("Desconto inválido ou maior que o subtotal.")}</p>
        ) : (desconto ?? 0) > 0 ? (
          <p>
            {t("Desconto")}: {formatarReais(desconto ?? 0)} (
            {percentualDoDesconto(desconto ?? 0, subtotal).toFixed(1).replace(".", ",")}%)
          </p>
        ) : null}
        <p className="font-semibold">
          {t("Total")}: {formatarReais(total)}
        </p>
        {calculada && calculada.forma === "parcelado" ? (
          <p data-testid="orcamento-previa-parcelas">
            {calculada.entrada ? `${t("Entrada")} ${formatarReais(calculada.entrada.valor_cents)} + ` : ""}
            {calculada.parcelas}× {formatarReais(calculada.valor_parcela_cents)}
            {calculada.primeira_parcela_cents !== calculada.valor_parcela_cents
              ? ` (${t("1ª parcela")} ${formatarReais(calculada.primeira_parcela_cents)})`
              : ""}
          </p>
        ) : null}
        {erroDaCondicao ? <p className="text-danger">{erroDaCondicao}</p> : null}
        {pendente ? (
          <p className="text-xs" data-testid="orcamento-aviso-desconto">
            {podeAprovarDesconto
              ? t("O desconto passa do limite da clínica; ao salvar, fica aprovado por você.")
              : t("O desconto passa do limite da clínica e vai precisar da aprovação de um gerente.")}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          data-testid="orcamento-salvar"
          disabled={!podeSalvar}
          onClick={() =>
            onSalvar({
              itens: editor.itens,
              desconto_cents: desconto ?? 0,
              condicao_pagamento: condicao,
              validade_ate: editor.validade,
              ...(editor.observacao.trim() ? { observacao: editor.observacao.trim() } : {}),
            })
          }
        >
          {t("Salvar rascunho")}
        </Button>
        <Button variant="outline" onClick={() => setEditor(null)}>
          {t("Descartar")}
        </Button>
      </div>
    </section>
  );
}
