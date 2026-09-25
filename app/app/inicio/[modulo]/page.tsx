import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SeloEmBreve } from "@/components/clinic/navegacao/PainelDeModulos";
import { Card } from "@/components/ui/card";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ICONES_DOS_MODULOS } from "@/lib/clinic/navegacao/icones";
import { moduloPorId } from "@/lib/clinic/navegacao/modulos";
import { modulosDoServidor } from "@/lib/clinic/navegacao/servidor";
import { traduzir } from "@/lib/i18n/dicionario";
import { ArrowRight } from "@/lib/ui/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ modulo: string }> }): Promise<Metadata> {
  const { modulo } = await params;
  return { title: moduloPorId(modulo)?.label ?? "Início" };
}

/**
 * FORK clinic (migration 9014) — o painel de um módulo: o inventário das telas
 * dele que a pessoa vê, por seção, mais o que está "Em breve".
 *
 * Mesma regra dos hubs do menu antigo (`NavHub`): é inventário, não sobra — e
 * só lista o que já passou pelo filtro de acesso do menu.
 */
export default async function PainelDoModuloPage({ params }: { params: Promise<{ modulo: string }> }) {
  const { modulo: id } = await params;
  const modulo = moduloPorId(id);
  if (!modulo) notFound();

  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  const idioma = user.idioma;
  const t = (texto: string) => traduzir(texto, idioma);

  const visivel = (await modulosDoServidor(user, activeOrg)).find((m) => m.modulo.id === modulo.id);
  const Icon = ICONES_DOS_MODULOS[modulo.icon];

  return (
    <div className="flex h-full flex-col gap-8 p-6">
      <header className="space-y-2">
        <Link
          href="/app/inicio"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={12} aria-hidden className="rotate-180" />
          {t("Início")}
        </Link>
        <div className="flex items-center gap-3">
          <Icon size={24} aria-hidden className="text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">{t(modulo.label)}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t(modulo.description)}</p>
      </header>

      {!visivel || (visivel.itens.length === 0 && !visivel.emBreve) ? (
        <p className="text-sm text-muted-foreground">
          {t("Seu acesso não inclui telas deste módulo. Fale com quem administra a clínica.")}
        </p>
      ) : null}

      {visivel?.secoes.map(({ secao, itens }, i) => (
        <section key={secao} aria-labelledby={`modulo-secao-${i}`} className="space-y-3">
          <h2
            id={`modulo-secao-${i}`}
            className="text-xs font-medium tracking-wider text-muted-foreground uppercase"
          >
            {t(secao)}
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {itens.map((item) => {
              const ItemIcon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="block">
                  <Card className="flex h-full gap-3 p-4 transition-colors hover:border-border-strong">
                    <ItemIcon size={20} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
                    <div>
                      <h3 className="text-sm font-semibold">{t(item.label)}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{t(item.description)}</p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      {modulo.emBreve && modulo.emBreve.length > 0 ? (
        <section aria-labelledby="modulo-em-breve" className="space-y-3">
          <h2 id="modulo-em-breve" className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            {t("Em breve")}
          </h2>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {modulo.emBreve.map((e) => (
              <li key={e.label} aria-disabled="true">
                <Card className="h-full bg-muted/50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">{t(e.label)}</h3>
                    <SeloEmBreve locale={idioma} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t(e.description)}</p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
