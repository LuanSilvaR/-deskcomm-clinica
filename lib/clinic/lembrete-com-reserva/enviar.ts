import type { SupabaseClient } from "@supabase/supabase-js";

import { sendMessageHandler } from "@/app/api/v1/messages/_handler";
import { capabilitiesOf } from "@/lib/channels";
import { isWindowOpen } from "@/lib/agent-engine/guardrails/messaging-window";
import { lerModeloDoLembrete, valoresDoModeloDoLembrete } from "@/lib/agenda/lembrete-por-modelo";
import { adiarAteAJanelaAbrir } from "@/lib/automation/janela-do-canal";
import { ensureConversation } from "@/lib/automation/start-conversation";
import { espacarEnvio } from "@/lib/automation/throttle";

import {
  classificarEnvio,
  decidirPasso,
  ordenarCaminhos,
  type CanalCandidato,
  type FalhaDoLembreteComReserva,
  type ProviderDoLembrete,
} from "./regra";

/**
 * Envio do lembrete com reserva (#83): tenta cada caminho na ordem da regra
 * (canal oficial, depois QR) e só passa ao próximo quando o anterior GARANTIU que não
 * saiu. Erro ambíguo para na hora: nunca reenvia. Não grava em
 * `calendar_appointments` (o carimbo é do cron) e não lê configuração da org.
 */
export interface EntradaDoLembrete {
  org: string;
  appointmentId: string;
  contatoId: string;
  /** Os degraus pendentes desta rodada. */
  degraus: number[];
  /** Corpo já montado (com o pedido SIM/NÃO quando for o caso). */
  textoLivre: string;
  /** primeiro_nome, quando, titulo, endereco. */
  pecasDoModelo: Record<string, string>;
  modeloDoTipoId: string | null;
  /** Usado pela reserva para não voltar à Meta. */
  excluirCanalIds?: string[];
  /** 1..3 */
  tentativa: number;
}

export type ResultadoDoLembrete =
  | { desfecho: "enviado"; canalId: string; provider: ProviderDoLembrete; mensagemId: string; via: "texto" | "modelo" }
  | { desfecho: "ambiguo"; canalId: string; mensagemId: string | null }
  | { desfecho: "nao_saiu"; motivo: FalhaDoLembreteComReserva };

type Mensagem = { id: string; status: string; error_code: string | null; error_message?: string | null };

/** Janela de 24h pela conversa que JÁ existe; sem conversa, fechada. Nunca cria. */
async function janelaDoContatoAberta(
  admin: SupabaseClient,
  org: string,
  contatoId: string,
  canalId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("conversations")
    .select("last_inbound_at")
    .eq("organization_id", org)
    .eq("contact_id", contatoId)
    .eq("channel_session_id", canalId)
    .order("last_inbound_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const ultima = (data as { last_inbound_at: string | null } | null)?.last_inbound_at;
  return isWindowOpen(new Date(), ultima ? new Date(ultima) : null);
}

export async function enviarLembreteComReserva(
  admin: SupabaseClient,
  e: EntradaDoLembrete,
): Promise<ResultadoDoLembrete> {
  const { data: linhas } = await admin
    .from("channel_sessions")
    .select("id, provider, status, archived_at, metadata, created_at")
    .eq("organization_id", e.org)
    .eq("status", "WORKING");

  const excluidos = new Set(e.excluirCanalIds ?? []);
  const caminhos = ordenarCaminhos((linhas ?? []) as CanalCandidato[]).filter((c) => !excluidos.has(c.id));
  if (caminhos.length === 0) return { desfecho: "nao_saiu", motivo: "sem_caminho" };

  let pulosPorHorario = 0;
  let tentouEFalhou = 0;

  for (const canal of caminhos) {
    const foraDoHorario = (await adiarAteAJanelaAbrir(admin, e.org, canal.id)) !== null;

    let janelaAberta = false;
    let modeloDoCanalId: string | null = null;
    let modelo: Awaited<ReturnType<typeof lerModeloDoLembrete>> = null;
    if (!foraDoHorario && capabilitiesOf(canal.provider).requiresTemplates) {
      janelaAberta = await janelaDoContatoAberta(admin, e.org, e.contatoId, canal.id);
      if (!janelaAberta && e.modeloDoTipoId) {
        modelo = await lerModeloDoLembrete(admin, e.org, e.modeloDoTipoId, canal.id);
        modeloDoCanalId = modelo ? e.modeloDoTipoId : null;
      }
    }

    let passo = decidirPasso({ provider: canal.provider, foraDoHorario, janelaAberta, modeloDoCanalId });
    let corpoDoModelo: ReturnType<typeof valoresDoModeloDoLembrete> = null;
    if (passo.tipo === "modelo" && modelo) {
      corpoDoModelo = valoresDoModeloDoLembrete(modelo, e.pecasDoModelo);
      // Peça obrigatória vazia: a Meta recusaria o parâmetro vazio.
      if (!corpoDoModelo) passo = { tipo: "pular", motivo: "meta_sem_modelo" };
    }

    if (passo.tipo === "pular") {
      if (passo.motivo === "fora_do_horario") pulosPorHorario += 1;
      continue;
    }

    await espacarEnvio(canal.id);

    let conversaId: string;
    try {
      conversaId = await ensureConversation(admin, e.org, e.contatoId, canal.id);
    } catch {
      // Sem conversa nada foi enviado: conta como tentativa que falhou e segue.
      tentouEFalhou += 1;
      continue;
    }

    let mensagem: Mensagem;
    try {
      const metadata = {
        lembrete: { appointment_id: e.appointmentId, degraus: e.degraus, tentativa: e.tentativa, reserva: null },
      };
      const entrada =
        passo.tipo === "modelo" && modelo && corpoDoModelo
          ? {
              conversation_id: conversaId,
              type: "template",
              template_name: modelo.name,
              template_language: modelo.language,
              template_values: corpoDoModelo.valores,
              body: corpoDoModelo.texto,
              metadata,
            }
          : { conversation_id: conversaId, type: "text", body: e.textoLivre, metadata };
      mensagem = (await sendMessageHandler(
        admin,
        {
          organization_id: e.org,
          actor: { type: "webhook_source", id: e.appointmentId },
          requestId: `agenda-reminder:${e.appointmentId}:${canal.id}`,
        } as Parameters<typeof sendMessageHandler>[1],
        entrada as Parameters<typeof sendMessageHandler>[2],
      )) as unknown as Mensagem;
    } catch {
      // Exceção não prova que não saiu: para aqui, nunca tenta o próximo caminho.
      return { desfecho: "ambiguo", canalId: canal.id, mensagemId: null };
    }

    const desfecho = classificarEnvio(canal.provider, {
      status: mensagem.status,
      error_code: mensagem.error_code,
      error_message: mensagem.error_message ?? null,
    });
    if (desfecho === "enviado") {
      return {
        desfecho: "enviado",
        canalId: canal.id,
        provider: canal.provider,
        mensagemId: mensagem.id,
        via: passo.tipo === "modelo" ? "modelo" : "texto",
      };
    }
    if (desfecho === "ambiguo") return { desfecho: "ambiguo", canalId: canal.id, mensagemId: mensagem.id };
    // nao_saiu: segue para o próximo caminho.
    tentouEFalhou += 1;
  }

  // Só quem tentou e recebeu nao_saiu gasta tentativa; pulos não gastam.
  if (tentouEFalhou > 0) return { desfecho: "nao_saiu", motivo: "erro_apos_tentativas" };
  if (pulosPorHorario > 0) return { desfecho: "nao_saiu", motivo: "fora_do_horario" };
  return { desfecho: "nao_saiu", motivo: "meta_sem_modelo" };
}
