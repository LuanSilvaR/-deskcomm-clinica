"use client";

/**
 * O status da visita no detalhe do compromisso (migration 9003).
 *
 * Mostra o estado atual, o botão do PRÓXIMO passo ("Paciente chegou" →
 * "Pronto para atendimento" → "Iniciar atendimento" → "Finalizar atendimento"),
 * "Corrigir status" (voltar pede motivo) e o histórico de quem fez o quê.
 *
 * "Paciente chegou" com a ficha obrigatória e incompleta: o servidor responde
 * 422 `ficha_incompleta` e a ficha abre aqui mesmo; salva completa, a chegada é
 * registrada sem segundo clique.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { usePessoasDaAgenda } from "@/hooks/agenda/usePessoasDaAgenda";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";
import {
  ACAO_PARA_AVANCAR,
  podeAvancar,
  ehCorrecao,
  ROTULO_DO_STATUS,
  STATUS_DA_VISITA,
  type StatusDaVisita,
} from "@/lib/clinic/visitas/status";

import { SeloPrimeiraVez } from "@/components/clinic/agenda/InfoDaClinicaNaAgenda";

import { ConfirmarDadosDoPaciente } from "./ConfirmarDadosDoPaciente";
import { FichaDoPaciente } from "./FichaDoPaciente";
import { SeloDaConfirmacao } from "./SeloDaConfirmacao";

interface EventoDaVisita {
  id: string;
  from_status: StatusDaVisita | null;
  to_status: StatusDaVisita;
  is_correction: boolean;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
}

interface Visita {
  visita: { status: StatusDaVisita };
  eventos: EventoDaVisita[];
  /** FORK clinic (9004): a resposta ao pedido de confirmação, se houve pedido. */
  confirmacao: { status: string; falha: string | null } | null;
  /** FORK clinic (9007): salas e equipamentos alocados. */
  recursos?: string[];
  /** FORK clinic (E5.1): faltas do paciente nos últimos 12 meses. */
  faltas?: number;
  /** FORK clinic (agenda S4): nenhum atendimento realizado antes deste. */
  primeira_vez?: boolean;
  /** FORK clinic (agenda S4): quem vê é o profissional do agendamento. */
  eh_o_dono?: boolean;
  /** FORK clinic (agenda S5): o atendimento (prontuário) deste agendamento. */
  atendimento?: { id: string; status: string } | null;
}

export const COR_DO_STATUS: Record<StatusDaVisita, string> = {
  agendado: "bg-muted text-text-muted",
  na_recepcao: "bg-warning/15 text-warning",
  pronto: "bg-success/15 text-success",
  em_atendimento: "bg-primary/15 text-primary",
  finalizado: "bg-muted text-text-muted",
};

export function SeloDaVisita({ status }: { status: StatusDaVisita }) {
  const t = useT();
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COR_DO_STATUS[status]}`} data-testid="selo-da-visita">
      {t(ROTULO_DO_STATUS[status])}
    </span>
  );
}

export function VisitaDoPaciente({
  appointmentId,
  contactId,
  statusDoAgendamento,
  podeMudar,
}: {
  appointmentId: string;
  contactId: string | null;
  statusDoAgendamento: string;
  podeMudar: boolean;
}) {
  const t = useT();
  const tagDoIdioma = useTagDeIdioma();
  const qc = useQueryClient();
  const { data: pessoas = [] } = usePessoasDaAgenda();
  const [fichaAberta, setFichaAberta] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);
  const [paraCorrigir, setParaCorrigir] = useState<StatusDaVisita>("agendado");
  const [motivo, setMotivo] = useState("");
  const chave = ["clinic", "visita", appointmentId];

  const consulta = useQuery({
    queryKey: chave,
    enabled: !!contactId,
    queryFn: async () =>
      (await apiClient.get<{ data: Visita }>(`/api/v1/clinic/agendamentos/${appointmentId}/visita`)).data,
  });

  // FORK clinic (agenda S5): "Iniciar atendimento" CRIA o atendimento e abre o
  // prontuário nele. Sem o módulo de prontuário, cai no passo de status de antes.
  const router = useRouter();
  const iniciar = useMutation({
    mutationFn: async () =>
      (await apiClient.post<{ data: { id: string } }>(`/api/v1/clinic/agendamentos/${appointmentId}/atendimento`, {})).data,
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: chave });
      router.push(`/app/atendimentos/${r.id}`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "prontuario_desligado") {
        mudar.mutate({ status: "em_atendimento" });
        return;
      }
      showApiError(err);
    },
  });

  const mudar = useMutation({
    mutationFn: (corpo: { status: StatusDaVisita; motivo?: string }) =>
      apiClient.post(`/api/v1/clinic/agendamentos/${appointmentId}/visita`, corpo),
    onSuccess: () => {
      setFichaAberta(false);
      setCorrigindo(false);
      setMotivo("");
      void qc.invalidateQueries({ queryKey: chave });
      void qc.invalidateQueries({ queryKey: ["clinic", "recepcao"] });
      void qc.invalidateQueries({ queryKey: ["agenda"] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "ficha_incompleta") {
        setFichaAberta(true);
        return;
      }
      showApiError(err);
    },
  });

  if (!contactId || statusDoAgendamento === "cancelled") return null;
  if (consulta.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;

  const atual = consulta.data?.visita.status ?? "agendado";
  const proximo = ACAO_PARA_AVANCAR[atual];
  // FORK clinic (agenda S4): chegada e pronto são da recepção; iniciar e
  // finalizar, só do profissional do agendamento (o servidor confere de novo).
  const ehODono = consulta.data?.eh_o_dono === true;
  const mostrarProximo = podeAvancar(proximo, { ehODono, podeRecepcao: podeMudar });
  const primeiraVez = consulta.data?.primeira_vez === true;
  const nome = (id: string | null) => pessoas.find((p) => p.id === id)?.nome ?? t("Equipe");
  const correcao = ehCorrecao(atual, paraCorrigir);

  return (
    <div className="space-y-2 rounded-lg border p-3" data-testid="visita-do-paciente">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-text-muted">{t("Status da visita")}:</span>
        <SeloDaVisita status={atual} />
        {primeiraVez ? <SeloPrimeiraVez /> : null}
        <SeloDaConfirmacao status={consulta.data?.confirmacao?.status} falha={consulta.data?.confirmacao?.falha} />
      </div>
      {consulta.data?.faltas ? (
        <p
          className={`text-sm ${consulta.data.faltas >= 2 ? "font-medium text-warning" : "text-text-muted"}`}
          data-testid="faltas-do-paciente"
        >
          {t("Faltou")} {consulta.data.faltas}× {t("nos últimos 12 meses")}
          {consulta.data.faltas >= 2 ? ` — ${t("vale confirmar por telefone")}` : ""}
        </p>
      ) : null}
      {consulta.data?.recursos && consulta.data.recursos.length > 0 ? (
        <p className="text-sm text-text-muted" data-testid="recursos-do-compromisso">
          {t("Sala e equipamento")}: {consulta.data.recursos.join(" · ")}
        </p>
      ) : null}

      {/* FORK clinic (agenda S4): EM RECEPÇÃO — 1ª vez completa o cadastro; quem já
          veio confirma telefone e e-mail. Depois, "Pronto para atendimento". */}
      {podeMudar && atual === "na_recepcao" && contactId ? (
        primeiraVez ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-accent bg-accent-soft p-2" data-testid="recepcao-primeira-vez">
            <p className="text-sm">{t("Primeira vez na clínica: complete o cadastro antes de liberar para o atendimento.")}</p>
            <Button size="sm" variant="outline" data-testid="completar-cadastro" onClick={() => setFichaAberta(true)}>
              {t("Completar cadastro")}
            </Button>
          </div>
        ) : (
          <ConfirmarDadosDoPaciente contactId={contactId} appointmentId={appointmentId} />
        )
      ) : null}

      {podeMudar || ehODono ? (
        <div className="flex flex-wrap gap-2">
          {consulta.data?.atendimento && ehODono ? (
            <Button size="sm" asChild data-testid="visita-abrir-atendimento">
              <Link href={`/app/atendimentos/${consulta.data.atendimento.id}`}>
                {consulta.data.atendimento.status === "em_andamento" ? t("Continuar atendimento") : t("Abrir atendimento")}
              </Link>
            </Button>
          ) : null}
          {mostrarProximo && proximo && !(consulta.data?.atendimento && proximo.quem === "profissional") ? (
            <Button
              size="sm"
              data-testid={`visita-${proximo.para}`}
              disabled={mudar.isPending}
              onClick={() => (proximo.para === "em_atendimento" ? iniciar.mutate() : mudar.mutate({ status: proximo.para }))}
            >
              {t(proximo.rotulo)}
            </Button>
          ) : null}
          {podeMudar ? (
          <Button
            size="sm"
            variant="ghost"
            data-testid="visita-corrigir"
            onClick={() => {
              setParaCorrigir(atual);
              setCorrigindo((v) => !v);
            }}
          >
            {t("Corrigir status")}
          </Button>
          ) : null}
        </div>
      ) : null}

      {corrigindo ? (
        <form
          className="space-y-2 rounded-md border p-2"
          data-testid="visita-correcao"
          onSubmit={(e) => {
            e.preventDefault();
            mudar.mutate({ status: paraCorrigir, ...(motivo.trim() ? { motivo: motivo.trim() } : {}) });
          }}
        >
          <label className="block">
            <span className="block text-sm">{t("Novo status")}</span>
            <select
              aria-label={t("Novo status")}
              className="mt-1 w-full rounded-md border bg-surface p-2"
              value={paraCorrigir}
              onChange={(e) => setParaCorrigir(e.target.value as StatusDaVisita)}
            >
              {STATUS_DA_VISITA.map((s) => (
                <option key={s} value={s}>
                  {t(ROTULO_DO_STATUS[s])}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm">
              {correcao ? t("Motivo da correção (obrigatório)") : t("Motivo (opcional)")}
            </span>
            <input
              aria-label={t("Motivo da correção")}
              className="mt-1 w-full rounded-md border bg-surface p-2"
              maxLength={300}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
          <Button
            size="sm"
            type="submit"
            disabled={mudar.isPending || paraCorrigir === atual || (correcao && motivo.trim().length < 3)}
          >
            {t("Salvar status")}
          </Button>
        </form>
      ) : null}

      {consulta.data && consulta.data.eventos.length > 0 ? (
        <ol className="space-y-1 text-xs text-text-muted" data-testid="visita-historico">
          {consulta.data.eventos.map((e) => (
            <li key={e.id}>
              {new Date(e.created_at).toLocaleTimeString(tagDoIdioma, { hour: "2-digit", minute: "2-digit" })} —{" "}
              {t(ROTULO_DO_STATUS[e.to_status])} · {nome(e.changed_by)}
              {e.is_correction ? ` · ${t("correção")}: ${e.reason ?? ""}` : ""}
            </li>
          ))}
        </ol>
      ) : null}

      <Dialog open={fichaAberta} onOpenChange={setFichaAberta}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Complete a ficha do paciente")}</DialogTitle>
            <DialogDescription>
              {atual === "agendado"
                ? t("A clínica exige a ficha cadastral completa para registrar a chegada. Ao salvar completa, a chegada é registrada.")
                : t("Primeira vez na clínica: preencha os dados do paciente. O e-mail é opcional.")}
            </DialogDescription>
          </DialogHeader>
          <FichaDoPaciente
            contactId={contactId}
            podeEditar={podeMudar}
            onSalva={(situacao) => {
              if (situacao.completa && atual === "agendado") mudar.mutate({ status: "na_recepcao" });
              else if (situacao.completa) setFichaAberta(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
