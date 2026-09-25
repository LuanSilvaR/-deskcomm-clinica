"use client";

/**
 * A área do atendimento (fork clinic, prontuário F1/F2).
 *
 * Três zonas: cabeçalho fixo (paciente, idade, serviço, especialidade, horários
 * e Finalizar), navegação de seções (lateral no desktop, abas roláveis no
 * tablet/celular) e o painel da seção. Anamnese, Avaliação e Evolução salvam
 * sozinhas (autosave com versão); as demais seções chegam nas próximas fases.
 *
 * Todas as seções ficam MONTADAS e só a ativa aparece: trocar de seção não
 * descarta digitação em curso nem a versão que cada editor conhece.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { SecaoConduta } from "@/components/clinic/atendimento/SecaoConduta";
import { SecaoEvolucao } from "@/components/clinic/atendimento/SecaoEvolucao";
import { PlanosDoPaciente } from "@/components/clinic/planos/PlanosDoPaciente";
import { SecaoFormulario } from "@/components/clinic/atendimento/SecaoFormulario";
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

type SecaoAtiva = "anamnese" | "avaliacao" | "conduta" | "plano" | "evolucao";
const SECOES: Array<{ id: SecaoAtiva; rotulo: string }> = [
  { id: "anamnese", rotulo: "Anamnese" },
  { id: "avaliacao", rotulo: "Avaliação" },
  { id: "conduta", rotulo: "Conduta" },
  { id: "plano", rotulo: "Plano de tratamento" },
  { id: "evolucao", rotulo: "Evolução" },
];
const EM_BREVE = ["Procedimentos", "Documentos", "Anexos"];
const ROTULO_DA_PENDENCIA: Record<string, string> = {
  evolucao: "Evolução",
  anamnese: "Anamnese",
  avaliacao: "Avaliação",
  conduta: "Conduta",
};
const SECOES_COM_PENDENCIA = new Set<string>(["anamnese", "avaliacao", "conduta", "evolucao"]);

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
    queryFn: async () => (await apiClient.get<{ data: Atendimento }>(`/api/v1/clinic/atendimentos/${id}`)).data,
  });
  const reg = useQuery({
    queryKey: chaveRegistros,
    queryFn: async () => (await apiClient.get<{ data: Registros }>(`/api/v1/clinic/atendimentos/${id}/registros`)).data,
  });

  const finalizar = useMutation({
    mutationFn: () => apiClient.post(`/api/v1/clinic/atendimentos/${id}/finalizar`, {}),
    onSuccess: () => {
      setFaltando([]);
      void qc.invalidateQueries({ queryKey: chave });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "requisitos_pendentes") {
        const lista = ((err.details as { faltando?: string[] } | undefined)?.faltando ?? []).filter(Boolean);
        setFaltando(lista);
        if (lista[0] && SECOES_COM_PENDENCIA.has(lista[0])) setAtiva(lista[0] as SecaoAtiva);
        return;
      }
      showApiError(err);
    },
  });

  const quando = (iso: string) => new Date(iso).toLocaleString(tag, { dateStyle: "short", timeStyle: "short" });

  if (at.isLoading) return <p className="p-6 text-sm text-text-muted">{t("Carregando…")}</p>;
  if (at.isError || !at.data) {
    return <p className="p-6 text-sm text-destructive">{t("Não foi possível abrir o atendimento.")}</p>;
  }
  const a = at.data;
  const r = reg.data;

  const temTexto = (o: object | null | undefined) => !!o && Object.values(o).some((v) => typeof v === "string" && v.trim() !== "");
  const preenchida = (s: SecaoAtiva) =>
    s === "evolucao"
      ? temTexto(r?.evolucao)
      : s === "conduta"
        ? temTexto(r?.conduta && { d: r.conduta.descricao, p: r.conduta.protocolo, x: r.conduta.recomendacoes })
        : s === "plano"
          ? false
          : !!r?.formularios[s];
  const secoesVisiveis = SECOES.filter((s) => s.id !== "plano" || can("planos.ver"));

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6" data-testid="atendimento-do-dia">
      <Link href="/app/atendimentos" className="text-xs text-text-muted underline-offset-4 hover:underline">
        {t("Voltar para a fila")}
      </Link>

      <header className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">{a.paciente.nome ?? t("Paciente")}</h1>
          <p className="text-sm text-text-muted">
            {a.paciente.idade !== null ? `${a.paciente.idade} ${t("anos")}` : t("Idade não informada")}
            {a.servico ? ` · ${a.servico}` : ""}
            {a.especialidade ? ` · ${a.especialidade}` : ""}
          </p>
          <p className="text-xs text-text-muted">
            {a.profissional ? `${a.profissional} · ` : ""}
            {t("início")} {quando(a.inicio)}
            {a.fim ? ` · ${t("fim")} ${quando(a.fim)}` : ""}
          </p>
          <Link href={`/app/contacts/${a.paciente.id}?aba=prontuario`} className="text-xs underline-offset-4 hover:underline">
            {t("Ver prontuário completo")}
          </Link>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant={a.status === "em_andamento" ? "default" : "secondary"} data-testid="atendimento-status">
            {t(ROTULO_DO_STATUS[a.status])}
          </Badge>
          {a.pode_finalizar ? (
            <Button className="h-11 md:h-9" disabled={finalizar.isPending} data-testid="atendimento-finalizar" onClick={() => finalizar.mutate()}>
              {finalizar.isPending ? t("Finalizando…") : t("Finalizar atendimento")}
            </Button>
          ) : null}
        </div>
      </header>

      {faltando.length > 0 ? (
        <div role="alert" className="rounded-lg border border-destructive p-3 text-sm" data-testid="atendimento-pendencias">
          <p className="font-medium">{t("Falta preencher para finalizar:")}</p>
          <ul className="mt-1 list-disc pl-5">
            {faltando.map((f) => (
              <li key={f}>{t(ROTULO_DA_PENDENCIA[f] ?? f)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[13rem_1fr]">
        <nav aria-label={t("Seções do atendimento")} className="-mx-1 overflow-x-auto md:mx-0 md:overflow-visible">
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
                    ativa === s.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50",
                  )}
                >
                  <span>{t(s.rotulo)}</span>
                  <span aria-hidden className={preenchida(s.id) ? "text-success" : faltando.includes(s.id) ? "text-destructive" : "text-text-subtle"}>
                    {preenchida(s.id) ? "✓" : faltando.includes(s.id) ? "!" : "·"}
                  </span>
                  <span className="sr-only">
                    {preenchida(s.id) ? t("preenchida") : faltando.includes(s.id) ? t("pendente") : t("vazia")}
                  </span>
                </button>
              </li>
            ))}
            {EM_BREVE.map((s) => (
              <li key={s} className="shrink-0">
                <span aria-disabled="true" className="flex min-h-11 items-center justify-between gap-2 px-3 text-sm text-text-subtle md:min-h-9">
                  {t(s)} <span className="text-[10px]">{t("Em breve")}</span>
                </span>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 rounded-xl border p-4">
          {reg.isLoading ? (
            <p className="text-sm text-text-muted">{t("Carregando…")}</p>
          ) : reg.isError || !r ? (
            <p className="text-sm text-destructive">{t("Não foi possível carregar os registros.")}</p>
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
