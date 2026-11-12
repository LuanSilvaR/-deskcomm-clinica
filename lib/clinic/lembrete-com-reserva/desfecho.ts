import type { SupabaseClient } from "@supabase/supabase-js";

import { MAX_TENTATIVAS_DO_LEMBRETE } from "./regra";
import type { ResultadoDoLembrete } from "./enviar";

/**
 * Traduz o desfecho do envio com reserva (#83) nos campos do compromisso.
 * Fica num lugar só porque o cron do lembrete e a varredura da reserva depois
 * da falha da Meta precisam do mesmo mapeamento.
 */
export interface EntradaDoDesfecho {
  org: string;
  appointmentId: string;
  /** Os degraus que este envio cobria. */
  degraus: number[];
  jaEnviados: number[] | null;
  tentativas: Record<string, number> | null;
  /** A tentativa que acabou de rodar (1..3). */
  tentativa: number;
}

export type ResultadoGravado = { resultado: "enviado" } | { resultado: "pulado"; motivo: string };

export async function gravarDesfechoNoCompromisso(
  admin: SupabaseClient,
  e: EntradaDoDesfecho,
  r: ResultadoDoLembrete,
): Promise<ResultadoGravado> {
  const agora = () => new Date().toISOString();
  const carimbo = () => ({
    reminder_sent_at: agora(),
    reminder_sent_offsets_minutes: [...new Set([...(e.jaEnviados ?? []), ...e.degraus])],
  });
  const gravar = (campos: Record<string, unknown>) =>
    admin.from("calendar_appointments").update(campos).eq("id", e.appointmentId).eq("organization_id", e.org);

  if (r.desfecho === "enviado") {
    await gravar({ ...carimbo(), reminder_falha: null, reminder_falha_at: null });
    return { resultado: "enviado" };
  }

  if (r.desfecho === "ambiguo") {
    // Pode ter saído: carimba para nunca reenviar e deixa o selo para a tela.
    await gravar({ ...carimbo(), reminder_falha: "envio_nao_confirmado", reminder_falha_at: agora() });
    return { resultado: "pulado", motivo: "envio_nao_confirmado" };
  }

  if (r.motivo === "fora_do_horario") {
    // Adiamento: não carimba e não gasta tentativa; só deixa o selo.
    await gravar({ reminder_falha: "fora_do_horario", reminder_falha_at: agora() });
    return { resultado: "pulado", motivo: "fora_da_janela" };
  }

  const contadas = { ...(e.tentativas ?? {}) };
  for (const d of e.degraus) contadas[String(d)] = e.tentativa;
  if (e.tentativa >= MAX_TENTATIVAS_DO_LEMBRETE) {
    // A 9006 (`marcarLembretesQueNaoSairam`) abre a tarefa "ligar" no prazo dela.
    await gravar({
      ...carimbo(),
      reminder_tentativas: contadas,
      reminder_falha: "erro_apos_tentativas",
      reminder_falha_at: agora(),
    });
  } else {
    await gravar({ reminder_tentativas: contadas, reminder_falha: r.motivo, reminder_falha_at: agora() });
  }
  return { resultado: "pulado", motivo: "erro_no_envio" };
}
