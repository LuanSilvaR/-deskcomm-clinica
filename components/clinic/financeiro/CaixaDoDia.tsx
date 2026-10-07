"use client";

/**
 * FORK clinic (financeiro FN3) — o caixa do dia: entradas, saídas e saldo
 * (comparado com ontem e com a média de 7 dias), por categoria; e as sessões de
 * caixa (gaveta): abrir com fundo de troco, suprimento, sangria, caixa pequeno,
 * fechar com contagem por cédula e a dupla conferência.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { CEDULAS_E_MOEDAS, TIPOS_DE_MOVIMENTO_DE_CAIXA } from "@/lib/clinic/financeiro/schemas";
import type { CaixaDoDia as Dados, SessaoDeCaixa } from "@/lib/clinic/financeiro/servidor";
import { formatCentsBRL, parseReaisToCents } from "@/lib/money";

const CHAVE = ["clinic", "financeiro", "caixa"] as const;
const SELECT = "h-11 rounded-md border bg-surface px-2 text-sm md:h-9";
const ROTULO_DO_MOVIMENTO: Record<(typeof TIPOS_DE_MOVIMENTO_DE_CAIXA)[number], string> = {
  suprimento: "Suprimento",
  sangria: "Sangria",
  caixa_pequeno: "Caixa pequeno",
};
const ROTULO_DO_STATUS: Record<SessaoDeCaixa["status"], string> = {
  aberto: "Aberto",
  aguardando_conferencia: "Aguardando conferência",
  fechado: "Fechado",
};

function variacao(atual: number, base: number): string {
  if (base === 0) return "";
  const p = Math.round(((atual - base) * 1000) / Math.abs(base)) / 10;
  return `${p >= 0 ? "▲" : "▼"} ${Math.abs(p).toLocaleString("pt-BR")}%`;
}

export function CaixaDoDia({
  podeCaixa,
  podeConferir,
  usuarioId,
}: {
  podeCaixa: boolean;
  podeConferir: boolean;
  usuarioId: string;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [dia, setDia] = useState(() => new Intl.DateTimeFormat("en-CA").format(new Date()));
  const q = useQuery({
    queryKey: [...CHAVE, dia],
    queryFn: async () => (await apiClient.get<{ data: Dados }>(`/api/v1/clinic/financeiro/caixa?dia=${dia}`)).data,
  });
  const recarregar = () => void qc.invalidateQueries({ queryKey: [...CHAVE] });
  const d = q.data;
  if (q.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (!d) return <p className="text-sm text-text-muted">{t("Não foi possível carregar o caixa.")}</p>;
  const r = d.resumo;
  const editar = d.ligado && podeCaixa;

  return (
    <div className="space-y-6">
      <label className="flex items-center gap-2 text-sm">
        {t("Dia")}
        <Input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className="h-11 w-44 md:h-9" />
      </label>

      {r ? (
        <section className="space-y-3" aria-labelledby="caixa-resumo" data-testid="caixa-resumo">
          <h2 id="caixa-resumo" className="sr-only">
            {t("Resumo do dia")}
          </h2>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <li className="rounded-xl border p-3">
              <p className="text-xs text-text-muted">{t("Entradas")}</p>
              <p className="text-lg font-semibold tabular-nums">{formatCentsBRL(r.entradas_cents)}</p>
            </li>
            <li className="rounded-xl border p-3">
              <p className="text-xs text-text-muted">{t("Saídas")}</p>
              <p className="text-lg font-semibold tabular-nums">{formatCentsBRL(r.saidas_cents)}</p>
            </li>
            <li className="rounded-xl border p-3">
              <p className="text-xs text-text-muted">{t("Saldo do dia")}</p>
              <p className="text-lg font-semibold tabular-nums" data-testid="caixa-saldo">
                {formatCentsBRL(r.saldo_cents)}
              </p>
            </li>
            <li className="rounded-xl border p-3 text-sm">
              <p className="text-xs text-text-muted">{t("Comparação")}</p>
              <p>
                {t("Ontem")}: <span className="tabular-nums">{formatCentsBRL(r.ontem_cents)}</span>{" "}
                <span className="text-xs text-text-muted">{variacao(r.saldo_cents, r.ontem_cents)}</span>
              </p>
              <p>
                {t("Média 7 dias")}: <span className="tabular-nums">{formatCentsBRL(r.media_7d_cents)}</span>{" "}
                <span className="text-xs text-text-muted">{variacao(r.saldo_cents, r.media_7d_cents)}</span>
              </p>
            </li>
          </ul>
          {r.por_categoria.length > 0 ? (
            <ul className="divide-y rounded-xl border text-sm" data-testid="caixa-categorias">
              {r.por_categoria.map((c) => (
                <li key={`${c.direcao}-${c.categoria}`} className="flex justify-between gap-3 p-2">
                  <span>
                    <span className={c.direcao === "in" ? "text-success" : "text-danger"}>{c.direcao === "in" ? "+" : "−"}</span>{" "}
                    {t(c.categoria)}
                  </span>
                  <span className="tabular-nums">{formatCentsBRL(c.total_cents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">{t("Nenhum lançamento pago neste dia.")}</p>
          )}
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="caixa-sessoes">
        <h2 id="caixa-sessoes" className="text-lg font-semibold">
          {t("Gaveta (sessões de caixa)")}
        </h2>
        {!d.ligado ? (
          <p className="rounded-xl border bg-muted p-3 text-sm">
            {t("O financeiro da clínica está desligado. Quem administra liga em Configurações › Profissionais.")}
          </p>
        ) : null}
        {d.sessoes.length === 0 ? <p className="text-sm text-text-muted">{t("Nenhuma sessão de caixa neste dia.")}</p> : null}
        <ul className="space-y-3">
          {d.sessoes.map((s) => (
            <Sessao
              key={s.id}
              s={s}
              esperado={d.esperado_agora[s.id] ?? null}
              planos={d.planos_de_despesa}
              editar={editar}
              podeConferir={d.ligado && podeConferir && s.fechado_por !== usuarioId}
              aoMudar={recarregar}
            />
          ))}
        </ul>
        {editar ? <AbrirCaixa contas={d.contas} aoAbrir={recarregar} /> : null}
      </section>
    </div>
  );
}

function AbrirCaixa({ contas, aoAbrir }: { contas: Dados["contas"]; aoAbrir: () => void }) {
  const t = useT();
  const [conta, setConta] = useState(contas.find((c) => c.kind === "cash")?.id ?? contas[0]?.id ?? "");
  const [fundo, setFundo] = useState("0,00");
  const abrir = useMutation({
    mutationFn: () =>
      apiClient.post("/api/v1/clinic/financeiro/caixa", { account_id: conta, fundo_troco_cents: parseReaisToCents(fundo) ?? 0 }),
    onSuccess: aoAbrir,
    onError: showApiError,
  });
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed p-3"
      onSubmit={(e) => {
        e.preventDefault();
        abrir.mutate();
      }}
    >
      <label className="space-y-1 text-xs">
        <span className="block font-medium">{t("Conta (gaveta)")}</span>
        <select className={SELECT} value={conta} onChange={(e) => setConta(e.target.value)} data-testid="caixa-conta">
          {contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-xs">
        <span className="block font-medium">{t("Fundo de troco (R$)")}</span>
        <Input value={fundo} onChange={(e) => setFundo(e.target.value)} className="h-11 w-32 md:h-9" data-testid="caixa-fundo" />
      </label>
      <Button type="submit" size="sm" disabled={!conta || abrir.isPending} data-testid="caixa-abrir">
        {t("Abrir caixa")}
      </Button>
    </form>
  );
}

function Sessao({
  s,
  esperado,
  planos,
  editar,
  podeConferir,
  aoMudar,
}: {
  s: SessaoDeCaixa;
  esperado: number | null;
  planos: Dados["planos_de_despesa"];
  editar: boolean;
  podeConferir: boolean;
  aoMudar: () => void;
}) {
  const t = useT();
  const [modo, setModo] = useState<"nada" | "movimento" | "fechar">("nada");
  const conferir = useMutation({
    mutationFn: () => apiClient.post(`/api/v1/clinic/financeiro/caixa/${s.id}/conferir`, {}),
    onSuccess: aoMudar,
    onError: showApiError,
  });
  return (
    <li className="space-y-2 rounded-xl border p-3 text-sm" data-testid="caixa-sessao">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{s.conta}</span>
          <Badge variant={s.status === "fechado" ? "secondary" : "info"}>{t(ROTULO_DO_STATUS[s.status])}</Badge>
          <span className="text-xs text-text-muted">
            {t("Fundo de troco")} {formatCentsBRL(s.fundo_troco_cents)}
          </span>
        </span>
        {s.status === "aberto" && esperado !== null ? (
          <span className="tabular-nums" data-testid="caixa-esperado">
            {t("Na gaveta agora")}: {formatCentsBRL(esperado)}
          </span>
        ) : null}
        {s.status !== "aberto" && s.contado_cents !== null ? (
          <span className="tabular-nums">
            {t("Esperado")} {formatCentsBRL(s.esperado_cents ?? 0)} · {t("Contado")} {formatCentsBRL(s.contado_cents)} ·{" "}
            <span className={s.diferenca_cents ? "font-medium text-danger" : ""} data-testid="caixa-diferenca">
              {t("Diferença")} {formatCentsBRL(s.diferenca_cents ?? 0)}
            </span>
          </span>
        ) : null}
      </div>
      {s.movimentos.length > 0 ? (
        <ul className="space-y-1 text-xs text-text-muted">
          {s.movimentos.map((m) => (
            <li key={m.id}>
              {t(ROTULO_DO_MOVIMENTO[m.tipo])}: {formatCentsBRL(m.valor_cents)} — {m.descricao}
            </li>
          ))}
        </ul>
      ) : null}
      {s.status === "aberto" && editar ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setModo(modo === "movimento" ? "nada" : "movimento")} data-testid="caixa-movimentar">
            {t("Suprimento, sangria ou caixa pequeno")}
          </Button>
          <Button size="sm" onClick={() => setModo(modo === "fechar" ? "nada" : "fechar")} data-testid="caixa-fechar">
            {t("Fechar caixa")}
          </Button>
        </div>
      ) : null}
      {s.status === "aguardando_conferencia" ? (
        podeConferir ? (
          <Button size="sm" disabled={conferir.isPending} onClick={() => conferir.mutate()} data-testid="caixa-conferir">
            {t("Conferir e encerrar")}
          </Button>
        ) : (
          <p className="text-xs text-text-muted">{t("Aguardando a conferência de outra pessoa com permissão para conferir.")}</p>
        )
      ) : null}
      {modo === "movimento" ? <Movimento caixa={s.id} planos={planos} aoSalvar={() => (setModo("nada"), aoMudar())} /> : null}
      {modo === "fechar" ? <Fechar caixa={s.id} aoFechar={() => (setModo("nada"), aoMudar())} /> : null}
    </li>
  );
}

function Movimento({ caixa, planos, aoSalvar }: { caixa: string; planos: Dados["planos_de_despesa"]; aoSalvar: () => void }) {
  const t = useT();
  const [tipo, setTipo] = useState<(typeof TIPOS_DE_MOVIMENTO_DE_CAIXA)[number]>("sangria");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [plano, setPlano] = useState("");
  const salvar = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/v1/clinic/financeiro/caixa/${caixa}/movimentos`, {
        tipo,
        valor_cents: parseReaisToCents(valor) ?? 0,
        descricao: descricao.trim(),
        account_plan_id: tipo === "caixa_pequeno" && plano ? plano : null,
      }),
    onSuccess: aoSalvar,
    onError: showApiError,
  });
  return (
    <form
      className="flex flex-wrap items-end gap-2 border-t pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
    >
      <select aria-label={t("Tipo")} className={SELECT} value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
        {TIPOS_DE_MOVIMENTO_DE_CAIXA.map((x) => (
          <option key={x} value={x}>
            {t(ROTULO_DO_MOVIMENTO[x])}
          </option>
        ))}
      </select>
      <Input aria-label={t("Valor (R$)")} placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} className="h-11 w-28 md:h-9" />
      <Input
        aria-label={t("Descrição")}
        placeholder={t("Ex.: depósito no banco")}
        value={descricao}
        maxLength={200}
        onChange={(e) => setDescricao(e.target.value)}
        className="h-11 w-56 md:h-9"
      />
      {tipo === "caixa_pequeno" ? (
        <select aria-label={t("Categoria")} className={SELECT} value={plano} onChange={(e) => setPlano(e.target.value)}>
          <option value="">{t("Sem categoria")}</option>
          {planos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      ) : null}
      <Button type="submit" size="sm" disabled={salvar.isPending || descricao.trim().length < 2 || !valor}>
        {t("Registrar")}
      </Button>
    </form>
  );
}

function Fechar({ caixa, aoFechar }: { caixa: string; aoFechar: () => void }) {
  const t = useT();
  const [qtd, setQtd] = useState<Record<string, string>>({});
  const [obs, setObs] = useState("");
  const total = CEDULAS_E_MOEDAS.reduce((s, v) => s + v * (Number(qtd[String(v)]) || 0), 0);
  const fechar = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/v1/clinic/financeiro/caixa/${caixa}/fechar`, {
        contagem: Object.fromEntries(
          CEDULAS_E_MOEDAS.map((v) => [String(v), Number(qtd[String(v)]) || 0]).filter(([, n]) => Number(n) > 0),
        ),
        observacao: obs.trim() || null,
      }),
    onSuccess: aoFechar,
    onError: showApiError,
  });
  return (
    <form
      className="space-y-2 border-t pt-2"
      data-testid="caixa-contagem"
      onSubmit={(e) => {
        e.preventDefault();
        fechar.mutate();
      }}
    >
      <p className="text-xs text-text-muted">{t("Conte a gaveta: quantas cédulas e moedas de cada valor.")}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CEDULAS_E_MOEDAS.map((v) => (
          <label key={v} className="flex items-center gap-2 text-xs">
            <span className="w-16 tabular-nums">{formatCentsBRL(v)}</span>
            <Input
              type="number"
              min={0}
              value={qtd[String(v)] ?? ""}
              onChange={(e) => setQtd({ ...qtd, [String(v)]: e.target.value })}
              className="h-11 w-20 md:h-9"
              data-testid={`caixa-cedula-${v}`}
            />
          </label>
        ))}
      </div>
      <Input
        aria-label={t("Observação")}
        placeholder={t("Observação (opcional)")}
        value={obs}
        maxLength={500}
        onChange={(e) => setObs(e.target.value)}
        className="h-11 md:h-9"
      />
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          {t("Contado")}: <strong data-testid="caixa-contado">{formatCentsBRL(total)}</strong>
        </span>
        <Button type="submit" size="sm" disabled={fechar.isPending} data-testid="caixa-confirmar-fechamento">
          {t("Confirmar fechamento")}
        </Button>
      </div>
    </form>
  );
}
