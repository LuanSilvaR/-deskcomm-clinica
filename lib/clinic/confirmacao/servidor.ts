/**
 * Confirmação de consulta (fork clinic, migration 9004) — o lado do servidor.
 *
 * Três momentos, três funções:
 *   - o lembrete da véspera SAI com o pedido de SIM/NÃO (`deveAnexarPedido` +
 *     `registrarPedido`, chamadas pelo cron `agenda-reminder`);
 *   - a resposta do paciente CHEGA (`aplicarResposta`, chamada pelo consumidor
 *     de `message.received`);
 *   - a resposta NÃO chega até 4 h antes (`marcarSemResposta`, chamada pelo cron
 *     `clinic-confirmacao-sem-resposta`).
 *
 * Todas recebem o cliente admin (worker/cron) e filtram `organization_id` que
 * veio de fonte confiável — a linha do agendamento ou o evento do dispatcher —,
 * nunca de entrada externa.
 *
 * O lembrete só sai para agendamento `confirmed` (regra do núcleo), então o SIM
 * não muda o status do agendamento: ele registra que o PACIENTE confirmou e
 * fecha a tarefa de ligação, se houver. O NÃO abre a tarefa de remarcar; quem
 * cancela e remarca é a recepção, falando com o paciente.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ANTECEDENCIA_MINIMA_DO_PEDIDO_MIN,
  LIGAR_QUANDO_FALTAR_MIN,
  interpretarResposta,
  type RespostaDeConfirmacao,
} from "./resposta";
import type { StatusDaConfirmacao } from "./status";

type Admin = SupabaseClient;

/** `organizations.settings.clinic.confirmacao_automatica === true`. Nasce desligada. */
export function confirmacaoAutomaticaLigada(settings: unknown): boolean {
  if (!settings || typeof settings !== "object") return false;
  const clinic = (settings as Record<string, unknown>).clinic;
  if (!clinic || typeof clinic !== "object") return false;
  return (clinic as Record<string, unknown>).confirmacao_automatica === true;
}

/** Algum dos degraus vencidos é o da véspera (12 h ou mais)? */
export function degrauPedeConfirmacao(degraus: readonly number[]): boolean {
  return degraus.some((d) => d >= ANTECEDENCIA_MINIMA_DO_PEDIDO_MIN);
}

/**
 * O lembrete desta rodada leva o pedido de SIM/NÃO?
 *
 * Não leva quando o paciente já respondeu — dois degraus longos (48 h e 24 h)
 * não pedem de novo a quem já disse SIM.
 */
export async function deveAnexarPedido(
  admin: Admin,
  args: { organizationId: string; appointmentId: string; settings: unknown; degraus: readonly number[] },
): Promise<boolean> {
  if (!confirmacaoAutomaticaLigada(args.settings) || !degrauPedeConfirmacao(args.degraus)) return false;
  const { data } = await admin
    .from("clinic_confirmation_requests")
    .select("status")
    .eq("organization_id", args.organizationId)
    .eq("appointment_id", args.appointmentId)
    .maybeSingle();
  return !data || data.status === "aguardando";
}

/** Grava (ou renova) o pedido depois que o lembrete saiu. */
export async function registrarPedido(
  admin: Admin,
  args: {
    organizationId: string;
    appointmentId: string;
    contactId: string;
    conversationId: string | null;
    /** A mensagem do lembrete (9006): o cron confere se ela terminou `failed`. */
    reminderMessageId: string | null;
  },
): Promise<void> {
  const { error } = await admin.from("clinic_confirmation_requests").upsert(
    {
      organization_id: args.organizationId,
      appointment_id: args.appointmentId,
      contact_id: args.contactId,
      conversation_id: args.conversationId,
      reminder_message_id: args.reminderMessageId,
      falha: null,
      status: "aguardando",
      requested_at: new Date().toISOString(),
    },
    { onConflict: "appointment_id" },
  );
  if (error) throw new Error(`registrar pedido de confirmação: ${error.message}`);
}

interface PedidoAberto {
  id: string;
  appointment_id: string;
  task_id: string | null;
  status: StatusDaConfirmacao;
  calendar_appointments: AgendamentoDoPedido | AgendamentoDoPedido[] | null;
}

interface AgendamentoDoPedido {
  starts_at: string;
  status: string;
  title: string;
  owner_user_id: string | null;
  contact_id: string | null;
}

function agendamentoDe(p: PedidoAberto): AgendamentoDoPedido | null {
  const a = p.calendar_appointments;
  if (!a) return null;
  return Array.isArray(a) ? (a[0] ?? null) : a;
}

async function abrirTarefa(
  admin: Admin,
  args: {
    organizationId: string;
    titulo: string;
    descricao: string;
    prazo: string;
    contactId: string | null;
    responsavel: string | null;
  },
): Promise<string | null> {
  const { data, error } = await admin
    .from("crm_tasks")
    .insert({
      organization_id: args.organizationId,
      title: args.titulo,
      description: args.descricao,
      due_date: args.prazo,
      priority: "high",
      status: "pending",
      contact_id: args.contactId,
      assigned_to: args.responsavel,
    })
    .select("id")
    .single();
  if (error) throw new Error(`abrir tarefa da confirmação: ${error.message}`);
  return (data as { id: string }).id;
}

async function fecharTarefa(admin: Admin, organizationId: string, taskId: string | null): Promise<void> {
  if (!taskId) return;
  await admin
    .from("crm_tasks")
    .update({ status: "done" })
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .in("status", ["pending", "in_progress"]);
}

export interface ResultadoDaResposta {
  efeito: "sem_pedido" | "conversa" | "confirmado" | "recusado";
  appointmentId?: string;
}

/**
 * A mensagem que chegou responde um pedido aberto deste paciente?
 *
 * Só o pedido mais recente, ainda em aberto e de agendamento que não começou.
 * Texto que não é SIM/NÃO inequívoco é conversa — fica para a equipe (ou o
 * agente de IA), e o pedido segue aberto.
 */
export async function aplicarResposta(
  admin: Admin,
  args: { organizationId: string; contactId: string; messageId: string; recebidoEm: Date },
): Promise<ResultadoDaResposta> {
  const { data: pedidos, error } = await admin
    .from("clinic_confirmation_requests")
    .select("id, appointment_id, task_id, status, calendar_appointments!inner(starts_at, status, title, owner_user_id, contact_id)")
    .eq("organization_id", args.organizationId)
    .eq("contact_id", args.contactId)
    .in("status", ["aguardando", "sem_resposta"])
    .gt("calendar_appointments.starts_at", args.recebidoEm.toISOString())
    .order("requested_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`buscar pedido de confirmação: ${error.message}`);
  const pedido = (pedidos ?? [])[0] as PedidoAberto | undefined;
  if (!pedido) return { efeito: "sem_pedido" };

  const { data: mensagem } = await admin
    .from("messages")
    .select("body")
    .eq("id", args.messageId)
    .eq("organization_id", args.organizationId)
    .maybeSingle();
  const resposta: RespostaDeConfirmacao = interpretarResposta((mensagem as { body?: string | null } | null)?.body);
  if (!resposta) return { efeito: "conversa", appointmentId: pedido.appointment_id };

  const agendamento = agendamentoDe(pedido);
  const respondidoEm = args.recebidoEm.toISOString();

  if (resposta === "sim") {
    await fecharTarefa(admin, args.organizationId, pedido.task_id);
    await atualizarPedido(admin, args.organizationId, pedido, {
      status: "confirmado",
      answered_at: respondidoEm,
      answer_message_id: args.messageId,
    });
    return { efeito: "confirmado", appointmentId: pedido.appointment_id };
  }

  await fecharTarefa(admin, args.organizationId, pedido.task_id);
  const tarefa = await abrirTarefa(admin, {
    organizationId: args.organizationId,
    titulo: "Paciente pediu para remarcar",
    descricao: agendamento
      ? `Respondeu NÃO à confirmação de "${agendamento.title}". Fale com o paciente e remarque ou cancele o horário.`
      : "Respondeu NÃO à confirmação. Fale com o paciente e remarque ou cancele o horário.",
    prazo: respondidoEm,
    contactId: args.contactId,
    responsavel: null,
  });
  await atualizarPedido(admin, args.organizationId, pedido, {
    status: "recusado",
    answered_at: respondidoEm,
    answer_message_id: args.messageId,
    task_id: tarefa,
  });
  return { efeito: "recusado", appointmentId: pedido.appointment_id };
}

/** Só muda o pedido se ele ainda estiver no status que foi lido — duas respostas seguidas não brigam. */
async function atualizarPedido(
  admin: Admin,
  organizationId: string,
  pedido: PedidoAberto,
  campos: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin
    .from("clinic_confirmation_requests")
    .update(campos)
    .eq("id", pedido.id)
    .eq("organization_id", organizationId)
    .eq("status", pedido.status);
  if (error) throw new Error(`atualizar pedido de confirmação: ${error.message}`);
}

/**
 * Pedidos ainda sem resposta a 4 h da consulta viram tarefa "Ligar para
 * confirmar". Varre todas as organizações (é cron); cada tarefa nasce na
 * organização da própria linha.
 */
export async function marcarSemResposta(
  admin: Admin,
  agora: Date,
  limite = 200,
): Promise<{ marcados: number; falhas: number }> {
  const ate = new Date(agora.getTime() + LIGAR_QUANDO_FALTAR_MIN * 60_000).toISOString();
  const { data, error } = await admin
    .from("clinic_confirmation_requests")
    .select(
      "id, organization_id, contact_id, appointment_id, task_id, status, calendar_appointments!inner(starts_at, status, title, owner_user_id, contact_id)",
    )
    .eq("status", "aguardando")
    .in("calendar_appointments.status", ["pending", "confirmed"])
    .gt("calendar_appointments.starts_at", agora.toISOString())
    .lte("calendar_appointments.starts_at", ate)
    .limit(limite);
  if (error) throw new Error(`varrer pedidos sem resposta: ${error.message}`);

  let marcados = 0;
  let falhas = 0;
  for (const linha of (data ?? []) as (PedidoAberto & { organization_id: string; contact_id: string | null })[]) {
    const agendamento = agendamentoDe(linha);
    if (!agendamento) continue;
    try {
      const tarefa = await abrirTarefa(admin, {
        organizationId: linha.organization_id,
        titulo: "Ligar para confirmar a consulta",
        descricao: `O paciente não respondeu à confirmação de "${agendamento.title}". Ligue antes do horário.`,
        prazo: agendamento.starts_at,
        contactId: linha.contact_id,
        responsavel: null,
      });
      await atualizarPedido(admin, linha.organization_id, linha, { status: "sem_resposta", task_id: tarefa });
      marcados += 1;
    } catch {
      falhas += 1;
    }
  }
  return { marcados, falhas };
}

/** O tipo de atendimento pede confirmação? (algum degrau de lembrete de 12 h ou mais) */
export function tipoPedeConfirmacao(tipo: {
  reminder_enabled: boolean;
  reminder_minutes_before: number | null;
  reminder_extra_offsets_minutes: number[] | null;
}): boolean {
  if (!tipo.reminder_enabled) return false;
  return degrauPedeConfirmacao([tipo.reminder_minutes_before ?? 0, ...(tipo.reminder_extra_offsets_minutes ?? [])]);
}

/**
 * FORK clinic (9006) — o lembrete SAIU, mas a mensagem terminou `failed`. A
 * tarefa de ligar abre na hora: esperar as 4 h seria esperar uma resposta que
 * não pode chegar.
 */
export async function marcarLembretesQueFalharam(
  admin: Admin,
  agora: Date,
  limite = 200,
): Promise<{ marcados: number; falhas: number }> {
  const { data, error } = await admin
    .from("clinic_confirmation_requests")
    .select(
      "id, organization_id, contact_id, appointment_id, task_id, status, " +
        "mensagem:messages!clinic_confirmation_requests_reminder_message_id_fkey!inner(status), " +
        "calendar_appointments!inner(starts_at, status, title, owner_user_id, contact_id)",
    )
    .eq("status", "aguardando")
    .eq("mensagem.status", "failed")
    .in("calendar_appointments.status", ["pending", "confirmed"])
    .gt("calendar_appointments.starts_at", agora.toISOString())
    .limit(limite);
  if (error) throw new Error(`varrer lembretes que falharam: ${error.message}`);

  let marcados = 0;
  let falhas = 0;
  for (const linha of (data ?? []) as unknown as (PedidoAberto & { organization_id: string; contact_id: string | null })[]) {
    const agendamento = agendamentoDe(linha);
    if (!agendamento) continue;
    try {
      const tarefa = await abrirTarefa(admin, {
        organizationId: linha.organization_id,
        titulo: "O lembrete não chegou — ligar para confirmar",
        descricao: `O WhatsApp não entregou o lembrete de "${agendamento.title}". Ligue para o paciente e confirme a consulta.`,
        prazo: agendamento.starts_at,
        contactId: linha.contact_id,
        responsavel: null,
      });
      await atualizarPedido(admin, linha.organization_id, linha, {
        status: "sem_resposta",
        falha: "envio_falhou",
        task_id: tarefa,
      });
      marcados += 1;
    } catch {
      falhas += 1;
    }
  }
  return { marcados, falhas };
}

interface TipoDoLembrete {
  reminder_enabled: boolean;
  reminder_minutes_before: number | null;
  reminder_extra_offsets_minutes: number[] | null;
}

interface AgendamentoSemPedido {
  id: string;
  title: string;
  starts_at: string;
  contact_id: string;
  calendar_event_types: TipoDoLembrete | TipoDoLembrete[] | null;
}

/** Folga para o cron do lembrete (a cada 5 min) alcançar compromisso recém-marcado. */
const FOLGA_DO_LEMBRETE_MIN = 30;

/**
 * FORK clinic (9006) — o lembrete NEM SAIU (canal desconectado, paciente sem
 * telefone ou bloqueado) e a consulta está a 4 h. Sem isto, a 9004 ficava muda:
 * o cron de "sem resposta" só olha pedido que existe, e o pedido só nasce quando
 * o lembrete sai. Cria o pedido já em `sem_resposta`, com a tarefa de ligar.
 *
 * Só organizações com a confirmação ligada, só tipos que pedem confirmação
 * (degrau de 12 h ou mais) e só compromisso marcado há mais de 30 min.
 */
export async function marcarLembretesQueNaoSairam(
  admin: Admin,
  agora: Date,
  limite = 200,
): Promise<{ marcados: number; falhas: number }> {
  const { data: orgs, error: e1 } = await admin
    .from("organizations")
    .select("id")
    .eq("settings->clinic->>confirmacao_automatica", "true")
    .limit(500);
  if (e1) throw new Error(`listar organizações com confirmação: ${e1.message}`);

  const ate = new Date(agora.getTime() + LIGAR_QUANDO_FALTAR_MIN * 60_000).toISOString();
  const marcadoAntesDe = new Date(agora.getTime() - FOLGA_DO_LEMBRETE_MIN * 60_000).toISOString();
  let marcados = 0;
  let falhas = 0;

  for (const { id: org } of (orgs ?? []) as { id: string }[]) {
    const { data: ags, error: e2 } = await admin
      .from("calendar_appointments")
      .select(
        "id, title, starts_at, contact_id, calendar_event_types!inner(reminder_enabled, reminder_minutes_before, reminder_extra_offsets_minutes)",
      )
      .eq("organization_id", org)
      .eq("status", "confirmed")
      .not("contact_id", "is", null)
      .eq("calendar_event_types.reminder_enabled", true)
      .gt("starts_at", agora.toISOString())
      .lte("starts_at", ate)
      .lt("created_at", marcadoAntesDe)
      .limit(limite);
    if (e2) {
      falhas += 1;
      continue;
    }
    const candidatos = ((ags ?? []) as unknown as AgendamentoSemPedido[]).filter((a) => {
      const t = Array.isArray(a.calendar_event_types) ? a.calendar_event_types[0] : a.calendar_event_types;
      return !!t && tipoPedeConfirmacao(t);
    });
    if (candidatos.length === 0) continue;

    const { data: existentes } = await admin
      .from("clinic_confirmation_requests")
      .select("appointment_id")
      .eq("organization_id", org)
      .in(
        "appointment_id",
        candidatos.map((a) => a.id),
      );
    const comPedido = new Set(((existentes ?? []) as { appointment_id: string }[]).map((e) => e.appointment_id));

    for (const a of candidatos.filter((c) => !comPedido.has(c.id))) {
      try {
        const tarefa = await abrirTarefa(admin, {
          organizationId: org,
          titulo: "O lembrete não saiu — ligar para confirmar",
          descricao: `O lembrete de "${a.title}" não foi enviado (WhatsApp desconectado, paciente sem telefone ou bloqueado). Ligue para o paciente e confirme a consulta.`,
          prazo: a.starts_at,
          contactId: a.contact_id,
          responsavel: null,
        });
        const { error: e3 } = await admin.from("clinic_confirmation_requests").insert({
          organization_id: org,
          appointment_id: a.id,
          contact_id: a.contact_id,
          status: "sem_resposta",
          falha: "nao_enviado",
          task_id: tarefa,
        });
        if (e3) throw new Error(e3.message);
        marcados += 1;
      } catch {
        falhas += 1;
      }
    }
  }
  return { marcados, falhas };
}

export interface ResultadoDaVarredura {
  sem_resposta: number;
  envio_falhou: number;
  nao_enviado: number;
  falhas: number;
}

/** A rodada do cron `clinic-confirmacao-sem-resposta`: os três casos que pedem ligação. */
export async function varrerConfirmacoes(admin: Admin, agora: Date): Promise<ResultadoDaVarredura> {
  // A falha de envio primeiro: o pedido dela sai de `aguardando` e não é
  // contado de novo como "sem resposta" na mesma rodada.
  const falhou = await marcarLembretesQueFalharam(admin, agora);
  const semResposta = await marcarSemResposta(admin, agora);
  const naoSaiu = await marcarLembretesQueNaoSairam(admin, agora);
  return {
    sem_resposta: semResposta.marcados,
    envio_falhou: falhou.marcados,
    nao_enviado: naoSaiu.marcados,
    falhas: falhou.falhas + semResposta.falhas + naoSaiu.falhas,
  };
}
