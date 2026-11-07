/**
 * clinic (fork, orçamento O3) — migration 8008: o envio gera o contrato.
 *
 * Prova no Postgres real:
 *   - enviar emite um documento `contrato` ligado ao orçamento (orcamento_id
 *     fixo), congela o orçamento (itens não mudam) e exige: sem desconto
 *     pendente, dentro da validade, modelo do tipo contrato, prontuário ligado;
 *   - o ACEITE do contrato (presencial ou link) aprova o orçamento;
 *   - recusar, cancelar, nova versão e expirar cancelam o contrato não respondido;
 *     cancelar o contrato pela aba Documentos cancela o orçamento enviado;
 *   - nova versão: mesmo número, versão + 1, itens copiados; uma versão aberta por vez;
 *   - expirar só pelo service role; 2 empresas isoladas; anon sem EXECUTE.
 */
import { execFileSync } from "node:child_process";

import { beforeAll, describe, expect, it } from "vitest";

const container = process.env.TEST_DB_CONTAINER;
if (!container) {
  throw new Error("TEST_DB_CONTAINER not set — rode esta suíte via `pnpm test:db` (scripts/test-db.sh)");
}
const containerName: string = container;

function sql(script: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", containerName, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-f", "-"],
    { input: script, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
}
function como(userId: string, corpo: string): string {
  return `
    set role authenticated;
    select set_config('request.jwt.claims', '{"sub":"${userId}"}', false);
    ${corpo}
  `;
}
function erro(script: string): string | null {
  try {
    sql(script);
    return null;
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
}
const ultima = (out: string) => out.split("\n").at(-1) ?? "";

const ORG = "c8008000-0000-4000-8000-00000000000a";
const ORG_B = "c8008000-0000-4000-8000-00000000000b";
const ADM = "c8008000-1111-4000-8000-0000000000a1";
const GER = "c8008000-1111-4000-8000-0000000000a2";
const ATE = "c8008000-1111-4000-8000-0000000000a3";
const GER_B = "c8008000-1111-4000-8000-0000000000b1";
const PROC = "c8008000-2222-4000-8000-0000000000a1";
const PAC = "c8008000-3333-4000-8000-0000000000a1";
const MOD = "c8008000-4444-4000-8000-0000000000a1";
const VER = "c8008000-4444-4000-8000-0000000000a2";
const MOD_T = "c8008000-4444-4000-8000-0000000000a3";
const VER_T = "c8008000-4444-4000-8000-0000000000a4";

let preco = "";

const novoOrcamento = (dados: object = {}) =>
  (
    JSON.parse(
      ultima(
        sql(
          como(
            ATE,
            `select public.fn_clinic_orcamento_salvar('${ORG}', null, '${JSON.stringify({
              contact_id: PAC,
              itens: [{ preco_id: preco }],
              condicao_pagamento: { forma: "parcelado", parcelas: 3 },
              ...dados,
            })}'::jsonb);`,
          ),
        ),
      ),
    ) as { id: string }
  ).id;
const enviar = (user: string, id: string, versao = VER) =>
  sql(como(user, `select public.fn_clinic_orcamento_enviar('${ORG}', '${id}', '${versao}', 'Contrato — Orçamento', 'Texto do contrato com itens e pagamento.');`));
const status = (id: string) => ultima(sql(`select status from public.clinic_orcamentos where id = '${id}';`));
const docDe = (id: string) => ultima(sql(`select documento_id from public.clinic_orcamentos where id = '${id}';`));
const statusDoDoc = (doc: string) => ultima(sql(`select status from public.clinic_documentos_emitidos where id = '${doc}';`));

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'ctr-adm@invariant.test'), ('${GER}', 'ctr-ger@invariant.test'),
      ('${ATE}', 'ctr-ate@invariant.test'), ('${GER_B}', 'ctr-ger-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'ctr-inv-a', 'Contrato Invariant A', 'Contrato A', '{"clinic":{"orcamentos":true,"prontuario":true}}'::jsonb),
      ('${ORG_B}', 'ctr-inv-b', 'Contrato Invariant B', 'Contrato B', '{"clinic":{"orcamentos":true,"prontuario":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${GER}', '${ORG}', 'manager', now()),
      ('${ATE}', '${ORG}', 'agent', now()), ('${GER_B}', '${ORG_B}', 'manager', now())
      on conflict do nothing;
    insert into public.clinic_procedures (id, organization_id, name, short_description) values
      ('${PROC}', '${ORG}', 'Limpeza de pele', 'Procedimento de teste') on conflict (id) do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PAC}', '${ORG}', 'Paciente Fictício Contrato', '+5511900008081') on conflict (id) do nothing;
    insert into public.clinic_modelos_documento (id, organization_id, tipo, nome, ativo) values
      ('${MOD}', '${ORG}', 'contrato', 'Contrato invariante 8008', true),
      ('${MOD_T}', '${ORG}', 'consentimento', 'Termo invariante 8008', true)
      on conflict (id) do nothing;
    insert into public.clinic_modelos_documento_versoes (id, organization_id, modelo_id, numero, conteudo, sha256) values
      ('${VER}', '${ORG}', '${MOD}', 1, 'Contrato {{orcamento.itens}}', 'x'),
      ('${VER_T}', '${ORG}', '${MOD_T}', 1, 'Termo', 'y')
      on conflict (id) do nothing;
  `);
  preco = (
    JSON.parse(
      ultima(sql(como(GER, `select public.fn_clinic_preco_publicar('${ORG}', '{"procedure_id":"${PROC}","preco_cents":30000}'::jsonb);`))),
    ) as { id: string }
  ).id;
});

describe("o envio gera o contrato (8008)", () => {
  it("enviar emite o contrato ligado, congela o orçamento; o aceite presencial aprova", () => {
    const id = novoOrcamento();
    enviar(ATE, id);
    expect(status(id)).toBe("enviado");
    const doc = docDe(id);
    expect(ultima(sql(`select tipo || '|' || status || '|' || (orcamento_id = '${id}')::text from public.clinic_documentos_emitidos where id = '${doc}';`))).toBe(
      "contrato|emitido|true",
    );
    // congelado: não edita, itens não mudam, orcamento_id não muda
    expect(
      erro(como(ATE, `select public.fn_clinic_orcamento_salvar('${ORG}', '${id}', '{"itens":[{"preco_id":"${preco}"}],"condicao_pagamento":{"forma":"pix"}}'::jsonb);`)),
    ).toMatch(/orcamento_nao_editavel/);
    expect(erro(`update public.clinic_orcamento_itens set quantidade = 2, total_cents = preco_unit_cents * 2 where orcamento_id = '${id}';`)).toMatch(
      /orcamento_nao_editavel/,
    );
    expect(erro(`update public.clinic_documentos_emitidos set orcamento_id = null where id = '${doc}';`)).toMatch(/documento_imutavel/);
    // aceite presencial (o de sempre) → aprovado
    sql(como(ATE, `select public.fn_clinic_documento_aceitar('${ORG}', '${doc}', 'Paciente Fictício', '{}'::jsonb, 'teste');`));
    expect(ultima(sql(`select status || '|' || (aprovado_em is not null)::text from public.clinic_orcamentos where id = '${id}';`))).toBe("aprovado|true");
    expect(erro(como(GER, `select public.fn_clinic_orcamento_cancelar('${ORG}', '${id}', 'Tarde demais');`))).toMatch(/orcamento_nao_editavel/);
  });

  it("aceite pelo link (service role) também aprova", () => {
    const id = novoOrcamento();
    enviar(ATE, id);
    const doc = docDe(id);
    sql(como(ATE, `select public.fn_clinic_documento_link_criar('${ORG}', '${doc}', '286c897eba57ce67e79fff80229d9eacddde784b29a18a1d47c17bade5ad1a08', 72);`));
    sql(`set role service_role; select public.fn_clinic_documento_publico_aceitar('286c897eba57ce67e79fff80229d9eacddde784b29a18a1d47c17bade5ad1a08', 'Paciente Fictício', '{}'::jsonb, '127.0.0.1', 'teste');`);
    expect(status(id)).toBe("aprovado");
  });

  it("não envia: desconto pendente, validade vencida, modelo que não é contrato, prontuário desligado", () => {
    const enviarErro = (id: string, versao = VER) =>
      erro(como(ATE, `select public.fn_clinic_orcamento_enviar('${ORG}', '${id}', '${versao}', 't', 'c');`));
    const pend = novoOrcamento({ desconto_cents: 9000 }); // 30% > 10%
    expect(enviarErro(pend)).toMatch(/orcamento_desconto_pendente/);
    const vencido = novoOrcamento();
    sql(`update public.clinic_orcamentos set validade_ate = current_date - 1 where id = '${vencido}';`);
    expect(enviarErro(vencido)).toMatch(/orcamento_vencido/);
    const termo = novoOrcamento();
    expect(enviarErro(termo, VER_T)).toMatch(/orcamento_modelo_invalido/);
    sql(`update public.organizations set settings = '{"clinic":{"orcamentos":true}}'::jsonb where id = '${ORG}';`);
    expect(enviarErro(termo)).toMatch(/prontuario_desligado/);
    sql(`update public.organizations set settings = '{"clinic":{"orcamentos":true,"prontuario":true}}'::jsonb where id = '${ORG}';`);
    expect(status(termo)).toBe("rascunho");
  });

  it("recusar cancela o contrato; nova versão copia e substitui; uma versão aberta por vez", () => {
    const id = novoOrcamento();
    enviar(ATE, id);
    const doc = docDe(id);
    expect(erro(como(ATE, `select public.fn_clinic_orcamento_recusar('${ORG}', '${id}', ' ');`))).toMatch(/orcamento_sem_motivo/);
    sql(como(ATE, `select public.fn_clinic_orcamento_recusar('${ORG}', '${id}', 'Achou caro');`));
    expect(status(id)).toBe("recusado");
    expect(statusDoDoc(doc)).toBe("cancelado");

    const nova = JSON.parse(ultima(sql(como(ATE, `select public.fn_clinic_orcamento_nova_versao('${ORG}', '${id}');`)))) as {
      id: string;
      versao: number;
    };
    expect(nova.versao).toBe(2);
    expect(status(id)).toBe("recusado");
    expect(ultima(sql(`select count(*) from public.clinic_orcamento_itens where orcamento_id = '${nova.id}';`))).toBe("1");
    expect(erro(como(ATE, `select public.fn_clinic_orcamento_nova_versao('${ORG}', '${id}');`))).toMatch(/orcamento_versao_aberta/);

    // enviar a v2 e revisar de novo: a v2 vira substituída e o contrato dela é cancelado
    enviar(ATE, nova.id);
    const doc2 = docDe(nova.id);
    const v3 = JSON.parse(ultima(sql(como(ATE, `select public.fn_clinic_orcamento_nova_versao('${ORG}', '${nova.id}');`)))) as { versao: number };
    expect(v3.versao).toBe(3);
    expect(status(nova.id)).toBe("substituido");
    expect(statusDoDoc(doc2)).toBe("cancelado");
  });

  it("cancelar o enviado cancela o contrato; cancelar o contrato pela aba Documentos cancela o orçamento", () => {
    const a = novoOrcamento();
    enviar(ATE, a);
    sql(como(GER, `select public.fn_clinic_orcamento_cancelar('${ORG}', '${a}', 'Paciente desistiu');`));
    expect(status(a)).toBe("cancelado");
    expect(statusDoDoc(docDe(a))).toBe("cancelado");

    const b = novoOrcamento();
    enviar(ATE, b);
    sql(como(ATE, `select public.fn_clinic_documento_encerrar('${ORG}', '${docDe(b)}', 'cancelar', 'Emitido errado');`));
    expect(ultima(sql(`select status || '|' || motivo_cancelamento from public.clinic_orcamentos where id = '${b}';`))).toBe("cancelado|Emitido errado");
  });

  it("expirar: só service role; vencido vira expirado e o contrato é cancelado", () => {
    const id = novoOrcamento();
    enviar(ATE, id);
    sql(`update public.clinic_orcamentos set validade_ate = current_date - 1 where id = '${id}';`);
    expect(erro(como(GER, `select public.fn_clinic_orcamentos_expirar();`))).toMatch(/permission denied/);
    const r = JSON.parse(ultima(sql(`set role service_role; select public.fn_clinic_orcamentos_expirar();`))) as { expirados: number };
    expect(r.expirados).toBeGreaterThanOrEqual(1);
    expect(status(id)).toBe("expirado");
    expect(statusDoDoc(docDe(id))).toBe("cancelado");
  });

  it("outra empresa não envia nem lê o contrato; anon não executa", () => {
    const id = novoOrcamento();
    expect(erro(como(GER_B, `select public.fn_clinic_orcamento_enviar('${ORG}', '${id}', '${VER}', 't', 'c');`))).toMatch(/acesso_proibido/);
    expect(erro(`set role anon; select public.fn_clinic_orcamento_enviar('${ORG}', '${id}', '${VER}', 't', 'c');`)).toMatch(/permission denied/);
    expect(erro(`set role anon; select public.fn_clinic_orcamento_recusar('${ORG}', '${id}', 'x');`)).toMatch(/permission denied/);
    expect(erro(`set role anon; select public.fn_clinic_orcamento_nova_versao('${ORG}', '${id}');`)).toMatch(/permission denied/);
    expect(erro(`set role authenticated; select public.fn_clinic_orcamento_cancelar_contrato('${ORG}', '${id}', 'x');`)).toMatch(/permission denied/);
  });
});
