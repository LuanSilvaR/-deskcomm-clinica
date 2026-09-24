"use client";

/**
 * As colunas do dia por profissional (E1.4). O dado vem de
 * /api/v1/clinic/dia-por-profissional; mudança na agenda (Realtime de
 * `calendar_appointments`) só avisa a tela para perguntar de novo.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { usePessoasDaAgenda } from "@/hooks/agenda/usePessoasDaAgenda";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { useRealtimeChannel } from "@/hooks/realtime/useRealtimeChannel";
import { ROTULO_DA_SITUACAO, type SituacaoDoAgendamento } from "@/lib/agenda/tipos";
import { apiClient } from "@/lib/api/client";
import { horaDoMinuto, type ColunaDoProfissional, type OrigemDoBloqueio } from "@/lib/clinic/agenda/dia-por-profissional";

interface Resposta {
  ligado: boolean;
  dia: string | null;
  fuso: string;
  colunas: ColunaDoProfissional[];
}

const ROTULO_DO_BLOQUEIO: Record<OrigemDoBloqueio, string> = {
  pessoa: "Bloqueado",
  clinica: "Clínica fechada",
  indisponivel: "Indisponível",
};

type Item =
  | { tipo: "bloqueio"; chave: string; inicioMinuto: number; fimMinuto: number; origem: OrigemDoBloqueio; motivo: string | null }
  | { tipo: "compromisso"; chave: string; inicio: string; fim: string; titulo: string; paciente: string | null; status: string; id: string };

export function DiaPorProfissional({ orgId, dia }: { orgId: string; dia: string | null }) {
  const t = useT();
  const tagDoIdioma = useTagDeIdioma();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: pessoas = [] } = usePessoasDaAgenda();
  const CHAVE = ["clinic", "dia-por-profissional", dia ?? "hoje"];

  const consulta = useQuery({
    queryKey: CHAVE,
    queryFn: async () =>
      (await apiClient.get<{ data: Resposta }>(`/api/v1/clinic/dia-por-profissional${dia ? `?dia=${dia}` : ""}`)).data,
    refetchInterval: 120_000,
  });
  const recarregar = useCallback(() => void qc.invalidateQueries({ queryKey: ["clinic", "dia-por-profissional"] }), [qc]);
  useRealtimeChannel({
    name: `dia-por-profissional-${orgId}`,
    postgresChanges: { event: "*", schema: "public", table: "calendar_appointments", filter: `organization_id=eq.${orgId}` },
    onChange: recarregar,
  });

  const r = consulta.data;
  const nome = (id: string) => pessoas.find((p) => p.id === id)?.nome ?? t("Profissional");
  const hora = (iso: string) =>
    new Date(iso).toLocaleTimeString(tagDoIdioma, { hour: "2-digit", minute: "2-digit", timeZone: r?.fuso });

  if (consulta.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (consulta.isError || !r) return <p className="text-sm text-destructive">{t("Não foi possível carregar o dia.")}</p>;
  if (!r.ligado) {
    return (
      <p className="text-sm text-text-muted" data-testid="dia-por-profissional-desligado">
        {t("Ligue as regras de profissionais em Configurações › Profissionais para ver o dia por profissional.")}{" "}
        <Link href="/app/settings/tenant/profissionais" className="underline">
          {t("Abrir configurações")}
        </Link>
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="dia-por-profissional">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm">
          <span className="mr-2">{t("Dia")}</span>
          <input
            type="date"
            data-testid="dia-por-profissional-data"
            className="rounded-md border bg-surface p-1.5"
            value={r.dia ?? ""}
            onChange={(e) => e.target.value && router.push(`/app/agenda/profissionais?dia=${e.target.value}`)}
          />
        </label>
        <Link href="/app/agenda" className="text-sm underline">
          {t("Voltar para a Agenda")}
        </Link>
      </div>

      {r.colunas.length === 0 ? (
        <p className="text-sm text-text-muted" data-testid="dia-sem-profissionais">
          {t("Ninguém tem jornada nem compromisso neste dia.")}
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-x-auto pb-2">
          <div className="grid auto-cols-[minmax(220px,1fr)] grid-flow-col gap-3">
            {r.colunas.map((c) => {
              const itens: Item[] = [
                ...c.bloqueios.map((b, i) => ({
                  tipo: "bloqueio" as const,
                  chave: `b${i}`,
                  inicioMinuto: b.inicio_minuto,
                  fimMinuto: b.fim_minuto,
                  origem: b.origem,
                  motivo: b.motivo,
                })),
                ...c.compromissos.map((a) => ({
                  tipo: "compromisso" as const,
                  chave: a.id,
                  id: a.id,
                  inicio: a.inicio,
                  fim: a.fim,
                  titulo: a.titulo,
                  paciente: a.paciente,
                  status: a.status,
                })),
              ];
              // Ordem de horário: o bloqueio é minuto do dia local; o compromisso, o instante no fuso da clínica.
              const minutoDoItem = (i: Item) => {
                if (i.tipo === "bloqueio") return i.inicioMinuto;
                const [h, m] = hora(i.inicio).split(":").map(Number);
                return (h ?? 0) * 60 + (m ?? 0);
              };
              itens.sort((a, b) => minutoDoItem(a) - minutoDoItem(b));
              return (
                <section
                  key={c.profissional_id}
                  className="flex min-w-0 flex-col gap-2 rounded-xl border p-3"
                  data-testid="coluna-do-profissional"
                  data-profissional={c.profissional_id}
                >
                  <header>
                    <p className="truncate font-medium">{nome(c.profissional_id)}</p>
                    <p className="text-xs text-text-muted" data-testid="jornada-do-dia">
                      {c.jornada.length > 0
                        ? c.jornada.map((j) => `${horaDoMinuto(j.inicio_minuto)}–${horaDoMinuto(j.fim_minuto)}`).join(" · ")
                        : t("Fora da jornada (encaixe)")}
                    </p>
                  </header>
                  {itens.length === 0 ? (
                    <p className="text-xs text-text-muted">{t("Agenda livre no dia.")}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {itens.map((i) =>
                        i.tipo === "bloqueio" ? (
                          <li
                            key={i.chave}
                            className="rounded-md bg-muted px-2 py-1 text-xs text-text-muted"
                            data-testid="bloqueio-do-dia"
                          >
                            <span className="font-medium">
                              {horaDoMinuto(i.inicioMinuto)}–{horaDoMinuto(i.fimMinuto)} · {t(ROTULO_DO_BLOQUEIO[i.origem])}
                            </span>
                            {i.motivo ? <span className="block truncate">{i.motivo}</span> : null}
                          </li>
                        ) : (
                          <li key={i.chave}>
                            <Link
                              href={`/app/agenda?compromisso=${i.id}`}
                              className="block rounded-md border px-2 py-1 text-sm hover:bg-muted"
                              data-testid="compromisso-do-dia"
                            >
                              <span className="font-medium">
                                {hora(i.inicio)}–{hora(i.fim)}
                              </span>{" "}
                              <span className="truncate">{i.paciente ?? i.titulo}</span>
                              <span className="block text-xs text-text-muted">
                                {i.titulo} · {t(ROTULO_DA_SITUACAO[i.status as SituacaoDoAgendamento] ?? i.status)}
                              </span>
                            </Link>
                          </li>
                        ),
                      )}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
