/**
 * LGPD export PDF renderer (PT-BR) — Art. 18, II (direito de acesso aos dados).
 *
 * FORK clinic (papel timbrado D4, docs/padrao-documentos.md): o relatório sai
 * no PAPEL TIMBRADO único — cabeçalho e rodapé da clínica, que É o controlador
 * dos dados no fork (decisão do dono do produto, 2026-11-08). O que o arquivo
 * original protegia continua: a linha "Controlador: <RAZÃO SOCIAL> · … ·
 * Encarregado (DPO)" vai no corpo E numa linha fixa em TODAS as páginas, e
 * nomeia o CONTROLADOR (`organizations.legal_name`), nunca o nome fantasia nem
 * o do software. Registrado no UPSTREAM.md.
 *
 * Este arquivo só monta CONTEÚDO (`lgpdParaTimbrado`); marca, cores e fontes
 * são do motor (lib/documentos). As frases e a ordem das seções são as de antes.
 */

import type { NoDoDocumento } from "@/lib/clinic/pops/documento";
import { montarContextoDaMarca, type ContextoDaMarca } from "@/lib/documentos/contexto-da-marca";
import { renderizarDocumento, type DocumentoTimbrado } from "@/lib/documentos/renderizar";

import type { ExportPayload } from "./export-collector";

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return s;
  }
}

function fmtMoney(cents: number | null | undefined, currency: string | null | undefined): string {
  if (cents == null) return "—";
  const v = cents / 100;
  return `${currency ?? "BRL"} ${v.toFixed(2)}`;
}

/**
 * A MESMA cadeia que `lib/lgpd/sla-alarm.ts:93` já usa
 * (organização acima, instalação abaixo — resolvida pelo coletor). Reusar a ordem, e não
 * inventar outra, é o que impede o documento e o alarme de apontarem para
 * encarregados diferentes na mesma organização.
 *
 * O texto anterior era `DPO: contato via canal oficial do controlador` — um
 * não-resposta num campo cuja função é dizer a quem o titular reclama.
 */
function encarregado(data: ExportPayload): string {
  // O renderizador não consulta configuração: ele desenha o que recebeu. Quem
  // resolve o encarregado (organização acima, instalação abaixo) é o coletor,
  // que é assíncrono e já busca `dpo_email` da organização. Deixar a busca aqui
  // obrigaria um componente de PDF a falar com o banco no meio do desenho.
  return data.dpo_email || "não informado pelo controlador";
}

// Concluir o processamento do job não comprova envio: ele também pode terminar
// com um bloqueio. O relatório conserva essa diferença, sem anunciar entrega.
const deliveryStatus: Record<string, string> = {
  pending: "Pendente",
  running: "Em processamento",
  done: "Processamento concluído",
  failed: "Falha no processamento",
  dead: "Tentativas encerradas",
};
const noticeStatus: Record<string, string> = {
  open: "Aberto",
  resolved: "Resolvido",
  dismissed: "Dispensado",
};

const t = (texto: string, negrito = false): NoDoDocumento => ({ type: "text", text: texto, ...(negrito ? { marks: [{ type: "bold" }] } : {}) });
const p = (texto: string): NoDoDocumento => ({ type: "paragraph", content: [t(texto)] });
const secao = (titulo: string): NoDoDocumento => ({ type: "heading", attrs: { level: 2 }, content: [t(titulo)] });
const linha = (rotulo: string, valor: string): NoDoDocumento => ({ type: "paragraph", content: [t(`${rotulo}: `, true), t(valor)] });

/** A linha do CONTROLADOR — uma vez por página, fixa acima do rodapé (como o rodapé antigo). */
export function linhaDoControlador(data: ExportPayload): string {
  return `Controlador: ${data.organization_legal_name || "—"} · Relatório de Acesso aos Dados${data.lei_citada ? ` — ${data.lei_citada}` : ""} · Encarregado (DPO): ${encarregado(data)} · Validade do link de download conforme e-mail recebido`;
}

export function lgpdParaTimbrado(data: ExportPayload, unsignedWarning = false): DocumentoTimbrado {
  const shortId = data.request_id.slice(0, 8);
  const c: NoDoDocumento[] = [];
  const add = (...nos: NoDoDocumento[]) => c.push(...nos);

  add(p(`Base legal: ${data.lei_citada ?? "não declarada (país sem citação revisada)"} · Solicitação #${shortId}`));

  add(secao("Metadados da Solicitação"));
  add(
    linha("ID", data.request_id),
    linha("Organização", data.organization_legal_name || "—"),
    linha("ID interno", data.organization_id),
    linha("Gerado em", fmtDate(data.generated_at)),
  );
  if (data.no_local_footprint) add(linha("Status", "Nenhum dado pessoal localizado nos sistemas internos."));

  if (data.contact) {
    add(secao("Dados Pessoais (Contato)"));
    add(
      linha("Nome", data.contact.name ?? "—"),
      linha("Email", data.contact.email ?? "—"),
      linha("Telefone", data.contact.phone_number ?? "—"),
      linha(data.documento_rotulo, data.contact.cpf_present ? "Armazenado (criptografado)" : "—"),
      linha("Origem", data.contact.source ?? "—"),
      linha("Criado em", fmtDate(data.contact.created_at)),
      linha("Anonimizado", data.contact.is_anonymized ? "Sim" : "Não"),
    );
  }

  if (data.ficha_clinica) {
    add(secao("Ficha do paciente"));
    add(...linhasDaFicha(data.ficha_clinica).map(([r, v]) => linha(r, v)));
  }

  add(secao("Consentimentos"));
  if (data.consents.length === 0) add(p("Nenhum consentimento registrado."));
  else add(...data.consents.map((x) => linha(x.scope, `${x.granted ? "concedido" : "negado"}${x.granted_at ? ` em ${fmtDate(x.granted_at)}` : ""}`)));

  add(secao("Histórico de Atendimento"));
  add(
    p(
      `Total de conversas: ${data.conversations.length} · Total de mensagens: ${data.messages_count_total} · Amostra incluída neste relatório: ${data.messages_recent.length}`,
    ),
  );
  for (const x of data.conversations.slice(0, 10)) {
    add(p(`Conversa #${x.id.slice(0, 8)} · ${x.channel} · ${x.status}`), p(`Última mensagem: ${fmtDate(x.last_message_at)} · Criada em ${fmtDate(x.created_at)}`));
  }

  if (data.messages_recent.length > 0) {
    add(secao("Mensagens Recentes (amostra)"));
    for (const m of data.messages_recent.slice(0, 25)) {
      add(p(`${fmtDate(m.created_at)} · ${m.direction} · ${m.type} · ${m.status}`), p(m.body ? m.body.slice(0, 280) : m.has_media ? "[mídia]" : "—"));
    }
  }

  if (data.leads.length > 0) {
    add(secao("Atividade Comercial — Leads"));
    for (const l of data.leads) add(p(`${l.title ?? "(sem título)"} · ${l.status} · ${fmtMoney(l.value_cents, l.currency)}`), p(`Criado em ${fmtDate(l.created_at)}`));
  }

  if (data.orders.length > 0) {
    add(secao("Pedidos"));
    for (const o of data.orders) {
      add(
        p(`${o.external_provider ?? "—"} #${o.external_id ?? o.id.slice(0, 8)} · ${o.status} · ${fmtMoney(o.total_cents, o.currency)}`),
        p(`Pedido em ${fmtDate(o.ordered_at)}`),
      );
    }
  }

  if (data.appointments.length > 0) {
    add(secao("Agenda — Compromissos"));
    for (const x of data.appointments) {
      add(p(`${x.title ?? "(sem título)"} · ${x.status}${x.location_details ? ` · ${x.location_details}` : ""}`));
      add(p(`${fmtDate(x.starts_at)} até ${fmtDate(x.ends_at)} (${x.time_zone})`));
      if (x.description) add(p(x.description));
      if (x.notes) add(p(`Anotação: ${x.notes}`));
      if (x.meeting_url) add(p(`Link da reunião: ${x.meeting_url}`));
      if (x.cancellation_reason) add(p(`Cancelado: ${x.cancellation_reason}`));
    }
  }

  if (data.reply_drafts?.length) {
    add(secao("Sugestões e respostas revisadas"));
    for (const r of data.reply_drafts) {
      add(p(`Estado: ${r.status}`));
      if (r.original_body) add(p(`Sugestão: ${r.original_body}`));
      if (r.edited_body && r.edited_body !== r.original_body) add(p(`Edição: ${r.edited_body}`));
      if (r.approved_body) add(p(`Texto aprovado: ${r.approved_body}`));
      if (r.feedback) add(p(`Revisão: ${JSON.stringify(r.feedback)}`));
      if (Array.isArray(r.proposals) && r.proposals.length) add(p(`Propostas: ${JSON.stringify(r.proposals)}`));
      add(p(`Criado em ${fmtDate(r.created_at)}`));
    }
  }

  if (data.meeting_deliveries?.length) {
    add(secao("Entregas de links de reunião"));
    for (const d of data.meeting_deliveries) {
      add(
        p(deliveryStatus[d.status] ?? d.status),
        p(`Registro: ${d.id}`),
        p(`Compromisso: ${d.appointment_id ?? "referência indisponível"}`),
        p(`Criado em ${fmtDate(d.created_at)} · Programado para ${fmtDate(d.run_after)}`),
      );
    }
  }

  if (data.appointment_notices?.length) {
    add(secao("Avisos sobre compromissos"));
    for (const n of data.appointment_notices) {
      add(p(`${n.title} · ${noticeStatus[n.status] ?? n.status}`));
      if (n.body) add(p(n.body));
      add(p(`Registro: ${n.id}`), p(`Compromisso: ${n.ref_id ?? "referência indisponível"}`));
      add(p(`Criado em ${fmtDate(n.created_at)}${n.resolved_at ? ` · Resolvido em ${fmtDate(n.resolved_at)}` : ""}`));
    }
  }

  if (data.webhook_captures.length > 0) {
    add(secao("Como seus dados chegaram até nós"));
    for (const w of data.webhook_captures) {
      add(p(`${w.source_name ?? "(origem não identificada)"} · ${w.outcome}`), p(`Recebido em ${fmtDate(w.received_at)}${w.remote_ip ? ` · IP ${w.remote_ip}` : ""}`));
      if (w.user_agent) add(p(`Navegador: ${w.user_agent.slice(0, 160)}`));
    }
  }

  if (data.audit_log_extract.length > 0) {
    add(secao("Atividades de Auditoria"));
    add(...data.audit_log_extract.slice(0, 50).map((a) => linha(fmtDate(a.created_at), `${a.action}${a.resource_type ? ` · ${a.resource_type}` : ""}`)));
  }

  if (unsignedWarning) {
    add({
      type: "aviso",
      attrs: { estado: "atencao" },
      content: [
        t(
          "ASSINATURA DIGITAL PAdES PENDENTE — chave LGPD_SIGNING_KEY não configurada. A integridade do documento é garantida por hash SHA-256 registrado em log auditável.",
        ),
      ],
    });
  }

  return {
    tipo: "Relatório de Acesso aos Dados",
    numero: shortId,
    titulo: "Relatório de Acesso aos Dados",
    metadados: [
      ["Data", fmtDate(data.generated_at)],
      ["Destinatário(a)", data.contact?.name ?? null],
      ["Assunto", data.lei_citada ? `Direito de acesso — ${data.lei_citada}` : "Direito de acesso aos dados"],
    ],
    avisos: [{ estado: "info", texto: linhaDoControlador(data), emTodasAsPaginas: true, soNaLinhaFixa: true }],
    corpo: { type: "doc", content: c },
    emitidoEm: new Date(data.generated_at),
  };
}

/** Contexto mínimo quando quem chama não resolveu a marca: o controlador nos dois papéis. */
async function contextoDoPayload(data: ExportPayload): Promise<ContextoDaMarca> {
  return montarContextoDaMarca({
    // Reserva: o CONTROLADOR (razão social) nos dois papéis — nunca o nome fantasia.
    nomeDaMarca: data.organization_legal_name || "Relatório de Acesso aos Dados",
    razaoSocial: data.organization_legal_name || null,
  });
}

export async function renderLgpdPdf(
  data: ExportPayload,
  options: { unsignedWarning?: boolean; contexto?: ContextoDaMarca | null } = {},
): Promise<Buffer> {
  const contexto = options.contexto ?? (await contextoDoPayload(data));
  return renderizarDocumento(lgpdParaTimbrado(data, options.unsignedWarning ?? false), contexto);
}

/** FORK clinic (#86): as linhas preenchidas da ficha, na ordem da tela. O RG sai mascarado, como o CPF. */
export function linhasDaFicha(f: NonNullable<ExportPayload["ficha_clinica"]>): Array<[string, string]> {
  const endereco = [f.street, f.number, f.complement, f.district, f.city, f.uf, f.cep].filter(Boolean).join(", ");
  const rg = f.rg ? `***${f.rg.slice(-3)}${f.rg_issuer ? ` (${f.rg_issuer}${f.rg_uf ? `/${f.rg_uf}` : ""})` : ""}` : "";
  const emergencia = [f.emergency_name, f.emergency_relationship, f.emergency_phone].filter(Boolean).join(" · ");
  const responsavel = [f.guardian_name, f.guardian_relationship].filter(Boolean).join(" · ");
  const linhas: Array<[string, string | null]> = [
    ["Nome social", f.social_name],
    ["Sexo", f.sex],
    ["RG", rg],
    ["Profissão", f.profession],
    ["Estado civil", f.marital_status],
    ["Como conheceu", f.referral_source],
    ["Endereço", endereco],
    ["Contato de emergência", emergencia],
    ["Responsável", responsavel],
  ];
  return linhas.filter((l): l is [string, string] => Boolean(l[1]));
}
