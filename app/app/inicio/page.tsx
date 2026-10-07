import type { Metadata } from "next";

import { PainelDaRecepcao } from "@/components/clinic/inicio/PainelDaRecepcao";
import { AlternarMenuDaClinica } from "@/components/clinic/navegacao/AlternarMenuDaClinica";
import { EmBreveDoInicio, PainelDeModulos } from "@/components/clinic/navegacao/PainelDeModulos";
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
 *
 * Organização (2026-10): "Olá, <nome>" e a GRADE DE MÓDULOS sempre à vista —
 * escolher o módulo é o primeiro passo. "Seu dia" (o painel da recepção ou o
 * resumo) vem logo depois; para quem vê a agenda, antes da grade, porque é a
 * ferramenta de trabalho da recepção. O "Em breve" fica no fim, sem link.
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

  const recepcao = Boolean(activeOrg) && podeVer("/app/agenda");
  const fuso = activeOrg?.timezone || "America/Sao_Paulo";
  const hojePorExtenso = new Intl.DateTimeFormat(idioma === "es" ? "es" : "pt-BR", {
    timeZone: fuso,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const primeiroNome = (user.full_name ?? "").trim().split(/\s+/)[0];

  const seuDia =
    recepcao && activeOrg ? (
      <PainelDaRecepcao orgId={activeOrg.orgId} conversasNaoLidas={resumo.conversasNaoLidas} tarefasAteHoje={resumo.tarefasAteHoje} />
    ) : (
      <ResumoDoDiaCards resumo={resumo} locale={idioma} />
    );
  const gradeDeModulos = (
    <section aria-labelledby="inicio-modulos" data-testid="inicio-todos-os-modulos">
      <h2 id="inicio-modulos" className="sr-only">
        {t("Módulos da clínica")}
      </h2>
      <PainelDeModulos modulos={grade} locale={idioma} />
    </section>
  );

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {primeiroNome ? `${t("Olá")}, ${primeiroNome}` : t("Início")}
        </h1>
        <p className="text-sm text-muted-foreground first-letter:uppercase">
          {recepcao ? `${hojePorExtenso} · ${t("Escolha um módulo para começar.")}` : t("Escolha um módulo para começar.")}
        </p>
      </header>

      {recepcao ? (
        <>
          {seuDia}
          {gradeDeModulos}
        </>
      ) : (
        <>
          {gradeDeModulos}
          {seuDia}
        </>
      )}

      <EmBreveDoInicio modulos={grade} locale={idioma} />

      {podeLigar && activeOrg ? <AlternarMenuDaClinica ligado={ligado} /> : null}
    </div>
  );
}
