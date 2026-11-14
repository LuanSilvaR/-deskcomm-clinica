"use client";

/**
 * FORK clinic (agenda S3 #68) — os procedimentos de um agendamento.
 *
 * `ProcedimentosDaMarcacao`: o campo do painel "Novo agendamento" — escolhe 1 ou
 * mais procedimentos do catálogo, na ordem; tira com o ×. A duração NÃO é somada
 * (decisão do dono): o fim continua o escolhido no painel.
 *
 * `ProcedimentosDoAgendamento`: a linha do detalhe do compromisso, lida de
 * `GET /api/v1/clinic/agendamentos/[id]/procedimentos`.
 *
 * `salvarProcedimentosDoAgendamento`: grava depois que a marcação devolve o id.
 */
import { useQuery } from "@tanstack/react-query";

import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { ProcedimentoDaAgenda } from "@/lib/clinic/agenda/filtros-da-agenda";
import { X } from "@/lib/ui/icons";

export function ProcedimentosDaMarcacao({
  catalogo,
  valor,
  onChange,
}: {
  catalogo: ProcedimentoDaAgenda[];
  valor: string[];
  onChange: (ids: string[]) => void;
}) {
  const t = useT();
  const nome = (id: string) => catalogo.find((p) => p.id === id)?.nome ?? "?";
  const restantes = catalogo.filter((p) => !valor.includes(p.id));
  if (catalogo.length === 0) return null;
  return (
    <div data-testid="procedimentos-da-marcacao">
      <label className="block" htmlFor="procedimento-da-marcacao">
        {t("Procedimentos")} <span className="font-normal opacity-70">({t("opcional")})</span>
      </label>
      {valor.length > 0 ? (
        <ol className="mt-1 flex flex-wrap gap-1" aria-label={t("Procedimentos escolhidos")}>
          {valor.map((id, i) => (
            <li key={id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs" data-testid={`procedimento-escolhido-${id}`}>
              <span className="text-text-muted">{i + 1}.</span> {nome(id)}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-muted"
                aria-label={`${t("Tirar")} ${nome(id)}`}
                onClick={() => onChange(valor.filter((x) => x !== id))}
              >
                <X aria-hidden size={12} />
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      {restantes.length > 0 ? (
        <select
          id="procedimento-da-marcacao"
          data-testid="procedimento-da-marcacao"
          className="mt-1 h-9 w-full rounded-md border bg-surface px-2 text-sm"
          value=""
          onChange={(e) => {
            if (e.target.value) onChange([...valor, e.target.value]);
          }}
        >
          <option value="">{valor.length ? t("Adicionar outro procedimento") : t("Escolher procedimento")}</option>
          {restantes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      ) : null}
      <p className="mt-1 text-xs text-text-muted">{t("A duração não muda: o horário de fim continua o escolhido.")}</p>
    </div>
  );
}

export function salvarProcedimentosDoAgendamento(appointmentId: string, procedimentos: string[]) {
  return apiClient.put<{ data: { total: number } }>(`/api/v1/clinic/agendamentos/${appointmentId}/procedimentos`, { procedimentos });
}

export function ProcedimentosDoAgendamento({ appointmentId }: { appointmentId: string }) {
  const t = useT();
  const { data } = useQuery({
    queryKey: ["clinic", "agendamento-procedimentos", appointmentId],
    queryFn: async () =>
      (await apiClient.get<{ data: { procedimentos: Array<{ id: string; nome: string; ordem: number }> } }>(
        `/api/v1/clinic/agendamentos/${appointmentId}/procedimentos`,
      )).data.procedimentos,
    staleTime: 30_000,
  });
  if (!data || data.length === 0) return null;
  return (
    <p data-testid="procedimentos-do-agendamento">
      <span className="text-text-muted">{t("Procedimentos")}: </span>
      {data.map((p) => p.nome).join(" · ")}
    </p>
  );
}
