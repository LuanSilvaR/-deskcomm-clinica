/** Quem executou o pedido e de onde veio: o mesmo cálculo para anonimizar e para gerar o atestado depois (#87). */
import type { ExecutorDoAtestado } from "@/lib/clinic/lgpd/atestado";
import { papelEmPortugues } from "@/lib/clinic/lgpd/papel";

export interface AutorizadoDoPedido {
  user: { id: string; email: string; full_name: string | null };
  org: { role: string };
}

export function executorDoPedido(authz: AutorizadoDoPedido): ExecutorDoAtestado {
  const { user, org } = authz;
  return {
    user_id: user.id,
    nome: user.full_name?.trim() || user.email.split("@")[0] || user.email,
    email: user.email || null,
    papel: papelEmPortugues(org.role),
  };
}

export function ipDoPedido(req: { headers: { get(nome: string): string | null } }): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || null;
}
