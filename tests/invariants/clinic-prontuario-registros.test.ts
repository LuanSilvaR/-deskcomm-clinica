/**
 * clinic (fork, prontuário F2) — migrations 9017 e 9018: formulários por modelo,
 * evolução, adendos e o prontuário imutável.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. toda empresa nasce com os modelos padrão (versão 1, campos em JSON);
 *      versões de modelo não aceitam UPDATE/DELETE;
 *   2. salvar anamnese/evolução: recepção recusada; versão do modelo de outra
 *      empresa ou de outro tipo recusada; autosave com versão — versão velha →
 *      `registro_conflito`, nada sobrescrito;
 *   3. leitura: profissional lê; admin sem papel clínico e recepção leem 0;
 *      outra empresa lê 0;
 *   4. finalizar: exige evolução e os campos obrigatórios do formulário
 *      iniciado; depois disso UPDATE e DELETE diretos são recusados — mesmo
 *      como service role/superusuário; salvar de novo é recusado;
 *   5. adendo: recusado em atendimento aberto e sem permissão; aceito em
 *      finalizado; append-only; alvo de outro atendimento recusado;
 *   6. anon não executa as funções.
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

const ORG = "b2e10000-0000-4000-8000-00000000000a";
const ORG_B = "b2e10000-0000-4000-8000-00000000000b";
const ADM = "b2e10000-1111-4000-8000-0000000000a1";
const RECEP = "b2e10000-1111-4000-8000-0000000000a2";
const PROF = "b2e10000-1111-4000-8000-0000000000a3";
const PROF_B = "b2e10000-1111-4000-8000-0000000000b1";
const PAC = "b2e10000-2222-4000-8000-00000000000a";
const PAC_B = "b2e10000-2222-4000-8000-00000000000b";
const AG = "b2e10000-3333-4000-8000-000000000001";
const AG2 = "b2e10000-3333-4000-8000-000000000002";
const AG_B = "b2e10000-3333-4000-8000-0000000000b1";

const versaoDoModelo = (org: string, nome: string) =>
  ultima(
    sql(`select v.id from public.clinic_modelos_formulario m
           join public.clinic_modelos_formulario_versoes v on v.modelo_id = m.id and v.numero = 1
          where m.organization_id = '${org}' and m.nome = '${nome}';`),
  );
const salvarForm = (ator: string, at: string, tipo: string, versaoModelo: string, respostas: object, versao: number) =>
  como(
    ator,
    `select public.fn_clinic_salvar_formulario('${ORG}', '${at}', '${tipo}', '${versaoModelo}', '${JSON.stringify(respostas)}'::jsonb, ${versao});`,
  );
const salvarEvo = (ator: string, at: string, texto: string | null, versao: number) =>
  como(
    ator,
    `select public.fn_clinic_salvar_evolucao('${ORG}', '${at}', ${texto === null ? "null" : `'${texto}'`}, null, null, null, null, ${versao});`,
  );
const finalizar = (ator: string, at: string) => como(ator, `select public.fn_clinic_finalizar_atendimento('${ORG}', '${at}');`);
const contarComo = (ator: string, tabela: string, org = ORG) =>
  ultima(sql(como(ator, `select count(*) from public.${tabela} where organization_id = '${org}';`)));

let at1 = "";
let at2 = "";
let anamnese = "";
let evolucao = "";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'reg-adm@invariant.test'), ('${RECEP}', 'reg-recep@invariant.test'),
      ('${PROF}', 'reg-prof@invariant.test'),
      ('${PROF_B}', 'reg-prof-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'reg-inv-a', 'Registros Invariant A', 'Registros A', '{"clinic":{"prontuario":true}}'::jsonb),
      ('${ORG_B}', 'reg-inv-b', 'Registros Invariant B', 'Registros B', '{"clinic":{"prontuario":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${RECEP}', '${ORG}', 'agent', now()),
      ('${PROF}', '${ORG}', 'agent', now()),
      ('${PROF_B}', '${ORG_B}', 'agent', now())
      on conflict do nothing;
    insert into public.clinic_professionals (organization_id, user_id, display_name) values
      ('${ORG}', '${PROF}', 'Profissional A'), ('${ORG_B}', '${PROF_B}', 'Profissional B')
      on conflict do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PAC}', '${ORG}', 'Paciente Registros A', '+5511990000301'),
      ('${PAC_B}', '${ORG_B}', 'Paciente Registros B', '+5511990000302')
      on conflict (id) do nothing;
    insert into public.calendar_appointments (id, organization_id, title, starts_at, ends_at, owner_user_id, contact_id, status) values
      ('${AG}', '${ORG}', 'Avaliação', now() - interval '1 hour', now(), '${PROF}', '${PAC}', 'confirmed'),
      ('${AG2}', '${ORG}', 'Retorno', now() - interval '30 minutes', now(), '${PROF}', '${PAC}', 'confirmed'),
      ('${AG_B}', '${ORG_B}', 'Consulta B', now(), now() + interval '1 hour', '${PROF_B}', '${PAC_B}', 'confirmed')
      on conflict (id) do nothing;
  `);
  at1 = json<{ id: string }>(sql(como(PROF, `select public.fn_clinic_iniciar_atendimento('${ORG}', '${AG}');`))).id;
  at2 = json<{ id: string }>(sql(como(PROF, `select public.fn_clinic_iniciar_atendimento('${ORG}', '${AG2}');`))).id;
  sql(como(PROF_B, `select public.fn_clinic_iniciar_atendimento('${ORG_B}', '${AG_B}');`));
});

describe("modelos", () => {
  it("toda empresa nasce com os modelos padrão, versão 1", () => {
    expect(
      ultima(sql(`select string_agg(m.tipo || ':' || m.nome, ',' order by m.tipo, m.nome) from public.clinic_modelos_formulario m where m.organization_id = '${ORG}';`)),
    ).toBe(
      "anamnese:Anamnese estética,anamnese:Anamnese geral,avaliacao:Avaliação corporal,avaliacao:Avaliação estética facial,avaliacao:Avaliação geral",
    );
    expect(versaoDoModelo(ORG, "Anamnese geral")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("versões de modelo são imutáveis, até para o service role", () => {
    const v = versaoDoModelo(ORG, "Anamnese geral");
    expect(erro(`set role service_role; update public.clinic_modelos_formulario_versoes set campos = '[]' where id = '${v}';`)).toMatch(
      /permission denied/,
    );
  });

  it("quem é da A lê 0 modelos da B", () => {
    expect(contarComo(PROF, "clinic_modelos_formulario", ORG_B)).toBe("0");
    expect(contarComo(RECEP, "clinic_modelos_formulario")).not.toBe("0");
  });
});

describe("salvar (autosave com versão)", () => {
  it("recepção não registra", () => {
    expect(erro(salvarForm(RECEP, at1, "anamnese", versaoDoModelo(ORG, "Anamnese geral"), { objetivo: "x" }, 0))).toMatch(
      /acesso_proibido/,
    );
  });

  it("modelo de outra empresa ou de outro tipo é recusado", () => {
    expect(erro(salvarForm(PROF, at1, "anamnese", versaoDoModelo(ORG_B, "Anamnese geral"), {}, 0))).toMatch(/formulario_modelo_invalido/);
    expect(erro(salvarForm(PROF, at1, "anamnese", versaoDoModelo(ORG, "Avaliação geral"), {}, 0))).toMatch(/formulario_modelo_invalido/);
  });

  it("cria na versão 1, atualiza com a versão certa, recusa versão velha sem sobrescrever", () => {
    const v = versaoDoModelo(ORG, "Anamnese geral");
    const r1 = json<{ id: string; versao: number; criado: boolean }>(sql(salvarForm(PROF, at1, "anamnese", v, { objetivo: "Melhorar a pele" }, 0)));
    expect(r1).toMatchObject({ versao: 1, criado: true });
    anamnese = r1.id;
    const r2 = json<{ versao: number }>(sql(salvarForm(PROF, at1, "anamnese", v, { objetivo: "Melhorar a pele", queixa_principal: "Manchas" }, 1)));
    expect(r2.versao).toBe(2);
    expect(erro(salvarForm(PROF, at1, "anamnese", v, { objetivo: "Outra aba" }, 1))).toMatch(/registro_conflito/);
    expect(ultima(sql(`select respostas->>'objetivo' from public.clinic_formularios_preenchidos where id = '${anamnese}';`))).toBe(
      "Melhorar a pele",
    );
  });

  it("evolução segue a mesma régua", () => {
    const r = json<{ id: string; versao: number }>(sql(salvarEvo(PROF, at1, "Pele respondeu bem.", 0)));
    evolucao = r.id;
    expect(erro(salvarEvo(PROF, at1, "Aba velha", 0))).toMatch(/registro_conflito/);
  });
});

describe("leitura", () => {
  it("profissional lê; admin sem papel clínico e recepção leem 0; outra empresa lê 0", () => {
    for (const t of ["clinic_formularios_preenchidos", "clinic_evolucoes"]) {
      expect(contarComo(PROF, t)).toBe("1");
      expect(contarComo(ADM, t)).toBe("0");
      expect(contarComo(RECEP, t)).toBe("0");
      expect(contarComo(PROF_B, t, ORG)).toBe("0");
    }
  });
});

describe("finalizar e imutabilidade", () => {
  it("sem os campos obrigatórios do formulário iniciado, finalizar é recusado com a lista", () => {
    const v = versaoDoModelo(ORG, "Avaliação geral");
    sql(salvarForm(PROF, at1, "avaliacao", v, { observacoes: "sem achados escritos" }, 0));
    const e = erro(finalizar(PROF, at1));
    expect(e).toMatch(/requisitos_pendentes/);
    expect(e).toMatch(/avaliacao/);
    sql(salvarForm(PROF, at1, "avaliacao", v, { observacoes: "ok", achados: "Pele oleosa" }, 1));
  });

  it("sem evolução, finalizar é recusado", () => {
    expect(erro(finalizar(PROF, at2))).toMatch(/requisitos_pendentes/);
  });

  it("finaliza: registros ficam 'finalizado'", () => {
    expect(json<{ mudou: boolean }>(sql(finalizar(PROF, at1))).mudou).toBe(true);
    expect(ultima(sql(`select string_agg(status, ',') from public.clinic_formularios_preenchidos where atendimento_id = '${at1}';`))).toBe(
      "finalizado,finalizado",
    );
    expect(ultima(sql(`select status from public.clinic_evolucoes where id = '${evolucao}';`))).toBe("finalizado");
  });

  it("depois de finalizado: salvar é recusado; UPDATE e DELETE diretos são recusados até como superusuário", () => {
    expect(erro(salvarEvo(PROF, at1, "tentativa", 1))).toMatch(/prontuario_imutavel/);
    expect(erro(`update public.clinic_evolucoes set resposta = 'alterado' where id = '${evolucao}';`)).toMatch(/prontuario_imutavel/);
    expect(erro(`delete from public.clinic_formularios_preenchidos where id = '${anamnese}';`)).toMatch(/prontuario_imutavel/);
    expect(ultima(sql(`select resposta from public.clinic_evolucoes where id = '${evolucao}';`))).toBe("Pele respondeu bem.");
  });

  it("rascunho de atendimento aberto também não se apaga", () => {
    sql(salvarEvo(PROF, at2, "rascunho", 0));
    expect(erro(`delete from public.clinic_evolucoes where atendimento_id = '${at2}';`)).toMatch(/prontuario_imutavel/);
  });
});

describe("adendos", () => {
  it("em atendimento aberto é recusado (edita-se o rascunho)", () => {
    const evo2 = ultima(sql(`select id from public.clinic_evolucoes where atendimento_id = '${at2}';`));
    expect(
      erro(como(PROF, `select public.fn_clinic_adicionar_adendo('${ORG}', '${at2}', 'evolucao', '${evo2}', 'texto', 'motivo');`)),
    ).toMatch(/adendo_so_em_finalizado/);
  });

  it("sem permissão é recusado; alvo de outro atendimento é recusado; motivo é obrigatório", () => {
    expect(
      erro(como(RECEP, `select public.fn_clinic_adicionar_adendo('${ORG}', '${at1}', 'evolucao', '${evolucao}', 'texto', 'motivo');`)),
    ).toMatch(/acesso_proibido/);
    const evo2 = ultima(sql(`select id from public.clinic_evolucoes where atendimento_id = '${at2}';`));
    expect(
      erro(como(PROF, `select public.fn_clinic_adicionar_adendo('${ORG}', '${at1}', 'evolucao', '${evo2}', 'texto', 'motivo');`)),
    ).toMatch(/adendo_alvo_invalido/);
    expect(
      erro(como(PROF, `select public.fn_clinic_adicionar_adendo('${ORG}', '${at1}', 'evolucao', '${evolucao}', 'texto', 'x');`)),
    ).toMatch(/adendo_sem_motivo/);
  });

  it("aceito em finalizado; o original continua igual; adendo é append-only", () => {
    const r = json<{ id: string }>(
      sql(
        como(
          PROF,
          `select public.fn_clinic_adicionar_adendo('${ORG}', '${at1}', 'evolucao', '${evolucao}', 'Paciente relatou vermelhidão leve no dia seguinte.', 'Informação posterior');`,
        ),
      ),
    );
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(ultima(sql(`select resposta from public.clinic_evolucoes where id = '${evolucao}';`))).toBe("Pele respondeu bem.");
    expect(erro(`set role service_role; update public.clinic_adendos set texto = 'x' where id = '${r.id}';`)).toMatch(/permission denied/);
    expect(contarComo(PROF, "clinic_adendos")).toBe("1");
    expect(contarComo(ADM, "clinic_adendos")).toBe("0");
  });
});

describe("privilégios", () => {
  it.each([
    "public.fn_clinic_salvar_formulario(uuid, uuid, text, uuid, jsonb, integer)",
    "public.fn_clinic_salvar_evolucao(uuid, uuid, text, text, text, text, text, integer)",
    "public.fn_clinic_adicionar_adendo(uuid, uuid, text, uuid, text, text)",
    "public.fn_clinic_semear_modelos(uuid)",
  ])("anon não executa %s", (fn) => {
    expect(ultima(sql(`select has_function_privilege('anon', '${fn}', 'execute');`))).toBe("f");
  });
});
