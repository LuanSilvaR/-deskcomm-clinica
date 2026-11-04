/**
 * GET /api/v1/clinic/agenda/profissionais — FORK clinic (agenda por profissional, S1).
 *
 * Quem pode estar em CONTEXTO na Agenda: nome, especialidades, ativo e se é
 * quem está logado. Com `agenda.ver_outros`, a equipe toda; sem ela, só o
 * próprio usuário — o seletor da tela mostra o que esta rota devolve, e as
 * outras rotas da agenda aplicam a mesma regra (`escopoDaLeitura`).
 *
 * Com as regras de profissionais ligadas, a fonte é o cadastro de
 * profissionais. Desligadas (clínica sem cadastro), são os membros com agenda —
 * a mesma lista mínima de `/api/v1/agenda/pessoas` (nome, sem e-mail).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { isServiceRoleConfigured } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import type { ProfissionalDaAgenda } from "@/lib/clinic/agenda/contexto-da-agenda";
import { PERMISSAO_VER_OUTROS } from "@/lib/clinic/agenda/escopo-da-agenda";
import { clinicProfissionaisLigado } from "@/lib/clinic/flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { atendeAsExigencias } from "@/lib/clinic/profissionais/habilitacao";

interface Especialidade {
  id: string;
  name: string;
  is_active?: boolean | null;
}

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("agenda.ver", { requestId, resource: "agenda" });
  if (!authz.ok) return authz.response;
  const org = authz.org.orgId;
  const eu = authz.user.id;
  const verOutros = authz.permissoes.has(PERMISSAO_VER_OUTROS);

  const supabase = await createClient();
  const { data: empresa } = await supabase.from("organizations").select("settings").eq("id", org).maybeSingle();

  let lista: ProfissionalDaAgenda[];
  if (clinicProfissionaisLigado((empresa as { settings?: unknown } | null)?.settings)) {
    const [profs, exigencias] = await Promise.all([
      supabase
        .from("clinic_professionals")
        .select("user_id, display_name, is_active, clinic_professional_specialties(clinic_specialties(id, name, is_active))")
        .eq("organization_id", org),
      // A mesma regra do motor (`lib/clinic/profissionais/habilitacao.ts`): tipo
      // sem especialidade exigida é de todos; com, basta o profissional ter uma.
      supabase
        .from("clinic_event_type_specialties")
        .select("event_type_id, specialty_id, clinic_specialties!inner(is_active)")
        .eq("organization_id", org)
        .eq("clinic_specialties.is_active", true),
    ]);
    const erro = profs.error ?? exigencias.error;
    if (erro) return fail("internal_error", erro.message, 500, { requestId });
    const exigidasPorTipo = new Map<string, string[]>();
    for (const l of (exigencias.data ?? []) as Array<{ event_type_id: string; specialty_id: string }>) {
      exigidasPorTipo.set(l.event_type_id, [...(exigidasPorTipo.get(l.event_type_id) ?? []), l.specialty_id]);
    }
    lista = ((profs.data ?? []) as Array<Record<string, unknown>>).map((p) => {
      const vinculos = (p.clinic_professional_specialties ?? []) as Array<{
        clinic_specialties: Especialidade | Especialidade[] | null;
      }>;
      const especialidades = vinculos.flatMap((v) =>
        Array.isArray(v.clinic_specialties) ? v.clinic_specialties : v.clinic_specialties ? [v.clinic_specialties] : [],
      );
      const minhas = especialidades.filter((e) => e.is_active !== false).map((e) => e.id);
      return {
        user_id: p.user_id as string,
        nome: ((p.display_name as string | null) ?? "").trim() || "Sem nome",
        especialidades: especialidades.map((e) => e.name).sort((a, b) => a.localeCompare(b, "pt-BR")),
        ativo: p.is_active !== false,
        eu: p.user_id === eu,
        tipos_restritos: [...exigidasPorTipo]
          .filter(([, exigidas]) => !atendeAsExigencias(exigidas, minhas))
          .map(([tipo]) => tipo),
      };
    });
  } else {
    // Sem cadastro de profissionais: os membros que podem ter agenda (agent+).
    const cliente = isServiceRoleConfigured() ? createAdminClient() : supabase;
    const { data, error } = await cliente
      .from("user_organizations")
      .select("user_id, role")
      .eq("organization_id", org) // fonte confiável: o cookie validado, nunca o corpo
      .is("revoked_at", null)
      .in("role", ["admin", "manager", "agent"]);
    if (error) return fail("internal_error", error.message, 500, { requestId });
    // "Com agenda" = publicou jornada ou responde por um tipo ativo. Membro sem
    // nenhum dos dois abriria uma grade sem horário nenhum; se ninguém tiver,
    // vale a equipe inteira (instalação nova, antes de configurar).
    const [jornadas, tipos] = await Promise.all([
      supabase.from("attendant_availability").select("user_id, schedule").eq("organization_id", org),
      supabase.from("calendar_event_types").select("default_owner_user_id").eq("organization_id", org).eq("is_active", true),
    ]);
    const comAgenda = new Set<string>();
    for (const j of (jornadas.data ?? []) as Array<{ user_id: string; schedule: { windows?: unknown[] } | null }>) {
      if ((j.schedule?.windows ?? []).length > 0) comAgenda.add(j.user_id);
    }
    for (const t of (tipos.data ?? []) as Array<{ default_owner_user_id: string | null }>) {
      if (t.default_owner_user_id) comAgenda.add(t.default_owner_user_id);
    }
    const todosOsMembros = (data ?? []) as Array<{ user_id: string }>;
    const filtrados = todosOsMembros.filter((m) => comAgenda.has(m.user_id));
    const membros = filtrados.length > 0 ? filtrados : todosOsMembros;
    const admin = isServiceRoleConfigured() ? createAdminClient() : null;
    lista = await Promise.all(
      membros.map(async (m) => {
        const nome = admin
          ? ((await admin.auth.admin.getUserById(m.user_id)).data?.user?.user_metadata?.full_name as string | undefined)
          : undefined;
        return { user_id: m.user_id, nome: nome?.trim() || "Sem nome", especialidades: [], ativo: true, eu: m.user_id === eu, tipos_restritos: [] };
      }),
    );
  }

  const visiveis = (verOutros ? lista : lista.filter((p) => p.eu)).sort(
    (a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, "pt-BR"),
  );
  return ok({ profissionais: visiveis, pode_ver_outros: verOutros }, { requestId });
}
