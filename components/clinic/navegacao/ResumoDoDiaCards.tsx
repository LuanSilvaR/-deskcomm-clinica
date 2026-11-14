/**
 * FORK clinic (9014) — os números do dia no topo do Início. Cada bloco só
 * aparece quando o número existe (a pessoa vê a tela de origem e a consulta
 * respondeu) e leva à tela de onde ele vem.
 */
import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { ResumoDoDia } from "@/lib/clinic/navegacao/resumo-do-dia";
import { traduzir } from "@/lib/i18n/dicionario";
import type { Idioma } from "@/lib/i18n/idiomas";

interface Bloco {
  valor: number | undefined;
  rotulo: string;
  href: string;
}

export function ResumoDoDiaCards({ resumo, locale }: { resumo: ResumoDoDia; locale: Idioma }) {
  const t = (texto: string) => traduzir(texto, locale);
  const blocos: Bloco[] = [
    { valor: resumo.atendimentosHoje, rotulo: "Atendimentos hoje", href: "/app/agenda" },
    { valor: resumo.faltasHoje, rotulo: "Faltas hoje", href: "/app/agenda/faltas" },
    { valor: resumo.tarefasAteHoje, rotulo: "Tarefas para hoje ou atrasadas", href: "/app/tasks" },
    { valor: resumo.conversasNaoLidas, rotulo: "Suas conversas não lidas", href: "/app/inbox" },
  ];
  const visiveis = blocos.filter((b) => b.valor !== undefined);
  if (visiveis.length === 0) return null;

  return (
    <section aria-labelledby="inicio-resumo" className="space-y-3">
      <h2 id="inicio-resumo" className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {t("Resumo do dia")}
      </h2>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {visiveis.map((b) => (
          <li key={b.href}>
            <Link
              href={b.href}
              className="block h-full rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
            >
              <Card className="h-full p-4 transition-colors hover:border-border-strong">
                <p className="text-2xl font-semibold tabular-nums">{b.valor}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t(b.rotulo)}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
