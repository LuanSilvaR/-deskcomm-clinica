/**
 * Papéis de acesso (fork clinic, ACL-009/010) — os papéis da empresa, a matriz
 * de permissões e os papéis de cada membro. Porta: lib/navigation/catalogo.ts
 * (Configurações › Sua empresa). Quem decide é o banco (fn_acesso_*, 9010).
 */
import { requireAuth } from "@/lib/auth/server";
import { exigePermissaoNaPagina } from "@/lib/clinic/acesso/pagina";
import { traduzir } from "@/lib/i18n/dicionario";

import { PapeisDeAcesso } from "./_client";

export const dynamic = "force-dynamic";

export default async function PapeisPage() {
  const negado = await exigePermissaoNaPagina("papeis.ver");
  if (negado) return negado;
  const user = await requireAuth();
  const t = (s: string) => traduzir(s, user.idioma);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Papéis de acesso")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("Quem pode fazer o quê na empresa. Crie papéis como Recepcionista ou Financeiro, marque as permissões e dê a cada membro um ou mais papéis.")}
        </p>
      </header>
      <PapeisDeAcesso />
    </div>
  );
}
