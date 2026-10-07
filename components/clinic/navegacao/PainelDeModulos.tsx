/**
 * FORK clinic (9014; organização do menu, 2026-10) — a grade de módulos do Início.
 *
 * Server Component puro (tradução por `traduzir`). Recebe os módulos JÁ
 * filtrados por `modulosVisiveis()`: um cartão nunca leva a uma tela que o menu
 * não mostraria. Cada cartão: faixa na cor de destaque da marca, ícone + nome e
 * UMA linha do que se encontra ali; o cartão inteiro é o link (44px+ de toque).
 * Os "Em breve" não viram cartão: ficam numa lista discreta (`EmBreveDoInicio`).
 */
import Link from "next/link";

import { ICONES_DOS_MODULOS } from "@/lib/clinic/navegacao/icones";
import { destinoDoModulo } from "@/lib/clinic/navegacao/modulos";
import type { ModuloVisivel } from "@/lib/clinic/navegacao/projecao";
import { traduzir } from "@/lib/i18n/dicionario";
import type { Idioma } from "@/lib/i18n/idiomas";

export { destinoDoModulo };

export function SeloEmBreve({ locale }: { locale: Idioma }) {
  return (
    <span className="rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap text-muted-foreground">
      {traduzir("Em breve", locale)}
    </span>
  );
}

export function PainelDeModulos({ modulos, locale }: { modulos: ModuloVisivel[]; locale: Idioma }) {
  const t = (texto: string) => traduzir(texto, locale);
  const prontos = modulos.filter((m) => !m.emBreve && m.itens.length > 0);
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={t("Módulos da clínica")}>
      {prontos.map((m) => {
        const Icon = ICONES_DOS_MODULOS[m.modulo.icon];
        return (
          <li key={m.modulo.id} data-modulo={m.modulo.id}>
            <Link
              href={destinoDoModulo(m)}
              className="group flex h-full min-h-24 flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
            >
              <span aria-hidden className="h-1 w-8 rounded-full bg-primary" />
              <span className="flex items-center gap-2">
                <Icon size={20} aria-hidden className="shrink-0 text-muted-foreground group-hover:text-foreground" />
                <span className="text-base font-semibold">{t(m.modulo.label)}</span>
              </span>
              <span className="text-sm text-muted-foreground">{t(m.modulo.resumo)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** O que está anunciado e ainda não existe — texto discreto, sem link. */
export function EmBreveDoInicio({ modulos, locale }: { modulos: ModuloVisivel[]; locale: Idioma }) {
  const t = (texto: string) => traduzir(texto, locale);
  const emBreve = modulos.filter((m) => m.emBreve);
  if (emBreve.length === 0) return null;
  return (
    <section aria-labelledby="inicio-em-breve" data-testid="inicio-em-breve">
      <h2 id="inicio-em-breve" className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {t("Em breve")}
      </h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {emBreve.map((m) => (
          <li key={m.modulo.id} className="rounded-full border px-3 py-1 text-xs text-muted-foreground" title={t(m.modulo.description)}>
            {t(m.modulo.label)}
          </li>
        ))}
      </ul>
    </section>
  );
}
