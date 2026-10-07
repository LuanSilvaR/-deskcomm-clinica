"use client";
/**
 * Os módulos que esta pessoa vê no menu da clínica — `modulosVisiveis()` com o
 * papel, a interface e as permissões da sessão. Usado pelo menu e pelas abas.
 */
import { useAuth } from "@/hooks/auth/AuthProvider";
import { modulosVisiveis, type ModuloVisivel } from "@/lib/clinic/navegacao/projecao";

export function useModulos(): ModuloVisivel[] {
  const { user, activeOrg } = useAuth();
  return modulosVisiveis(
    user.is_platform_admin && !user.support,
    activeOrg?.role ?? null,
    activeOrg?.interface_settings,
    activeOrg?.modulos_ligados ?? [],
    activeOrg?.permissoes,
  );
}
