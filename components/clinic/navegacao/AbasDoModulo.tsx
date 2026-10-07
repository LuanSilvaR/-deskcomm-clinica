"use client";
/**
 * FORK clinic (organização do menu, 2026-10) — as telas do módulo aberto, em
 * abas no topo do conteúdo. O menu lateral tem uma linha por módulo; aqui fica
 * o "dentro" do módulo, a um toque, e o painel "Visão geral" com todas as telas.
 *
 * Só aparece com o menu da clínica ligado e num módulo com 2+ telas visíveis.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { abasDoModulo } from "@/lib/clinic/navegacao/abas";
import { cn } from "@/lib/utils";

import { useModulos } from "./useModulos";

const ABA =
  "inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-3 text-sm transition-colors md:min-h-9 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden";

export function AbasDoModulo() {
  const t = useT();
  const pathname = usePathname();
  const { activeOrg } = useAuth();
  const modulos = useModulos();
  if (activeOrg?.menu_clinica !== true) return null;
  const r = abasDoModulo(pathname, modulos);
  if (!r) return null;
  const rotulo = t(r.modulo.label);
  return (
    <nav aria-label={`${t("Telas de")} ${rotulo}`} className="mb-4 -mt-2 border-b" data-testid="abas-do-modulo">
      <ul className="flex gap-1 overflow-x-auto pb-2">
        {r.abas.map((a) => (
          <li key={a.href} className="shrink-0">
            <Link
              href={a.href}
              aria-current={a.ativa ? "page" : undefined}
              className={cn(
                ABA,
                a.ativa ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t(a.label)}
            </Link>
          </li>
        ))}
        <li className="ml-auto shrink-0">
          <Link
            href={r.painel.href}
            aria-current={r.painel.ativo ? "page" : undefined}
            className={cn(ABA, "text-muted-foreground hover:bg-muted hover:text-foreground", r.painel.ativo && "font-medium text-foreground")}
          >
            {t("Visão geral")}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
