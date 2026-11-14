/**
 * GET /api/v1/clinic/orcamentos/painel?mes=AAAA-MM&status= — FORK clinic
 * (orçamento O5): a lista de orçamentos da clínica e os indicadores do mês.
 *
 * `orcamentos.ver`. A organização vem da sessão e a RLS decide de novo. Quem
 * não tem `pacientes.ver_todos` só vê os orçamentos dos pacientes da própria
 * agenda (mesmo escopo das outras telas). Sem dado clínico: nome do paciente,
 * número, valores, forma de pagamento e status.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { orcamentosLigado } from "@/lib/clinic/flags";
import { calcularIndicadores, intervaloDoMes, type LinhaDoIndicador } from "@/lib/clinic/orcamentos/indicadores";
import { STATUS_DO_ORCAMENTO } from "@/lib/clinic/orcamentos/orcamento";
import { contatosDoEscopo } from "@/lib/clinic/pacientes/escopo-de-pacientes";
import { nomeDoContato } from "@/lib/contacts/rotulo-do-contato";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const filtroSchema = z.object({
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  status: z.enum(STATUS_DO_ORCAMENTO).optional(),
});

type Linha = LinhaDoIndicador & {
  id: string;
  contact_id: string;
  numero: number;
  versao: number;
  validade_ate: string;
  created_at: string;
  condicao_pagamento: { forma: string; parcelas: number };
  contacts: { name: string | null; display_name: string | null; phone_number: string | null } | null;
};

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("orcamentos.ver", { requestId, resource: "clinic_orcamentos" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const p = req.nextUrl.searchParams;
  const agora = new Date();
  const filtro = filtroSchema.safeParse({
    mes: p.get("mes") ?? `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, "0")}`,
    status: p.get("status") || undefined,
  });
  if (!filtro.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const { de, ate } = intervaloDoMes(filtro.data.mes);

  const supabase = await createClient();
  const [config, escopo] = await Promise.all([
    supabase.from("organizations").select("settings").eq("id", org).maybeSingle(),
    contatosDoEscopo(supabase, org, authz.user.id),
  ]);

  // O período cobre tanto o que foi criado quanto o que andou (enviado/aprovado/
  // recusado/expirou) no mês — e tudo o que está em aberto, para a fila.
  let q = supabase
    .from("clinic_orcamentos")
    .select(
      "id, contact_id, numero, versao, status, total_cents, validade_ate, created_at, enviado_em, aprovado_em, recusado_em, expirado_em, condicao_pagamento, contacts(name, display_name, phone_number)",
    )
    .eq("organization_id", org)
    .or(
      [
        `and(created_at.gte.${de},created_at.lt.${ate})`,
        `and(enviado_em.gte.${de},enviado_em.lt.${ate})`,
        `and(aprovado_em.gte.${de},aprovado_em.lt.${ate})`,
        `and(recusado_em.gte.${de},recusado_em.lt.${ate})`,
        `and(expirado_em.gte.${de},expirado_em.lt.${ate})`,
        "status.eq.enviado",
        "status.eq.rascunho",
      ].join(","),
    )
    .order("created_at", { ascending: false })
    .limit(2000);
  if (escopo !== null) q = q.in("contact_id", escopo.length > 0 ? escopo : ["00000000-0000-0000-0000-000000000000"]);
  const { data, error } = await q;
  if (error) return fail("internal_error", t("Não foi possível carregar os orçamentos."), 500, { requestId });

  const linhas = (data ?? []) as unknown as Linha[];
  const indicadores = calcularIndicadores(linhas, de, ate);
  const lista = linhas
    .filter((l) => !filtro.data.status || l.status === filtro.data.status)
    .slice(0, 500)
    .map((l) => ({
      id: l.id,
      contact_id: l.contact_id,
      paciente: l.contacts ? nomeDoContato(l.contacts) : null,
      numero: l.numero,
      versao: l.versao,
      status: l.status,
      total_cents: l.total_cents,
      forma: l.condicao_pagamento?.forma ?? null,
      parcelas: l.condicao_pagamento?.parcelas ?? 1,
      validade_ate: l.validade_ate,
      created_at: l.created_at,
      enviado_em: l.enviado_em,
      aprovado_em: l.aprovado_em,
    }));

  return ok(
    {
      ligado: orcamentosLigado((config.data as { settings?: unknown } | null)?.settings),
      mes: filtro.data.mes,
      indicadores,
      orcamentos: lista,
    },
    { requestId },
  );
}
