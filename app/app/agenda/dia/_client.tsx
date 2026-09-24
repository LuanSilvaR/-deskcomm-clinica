"use client";

/**
 * Agenda do dia (fork clinic) — a lista da recepção:
 *   - barra de filtros fixa no topo, com o estado na URL (dá para compartilhar
 *     o link e voltar com o navegador): dia ‹ hoje ›, profissional,
 *     especialidade, status (vários), período, paciente (nome, CPF ou
 *     nascimento) e "somente horários livres"; chips do que está ativo;
 *   - um bloco por profissional: nome, especialidades, conselho, ocupação e
 *     estado do dia; as linhas em ordem de horário, com o selo do status;
 *   - tempo real: visita, agenda e confirmação mudam e a lista acompanha.
 * As ações aparecem só para quem tem a permissão (can); a rota decide de novo.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { BarraDeOcupacao } from "@/components/clinic/agenda/BarraDeOcupacao";
import { SeloDeStatus } from "@/components/clinic/agenda/SeloDeStatus";
import { SeloDaConfirmacao } from "@/components/clinic/SeloDaConfirmacao";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePessoasDaAgenda } from "@/hooks/agenda/usePessoasDaAgenda";
import { useT } from "@/hooks/i18n/useT";
import { useRealtimeChannel } from "@/hooks/realtime/useRealtimeChannel";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";
import type { BlocoDoProfissional, EstadoDoDia, LinhaDoDia } from "@/lib/clinic/agenda/agenda-do-dia";
import { horaDoMinuto } from "@/lib/clinic/agenda/dia-por-profissional";
import { usePermissoes } from "@/lib/clinic/acesso/use-permissoes";
import {
  PERIODOS_DO_DIA,
  ROTULO_DE_EXIBICAO,
  ROTULO_DO_PERIODO,
  STATUS_DE_EXIBICAO,
  STATUS_PADRAO_DO_FILTRO,
  ehStatusDeExibicao,
  periodoDoMinuto,
  type PeriodoDoDia,
  type StatusDeExibicao,
} from "@/lib/clinic/visitas/exibicao";
import { ACAO_PARA_AVANCAR, ROTULO_DO_STATUS, ehStatusDaVisita } from "@/lib/clinic/visitas/status";
import { ArrowSquareOut, CaretDown, CaretLeft, CaretRight, IdentificationCard, MagnifyingGlass, Plus, X } from "@/lib/ui/icons";

interface Resposta {
  ligado: boolean;
  dia: string | null;
  hoje: string;
  fuso: string;
  blocos: BlocoDoProfissional[];
  pacientes_da_busca: string[] | null;
}

const ROTULO_DO_ESTADO: Record<EstadoDoDia, string> = {
  disponivel: "Disponível",
  lotado: "Lotado",
  bloqueado: "Bloqueado",
  fora_da_jornada: "Fora da jornada",
};
const VARIANTE_DO_ESTADO: Record<EstadoDoDia, "success" | "warning" | "neutral" | "info"> = {
  disponivel: "success",
  lotado: "warning",
  bloqueado: "neutral",
  fora_da_jornada: "info",
};

function somarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

function lista(v: string | null): string[] {
  return (v ?? "").split(",").filter(Boolean);
}

function minutosDesde(iso: string | null, agora: number): number | null {
  if (!iso) return null;
  const m = Math.floor((agora - Date.parse(iso)) / 60_000);
  return Number.isFinite(m) && m >= 0 ? m : null;
}

/** "12 min", "1 h 05" — a espera na recepção, legível de relance. */
function duracao(min: number): string {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

export function AgendaDoDia({ orgId }: { orgId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const router = useRouter();
  const caminho = usePathname();
  const paramsDaUrl = useSearchParams();
  // O filtro vale NA HORA (otimista) e a URL acompanha: sem isso o checkbox só
  // marca depois da navegação, e o clique parece não ter pegado.
  const [pendente, setPendente] = useState<string | null>(null);
  const [urlAnterior, setUrlAnterior] = useState(paramsDaUrl.toString());
  if (paramsDaUrl.toString() !== urlAnterior) {
    setUrlAnterior(paramsDaUrl.toString());
    setPendente(null);
  }
  const params = useMemo(() => new URLSearchParams(pendente ?? paramsDaUrl.toString()), [pendente, paramsDaUrl]);
  const { can } = usePermissoes();
  const { data: pessoas = [] } = usePessoasDaAgenda();

  // ── filtros (URL) ──────────────────────────────────────────────────────
  const diaDaUrl = params.get("dia");
  const filtroProf = params.get("prof") ?? "";
  const filtroEsp = params.get("esp") ?? "";
  const statusDaUrl = lista(params.get("status")).filter(ehStatusDeExibicao);
  const filtroStatus: readonly StatusDeExibicao[] = params.has("status") ? statusDaUrl : STATUS_PADRAO_DO_FILTRO;
  const filtroPeriodo = lista(params.get("periodo")).filter((p): p is PeriodoDoDia => (PERIODOS_DO_DIA as readonly string[]).includes(p));
  const q = params.get("q") ?? "";
  const soLivres = params.get("livres") === "1";

  const mudarFiltro = useCallback(
    (mudancas: Record<string, string | null>) => {
      const n = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(mudancas)) {
        if (v === null || v === "") n.delete(k);
        else n.set(k, v);
      }
      setPendente(n.toString());
      router.replace(`${caminho}${n.toString() ? `?${n}` : ""}`, { scroll: false });
    },
    [params, router, caminho],
  );

  const [buscaDigitada, setBuscaDigitada] = useState(q);
  // O chip "✕" ou "Limpar filtros" mudam a URL: o campo acompanha (ajuste no render, não em efeito).
  const [qAnterior, setQAnterior] = useState(q);
  if (q !== qAnterior) {
    setQAnterior(q);
    setBuscaDigitada(q);
  }
  useEffect(() => {
    if (buscaDigitada.trim() === q) return;
    const id = setTimeout(() => mudarFiltro({ q: buscaDigitada.trim() || null }), 300);
    return () => clearTimeout(id);
  }, [buscaDigitada, q, mudarFiltro]);
  const campoDeBusca = useRef<HTMLInputElement>(null);
  // "/" leva à busca de paciente (fora de campos de texto), como nas listas do produto.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (alvo && (alvo.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName))) return;
      e.preventDefault();
      campoDeBusca.current?.focus();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  // ── dados + tempo real ─────────────────────────────────────────────────
  const CHAVE = ["clinic", "agenda-do-dia", diaDaUrl ?? "hoje", q];
  const consulta = useQuery({
    queryKey: CHAVE,
    queryFn: async () => {
      const u = new URLSearchParams();
      if (diaDaUrl) u.set("dia", diaDaUrl);
      if (q) u.set("q", q);
      return (await apiClient.get<{ data: Resposta }>(`/api/v1/clinic/agenda-do-dia${u.toString() ? `?${u}` : ""}`)).data;
    },
    refetchInterval: 120_000,
    placeholderData: (anterior) => anterior,
  });
  const recarregar = useCallback(() => void qc.invalidateQueries({ queryKey: ["clinic", "agenda-do-dia"] }), [qc]);
  const { status: tempoReal } = useRealtimeChannel({
    name: `agenda-do-dia-visitas-${orgId}`,
    postgresChanges: { event: "*", schema: "public", table: "clinic_appointment_visits", filter: `organization_id=eq.${orgId}` },
    onChange: recarregar,
  });
  useRealtimeChannel({
    name: `agenda-do-dia-agenda-${orgId}`,
    postgresChanges: { event: "*", schema: "public", table: "calendar_appointments", filter: `organization_id=eq.${orgId}` },
    onChange: recarregar,
  });
  useRealtimeChannel({
    name: `agenda-do-dia-confirmacao-${orgId}`,
    postgresChanges: { event: "*", schema: "public", table: "clinic_confirmation_requests", filter: `organization_id=eq.${orgId}` },
    onChange: recarregar,
  });

  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

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

  const r = consulta.data;
  const dia = r?.dia ?? diaDaUrl ?? "";
  const hoje = r?.hoje ?? "";
  const nomeDe = useCallback(
    (b: BlocoDoProfissional) => b.ficha?.nome ?? pessoas.find((p) => p.id === b.profissional_id)?.nome ?? t("Profissional"),
    [pessoas, t],
  );

  // ── o que a tela mostra, com os filtros ────────────────────────────────
  const especialidades = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of r?.blocos ?? []) for (const e of b.ficha?.especialidades ?? []) m.set(e.id, e.nome);
    return [...m].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [r?.blocos]);

  const statusSet = new Set(filtroStatus);
  const buscaIds = r?.pacientes_da_busca ? new Set(r.pacientes_da_busca) : null;
  const passaLinha = (l: LinhaDoDia): boolean => {
    if (filtroPeriodo.length && !filtroPeriodo.includes(periodoDoMinuto(l.inicio_minuto))) return false;
    if (l.tipo === "livre") return !buscaIds && (soLivres ? !l.passou : true);
    if (soLivres) return false;
    if (buscaIds && !(l.paciente_id && buscaIds.has(l.paciente_id))) return false;
    return statusSet.has(l.status);
  };
  const blocos = (r?.blocos ?? [])
    .filter((b) => !filtroProf || b.profissional_id === filtroProf)
    .filter((b) => !filtroEsp || (b.ficha?.especialidades ?? []).some((e) => e.id === filtroEsp))
    .map((b) => ({ ...b, visiveis: b.linhas.filter(passaLinha) }))
    .filter((b) => !(soLivres || buscaIds) || b.visiveis.length > 0)
    .sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), "pt-BR"));

  const statusMudou = params.has("status") && [...filtroStatus].sort().join() !== [...STATUS_PADRAO_DO_FILTRO].sort().join();
  const chips: { chave: string; rotulo: string; limpar: Record<string, null> }[] = [];
  if (filtroProf) chips.push({ chave: "prof", rotulo: `${t("Profissional")}: ${nomeDe({ profissional_id: filtroProf, ficha: null } as BlocoDoProfissional)}`, limpar: { prof: null } });
  if (filtroEsp) chips.push({ chave: "esp", rotulo: `${t("Especialidade")}: ${especialidades.find(([id]) => id === filtroEsp)?.[1] ?? "?"}`, limpar: { esp: null } });
  if (statusMudou) chips.push({ chave: "status", rotulo: `${t("Status")}: ${filtroStatus.length}`, limpar: { status: null } });
  if (filtroPeriodo.length) chips.push({ chave: "periodo", rotulo: filtroPeriodo.map((p) => t(ROTULO_DO_PERIODO[p])).join(", "), limpar: { periodo: null } });
  if (q) chips.push({ chave: "q", rotulo: `${t("Paciente")}: ${q}`, limpar: { q: null } });
  if (soLivres) chips.push({ chave: "livres", rotulo: t("Somente horários livres"), limpar: { livres: null } });
  const totalVisivel = blocos.reduce((n, b) => n + b.visiveis.length, 0);

  const alternarStatus = (s: StatusDeExibicao) => {
    const novo = statusSet.has(s) ? filtroStatus.filter((x) => x !== s) : [...filtroStatus, s];
    mudarFiltro({ status: novo.join(",") || "nenhum" });
  };
  const alternarPeriodo = (p: PeriodoDoDia) => {
    const novo = filtroPeriodo.includes(p) ? filtroPeriodo.filter((x) => x !== p) : [...filtroPeriodo, p];
    mudarFiltro({ periodo: novo.join(",") || null });
  };

  return (
    <div className="flex flex-col gap-3" data-testid="agenda-do-dia" data-realtime-status={tempoReal}>
      {/* ── barra de filtros (fixa) ─────────────────────────────────────── */}
      <div className="sticky top-0 z-10 -mx-6 space-y-2 border-b bg-background px-6 pb-3 pt-1" role="search" aria-label={t("Filtros da agenda")}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1" role="group" aria-label={t("Dia")}>
            <Button size="icon" variant="outline" aria-label={t("Dia anterior")} disabled={!dia} onClick={() => mudarFiltro({ dia: somarDias(dia, -1) })}>
              <CaretLeft aria-hidden />
            </Button>
            <Button variant={dia === hoje ? "default" : "outline"} data-testid="agenda-dia-hoje" onClick={() => mudarFiltro({ dia: null })}>
              {t("Hoje")}
            </Button>
            <Button size="icon" variant="outline" aria-label={t("Próximo dia")} disabled={!dia} onClick={() => mudarFiltro({ dia: somarDias(dia, 1) })}>
              <CaretRight aria-hidden />
            </Button>
            <label className="sr-only" htmlFor="agenda-dia">
              {t("Escolher dia")}
            </label>
            <Input
              id="agenda-dia"
              data-testid="agenda-dia"
              type="date"
              className="w-40"
              value={dia}
              onChange={(e) => e.target.value && mudarFiltro({ dia: e.target.value === hoje ? null : e.target.value })}
            />
          </div>

          <label className="sr-only" htmlFor="filtro-profissional">
            {t("Profissional")}
          </label>
          <select
            id="filtro-profissional"
            data-testid="filtro-profissional"
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
            value={filtroProf}
            onChange={(e) => mudarFiltro({ prof: e.target.value || null })}
          >
            <option value="">{t("Todos os profissionais")}</option>
            {(r?.blocos ?? []).map((b) => (
              <option key={b.profissional_id} value={b.profissional_id}>
                {nomeDe(b)}
              </option>
            ))}
          </select>

          {especialidades.length > 0 ? (
            <>
              <label className="sr-only" htmlFor="filtro-especialidade">
                {t("Especialidade")}
              </label>
              <select
                id="filtro-especialidade"
                data-testid="filtro-especialidade"
                className="h-9 rounded-md border bg-transparent px-2 text-sm"
                value={filtroEsp}
                onChange={(e) => mudarFiltro({ esp: e.target.value || null })}
              >
                <option value="">{t("Todas as especialidades")}</option>
                {especialidades.map(([id, nome]) => (
                  <option key={id} value={id}>
                    {nome}
                  </option>
                ))}
              </select>
            </>
          ) : null}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" data-testid="filtro-status">
                {t("Status")}
                {statusMudou ? <Badge className="ml-1">{filtroStatus.length}</Badge> : null}
                <CaretDown aria-hidden className="ml-1" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <fieldset>
                <legend className="mb-2 text-xs font-medium">{t("Mostrar os status")}</legend>
                <div className="space-y-1">
                  {STATUS_DE_EXIBICAO.map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" data-testid={`filtro-status-${s}`} checked={statusSet.has(s)} onChange={() => alternarStatus(s)} />
                      {t(ROTULO_DE_EXIBICAO[s])}
                    </label>
                  ))}
                </div>
              </fieldset>
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-1" role="group" aria-label={t("Período do dia")}>
            {PERIODOS_DO_DIA.map((p) => (
              <Button
                key={p}
                size="sm"
                variant={filtroPeriodo.includes(p) ? "default" : "outline"}
                aria-pressed={filtroPeriodo.includes(p)}
                data-testid={`filtro-periodo-${p}`}
                onClick={() => alternarPeriodo(p)}
              >
                {t(ROTULO_DO_PERIODO[p])}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-64 flex-1">
            <label className="sr-only" htmlFor="filtro-paciente">
              {t("Buscar paciente")}
            </label>
            <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              id="filtro-paciente"
              ref={campoDeBusca}
              data-testid="filtro-paciente"
              type="search"
              className="pl-8"
              value={buscaDigitada}
              onChange={(e) => setBuscaDigitada(e.target.value)}
              placeholder={t("Paciente: nome, CPF ou nascimento (dd/mm/aaaa)")}
              autoComplete="off"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" data-testid="filtro-livres" checked={soLivres} onChange={(e) => mudarFiltro({ livres: e.target.checked ? "1" : null })} />
            {t("Somente horários livres")}
          </label>
        </div>

        {chips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2" data-testid="filtros-ativos">
            <span className="text-xs text-text-muted">{t("Filtros ativos")}:</span>
            {chips.map((c) => (
              <span key={c.chave} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                {c.rotulo}
                <button type="button" aria-label={`${t("Remover filtro")} ${c.rotulo}`} className="rounded-full p-0.5 hover:bg-muted" onClick={() => mudarFiltro(c.limpar)}>
                  <X aria-hidden size={12} />
                </button>
              </span>
            ))}
            <Button
              size="sm"
              variant="ghost"
              data-testid="filtros-limpar"
              onClick={() => mudarFiltro({ prof: null, esp: null, status: null, periodo: null, q: null, livres: null })}
            >
              {t("Limpar filtros")}
            </Button>
          </div>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        {consulta.isFetching ? t("Atualizando…") : `${totalVisivel} ${t("horários na lista")}`}
      </p>

      {/* ── os blocos ──────────────────────────────────────────────────── */}
      {consulta.isLoading ? (
        <div className="space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : consulta.isError ? (
        <p className="text-sm text-destructive">{t("Não foi possível carregar a agenda do dia.")}</p>
      ) : (r?.blocos ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-sm" data-testid="agenda-do-dia-vazia">
          {t("Nenhum profissional com agenda aberta nesta data.")}
        </div>
      ) : blocos.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-sm" data-testid="agenda-do-dia-sem-resultado">
          <p>{t("Nada com esses filtros.")}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => mudarFiltro({ prof: null, esp: null, status: null, periodo: null, q: null, livres: null })}>
            {t("Limpar filtros")}
          </Button>
        </div>
      ) : (
        <div className={`space-y-3 ${consulta.isFetching ? "opacity-70" : ""}`}>
          {blocos.map((b) => (
            <section key={b.profissional_id} className="rounded-xl border" data-testid="bloco-profissional" data-profissional={b.profissional_id} data-estado={b.estado}>
              <details open>
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-3">
                  <span className="font-medium">{nomeDe(b)}</span>
                  {b.ficha?.especialidades.length ? (
                    <span className="text-sm text-text-muted" title={b.ficha.especialidades.map((e) => e.nome).join(", ")}>
                      {b.ficha.especialidades
                        .slice(0, 3)
                        .map((e) => e.nome)
                        .join(", ")}
                      {b.ficha.especialidades.length > 3 ? ` +${b.ficha.especialidades.length - 3}` : ""}
                    </span>
                  ) : null}
                  {b.ficha?.conselho ? <span className="text-xs text-text-muted">{b.ficha.conselho}</span> : null}
                  <span className="ml-auto flex flex-wrap items-center gap-3">
                    <Badge variant={VARIANTE_DO_ESTADO[b.estado]} data-testid="estado-do-dia">
                      {t(ROTULO_DO_ESTADO[b.estado])}
                      {b.estado === "disponivel" ? ` · ${b.ocupacao.livres} ${b.ocupacao.livres === 1 ? t("livre") : t("livres")}` : ""}
                    </Badge>
                    <BarraDeOcupacao ocupados={b.ocupacao.minutos_ocupados} abertos={b.ocupacao.minutos_abertos} consultas={b.ocupacao.consultas} />
                  </span>
                </summary>
                {b.visiveis.length === 0 ? (
                  <p className="border-t px-3 py-2 text-sm text-text-muted">{t("Nenhum horário com esses filtros.")}</p>
                ) : (
                  <ul className="divide-y border-t" aria-label={`${t("Horários de")} ${nomeDe(b)}`}>
                    {b.visiveis.map((l) =>
                      l.tipo === "livre" ? (
                        <li
                          key={`livre-${l.inicio_minuto}`}
                          className={`flex items-center gap-3 px-3 py-2 text-sm ${l.passou ? "opacity-50" : ""}`}
                          data-testid="linha-livre"
                          data-inicio={horaDoMinuto(l.inicio_minuto)}
                        >
                          <span className="w-12 font-mono tabular-nums">{horaDoMinuto(l.inicio_minuto)}</span>
                          <span className="flex-1 text-text-muted">— {t("Livre")} —</span>
                          {!l.passou && can("agenda.marcar") ? (
                            <Button asChild size="sm" variant="outline">
                              <Link href="/app/agenda" data-testid="linha-livre-marcar">
                                <Plus aria-hidden /> {t("Marcar")}
                              </Link>
                            </Button>
                          ) : null}
                        </li>
                      ) : (
                        <LinhaDoCompromisso
                          key={l.id}
                          linha={l}
                          agora={agora}
                          ehHoje={dia === hoje}
                          podeAvancar={can("recepcao.mudar_status_visita")}
                          podeVerFicha={can("pacientes.ver_ficha")}
                          ocupado={avancar.isPending}
                          onAvancar={(status) => avancar.mutate({ id: l.id, status, paciente: l.paciente ?? t("Paciente") })}
                        />
                      ),
                    )}
                  </ul>
                )}
              </details>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function LinhaDoCompromisso({
  linha: l,
  agora,
  ehHoje,
  podeAvancar,
  podeVerFicha,
  ocupado,
  onAvancar,
}: {
  linha: Extract<LinhaDoDia, { tipo: "compromisso" }>;
  agora: number;
  /** A espera ("há 12 min") só faz sentido no dia de hoje. */
  ehHoje: boolean;
  podeAvancar: boolean;
  podeVerFicha: boolean;
  ocupado: boolean;
  onAvancar: (status: string) => void;
}) {
  const t = useT();
  const proximo = ehStatusDaVisita(l.status) ? ACAO_PARA_AVANCAR[l.status] : null;
  const min = ehHoje && (l.status === "na_recepcao" || l.status === "pronto") ? minutosDesde(l.desde, agora) : null;
  const paciente = l.paciente ?? t("Sem paciente");
  return (
    <li
      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
      data-testid="linha-compromisso"
      data-id={l.id}
      data-status={l.status}
      aria-label={`${horaDoMinuto(l.inicio_minuto)}, ${paciente}, ${t(ROTULO_DE_EXIBICAO[l.status])}`}
    >
      <span className="w-12 font-mono tabular-nums">{horaDoMinuto(l.inicio_minuto)}</span>
      <span className="min-w-0 flex-1">
        <span className={`font-medium ${l.status === "cancelado" ? "text-text-muted line-through" : ""}`}>{paciente}</span>
        <span className="ml-2 text-xs text-text-muted">{l.titulo}</span>
      </span>
      <span className="flex flex-wrap items-center gap-1">
        <SeloDeStatus status={l.status} complemento={min !== null ? duracao(min) : null} />
        <SeloDaConfirmacao status={l.confirmacao} />
        {l.faltas > 0 ? (
          <span className="rounded-full bg-error-bg px-2 py-0.5 text-xs text-error-fg" data-testid="selo-faltas">
            {t("faltou")} {l.faltas}×
          </span>
        ) : null}
      </span>
      <span className="flex items-center gap-1">
        {podeAvancar && proximo ? (
          <Button size="sm" data-testid="linha-avancar" disabled={ocupado} onClick={() => onAvancar(proximo.para)}>
            {t(proximo.rotulo)}
          </Button>
        ) : null}
        <Button asChild size="icon" variant="ghost" aria-label={`${t("Abrir compromisso (remarcar ou cancelar)")}: ${paciente}`}>
          <Link href={`/app/agenda?compromisso=${l.id}`} data-testid="linha-abrir">
            <ArrowSquareOut aria-hidden />
          </Link>
        </Button>
        {podeVerFicha && l.paciente_id ? (
          <Button asChild size="icon" variant="ghost" aria-label={`${t("Ficha do paciente")}: ${paciente}`}>
            <Link href={`/app/contacts/${l.paciente_id}`} data-testid="linha-ficha">
              <IdentificationCard aria-hidden />
            </Link>
          </Button>
        ) : null}
      </span>
    </li>
  );
}
