/**
 * FORK clinic (prontuário F4) — leitura dos planos de tratamento de um paciente,
 * com as sessões. Client da SESSÃO: a RLS (9021) só devolve linha a quem tem
 * `planos.ver`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type StatusDoPlano = "rascunho" | "ativo" | "pausado" | "concluido" | "cancelado";
export type StatusDaSessao = "planejada" | "agendada" | "realizada" | "cancelada";

export interface SessaoLida {
  id: string;
  numero: number;
  descricao: string;
  previsao: string | null;
  status: StatusDaSessao;
  appointment_id: string | null;
  agendamento_em: string | null;
  atendimento_id: string | null;
  realizada_em: string | null;
  cancelada_motivo: string | null;
  servico: string | null;
}

export interface PlanoLido {
  id: string;
  titulo: string;
  objetivo: string | null;
  observacoes: string | null;
  inicio: string | null;
  previsao_fim: string | null;
  status: StatusDoPlano;
  versao: number;
  atendimento_origem_id: string | null;
  criado_em: string;
  sessoes: SessaoLida[];
}

type Um<T> = T | T[] | null;
const primeiro = <T>(v: Um<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** Conta por status — o "3 de 6 realizadas" do cartão do plano. */
export function progressoDoPlano(sessoes: readonly Pick<SessaoLida, "status">[]) {
  const validas = sessoes.filter((s) => s.status !== "cancelada");
  return {
    total: validas.length,
    realizadas: validas.filter((s) => s.status === "realizada").length,
    agendadas: validas.filter((s) => s.status === "agendada").length,
    planejadas: validas.filter((s) => s.status === "planejada").length,
  };
}

export async function planosDoPaciente(supabase: SupabaseClient, org: string, contactId: string): Promise<PlanoLido[]> {
  const { data, error } = await supabase
    .from("clinic_planos_tratamento")
    .select(
      "id, titulo, objetivo, observacoes, inicio, previsao_fim, status, versao, atendimento_origem_id, created_at, " +
        "clinic_plano_sessoes(id, numero, descricao, previsao, status, appointment_id, atendimento_id, realizada_em, cancelada_motivo, " +
        "calendar_appointments(starts_at), calendar_event_types(name))",
    )
    .eq("organization_id", org)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((p) => ({
    id: p.id as string,
    titulo: p.titulo as string,
    objetivo: (p.objetivo as string | null) ?? null,
    observacoes: (p.observacoes as string | null) ?? null,
    inicio: (p.inicio as string | null) ?? null,
    previsao_fim: (p.previsao_fim as string | null) ?? null,
    status: p.status as StatusDoPlano,
    versao: p.versao as number,
    atendimento_origem_id: (p.atendimento_origem_id as string | null) ?? null,
    criado_em: p.created_at as string,
    sessoes: ((p.clinic_plano_sessoes as Array<Record<string, unknown>> | null) ?? [])
      .map((s) => ({
        id: s.id as string,
        numero: s.numero as number,
        descricao: s.descricao as string,
        previsao: (s.previsao as string | null) ?? null,
        status: s.status as StatusDaSessao,
        appointment_id: (s.appointment_id as string | null) ?? null,
        agendamento_em: primeiro(s.calendar_appointments as Um<{ starts_at: string }>)?.starts_at ?? null,
        atendimento_id: (s.atendimento_id as string | null) ?? null,
        realizada_em: (s.realizada_em as string | null) ?? null,
        cancelada_motivo: (s.cancelada_motivo as string | null) ?? null,
        servico: primeiro(s.calendar_event_types as Um<{ name: string }>)?.name ?? null,
      }))
      .sort((a, b) => a.numero - b.numero),
  }));
}
