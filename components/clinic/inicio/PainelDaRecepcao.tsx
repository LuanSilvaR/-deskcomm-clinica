"use client";

/**
 * FORK clinic — o Início pensado para a RECEPÇÃO: o que ela faz o dia inteiro,
 * na primeira tela, sem navegar.
 *
 *   1. Barra de ações: buscar paciente (nome, CPF ou nascimento) com "Ficha" e
 *      "Agendar" no resultado; "Cadastrar paciente" (e agendar em seguida);
 *      atalhos para Novo agendamento e Conversas.
 *   2. Contadores clicáveis que FILTRAM a lista: a chegar, na recepção, em
 *      atendimento, finalizados, faltas, sem confirmação.
 *   3. Pacientes de hoje, em ordem de horário, com profissional, status,
 *      confirmação, faltas, "atrasado" e o botão do próximo passo.
 *   4. Ao lado: sala de espera (tempo de espera), confirmar para amanhã e
 *      vagas livres de hoje.
 *
 * Dados: /api/v1/clinic/agenda-do-dia (hoje e amanhã) e /api/v1/agenda/vinculos
 * (busca). Tempo real em visita, agenda e confirmação. As ações só aparecem
 * para quem tem a permissão; a rota decide de novo.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { SeloDeStatus } from "@/components/clinic/agenda/SeloDeStatus";
import { SeloDaConfirmacao } from "@/components/clinic/SeloDaConfirmacao";
import { NewContactDialog } from "@/components/contacts/NewContactDialog";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePessoasDaAgenda } from "@/hooks/agenda/usePessoasDaAgenda";
import { useT } from "@/hooks/i18n/useT";
import { useRealtimeChannel } from "@/hooks/realtime/useRealtimeChannel";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";
import type { BlocoDoProfissional, LinhaDeCompromisso } from "@/lib/clinic/agenda/agenda-do-dia";
import { horaDoMinuto } from "@/lib/clinic/agenda/dia-por-profissional";
import { usePermissoes } from "@/lib/clinic/acesso/use-permissoes";
import type { StatusDeExibicao } from "@/lib/clinic/visitas/exibicao";
import { ACAO_PARA_AVANCAR, ROTULO_DO_STATUS, ehStatusDaVisita } from "@/lib/clinic/visitas/status";
import { ArrowSquareOut, CalendarPlus, ChatsCircle, IdentificationCard, ListChecks, MagnifyingGlass, Plus, UserPlus } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

interface DiaDaAgenda {
  dia: string;
  hoje: string;
  fuso: string;
  blocos: BlocoDoProfissional[];
}

type Linha = LinhaDeCompromisso & { profissional: string };

type Filtro = "proximos" | "a_chegar" | "sala" | "em_atendimento" | "finalizados" | "faltas" | "sem_confirmacao" | "todos";

const A_CHEGAR: readonly StatusDeExibicao[] = ["agendado"];
const NA_SALA: readonly StatusDeExibicao[] = ["na_recepcao", "pronto"];
const ENCERRADOS: readonly StatusDeExibicao[] = ["finalizado", "faltou", "cancelado"];

function somarUmDia(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

function minutosDesde(iso: string | null, agora: number): number | null {
  if (!iso) return null;
  const m = Math.floor((agora - Date.parse(iso)) / 60_000);
  return Number.isFinite(m) && m >= 0 ? m : null;
}

function duracao(min: number): string {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

function semConfirmacao(l: Linha): boolean {
  return l.status === "agendado" && l.confirmacao !== "confirmado";
}

function linhasDoDia(d: DiaDaAgenda | undefined, nomeDe: (b: BlocoDoProfissional) => string): Linha[] {
  return (d?.blocos ?? [])
    .flatMap((b) =>
      b.linhas.filter((l): l is LinhaDeCompromisso => l.tipo === "compromisso").map((l) => ({ ...l, profissional: nomeDe(b) })),
    )
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

function useDiaDaAgenda(dia: string | null) {
  return useQuery({
    queryKey: ["clinic", "agenda-do-dia", dia ?? "hoje", ""],
    queryFn: async () =>
      (await apiClient.get<{ data: DiaDaAgenda }>(`/api/v1/clinic/agenda-do-dia${dia ? `?dia=${dia}` : ""}`)).data,
    refetchInterval: 60_000,
    placeholderData: (anterior) => anterior,
  });
}

export function PainelDaRecepcao({
  orgId,
  conversasNaoLidas,
  tarefasAteHoje,
}: {
  orgId: string;
  conversasNaoLidas?: number;
  tarefasAteHoje?: number;
}) {
  const t = useT();
  const { data: pessoas = [] } = usePessoasDaAgenda();
  const qc = useQueryClient();
  const { can } = usePermissoes();
  const hoje = useDiaDaAgenda(null);
  const diaDeAmanha = hoje.data ? somarUmDia(hoje.data.hoje) : null;
  const amanha = useQuery({
    queryKey: ["clinic", "agenda-do-dia", diaDeAmanha ?? "-", ""],
    queryFn: async () => (await apiClient.get<{ data: DiaDaAgenda }>(`/api/v1/clinic/agenda-do-dia?dia=${diaDeAmanha}`)).data,
    enabled: Boolean(diaDeAmanha),
    refetchInterval: 300_000,
  });

  const recarregar = React.useCallback(() => void qc.invalidateQueries({ queryKey: ["clinic", "agenda-do-dia"] }), [qc]);
  const { status: tempoReal } = useRealtimeChannel({
    name: `inicio-visitas-${orgId}`,
    postgresChanges: { event: "*", schema: "public", table: "clinic_appointment_visits", filter: `organization_id=eq.${orgId}` },
    onChange: recarregar,
  });
  useRealtimeChannel({
    name: `inicio-agenda-${orgId}`,
    postgresChanges: { event: "*", schema: "public", table: "calendar_appointments", filter: `organization_id=eq.${orgId}` },
    onChange: recarregar,
  });
  useRealtimeChannel({
    name: `inicio-confirmacao-${orgId}`,
    postgresChanges: { event: "*", schema: "public", table: "clinic_confirmation_requests", filter: `organization_id=eq.${orgId}` },
    onChange: recarregar,
  });

  const [agora, setAgora] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const nomeDe = React.useCallback(
    (b: BlocoDoProfissional) => b.ficha?.nome ?? pessoas.find((p) => p.id === b.profissional_id)?.nome ?? t("Profissional"),
    [pessoas, t],
  );
  const doDia = React.useMemo(() => linhasDoDia(hoje.data, nomeDe), [hoje.data, nomeDe]);
  const deAmanha = React.useMemo(() => linhasDoDia(amanha.data, nomeDe).filter(semConfirmacao), [amanha.data, nomeDe]);

  const [filtro, setFiltro] = React.useState<Filtro>("proximos");
  const contar = (f: (l: Linha) => boolean) => doDia.filter(f).length;
  const contadores: { id: Filtro; rotulo: string; n: number; tom: string }[] = [
    { id: "a_chegar", rotulo: "A chegar", n: contar((l) => A_CHEGAR.includes(l.status)), tom: "text-info-fg" },
    { id: "sala", rotulo: "Na sala de espera", n: contar((l) => NA_SALA.includes(l.status)), tom: "text-warning-fg" },
    { id: "em_atendimento", rotulo: "Em atendimento", n: contar((l) => l.status === "em_atendimento"), tom: "text-accent" },
    { id: "finalizados", rotulo: "Finalizados", n: contar((l) => l.status === "finalizado"), tom: "text-success-fg" },
    { id: "faltas", rotulo: "Faltas", n: contar((l) => l.status === "faltou"), tom: "text-error-fg" },
    { id: "sem_confirmacao", rotulo: "Sem confirmação", n: contar(semConfirmacao), tom: "text-warning-fg" },
  ];
  const passa: Record<Filtro, (l: Linha) => boolean> = {
    proximos: (l) => !ENCERRADOS.includes(l.status),
    a_chegar: (l) => A_CHEGAR.includes(l.status),
    sala: (l) => NA_SALA.includes(l.status),
    em_atendimento: (l) => l.status === "em_atendimento",
    finalizados: (l) => l.status === "finalizado",
    faltas: (l) => l.status === "faltou",
    sem_confirmacao: semConfirmacao,
    todos: () => true,
  };
  const lista = doDia.filter(passa[filtro]);
  const sala = doDia
    .filter((l) => NA_SALA.includes(l.status))
    .sort((a, b) => (a.desde ?? "").localeCompare(b.desde ?? ""));
  const vagas = (hoje.data?.blocos ?? [])
    .flatMap((b) => b.linhas.filter((l) => l.tipo === "livre" && !l.passou).map((l) => ({ profissional: nomeDe(b), inicio: l.inicio_minuto })))
    .sort((a, b) => a.inicio - b.inicio)
    .slice(0, 6);

  const avancar = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string; paciente: string }) =>
      apiClient.post(`/api/v1/clinic/agendamentos/${id}/visita`, { status }),
    onSuccess: (_r, v) => {
      toast.success(`${t("Status de")} ${v.paciente} ${t("atualizado para")} ${t(ehStatusDaVisita(v.status) ? ROTULO_DO_STATUS[v.status] : v.status)}.`);
      recarregar();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "ficha_incompleta") {
        showApiError(new ApiError(err.status, err.code, err.details, err.requestId, t("Complete a ficha do paciente (abra o agendamento na Agenda).")));
        return;
      }
      showApiError(err);
    },
  });
  const podeAvancar = can("recepcao.mudar_status_visita");
  const podeMarcar = can("agenda.marcar");
  const podeVerFicha = can("pacientes.ver_ficha");

  const BotaoAvancar = ({ l, tamanho = "sm" }: { l: Linha; tamanho?: "sm" | "default" }) => {
    const proximo = ehStatusDaVisita(l.status) ? ACAO_PARA_AVANCAR[l.status] : null;
    if (!podeAvancar || !proximo) return null;
    return (
      <Button
        size={tamanho}
        data-testid="inicio-avancar"
        disabled={avancar.isPending}
        onClick={() => avancar.mutate({ id: l.id, status: proximo.para, paciente: l.paciente ?? t("Paciente") })}
      >
        {t(proximo.rotulo)}
      </Button>
    );
  };

  return (
    <div className="space-y-4" data-testid="painel-da-recepcao-no-inicio" data-realtime-status={tempoReal}>
      <AcoesRapidas podeMarcar={podeMarcar} conversasNaoLidas={conversasNaoLidas} tarefasAteHoje={tarefasAteHoje} />

      {/* ── contadores = filtros da lista ─────────────────────────────── */}
      <div role="group" aria-label={t("Filtrar os pacientes de hoje")} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {contadores.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={filtro === c.id}
            data-testid={`inicio-contador-${c.id}`}
            onClick={() => setFiltro(filtro === c.id ? "proximos" : c.id)}
            className={cn(
              "rounded-lg border bg-surface p-3 text-left transition-colors hover:border-border-strong",
              "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
              filtro === c.id && "border-accent ring-1 ring-accent",
            )}
          >
            <span className={cn("block text-2xl font-semibold tabular-nums", c.tom)}>{hoje.isLoading ? "–" : c.n}</span>
            <span className="text-xs text-text-muted">{t(c.rotulo)}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── pacientes de hoje ─────────────────────────────────────────── */}
        <section className="rounded-xl border bg-surface lg:col-span-2" aria-labelledby="inicio-pacientes-de-hoje" data-testid="inicio-pacientes-de-hoje">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
            <h2 id="inicio-pacientes-de-hoje" className="font-semibold">
              {t("Pacientes de hoje")}
              <span className="ml-2 text-sm font-normal text-text-muted">
                {filtro === "proximos" ? t("a atender") : t(contadores.find((c) => c.id === filtro)?.rotulo ?? "Todos")} · {lista.length}
              </span>
            </h2>
            <div className="flex gap-1">
              <Button size="sm" variant={filtro === "proximos" ? "default" : "outline"} onClick={() => setFiltro("proximos")} data-testid="inicio-filtro-proximos">
                {t("A atender")}
              </Button>
              <Button size="sm" variant={filtro === "todos" ? "default" : "outline"} onClick={() => setFiltro("todos")} data-testid="inicio-filtro-todos">
                {t("Todos")}
              </Button>
            </div>
          </header>
          {hoje.isLoading ? (
            <div className="space-y-2 p-3" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : hoje.isError ? (
            <p className="p-4 text-sm text-destructive">{t("Não foi possível carregar a agenda do dia.")}</p>
          ) : lista.length === 0 ? (
            <p className="p-6 text-center text-sm text-text-muted" data-testid="inicio-lista-vazia">
              {doDia.length === 0 ? t("Nenhum paciente agendado para hoje.") : t("Nenhum paciente neste filtro.")}
            </p>
          ) : (
            <ul className="max-h-[560px] divide-y overflow-y-auto" aria-label={t("Pacientes de hoje")}>
              {lista.map((l) => {
                const atraso = l.status === "agendado" ? minutosDesde(l.inicio, agora) : null;
                const espera = NA_SALA.includes(l.status) ? minutosDesde(l.desde, agora) : null;
                const paciente = l.paciente ?? t("Sem paciente");
                return (
                  <li
                    key={l.id}
                    className="flex items-start gap-3 px-3 py-2 text-sm"
                    data-testid="inicio-linha"
                    data-id={l.id}
                    data-status={l.status}
                  >
                    <span className="w-12 shrink-0 pt-0.5 font-mono tabular-nums">{horaDoMinuto(l.inicio_minuto)}</span>
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="block truncate font-medium">{paciente}</span>
                      <span className="block truncate text-xs text-text-muted">
                        {l.profissional} · {l.titulo}
                      </span>
                    <span className="flex flex-wrap items-center gap-1">
                      <SeloDeStatus status={l.status} complemento={espera !== null ? duracao(espera) : null} />
                      {atraso !== null && atraso >= 5 ? (
                        <span className="rounded-full bg-error-bg px-2 py-0.5 text-xs text-error-fg" data-testid="inicio-atrasado">
                          {t("Atrasado")} {atraso < 60 ? duracao(atraso) : "+1 h"}
                        </span>
                      ) : null}
                      <SeloDaConfirmacao status={l.confirmacao} />
                      {l.faltas > 0 ? (
                        <span className="rounded-full bg-error-bg px-2 py-0.5 text-xs text-error-fg">
                          {t("faltou")} {l.faltas}×
                        </span>
                      ) : null}
                    </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <BotaoAvancar l={l} />
                      {podeVerFicha && l.paciente_id ? (
                        <Button asChild size="icon" variant="ghost" aria-label={`${t("Ficha do paciente")}: ${paciente}`}>
                          <Link href={`/app/contacts/${l.paciente_id}`}>
                            <IdentificationCard aria-hidden />
                          </Link>
                        </Button>
                      ) : null}
                      <Button asChild size="icon" variant="ghost" aria-label={`${t("Abrir compromisso (remarcar ou cancelar)")}: ${paciente}`}>
                        <Link href={`/app/agenda?compromisso=${l.id}`} data-testid="inicio-abrir">
                          <ArrowSquareOut aria-hidden />
                        </Link>
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          {/* ── sala de espera ───────────────────────────────────────────── */}
          <section className="rounded-xl border bg-surface" aria-labelledby="inicio-sala" data-testid="inicio-sala-de-espera">
            <h2 id="inicio-sala" className="border-b p-3 font-semibold">
              {t("Sala de espera")} <span className="text-sm font-normal text-text-muted">· {sala.length}</span>
            </h2>
            {sala.length === 0 ? (
              <p className="p-3 text-sm text-text-muted">{t("Ninguém esperando agora.")}</p>
            ) : (
              <ul className="divide-y">
                {sala.map((l) => {
                  const espera = minutosDesde(l.desde, agora);
                  return (
                    <li key={l.id} className="space-y-1 p-3 text-sm" data-testid="inicio-sala-linha" data-id={l.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{l.paciente ?? t("Sem paciente")}</span>
                        {espera !== null ? (
                          <span className={cn("text-xs tabular-nums", espera >= 20 ? "font-semibold text-error-fg" : "text-text-muted")}>
                            {duracao(espera)}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-text-muted">
                          {horaDoMinuto(l.inicio_minuto)} · {l.profissional}
                        </span>
                        <SeloDeStatus status={l.status} />
                      </div>
                      <BotaoAvancar l={l} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ── confirmar para amanhã ────────────────────────────────────── */}
          <section className="rounded-xl border bg-surface" aria-labelledby="inicio-amanha" data-testid="inicio-confirmar-amanha">
            <h2 id="inicio-amanha" className="border-b p-3 font-semibold">
              {t("Confirmar para amanhã")} <span className="text-sm font-normal text-text-muted">· {deAmanha.length}</span>
            </h2>
            {deAmanha.length === 0 ? (
              <p className="p-3 text-sm text-text-muted">{t("Tudo confirmado para amanhã.")}</p>
            ) : (
              <ul className="max-h-64 divide-y overflow-y-auto">
                {deAmanha.map((l) => (
                  <li key={l.id} className="flex items-center gap-2 p-3 text-sm">
                    <span className="w-12 font-mono tabular-nums">{horaDoMinuto(l.inicio_minuto)}</span>
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="block truncate">{l.paciente ?? t("Sem paciente")}</span>
                      <SeloDaConfirmacao status={l.confirmacao} />
                    </span>
                    <Button asChild size="icon" variant="ghost" aria-label={`${t("Abrir compromisso (remarcar ou cancelar)")}: ${l.paciente ?? ""}`}>
                      <Link href={`/app/agenda?compromisso=${l.id}`}>
                        <ArrowSquareOut aria-hidden />
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── vagas livres de hoje ─────────────────────────────────────── */}
          <section className="rounded-xl border bg-surface" aria-labelledby="inicio-vagas" data-testid="inicio-vagas">
            <h2 id="inicio-vagas" className="border-b p-3 font-semibold">
              {t("Vagas livres hoje")}
            </h2>
            {vagas.length === 0 ? (
              <p className="p-3 text-sm text-text-muted">{t("Sem vagas livres no resto do dia.")}</p>
            ) : (
              <ul className="divide-y">
                {vagas.map((v) => (
                  <li key={`${v.profissional}-${v.inicio}`} className="flex items-center gap-2 p-3 text-sm">
                    <span className="w-12 font-mono tabular-nums">{horaDoMinuto(v.inicio)}</span>
                    <span className="min-w-0 flex-1 truncate text-text-muted">{v.profissional}</span>
                    {podeMarcar ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href="/app/agenda">
                          <Plus aria-hidden /> {t("Marcar")}
                        </Link>
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/** Busca de paciente + atalhos. A busca é a MESMA da marcação (/api/v1/agenda/vinculos). */
function AcoesRapidas({ podeMarcar, conversasNaoLidas, tarefasAteHoje }: { podeMarcar: boolean; conversasNaoLidas?: number; tarefasAteHoje?: number }) {
  const t = useT();
  const router = useRouter();
  const [termo, setTermo] = React.useState("");
  const [busca, setBusca] = React.useState("");
  const [cadastrando, setCadastrando] = React.useState(false);
  const campo = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const id = setTimeout(() => setBusca(termo.trim()), 300);
    return () => clearTimeout(id);
  }, [termo]);
  React.useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (alvo && (alvo.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName))) return;
      e.preventDefault();
      campo.current?.focus();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const resultado = useQuery({
    queryKey: ["clinic", "inicio-busca", busca],
    queryFn: async () =>
      (await apiClient.get<{ data: { contacts: { id: string; name: string; detalhe?: string }[] } }>(`/api/v1/agenda/vinculos?q=${encodeURIComponent(busca)}`))
        .data.contacts,
    enabled: busca.length >= 2,
  });
  const achados = resultado.data ?? [];

  return (
    <section className="rounded-xl border bg-surface p-3" aria-label={t("Ações rápidas")} data-testid="inicio-acoes-rapidas">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1">
          <label className="sr-only block" htmlFor="inicio-busca">
            {t("Buscar paciente")}
          </label>
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            id="inicio-busca"
            ref={campo}
            data-testid="inicio-busca"
            type="search"
            className="pl-8"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder={t("Buscar paciente: nome, CPF ou nascimento")}
            autoComplete="off"
          />
        </div>
        <Button size="sm" variant="outline" data-testid="inicio-cadastrar" onClick={() => setCadastrando(true)}>
          <UserPlus aria-hidden /> {t("Cadastrar paciente")}
        </Button>
        {podeMarcar ? (
          <Button asChild size="sm" data-testid="inicio-novo-agendamento">
            <Link href="/app/agenda">
              <CalendarPlus aria-hidden /> {t("Novo agendamento")}
            </Link>
          </Button>
        ) : null}
        <Button asChild size="sm" variant="outline">
          <Link href="/app/inbox">
            <ChatsCircle aria-hidden /> {t("Conversas")}
            {conversasNaoLidas ? <span className="ml-1 rounded-full bg-accent px-1.5 text-xs text-accent-foreground">{conversasNaoLidas}</span> : null}
          </Link>
        </Button>
        {tarefasAteHoje !== undefined ? (
          <Button asChild size="sm" variant="outline">
            <Link href="/app/tasks">
              <ListChecks aria-hidden /> {t("Tarefas")}
              {tarefasAteHoje ? <span className="ml-1 rounded-full bg-warning-bg px-1.5 text-xs text-warning-fg">{tarefasAteHoje}</span> : null}
            </Link>
          </Button>
        ) : null}
      </div>

      {busca.length >= 2 ? (
        <div className="mt-2 rounded-lg border" data-testid="inicio-busca-resultado">
          {resultado.isLoading ? (
            <p className="p-3 text-sm text-text-muted">{t("Buscando…")}</p>
          ) : achados.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span>{t("Nenhum paciente encontrado.")}</span>
              <Button size="sm" onClick={() => setCadastrando(true)} data-testid="inicio-busca-cadastrar">
                <UserPlus aria-hidden /> {t("Cadastrar")} “{busca}”
              </Button>
            </div>
          ) : (
            <ul className="max-h-64 divide-y overflow-y-auto">
              {achados.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 p-2 text-sm" data-testid="inicio-busca-item">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.name}</span>
                    {c.detalhe ? <span className="block truncate text-xs text-text-muted">{c.detalhe}</span> : null}
                  </span>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/app/contacts/${c.id}`}>{t("Ficha")}</Link>
                  </Button>
                  {podeMarcar ? (
                    <Button asChild size="sm">
                      <Link href={`/app/agenda?contato=${c.id}`} data-testid="inicio-busca-agendar">
                        {t("Agendar")}
                      </Link>
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <NewContactDialog
        key={cadastrando ? `aberto-${busca}` : "fechado"}
        open={cadastrando}
        onOpenChange={setCadastrando}
        nomeInicial={/\d/.test(busca) ? "" : busca}
        onCriado={(contato) => {
          setCadastrando(false);
          toast.success(t("Paciente cadastrado."), {
            action: podeMarcar ? { label: t("Agendar agora"), onClick: () => router.push(`/app/agenda?contato=${contato.id}`) } : undefined,
          });
        }}
      />
    </section>
  );
}
