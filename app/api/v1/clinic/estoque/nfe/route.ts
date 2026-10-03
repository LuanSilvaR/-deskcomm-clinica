/**
 * /api/v1/clinic/estoque/nfe — FORK clinic (estoque E5).
 *
 * POST (multipart, campo `arquivo`): importa o XML da NF-e. Lê no servidor
 * (lib/clinic/estoque/nfe/parser.ts: sem DOCTYPE/entidades, até 1 MB), sugere o
 * produto de cada item (de/para) e grava em CONFERÊNCIA. O XML vai para o
 * bucket privado `clinic-nfe` (só por aqui, service role); se o registro
 * falhar, o upload é desfeito. Chave repetida → 409. CNPJ do destinatário
 * diferente do da clínica → aviso (a nota ainda pode ser conferida).
 * GET: as notas mais recentes. `estoque.compras` (POST) / `estoque.ver` (GET).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { sha256DeBytes } from "@/lib/clinic/anexos/arquivo";
import { erroDoEstoque } from "@/lib/clinic/estoque/erros";
import { sugerirCasamentos } from "@/lib/clinic/estoque/nfe/depara";
import { lerNfe, NfeInvalida, TAMANHO_MAXIMO_NFE, type MotivoNfeInvalida } from "@/lib/clinic/estoque/nfe/parser";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BUCKET_NFE = "clinic-nfe";

const MENSAGEM_DO_MOTIVO: Record<MotivoNfeInvalida, string> = {
  grande_demais: "O XML precisa ter até 1 MB.",
  dtd_proibido: "Este XML não é uma NF-e válida.",
  nao_e_nfe: "Este arquivo não é o XML de uma NF-e.",
  chave_invalida: "A chave de acesso da NF-e é inválida.",
  sem_itens: "A NF-e não tem itens.",
};

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("estoque.ver", { requestId, resource: "clinic_estoque_nfe" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_estoque_nfe")
    .select("id, chave, numero, serie, emissao, emitente_nome, total_cents, status, created_at")
    .eq("organization_id", authz.org.orgId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return fail("internal_error", t("Não foi possível ler as notas."), 500, { requestId });
  return ok({ notas: data ?? [], pode_comprar: authz.permissoes.has("estoque.compras") }, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  // Sessão e permissão ANTES de ler o corpo.
  const authz = await requirePermission("estoque.compras", { requestId, resource: "clinic_estoque_nfe" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const form = await req.formData().catch(() => null);
  const arquivo = form?.get("arquivo");
  if (!(arquivo instanceof File)) return fail("validation_failed", t("Envie o arquivo XML da NF-e."), 422, { requestId });
  if (arquivo.size > TAMANHO_MAXIMO_NFE) return fail("payload_too_large", t("O XML precisa ter até 1 MB."), 413, { requestId });

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  let nfe;
  try {
    nfe = lerNfe(new TextDecoder("utf-8", { fatal: false }).decode(bytes));
  } catch (e) {
    if (e instanceof NfeInvalida) return fail("validation_failed", t(MENSAGEM_DO_MOTIVO[e.motivo]), 422, { requestId });
    return fail("validation_failed", t("Este arquivo não é o XML de uma NF-e."), 422, { requestId });
  }

  const org = authz.org.orgId;
  const supabase = await createClient();
  const [{ data: repetida }, { data: empresa }] = await Promise.all([
    supabase.from("clinic_estoque_nfe").select("id").eq("organization_id", org).eq("chave", nfe.chave).maybeSingle(),
    supabase.from("organizations").select("cnpj").eq("id", org).maybeSingle(),
  ]);
  if (repetida) return fail("conflict", t("Esta NF-e já foi importada (mesma chave de acesso)."), 409, { requestId });
  const cnpjDaClinica = ((empresa as { cnpj?: string | null } | null)?.cnpj ?? "").replace(/\D/g, "");
  const outroDestinatario = Boolean(cnpjDaClinica && nfe.destinatario_cnpj && cnpjDaClinica !== nfe.destinatario_cnpj);

  const sugestoes = await sugerirCasamentos(supabase, org, nfe);
  const caminho = `${org}/${nfe.chave}-${randomUUID()}.xml`;
  const bucket = createAdminClient().storage.from(BUCKET_NFE);
  const { error: erroUpload } = await bucket.upload(caminho, Buffer.from(bytes), {
    contentType: "application/xml",
    upsert: false,
  });
  if (erroUpload) return fail("internal_error", t("Não foi possível guardar o arquivo."), 500, { requestId });

  const { data, error } = await supabase.rpc("fn_clinic_estoque_nfe_registrar", {
    p_org: org,
    p_dados: {
      chave: nfe.chave,
      numero: nfe.numero,
      serie: nfe.serie,
      emissao: nfe.emissao,
      emitente: nfe.emitente,
      destinatario_cnpj: nfe.destinatario_cnpj,
      total_cents: nfe.total_cents,
      arquivo_path: caminho,
      sha256: sha256DeBytes(bytes),
      itens: nfe.itens.map((i, n) => ({
        numero: i.numero,
        codigo: i.codigo,
        descricao: i.descricao,
        ean: i.ean,
        ncm: i.ncm,
        unidade: i.unidade,
        quantidade: i.quantidade,
        valor_total_cents: i.valor_total_cents,
        custo_total_cents: i.custo_total_cents,
        registro_anvisa: i.registro_anvisa,
        rastro: i.rastro,
        ...sugestoes[n],
      })),
    },
  });
  if (error) {
    await bucket.remove([caminho]).catch(() => undefined);
    const e = erroDoEstoque(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { id: string };
  void audit({
    action: "clinic.estoque_nfe_importada",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_estoque_nfe",
    resourceId: r.id,
    requestId,
    metadata: { numero: nfe.itens.length },
  });
  return ok(
    { id: r.id, outro_destinatario: outroDestinatario, sugeridos: sugestoes.filter((s) => s.product_id).length },
    { requestId, status: 201 },
  );
}
