"use client";

/**
 * FORK clinic (melhorias da Agenda) — a barra de filtros acima da grade:
 * especialidade, status (vários), período, paciente (nome, CPF ou nascimento)
 * e "somente horários livres", com chips do que está ativo e "Limpar filtros".
 * O estado mora na URL (`useFiltrosDaAgenda`) e vale na hora.
 * O filtro de pessoa continua sendo o dos avatares, do núcleo.
 */
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { CHAVES_DOS_FILTROS, algumFiltroAtivo, lerFiltros, type FiltrosDaAgenda } from "@/lib/clinic/agenda/filtros-da-agenda";
import { PERIODOS_DO_DIA, ROTULO_DE_EXIBICAO, ROTULO_DO_PERIODO, STATUS_DE_EXIBICAO, type PeriodoDoDia, type StatusDeExibicao } from "@/lib/clinic/visitas/exibicao";
import { CaretDown, MagnifyingGlass, X } from "@/lib/ui/icons";

/**
 * O estado dos filtros: nasce do que o SERVIDOR leu da URL (`inicial`) — ler
 * `window.location` no inicializador quebraria a hidratação — e cada mudança
 * vai para a URL por `history.replaceState`, que o App Router acompanha sem
 * pedir a página de novo ao servidor. As outras chaves da URL (`compromisso`,
 * `contato`) ficam como estavam.
 */
export function useFiltrosDaAgenda(inicial: string) {
  const [texto, setTexto] = React.useState(inicial);
  const filtros = React.useMemo(() => lerFiltros(new URLSearchParams(texto)), [texto]);
  const mudar = React.useCallback((mudancas: Record<string, string | null>) => {
    const url = new URLSearchParams(window.location.search);
    const meus = new URLSearchParams();
    for (const [k, v] of Object.entries(mudancas)) {
      if (v === null || v === "") url.delete(k);
      else url.set(k, v);
    }
    for (const k of CHAVES_DOS_FILTROS) {
      const v = url.get(k);
      if (v !== null) meus.set(k, v);
    }
    setTexto(meus.toString());
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${url.toString() ? `?${url}` : ""}`);
  }, []);
  const limpar = React.useCallback(() => mudar(Object.fromEntries(CHAVES_DOS_FILTROS.map((k) => [k, null]))), [mudar]);
  return { filtros, mudar, limpar };
}

export function BarraDeFiltrosDaAgenda({
  filtros,
  mudar,
  limpar,
  especialidades,
  total,
}: {
  filtros: FiltrosDaAgenda;
  mudar: (m: Record<string, string | null>) => void;
  limpar: () => void;
  especialidades: [string, string][];
  /** Quantos compromissos a grade mostra com os filtros (lido pelo leitor de tela). */
  total: number;
}) {
  const t = useT();
  const [busca, setBusca] = React.useState(filtros.q);
  const [qAnterior, setQAnterior] = React.useState(filtros.q);
  if (filtros.q !== qAnterior) {
    setQAnterior(filtros.q);
    setBusca(filtros.q);
  }
  React.useEffect(() => {
    if (busca.trim() === filtros.q) return;
    const id = setTimeout(() => mudar({ q: busca.trim() || null }), 300);
    return () => clearTimeout(id);
  }, [busca, filtros.q, mudar]);

  const campo = React.useRef<HTMLInputElement>(null);
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

  const alternarStatus = (s: StatusDeExibicao) => {
    const novo = filtros.status.includes(s) ? filtros.status.filter((x) => x !== s) : [...filtros.status, s];
    mudar({ status: novo.join(",") || "nenhum" });
  };
  const alternarPeriodo = (p: PeriodoDoDia) => {
    const novo = filtros.periodos.includes(p) ? filtros.periodos.filter((x) => x !== p) : [...filtros.periodos, p];
    mudar({ periodo: novo.join(",") || null });
  };

  const chips: { chave: string; rotulo: string; limpar: Record<string, null> }[] = [];
  if (filtros.especialidade)
    chips.push({ chave: "esp", rotulo: `${t("Especialidade")}: ${especialidades.find(([id]) => id === filtros.especialidade)?.[1] ?? "?"}`, limpar: { esp: null } });
  if (filtros.statusMudou) chips.push({ chave: "status", rotulo: `${t("Status")}: ${filtros.status.length}`, limpar: { status: null } });
  if (filtros.periodos.length) chips.push({ chave: "periodo", rotulo: filtros.periodos.map((p) => t(ROTULO_DO_PERIODO[p])).join(", "), limpar: { periodo: null } });
  if (filtros.q) chips.push({ chave: "q", rotulo: `${t("Paciente")}: ${filtros.q}`, limpar: { q: null } });
  if (filtros.soLivres) chips.push({ chave: "livres", rotulo: t("Somente horários livres"), limpar: { livres: null } });

  return (
    <div className="space-y-2 rounded-xl border bg-surface p-3" role="search" aria-label={t("Filtros da agenda")} data-testid="filtros-da-agenda">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-72 flex-1">
          <label className="sr-only block" htmlFor="filtro-paciente">
            {t("Buscar paciente")}
          </label>
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            id="filtro-paciente"
            ref={campo}
            data-testid="filtro-paciente"
            type="search"
            className="pl-8"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={t("Paciente, CPF ou nascimento")}
            autoComplete="off"
          />
        </div>

        {especialidades.length > 0 ? (
          <>
            <label className="sr-only block" htmlFor="filtro-especialidade">
              {t("Especialidade")}
            </label>
            <select
              id="filtro-especialidade"
              data-testid="filtro-especialidade"
              className="h-9 rounded-md border bg-transparent px-2 text-sm"
              value={filtros.especialidade}
              onChange={(e) => mudar({ esp: e.target.value || null })}
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
            <Button variant="outline" size="sm" data-testid="filtro-status">
              {t("Status")}
              {filtros.statusMudou ? <Badge className="ml-1">{filtros.status.length}</Badge> : null}
              <CaretDown aria-hidden className="ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <fieldset>
              <legend className="mb-2 text-xs font-medium">{t("Mostrar os status")}</legend>
              <div className="space-y-1">
                {STATUS_DE_EXIBICAO.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" data-testid={`filtro-status-${s}`} checked={filtros.status.includes(s)} onChange={() => alternarStatus(s)} />
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
              variant={filtros.periodos.includes(p) ? "default" : "outline"}
              aria-pressed={filtros.periodos.includes(p)}
              data-testid={`filtro-periodo-${p}`}
              onClick={() => alternarPeriodo(p)}
            >
              {t(ROTULO_DO_PERIODO[p])}
            </Button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" data-testid="filtro-livres" checked={filtros.soLivres} onChange={(e) => mudar({ livres: e.target.checked ? "1" : null })} />
          {t("Somente horários livres")}
        </label>
      </div>

      {algumFiltroAtivo(filtros) ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="filtros-ativos">
          <span className="text-xs text-text-muted">{t("Filtros ativos")}:</span>
          {chips.map((c) => (
            <span key={c.chave} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
              {c.rotulo}
              <button type="button" aria-label={`${t("Remover filtro")} ${c.rotulo}`} className="rounded-full p-0.5 hover:bg-muted" onClick={() => mudar(c.limpar)}>
                <X aria-hidden size={12} />
              </button>
            </span>
          ))}
          <Button size="sm" variant="ghost" data-testid="filtros-limpar" onClick={limpar}>
            {t("Limpar filtros")}
          </Button>
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {`${total} ${t("compromissos com os filtros")}`}
      </p>
    </div>
  );
}
