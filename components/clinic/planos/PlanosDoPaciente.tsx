"use client";

/**
 * FORK clinic (prontuário F4) — os planos de tratamento do paciente.
 *
 * Aparece em dois lugares: na aba "Planos" do paciente e na seção "Plano de
 * tratamento" do atendimento (aí com "Novo plano a partir desta conduta").
 * Cada sessão mostra o estado que o banco prova: PLANEJADA (só previsão),
 * AGENDADA (com o agendamento) ou REALIZADA (com o atendimento que a cumpriu).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { progressoDoPlano, type PlanoLido, type SessaoLida, type StatusDoPlano } from "@/lib/clinic/planos/leitura";

interface Dados {
  planos: PlanoLido[];
  agendamentos: Array<{ id: string; inicio: string; titulo: string | null }>;
  tipos: Array<{ id: string; nome: string }>;
  pode_gerenciar: boolean;
}

const ROTULO_DO_PLANO: Record<StatusDoPlano, string> = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  pausado: "Pausado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};
const ROTULO_DA_SESSAO: Record<SessaoLida["status"], string> = {
  planejada: "Planejada",
  agendada: "Agendada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};
const SELECT = "h-11 rounded-md border bg-surface px-2 text-sm md:h-9";

export function PlanosDoPaciente({
  contactId,
  atendimentoOrigemId,
  objetivoSugerido,
}: {
  contactId: string;
  atendimentoOrigemId?: string;
  objetivoSugerido?: string | null;
}) {
  const t = useT();
  const chave = ["clinic", "planos", contactId];
  const q = useQuery({
    queryKey: chave,
    queryFn: async () => (await apiClient.get<{ data: Dados }>(`/api/v1/clinic/pacientes/${contactId}/planos`)).data,
  });
  const [criando, setCriando] = useState(false);

  if (q.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (q.isError || !q.data) return <p className="text-sm text-destructive">{t("Não foi possível carregar os planos.")}</p>;
  const d = q.data;

  return (
    <div className="space-y-4" data-testid="planos-do-paciente">
      {d.pode_gerenciar && !criando ? (
        <Button variant="outline" onClick={() => setCriando(true)} data-testid="plano-novo">
          {atendimentoOrigemId ? t("Novo plano a partir desta conduta") : t("Novo plano")}
        </Button>
      ) : null}
      {criando ? (
        <NovoPlano
          contactId={contactId}
          atendimentoOrigemId={atendimentoOrigemId}
          objetivoSugerido={objetivoSugerido ?? ""}
          chave={chave}
          aoFechar={() => setCriando(false)}
        />
      ) : null}
      {d.planos.length === 0 ? <p className="text-sm text-text-muted">{t("Nenhum plano de tratamento.")}</p> : null}
      {d.planos.map((p) => (
        <CartaoDoPlano key={p.id} plano={p} dados={d} chave={chave} />
      ))}
    </div>
  );
}

function NovoPlano({
  contactId,
  atendimentoOrigemId,
  objetivoSugerido,
  chave,
  aoFechar,
}: {
  contactId: string;
  atendimentoOrigemId?: string;
  objetivoSugerido: string;
  chave: readonly unknown[];
  aoFechar: () => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [objetivo, setObjetivo] = useState(objetivoSugerido.slice(0, 2000));
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const criar = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/v1/clinic/pacientes/${contactId}/planos`, {
        titulo: titulo.trim(),
        objetivo: objetivo.trim() || null,
        inicio: inicio || null,
        previsao_fim: fim || null,
        atendimento_origem_id: atendimentoOrigemId ?? null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chave });
      aoFechar();
    },
    onError: showApiError,
  });
  return (
    <form
      className="space-y-3 rounded-xl border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        criar.mutate();
      }}
    >
      <label className="block text-sm">
        <span className="block font-medium">{t("Título do plano")}</span>
        <Input className="mt-1 h-11 md:h-9" value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} required data-testid="plano-titulo" />
      </label>
      <label className="block text-sm">
        <span className="block font-medium">{t("Objetivo")}</span>
        <Textarea className="mt-1" rows={3} maxLength={2000} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-3">
        <label className="block text-sm">
          <span className="block font-medium">{t("Início")}</span>
          <Input type="date" className="mt-1 h-11 md:h-9" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="block font-medium">{t("Previsão de término")}</span>
          <Input type="date" className="mt-1 h-11 md:h-9" value={fim} onChange={(e) => setFim(e.target.value)} />
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={!titulo.trim() || criar.isPending} data-testid="plano-criar">
          {t("Criar plano")}
        </Button>
        <Button type="button" variant="ghost" onClick={aoFechar}>
          {t("Cancelar")}
        </Button>
      </div>
    </form>
  );
}

function CartaoDoPlano({ plano, dados, chave }: { plano: PlanoLido; dados: Dados; chave: readonly unknown[] }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const qc = useQueryClient();
  const [adicionando, setAdicionando] = useState(false);
  const p = progressoDoPlano(plano.sessoes);
  const recarregar = () => void qc.invalidateQueries({ queryKey: chave });
  const encerrado = plano.status === "concluido" || plano.status === "cancelado";
  const data = (iso: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString(tag) : "—");

  const status = useMutation({
    mutationFn: (novo: StatusDoPlano) =>
      apiClient.patch(`/api/v1/clinic/planos/${plano.id}`, {
        titulo: plano.titulo,
        objetivo: plano.objetivo,
        observacoes: plano.observacoes,
        inicio: plano.inicio,
        previsao_fim: plano.previsao_fim,
        status: novo,
        versao: plano.versao,
      }),
    onSuccess: recarregar,
    onError: showApiError,
  });

  return (
    <section className="space-y-3 rounded-xl border p-4" data-testid="plano">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">{plano.titulo}</h3>
          {plano.objetivo ? <p className="whitespace-pre-wrap text-sm text-text-muted">{plano.objetivo}</p> : null}
          <p className="text-xs text-text-muted">
            {data(plano.inicio)} → {data(plano.previsao_fim)} · {p.realizadas} {t("de")} {p.total} {t("realizadas")}
            {p.agendadas ? ` · ${p.agendadas} ${t("agendadas")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={plano.status === "ativo" ? "default" : "secondary"} data-testid="plano-status">
            {t(ROTULO_DO_PLANO[plano.status])}
          </Badge>
          {dados.pode_gerenciar && plano.status !== "cancelado" ? (
            <select
              aria-label={t("Mudar status do plano")}
              className={SELECT}
              value={plano.status}
              disabled={status.isPending}
              onChange={(e) => status.mutate(e.target.value as StatusDoPlano)}
            >
              {(Object.keys(ROTULO_DO_PLANO) as StatusDoPlano[]).map((s) => (
                <option key={s} value={s}>
                  {t(ROTULO_DO_PLANO[s])}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </header>

      <ol className="divide-y rounded-lg border">
        {plano.sessoes.map((s) => (
          <LinhaDaSessao key={s.id} sessao={s} dados={dados} encerrado={encerrado} aoMudar={recarregar} data={data} />
        ))}
        {plano.sessoes.length === 0 ? <li className="p-3 text-sm text-text-muted">{t("Nenhuma sessão ainda.")}</li> : null}
      </ol>

      {dados.pode_gerenciar && !encerrado ? (
        adicionando ? (
          <NovasSessoes planoId={plano.id} tipos={dados.tipos} aoFechar={() => setAdicionando(false)} aoSalvar={recarregar} />
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAdicionando(true)} data-testid="sessoes-adicionar">
            {t("Adicionar sessões")}
          </Button>
        )
      ) : null}
    </section>
  );
}

function LinhaDaSessao({
  sessao,
  dados,
  encerrado,
  aoMudar,
  data,
}: {
  sessao: SessaoLida;
  dados: Dados;
  encerrado: boolean;
  aoMudar: () => void;
  data: (iso: string | null) => string;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const [agendamento, setAgendamento] = useState("");
  const mudar = useMutation({
    mutationFn: (corpo: Record<string, unknown>) => apiClient.post(`/api/v1/clinic/planos/sessoes/${sessao.id}`, corpo),
    onSuccess: aoMudar,
    onError: showApiError,
  });
  const podeMexer = dados.pode_gerenciar && (sessao.status === "planejada" || sessao.status === "agendada");
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm" data-testid="sessao">
      <div className="min-w-0">
        <p>
          <span className="font-medium">
            {t("Sessão")} {sessao.numero}
          </span>{" "}
          · {sessao.descricao}
          {sessao.servico ? ` · ${sessao.servico}` : ""}
        </p>
        <p className="text-xs text-text-muted">
          {sessao.status === "agendada" && sessao.agendamento_em
            ? `${t("Agendada para")} ${new Date(sessao.agendamento_em).toLocaleString(tag, { dateStyle: "short", timeStyle: "short" })}`
            : sessao.status === "realizada"
              ? `${t("Realizada em")} ${data(sessao.realizada_em)}`
              : sessao.status === "cancelada"
                ? `${t("Cancelada")}: ${sessao.cancelada_motivo ?? ""}`
                : `${t("Previsão")}: ${data(sessao.previsao)}`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={sessao.status === "realizada" ? "default" : "secondary"} data-testid="sessao-status">
          {t(ROTULO_DA_SESSAO[sessao.status])}
        </Badge>
        {podeMexer && sessao.status === "planejada" && !encerrado ? (
          <>
            <select
              aria-label={t("Agendamento para esta sessão")}
              className={SELECT}
              value={agendamento}
              onChange={(e) => setAgendamento(e.target.value)}
              data-testid="sessao-agendamento"
            >
              <option value="">{t("Escolha o agendamento")}</option>
              {dados.agendamentos.map((a) => (
                <option key={a.id} value={a.id}>
                  {new Date(a.inicio).toLocaleString(tag, { dateStyle: "short", timeStyle: "short" })}
                  {a.titulo ? ` · ${a.titulo}` : ""}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={!agendamento || mudar.isPending}
              onClick={() => mudar.mutate({ acao: "agendar", appointment_id: agendamento })}
              data-testid="sessao-agendar"
            >
              {t("Ligar")}
            </Button>
          </>
        ) : null}
        {podeMexer && sessao.status === "agendada" ? (
          <Button size="sm" variant="ghost" disabled={mudar.isPending} onClick={() => mudar.mutate({ acao: "desagendar" })}>
            {t("Desligar agendamento")}
          </Button>
        ) : null}
        {podeMexer ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={mudar.isPending}
            onClick={() => {
              const motivo = window.prompt(t("Motivo do cancelamento da sessão"));
              if (motivo && motivo.trim().length >= 3) mudar.mutate({ acao: "cancelar", motivo: motivo.trim() });
            }}
          >
            {t("Cancelar sessão")}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function NovasSessoes({
  planoId,
  tipos,
  aoFechar,
  aoSalvar,
}: {
  planoId: string;
  tipos: Dados["tipos"];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const t = useT();
  const [descricao, setDescricao] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [primeira, setPrimeira] = useState("");
  const [intervalo, setIntervalo] = useState(15);
  const [tipo, setTipo] = useState("");
  const salvar = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/v1/clinic/planos/${planoId}/sessoes`, {
        descricao: descricao.trim(),
        quantidade,
        primeira: primeira || null,
        intervalo_dias: intervalo,
        event_type_id: tipo || null,
      }),
    onSuccess: () => {
      aoSalvar();
      aoFechar();
    },
    onError: showApiError,
  });
  return (
    <form
      className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
    >
      <label className="block text-sm sm:col-span-2">
        <span className="block font-medium">{t("Descrição da sessão")}</span>
        <Input className="mt-1 h-11 md:h-9" value={descricao} maxLength={200} onChange={(e) => setDescricao(e.target.value)} required data-testid="sessoes-descricao" />
      </label>
      <label className="block text-sm">
        <span className="block font-medium">{t("Quantidade")}</span>
        <Input
          type="number"
          min={1}
          max={50}
          className="mt-1 h-11 md:h-9"
          value={quantidade}
          onChange={(e) => setQuantidade(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
          data-testid="sessoes-quantidade"
        />
      </label>
      <label className="block text-sm">
        <span className="block font-medium">{t("Serviço (opcional)")}</span>
        <select className={`mt-1 w-full ${SELECT}`} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">—</option>
          {tipos.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="block font-medium">{t("Primeira sessão prevista")}</span>
        <Input type="date" className="mt-1 h-11 md:h-9" value={primeira} onChange={(e) => setPrimeira(e.target.value)} />
      </label>
      <label className="block text-sm">
        <span className="block font-medium">{t("Intervalo entre sessões (dias)")}</span>
        <Input
          type="number"
          min={0}
          max={365}
          className="mt-1 h-11 md:h-9"
          value={intervalo}
          onChange={(e) => setIntervalo(Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
        />
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={!descricao.trim() || salvar.isPending} data-testid="sessoes-salvar">
          {t("Adicionar")}
        </Button>
        <Button type="button" variant="ghost" onClick={aoFechar}>
          {t("Cancelar")}
        </Button>
      </div>
    </form>
  );
}
