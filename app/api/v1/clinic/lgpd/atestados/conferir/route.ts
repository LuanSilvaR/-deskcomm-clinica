/** POST /api/v1/clinic/lgpd/atestados/conferir { codigo }: confere um código curto na org. Só leitura. */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { normalizarCodigoCurto } from "@/lib/clinic/lgpd/atestado";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

import { atestadoLigado, recursoDesligado } from "../_comum";

export const dynamic = "force-dynamic";

const corpo = z.object({ codigo: z.string().min(1).max(64) });

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "clinic_atestados_anonimizacao" });
  if (!authz.ok) return authz.response;
  const orgId = authz.org.orgId;

  const admin = createAdminClient();
  if (!(await atestadoLigado(admin, orgId))) return recursoDesligado(requestId);

  const entrada = corpo.safeParse(await req.json().catch(() => null));
  const codigo = entrada.success ? normalizarCodigoCurto(entrada.data.codigo) : null;
  if (!codigo) return fail("validation_error", "Código inválido.", 422, { requestId });

  const { data, error } = await admin
    .from("clinic_atestados_anonimizacao")
    .select("id, contact_id, anonimizado_em, emitido_em, algoritmo, executor_nome:executor->>nome")
    .eq("organization_id", orgId)
    .eq("codigo_curto", codigo)
    .maybeSingle();
  if (error) return fail("internal_error", "Não foi possível conferir o código.", 500, { requestId });
  if (!data) return ok({ encontrado: false }, { requestId });
  const l = data as { id: string; contact_id: string; anonimizado_em: string; emitido_em: string; algoritmo: string; executor_nome: string | null };
  return ok(
    {
      encontrado: true,
      atestado: {
        id: l.id,
        contact_id: l.contact_id,
        anonimizado_em: l.anonimizado_em,
        emitido_em: l.emitido_em,
        executor_nome: l.executor_nome,
        algoritmo: l.algoritmo,
      },
    },
    { requestId },
  );
}
