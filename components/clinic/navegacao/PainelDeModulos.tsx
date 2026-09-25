/**
 * FORK clinic (9014) — a grade de módulos do Início.
 *
 * Server Component puro (tradução por `traduzir`). Recebe os módulos JÁ
 * filtrados por `modulosVisiveis()`: um card nunca leva a uma tela que o menu
 * não mostraria. Módulo "Em breve" é um card sem link, com o selo.
 */
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { ICONES_DOS_MODULOS } from "@/lib/clinic/navegacao/icones";
import { hrefDoPainel } from "@/lib/clinic/navegacao/modulos";
import type { ModuloVisivel } from "@/lib/clinic/navegacao/projecao";
import { traduzir } from "@/lib/i18n/dicionario";
import type { Idioma } from "@/lib/i18n/idiomas";

export function destinoDoModulo(m: ModuloVisivel): string {
  return m.itens.length === 1 ? m.itens[0]!.href : hrefDoPainel(m.modulo);
}

export function SeloEmBreve({ locale }: { locale: Idioma }) {
  return (
    <span className="rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap text-muted-foreground">
      {traduzir("Em breve", locale)}
    </span>
  );
}

export function PainelDeModulos({ modulos, locale }: { modulos: ModuloVisivel[]; locale: Idioma }) {
  const t = (texto: string) => traduzir(texto, locale);
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={t("Módulos da clínica")}>
      {modulos.map((m) => {
        const Icon = ICONES_DOS_MODULOS[m.modulo.icon];
        const corpo = (
          <Card
            className={`flex h-full gap-3 p-4 transition-colors ${m.emBreve ? "bg-muted/50" : "hover:border-border-strong"}`}
          >
            <Icon
              size={22}
              aria-hidden
              className={`mt-0.5 shrink-0 ${m.emBreve ? "text-text-subtle" : "text-muted-foreground"}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h2 className={`text-sm font-semibold ${m.emBreve ? "text-muted-foreground" : ""}`}>
                  {t(m.modulo.label)}
                </h2>
                {m.emBreve ? (
                  <SeloEmBreve locale={locale} />
                ) : (
                  <span className="text-[11px] whitespace-nowrap text-muted-foreground">
                    {m.itens.length === 1 ? t("1 tela") : `${m.itens.length} ${t("telas")}`}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t(m.modulo.description)}</p>
            </div>
          </Card>
        );
        return (
          <li key={m.modulo.id} data-modulo={m.modulo.id}>
            {m.emBreve ? (
              <div aria-disabled="true" className="block h-full cursor-default">
                {corpo}
              </div>
            ) : (
              <Link
                href={destinoDoModulo(m)}
                className="block h-full rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
              >
                {corpo}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
