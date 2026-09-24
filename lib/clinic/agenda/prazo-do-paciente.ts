/**
 * FORK clinic (migration 9008, épico E5.2) — prazo mínimo para o paciente
 * desmarcar ou remarcar pelo WhatsApp.
 *
 * Dentro de `settings.clinic.prazo_paciente_horas` antes da consulta, o agente
 * de IA não cancela nem remarca: recebe `agenda_fora_do_prazo` e avisa o
 * paciente que a recepção vai falar com ele (lib/mcp/tools/agendamento.ts,
 * ENSINO_POR_CODIGO). Só o ator `ai_agent` — a equipe, pela tela, continua
 * podendo tudo: quem decide abrir exceção é uma pessoa.
 *
 * Chamada pelo handler de agendamentos (núcleo) ao cancelar e ao remarcar.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { HandlerCtx } from "@/lib/api/handlers/types";
import { ApiError } from "@/lib/api/types";

/** 0 = sem prazo (como nasce). Só inteiro de 1 a 168 liga. */
export function prazoDoPacienteHoras(settings: unknown): number {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return 0;
  const clinic = (settings as Record<string, unknown>).clinic;
  if (!clinic || typeof clinic !== "object" || Array.isArray(clinic)) return 0;
  const h = (clinic as Record<string, unknown>).prazo_paciente_horas;
  return typeof h === "number" && Number.isInteger(h) && h > 0 && h <= 168 ? h : 0;
}

/** Está dentro do prazo? (compromisso que já começou também está) */
export function dentroDoPrazo(inicio: Date, agora: Date, horas: number): boolean {
  if (horas <= 0) return false;
  return inicio.getTime() - agora.getTime() < horas * 3_600_000;
}

export async function exigePrazoDoPaciente(
  supabase: SupabaseClient,
  ctx: HandlerCtx,
  inicioDoCompromisso: string | null | undefined,
  agora: Date = new Date(),
): Promise<void> {
  if (ctx.actor.type !== "ai_agent" || !inicioDoCompromisso) return;
  const { data } = await supabase.from("organizations").select("settings").eq("id", ctx.organization_id).maybeSingle();
  const horas = prazoDoPacienteHoras((data as { settings?: unknown } | null)?.settings);
  if (!dentroDoPrazo(new Date(inicioDoCompromisso), agora, horas)) return;
  throw new ApiError(
    422,
    "agenda_fora_do_prazo",
    { prazo_horas: horas },
    ctx.requestId,
    `Pelo atendimento automático só é possível desmarcar ou remarcar até ${horas} h antes. A recepção precisa tratar este pedido.`,
  );
}
