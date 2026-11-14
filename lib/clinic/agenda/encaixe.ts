/**
 * FORK clinic (agenda S6b, issue #69) — o encaixe: marcar POR CIMA de outro compromisso do
 * mesmo profissional, de forma autorizada, com motivo e rastro (migration 9045).
 *
 * Este módulo é a conferência do lado do código; quem grava é `fn_clinic_agenda_encaixar`
 * (uma transação, com o ator da SESSÃO). Aqui ficam as recusas com mensagem boa e o 409 de D2.
 *
 * Limite conhecido: a jornada é conferida pela publicada em `attendant_availability`
 * (`jornadaNoDia`); as regras de oferta da grade (aviso mínimo, intervalo) não valem no encaixe.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { diaLocalISO, partesNoFuso } from "@/lib/agenda/fuso";
import type { HandlerCtx } from "@/lib/api/handlers/types";
import { ApiError } from "@/lib/api/types";
import { permissoesEfetivas } from "@/lib/clinic/acesso/resolver";
import { nomeDoContato } from "@/lib/contacts/rotulo-do-contato";

import {
  bloqueiosNoDia,
  jornadaNoDia,
  type BloqueioComMotivo,
  type Disponibilidade,
  type ExcecaoDoNucleo,
} from "./dia-por-profissional";

export const CHAVE_DO_ENCAIXE = "agenda.encaixe";

export interface ConflitoDoHorario {
  id: string;
  paciente: string | null;
  inicio: string;
  fim: string;
  status: string;
}

interface Janela {
  organizationId: string;
  ownerUserId: string;
  inicio: Date;
  fim: Date;
}

/** `settings.clinic.encaixe === true` — a flag nasce desligada. */
export function encaixeLigado(settings: unknown): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return false;
  const clinic = (settings as Record<string, unknown>).clinic;
  if (!clinic || typeof clinic !== "object" || Array.isArray(clinic)) return false;
  return (clinic as Record<string, unknown>).encaixe === true;
}

export async function encaixeLigadoNaOrg(supabase: SupabaseClient, organizationId: string): Promise<boolean> {
  const { data } = await supabase.from("organizations").select("settings").eq("id", organizationId).maybeSingle();
  return encaixeLigado((data as { settings?: unknown } | null)?.settings);
}

type ContatoEmbutido = { name: string | null; display_name: string | null };

/** Compromissos ativos do mesmo profissional que cruzam a janela (encostar não é cruzar). `null` = erro de leitura. */
export async function conflitosDoHorario(supabase: SupabaseClient, j: Janela): Promise<ConflitoDoHorario[] | null> {
  const { data, error } = await supabase
    .from("calendar_appointments")
    .select("id, starts_at, ends_at, status, contacts(name, display_name)")
    .eq("organization_id", j.organizationId)
    .eq("owner_user_id", j.ownerUserId)
    .in("status", ["pending", "confirmed", "completed"])
    .lt("starts_at", j.fim.toISOString())
    .gt("ends_at", j.inicio.toISOString())
    .order("starts_at", { ascending: true })
    .limit(50);
  if (error) return null;
  const linhas = (data ?? []) as unknown as {
    id: string;
    starts_at: string;
    ends_at: string;
    status: string;
    contacts: ContatoEmbutido | ContatoEmbutido[] | null;
  }[];
  return linhas.map((a) => {
    const c = Array.isArray(a.contacts) ? a.contacts[0] : a.contacts;
    return { id: a.id, paciente: nomeDoContato(c), inicio: a.starts_at, fim: a.ends_at, status: a.status };
  });
}

/** D2: horário ocupado com a flag ligada e ator pessoa vira 409 com quem ocupa. `null` = não se aplica (mantém o 422). */
export async function conflitoEncaixavel(
  supabase: SupabaseClient,
  ctx: HandlerCtx,
  j: Janela,
): Promise<ApiError | null> {
  if (ctx.actor.type !== "user") return null;
  if (!(await encaixeLigadoNaOrg(supabase, j.organizationId))) return null;
  const conflitos = await conflitosDoHorario(supabase, j);
  if (!conflitos || conflitos.length === 0) return null;
  const efetivas = await permissoesEfetivas(supabase, j.organizationId);
  const podeEncaixar = efetivas.ok && efetivas.permissoes.has(CHAVE_DO_ENCAIXE);
  return new ApiError(
    409,
    "agenda_horario_ocupado",
    { agendamentos: conflitos, pode_encaixar: podeEncaixar },
    ctx.requestId,
    "Este horário já tem paciente marcado na agenda de quem atende.",
  );
}

async function foraDaJornadaOuBloqueado(
  supabase: SupabaseClient,
  j: Janela,
  fuso: string,
): Promise<"fora_da_jornada" | "bloqueado" | "erro" | null> {
  const dia = diaLocalISO(j.inicio, fuso);
  const pi = partesNoFuso(j.inicio, fuso);
  const pf = partesNoFuso(j.fim, fuso);
  const mesmoDia = diaLocalISO(j.fim, fuso) === dia;
  const ini = pi.hora * 60 + pi.minuto;
  const fim = mesmoDia ? pf.hora * 60 + pf.minuto : 1440;
  if (!mesmoDia && pf.hora * 60 + pf.minuto > 0) return "fora_da_jornada";

  const [disp, exc, bloq] = await Promise.all([
    supabase
      .from("attendant_availability")
      .select("user_id, schedule")
      .eq("organization_id", j.organizationId)
      .eq("user_id", j.ownerUserId),
    supabase
      .from("calendar_availability_exceptions")
      .select("user_id, is_unavailable, start_minute, end_minute, reason")
      .eq("organization_id", j.organizationId)
      .eq("user_id", j.ownerUserId)
      .eq("exception_date", dia),
    supabase
      .from("clinic_agenda_blocks")
      .select("user_id, starts_on, ends_on, start_minute, end_minute, weekdays, reason, tipo")
      .eq("organization_id", j.organizationId)
      .lte("starts_on", dia)
      .gte("ends_on", dia),
  ]);
  if (disp.error || exc.error || bloq.error) return "erro";

  const faixas = bloqueiosNoDia(
    j.ownerUserId,
    dia,
    (bloq.data ?? []) as BloqueioComMotivo[],
    (exc.data ?? []) as ExcecaoDoNucleo[],
  );
  if (faixas.some((f) => f.inicio_minuto < fim && f.fim_minuto > ini)) return "bloqueado";

  const jornada = jornadaNoDia((disp.data?.[0] ?? undefined) as Disponibilidade | undefined, dia);
  if (!jornada.some((f) => f.inicio_minuto <= ini && f.fim_minuto >= fim)) return "fora_da_jornada";
  return null;
}

/**
 * Tudo que o encaixe exige antes de chamar o banco. Lança `ApiError`; volta sem nada quando pode.
 * A chave e o ator são conferidos de novo no banco (`fn_clinic_agenda_encaixar`): aqui é a mensagem boa.
 */
export async function exigeEncaixePossivel(
  supabase: SupabaseClient,
  ctx: HandlerCtx,
  j: Janela & { fusoDaRegra: string },
): Promise<void> {
  if (ctx.actor.type !== "user") {
    throw new ApiError(403, "encaixe_so_pessoa", undefined, ctx.requestId, "Encaixe só pode ser feito por uma pessoa da equipe.");
  }
  if (!(await encaixeLigadoNaOrg(supabase, j.organizationId))) {
    throw new ApiError(422, "encaixe_desligado", undefined, ctx.requestId, "O encaixe não está ligado nesta clínica.");
  }
  const efetivas = await permissoesEfetivas(supabase, j.organizationId);
  if (!efetivas.ok) throw new ApiError(500, "internal_error", undefined, ctx.requestId, efetivas.erro);
  if (!efetivas.permissoes.has(CHAVE_DO_ENCAIXE)) {
    throw new ApiError(403, "forbidden_permission", { permissao: CHAVE_DO_ENCAIXE }, ctx.requestId, "Você não tem permissão para encaixar.");
  }

  const conflitos = await conflitosDoHorario(supabase, j);
  if (!conflitos) throw new ApiError(500, "internal_error", undefined, ctx.requestId, "Não foi possível conferir a agenda.");
  if (conflitos.some((c) => c.status === "completed")) {
    throw new ApiError(409, "encaixe_sobre_finalizado", undefined, ctx.requestId, "Não dá para encaixar sobre um atendimento já realizado.");
  }

  const motivo = await foraDaJornadaOuBloqueado(supabase, j, j.fusoDaRegra);
  if (motivo === "erro") throw new ApiError(500, "internal_error", undefined, ctx.requestId, "Não foi possível conferir a jornada.");
  if (motivo === "bloqueado") {
    throw new ApiError(422, "encaixe_em_bloqueio", undefined, ctx.requestId, "Este horário está bloqueado (folga ou bloqueio) na agenda de quem atende.");
  }
  if (motivo === "fora_da_jornada") {
    throw new ApiError(422, "encaixe_fora_da_jornada", undefined, ctx.requestId, "O encaixe precisa cair dentro da jornada de quem atende.");
  }
}

/** Erros da função do banco → o mesmo vocabulário das recusas acima. `null` = erro não conhecido. */
export function erroDoEncaixeNoBanco(erro: { code?: string; message?: string }, ctx: HandlerCtx): ApiError | null {
  const msg = erro.message ?? "";
  // O índice do núcleo `calendar_appointments_sem_duplicata_idx` impede dois compromissos ativos do
  // mesmo profissional começando no MESMO instante — o encaixe tem de começar em outro minuto.
  if (erro.code === "23505" && msg.includes("calendar_appointments_sem_duplicata_idx")) {
    return new ApiError(
      409,
      "encaixe_mesmo_inicio",
      undefined,
      ctx.requestId,
      "Já existe um compromisso começando exatamente neste horário. Encaixe alguns minutos depois.",
    );
  }
  if (erro.code !== "P0001") return null;
  if (msg.includes("encaixe_desligado")) {
    return new ApiError(422, "encaixe_desligado", undefined, ctx.requestId, "O encaixe não está ligado nesta clínica.");
  }
  if (msg.includes("motivo_invalido")) {
    return new ApiError(422, "encaixe_motivo_invalido", undefined, ctx.requestId, "Informe o motivo do encaixe (de 5 a 500 caracteres).");
  }
  if (msg.includes("sobreposto_finalizado")) {
    return new ApiError(409, "encaixe_sobre_finalizado", undefined, ctx.requestId, "Não dá para encaixar sobre um atendimento já realizado.");
  }
  if (msg.includes("sem_permissao")) {
    return new ApiError(403, "forbidden_permission", { permissao: CHAVE_DO_ENCAIXE }, ctx.requestId, "Você não tem permissão para encaixar.");
  }
  if (msg.includes("encaixe_linha_invalida")) {
    return new ApiError(422, "validation_failed", undefined, ctx.requestId, "Dados do encaixe inválidos.");
  }
  return null;
}
