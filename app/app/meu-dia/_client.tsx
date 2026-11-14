"use client";

/**
 * FORK clinic (agenda S5) — "Meu dia": o que o profissional precisa ver ao
 * entrar. Lê a mesma fila de "Meus atendimentos" (só a própria agenda, no fuso
 * da clínica) e reorganiza para a pergunta "o que eu faço agora?":
 *
 *   contadores (só os meus) → atendimento em andamento → PRÓXIMO PACIENTE →
 *   lista de hoje com o status (texto + ícone; "pronto" em destaque).
 *
 * "Iniciar atendimento" só aparece para quem a recepção liberou ("pronto") e
 * abre o prontuário direto no atendimento criado. Paciente "em recepção" não
 * pede ação do profissional.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { SeloPrimeiraVez } from "@/components/clinic/agenda/InfoDaClinicaNaAgenda";
import { SeloDeStatus } from "@/components/clinic/agenda/SeloDeStatus";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { useRealtimeChannel } from "@/hooks/realtime/useRealtimeChannel";
import { apiClient } from "@/lib/api/client";
import type { ItemNaFila, SecaoDaFila } from "@/lib/clinic/atendimento/fila";
import type { StatusDeExibicao } from "@/lib/clinic/visitas/exibicao";
import { CalendarBlank, Stethoscope } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

interface RespostaDaFila {
  dia: string;
  ligado: boolean;
  pode_iniciar: boolean;
  pode_abrir: boolean;
  fila: Record<SecaoDaFila, ItemNaFila[]>;
}

const CHAVE = ["clinic", "atendimentos", "fila", "meus"] as const;

/** "Dr. Bruno Vasconcelos" → "Bruno": o título não é o nome. */
function primeiroNome(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return partes.find((p) => !/^(dr|dra|sr|sra)\.?$/i.test(p)) ?? partes[0] ?? nome;
}

export function MeuDia({ orgId, usuarioId, nome }: { orgId: string; usuarioId: string; nome: string | null }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const router = useRouter();
  const qc = useQueryClient();

  const consulta = useQuery({
    queryKey: CHAVE,
    queryFn: async () => (await apiClient.get<{ data: RespostaDaFila }>("/api/v1/clinic/atendimentos/fila")).data,
    refetchInterval: 60_000,
  });
  const recarregar = React.useCallback(() => void qc.invalidateQueries({ queryKey: ["clinic", "atendimentos", "fila"] }), [qc]);
  useRealtimeChannel({
    name: `meu-dia-visitas-${orgId}`,
    postgresChanges: { event: "*", schema: "public", table: "clinic_appointment_visits", filter: `organization_id=eq.${orgId}` },
    onChange: recarregar,
  });

  const iniciar = useMutation({
    mutationFn: async (appointmentId: string) =>
      (await apiClient.post<{ data: { id: string } }>(`/api/v1/clinic/agendamentos/${appointmentId}/atendimento`, {})).data,
    onSuccess: (r) => {
      recarregar();
      router.push(`/app/atendimentos/${r.id}`);
    },
    onError: showApiError,
  });

  const hora = (iso: string) => new Date(iso).toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" });
  const hoje = new Date().toLocaleDateString(tag, { weekday: "long", day: "numeric", month: "long" });

  if (consulta.isLoading) {
    return (
      <div className="space-y-3 p-4 md:p-6" data-testid="meu-dia-carregando">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  const dados = consulta.data;
  if (!dados) return <p className="p-6 text-sm text-text-muted">{t("Não foi possível carregar o seu dia.")}</p>;

  const meus = (l: ItemNaFila[]) => l.filter((i) => !i.profissional_id || i.profissional_id === usuarioId);
  const aguardando = meus(dados.fila.aguardando);
  const emAtendimento = meus(dados.fila.em_atendimento);
  const proximos = meus(dados.fila.proximos);
  const finalizados = meus(dados.fila.finalizados);
  const todos = [...aguardando, ...emAtendimento, ...proximos, ...finalizados].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const prontos = aguardando.filter((i) => i.status === "pronto");
  const proximo = prontos[0] ?? aguardando[0] ?? proximos[0] ?? null;
  const podeIniciar = (i: ItemNaFila) => dados.pode_iniciar && i.status === "pronto";

  const contadores: { rotulo: string; n: number; testid: string }[] = [
    { rotulo: "Pacientes hoje", n: todos.length, testid: "meu-dia-total" },
    { rotulo: "Aguardando", n: aguardando.length + proximos.length, testid: "meu-dia-aguardando" },
    { rotulo: "Prontos para atendimento", n: prontos.length, testid: "meu-dia-prontos" },
    { rotulo: "Em atendimento", n: emAtendimento.length, testid: "meu-dia-em-atendimento" },
    { rotulo: "Finalizados", n: finalizados.length, testid: "meu-dia-finalizados" },
  ];
  const exibicao = (i: ItemNaFila): StatusDeExibicao => i.exibicao ?? (i.status === "agendado" ? "agendado" : i.status);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6" data-testid="meu-dia">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{nome ? `${t("Olá")}, ${primeiroNome(nome)}` : t("Meu dia")}</h1>
          <p className="text-sm text-text-muted first-letter:uppercase">
            {t("Hoje")} — {hoje}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/agenda?visao=dia" data-testid="meu-dia-minha-agenda">
              <CalendarBlank size={16} weight="bold" aria-hidden />
              {t("Minha agenda")}
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/app/agenda?visao=semana`}>{t("Semana")}</Link>
          </Button>
        </div>
      </header>

      <div role="group" aria-label={t("Resumo do dia")} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {contadores.map((c) => (
          <div key={c.testid} className="rounded-lg border bg-surface p-3" data-testid={c.testid}>
            <span className="block text-2xl font-semibold tabular-nums">{c.n}</span>
            <span className="text-xs text-text-muted">{t(c.rotulo)}</span>
          </div>
        ))}
      </div>

      {emAtendimento.map((i) => (
        <section
          key={i.appointment_id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent bg-accent-soft p-4"
          data-testid="meu-dia-em-andamento"
        >
          <div className="flex items-center gap-3">
            <Stethoscope size={22} weight="bold" aria-hidden className="text-accent" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide">{t("Atendimento em andamento")}</p>
              <p className="text-base font-semibold">{i.paciente ?? t("Paciente")}</p>
              <p className="text-xs text-text-muted">
                {i.servico ? `${i.servico} · ` : ""}
                {i.atendimento_inicio ? `${t("iniciado às")} ${hora(i.atendimento_inicio)}` : hora(i.inicio)}
              </p>
            </div>
          </div>
          {i.atendimento_id && dados.pode_abrir ? (
            <Button asChild className="h-11 md:h-10">
              <Link href={`/app/atendimentos/${i.atendimento_id}`} data-testid="meu-dia-continuar">
                {t("Continuar atendimento")}
              </Link>
            </Button>
          ) : null}
        </section>
      ))}

      {proximo ? (
        <section className="rounded-xl border p-4" data-testid="meu-dia-proximo" data-status={proximo.status}>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t("Próximo paciente")}</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm tabular-nums text-text-muted">{hora(proximo.inicio)}</p>
              <p className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                {proximo.paciente ?? t("Paciente")}
                {proximo.primeira_vez ? <SeloPrimeiraVez /> : null}
              </p>
              {proximo.servico ? <p className="text-sm text-text-muted">{proximo.servico}</p> : null}
              <div className="mt-1">
                <SeloDeStatus status={exibicao(proximo)} />
              </div>
            </div>
            {podeIniciar(proximo) ? (
              <Button className="h-12 px-6 text-base" data-testid="meu-dia-iniciar" disabled={iniciar.isPending} onClick={() => iniciar.mutate(proximo.appointment_id)}>
                {t("Iniciar atendimento")}
              </Button>
            ) : proximo.status === "na_recepcao" ? (
              <p className="text-sm text-text-muted">{t("Com a recepção — aguardando liberar para o atendimento.")}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border" data-testid="meu-dia-agenda">
        <h2 className="border-b px-4 py-2 text-sm font-semibold">{t("Agenda de hoje")}</h2>
        {todos.length === 0 ? (
          <p className="px-4 py-6 text-sm text-text-muted" data-testid="meu-dia-vazio">
            {t("Nenhum paciente na sua agenda hoje.")}
          </p>
        ) : (
          <ul className="divide-y">
            {todos.map((i) => {
              const pronto = i.status === "pronto";
              return (
                <li
                  key={i.appointment_id}
                  className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm", pronto && "bg-success-bg/40")}
                  data-testid="meu-dia-linha"
                  data-status={i.status}
                >
                  <span className="w-12 font-mono tabular-nums">{hora(i.inicio)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{i.paciente ?? t("Paciente")}</span>
                    {i.servico ? <span className="ml-2 text-xs text-text-muted">{i.servico}</span> : null}
                  </span>
                  <span className="flex items-center gap-1">
                    <SeloDeStatus status={exibicao(i)} />
                    {i.primeira_vez ? <SeloPrimeiraVez /> : null}
                  </span>
                  {podeIniciar(i) ? (
                    <Button size="sm" data-testid="meu-dia-linha-iniciar" disabled={iniciar.isPending} onClick={() => iniciar.mutate(i.appointment_id)}>
                      {t("Iniciar atendimento")}
                    </Button>
                  ) : i.atendimento_id && dados.pode_abrir ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/app/atendimentos/${i.atendimento_id}`}>
                        {i.status === "em_atendimento" ? t("Continuar atendimento") : t("Abrir atendimento")}
                      </Link>
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
