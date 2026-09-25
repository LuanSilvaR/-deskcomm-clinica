/**
 * Profissionais e especialidades (módulo clinic do fork, migration 9001).
 *
 * Porta: lib/navigation/catalogo.ts. Atendente entra para bloquear a PRÓPRIA
 * agenda; cadastro de fichas, especialidades e exigências é da gerência; ligar
 * o módulo é do admin.
 */
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { permissoesNaPagina } from "@/lib/clinic/acesso/pagina";
import { confirmacaoAutomaticaLigada } from "@/lib/clinic/confirmacao/servidor";
import { prazoDoPacienteHoras } from "@/lib/clinic/agenda/prazo-do-paciente";
import { recursosLigados } from "@/lib/clinic/agenda/recursos";
import { clinicProfissionaisLigado, procedimentosLigados, prontuarioLigado, travaSobreposicaoLigada } from "@/lib/clinic/flags";
import { fichaObrigatoriaLigada } from "@/lib/clinic/pacientes/servidor";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

import { ProfissionaisClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function ProfissionaisPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  // FORK clinic (ACL-016): quem bloqueia a própria agenda ou cadastra entra.
  const permissoes = await permissoesNaPagina(user, activeOrg.orgId);
  if (!permissoes.has("agenda.bloquear_horario") && !permissoes.has("profissionais.gerenciar") && !user.is_platform_admin) redirect("/app");

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", activeOrg.orgId)
    .maybeSingle();

  const ehGerencia = permissoes.has("profissionais.gerenciar");

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Profissionais e especialidades")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("Quem atende, o que cada um sabe fazer, quando atende e quando a agenda fica fechada.")}
        </p>
      </header>
      <ProfissionaisClient
        ligadoInicial={clinicProfissionaisLigado(org?.settings)}
        fichaObrigatoriaInicial={fichaObrigatoriaLigada(org?.settings)}
        confirmacaoInicial={confirmacaoAutomaticaLigada(org?.settings)}
        travaInicial={travaSobreposicaoLigada(org?.settings)}
        recursosInicial={recursosLigados(org?.settings)}
        procedimentosInicial={procedimentosLigados(org?.settings)}
        prontuarioInicial={prontuarioLigado(org?.settings)}
        prazoInicial={prazoDoPacienteHoras(org?.settings)}
        podeLigar={permissoes.has("configuracoes.opcoes_da_clinica")}
        ehGerencia={ehGerencia}
        usuarioAtualId={user.id}
      />
    </div>
  );
}
