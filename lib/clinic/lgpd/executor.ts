/** Quem executou o pedido e de onde veio: o mesmo cálculo para anonimizar e para gerar o atestado depois (#87). */
import type { ExecutorDoAtestado } from "@/lib/clinic/lgpd/atestado";
import { papelEmPortugues, ROTULO_SUPORTE_DA_PLATAFORMA } from "@/lib/clinic/lgpd/papel";
import { ipDoClienteParaInet } from "@/lib/http/ip-do-cliente";

export interface AutorizadoDoPedido {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    is_platform_admin?: boolean;
    organizations?: ReadonlyArray<{ organization_id: string }>;
  };
  org: { role: string; orgId?: string };
}

/**
 * Admin da plataforma que NÃO é membro da clínica entra com o papel "viewer"
 * emprestado (requireRole). Esse papel não é verdade: no documento vira "suporte da plataforma".
 */
function entrouPelaPlataforma({ user, org }: AutorizadoDoPedido): boolean {
  if (user.is_platform_admin !== true || !org.orgId) return false;
  return !(user.organizations ?? []).some((m) => m.organization_id === org.orgId);
}

export function executorDoPedido(authz: AutorizadoDoPedido): ExecutorDoAtestado {
  const { user, org } = authz;
  return {
    user_id: user.id,
    nome: user.full_name?.trim() || user.email.split("@")[0] || user.email,
    email: user.email || null,
    papel: entrouPelaPlataforma(authz) ? ROTULO_SUPORTE_DA_PLATAFORMA : papelEmPortugues(org.role),
  };
}

/** IP validado como `inet` (cabeçalho malformado vira null, nunca derruba a gravação). */
export function ipDoPedido(req: { headers: Headers }): string | null {
  return ipDoClienteParaInet(req.headers);
}
