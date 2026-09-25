"use client";

/**
 * A área do atendimento (fork clinic, prontuário F1–F7).
 *
 * Três zonas: cabeçalho fixo (paciente, idade, serviço, especialidade, horários
 * e Finalizar), navegação de seções (lateral no desktop, abas roláveis no
 * tablet/celular) e o painel da seção. Anamnese, Avaliação, Conduta e Evolução
 * salvam sozinhas (autosave com versão); Plano, Procedimentos, Documentos e
 * Fotos têm salvar próprio. F9: cabeçalho clínico (alergias, alertas, plano,
 * último/próximo) e "Anular" para atendimento aberto por engano.
 *
 * Todas as seções ficam MONTADAS e só a ativa aparece: trocar de seção não
 * descarta digitação em curso nem a versão que cada editor conhece.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { SecaoConduta } from "@/components/clinic/atendimento/SecaoConduta";
import { SecaoEvolucao } from "@/components/clinic/atendimento/SecaoEvolucao";
import { SecaoProcedimentos } from "@/components/clinic/atendimento/SecaoProcedimentos";
import { AnexosDoPaciente } from "@/components/clinic/anexos/AnexosDoPaciente";
import { DocumentosDoPaciente } from "@/components/clinic/documentos/DocumentosDoPaciente";
import { PlanosDoPaciente } from "@/components/clinic/planos/PlanosDoPaciente";
import { SecaoFormulario } from "@/components/clinic/atendimento/SecaoFormulario";
import { CabecalhoClinico } from "@/components/clinic/prontuario/CabecalhoClinico";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";
import { usePermissoes } from "@/lib/clinic/acesso/use-permissoes";
import type { RegistrosDoAtendimento } from "@/lib/clinic/prontuario/leitura";
import { cn } from "@/lib/utils";

interface Atendimento {
  id: string;
  status: "em_andamento" | "finalizado" | "anulado";
  inicio: string;
  fim: string | null;
  paciente: { id: string; nome: string | null; idade: number | null };
  servico: string | null;
  especialidade: string | null;
  profissional: string | null;
  pode_finalizar: boolean;
  pode_reabrir: boolean;
}

interface Registros extends RegistrosDoAtendimento {
  status: string;
  especialidade_id: string | null;
  pode_registrar: boolean;
  pode_adendo: boolean;
  exigidas: string[];
}

const ROTULO_DO_STATUS: Record<Atendimento["status"], string> = {
  em_andamento: "Em atendimento",
  finalizado: "Finalizado",
  anulado: "Anulado",
};

type SecaoAtiva =
  | "anamnese"
  | "avaliacao"
  | "conduta"
  | "plano"
  | "procedimentos"
  | "documentos"
  | "anexos"
  | "evolucao";
const SECOES: Array<{ id: SecaoAtiva; rotulo: string }> = [
  { id: "anamnese", rotulo: "Anamnese" },
  { id: "avaliacao", rotulo: "Avaliação" },
  { id: "conduta", rotulo: "Conduta" },
  { id: "plano", rotulo: "Plano de tratamento" },
  { id: "procedimentos", rotulo: "Procedimentos" },
  { id: "documentos", rotulo: "Documentos" },
  { id: "anexos", rotulo: "Fotos e anexos" },
  { id: "evolucao", rotulo: "Evolução" },
];
const ROTULO_DA_PENDENCIA: Record<string, string> = {
  evolucao: "Evolução",
  anamnese: "Anamnese",
  avaliacao: "Avaliação",
  conduta: "Conduta",
  procedimento: "Procedimentos",
  documento: "Documentos",
};
const SECOES_COM_PENDENCIA = new Set<string>([
  "anamnese",
  "avaliacao",
  "conduta",
  "evolucao",
  "procedimentos",
  "documentos",
]);

export function AtendimentoDoDia({ id }: { id: string }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const qc = useQueryClient();
  const { can } = usePermissoes();
  const chave = ["clinic", "atendimento", id];
  const chaveRegistros = ["clinic", "atendimento", id, "registros"];
  const [ativa, setAtiva] = useState<SecaoAtiva>("anamnese");
  const [faltando, setFaltando] = useState<string[]>([]);

  const at = useQuery({
    queryKey: chave,
    queryFn: async () =>
      (await apiClient.get<{ data: Atendimento }>(`/api/v1/clinic/atendimentos/${id}`)).data,
  });
  const reg = useQuery({
    queryKey: chaveRegistros,
    queryFn: async () =>
      (await apiClient.get<{ data: Registros }>(`/api/v1/clinic/atendimentos/${id}/registros`))
        .data,
  });

  const finalizar = useMutation({
    mutationFn: () => apiClient.post(`/api/v1/clinic/atendimentos/${id}/finalizar`, {}),
    onSuccess: () => {
      setFaltando([]);
      void qc.invalidateQueries({ queryKey: chave });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "requisitos_pendentes") {
        const lista = ((err.details as { faltando?: string[] } | undefined)?.faltando ?? []).filter(
          Boolean,
        );
        setFaltando(lista);
        const primeira =
          lista[0] === "procedimento"
            ? "procedimentos"
            : lista[0] === "documento"
              ? "documentos"
              : lista[0];
        if (primeira && SECOES_COM_PENDENCIA.has(primeira)) setAtiva(primeira as SecaoAtiva);
        return;
      }
      showApiError(err);
    },
  });

  const reabrir = useMutation({
    mutationFn: (motivo: string) =>
      apiClient.post(`/api/v1/clinic/atendimentos/${id}/reabrir`, { motivo }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chave }),
    onError: showApiError,
  });

  const anular = useMutation({
    mutationFn: (motivo: string) =>
      apiClient.post(`/api/v1/clinic/atendimentos/${id}/anular`, { motivo }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chave }),
    onError: showApiError,
  });

  const quando = (iso: string) =>
    new Date(iso).toLocaleString(tag, { dateStyle: "short", timeStyle: "short" });

  if (at.isLoading) return <p className="p-6 text-sm text-text-muted">{t("Carregando…")}</p>;
  if (at.isError || !at.data) {
    return (
      <p className="p-6 text-sm text-destructive">{t("Não foi possível abrir o atendimento.")}</p>
    );
  }
  const a = at.data;
  const r = reg.data;

  const temTexto = (o: object | null | undefined) =>
    !!o && Object.values(o).some((v) => typeof v === "string" && v.trim() !== "");
  const preenchida = (s: SecaoAtiva) =>
    s === "evolucao"
      ? temTexto(r?.evolucao)
      : s === "conduta"
        ? temTexto(
            r?.conduta && {
              d: r.conduta.descricao,
              p: r.conduta.protocolo,
              x: r.conduta.recomendacoes,
            },
          )
        : s === "plano"
          ? false
          : s === "procedimentos"
            ? (r?.procedimentos ?? []).some((p) => p.status !== "anulado")
            : s === "documentos" || s === "anexos"
              ? false
              : !!r?.formularios[s];
  // A pendência "procedimento" (banco) marca a seção "procedimentos" (tela).
  const pendente = (id: SecaoAtiva) =>
    faltando.includes(id) ||
    (id === "procedimentos" && faltando.includes("procedimento")) ||
    (id === "documentos" && faltando.includes("documento"));
  const secoesVisiveis = SECOES.filter(
    (s) =>
      (s.id !== "plano" || can("planos.ver")) && (s.id !== "documentos" || can("documentos.ver")),
  );

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6" data-testid="atendimento-do-dia">
      <Link
        href="/app/atendimentos"
        className="text-xs text-text-muted underline-offset-4 hover:underline"
      >
        {t("Voltar para a fila")}
      </Link>

      <header className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {a.paciente.nome ?? t("Paciente")}
          </h1>
          <p className="text-sm text-text-muted">
            {a.paciente.idade !== null
              ? `${a.paciente.idade} ${t("anos")}`
              : t("Idade não informada")}
            {a.servico ? ` · ${a.servico}` : ""}
            {a.especialidade ? ` · ${a.especialidade}` : ""}
          </p>
          <p className="text-xs text-text-muted">
            {a.profissional ? `${a.profissional} · ` : ""}
            {t("início")} {quando(a.inicio)}
            {a.fim ? ` · ${t("fim")} ${quando(a.fim)}` : ""}
          </p>
          <Link
            href={`/app/contacts/${a.paciente.id}?aba=prontuario`}
            className="text-xs underline-offset-4 hover:underline"
          >
            {t("Ver prontuário completo")}
          </Link>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge
            variant={a.status === "em_andamento" ? "default" : "secondary"}
            data-testid="atendimento-status"
          >
            {t(ROTULO_DO_STATUS[a.status])}
          </Badge>
          {a.pode_finalizar ? (
            <Button
              className="h-11 md:h-9"
              disabled={finalizar.isPending}
              data-testid="atendimento-finalizar"
              onClick={() => finalizar.mutate()}
            >
              {finalizar.isPending ? t("Finalizando…") : t("Finalizar atendimento")}
            </Button>
          ) : null}
          {a.pode_finalizar ? (
            <Button
              variant="ghost"
              className="h-11 text-xs md:h-9"
              disabled={anular.isPending}
              data-testid="atendimento-anular"
              onClick={() => {
                const motivo = window.prompt(
                  t(
                    "Motivo para anular (só vale para atendimento aberto por engano, ainda sem registros)",
                  ),
                );
                if (motivo && motivo.trim().length >= 3) anular.mutate(motivo.trim());
              }}
            >
              {t("Anular atendimento")}
            </Button>
          ) : null}
          {a.pode_reabrir ? (
            <Button
              variant="outline"
              className="h-11 md:h-9"
              disabled={reabrir.isPending}
              data-testid="atendimento-reabrir"
              onClick={() => {
                const motivo = window.prompt(
                  t("Motivo para reabrir (o que já foi registrado continua como está)"),
                );
                if (motivo && motivo.trim().length >= 3) reabrir.mutate(motivo.trim());
              }}
            >
              {t("Reabrir atendimento")}
            </Button>
          ) : null}
        </div>
      </header>

      <CabecalhoClinico contactId={a.paciente.id} />

      {faltando.length > 0 ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive p-3 text-sm"
          data-testid="atendimento-pendencias"
        >
          <p className="font-medium">{t("Falta preencher para finalizar:")}</p>
          <ul className="mt-1 list-disc pl-5">
            {faltando.map((f) => (
              <li key={f}>{t(ROTULO_DA_PENDENCIA[f] ?? f)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[13rem_1fr]">
        <nav
          aria-label={t("Seções do atendimento")}
          className="-mx-1 overflow-x-auto md:mx-0 md:overflow-visible"
        >
          <ul className="flex gap-1 px-1 md:flex-col md:px-0">
            {secoesVisiveis.map((s) => (
              <li key={s.id} className="shrink-0">
                <button
                  type="button"
                  aria-current={ativa === s.id ? "page" : undefined}
                  onClick={() => setAtiva(s.id)}
                  data-testid={`nav-${s.id}`}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-3 text-sm md:min-h-9",
                    ativa === s.id
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50",
                  )}
                >
                  <span>{t(s.rotulo)}</span>
                  <span
                    aria-hidden
                    className={
                      preenchida(s.id)
                        ? "text-success"
                        : pendente(s.id)
                          ? "text-destructive"
                          : "text-text-subtle"
                    }
                  >
                    {preenchida(s.id) ? "✓" : pendente(s.id) ? "!" : "·"}
                  </span>
                  <span className="sr-only">
                    {preenchida(s.id)
                      ? t("preenchida")
                      : pendente(s.id)
                        ? t("pendente")
                        : t("vazia")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 rounded-xl border p-4">
          {reg.isLoading ? (
            <p className="text-sm text-text-muted">{t("Carregando…")}</p>
          ) : reg.isError || !r ? (
            <p className="text-sm text-destructive">
              {t("Não foi possível carregar os registros.")}
            </p>
          ) : (
            <>
              <div hidden={ativa !== "anamnese"}>
                <SecaoFormulario
                  atendimentoId={id}
                  tipo="anamnese"
                  titulo="Anamnese"
                  registro={r.formularios.anamnese}
                  adendos={r.adendos}
                  especialidadeId={r.especialidade_id}
                  podeRegistrar={r.pode_registrar && a.status === "em_andamento"}
                  podeAdendo={r.pode_adendo}
                  chaveParaRecarregar={chaveRegistros}
                />
              </div>
              <div hidden={ativa !== "avaliacao"}>
                <SecaoFormulario
                  atendimentoId={id}
                  tipo="avaliacao"
                  titulo="Avaliação"
                  registro={r.formularios.avaliacao}
                  adendos={r.adendos}
                  especialidadeId={r.especialidade_id}
                  podeRegistrar={r.pode_registrar && a.status === "em_andamento"}
                  podeAdendo={r.pode_adendo}
                  chaveParaRecarregar={chaveRegistros}
                />
              </div>
              <div hidden={ativa !== "conduta"}>
                <SecaoConduta
                  atendimentoId={id}
                  conduta={r.conduta}
                  adendos={r.adendos}
                  podeRegistrar={r.pode_registrar && a.status === "em_andamento"}
                  podeAdendo={r.pode_adendo}
                  chaveParaRecarregar={chaveRegistros}
                  obrigatoria={r.exigidas.includes("conduta")}
                />
              </div>
              {can("planos.ver") ? (
                <div hidden={ativa !== "plano"}>
                  <section className="space-y-3" data-testid="secao-plano">
                    <h2 className="text-lg font-semibold">{t("Plano de tratamento")}</h2>
                    <PlanosDoPaciente
                      contactId={a.paciente.id}
                      atendimentoOrigemId={id}
                      objetivoSugerido={r.conduta?.descricao ?? null}
                    />
                  </section>
                </div>
              ) : null}
              <div hidden={ativa !== "procedimentos"}>
                <SecaoProcedimentos
                  atendimentoId={id}
                  procedimentos={r.procedimentos}
                  adendos={r.adendos}
                  podeRegistrar={r.pode_registrar && a.status === "em_andamento"}
                  podeAdendo={r.pode_adendo}
                  obrigatoria={r.exigidas.includes("procedimento")}
                  chaveParaRecarregar={chaveRegistros}
                />
              </div>
              {can("documentos.ver") ? (
                <div hidden={ativa !== "documentos"}>
                  <section className="space-y-3" data-testid="secao-documentos">
                    <h2 className="text-lg font-semibold">{t("Documentos")}</h2>
                    {r.exigidas.includes("documento") ? (
                      <p className="text-xs text-text-muted">
                        {t(
                          "Um termo aceito, ligado a este atendimento, é obrigatório para finalizar.",
                        )}
                      </p>
                    ) : null}
                    <DocumentosDoPaciente contactId={a.paciente.id} atendimentoId={id} />
                  </section>
                </div>
              ) : null}
              <div hidden={ativa !== "anexos"}>
                <section className="space-y-3" data-testid="secao-anexos">
                  <h2 className="text-lg font-semibold">{t("Fotos e anexos")}</h2>
                  <AnexosDoPaciente contactId={a.paciente.id} atendimentoId={id} />
                </section>
              </div>
              <div hidden={ativa !== "evolucao"}>
                <SecaoEvolucao
                  atendimentoId={id}
                  evolucao={r.evolucao}
                  adendos={r.adendos}
                  podeRegistrar={r.pode_registrar && a.status === "em_andamento"}
                  podeAdendo={r.pode_adendo}
                  chaveParaRecarregar={chaveRegistros}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
