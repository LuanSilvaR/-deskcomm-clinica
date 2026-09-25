/**
 * FORK clinic (prontuário F8) — O AUDIT DO PRONTUÁRIO NÃO GUARDA CONTEÚDO CLÍNICO.
 *
 * `api_audit_log` é append-only e tem retenção longa; a anonimização LGPD não o
 * alcança. Se uma rota clínica gravasse no `metadata` o texto de uma anamnese,
 * de uma evolução, o motivo de um adendo ou a descrição de uma foto, essa
 * cópia sobreviveria a tudo. A regra do plano (seção 12/13) é: audit clínico
 * leva só METADADOS — ids, seção, contagens, tipo, canal, hash.
 *
 * Este teste lê TODA chamada `audit({...})` das rotas e páginas clínicas e
 * exige que cada chave do `metadata` esteja na lista de metadados permitidos.
 * Chave nova precisa entrar aqui de propósito, com revisão — é o ponto.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
/** As rotas e páginas do PRONTUÁRIO (fases F1–F8). */
const PASTAS = [
  "app/api/v1/clinic/atendimentos",
  "app/api/v1/clinic/agendamentos/[id]/atendimento",
  "app/api/v1/clinic/pacientes/[contactId]/prontuario",
  "app/api/v1/clinic/pacientes/[contactId]/anexos",
  "app/api/v1/clinic/pacientes/[contactId]/documentos",
  "app/api/v1/clinic/pacientes/[contactId]/planos",
  "app/api/v1/clinic/planos",
  "app/api/v1/clinic/documentos",
  "app/api/v1/clinic/anexos",
  "app/api/v1/clinic/modelos",
  "app/api/v1/clinic/requisitos",
  "app/api/v1/clinic/procedimentos",
  "app/api/v1/publico/termos",
  "app/imprimir",
];

/** Metadados permitidos: identificadores, contagens e rótulos de sistema — nunca texto de pessoa. */
const PERMITIDAS = new Set([
  "secao",
  "atendimento_id",
  "contact_id",
  "tipo",
  "numero",
  "campos",
  "ativo",
  "especialidades",
  "regras",
  "status",
  "da_conduta",
  "quantidade",
  "acao",
  "insumos",
  "alvo_tipo",
  "sha256",
  "canal",
  "horas",
  "mime",
  "bytes",
  "opcao",
  "atendimentos",
  "documentos",
  "area",
  "pagina",
  "appointment_id",
  "especialidade_id",
  "criado",
  "mudou",
  "professional_user_id",
  "de",
  "para",
]);
/** Nomes que, se aparecerem, quase certamente carregam texto clínico ou pessoal. */
const PROIBIDAS = /^(texto|motivo|descricao|respostas|conteudo|observacoes|intercorrencias|orientacoes|resposta|regiao|nome|nome_digitado|protocolo|recomendacoes|objetivo|titulo|parametros)$/;

function arquivos(pasta: string): string[] {
  const abs = join(RAIZ, pasta);
  try {
    statSync(abs);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const nome of readdirSync(abs)) {
    const p = join(abs, nome);
    if (statSync(p).isDirectory()) out.push(...arquivos(join(pasta, nome)));
    else if (/\.(ts|tsx)$/.test(nome) && !/\.test\./.test(nome)) out.push(join(pasta, nome));
  }
  return out;
}

/** Chaves do `metadata` de cada `audit({...})` do arquivo. */
function chavesDeMetadata(fonte: string): string[] {
  const chaves: string[] = [];
  for (const m of fonte.matchAll(/metadata:\s*([^\n]*(?:\n(?!\s*(?:requestId|\}\);))[^\n]*)*)/g)) {
    const trecho = m[1] ?? "";
    for (const objeto of trecho.matchAll(/\{([^{}]*)\}/g)) {
      const corpo = objeto[1] ?? "";
      // `chave: valor` e a forma curta `{ chave }` / `, chave,` — nunca o valor.
      for (const k of corpo.matchAll(/(?:^|[{,])\s*([a-z_][a-z0-9_]*)\s*:/gi)) chaves.push(k[1]!);
      for (const k of corpo.matchAll(/(?:^|[{,])\s*([a-z_][a-z0-9_]*)\s*(?=,|$)/gi)) chaves.push(k[1]!);
    }
  }
  return chaves;
}

describe("audit clínico sem conteúdo clínico", () => {
  const todos = PASTAS.flatMap(arquivos);

  it("há rotas clínicas auditando (controle positivo)", () => {
    const comAudit = todos.filter((f) => /\baudit\(\{/.test(readFileSync(join(RAIZ, f), "utf8")));
    expect(comAudit.length).toBeGreaterThan(15);
    expect(chavesDeMetadata(`audit({ metadata: { secao: "x", atendimento_id: id, texto } , requestId`)).toEqual([
      "secao",
      "atendimento_id",
      "texto",
    ]);
  });

  it("toda chave de metadata é um metadado permitido, e nenhuma carrega texto", () => {
    const problemas: string[] = [];
    for (const f of todos) {
      const fonte = readFileSync(join(RAIZ, f), "utf8");
      if (!/\baudit\(\{/.test(fonte)) continue;
      for (const k of chavesDeMetadata(fonte)) {
        if (PROIBIDAS.test(k) || !PERMITIDAS.has(k)) problemas.push(`${f}: metadata.${k}`);
      }
    }
    expect(problemas, "Audit clínico leva só metadados (ids, seção, contagens, tipo). Texto de pessoa fica na tabela clínica, não no log.").toEqual([]);
  });
});
