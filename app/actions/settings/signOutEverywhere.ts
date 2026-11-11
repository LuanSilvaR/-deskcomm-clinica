"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { headers } from "next/headers";
import { esquecerDispositivosConfiaveis } from "@/lib/auth/dispositivo-confiavel";
import { logger } from "@/lib/logger";

export async function signOutEverywhere(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  // #89: sair de todos os lugares também esquece os dispositivos confiáveis —
  // senão o próximo login nesses navegadores entraria sem o código.
  if (user) {
    await esquecerDispositivosConfiaveis(user.id).catch((e: unknown) => {
      logger.error("mfa_dispositivos_nao_esquecidos_ao_sair_de_tudo", {
        message: e instanceof Error ? e.message : String(e),
      });
    });
  }
  await supabase.auth.signOut({ scope: "global" });

  if (user) {
    await audit({
      action: "auth.logout",
      actorUserId: user.id,
      requestId,
      metadata: { scope: "global" },
    });
  }
  redirect("/login");
}
