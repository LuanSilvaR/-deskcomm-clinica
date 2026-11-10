"use client";

/**
 * FORK clinic (agenda por profissional, S1) — o CONTEXTO da Agenda.
 *
 * Não é filtro: é "de quem é esta agenda". Fica no topo, mostra quem está
 * aberto (iniciais, nome, especialidade) e troca por busca — parte do nome
 * basta, sem acento e sem caixa. Teclado: setas andam, Enter abre, Esc fecha.
 * A lista é a que a API liberou (`agenda.ver_outros`); sem a permissão ela tem
 * só a própria pessoa, e o botão de trocar nem aparece.
 * S7 (#70): ★ favoritos (primeiro na lista) e ‹ › para o anterior/seguinte.
 */
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/hooks/i18n/useT";
import { buscarProfissionais, iniciais, type ProfissionalDaAgenda } from "@/lib/clinic/agenda/contexto-da-agenda";
import { CaretDown, CaretLeft, CaretRight, MagnifyingGlass } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

function Iniciais({ nome, grande = false }: { nome: string; grande?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent",
        grande ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs",
      )}
    >
      {iniciais(nome)}
    </span>
  );
}

export function CabecalhoDoProfissional({
  profissional,
  lista,
  recentes,
  podeTrocar,
  carregando,
  onTrocar,
  favoritos = [],
  onFavoritar,
  onAnterior,
  onSeguinte,
}: {
  profissional: ProfissionalDaAgenda | null;
  lista: readonly ProfissionalDaAgenda[];
  recentes: readonly ProfissionalDaAgenda[];
  podeTrocar: boolean;
  carregando: boolean;
  onTrocar: (id: string) => void;
  /** S7 (#70): ids favoritos deste usuário, na ordem marcada. */
  favoritos?: readonly string[];
  onFavoritar?: (id: string) => void;
  onAnterior?: () => void;
  onSeguinte?: () => void;
}) {
  const t = useT();
  const [aberto, setAberto] = React.useState(false);

  if (carregando && !profissional) {
    return (
      <div data-testid="contexto-carregando" className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
    );
  }
  if (!profissional) {
    return (
      <div data-testid="contexto-sem-profissional" role="status" className="rounded-lg border border-dashed border-border bg-surface p-3 text-sm text-text-muted">
        {t("Nenhum profissional com agenda para mostrar. Cadastre profissionais em Configurações › Profissionais.")}
      </div>
    );
  }

  const cartao = (
    <div className="flex min-w-0 items-center gap-3">
      <Iniciais nome={profissional.nome} grande />
      <div className="min-w-0 text-left">
        <p data-testid="contexto-nome" className="truncate text-base font-semibold leading-5">
          {profissional.nome}
          {profissional.eu ? <span className="ml-2 text-xs font-normal text-text-muted">({t("você")})</span> : null}
        </p>
        <p className="truncate text-xs text-text-muted">
          {profissional.especialidades.length > 0 ? profissional.especialidades.join(" · ") : t("Sem especialidade cadastrada")}
        </p>
      </div>
    </div>
  );

  return (
    <div
      data-testid="contexto-da-agenda"
      data-profissional={profissional.user_id}
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3"
    >
      {cartao}
      {podeTrocar && lista.length > 1 ? (
        <div className="flex items-center gap-1">
        {onAnterior ? (
          <Button variant="ghost" size="sm" data-testid="profissional-anterior" aria-label={t("Profissional anterior")} title={t("Profissional anterior") + " ([)"} onClick={onAnterior}>
            <CaretLeft size={14} aria-hidden />
          </Button>
        ) : null}
        <Popover open={aberto} onOpenChange={setAberto}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" data-testid="trocar-profissional" aria-haspopup="listbox" aria-expanded={aberto}>
              {t("Trocar profissional")}
              <CaretDown size={14} weight="bold" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(92vw,360px)] p-0">
            <ListaDeProfissionais
              lista={lista}
              recentes={recentes}
              atual={profissional.user_id}
              favoritos={favoritos}
              onFavoritar={onFavoritar}
              onEscolher={(id) => {
                onTrocar(id);
                setAberto(false);
              }}
            />
          </PopoverContent>
        </Popover>
        {onSeguinte ? (
          <Button variant="ghost" size="sm" data-testid="profissional-seguinte" aria-label={t("Próximo profissional")} title={t("Próximo profissional") + " (])"} onClick={onSeguinte}>
            <CaretRight size={14} aria-hidden />
          </Button>
        ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ListaDeProfissionais({
  lista,
  recentes,
  atual,
  onEscolher,
  favoritos = [],
  onFavoritar,
}: {
  lista: readonly ProfissionalDaAgenda[];
  recentes: readonly ProfissionalDaAgenda[];
  atual: string | null;
  onEscolher: (id: string) => void;
  favoritos?: readonly string[];
  onFavoritar?: (id: string) => void;
}) {
  const t = useT();
  const [busca, setBusca] = React.useState("");
  const [ativo, setAtivo] = React.useState(0);
  const idDaLista = React.useId();

  const encontrados = React.useMemo(() => buscarProfissionais(lista, busca), [lista, busca]);
  // Sem busca: recentes primeiro (sem repetir) e depois todos. Com busca: só o que bate.
  const secoes = React.useMemo(() => {
    if (busca.trim()) return [{ titulo: null as string | null, itens: encontrados }];
    // S7 (#70): favoritos primeiro; depois recentes e o resto, sem repetir.
    const fav = favoritos.map((id) => lista.find((p) => p.user_id === id)).filter((p): p is ProfissionalDaAgenda => Boolean(p));
    const idsFav = new Set(fav.map((p) => p.user_id));
    const rec = recentes.filter((r) => !idsFav.has(r.user_id));
    const ids = new Set([...idsFav, ...rec.map((r) => r.user_id)]);
    const comRecentes = rec.length > 0 && lista.length > 5;
    const resto = lista.filter((p) => !idsFav.has(p.user_id) && (!comRecentes || !ids.has(p.user_id)));
    return [
      ...(fav.length ? [{ titulo: t("Favoritos"), itens: fav }] : []),
      ...(comRecentes ? [{ titulo: t("Recentes"), itens: rec }] : []),
      { titulo: fav.length || comRecentes ? t("Todos os profissionais") : null, itens: resto },
    ];
  }, [busca, encontrados, recentes, lista, favoritos, t]);
  const ordem = secoes.flatMap((s) => s.itens);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a busca mudou: o destaque volta ao primeiro
    setAtivo(0);
  }, [busca]);

  const aoTeclar = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((i) => Math.min(i + 1, ordem.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const alvo = ordem[ativo];
      if (alvo) onEscolher(alvo.user_id);
    }
  };

  let indice = -1;
  return (
    <div data-testid="lista-de-profissionais">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <MagnifyingGlass size={16} aria-hidden className="text-text-muted" />
        <input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={idDaLista}
          aria-activedescendant={ordem[ativo] ? `${idDaLista}-${ordem[ativo].user_id}` : undefined}
          aria-label={t("Buscar profissional")}
          data-testid="buscar-profissional"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={aoTeclar}
          placeholder={t("Buscar profissional…")}
          className="w-full bg-transparent py-1 text-sm outline-hidden"
        />
      </div>
      <ul id={idDaLista} role="listbox" aria-label={t("Profissionais")} className="max-h-80 overflow-y-auto py-1">
        {ordem.length === 0 ? (
          <li className="px-3 py-4 text-center text-sm text-text-muted">{t("Nenhum profissional com esse nome.")}</li>
        ) : null}
        {secoes.map((secao, si) => (
          <React.Fragment key={secao.titulo ?? `secao-${si}`}>
            {secao.titulo && secao.itens.length > 0 ? (
              <li role="presentation" className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                {secao.titulo}
              </li>
            ) : null}
            {secao.itens.map((p) => {
              indice++;
              const i = indice;
              return (
                <li
                  key={`${secao.titulo ?? ""}-${p.user_id}`}
                  id={`${idDaLista}-${p.user_id}`}
                  role="option"
                  aria-selected={p.user_id === atual}
                  data-testid={`opcao-profissional-${p.user_id}`}
                  onMouseEnter={() => setAtivo(i)}
                  onClick={() => onEscolher(p.user_id)}
                  className={cn(
                    "mx-1 flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5",
                    i === ativo && "bg-surface-elevated",
                    !p.ativo && "opacity-60",
                  )}
                >
                  <Iniciais nome={p.nome} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {p.nome}
                      {p.eu ? <span className="ml-1 text-xs text-text-muted">({t("você")})</span> : null}
                    </p>
                    <p className="truncate text-xs text-text-muted">{p.especialidades.join(" · ") || "—"}</p>
                  </div>
                  {!p.ativo ? (
                    <span className="rounded-full border border-border px-1.5 text-[10px] text-text-muted">{t("Inativo")}</span>
                  ) : null}
                  {p.user_id === atual ? <span className="text-xs font-semibold text-accent">{t("Aberta")}</span> : null}
                  {onFavoritar ? (
                    <button
                      type="button"
                      data-testid={`favoritar-${p.user_id}`}
                      aria-pressed={favoritos.includes(p.user_id)}
                      aria-label={favoritos.includes(p.user_id) ? t("Tirar dos favoritos") : t("Marcar como favorito")}
                      className="rounded p-1 hover:bg-muted"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFavoritar(p.user_id);
                      }}
                    >
                      <span aria-hidden className={favoritos.includes(p.user_id) ? "text-warning" : "text-text-muted"}>
                        {favoritos.includes(p.user_id) ? "★" : "☆"}
                      </span>
                    </button>
                  ) : null}
                </li>
              );
            })}
          </React.Fragment>
        ))}
      </ul>
    </div>
  );
}
