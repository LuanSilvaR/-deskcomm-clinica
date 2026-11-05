/**
 * GET /api/v1/clinic/cep/:cep — o endereço de um CEP, para a ficha do paciente
 * preencher logradouro, bairro, cidade, UF e código IBGE sozinha (#86).
 *
 * Quem pode editar a ficha pode perguntar (`pacientes.editar_ficha`). O CEP é o
 * único dado que sai daqui para o serviço externo — nada do paciente.
 *
 * "Não encontrado" e "serviço fora do ar" voltam 200 com `tipo`: não são erro
 * da requisição, são respostas que a tela transforma em aviso, e o endereço
 * continua sendo preenchido à mão.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { consultarCep, normalizarCep } from "@/lib/clinic/pacientes/cep";
import { traduzir } from "@/lib/i18n/dicionario";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ cep: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("pacientes.editar_ficha", { requestId, resource: "clinic_patient_profiles" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);

  const cep = normalizarCep((await ctx.params).cep);
  if (!cep) return fail("validation_failed", t("CEP com 8 números."), 422, { requestId });

  return ok(await consultarCep(cep), { requestId });
}
