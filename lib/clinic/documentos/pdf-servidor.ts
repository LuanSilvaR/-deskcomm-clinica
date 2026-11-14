/**
 * FORK clinic (papel timbrado D3) — o PDF de um documento EMITIDO.
 *
 * Usado pela rota `GET /api/v1/clinic/documentos/[id]/pdf` e pelo PDF do
 * contrato do orçamento. Quem chama já conferiu permissão e escopo de paciente;
 * aqui a organização vem do chamador (sessão), e toda leitura filtra por ela.
 *
 * A marca do documento é a do SNAPSHOT (migration 8014): na primeira geração,
 * os dados crus de Configurações são fixados no documento
 * (`fn_clinic_documento_fixar_marca`, uma vez só); daí em diante toda
 * reimpressão sai com os mesmos textos, nomes e logo, mesmo que a Organização
 * ou a Marca mudem. Só as CORES seguem as Configurações de agora (#126).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { nomeDoContato } from "@/lib/contacts/rotulo-do-contato";
import { tagDeIdioma } from "@/lib/i18n/datas";
import {
  comCoresAtuais,
  contextoDoSnapshot,
  ehSnapshotDaMarca,
  lerEntradaDoContexto,
  type SnapshotDaMarca,
} from "@/lib/documentos/contexto-da-marca";
import { renderizarDocumento, VERSAO_DO_LAYOUT } from "@/lib/documentos/renderizar";
import { logger } from "@/lib/logger";

import { documentoEmitidoParaTimbrado } from "./timbrado";

interface Linha {
  id: string;
  tipo: string;
  titulo: string;
  conteudo: string;
  sha256: string;
  status: string;
  created_at: string;
  validade_ate: string | null;
  marca_snapshot: unknown;
  contacts: { name: string | null; display_name: string | null; phone_number: string | null } | null;
  clinic_documento_aceites: { tipo: string; canal: string; nome_digitado: string | null; motivo: string | null; created_at: string }[] | null;
}

export interface PdfDoDocumento {
  pdf: Buffer;
  titulo: string;
  status: string;
}

/**
 * @param sessao client da sessão — lê a organização (RLS) para o snapshot.
 * @param admin  service role — lê o documento e fixa o snapshot, sempre filtrando `orgId`.
 */
export async function gerarPdfDoDocumentoEmitido(opcoes: {
  sessao: SupabaseClient;
  admin: SupabaseClient;
  orgId: string;
  documentoId: string;
  numero?: string | null;
  /** Restrição extra (ex.: o contrato tem de ser DESTE orçamento). */
  orcamentoId?: string;
}): Promise<PdfDoDocumento | null> {
  const { sessao, admin, orgId, documentoId } = opcoes;
  let consulta = admin
    .from("clinic_documentos_emitidos")
    .select(
      "id, tipo, titulo, conteudo, sha256, status, created_at, validade_ate, marca_snapshot, contacts:contact_id(name, display_name, phone_number), clinic_documento_aceites(tipo, canal, nome_digitado, motivo, created_at)",
    )
    .eq("organization_id", orgId)
    .eq("id", documentoId);
  if (opcoes.orcamentoId) consulta = consulta.eq("orcamento_id", opcoes.orcamentoId);
  const { data } = await consulta.maybeSingle();
  if (!data) return null;
  const d = data as unknown as Linha;

  // Snapshot: o guardado ou, na primeira geração, o de agora — fixado uma vez.
  let snapshot: SnapshotDaMarca | null = ehSnapshotDaMarca(d.marca_snapshot) ? d.marca_snapshot : null;
  if (!snapshot) {
    const entrada = await lerEntradaDoContexto(sessao, orgId);
    if (!entrada) return null;
    snapshot = entrada;
    const { error } = await admin.rpc("fn_clinic_documento_fixar_marca", {
      p_org: orgId,
      p_doc: documentoId,
      p_snapshot: snapshot,
      p_versao: VERSAO_DO_LAYOUT,
    });
    // Falhar em fixar não impede o PDF: sai com o contexto de agora, e a próxima tentativa fixa.
    if (error) logger.warn("[documentos/pdf] não fixou o snapshot da marca", { codigo: error.code, documento: documentoId });
  } else {
    snapshot = comCoresAtuais(snapshot, await lerEntradaDoContexto(sessao, orgId));
  }
  const contexto = await contextoDoSnapshot(snapshot, orgId);

  const { data: org } = await sessao.from("organizations").select("timezone").eq("id", orgId).maybeSingle();
  const fuso = (org as { timezone?: string | null } | null)?.timezone || "America/Sao_Paulo";
  const data_ = (iso: string, comHora: boolean) => {
    const opcoesDeData: Intl.DateTimeFormatOptions = comHora
      ? { dateStyle: "short", timeStyle: "short", timeZone: fuso }
      : { dateStyle: "short", timeZone: /^\d{4}-\d{2}-\d{2}$/.test(iso) ? "UTC" : fuso };
    return new Intl.DateTimeFormat(tagDeIdioma("pt-BR"), opcoesDeData).format(new Date(iso));
  };

  const aceite = (d.clinic_documento_aceites ?? []).find((a) => a.tipo === "aceite") ?? null;
  const revogacao = (d.clinic_documento_aceites ?? []).find((a) => a.tipo === "revogacao") ?? null;
  const doc = documentoEmitidoParaTimbrado(
    {
      id: d.id,
      tipo: d.tipo,
      titulo: d.titulo,
      conteudo: d.conteudo,
      sha256: d.sha256,
      status: d.status,
      criadoEm: d.created_at,
      validadeAte: d.validade_ate,
      paciente: nomeDoContato(d.contacts),
      aceite: aceite ? { nome: aceite.nome_digitado, canal: aceite.canal, em: aceite.created_at } : null,
      revogacao: revogacao ? { em: revogacao.created_at, motivo: revogacao.motivo } : null,
      numero: opcoes.numero ?? null,
    },
    { data: (iso) => data_(iso, false), dataHora: (iso) => data_(iso, true) },
  );
  return { pdf: await renderizarDocumento(doc, contexto), titulo: d.titulo, status: d.status };
}
