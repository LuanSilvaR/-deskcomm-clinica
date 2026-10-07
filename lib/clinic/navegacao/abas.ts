/**
 * FORK clinic (organização do menu, 2026-10) — as abas do módulo no topo da
 * tela: as outras telas do MESMO módulo, a um toque, sem voltar ao menu.
 *
 * Pura: recebe o que `modulosVisiveis()` já filtrou (mesma decisão de acesso do
 * menu) — por construção não mostra aba de tela que a pessoa não pode abrir.
 */
import { hrefDoPainel, moduloDoCaminho, type ModuloClinica } from "./modulos";
import type { ModuloVisivel } from "./projecao";

export interface AbaDoModulo {
  href: string;
  label: string;
  ativa: boolean;
}

export interface AbasDoModulo {
  modulo: ModuloClinica;
  abas: AbaDoModulo[];
  /** O painel com todas as telas do módulo, descritas por seção. */
  painel: { href: string; ativo: boolean };
}

/** A tela do módulo que melhor casa com o caminho (a mais específica). */
function hrefAtivo(pathname: string, hrefs: readonly string[]): string | null {
  let melhor: string | null = null;
  for (const h of hrefs) {
    if (pathname !== h && !pathname.startsWith(h + "/")) continue;
    if (!melhor || h.length > melhor.length) melhor = h;
  }
  return melhor;
}

/**
 * As abas da tela aberta, ou `null` quando não há o que mostrar: fora de um
 * módulo, no Início, ou num módulo com uma tela só para esta pessoa.
 */
export function abasDoModulo(pathname: string, visiveis: readonly ModuloVisivel[]): AbasDoModulo | null {
  const modulo = moduloDoCaminho(pathname);
  if (!modulo || modulo.id === "inicio") return null;
  const visivel = visiveis.find((m) => m.modulo.id === modulo.id);
  if (!visivel || visivel.itens.length < 2) return null;
  const ativo = hrefAtivo(pathname, visivel.itens.map((i) => i.href as string));
  const painel = hrefDoPainel(modulo);
  return {
    modulo,
    abas: visivel.itens.map((i) => ({ href: i.href as string, label: i.label, ativa: i.href === ativo })),
    painel: { href: painel, ativo: pathname === painel },
  };
}
