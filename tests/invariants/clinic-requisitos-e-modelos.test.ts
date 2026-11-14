/**
 * clinic (fork, prontuário F3) — migration 9020: requisitos de finalização
 * configuráveis e o editor de modelos.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. requisitos: só com `modelos_clinicos.gerenciar` (profissional recusado);
 *      tipo de outra empresa recusado; a regra vale para o tipo/especialidade
 *      certos e não para os outros; a evolução continua obrigatória;
 *   2. editor: criar modelo (versão 1), publicar versão 2 — a versão 1 fica
 *      intacta e o preenchimento que a usou continua apontando para ela;
 *      versão velha → `registro_conflito`; campos malformados recusados;
 *      especialidade/modelo de outra empresa recusados; desativar some da lista
 *      ativa;
 *   3. isolamento: quem é da A lê 0 regras da B; ninguém escreve direto;
 *   4. anon não executa as funções.
 */
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

const ORG = "b3e10000-0000-4000-8000-00000000000a";
const ORG_B = "b3e10000-0000-4000-8000-00000000000b";
const ADM = "b3e10000-1111-4000-8000-0000000000a1";
const PROF = "b3e10000-1111-4000-8000-0000000000a3";
const ADM_B = "b3e10000-1111-4000-8000-0000000000b1";
const PAC = "b3e10000-2222-4000-8000-00000000000a";
const TIPO = "b3e10000-4444-4000-8000-000000000001";
const TIPO_2 = "b3e10000-4444-4000-8000-000000000002";
const TIPO_B = "b3e10000-4444-4000-8000-0000000000b1";
const ESP = "b3e10000-5555-4000-8000-000000000001";
const ESP_B = "b3e10000-5555-4000-8000-0000000000b1";
const AG = "b3e10000-3333-4000-8000-000000000001";
const AG2 = "b3e10000-3333-4000-8000-000000000002";

const CAMPOS = JSON.stringify([
  { chave: "queixa", rotulo: "Queixa", tipo: "texto_longo", obrigatorio: true },
  { chave: "nota", rotulo: "Nota", tipo: "escala", min: 0, max: 10 },
]);
const definir = (ator: string, regras: object[], org = ORG) =>
  como(ator, `select public.fn_clinic_definir_requisitos('${org}', '${JSON.stringify(regras)}'::jsonb);`);
const evolucao = (at: string) =>
  como(PROF, `select public.fn_clinic_salvar_evolucao('${ORG}', '${at}', 'Evolução de teste.', null, null, null, null, 0);`);
const finalizar = (at: string) => como(PROF, `select public.fn_clinic_finalizar_atendimento('${ORG}', '${at}');`);

let at1 = "";
let at2 = "";
let modelo = "";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'req-adm@invariant.test'), ('${PROF}', 'req-prof@invariant.test'), ('${ADM_B}', 'req-adm-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'req-inv-a', 'Requisitos Invariant A', 'Requisitos A', '{"clinic":{"prontuario":true}}'::jsonb),
      ('${ORG_B}', 'req-inv-b', 'Requisitos Invariant B', 'Requisitos B', '{"clinic":{"prontuario":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${PROF}', '${ORG}', 'agent', now()), ('${ADM_B}', '${ORG_B}', 'admin', now())
      on conflict do nothing;
    insert into public.clinic_professionals (organization_id, user_id, display_name) values ('${ORG}', '${PROF}', 'Profissional A')
      on conflict do nothing;
    insert into public.clinic_specialties (id, organization_id, name) values
      ('${ESP}', '${ORG}', 'Estética facial'), ('${ESP_B}', '${ORG_B}', 'Estética B')
      on conflict (id) do nothing;
    insert into public.calendar_event_types (id, organization_id, name, slug, category, duration_minutes) values
      ('${TIPO}', '${ORG}', 'Peeling', 'req-peeling', 'procedimento', 60),
      ('${TIPO_2}', '${ORG}', 'Retorno', 'req-retorno', 'retorno', 30),
      ('${TIPO_B}', '${ORG_B}', 'Tipo B', 'req-tipo-b', 'consulta', 30)
      on conflict (id) do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PAC}', '${ORG}', 'Paciente Requisitos A', '+5511990000401')
      on conflict (id) do nothing;
    insert into public.calendar_appointments (id, organization_id, title, starts_at, ends_at, owner_user_id, contact_id, event_type_id, status) values
      ('${AG}', '${ORG}', 'Peeling', now() - interval '1 hour', now(), '${PROF}', '${PAC}', '${TIPO}', 'confirmed'),
      ('${AG2}', '${ORG}', 'Retorno', now() - interval '30 minutes', now(), '${PROF}', '${PAC}', '${TIPO_2}', 'confirmed')
      on conflict (id) do nothing;
  `);
  at1 = json<{ id: string }>(sql(como(PROF, `select public.fn_clinic_iniciar_atendimento('${ORG}', '${AG}');`))).id;
  at2 = json<{ id: string }>(sql(como(PROF, `select public.fn_clinic_iniciar_atendimento('${ORG}', '${AG2}');`))).id;
});

describe("requisitos de finalização", () => {
  it("só quem gerencia modelos clínicos define; tipo de outra empresa é recusado", () => {
    expect(erro(definir(PROF, [{ secao: "anamnese" }]))).toMatch(/acesso_proibido/);
    expect(erro(definir(ADM, [{ secao: "anamnese", event_type_id: TIPO_B }]))).toMatch(/requisitos_invalidos/);
    expect(erro(definir(ADM, [{ secao: "anamnese", specialty_id: ESP_B }]))).toMatch(/requisitos_invalidos/);
    expect(ultima(sql(definir(ADM, [{ secao: "anamnese", event_type_id: TIPO }])))).toBe("1");
  });

  it("a regra vale para o tipo certo, não para os outros; evolução continua obrigatória", () => {
    sql(evolucao(at1));
    sql(evolucao(at2));
    const e = erro(finalizar(at1));
    expect(e).toMatch(/requisitos_pendentes/);
    expect(e).toMatch(/anamnese/);
    // O retorno não tem a regra: finaliza só com a evolução.
    expect(json<{ mudou: boolean }>(sql(finalizar(at2))).mudou).toBe(true);
  });

  it("isolamento: quem é da B lê 0 regras da A; ninguém escreve direto", () => {
    expect(ultima(sql(como(ADM_B, `select count(*) from public.clinic_requisitos_finalizacao where organization_id = '${ORG}';`)))).toBe("0");
    expect(ultima(sql(como(PROF, `select count(*) from public.clinic_requisitos_finalizacao where organization_id = '${ORG}';`)))).toBe("1");
    expect(
      erro(como(ADM, `insert into public.clinic_requisitos_finalizacao (organization_id, secao) values ('${ORG}', 'avaliacao');`)),
    ).toMatch(/permission denied/);
  });
});

describe("editor de modelos", () => {
  it("profissional não cria; campos malformados e especialidade de outra empresa são recusados", () => {
    const criar = (ator: string, campos: string, esp = "{}") =>
      como(ator, `select public.fn_clinic_modelo_criar('${ORG}', 'anamnese', 'Anamnese de peeling', null, '${esp}'::uuid[], '${campos}'::jsonb);`);
    expect(erro(criar(PROF, CAMPOS))).toMatch(/acesso_proibido/);
    expect(erro(criar(ADM, "[]"))).toMatch(/modelo_invalido/);
    expect(erro(criar(ADM, JSON.stringify([{ chave: "Com Espaço", tipo: "texto" }])))).toMatch(/modelo_invalido/);
    expect(erro(criar(ADM, JSON.stringify([{ chave: "a", tipo: "texto" }, { chave: "a", tipo: "numero" }])))).toMatch(/modelo_invalido/);
    expect(erro(criar(ADM, CAMPOS, `{${ESP_B}}`))).toMatch(/modelo_invalido/);
    const r = json<{ id: string; numero: number }>(sql(criar(ADM, CAMPOS, `{${ESP}}`)));
    expect(r.numero).toBe(1);
    modelo = r.id;
    expect(erro(criar(ADM, CAMPOS))).toMatch(/modelo_nome_em_uso/);
  });

  it("nova versão: a anterior fica intacta e quem a usou continua nela; versão velha é conflito", () => {
    const v1 = ultima(sql(`select id from public.clinic_modelos_formulario_versoes where modelo_id = '${modelo}' and numero = 1;`));
    sql(
      como(
        PROF,
        `select public.fn_clinic_salvar_formulario('${ORG}', '${at1}', 'anamnese', '${v1}', '{"queixa":"Manchas"}'::jsonb, 0);`,
      ),
    );
    const novos = JSON.stringify([...JSON.parse(CAMPOS), { chave: "fototipo", rotulo: "Fototipo", tipo: "escolha", opcoes: ["I", "II"] }]);
    const publicar = (versao: number) =>
      como(ADM, `select public.fn_clinic_modelo_publicar_versao('${ORG}', '${modelo}', '${novos}'::jsonb, ${versao});`);
    expect(json<{ numero: number }>(sql(publicar(1))).numero).toBe(2);
    expect(erro(publicar(1))).toMatch(/registro_conflito/);
    expect(ultima(sql(`select jsonb_array_length(campos) from public.clinic_modelos_formulario_versoes where id = '${v1}';`))).toBe("2");
    expect(ultima(sql(`select modelo_versao_id from public.clinic_formularios_preenchidos where atendimento_id = '${at1}';`))).toBe(v1);
    expect(ultima(sql(`select versao_atual from public.clinic_modelos_formulario where id = '${modelo}';`))).toBe("2");
  });

  it("modelo de outra empresa não é encontrado; desativar tira da lista ativa", () => {
    expect(
      erro(
        como(ADM_B, `select public.fn_clinic_modelo_publicar_versao('${ORG_B}', '${modelo}', '${CAMPOS}'::jsonb, 2);`),
      ),
    ).toMatch(/modelo_nao_encontrado/);
    expect(
      erro(como(ADM_B, `select public.fn_clinic_modelo_atualizar('${ORG_B}', '${modelo}', 'X', null, '{}', false);`)),
    ).toMatch(/modelo_nao_encontrado/);
    sql(como(ADM, `select public.fn_clinic_modelo_atualizar('${ORG}', '${modelo}', 'Anamnese de peeling', 'Só para peeling', '{}', false);`));
    expect(ultima(sql(`select ativo from public.clinic_modelos_formulario where id = '${modelo}';`))).toBe("f");
  });

  it("com a anamnese preenchida, o atendimento finaliza", () => {
    expect(json<{ mudou: boolean }>(sql(finalizar(at1))).mudou).toBe(true);
  });
});

describe("anon", () => {
  it("não executa as funções da 9020", () => {
    for (const f of [
      `public.fn_clinic_definir_requisitos('${ORG}', '[]'::jsonb)`,
      `public.fn_clinic_modelo_criar('${ORG}', 'anamnese', 'x', null, '{}', '${CAMPOS}'::jsonb)`,
      `public.fn_clinic_modelo_publicar_versao('${ORG}', '${modelo}', '${CAMPOS}'::jsonb, 1)`,
      `public.fn_clinic_modelo_atualizar('${ORG}', '${modelo}', 'x', null, '{}', true)`,
      `public.fn_clinic_requisitos_faltando('${at1}')`,
    ]) {
      expect(erro(`set role anon; select ${f};`)).toMatch(/permission denied/);
    }
  });
});
