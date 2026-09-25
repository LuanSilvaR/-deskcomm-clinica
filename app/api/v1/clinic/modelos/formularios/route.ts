/**
 * GET /api/v1/clinic/modelos/formularios?tipo=anamnese|avaliacao&especialidade=<uuid>
 *
 * Os modelos ATIVOS do tipo, com os campos da versão atual. Com `especialidade`,
 * só os que servem a ela (modelo sem especialidade serve a todas) — é assim que
 * a área do atendimento oferece "Avaliação facial" a quem atende estética sem
 * nenhum `if` de especialidade no código.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { lerCampos } from "@/lib/clinic/prontuario/leitura";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const query = z
  .object({ tipo: z.enum(["anamnese", "avaliacao"]), especialidade: z.string().uuid().optional() })
  .strict();

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("prontuario.ver", { requestId, resource: "clinic_modelos_formulario" });
  if (!authz.ok) return authz.response;
  const lido = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!lido.success) return fail("validation_failed", "Parâmetros inválidos.", 422, { requestId });
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_modelos_formulario")
    .select("id, nome, descricao, especialidades, padrao, versao_atual, clinic_modelos_formulario_versoes(id, numero, campos)")
    .eq("organization_id", org)
    .eq("tipo", lido.data.tipo)
    .eq("ativo", true)
    .order("padrao", { ascending: false })
    .order("nome", { ascending: true });
  if (error) return fail("internal_error", error.message, 500, { requestId });

  const esp = lido.data.especialidade;
  const modelos = (data ?? [])
    .filter((m) => {
      const lista = (m.especialidades as string[] | null) ?? [];
      return !esp || lista.length === 0 || lista.includes(esp);
    })
    .map((m) => {
      const versoes = (m.clinic_modelos_formulario_versoes as Array<{ id: string; numero: number; campos: unknown }> | null) ?? [];
      const atual = versoes.find((v) => v.numero === m.versao_atual) ?? versoes.sort((a, b) => b.numero - a.numero)[0];
      return {
        id: m.id as string,
        nome: m.nome as string,
        descricao: (m.descricao as string | null) ?? null,
        padrao: m.padrao as boolean,
        versao_id: atual?.id ?? null,
        numero: atual?.numero ?? null,
        campos: lerCampos(atual?.campos),
      };
    })
    .filter((m) => m.versao_id);
  return ok({ modelos }, { requestId });
}
