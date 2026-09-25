/**
 * FORK clinic (prontuário F9) — o cabeçalho clínico do paciente.
 *
 * GET — alergias e alertas fixos (com o histórico recente), plano ativo (com
 *       `planos.ver`), último atendimento, próximo agendamento e as opções dos
 *       filtros da linha do tempo (profissionais que já atenderam, planos).
 * PUT — alergias e alertas, com a versão que a tela conhecia; toda mudança
 *       fica em `clinic_prontuario_alteracoes`.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoBanco } from "@/lib/clinic/atendimento/servidor";
import { progressoDoPlano, type StatusDaSessao } from "@/lib/clinic/planos/leitura";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ contactId: string }> };
type Um<T> = T | T[] | null;
const primeiro = <T>(v: Um<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

const corpo = z
  .object({
    alergias: z.string().max(2000).nullish(),
    alertas: z.string().max(2000).nullish(),
    versao: z.number().int().min(0),
  })
  .strict();

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("prontuario.ver", {
    requestId,
    resource: "clinic_prontuarios",
  });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { contactId } = await ctx.params;
  if (!z.string().uuid().safeParse(contactId).success)
    return fail("validation_failed", t("id inválido"), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const agora = new Date().toISOString();
  const verPlanos = authz.permissoes.has("planos.ver");

  const [cab, historico, ultimo, proximo, atendidos, planos] = await Promise.all([
    supabase
      .from("clinic_prontuarios")
      .select("alergias, alertas, versao, updated_at")
      .eq("organization_id", org)
      .eq("contact_id", contactId)
      .maybeSingle(),
    supabase
      .from("clinic_prontuario_alteracoes")
      .select("campo, valor_anterior, valor_novo, created_at")
      .eq("organization_id", org)
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("clinic_atendimentos")
      .select("started_at, calendar_event_types(name)")
      .eq("organization_id", org)
      .eq("contact_id", contactId)
      .neq("status", "anulado")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("calendar_appointments")
      .select("starts_at, title")
      .eq("organization_id", org)
      .eq("contact_id", contactId)
      .gte("starts_at", agora)
      .not("status", "in", "(cancelled,no_show)")
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("clinic_atendimentos")
      .select("professional_user_id")
      .eq("organization_id", org)
      .eq("contact_id", contactId)
      .limit(500),
    verPlanos
      ? supabase
          .from("clinic_planos_tratamento")
          .select("id, titulo, status, clinic_plano_sessoes(status)")
          .eq("organization_id", org)
          .eq("contact_id", contactId)
          .order("created_at", { ascending: false })
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            titulo: string;
            status: string;
            clinic_plano_sessoes: Array<{ status: StatusDaSessao }> | null;
          }>,
        }),
  ]);
  const erro = cab.error ?? historico.error ?? ultimo.error ?? proximo.error ?? atendidos.error;
  if (erro) return fail("internal_error", erro.message, 500, { requestId });

  const profIds = [
    ...new Set(
      (atendidos.data ?? [])
        .map((a) => a.professional_user_id as string | null)
        .filter((x): x is string => !!x),
    ),
  ];
  const { data: profs } = profIds.length
    ? await supabase
        .from("clinic_professionals")
        .select("user_id, nome:display_name")
        .eq("organization_id", org)
        .in("user_id", profIds)
    : { data: [] };
  const listaDePlanos = (planos.data ?? []) as Array<{
    id: string;
    titulo: string;
    status: string;
    clinic_plano_sessoes: Array<{ status: StatusDaSessao }> | null;
  }>;
  const ativo = listaDePlanos.find((p) => p.status === "ativo");

  return ok(
    {
      alergias: (cab.data?.alergias as string | null) ?? null,
      alertas: (cab.data?.alertas as string | null) ?? null,
      versao: (cab.data?.versao as number | undefined) ?? 0,
      atualizado_em: (cab.data?.updated_at as string | undefined) ?? null,
      historico: historico.data ?? [],
      plano_ativo: ativo
        ? {
            id: ativo.id,
            titulo: ativo.titulo,
            ...progressoDoPlano(ativo.clinic_plano_sessoes ?? []),
          }
        : null,
      ultimo_atendimento: ultimo.data
        ? {
            inicio: ultimo.data.started_at as string,
            servico:
              primeiro(ultimo.data.calendar_event_types as Um<{ name: string }>)?.name ?? null,
          }
        : null,
      proximo_agendamento: proximo.data
        ? {
            inicio: proximo.data.starts_at as string,
            titulo: (proximo.data.title as string | null) ?? null,
          }
        : null,
      filtros: {
        profissionais: ((profs ?? []) as Array<{ user_id: string; nome: string | null }>).map(
          (p) => ({ id: p.user_id, nome: p.nome ?? "—" }),
        ),
        planos: listaDePlanos.map((p) => ({ id: p.id, titulo: p.titulo })),
      },
      pode_editar: authz.permissoes.has("atendimento.registrar"),
    },
    { requestId },
  );
}

export async function PUT(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("atendimento.registrar", {
    requestId,
    resource: "clinic_prontuarios",
  });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { contactId } = await ctx.params;
  if (!z.string().uuid().safeParse(contactId).success)
    return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_cabecalho_salvar", {
    p_org: org,
    p_contact: contactId,
    p_alergias: lido.data.alergias ?? null,
    p_alertas: lido.data.alertas ?? null,
    p_versao_esperada: lido.data.versao,
  });
  if (error) {
    const e = erroDoBanco(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.cabecalho_alterado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "contact",
    resourceId: contactId,
    requestId,
    metadata: {},
  });
  return ok(data as { versao: number }, { requestId });
}
