/**
 * Regra pura dos caminhos do lembrete com reserva (#83). Sem banco, sem rede.
 * Os módulos de envio importam daqui o que decidir, e só executam.
 */

export const MAX_TENTATIVAS_DO_LEMBRETE = 3;

import { capabilitiesOf } from "@/lib/channels";
import { envioRecusadoComCerteza } from "@/lib/channels/envio-recusado";
import { PROVIDERS_DO_LEMBRETE } from "@/lib/channels/lembrete";
import type { ChannelProvider } from "@/lib/channels/types";

export { PROVIDERS_DO_LEMBRETE };
export type ProviderDoLembrete = ChannelProvider;

export interface CanalCandidato {
  id: string;
  provider: string | null;
  status: string;
  archived_at: string | null;
  metadata: { disabled?: boolean } | null;
  created_at: string;
}

/** Mesmo vocabulário do CHECK de `calendar_appointments.reminder_falha`. */
export type FalhaDoLembreteComReserva =
  | "sem_caminho"
  | "fora_do_horario"
  | "meta_sem_modelo"
  | "erro_apos_tentativas"
  | "envio_nao_confirmado";

export type Passo =
  | { tipo: "texto" }
  | { tipo: "modelo"; modeloId: string }
  | { tipo: "pular"; motivo: "fora_do_horario" | "meta_sem_modelo" };

export type DesfechoDoEnvio = "enviado" | "nao_saiu" | "ambiguo";

/** Canal oficial primeiro, depois o de reserva; dentro do provider, `created_at` crescente. */
export function ordenarCaminhos(canais: CanalCandidato[]): (CanalCandidato & { provider: ProviderDoLembrete })[] {
  const ranque = (p: ProviderDoLembrete) => PROVIDERS_DO_LEMBRETE.indexOf(p);
  const elegiveis = canais.filter(
    (c): c is CanalCandidato & { provider: ProviderDoLembrete } =>
      (PROVIDERS_DO_LEMBRETE as readonly (string | null)[]).includes(c.provider) &&
      c.status === "WORKING" &&
      c.archived_at === null &&
      c.metadata?.disabled !== true,
  );
  return [...elegiveis].sort(
    (a, b) => ranque(a.provider) - ranque(b.provider) || a.created_at.localeCompare(b.created_at),
  );
}

export function decidirPasso(i: {
  provider: ProviderDoLembrete;
  foraDoHorario: boolean;
  janelaAberta: boolean;
  modeloDoCanalId: string | null;
}): Passo {
  if (i.foraDoHorario) return { tipo: "pular", motivo: "fora_do_horario" };
  if (capabilitiesOf(i.provider).freeformOutsideWindow) return { tipo: "texto" };
  if (i.janelaAberta) return { tipo: "texto" };
  if (i.modeloDoCanalId) return { tipo: "modelo", modeloId: i.modeloDoCanalId };
  return { tipo: "pular", motivo: "meta_sem_modelo" };
}

export function classificarEnvio(
  provider: ProviderDoLembrete,
  m: { status: string; error_code: string | null; error_message?: string | null } | { excecao: true },
): DesfechoDoEnvio {
  if ("excecao" in m) return "ambiguo";
  if (m.status === "sent" || m.status === "delivered" || m.status === "read") return "enviado";
  if (m.status === "failed" && envioRecusadoComCerteza(provider, m)) return "nao_saiu";
  return "ambiguo";
}

/** `organizations.settings.clinic.lembrete_com_reserva === true`. Nasce desligada. */
export function lembreteComReservaLigado(settings: unknown): boolean {
  if (!settings || typeof settings !== "object") return false;
  const clinic = (settings as Record<string, unknown>).clinic;
  if (!clinic || typeof clinic !== "object") return false;
  return (clinic as Record<string, unknown>).lembrete_com_reserva === true;
}

/**
 * Quantas tentativas o lembrete já gastou: o maior contador de
 * `calendar_appointments.reminder_tentativas` (jsonb `{ "<degrau>": n }`).
 */
export function tentativasGastasDoLembrete(tentativas: unknown): number {
  if (!tentativas || typeof tentativas !== "object") return 0;
  let maior = 0;
  for (const v of Object.values(tentativas as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && v > maior) maior = v;
  }
  return maior;
}
