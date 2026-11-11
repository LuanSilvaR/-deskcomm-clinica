/**
 * Emissão do atestado de anonimização (LGPD, #87): conta o que foi retido,
 * renderiza o PDF no papel timbrado, guarda no bucket e grava a linha.
 * Nunca lança: toda falha volta como `{ ok: false, erro }`.
 * `orgId` e `contactId` vêm de fonte confiável (nunca do body).
 */
import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolverContextoDaMarca } from "@/lib/documentos/contexto-da-marca";
import { renderizarDocumento } from "@/lib/documentos/renderizar";
import { signPdfPades } from "@/lib/lgpd/pades-signer";

import {
  CATEGORIAS_RETIDAS,
  VERSAO_DO_ATESTADO,
  codigoCurto,
  codigoDoAtestado,
  type CategoriaRetida,
  type DadosDoAtestado,
  type ExecutorDoAtestado,
  type Retidos,
} from "./atestado";
import { montarDocumentoDoAtestado } from "./atestado-pdf";

export { montarDocumentoDoAtestado };

export const BUCKET_DO_ATESTADO = "lgpd-exports";

export async function contarRetidos(admin: SupabaseClient, orgId: string, contactId: string): Promise<Retidos> {
  const retidos: Retidos = {};
  for (const categoria of Object.keys(CATEGORIAS_RETIDAS) as CategoriaRetida[]) {
    let total = 0;
    for (const tabela of CATEGORIAS_RETIDAS[categoria].tabelas) {
      const { count, error } = await admin
        .from(tabela)
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("contact_id", contactId);
      if (error) throw new Error(`contagem_falhou:${tabela}:${error.message}`);
      total += count ?? 0;
    }
    if (total > 0) retidos[categoria] = total;
  }
  return retidos;
}

export interface PedidoDeEmissao {
  orgId: string;
  contactId: string;
  anonimizadoEm: string;
  executor: ExecutorDoAtestado;
  ip: string | null;
}

export type ResultadoDaEmissao =
  | { ok: true; atestado: { id: string; codigo_curto: string; algoritmo: "hmac-sha256" | "sha256"; emitido_em: string } }
  | { ok: false; erro: string; jaExistia?: boolean };

export async function emitirAtestado(admin: SupabaseClient, p: PedidoDeEmissao): Promise<ResultadoDaEmissao> {
  try {
    const { data: existente, error: erroExistente } = await admin
      .from("clinic_atestados_anonimizacao")
      .select("id")
      .eq("organization_id", p.orgId)
      .eq("contact_id", p.contactId)
      .maybeSingle();
    if (erroExistente) return { ok: false, erro: `leitura_falhou:${erroExistente.message}` };
    if (existente) return { ok: false, erro: "ja_emitido", jaExistia: true };

    const { data: contato, error: erroContato } = await admin
      .from("contacts")
      .select("id")
      .eq("organization_id", p.orgId)
      .eq("id", p.contactId)
      .maybeSingle();
    if (erroContato) return { ok: false, erro: `leitura_falhou:${erroContato.message}` };
    if (!contato) return { ok: false, erro: "contato_nao_encontrado" };

    const { data: org, error: erroOrg } = await admin
      .from("organizations")
      .select("legal_name, display_name, cnpj, timezone")
      .eq("id", p.orgId)
      .maybeSingle();
    if (erroOrg || !org) return { ok: false, erro: `organizacao_nao_encontrada${erroOrg ? `:${erroOrg.message}` : ""}` };
    const o = org as { legal_name: string | null; display_name: string | null; cnpj: string | null; timezone: string | null };

    const retidos = await contarRetidos(admin, p.orgId, p.contactId);
    const id = randomUUID();
    const emitidoEm = new Date().toISOString();
    const dados: DadosDoAtestado = {
      atestado_id: id,
      organization_id: p.orgId,
      organization_name: o.legal_name?.trim() || o.display_name?.trim() || "Organização",
      organization_document: o.cnpj?.trim() || null,
      executor: p.executor,
      ip: p.ip,
      anonimizado_em: p.anonimizadoEm,
      emitido_em: emitidoEm,
      retidos,
      fuso: o.timezone?.trim() || "America/Sao_Paulo",
    };
    const { codigo, algoritmo } = codigoDoAtestado(dados, process.env.LGPD_SIGNING_KEY ?? null);
    const curto = codigoCurto(codigo);

    const contexto = await resolverContextoDaMarca(admin, p.orgId);
    if (!contexto) return { ok: false, erro: "marca_indisponivel" };
    const pdf = await renderizarDocumento(montarDocumentoDoAtestado(dados, { curto, algoritmo }), contexto);
    const assinado = await signPdfPades(pdf);

    const caminho = `${p.orgId}/atestados/${id}/atestado.pdf`;
    const { error: erroUpload } = await admin.storage
      .from(BUCKET_DO_ATESTADO)
      .upload(caminho, assinado.signed, { contentType: "application/pdf", upsert: true });
    if (erroUpload) return { ok: false, erro: `upload_falhou:${erroUpload.message}` };

    const { error: erroInsert } = await admin.from("clinic_atestados_anonimizacao").insert({
      id,
      organization_id: p.orgId,
      contact_id: p.contactId,
      anonimizado_em: p.anonimizadoEm,
      emitido_em: emitidoEm,
      executor: p.executor,
      ip: p.ip,
      retidos,
      codigo,
      codigo_curto: curto,
      algoritmo,
      pdf_path: caminho,
      pdf_sha256: assinado.sha256,
      pades: assinado.signed_pades,
      versao: VERSAO_DO_ATESTADO,
    });
    if (erroInsert) {
      await admin.storage.from(BUCKET_DO_ATESTADO).remove([caminho]);
      if (erroInsert.code === "23505") return { ok: false, erro: "ja_emitido", jaExistia: true };
      return { ok: false, erro: `gravacao_falhou:${erroInsert.message}` };
    }
    return { ok: true, atestado: { id, codigo_curto: curto, algoritmo, emitido_em: emitidoEm } };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "erro_desconhecido" };
  }
}
