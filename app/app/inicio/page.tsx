import type { Metadata } from "next";

import { AlternarMenuDaClinica } from "@/components/clinic/navegacao/AlternarMenuDaClinica";
import { PainelDeModulos } from "@/components/clinic/navegacao/PainelDeModulos";
import { ResumoDoDiaCards } from "@/components/clinic/navegacao/ResumoDoDiaCards";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { resumoDoDia, type ResumoDoDia } from "@/lib/clinic/navegacao/resumo-do-dia";
import { menuClinicaDaOrg, modulosDoServidor } from "@/lib/clinic/navegacao/servidor";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Início" };

/**
 * FORK clinic (migration 9014) — o Início da clínica.
 *
 * Resumo do dia no topo e, embaixo, todos os módulos — os construídos levam à
 * tela (ou ao painel do módulo), os "Em breve" aparecem sem link. Tudo que está
 * aqui já passou pelo filtro de acesso do menu (`modulosDoServidor`), e cada
 * número do resumo só é consultado se a pessoa vê a tela de onde ele vem.
 *
 * Com o menu antigo esta tela continua existindo (⌘K), e é aqui que quem
 * administra liga o menu da clínica.
 */
export default async function InicioPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  const idioma = user.idioma;
  const t = (texto: string) => traduzir(texto, idioma);

  const [modulos, ligado] = await Promise.all([
    modulosDoServidor(user, activeOrg),
    menuClinicaDaOrg(activeOrg?.orgId),
  ]);
  const podeVer = (href: string) => modulos.some((m) => m.itens.some((i) => i.href === href));

  let resumo: ResumoDoDia = {};
  if (activeOrg) {
    resumo = await resumoDoDia(await createClient(), activeOrg.orgId, user.id, activeOrg.timezone, {
      agenda: podeVer("/app/agenda"),
      tarefas: podeVer("/app/tasks"),
      conversas: podeVer("/app/inbox"),
    });
  }

  const podeLigar = (user.is_platform_admin && !user.support) || activeOrg?.role === "admin";
  // O próprio Início não entra na grade: já estamos nele.
  const grade = modulos.filter((m) => m.modulo.id !== "inicio");

  return (
    <div className="flex h-full flex-col gap-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Início")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("Todos os módulos da clínica num lugar só, com o resumo do dia.")}
        </p>
      </header>

      <ResumoDoDiaCards resumo={resumo} locale={idioma} />

      <section aria-labelledby="inicio-modulos" className="space-y-3">
        <h2 id="inicio-modulos" className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {t("Módulos")}
        </h2>
        <PainelDeModulos modulos={grade} locale={idioma} />
      </section>

      {podeLigar && activeOrg ? <AlternarMenuDaClinica ligado={ligado} /> : null}
    </div>
  );
}
