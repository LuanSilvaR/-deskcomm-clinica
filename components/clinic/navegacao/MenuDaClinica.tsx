"use client";
/**
 * FORK clinic (9014; organização do menu, 2026-10) — o menu lateral da clínica.
 *
 * Só desenha. Quais módulos aparecem vem de `modulosVisiveis()`
 * (`lib/clinic/navegacao/projecao.ts`), que agrupa o resultado da MESMA decisão
 * de acesso do menu de sempre — nada aqui concede ou tira acesso.
 *
 * UM NÍVEL SÓ: uma linha por módulo (ícone + nome), o módulo da tela aberta com
 * fundo cheio. O clique leva à primeira tela do módulo; as outras ficam nas
 * abas do módulo, no topo da tela (`AbasDoModulo`). "Em breve" não ocupa o
 * menu: aparece só no Início. Alvo de toque de 44px no tablet.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useT } from "@/hooks/i18n/useT";
import { ICONES_DOS_MODULOS } from "@/lib/clinic/navegacao/icones";
import { destinoDoModulo, hrefDoPainel, moduloDoCaminho } from "@/lib/clinic/navegacao/modulos";
import { cn } from "@/lib/utils";

import { useModulos } from "./useModulos";

const LINHA =
  "relative flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm transition-colors md:min-h-9 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden";
const LINHA_ATIVA = "bg-primary font-medium text-primary-foreground";
const LINHA_INATIVA = "text-muted-foreground hover:bg-accent/50 hover:text-foreground";

interface Props {
  collapsed: boolean;
  onNavigate?: () => void;
}

export function NavDaClinica({ collapsed, onNavigate }: Props) {
  const t = useT();
  const pathname = usePathname();
  const modulos = useModulos().filter((m) => !m.modulo.rodape && !m.emBreve && m.itens.length > 0);
  const atual = moduloDoCaminho(pathname)?.id ?? null;

  return (
    <nav
      className="flex-1 space-y-1 overflow-y-auto p-2"
      aria-label={t("Navegação principal")}
      data-menu="clinica"
    >
      <ul className="space-y-0.5">
        {modulos.map((m) => {
          const Icon = ICONES_DOS_MODULOS[m.modulo.icon];
          const rotulo = t(m.modulo.label);
          const doModulo = atual === m.modulo.id;
          return (
            <li
              key={m.modulo.id}
              className={cn(m.modulo.separarAntes && "mt-2 border-t pt-2")}
              data-modulo={m.modulo.id}
            >
              <Link
                href={destinoDoModulo(m)}
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
