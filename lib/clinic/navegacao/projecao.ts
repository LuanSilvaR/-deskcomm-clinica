/**
 * FORK clinic (9014) — o que cada pessoa vê no menu da clínica.
 *
 * Função pura sobre `searchable()` (`lib/navigation/registry.ts`), que é a
 * mesma decisão de acesso do menu de sempre (`destinosDaInterface`: interface
 * da organização, `minRole`, `permissao`, módulo opcional). Esta função só
 * AGRUPA o que já passou por lá — por construção não consegue mostrar uma tela
 * que o menu antigo esconderia, nem esconder uma que ele mostraria.
 */
import type { Role } from "@/lib/auth/types";
import type { ModuloOpcional } from "@/lib/instalacao/modulos";
import type { InterfaceSettings } from "@/lib/navigation/interface";
import { searchable, type NavDestination } from "@/lib/navigation/registry";

import { ehEmBreve, MODULOS_CLINICA, type ModuloClinica } from "./modulos";

export interface ModuloVisivel {
  modulo: ModuloClinica;
  /** As telas do módulo que esta pessoa vê, na ordem do módulo. */
  itens: NavDestination[];
  /** As mesmas telas agrupadas por seção, na ordem de primeira aparição. */
  secoes: Array<{ secao: string; itens: NavDestination[] }>;
  emBreve: boolean;
}

export function modulosVisiveis(
  isPlatformAdmin: boolean,
  role: Role | null,
  settings?: InterfaceSettings,
  modulos?: readonly ModuloOpcional[],
  permissoes?: readonly string[],
): ModuloVisivel[] {
  const porHref = new Map(
    searchable(isPlatformAdmin, role, settings, modulos, permissoes).map((d) => [d.href as string, d]),
  );
  const resultado: ModuloVisivel[] = [];
  for (const modulo of MODULOS_CLINICA) {
    const emBreve = ehEmBreve(modulo);
    const secoes: ModuloVisivel["secoes"] = [];
    const itens: NavDestination[] = [];
    for (const porta of modulo.portas) {
      const destino = porHref.get(porta.href);
      if (!destino) continue;
      itens.push(destino);
      const atual = secoes.find((s) => s.secao === porta.secao);
      if (atual) atual.itens.push(destino);
      else secoes.push({ secao: porta.secao, itens: [destino] });
    }
    // Módulo construído que esvaziou para esta pessoa some — o mesmo que o menu
    // antigo faz com um grupo sem porta visível. "Em breve" não abre nada, então
    // não há o que esconder: aparece para todos.
    if (itens.length > 0 || emBreve) resultado.push({ modulo, itens, secoes, emBreve });
  }
  return resultado;
}
