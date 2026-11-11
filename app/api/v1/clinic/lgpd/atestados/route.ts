/**
 * GET  /api/v1/clinic/lgpd/atestados[?contact_id=<uuid>]  lista os atestados da org
 * POST /api/v1/clinic/lgpd/atestados { contact_id }       gera o atestado depois (#87)
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { emitirAtestado } from "@/lib/clinic/lgpd/emitir-atestado";
import { executorDoPedido, ipDoPedido } from "@/lib/clinic/lgpd/executor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

import { atestadoLigado, recursoDesligado } from "./_comum";

export const dynamic = "force-dynamic";

const RECURSO = "clinic_atestados_anonimizacao";
const consulta = z.object({ contact_id: z.string().uuid().optional() });
const corpo = z.object({ contact_id: z.string().uuid() });

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: RECURSO });
  if (!authz.ok) return authz.response;
  const orgId = authz.org.orgId;

  const q = consulta.safeParse({ contact_id: req.nextUrl.searchParams.get("contact_id") ?? undefined });
  if (!q.success) return fail("validation_error", "contact_id inválido.", 422, { requestId });

  const admin = createAdminClient();
  if (!(await atestadoLigado(admin, orgId))) return recursoDesligado(requestId);

  let consultaDb = admin
    .from("clinic_atestados_anonimizacao")
    .select("id, contact_id, anonimizado_em, emitido_em, codigo_curto, executor_nome:executor->>nome")
    .eq("organization_id", orgId);
  if (q.data.contact_id) consultaDb = consultaDb.eq("contact_id", q.data.contact_id);
  const { data, error } = await consultaDb.order("emitido_em", { ascending: false }).limit(200);
  if (error) return fail("internal_error", "Não foi possível listar os atestados.", 500, { requestId });
  return ok({ atestados: data ?? [] }, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: RECURSO });
  if (!authz.ok) return authz.response;
  const orgId = authz.org.orgId;

  const admin = createAdminClient();
  if (!(await atestadoLigado(admin, orgId))) return recursoDesligado(requestId);

  const entrada = corpo.safeParse(await req.json().catch(() => null));
  if (!entrada.success) return fail("validation_error", "contact_id inválido.", 422, { requestId });

  const { data: contato, error: erroContato } = await admin
    .from("contacts")
    .select("id, is_anonymized, anonymized_at")
    .eq("organization_id", orgId)
    .eq("id", entrada.data.contact_id)
    .maybeSingle();
  if (erroContato) return fail("internal_error", "Não foi possível ler o contato.", 500, { requestId });
  const c = contato as { id: string; is_anonymized: boolean | null; anonymized_at: string | null } | null;
  if (!c || c.is_anonymized !== true) {
    return fail("not_anonymized", "O contato precisa estar anonimizado para gerar o atestado.", 409, { requestId });
  }

  const r = await emitirAtestado(admin, {
    orgId,
    contactId: c.id,
    anonimizadoEm: c.anonymized_at ?? new Date().toISOString(),
    executor: executorDoPedido(authz),
    ip: ipDoPedido(req),
  });
  if (r.ok) return ok({ atestado: r.atestado }, { requestId, status: 201 });
  if (r.jaExistia) {
    const { data: existente } = await admin
      .from("clinic_atestados_anonimizacao")
      .select("id")
      .eq("organization_id", orgId)
      .eq("contact_id", c.id)
      .maybeSingle();
    return fail("ja_emitido", "O atestado deste contato já foi emitido.", 409, {
      requestId,
      details: { id: (existente as { id: string } | null)?.id ?? null },
    });
  }
  return fail("internal_error", r.erro, 500, { requestId });
}
