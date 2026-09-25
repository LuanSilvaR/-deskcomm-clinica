/**
 * FORK clinic (prontuário F7) — anexos e fotos do paciente.
 *
 * GET  — os arquivos que a pessoa pode ver (a RLS filtra por tipo: fotos.ver /
 *        anexos.ver), o uso da cota e as finalidades de divulgação que o
 *        paciente autorizou no termo de uso de imagem.
 * POST — multipart: `arquivo`, `miniatura` (fotos) e `dados` (JSON). O tipo real
 *        vem dos BYTES; o arquivo sobe ao bucket privado pelo service role e só
 *        então é registrado (o banco confere permissão, paciente, prefixo do
 *        caminho e cota). Registro falhou → o upload é desfeito.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { armazenamentoClinico } from "@/lib/clinic/anexos/armazenamento";
import {
  caminhoDoArquivo,
  farejarArquivoClinico,
  sha256DeBytes,
  TAMANHO_MAXIMO,
  TAMANHO_MAXIMO_MINIATURA,
} from "@/lib/clinic/anexos/arquivo";
import { erroDoBanco } from "@/lib/clinic/atendimento/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ contactId: string }> };

const OPCOES_DE_DIVULGACAO = ["ensino_sem_identificacao", "divulgacao_sem_rosto", "divulgacao_com_identificacao"] as const;

const dadosSchema = z
  .object({
    tipo: z.enum(["foto", "documento"]),
    descricao: z.string().max(500).nullish(),
    regiao: z.string().max(120).nullish(),
    momento: z.enum(["antes", "durante", "depois", "acompanhamento"]).nullish(),
    capturada_em: z.string().datetime({ offset: true }).nullish(),
    atendimento_id: z.string().uuid().nullish(),
    plano_id: z.string().uuid().nullish(),
    largura: z.number().int().min(1).max(20_000).nullish(),
    altura: z.number().int().min(1).max(20_000).nullish(),
  })
  .strict();

function lerJson(v: FormDataEntryValue | null | undefined): unknown {
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("prontuario.ver", { requestId, resource: "clinic_anexos" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { contactId } = await ctx.params;
  if (!z.string().uuid().safeParse(contactId).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const [anexos, uso] = await Promise.all([
    supabase
      .from("clinic_anexos")
      .select(
        "id, tipo, mime, bytes, nome_original, descricao, largura, altura, regiao, momento, capturada_em, divulgacao_opcao, " +
          "status, anulado_motivo, atendimento_id, plano_id, miniatura_key, created_at",
      )
      .eq("organization_id", org)
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.rpc("fn_clinic_uso_de_arquivos", { p_org: org }),
  ]);
  if (anexos.error) return fail("internal_error", anexos.error.message, 500, { requestId });
  // Finalidades autorizadas no termo (9023). A função não é de `authenticated`:
  // o service role pergunta, com a organização da SESSÃO.
  const admin = createAdminClient();
  const autorizadas: string[] = [];
  for (const opcao of OPCOES_DE_DIVULGACAO) {
    const { data } = await admin.rpc("fn_clinic_uso_de_imagem_autorizado", { p_org: org, p_contact: contactId, p_opcao: opcao });
    if (data === true) autorizadas.push(opcao);
  }
  return ok(
    {
      anexos: (anexos.data ?? []).map((a) => {
        const { miniatura_key, ...resto } = a as unknown as Record<string, unknown>;
        return { ...resto, tem_miniatura: !!miniatura_key };
      }),
      uso: (uso.data as { usados: number; cota: number } | null) ?? null,
      divulgacao_autorizada: autorizadas,
      pode_enviar_foto: authz.permissoes.has("fotos.enviar"),
      pode_enviar_anexo: authz.permissoes.has("anexos.enviar"),
    },
    { requestId },
  );
}

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const form = await req.formData().catch(() => null);
  const dadosBrutos = form?.get("dados");
  const lido = dadosSchema.safeParse(lerJson(dadosBrutos));
  const authz = await requirePermission(lido.success && lido.data.tipo === "foto" ? "fotos.enviar" : "anexos.enviar", {
    requestId,
    resource: "clinic_anexos",
  });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { contactId } = await ctx.params;
  if (!z.string().uuid().safeParse(contactId).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const d = lido.data;
  const arquivo = form?.get("arquivo");
  if (!(arquivo instanceof File)) return fail("validation_failed", t("Envie o arquivo."), 422, { requestId });
  if (arquivo.size > TAMANHO_MAXIMO) return fail("payload_too_large", t("O arquivo precisa ter até 10 MB."), 413, { requestId });

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const tipo = farejarArquivoClinico(bytes);
  if (!tipo || (d.tipo === "foto" && !tipo.startsWith("image/"))) {
    return fail("unsupported_media_type", t("Aceitamos fotos JPG, PNG ou WebP e documentos PDF."), 415, { requestId });
  }
  let mini: { bytes: Uint8Array; tipo: string } | null = null;
  const miniatura = form?.get("miniatura");
  if (miniatura instanceof File) {
    const b = new Uint8Array(await miniatura.arrayBuffer());
    const tm = farejarArquivoClinico(b);
    if (miniatura.size > TAMANHO_MAXIMO_MINIATURA || !tm || !tm.startsWith("image/")) {
      return fail("unsupported_media_type", t("Miniatura inválida."), 415, { requestId });
    }
    mini = { bytes: b, tipo: tm };
  }

  const org = authz.org.orgId;
  const loja = armazenamentoClinico();
  const chave = caminhoDoArquivo(org, contactId, randomUUID(), tipo);
  const chaveMini = mini ? caminhoDoArquivo(org, contactId, randomUUID(), mini.tipo as typeof tipo) : null;
  try {
    await loja.salvar(chave, bytes, tipo);
    if (mini && chaveMini) await loja.salvar(chaveMini, mini.bytes, mini.tipo);
  } catch {
    await loja.apagar([chave, ...(chaveMini ? [chaveMini] : [])]).catch(() => undefined);
    return fail("internal_error", t("Não foi possível guardar o arquivo."), 500, { requestId });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_anexo_registrar", {
    p_org: org,
    p_contact: contactId,
    p_dados: {
      ...d,
      storage_key: chave,
      miniatura_key: chaveMini,
      mime: tipo,
      bytes: bytes.byteLength,
      miniatura_bytes: mini?.bytes.byteLength ?? 0,
      sha256: sha256DeBytes(bytes),
      nome_original: arquivo.name.slice(0, 200) || null,
    },
  });
  if (error) {
    await loja.apagar([chave, ...(chaveMini ? [chaveMini] : [])]).catch(() => undefined);
    const e = erroDoBanco(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { id: string };
  void audit({
    action: "clinic.anexo_enviado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_anexo",
    resourceId: r.id,
    requestId,
    metadata: { tipo: d.tipo, mime: tipo, bytes: bytes.byteLength, contact_id: contactId },
  });
  return ok(r, { requestId });
}
