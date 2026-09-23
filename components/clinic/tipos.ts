/** Formas que as telas do módulo clinic recebem das rotas `/api/v1/clinic/*`. */

export interface Especialidade {
  id: string;
  name: string;
  color: string | null;
  is_active: boolean;
}

export interface Profissional {
  id: string;
  user_id: string;
  display_name: string | null;
  council: string | null;
  council_number: string | null;
  council_uf: string | null;
  is_active: boolean;
  specialty_ids: string[];
}

export interface BloqueioDeAgenda {
  id: string;
  user_id: string | null;
  starts_on: string;
  ends_on: string;
  start_minute: number;
  end_minute: number;
  weekdays: number[] | null;
  reason: string | null;
}

export interface TipoDeAtendimento {
  id: string;
  name: string;
  is_active: boolean;
}

export const CONSELHOS = ["CRM", "CRO", "COREN", "CRBM", "CFF", "CREFITO", "outro"] as const;

export const DIAS_DA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export function emMinutos(hhmm: string): number {
  const [h = "0", m = "0"] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

export function emHora(minutos: number): string {
  if (minutos >= 1440) return "24:00";
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

/** "2026-10-05" → "05/10/2026", sem passar por Date (sem fuso). */
export function dataBr(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}
