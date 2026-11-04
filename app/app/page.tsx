import { redirect } from "next/navigation";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { menuClinicaDaOrg } from "@/lib/clinic/navegacao/servidor";
import { homeDaInterface } from "@/lib/navigation/interface";
import { permissoesNaPagina } from "@/lib/clinic/acesso/pagina";
import { CASA_DO_PROFISSIONAL, ehExperienciaDoProfissional } from "@/lib/clinic/acesso/experiencia";
export default async function AppHome() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  // FORK clinic (agenda S5): quem pode atender e não recepciona começa no "Meu dia".
  if (org && ehExperienciaDoProfissional(await permissoesNaPagina(user, org.orgId))) redirect(CASA_DO_PROFISSIONAL);
  redirect(
    homeDaInterface(
      org?.interface_settings,
      user.is_platform_admin && !user.support,
      org?.role ?? null,
      // FORK clinic (9014): menu da clínica ligado → a casa é o Início.
      (await menuClinicaDaOrg(org?.orgId)) ? "/app/inicio" : undefined,
    ),
  );
}
