/**
 * GET /api/v1/clinic/pacientes/situacao?ids=<uuid>,<uuid>… — o selo "ficha
 * completa / incompleta" para a lista de pacientes.
 *
 * Existe em vez de um campo novo no GET de contatos do núcleo: a lista pede a
 * situação só dos pacientes que está mostrando (até 200 por vez), e o núcleo
 * não muda. Usa a MESMA regra da ficha (`situacaoDe`).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import {
  COLUNAS_DO_PERFIL,
  hojeNaClinica,
  situacaoDe,
  type ContatoDaFicha,
  type PerfilDoPaciente,
} from "@/lib/clinic/pacientes/servidor";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const idsSchema = z.array(z.string().uuid()).min(1).max(200);

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("pacientes.ver", { requestId, resource: "clinic_patient_profiles" });
  if (!authz.ok) return authz.response;

  const bruto = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter(Boolean);
  const lido = idsSchema.safeParse(bruto);
  if (!lido.success) return fail("validation_failed", "ids inválidos (1 a 200 UUIDs)", 422, { requestId });
  const org = authz.org.orgId;

  const supabase = await createClient();
  const [{ data: contatos, error: e1 }, { data: perfis, error: e2 }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, display_name, phone_number, email, birthdate, cpf_hash")
      .eq("organization_id", org)
      .in("id", lido.data),
    supabase
      .from("clinic_patient_profiles")
      .select(`contact_id, ${COLUNAS_DO_PERFIL}`)
      .eq("organization_id", org)
      .in("contact_id", lido.data),
  ]);
  if (e1 || e2) return fail("internal_error", (e1 ?? e2)!.message, 500, { requestId });

  const perfilPorContato = new Map(
    ((perfis ?? []) as (PerfilDoPaciente & { contact_id: string })[]).map((p) => [p.contact_id, p]),
  );
  const hoje = hojeNaClinica();
  const situacao: Record<string, { completa: boolean; faltando: number }> = {};
  for (const c of (contatos ?? []) as ContatoDaFicha[]) {
    const s = situacaoDe(c, perfilPorContato.get(c.id) ?? null, hoje);
    situacao[c.id] = { completa: s.completa, faltando: s.faltando.length };
  }
  return ok(situacao, { requestId });
}
