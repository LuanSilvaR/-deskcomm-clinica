"use client";

/**
 * A área do atendimento (fork clinic, prontuário F1).
 *
 * Cabeçalho fixo com o que o profissional precisa ver de relance (paciente,
 * idade, serviço, especialidade, desde quando) e o botão de finalizar. As
 * seções clínicas aparecem listadas como "próxima etapa" para a navegação já
 * nascer no lugar certo — nada de campo solto que não salva.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

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

const ROTULO_DO_STATUS: Record<Atendimento["status"], string> = {
  em_andamento: "Em atendimento",
  finalizado: "Finalizado",
  anulado: "Anulado",
};

const SECOES_PREVISTAS = ["Anamnese", "Avaliação", "Conduta", "Plano de tratamento", "Procedimentos", "Evolução", "Anexos"];

export function AtendimentoDoDia({ id }: { id: string }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const qc = useQueryClient();
  const chave = ["clinic", "atendimento", id];

  const at = useQuery({
    queryKey: chave,
    queryFn: async () => (await apiClient.get<{ data: Atendimento }>(`/api/v1/clinic/atendimentos/${id}`)).data,
  });

  const finalizar = useMutation({
    mutationFn: () => apiClient.post(`/api/v1/clinic/atendimentos/${id}/finalizar`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chave }),
    onError: showApiError,
  });

  const quando = (iso: string) => new Date(iso).toLocaleString(tag, { dateStyle: "short", timeStyle: "short" });

  if (at.isLoading) return <p className="p-6 text-sm text-text-muted">{t("Carregando…")}</p>;
  if (at.isError || !at.data) {
    return <p className="p-6 text-sm text-destructive">{t("Não foi possível abrir o atendimento.")}</p>;
  }
  const a = at.data;

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
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant={a.status === "em_andamento" ? "default" : "secondary"} data-testid="atendimento-status">
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
        </div>
      </header>

      <section aria-labelledby="secoes-do-atendimento" className="rounded-xl border p-4">
        <h2 id="secoes-do-atendimento" className="text-sm font-semibold">
          {t("Registros do atendimento")}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {t("Os registros clínicos chegam na próxima etapa do módulo. O atendimento já fica registrado com paciente, profissional, horário e status.")}
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {SECOES_PREVISTAS.map((s) => (
            <li key={s}>
              <Badge variant="outline" aria-disabled="true">
                {t(s)} · {t("Em breve")}
              </Badge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
