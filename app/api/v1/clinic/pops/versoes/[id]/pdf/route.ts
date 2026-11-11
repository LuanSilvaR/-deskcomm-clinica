/**
 * GET /api/v1/clinic/pops/versoes/:id/pdf — FORK clinic (9015): o POP em PDF A4.
 *
 * `pops.imprimir`. Qualquer versão (a vigente, uma substituída, o rascunho): a
 * que não é a vigente sai com o aviso em todas as páginas. Papel timbrado do
 * motor único de documentos: marca, contatos, endereço, CNPJ, cores, logo e
 * favicon vêm de Configurações (`resolverContextoDaMarca`), nunca do POP.
 * Auditado (`clinic.pop_impresso`), sem o conteúdo.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { validarDocumento, type NoDoDocumento } from "@/lib/clinic/pops/documento";
import { dadosDaImpressaoDoPop, type StatusDaVersao } from "@/lib/clinic/pops/impressao";
import { nomesDosMembros } from "@/lib/clinic/pops/servidor";
import { resolverContextoDaMarca } from "@/lib/documentos/contexto-da-marca";
import { renderizarDocumento } from "@/lib/documentos/renderizar";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function nomeDoArquivo(codigo: string, major: number, minor: number): string {
  return `${codigo}-v${major}.${minor}.pdf`.replace(/[^A-Za-z0-9._-]/g, "_");
}

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("pops.imprimir", { requestId, resource: "clinic_pop_versions" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", "id inválido", 422, { requestId });
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data: versao } = await supabase
    .from("clinic_pop_versions")
    .select("id, pop_id, major, minor, status, content, created_at, created_by, updated_at, updated_by, approved_at, approved_by")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (!versao) return fail("not_found", t("POP não encontrado."), 404, { requestId });
  const v = versao as {
    pop_id: string;
    major: number;
    minor: number;
    status: StatusDaVersao;
    content: unknown;
    created_at: string;
    created_by: string | null;
    updated_at: string;
    updated_by: string | null;
    approved_at: string | null;
    approved_by: string | null;
  };

  const [{ data: pop }, { data: organizacao }, contexto] = await Promise.all([
    supabase.from("clinic_pops").select("code, clinic_procedures(name)").eq("organization_id", org).eq("id", v.pop_id).maybeSingle(),
    supabase.from("organizations").select("timezone").eq("id", org).maybeSingle(),
    resolverContextoDaMarca(supabase, org),
  ]);
  if (!pop || !organizacao || !contexto) return fail("not_found", t("POP não encontrado."), 404, { requestId });
  const p = pop as { code: string; clinic_procedures: { name: string } | { name: string }[] | null };
  const procedimento = (Array.isArray(p.clinic_procedures) ? p.clinic_procedures[0]?.name : p.clinic_procedures?.name) ?? "";
  const o = organizacao as { timezone: string | null };

  // O conteúdo já foi validado ao gravar; aqui, de novo — o PDF só desenha a lista fechada.
  const doc = validarDocumento(v.content);
  const conteudo: NoDoDocumento = doc.ok ? doc.documento : { type: "doc", content: [] };

  const nomes = await nomesDosMembros(org, [v.created_by, v.updated_by, v.approved_by]);
  const nome = (x: string | null) => (x ? (nomes[x] ?? null) : null);

  const buf = await renderizarDocumento(
    dadosDaImpressaoDoPop({
      procedimento,
      codigo: p.code,
      versao: { major: v.major, minor: v.minor, status: v.status },
      criado: { por: nome(v.created_by), em: v.created_at },
      atualizado: { por: nome(v.updated_by), em: v.updated_at },
      aprovado: { por: nome(v.approved_by), em: v.approved_at },
      impressoEm: new Date(),
      fuso: o.timezone || "America/Sao_Paulo",
      tag: authz.user.idioma === "es" ? "es" : "pt-BR",
      conteudo,
    }),
    contexto,
  );

  void audit({
    action: "clinic.pop_impresso",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_pop_version",
    resourceId: id,
    requestId,
    metadata: { pop: v.pop_id, codigo: p.code, versao: `${v.major}.${v.minor}`, status: v.status },
  });

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nomeDoArquivo(p.code, v.major, v.minor)}"`,
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
    },
  });
}
