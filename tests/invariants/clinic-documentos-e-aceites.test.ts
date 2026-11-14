/**
 * clinic (fork, prontuário F6) — migration 9023: documentos, termos e aceite.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. modelos padrão semeados (incl. uso de imagem com opções); versão nova ao
 *      mudar o texto, a anterior intacta (UPDATE recusado até para service role);
 *   2. emitir congela texto + sha256; paciente de outra empresa recusado;
 *      mudar o conteúdo depois é recusado; só o status anda;
 *   3. aceite presencial: escolhas incompletas recusadas; aceite duplicado
 *      recusado; aceites append-only;
 *   4. link: só o hash é gravado; uso único; expirado não abre; ninguém lê a
 *      tabela de links; as funções públicas não são de authenticated/anon;
 *   5. uso de imagem: autorizado só na opção marcada; revogar desliga;
 *   6. requisito "documento"; leitura com documentos.ver; isolamento; anon.
 */
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";

import { beforeAll, describe, expect, it } from "vitest";

const container = process.env.TEST_DB_CONTAINER;
if (!container) {
  throw new Error("TEST_DB_CONTAINER not set — rode esta suíte via `pnpm test:db` (scripts/test-db.sh)");
}
const containerName: string = container;
const PSQL = ["exec", "-i", containerName, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-f", "-"];

function sql(script: string): string {
  return execFileSync("docker", PSQL, { input: script, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
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
const json = <T,>(out: string) => JSON.parse(ultima(out)) as T;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

const ORG = "b6e10000-0000-4000-8000-00000000000a";
const ORG_B = "b6e10000-0000-4000-8000-00000000000b";
const ADM = "b6e10000-1111-4000-8000-0000000000a1";
const RECEP = "b6e10000-1111-4000-8000-0000000000a2";
const PROF = "b6e10000-1111-4000-8000-0000000000a3";
const ADM_B = "b6e10000-1111-4000-8000-0000000000b1";
const PAC = "b6e10000-2222-4000-8000-00000000000a";
const PAC_B = "b6e10000-2222-4000-8000-00000000000b";
const AG = "b6e10000-3333-4000-8000-000000000001";

const versaoDe = (org: string, nome: string) =>
  ultima(
    sql(`select v.id from public.clinic_modelos_documento m
           join public.clinic_modelos_documento_versoes v on v.modelo_id = m.id and v.numero = m.versao_atual
          where m.organization_id = '${org}' and m.nome = '${nome}';`),
  );
const emitir = (ator: string, contato: string, versao: string, at: string | null = null) =>
  como(
    ator,
    `select public.fn_clinic_documento_emitir('${ORG}', '${contato}', '${versao}', 'Termo', 'Texto renderizado de teste para Paciente Doc A.', ${at ? `'${at}'` : "null"}, null, null);`,
  );
const TODAS_NAO = {
  ensino_sem_identificacao: false,
  divulgacao_sem_rosto: false,
  divulgacao_com_identificacao: false,
  redes_sociais: false,
  site: false,
  material_impresso: false,
};

let docConsent = "";
let docImagem = "";
let at = "";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'doc-adm@invariant.test'), ('${RECEP}', 'doc-recep@invariant.test'),
      ('${PROF}', 'doc-prof@invariant.test'), ('${ADM_B}', 'doc-adm-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'doc-inv-a', 'Documentos Invariant A', 'Clínica Doc A', '{"clinic":{"prontuario":true}}'::jsonb),
      ('${ORG_B}', 'doc-inv-b', 'Documentos Invariant B', 'Clínica Doc B', '{"clinic":{"prontuario":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${RECEP}', '${ORG}', 'agent', now()),
      ('${PROF}', '${ORG}', 'agent', now()), ('${ADM_B}', '${ORG_B}', 'admin', now())
      on conflict do nothing;
    insert into public.clinic_professionals (organization_id, user_id, display_name) values ('${ORG}', '${PROF}', 'Profissional A')
      on conflict do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PAC}', '${ORG}', 'Paciente Doc A', '+5511990000701'), ('${PAC_B}', '${ORG_B}', 'Paciente Doc B', '+5511990000702')
      on conflict (id) do nothing;
    insert into public.calendar_appointments (id, organization_id, title, starts_at, ends_at, owner_user_id, contact_id, status) values
      ('${AG}', '${ORG}', 'Procedimento', now() - interval '1 hour', now(), '${PROF}', '${PAC}', 'confirmed')
      on conflict (id) do nothing;
  `);
  at = json<{ id: string }>(sql(como(PROF, `select public.fn_clinic_iniciar_atendimento('${ORG}', '${AG}');`))).id;
});

describe("modelos", () => {
  it("empresa nasce com os modelos padrão; uso de imagem tem opções, nenhuma obrigatória", () => {
    expect(ultima(sql(`select count(*) from public.clinic_modelos_documento where organization_id = '${ORG}';`))).toBe("5");
    expect(
      ultima(
        sql(`select jsonb_array_length(v.opcoes) from public.clinic_modelos_documento m join public.clinic_modelos_documento_versoes v on v.modelo_id = m.id
              where m.organization_id = '${ORG}' and m.tipo = 'uso_imagem';`),
      ),
    ).toBe("6");
  });

  it("mudar o texto cria versão nova; a anterior não muda nem pelo service role; recepção não edita", () => {
    const m = ultima(sql(`select id from public.clinic_modelos_documento where organization_id = '${ORG}' and tipo = 'ciencia';`));
    const salvar = (ator: string, texto: string, versao: number) =>
      como(ator, `select public.fn_clinic_documento_modelo_salvar('${ORG}', '${m}', null, 'Ciência das orientações pós-procedimento', '${texto}', '[]'::jsonb, true, ${versao});`);
    expect(erro(salvar(RECEP, "x", 1))).toMatch(/acesso_proibido/);
    expect(json<{ numero: number }>(sql(salvar(ADM, "Texto V2 de teste.", 1))).numero).toBe(2);
    expect(erro(salvar(ADM, "Outra aba", 1))).toMatch(/registro_conflito/);
    expect(erro(`set role service_role; update public.clinic_modelos_documento_versoes set conteudo = 'x' where modelo_id = '${m}';`)).toMatch(
      /permission denied/,
    );
  });
});

describe("emitir e aceitar", () => {
  it("emite congelado com hash; paciente de outra empresa recusado; conteúdo imutável", () => {
    expect(erro(emitir(RECEP, PAC_B, versaoDe(ORG, "Termo de consentimento para procedimento")))).toMatch(/documento_invalido/);
    const r = json<{ id: string; sha256: string }>(sql(emitir(RECEP, PAC, versaoDe(ORG, "Termo de consentimento para procedimento"), at)));
    docConsent = r.id;
    expect(r.sha256).toBe(hash("Texto renderizado de teste para Paciente Doc A."));
    expect(erro(`update public.clinic_documentos_emitidos set conteudo = 'reescrito' where id = '${docConsent}';`)).toMatch(/documento_imutavel/);
    expect(erro(`delete from public.clinic_documentos_emitidos where id = '${docConsent}';`)).toMatch(/documento_imutavel/);
  });

  it("requisito documento: falta até o termo ligado ao atendimento ser aceito", () => {
    sql(`insert into public.clinic_requisitos_finalizacao (organization_id, secao) values ('${ORG}', 'documento');`);
    expect(ultima(sql(`select array_to_string(public.fn_clinic_requisitos_faltando('${at}'), ',');`))).toBe("evolucao,documento");
  });

  it("aceite presencial; duplicado recusado; aceites append-only", () => {
    expect(erro(como(RECEP, `select public.fn_clinic_documento_aceitar('${ORG}', '${docConsent}', 'P', '{}'::jsonb, 'teste');`))).toMatch(
      /documento_sem_nome/,
    );
    sql(como(RECEP, `select public.fn_clinic_documento_aceitar('${ORG}', '${docConsent}', 'Paciente Doc A', '{}'::jsonb, 'teste');`));
    expect(
      erro(como(RECEP, `select public.fn_clinic_documento_aceitar('${ORG}', '${docConsent}', 'Paciente Doc A', '{}'::jsonb, 'teste');`)),
    ).toMatch(/documento_ja_respondido/);
    expect(erro(`set role service_role; delete from public.clinic_documento_aceites where documento_id = '${docConsent}';`)).toMatch(
      /permission denied/,
    );
    expect(ultima(sql(`select array_to_string(public.fn_clinic_requisitos_faltando('${at}'), ',');`))).toBe("evolucao");
  });
});

describe("link de aceite e uso de imagem", () => {
  it("link: hash só; uso único; escolhas completas; expirado não abre", () => {
    docImagem = json<{ id: string }>(sql(emitir(RECEP, PAC, versaoDe(ORG, "Autorização de uso de imagem")))).id;
    const token = randomBytes(32).toString("hex");
    sql(como(RECEP, `select public.fn_clinic_documento_link_criar('${ORG}', '${docImagem}', '${hash(token)}', 72);`));
    expect(erro(como(RECEP, `select count(*) from public.clinic_documento_links;`))).toMatch(/permission denied/);
    expect(erro(`set role authenticated; select public.fn_clinic_documento_publico_ler('${hash(token)}');`)).toMatch(/permission denied/);
    const lido = json<{ titulo: string; opcoes: unknown[] }>(
      sql(`set role service_role; select public.fn_clinic_documento_publico_ler('${hash(token)}');`),
    );
    expect(lido.opcoes).toHaveLength(6);

    const aceitar = (escolhas: object) =>
      `set role service_role; select public.fn_clinic_documento_publico_aceitar('${hash(token)}', 'Paciente Doc A', '${JSON.stringify(escolhas)}'::jsonb, '203.0.113.9', 'teste');`;
    expect(erro(aceitar({ site: true }))).toMatch(/documento_escolhas_invalidas/);
    sql(aceitar({ ...TODAS_NAO, divulgacao_sem_rosto: true, redes_sociais: true }));
    expect(erro(aceitar(TODAS_NAO))).toMatch(/documento_link_invalido/);
    expect(ultima(sql(`set role service_role; select public.fn_clinic_documento_publico_ler('${hash(token)}') is null;`))).toBe("t");
  });

  it("uso de imagem: só a opção marcada; revogar desliga", () => {
    const autorizado = (opcao: string) =>
      ultima(sql(`select public.fn_clinic_uso_de_imagem_autorizado('${ORG}', '${PAC}', '${opcao}');`));
    expect(autorizado("divulgacao_sem_rosto")).toBe("t");
    expect(autorizado("divulgacao_com_identificacao")).toBe("f");
    expect(erro(como(RECEP, `select public.fn_clinic_documento_encerrar('${ORG}', '${docImagem}', 'revogar', 'Paciente pediu');`))).toMatch(
      /acesso_proibido/,
    );
    sql(como(ADM, `select public.fn_clinic_documento_encerrar('${ORG}', '${docImagem}', 'revogar', 'Paciente pediu');`));
    expect(autorizado("divulgacao_sem_rosto")).toBe("f");
    expect(ultima(sql(`select string_agg(tipo, ',' order by created_at) from public.clinic_documento_aceites where documento_id = '${docImagem}';`))).toBe(
      "aceite,revogacao",
    );
  });
});

describe("leitura e acesso", () => {
  it("quem tem documentos.ver lê; outra empresa lê 0; ninguém escreve direto", () => {
    expect(Number(ultima(sql(como(RECEP, `select count(*) from public.clinic_documentos_emitidos where organization_id = '${ORG}';`))))).toBe(2);
    expect(ultima(sql(como(ADM_B, `select count(*) from public.clinic_documentos_emitidos where organization_id = '${ORG}';`)))).toBe("0");
    expect(ultima(sql(como(ADM_B, `select count(*) from public.clinic_modelos_documento where organization_id = '${ORG}';`)))).toBe("0");
    expect(
      erro(
        como(
          RECEP,
          `insert into public.clinic_documento_aceites (organization_id, documento_id, tipo, canal) values ('${ORG}', '${docConsent}', 'aceite', 'presencial');`,
        ),
      ),
    ).toMatch(/permission denied/);
  });

  it("anon não executa", () => {
    for (const f of [
      `public.fn_clinic_documento_emitir('${ORG}', '${PAC}', '${docConsent}', 'x', 'x', null, null, null)`,
      `public.fn_clinic_documento_aceitar('${ORG}', '${docConsent}', 'xxx', '{}'::jsonb, 'x')`,
      `public.fn_clinic_documento_publico_ler('${"0".repeat(64)}')`,
      `public.fn_clinic_documento_publico_aceitar('${"0".repeat(64)}', 'xxx', '{}'::jsonb, null, null)`,
      `public.fn_clinic_uso_de_imagem_autorizado('${ORG}', '${PAC}', 'site')`,
    ]) {
      expect(erro(`set role anon; select ${f};`)).toMatch(/permission denied/);
    }
  });
});
