import type { SupabaseClient } from "@supabase/supabase-js";

import { gravarDesfechoNoCompromisso } from "./desfecho";
import { enviarLembreteComReserva } from "./enviar";
import { logger } from "@/lib/logger";

import { soFalhasAvisadasDepois } from "./falha-avisada-depois";
import { classificarEnvio, MAX_TENTATIVAS_DO_LEMBRETE } from "./regra";

/**
 * Reserva quando a Meta avisa DEPOIS (#83).
 *
 * A Meta costuma aceitar o envio (HTTP 200, mensagem `sent`) e só minutos
 * depois dizer, pelo webhook de status, que não entregou. Esse aviso chega como
 * UPDATE em `messages` (`status = 'failed'`), que não emite evento: por isso a
 * detecção é esta varredura, rodada pelo cron do lembrete antes do laço.
 *
 * A regra é UMA tentativa de reserva por mensagem, e nunca duas: antes de
 * decidir qualquer coisa a mensagem original é reivindicada com um update
 * condicional (`reserva` ainda nula). Só quem afetou a linha segue; uma rodada
 * concorrente que perde a disputa não envia nada.
 */
const LIMITE_DE_ORGANIZACOES = 500;

type Linha = Record<string, unknown>;

interface MensagemRecusada {
  id: string;
  contact_id: string;
  body: string | null;
  error_code: string | null;
  error_message: string | null;
  metadata: Linha | null;
}

interface DoLembrete {
  appointment_id?: unknown;
  degraus?: unknown;
  tentativa?: unknown;
}

export interface ResumoDaReserva {
  reenviados: number;
  semReserva: number;
  ignorados: number;
}

export async function reenviarLembretesQueAMetaRecusou(
  admin: SupabaseClient,
  agora: Date,
  limite = 100,
): Promise<ResumoDaReserva> {
  const resumo: ResumoDaReserva = { reenviados: 0, semReserva: 0, ignorados: 0 };

  const { data: orgs } = await admin
    .from("organizations")
    .select("id")
    .eq("settings->clinic->>lembrete_com_reserva", "true")
    .limit(LIMITE_DE_ORGANIZACOES);
  if (!Array.isArray(orgs)) return resumo;

  let restante = limite;

  for (const { id: org } of orgs as { id: string }[]) {
    if (restante <= 0) break;

    const { data: canais, error: erroDosCanais } = await admin
      .from("channel_sessions")
      .select("id")
      .eq("organization_id", org)
      .eq("provider", "meta_cloud");
    if (erroDosCanais) {
      logger.error("[reserva-depois] leitura dos canais falhou", { error: erroDosCanais.message });
      continue;
    }
    const metaIds = Array.isArray(canais) ? (canais as { id: string }[]).map((c) => c.id) : [];
    if (metaIds.length === 0) continue;

    const { data: mensagens, error: erroDasMensagens } = await soFalhasAvisadasDepois(
      admin
        .from("messages")
        .select("id, contact_id, body, error_code, error_message, metadata")
        .eq("organization_id", org)
        .in("channel_session_id", metaIds),
      agora,
    )
      .order("created_at", { ascending: true })
      .limit(restante);
    if (erroDasMensagens) {
      logger.error("[reserva-depois] leitura das mensagens falhou", { error: erroDasMensagens.message });
      continue;
    }
    if (!Array.isArray(mensagens)) continue;
    restante -= mensagens.length;

    for (const m of mensagens as MensagemRecusada[]) {
      await cuidarDeUma(admin, { org, m, metaIds, agora }, resumo);
    }
  }
  return resumo;
}

async function cuidarDeUma(
  admin: SupabaseClient,
  { org, m, metaIds, agora }: { org: string; m: MensagemRecusada; metaIds: string[]; agora: Date },
  resumo: ResumoDaReserva,
): Promise<void> {
  const metadata: Linha = m.metadata ?? {};
  const lembrete = (metadata.lembrete ?? {}) as DoLembrete;

  const marcar = async (reserva: string | null) => {
    const { error } = await admin
      .from("messages")
      .update({ metadata: { ...metadata, lembrete: { ...lembrete, reserva } } })
      .eq("organization_id", org)
      .eq("id", m.id);
    if (error) throw new Error(`marcar reserva: ${error.message}`);
  };
  const ignorar = async (reserva: string) => {
    await marcar(reserva);
    resumo.ignorados += 1;
  };

  // Reivindica a mensagem ANTES de decidir: só segue quem afetou a linha.
  const { data: reivindicada, error: erroDaReivindicacao } = await admin
    .from("messages")
    .update({ metadata: { ...metadata, lembrete: { ...lembrete, reserva: "em_andamento" } } })
    .eq("organization_id", org)
    .eq("id", m.id)
    .is("metadata->lembrete->>reserva", null)
    .select("id");
  if (erroDaReivindicacao || !Array.isArray(reivindicada) || reivindicada.length === 0) {
    resumo.ignorados += 1;
    return;
  }

  try {
    const appointmentId = typeof lembrete.appointment_id === "string" ? lembrete.appointment_id : null;
    const { data: compromisso } = appointmentId
      ? await admin
          .from("calendar_appointments")
          .select("id, starts_at, status, reminder_sent_offsets_minutes, reminder_tentativas")
          .eq("organization_id", org)
          .eq("id", appointmentId)
          .maybeSingle()
      : { data: null };
    const ap = compromisso as {
      id: string;
      starts_at: string;
      status: string;
      reminder_sent_offsets_minutes: number[] | null;
      reminder_tentativas: Record<string, number> | null;
    } | null;

    if (
      !ap ||
      new Date(ap.starts_at).getTime() <= agora.getTime() ||
      (ap.status !== "pending" && ap.status !== "confirmed")
    ) {
      return await ignorar("consulta_passou");
    }

    const desfecho = classificarEnvio("meta_cloud", {
      status: "failed",
      error_code: m.error_code,
      error_message: m.error_message,
    });
    if (desfecho !== "nao_saiu") return await ignorar("ambiguo");

    const tentativa = typeof lembrete.tentativa === "number" ? lembrete.tentativa : 1;
    if (tentativa >= MAX_TENTATIVAS_DO_LEMBRETE) return await ignorar("esgotado");

    const { data: contato } = await admin
      .from("contacts")
      .select("id, is_blocked")
      .eq("organization_id", org)
      .eq("id", m.contact_id)
      .maybeSingle();
    if ((contato as { is_blocked?: boolean } | null)?.is_blocked) return await ignorar("bloqueado");

    if (!m.body?.trim()) {
      await marcar("sem_reserva");
      resumo.semReserva += 1;
      return;
    }

    const degraus = Array.isArray(lembrete.degraus)
      ? (lembrete.degraus as unknown[]).filter((d): d is number => typeof d === "number")
      : [];
    const proxima = tentativa + 1;

    const r = await enviarLembreteComReserva(admin, {
      org,
      appointmentId: ap.id,
      contatoId: m.contact_id,
      degraus,
      textoLivre: m.body,
      pecasDoModelo: {},
      modeloDoTipoId: null,
      excluirCanalIds: metaIds,
      tentativa: proxima,
    });

    if (r.desfecho === "nao_saiu" && r.motivo === "fora_do_horario") {
      // Ruling 16: devolve a reivindicação e não grava selo; a próxima varredura
      // tenta de novo quando o horário do QR abrir (dentro dos 2 dias).
      await marcar(null);
      resumo.ignorados += 1;
      return;
    }

    if (r.desfecho === "enviado") {
      // O pedido de confirmação aberto passa a olhar a mensagem nova (9006).
      // ANTES de marcar feita: se falhar, cai no catch (ambíguo), nunca reenvia.
      const { error: erroDoPedido } = await admin
        .from("clinic_confirmation_requests")
        .update({ reminder_message_id: r.mensagemId })
        .eq("organization_id", org)
        .eq("appointment_id", ap.id)
        .eq("reminder_message_id", m.id)
        .eq("status", "aguardando");
      if (erroDoPedido) throw new Error(`repontar pedido: ${erroDoPedido.message}`);
    }

    await marcar(r.desfecho === "nao_saiu" ? "sem_reserva" : "feita");
    await gravarDesfechoNoCompromisso(
      admin,
      {
        org,
        appointmentId: ap.id,
        degraus,
        jaEnviados: ap.reminder_sent_offsets_minutes,
        tentativas: ap.reminder_tentativas,
        tentativa: proxima,
      },
      r,
    );

    if (r.desfecho === "enviado") {
      resumo.reenviados += 1;
    } else if (r.desfecho === "nao_saiu") {
      resumo.semReserva += 1;
    } else {
      resumo.ignorados += 1;
    }
  } catch {
    // Não sabemos se saiu: nunca reenvia. Fecha como ambíguo para a 9006 abrir a tarefa.
    resumo.ignorados += 1;
    await marcar("ambiguo").catch(() => undefined);
  }
}
