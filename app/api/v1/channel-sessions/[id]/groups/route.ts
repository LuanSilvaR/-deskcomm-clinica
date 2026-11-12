/**
 * GET /api/v1/channel-sessions/[id]/groups — os grupos do WhatsApp em que o
 * número desta conexão está (#84, aviso de agendamento em grupo).
 *
 * Só leitura e só `admin`: a lista serve para escolher o grupo que recebe o
 * aviso de agendamento, que é configuração de admin (mesmo gate da rota do
 * aviso e da RLS de `config_aviso_de_agendamento`). A organização vem da
 * sessão autenticada, nunca do pedido.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { GrupoError, criarDepsDeGrupos, listarGruposDoNumero } from "@/lib/grupos/servico";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Context): Promise<Response> {
  const requestId = randomUUID();
  const auth = await requireRole("admin", { requestId, resource: "channel_sessions", allowPlatformAdmin: true });
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return fail("validation_failed", "Conexão inválida.", 422, { requestId });
  try {
    const grupos = await listarGruposDoNumero(criarDepsDeGrupos(createAdminClient()), {
      organizationId: auth.org.orgId,
      channelSessionId: id,
    });
    return ok(grupos, { requestId });
  } catch (err) {
    if (err instanceof GrupoError && err.code === "sessao_nao_encontrada") {
      return fail("not_found", "Conexão não encontrada.", 404, { requestId });
    }
    if (err instanceof GrupoError && err.code === "provedor_sem_grupos") {
      return ok([], { requestId });
    }
    logger.warn("[grupos] não foi possível listar os grupos da conexão", {
      requestId,
      erro: err instanceof Error ? err.message : "unknown",
    });
    return fail("upstream_unavailable", "Não foi possível ler os grupos deste número agora. Tente de novo.", 502, {
      requestId,
    });
  }
}
