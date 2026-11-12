"use server";

/**
 * #89 — "Esquecer os dispositivos confiáveis" em Perfil e acesso.
 *
 * Apaga todos os dispositivos confiáveis do PRÓPRIO usuário (o id vem da sessão,
 * nunca do pedido). No próximo login, todo navegador volta a pedir o código.
 */
import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { esquecerDispositivosConfiaveis } from "@/lib/auth/dispositivo-confiavel";
import { loadAuthUser } from "@/lib/auth/server";

export async function esquecerMeusDispositivosConfiaveis(): Promise<{ ok: true } | { ok: false; erro: string }> {
  const user = await loadAuthUser();
  if (!user) return { ok: false, erro: "Sua sessão expirou. Entre de novo." };
  try {
    await esquecerDispositivosConfiaveis(user.id);
  } catch {
    return { ok: false, erro: "Não consegui esquecer os dispositivos agora. Tente de novo." };
  }
  await audit({
    action: "auth.mfa_devices_forgotten",
    actorUserId: user.id,
    resourceType: "user",
    resourceId: user.id,
    metadata: { motivo: "pedido_do_usuario" },
  });
  revalidatePath("/app/settings/security");
  return { ok: true };
}
