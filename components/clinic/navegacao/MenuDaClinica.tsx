"use client";
/**
 * FORK clinic (9014) — o menu lateral organizado por módulos da clínica.
 *
 * Só desenha. Quais módulos e telas aparecem vem de `modulosVisiveis()`
 * (`lib/clinic/navegacao/projecao.ts`), que agrupa o resultado da MESMA decisão
 * de acesso do menu de sempre — nada aqui concede ou tira acesso.
 *
 * DENSIDADE: dezessete módulos não cabem abertos em 1280×900. Cada módulo é
 * UMA linha; só um fica aberto por vez (o da tela atual, ao carregar), e um
 * módulo aberto mostra no máximo `MAX_ITENS` telas — o resto está a um clique,
 * no painel do módulo (`/app/inicio/<id>`), que é o inventário completo.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { ICONES_DOS_MODULOS } from "@/lib/clinic/navegacao/icones";
import { hrefDoPainel, moduloDoCaminho } from "@/lib/clinic/navegacao/modulos";
import { modulosVisiveis, type ModuloVisivel } from "@/lib/clinic/navegacao/projecao";
import { ArrowRight, CaretDown } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const MAX_ITENS = 6;

const LINHA =
  "relative flex w-full items-center gap-3 rounded-md px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden";
const LINHA_ATIVA = "bg-accent text-accent-foreground";
const LINHA_INATIVA = "text-muted-foreground hover:bg-accent/50 hover:text-foreground";

function useModulos(): ModuloVisivel[] {
  const { user, activeOrg } = useAuth();
  return modulosVisiveis(
    user.is_platform_admin && !user.support,
    activeOrg?.role ?? null,
    activeOrg?.interface_settings,
    activeOrg?.modulos_ligados ?? [],
    activeOrg?.permissoes,
  );
}

function ativo(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

interface Props {
  collapsed: boolean;
  onNavigate?: () => void;
}

export function NavDaClinica({ collapsed, onNavigate }: Props) {
  const t = useT();
  const pathname = usePathname();
  const modulos = useModulos().filter((m) => !m.modulo.rodape);
  const atual = moduloDoCaminho(pathname)?.id ?? null;
  // Acordeão: um aberto por vez. `undefined` = segue a tela atual; o clique
  // grava a escolha (inclusive fechar o módulo da tela atual).
  const [escolhido, setEscolhido] = useState<string | null | undefined>(undefined);
  const aberto = escolhido === undefined ? atual : escolhido;

  return (
    <nav
      className="flex-1 space-y-1 overflow-y-auto p-2"
      aria-label={t("Navegação principal")}
      data-menu="clinica"
    >
      <ul className="space-y-1">
        {modulos.map((m) => {
          const Icon = ICONES_DOS_MODULOS[m.modulo.icon];
          const rotulo = t(m.modulo.label);
          const doModulo = atual === m.modulo.id;

          if (m.emBreve) {
            return (
              <li key={m.modulo.id}>
                <span
                  aria-disabled="true"
                  title={`${rotulo} — ${t("Em breve")}`}
                  className={cn(LINHA, "cursor-default text-text-subtle", collapsed && "justify-center px-2")}
                >
                  <Icon size={18} aria-hidden />
                  {!collapsed && (
                    <>
                      <span className="truncate">{rotulo}</span>
                      <span className="ml-auto rounded-full border px-1.5 text-[10px] leading-4 whitespace-nowrap">
                        {t("Em breve")}
                      </span>
                    </>
                  )}
                </span>
              </li>
            );
          }

          // Uma tela só (ou o rail recolhido, sem onde desenhar a lista): a linha
          // é o próprio link — para a tela, ou para o painel do módulo.
          const unico = m.itens.length === 1 ? m.itens[0]! : null;
          if (unico || collapsed) {
            const href = unico ? unico.href : hrefDoPainel(m.modulo);
            return (
              <li key={m.modulo.id}>
                <Link
                  href={href}
                  title={collapsed ? rotulo : undefined}
                  aria-current={doModulo ? "page" : undefined}
                  onClick={onNavigate}
                  className={cn(LINHA, doModulo ? LINHA_ATIVA : LINHA_INATIVA, collapsed && "justify-center px-2")}
                >
                  <Icon size={18} weight={doModulo ? "fill" : "regular"} aria-hidden />
                  {!collapsed && <span className="truncate">{rotulo}</span>}
                </Link>
              </li>
            );
          }

          const expandido = aberto === m.modulo.id;
          const listaId = `menu-clinica-${m.modulo.id}`;
          // A tela aberta nunca fica escondida atrás do "Ver tudo".
          const idxAtivo = m.itens.findIndex((i) => ativo(pathname, i.href));
          const visiveis =
            idxAtivo >= MAX_ITENS
              ? [...m.itens.slice(0, MAX_ITENS - 1), m.itens[idxAtivo]!]
              : m.itens.slice(0, MAX_ITENS);
          return (
            <li key={m.modulo.id}>
              <button
                type="button"
                aria-expanded={expandido}
                aria-controls={listaId}
                onClick={() => setEscolhido(expandido ? null : m.modulo.id)}
                className={cn(LINHA, doModulo && !expandido ? LINHA_ATIVA : LINHA_INATIVA, doModulo && "font-medium")}
              >
                <Icon size={18} weight={doModulo ? "fill" : "regular"} aria-hidden />
                <span className="truncate">{rotulo}</span>
                <CaretDown
                  size={12}
                  weight="bold"
                  aria-hidden
                  className={cn("ml-auto shrink-0 text-text-subtle transition-transform", !expandido && "-rotate-90")}
                />
              </button>
              {expandido && (
                <ul id={listaId} aria-label={rotulo} className="mt-1 ml-4 space-y-1 border-l pl-2">
                  {visiveis.map((item) => {
                    const isActive = ativo(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={isActive ? "page" : undefined}
                          onClick={onNavigate}
                          className={cn(LINHA, "py-0.5", isActive ? LINHA_ATIVA : LINHA_INATIVA)}
                        >
                          <span className="truncate">{t(item.label)}</span>
                        </Link>
                      </li>
                    );
                  })}
                  {m.itens.length > MAX_ITENS && (
                    <li>
                      <Link
                        href={hrefDoPainel(m.modulo)}
                        onClick={onNavigate}
                        aria-current={pathname === hrefDoPainel(m.modulo) ? "page" : undefined}
                        className={cn(LINHA, "py-0.5", LINHA_INATIVA)}
                      >
                        <ArrowRight size={14} aria-hidden />
                        <span className="truncate">
                          {t("Ver tudo")} ({m.itens.length})
                        </span>
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Perfil e acesso + Configurações, no rodapé fixo — o mesmo lugar em que o
 * menu antigo põe Configurações, e pelo mesmo motivo: é o que se procura quando
 * não se acha algo, e não pode depender de rolar.
 */
export function RodapeDaClinica({ collapsed, onNavigate }: Props) {
  const t = useT();
  const pathname = usePathname();
  const atual = moduloDoCaminho(pathname)?.id ?? null;
  const modulos = useModulos().filter((m) => m.modulo.rodape && m.itens.length > 0);
  return (
    <>
      {modulos.map((m) => {
        const Icon = ICONES_DOS_MODULOS[m.modulo.icon];
        const rotulo = t(m.modulo.label);
        const doModulo = atual === m.modulo.id;
        return (
          <Link
            key={m.modulo.id}
            href={hrefDoPainel(m.modulo)}
            title={collapsed ? rotulo : undefined}
            aria-current={doModulo ? "page" : undefined}
            onClick={onNavigate}
            className={cn(LINHA, "mb-1", doModulo ? LINHA_ATIVA : LINHA_INATIVA, collapsed && "justify-center px-2")}
          >
            <Icon size={18} aria-hidden />
            {!collapsed && <span className="truncate">{rotulo}</span>}
          </Link>
        );
      })}
    </>
  );
}
