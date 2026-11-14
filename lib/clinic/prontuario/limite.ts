/**
 * FORK clinic (prontuário F8) — limite de leituras clínicas por pessoa.
 *
 * Quem atende abre dezenas de registros por hora; ler centenas em minutos é
 * raspagem. O limite é por USUÁRIO (não por empresa): uma conta comprometida
 * não esvazia o prontuário da clínica de uma vez. Redis quando há; memória
 * quando não (lib/ai/dispatcher/rate-limit.ts).
 */
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";

export const LEITURAS_POR_JANELA = 300;
export const JANELA_SEGUNDOS = 600;

export async function leituraClinicaPermitida(userId: string, recurso: string): Promise<boolean> {
  const r = await checkRateLimit(`clinic-leitura:${recurso}:${userId}`, LEITURAS_POR_JANELA, JANELA_SEGUNDOS);
  return r.allowed;
}
