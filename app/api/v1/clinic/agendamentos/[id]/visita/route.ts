/**
 * /api/v1/clinic/agendamentos/:id/visita — o status da visita do paciente agendado.
 *
 * GET (viewer): o estado atual e o histórico (de → para, quem, quando, correção).
 * POST (agent+): muda o estado — `{ status, motivo? }`. Voltar um passo é
 * correção e exige motivo. Regras em `lib/clinic/visitas/mudar-status.ts`.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { ApiError } from "@/lib/api/types";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { temAtendimentoAberto } from "@/lib/clinic/atendimento/servidor";
import { prontuarioLigado } from "@/lib/clinic/flags";
import { mudarStatusDaVisita } from "@/lib/clinic/visitas/mudar-status";
import { STATUS_DA_VISITA, ehCorrecao, ehStatusDaVisita } from "@/lib/clinic/visitas/status";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { contarFaltas } from "@/lib/clinic/agenda/faltas";
import { compromissosDePrimeiraVez } from "@/lib/clinic/agenda/primeira-vez";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("recepcao.ver_painel", { requestId, resource: "clinic_appointment_visits" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", "id inválido", 422, { requestId });
  const org = authz.org.orgId;

  const supabase = await createClient();
  const [{ data: visita, error: e1 }, { data: eventos, error: e2 }, { data: confirmacao }, { data: alocados }] = await Promise.all([
    supabase
      .from("clinic_appointment_visits")
      .select("status, changed_at, changed_by, arrived_at, ready_at, started_at, finished_at")
      .eq("organization_id", org)
      .eq("appointment_id", id)
      .maybeSingle(),
    supabase
      .from("clinic_appointment_visit_events")
      .select("id, from_status, to_status, is_correction, reason, changed_by, created_at")
      .eq("organization_id", org)
      .eq("appointment_id", id)
      .order("created_at", { ascending: true })
      .limit(200),
    // FORK clinic (9004): a resposta do paciente ao pedido de confirmação.
    supabase
      .from("clinic_confirmation_requests")
      .select("status, falha, requested_at, answered_at")
      .eq("organization_id", org)
      .eq("appointment_id", id)
      .maybeSingle(),
    // FORK clinic (9007): a sala e o equipamento que o compromisso ocupa.
    supabase
      .from("clinic_appointment_resources")
      .select("clinic_resources(name, category)")
      .eq("organization_id", org)
      .eq("appointment_id", id),
  ]);
  if (e1 || e2) return fail("internal_error", (e1 ?? e2)!.message, 500, { requestId });
  // FORK clinic (E5.1): as faltas do paciente nos últimos 12 meses.
  const { data: ag } = await supabase
    .from("calendar_appointments")
    .select("contact_id, owner_user_id, starts_at")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  const linhaAg = ag as { contact_id?: string | null; owner_user_id?: string | null; starts_at?: string } | null;
  const contatoId = linhaAg?.contact_id ?? null;
  const faltas = contatoId ? ((await contarFaltas(supabase, org, [contatoId])).get(contatoId) ?? 0) : 0;
  // FORK clinic (agenda S4): 1ª vez (a recepção completa o cadastro) e quem é o
  // profissional do agendamento (só ele inicia e finaliza).
  // FORK clinic (agenda S5): o atendimento aberto/feito deste agendamento, para
  // o detalhe levar direto ao prontuário (a RLS da 9044 só devolve o de quem pode ver).
  const { data: atendimento } = await supabase
    .from("clinic_atendimentos")
    .select("id, status")
    .eq("organization_id", org)
    .eq("appointment_id", id)
    .neq("status", "anulado")
    .maybeSingle();
  const primeiraVez =
    contatoId && linhaAg?.starts_at
      ? (await compromissosDePrimeiraVez(supabase, org, [{ id, contact_id: contatoId, inicio: linhaAg.starts_at }])).has(id)
      : false;
  return ok(
    {
      visita: visita ?? { status: "agendado" },
      eventos: eventos ?? [],
      confirmacao: confirmacao ?? null,
      faltas,
      primeira_vez: primeiraVez,
      dono_id: linhaAg?.owner_user_id ?? null,
      eh_o_dono: (linhaAg?.owner_user_id ?? null) === authz.user.id,
      atendimento: (atendimento as { id: string; status: string } | null) ?? null,
      recursos: (alocados ?? []).flatMap((a) => {
        const r = (a as { clinic_resources: { name: string } | { name: string }[] | null }).clinic_resources;
        return (Array.isArray(r) ? r : r ? [r] : []).map((x) => x.name);
      }),
    },
    { requestId },
  );
}

const postSchema = z.object({
  status: z.enum(STATUS_DA_VISITA),
  motivo: z.string().trim().max(300).nullish(),
});

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  // FORK clinic (agenda S4): a recepção muda pela permissão dela; o profissional
  // do agendamento, por ser o dono (iniciar/finalizar são só dele). O banco
  // confere de novo (9043).
  const authz = await requirePermission("agenda.ver", { requestId, resource: "clinic_appointment_visits" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  // Sem nenhuma das chaves de quem mexe na visita (recepção ou atendimento),
  // recusa já — antes de olhar o agendamento (quem só lê não descobre se existe).
  if (!["recepcao.mudar_status_visita", "atendimento.iniciar", "atendimento.finalizar"].some((k) => authz.permissoes.has(k))) {
    return fail("forbidden_permission", t("Você não tem permissão para esta ação."), 403, {
      requestId,
      details: { permissao: "recepcao.mudar_status_visita" },
    });
  }
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", "id inválido", 422, { requestId });

  const lido = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Status inválido."), 422, { requestId });
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data: agendamento, error: erroAg } = await supabase
    .from("calendar_appointments")
    .select("id, contact_id, owner_user_id")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (erroAg) return fail("internal_error", erroAg.message, 500, { requestId });
  if (!agendamento) return fail("not_found", t("Agendamento não encontrado."), 404, { requestId });
  const ehODono = (agendamento.owner_user_id as string | null) === authz.user.id;
  if (!ehODono && !authz.permissoes.has("recepcao.mudar_status_visita")) {
    return fail("forbidden_permission", t("Você não tem permissão para esta ação."), 403, {
      requestId,
      details: { permissao: "recepcao.mudar_status_visita" },
    });
  }

  // FORK clinic (ACL-012): voltar um passo é CORREÇÃO e pede a permissão própria.
  // FORK clinic (prontuário F1): com o módulo de prontuário ligado, o atendimento
  // COMEÇA pelo profissional ("Iniciar atendimento" na fila dele, que cria o
  // registro clínico) e, se estiver aberto, TERMINA por ele também.
  if (lido.data.status === "em_atendimento" || lido.data.status === "finalizado") {
    const { data: orgRow } = await supabase.from("organizations").select("settings").eq("id", org).maybeSingle();
    if (prontuarioLigado((orgRow as { settings?: unknown } | null)?.settings)) {
      if (lido.data.status === "em_atendimento") {
        return fail(
          "atendimento_em_andamento",
          t("Com o prontuário ligado, o profissional inicia o atendimento pela fila dele."),
          409,
          { requestId },
        );
      }
      if (await temAtendimentoAberto(org, id)) {
        return fail(
          "atendimento_em_andamento",
          t("Este atendimento está aberto: o profissional finaliza pela fila dele."),
          409,
          { requestId },
        );
      }
    }
  }

  const { data: visitaAtual } = await supabase
    .from("clinic_appointment_visits")
    .select("status")
    .eq("organization_id", org)
    .eq("appointment_id", id)
    .maybeSingle();
  const statusAtual = (visitaAtual as { status?: string } | null)?.status;
  const corrigindo = ehStatusDaVisita(statusAtual) && ehCorrecao(statusAtual, lido.data.status);
  // FORK clinic (agenda S4, 9043): começar e terminar o atendimento é SÓ do
  // profissional do agendamento — recusado aqui, ANTES de o serviço gravar
  // "realizado" no núcleo.
  if (!corrigindo && (lido.data.status === "em_atendimento" || lido.data.status === "finalizado") && !ehODono) {
    return fail("visita_so_o_profissional", t("Só o profissional do agendamento inicia e finaliza o atendimento."), 403, {
      requestId,
    });
  }
  if (corrigindo && !ehODono && !authz.permissoes.has("recepcao.corrigir_status")) {
    return fail("forbidden_permission", t("Você não tem permissão para esta ação."), 403, {
      requestId,
      details: { permissao: "recepcao.corrigir_status" },
    });
  }

  try {
    const r = await mudarStatusDaVisita(
      supabase,
      { organization_id: org, actor: { type: "user", id: authz.user.id }, requestId },
      {
        appointmentId: id,
        contactId: (agendamento.contact_id as string | null) ?? null,
        para: lido.data.status,
        motivo: lido.data.motivo ?? null,
      },
    );
    if (r.mudou) {
      void audit({
        action: "clinic.visita_status_alterado",
        actorUserId: authz.user.id,
        organizationId: org,
        resourceType: "calendar_appointment",
        resourceId: id,
        requestId,
        metadata: { de: r.de, para: r.status, correcao: r.correcao },
      });
    }
    return ok(r, { requestId });
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.code, t(err.message), err.status, {
        details: err.details as Record<string, unknown> | undefined,
        requestId,
      });
    }
    throw err;
  }
}
