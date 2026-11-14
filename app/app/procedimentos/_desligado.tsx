/**
 * FORK clinic (9015) — o módulo desligado: diz como ligar, em vez de uma tela vazia.
 */
import Link from "next/link";

import { procedimentosLigados } from "@/lib/clinic/flags";
import { traduzir } from "@/lib/i18n/dicionario";
import type { Idioma } from "@/lib/i18n/idiomas";
import { createClient } from "@/lib/supabase/server";

export async function moduloLigado(orgId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("settings").eq("id", orgId).maybeSingle();
  return procedimentosLigados((data as { settings?: unknown } | null)?.settings);
}

export function ModuloDesligado({ idioma }: { idioma: Idioma }) {
  const t = (texto: string) => traduzir(texto, idioma);
  return (
    <div className="rounded-xl border border-dashed p-4 text-sm" data-testid="procedimentos-desligado">
      <p>{t("Procedimentos e POP estão desligados nesta empresa.")}</p>
      <Link href="/app/settings/tenant/profissionais" className="mt-1 inline-block underline">
        {t("Ligar em Configurações › Profissionais")}
      </Link>
    </div>
  );
}
