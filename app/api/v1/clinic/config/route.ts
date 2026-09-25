/**
 * GET/PATCH /api/v1/clinic/config — as opções do módulo clinic.
 *
 * `profissionais`: regras de especialidade e bloqueios na agenda (migration 9001).
 * `ficha_obrigatoria`: exigir a ficha completa do paciente na chegada e no
 * "Compareceu" (migration 9002).
 * `confirmacao_automatica`: o lembrete da véspera pede SIM/NÃO e a falta de
 * resposta vira tarefa de ligação (migration 9004).
 * `trava_sobreposicao`: o banco recusa compromisso que cruza outro na agenda
 * do mesmo profissional (migration 9005).
 * `recursos`: salas e equipamentos exigidos pelo tipo de atendimento (migration 9007).
 * `procedimentos`: o módulo de procedimentos e POP (migration 9015).
 * `prazo_paciente_horas`: dentro deste prazo antes da consulta, o agente de IA
 * não desmarca nem remarca (migration 9008). 0 = sem prazo.
 * `acesso_por_permissoes`: o acesso passa a vir dos papéis de acesso (ACL,
 * migration 9012); só o Administrador liga.
 *
 * GET: qualquer membro lê (as telas precisam saber). PATCH: só admin, pelas
 * funções `fn_clinic_definir_*`, que também exigem MFA provado quando a sessão
 * tem fator — nunca UPDATE em organizations.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { confirmacaoAutomaticaLigada } from "@/lib/clinic/confirmacao/servidor";
import { acessoPorPermissoesLigado } from "@/lib/clinic/acesso/modo";
import { falhaDeAcesso } from "@/lib/clinic/acesso/erros-do-banco";
import { prazoDoPacienteHoras } from "@/lib/clinic/agenda/prazo-do-paciente";
import { recursosLigados } from "@/lib/clinic/agenda/recursos";
import { clinicProfissionaisLigado, procedimentosLigados, travaSobreposicaoLigada } from "@/lib/clinic/flags";
import { fichaObrigatoriaLigada } from "@/lib/clinic/pacientes/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function lerOpcoes(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("settings").eq("id", orgId).maybeSingle();
  const settings = (data as { settings?: unknown } | null)?.settings;
  return {
    profissionais: clinicProfissionaisLigado(settings),
    ficha_obrigatoria: fichaObrigatoriaLigada(settings),
    confirmacao_automatica: confirmacaoAutomaticaLigada(settings),
    trava_sobreposicao: travaSobreposicaoLigada(settings),
    recursos: recursosLigados(settings),
    procedimentos: procedimentosLigados(settings),
    prazo_paciente_horas: prazoDoPacienteHoras(settings),
    acesso_por_permissoes: acessoPorPermissoesLigado(settings),
  };
}

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "clinic" });
  if (!authz.ok) return authz.response;
  return ok(await lerOpcoes(authz.org.orgId), { requestId });
}

const patchSchema = z
  .object({
    profissionais: z.boolean().optional(),
    ficha_obrigatoria: z.boolean().optional(),
    confirmacao_automatica: z.boolean().optional(),
    trava_sobreposicao: z.boolean().optional(),
    recursos: z.boolean().optional(),
    procedimentos: z.boolean().optional(),
    prazo_paciente_horas: z.number().int().min(0).max(168).optional(),
    acesso_por_permissoes: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Informe se o módulo fica ligado.",
  });

const FUNCAO_DA_OPCAO = {
  profissionais: "fn_clinic_definir_flag",
  ficha_obrigatoria: "fn_clinic_definir_ficha_obrigatoria",
  confirmacao_automatica: "fn_clinic_definir_confirmacao_automatica",
  trava_sobreposicao: "fn_clinic_definir_trava_sobreposicao",
  recursos: "fn_clinic_definir_recursos",
  procedimentos: "fn_clinic_definir_procedimentos",
} as const;

export async function PATCH(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requirePermission("configuracoes.opcoes_da_clinica", { requestId, resource: "clinic" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const lido = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return fail("validation_failed", t(lido.error.issues[0]?.message ?? "Informe se o módulo fica ligado."), 422, {
      requestId,
    });
  }

  const supabase = await createClient();
  if (lido.data.acesso_por_permissoes !== undefined) {
    const { data, error } = await supabase.rpc("fn_clinic_definir_acesso_por_permissoes", {
      p_org: authz.org.orgId,
      p_ligado: lido.data.acesso_por_permissoes,
    });
    if (error) return falhaDeAcesso(error, requestId, authz.user.idioma);
    const r = data as { mudou: boolean; niveis_recalculados: number };
    if (r.mudou) {
      void audit({
        action: "acesso.modo_permissoes_alterado",
        actorUserId: authz.user.id,
        organizationId: authz.org.orgId,
        resourceType: "organization",
        resourceId: authz.org.orgId,
        requestId,
        metadata: { ligado: lido.data.acesso_por_permissoes, niveis_recalculados: r.niveis_recalculados },
      });
    }
  }
  if (lido.data.prazo_paciente_horas !== undefined) {
    const { data, error } = await supabase.rpc("fn_clinic_definir_prazo_do_paciente", {
      p_org: authz.org.orgId,
      p_horas: lido.data.prazo_paciente_horas,
    });
    if (error) {
      if (error.message.includes("mfa_required")) {
        return fail("mfa_required", t("Confirme a verificação em duas etapas para mudar esta opção."), 403, { requestId });
      }
      if (error.code === "42501") {
        return fail("forbidden", t("Só quem administra a empresa pode mudar esta opção."), 403, { requestId });
      }
      return fail("internal_error", error.message, 500, { requestId });
    }
    if ((data as { mudou: boolean }).mudou) {
      void audit({
        action: "clinic.flag_alterada",
        actorUserId: authz.user.id,
        organizationId: authz.org.orgId,
        resourceType: "organization",
        resourceId: authz.org.orgId,
        requestId,
        metadata: { prazo_paciente_horas: lido.data.prazo_paciente_horas },
      });
    }
  }
  for (const opcao of ["profissionais", "ficha_obrigatoria", "confirmacao_automatica", "trava_sobreposicao", "recursos", "procedimentos"] as const) {
    const valor = lido.data[opcao];
    if (valor === undefined) continue;
    const { data, error } = await supabase.rpc(FUNCAO_DA_OPCAO[opcao], { p_org: authz.org.orgId, p_ligado: valor });
    if (error) {
      if (error.message.includes("mfa_required")) {
        return fail("mfa_required", t("Confirme a verificação em duas etapas para mudar esta opção."), 403, { requestId });
      }
      if (error.code === "42501") {
        return fail("forbidden", t("Só quem administra a empresa pode mudar esta opção."), 403, { requestId });
      }
      return fail("internal_error", error.message, 500, { requestId });
    }
    const resultado = data as { ligado: boolean; mudou: boolean };
    if (resultado.mudou) {
      void audit({
        action: "clinic.flag_alterada",
        actorUserId: authz.user.id,
        organizationId: authz.org.orgId,
        resourceType: "organization",
        resourceId: authz.org.orgId,
        requestId,
        metadata: { [opcao]: resultado.ligado },
      });
    }
  }
  return ok(await lerOpcoes(authz.org.orgId), { requestId });
}
