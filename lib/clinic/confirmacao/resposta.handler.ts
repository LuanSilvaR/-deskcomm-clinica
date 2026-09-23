/**
 * FORK clinic (migration 9004) — a resposta do paciente ao pedido de
 * confirmação, plugada no dispatcher do `event_log`. Mesmo desenho de
 * `lib/campanhas/resposta.handler.ts`.
 *
 * `message.received` só nasce de mensagem INBOUND (o trigger de `messages`),
 * então aqui não se filtra direção. Sem pedido aberto para o contato — que é o
 * caso de quase toda mensagem — o resultado é `skipped`.
 *
 * Nunca lança: falha vira `error` e o dispatcher aplica o backoff. A mensagem
 * já está no inbox de qualquer jeito.
 */
import { aplicarResposta } from "@/lib/clinic/confirmacao/servidor";
import type { EventHandler, HandlerResult } from "@/lib/event-log/dispatcher";
import { createAdminClient } from "@/lib/supabase/admin";

export const CLINIC_CONFIRMACAO_HANDLER_KEY = "clinic-confirmacao-resposta.v1";

export const clinicConfirmacaoRespostaHandler: EventHandler = {
  key: CLINIC_CONFIRMACAO_HANDLER_KEY,
  events: ["message.received"],
  async handle(row): Promise<HandlerResult> {
    const contactId = typeof row.payload.contact_id === "string" ? row.payload.contact_id : null;
    const messageId = typeof row.payload.message_id === "string" ? row.payload.message_id : null;
    if (!contactId || !messageId) {
      return { consumer_key: CLINIC_CONFIRMACAO_HANDLER_KEY, status: "skipped", detail: "evento sem contact_id/message_id" };
    }

    try {
      const r = await aplicarResposta(createAdminClient(), {
        organizationId: row.organization_id,
        contactId,
        messageId,
        recebidoEm: momentoDoEvento(row),
      });
      return {
        consumer_key: CLINIC_CONFIRMACAO_HANDLER_KEY,
        status: r.efeito === "confirmado" || r.efeito === "recusado" ? "ok" : "skipped",
        detail: r.appointmentId ? `${r.efeito} appointment=${r.appointmentId}` : r.efeito,
      };
    } catch (err) {
      return {
        consumer_key: CLINIC_CONFIRMACAO_HANDLER_KEY,
        status: "error",
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

function momentoDoEvento(row: { created_at?: string | Date | null }): Date {
  if (row.created_at) {
    const d = new Date(row.created_at);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}
