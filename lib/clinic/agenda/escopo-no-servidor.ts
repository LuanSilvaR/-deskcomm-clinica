/**
 * FORK clinic (agenda por profissional, S1) — `escopoDaLeitura` para as rotas
 * que não passam por `requirePermission` (as do núcleo usam `requireRole`).
 * Pergunta as permissões EFETIVAS uma vez e aplica a regra.
 *
 * Falha ao ler as permissões FECHA: vale só a própria agenda. Mostrar a equipe
 * inteira porque a consulta de permissão caiu seria o vazamento que a chave
 * existe para impedir.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { permissoesEfetivas } from "@/lib/clinic/acesso/resolver";

import { escopoDaLeitura, type EscopoDaLeitura } from "./escopo-da-agenda";

export async function escopoDaAgendaNoServidor(
  supabase: SupabaseClient,
  orgId: string,
  usuarioId: string,
  pedido: string | null | undefined,
): Promise<EscopoDaLeitura> {
  const efetivas = await permissoesEfetivas(supabase, orgId);
  return escopoDaLeitura({
    permissoes: efetivas.ok ? efetivas.permissoes : new Set<string>(),
    usuarioId,
    pedido,
  });
}
