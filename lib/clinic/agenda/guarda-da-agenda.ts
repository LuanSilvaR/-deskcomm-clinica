/**
 * FORK clinic (agenda S6a, issue #69) — a ACL das ações da agenda nas rotas do núcleo.
 *
 * `app/api/v1/agenda/agendamentos` (core) só exige o PAPEL `agent`. Aqui está a
 * pergunta que faltava: a pessoa tem a CHAVE da ação? O mapa é puro (testável
 * sem banco); a checagem usa as permissões EFETIVAS (`fn_member_permissions`,
 * migration 9009) e devolve o mesmo 403 auditado de `requirePermission`.
 *
 * No modo legado as chaves `agenda.marcar/remarcar/cancelar/registrar_desfecho`
 * vêm do nível `agent` — ninguém que passava pelo `requireRole("agent")` perde.
 * Quem perde é só o papel que nunca as teve (ex.: "Profissional de saúde").
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { traduzir } from "@/lib/i18n/dicionario";
import type { Idioma } from "@/lib/i18n/idiomas";
import { permissoesEfetivas } from "@/lib/clinic/acesso/resolver";

export type VerboDaAgenda = "marcar" | "alterar" | "cancelar";

export type ChaveDeAcaoDaAgenda =
  | "agenda.marcar"
  | "agenda.remarcar"
  | "agenda.cancelar"
  | "agenda.registrar_desfecho";

/** Campos do PATCH que decidem a chave. O resto do PATCH é edição do compromisso = `agenda.marcar`. */
interface CamposDoAlterar {
  starts_at?: unknown;
  status?: unknown;
  notes?: unknown;
  guest_email?: unknown;
  confirmation_next_at?: unknown;
  outcome_message_id?: unknown;
}

/** As chaves que a ação exige — TODAS, quando um PATCH mistura remarcar e desfecho. */
export function chavesExigidas(verbo: VerboDaAgenda, input: unknown): ChaveDeAcaoDaAgenda[] {
  if (verbo === "marcar") return ["agenda.marcar"];
  if (verbo === "cancelar") return ["agenda.cancelar"];

  const c = (input ?? {}) as CamposDoAlterar;
  const chaves = new Set<ChaveDeAcaoDaAgenda>();
  if (c.starts_at !== undefined) chaves.add("agenda.remarcar");
  if (c.status === "completed" || c.status === "no_show") chaves.add("agenda.registrar_desfecho");
  if (
    c.status === "confirmed" ||
    c.notes !== undefined ||
    c.guest_email !== undefined ||
    c.confirmation_next_at !== undefined ||
    c.outcome_message_id !== undefined
  ) {
    chaves.add("agenda.marcar");
  }
  // PATCH sem campo reconhecido não chega aqui (o schema recusa), mas na dúvida a chave mais restrita.
  if (chaves.size === 0) chaves.add("agenda.marcar");
  return [...chaves];
}

interface Contexto {
  organizationId: string;
  userId: string;
  role: string;
  idioma: Idioma;
  requestId: string;
}

/** `null` = pode; `Response` = 403 (ou 500 se o banco não respondeu), pronto para devolver. */
export async function exigeChavesDaAgenda(
  supabase: SupabaseClient,
  ctx: Contexto,
  verbo: VerboDaAgenda,
  input: unknown,
): Promise<Response | null> {
  const efetivas = await permissoesEfetivas(supabase, ctx.organizationId);
  if (!efetivas.ok) return fail("internal_error", efetivas.erro, 500, { requestId: ctx.requestId });

  const faltando = chavesExigidas(verbo, input).find((k) => !efetivas.permissoes.has(k));
  if (!faltando) return null;

  void audit({
    action: "authz.denied",
    actorUserId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "agenda",
    requestId: ctx.requestId,
    metadata: { required_permission: faltando, effective_role: ctx.role },
  });
  return fail("forbidden_permission", traduzir("Você não tem permissão para esta ação.", ctx.idioma), 403, {
    requestId: ctx.requestId,
    details: { permissao: faltando },
  });
}
