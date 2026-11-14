/**
 * clinic (fork) — migration 9015: procedimentos e POP.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. isolamento entre empresas e escrita só com a permissão;
 *   2. vínculo com especialidade/profissional de OUTRA empresa é recusado (FK composta);
 *   3. coerência: profissional vinculado precisa ter uma das especialidades;
 *   4. POP: cria 1.0 em rascunho (POP-001), só quem tem pops.editar; outra
 *      empresa não cria;
 *   5. rascunho se edita (lock_version sobe); status só muda pela função;
 *   6. aprovar exige pops.aprovar; aprovada é imutável e não se apaga;
 *   7. nova versão 1.1 (uma por vez); aprovar a 1.1 substitui a 1.0; revisão
 *      maior vai a 2.0; trava otimista recusa lock velho;
 *   8. permissões semeadas no Administrador e nos modelos; a opção é só de admin.
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

function erro(script: string): string | null {
  try {
    sql(script);
    return null;
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
}

function como(userId: string, corpo: string): string {
  return `
    set role authenticated;
    select set_config('request.jwt.claims', '{"sub":"${userId}"}', false);
    ${corpo}
  `;
}

const ultima = (out: string) => out.split("\n").filter((l) => l && l !== "SET").at(-1) ?? "";

const ORG_A = "7e7e0000-0000-4000-8000-00000000000a";
const ORG_B = "7e7e0000-0000-4000-8000-00000000000b";
const ADMIN_A = "7e7e0000-1111-4000-8000-0000000000a1";
const GERENTE_A = "7e7e0000-1111-4000-8000-0000000000a2";
const ATENDENTE_A = "7e7e0000-1111-4000-8000-0000000000a3";
const VISUALIZADOR_A = "7e7e0000-1111-4000-8000-0000000000a4";
const ADMIN_B = "7e7e0000-1111-4000-8000-0000000000b1";

const ESP_A = "7e7e0000-2222-4000-8000-00000000000a";
const ESP_A2 = "7e7e0000-2222-4000-8000-0000000000a2";
const ESP_B = "7e7e0000-2222-4000-8000-00000000000b";
const PROF_A_APTO = "7e7e0000-3333-4000-8000-0000000000a1";
const PROF_A_OUTRO = "7e7e0000-3333-4000-8000-0000000000a2";
const PROF_B = "7e7e0000-3333-4000-8000-0000000000b1";
const PROC_A = "7e7e0000-4444-4000-8000-00000000000a";
const PROC_B = "7e7e0000-4444-4000-8000-00000000000b";

const doc = (texto: string) => `'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"${texto}"}]}]}'::jsonb`;

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADMIN_A}', 'pop-admin-a@invariant.test'),
      ('${GERENTE_A}', 'pop-gerente-a@invariant.test'),
      ('${ATENDENTE_A}', 'pop-atendente-a@invariant.test'),
      ('${VISUALIZADOR_A}', 'pop-visualizador-a@invariant.test'),
      ('${ADMIN_B}', 'pop-admin-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG_A}', 'pop-inv-a', 'Pop Invariant A', 'Pop A', '{}'::jsonb),
      ('${ORG_B}', 'pop-inv-b', 'Pop Invariant B', 'Pop B', '{}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADMIN_A}', '${ORG_A}', 'admin', now()),
      ('${GERENTE_A}', '${ORG_A}', 'manager', now()),
      ('${ATENDENTE_A}', '${ORG_A}', 'agent', now()),
      ('${VISUALIZADOR_A}', '${ORG_A}', 'viewer', now()),
      ('${ADMIN_B}', '${ORG_B}', 'admin', now())
      on conflict do nothing;
    insert into public.clinic_specialties (id, organization_id, name) values
      ('${ESP_A}', '${ORG_A}', 'Esteticista POP'),
      ('${ESP_A2}', '${ORG_A}', 'Fisioterapia POP'),
      ('${ESP_B}', '${ORG_B}', 'Esteticista POP')
      on conflict (id) do nothing;
    insert into public.clinic_professionals (id, organization_id, user_id, display_name) values
      ('${PROF_A_APTO}', '${ORG_A}', '${GERENTE_A}', 'Apto'),
      ('${PROF_A_OUTRO}', '${ORG_A}', '${ATENDENTE_A}', 'Outro'),
      ('${PROF_B}', '${ORG_B}', '${ADMIN_B}', 'De B')
      on conflict (id) do nothing;
    insert into public.clinic_professional_specialties (organization_id, professional_id, specialty_id) values
      ('${ORG_A}', '${PROF_A_APTO}', '${ESP_A}'),
      ('${ORG_A}', '${PROF_A_OUTRO}', '${ESP_A2}')
      on conflict do nothing;
    insert into public.clinic_procedures (id, organization_id, name, short_description) values
      ('${PROC_B}', '${ORG_B}', 'Toxina B', 'Da empresa B')
      on conflict (id) do nothing;
  `);
});

describe("procedimentos (9015)", () => {
  it("gerente cria procedimento; atendente e visualizador não", () => {
    expect(
      erro(como(ATENDENTE_A, `insert into public.clinic_procedures (organization_id, name, short_description) values ('${ORG_A}', 'X', 'x');`)),
    ).toMatch(/row-level security/);
    expect(
      erro(como(VISUALIZADOR_A, `insert into public.clinic_procedures (organization_id, name, short_description) values ('${ORG_A}', 'Y', 'y');`)),
    ).toMatch(/row-level security/);
    sql(
      como(
        GERENTE_A,
        `insert into public.clinic_procedures (id, organization_id, name, short_description, duration_minutes)
           values ('${PROC_A}', '${ORG_A}', 'Toxina botulínica', 'Aplicação de toxina', 40);`,
      ),
    );
    expect(ultima(sql(`select created_by from public.clinic_procedures where id = '${PROC_A}';`))).toBe(GERENTE_A);
  });

  it("isolamento: quem é da A lê 0 procedimentos da B e o seu", () => {
    expect(ultima(sql(como(VISUALIZADOR_A, `select count(*) from public.clinic_procedures where id = '${PROC_B}';`)))).toBe("0");
    expect(ultima(sql(como(VISUALIZADOR_A, `select count(*) from public.clinic_procedures where id = '${PROC_A}';`)))).toBe("1");
    expect(ultima(sql(como(ADMIN_B, `select count(*) from public.clinic_procedures where id = '${PROC_A}';`)))).toBe("0");
  });

  it("vínculo com especialidade ou profissional de OUTRA empresa é recusado pela FK composta", () => {
    expect(
      erro(`insert into public.clinic_procedure_specialties (organization_id, procedure_id, specialty_id) values ('${ORG_A}', '${PROC_A}', '${ESP_B}');`),
    ).toMatch(/foreign key/);
    expect(
      erro(`insert into public.clinic_procedure_professionals (organization_id, procedure_id, professional_id) values ('${ORG_A}', '${PROC_A}', '${PROF_B}');`),
    ).toMatch(/foreign key/);
  });

  it("coerência: com especialidade exigida, só entra profissional que a tenha", () => {
    sql(
      como(
        GERENTE_A,
        `insert into public.clinic_procedure_specialties (organization_id, procedure_id, specialty_id) values ('${ORG_A}', '${PROC_A}', '${ESP_A}');`,
      ),
    );
    expect(
      erro(
        como(
          GERENTE_A,
          `insert into public.clinic_procedure_professionals (organization_id, procedure_id, professional_id) values ('${ORG_A}', '${PROC_A}', '${PROF_A_OUTRO}');`,
        ),
      ),
    ).toMatch(/procedimento_profissional_sem_especialidade/);
    sql(
      como(
        GERENTE_A,
        `insert into public.clinic_procedure_professionals (organization_id, procedure_id, professional_id) values ('${ORG_A}', '${PROC_A}', '${PROF_A_APTO}');`,
      ),
    );
  });
});

describe("POP (9015)", () => {
  let versao1 = "";
  let pop = "";

  it("atendente não cria POP; admin de outra empresa não acha o procedimento", () => {
    expect(erro(como(ATENDENTE_A, `select public.fn_pop_criar('${PROC_A}', null, ${doc("x")}, 'x');`))).toMatch(/acesso_proibido/);
    expect(erro(como(ADMIN_B, `select public.fn_pop_criar('${PROC_A}', null, ${doc("x")}, 'x');`))).toMatch(/procedimento_nao_encontrado/);
  });

  it("gerente cria: POP-001, versão 1.0 em rascunho, com quem criou", () => {
    const r = JSON.parse(ultima(sql(como(GERENTE_A, `select public.fn_pop_criar('${PROC_A}', null, ${doc("Objetivo")}, 'Objetivo');`)))) as {
      pop_id: string;
      versao_id: string;
      codigo: string;
    };
    expect(r.codigo).toBe("POP-001");
    pop = r.pop_id;
    versao1 = r.versao_id;
    expect(ultima(sql(`select major || '.' || minor || '|' || status || '|' || created_by from public.clinic_pop_versions where id = '${versao1}';`))).toBe(
      `1.0|draft|${GERENTE_A}`,
    );
    expect(erro(como(GERENTE_A, `select public.fn_pop_criar('${PROC_A}', null, ${doc("y")}, 'y');`))).toMatch(/pop_ja_existe/);
  });

  it("rascunho se edita (lock_version sobe, quem alterou fica); status não muda sem a função", () => {
    sql(como(ADMIN_A, `update public.clinic_pop_versions set content = ${doc("Objetivo revisado")}, content_text = 'Objetivo revisado' where id = '${versao1}';`));
    expect(ultima(sql(`select lock_version || '|' || updated_by from public.clinic_pop_versions where id = '${versao1}';`))).toBe(`2|${ADMIN_A}`);
    expect(erro(como(GERENTE_A, `update public.clinic_pop_versions set status = 'approved', approved_at = now() where id = '${versao1}';`))).toMatch(
      /pop_transicao_so_pela_funcao/,
    );
    expect(erro(como(VISUALIZADOR_A, `update public.clinic_pop_versions set content_text = 'z' where id = '${versao1}' returning id;`))).toBeNull();
    // o visualizador não tem pops.editar: o UPDATE não alcança linha nenhuma
    expect(ultima(sql(`select content_text from public.clinic_pop_versions where id = '${versao1}';`))).toBe("Objetivo revisado");
  });

  it("trava otimista: aprovar com lock velho é recusado", () => {
    expect(erro(como(GERENTE_A, `select public.fn_pop_aprovar('${versao1}', 1);`))).toMatch(/pop_editado_por_outra_pessoa/);
  });

  it("aprovar exige pops.aprovar; aprovada é imutável e não se apaga", () => {
    expect(erro(como(ATENDENTE_A, `select public.fn_pop_aprovar('${versao1}', 2);`))).toMatch(/acesso_proibido/);
    expect(erro(como(ADMIN_B, `select public.fn_pop_aprovar('${versao1}', 2);`))).toMatch(/pop_versao_nao_encontrada/);
    sql(como(GERENTE_A, `select public.fn_pop_aprovar('${versao1}', 2);`));
    expect(ultima(sql(`select status || '|' || approved_by from public.clinic_pop_versions where id = '${versao1}';`))).toBe(`approved|${GERENTE_A}`);
    expect(erro(como(ADMIN_A, `update public.clinic_pop_versions set content = ${doc("mudei")} where id = '${versao1}';`))).toMatch(/pop_versao_imutavel/);
    expect(erro(`delete from public.clinic_pop_versions where id = '${versao1}';`)).toMatch(/pop_versao_imutavel/);
  });

  it("nova versão: 1.1 em rascunho (uma por vez); aprovar substitui a 1.0; revisão maior vai a 2.0", () => {
    const n1 = JSON.parse(ultima(sql(como(GERENTE_A, `select public.fn_pop_nova_versao('${pop}', false, 'Ajuste de EPI');`)))) as {
      versao_id: string;
      major: number;
      minor: number;
    };
    expect(`${n1.major}.${n1.minor}`).toBe("1.1");
    expect(ultima(sql(`select content_text || '|' || revision_reason from public.clinic_pop_versions where id = '${n1.versao_id}';`))).toBe(
      "Objetivo revisado|Ajuste de EPI",
    );
    expect(erro(como(GERENTE_A, `select public.fn_pop_nova_versao('${pop}', false, null);`))).toMatch(/pop_ja_tem_rascunho/);

    sql(como(GERENTE_A, `select public.fn_pop_aprovar('${n1.versao_id}', null);`));
    expect(ultima(sql(`select status from public.clinic_pop_versions where id = '${versao1}';`))).toBe("superseded");
    expect(ultima(sql(`select count(*) from public.clinic_pop_versions where pop_id = '${pop}' and status = 'approved';`))).toBe("1");

    const n2 = JSON.parse(ultima(sql(como(GERENTE_A, `select public.fn_pop_nova_versao('${pop}', true, 'Nova técnica');`)))) as { major: number; minor: number };
    expect(`${n2.major}.${n2.minor}`).toBe("2.0");
  });

  it("rascunho se descarta; o POP de outra empresa fica invisível", () => {
    expect(erro(como(GERENTE_A, `delete from public.clinic_pop_versions where pop_id = '${pop}' and status = 'draft';`))).toBeNull();
    expect(ultima(sql(`select count(*) from public.clinic_pop_versions where pop_id = '${pop}' and status = 'draft';`))).toBe("0");
    expect(ultima(sql(como(ADMIN_B, `select count(*) from public.clinic_pop_versions where pop_id = '${pop}';`)))).toBe("0");
    expect(ultima(sql(como(ADMIN_B, `select count(*) from public.clinic_pops where id = '${pop}';`)))).toBe("0");
  });
});

describe("exclusão da empresa (9015)", () => {
  it("empresa com POP aprovado pode ser excluída (a cascata leva tudo junto)", () => {
    const ORG_C = "7e7e0000-0000-4000-8000-00000000000c";
    const PROC_C = "7e7e0000-4444-4000-8000-00000000000c";
    sql(`
      insert into public.organizations (id, slug, legal_name, display_name, settings)
        values ('${ORG_C}', 'pop-inv-c', 'Pop Invariant C', 'Pop C', '{}'::jsonb) on conflict (id) do nothing;
      insert into public.user_organizations (user_id, organization_id, role, accepted_at)
        values ('${ADMIN_A}', '${ORG_C}', 'admin', now()) on conflict do nothing;
      insert into public.clinic_procedures (id, organization_id, name, short_description)
        values ('${PROC_C}', '${ORG_C}', 'Proc C', 'c') on conflict (id) do nothing;
    `);
    const r = JSON.parse(ultima(sql(como(ADMIN_A, `select public.fn_pop_criar('${PROC_C}', null, ${doc("c")}, 'c');`)))) as { versao_id: string };
    sql(como(ADMIN_A, `select public.fn_pop_aprovar('${r.versao_id}', null);`));
    expect(erro(`delete from public.organizations where id = '${ORG_C}';`)).toBeNull();
    expect(ultima(sql(`select count(*) from public.clinic_pop_versions where organization_id = '${ORG_C}';`))).toBe("0");
  });

  it("procedimento com POP não se apaga (desative em vez disso)", () => {
    expect(erro(`delete from public.clinic_procedures where id = '${PROC_A}';`)).toMatch(/foreign key|violates/);
  });
});

describe("permissões e opção (9015)", () => {
  it("Administrador recebe tudo; visualizador vê e imprime, mas não edita nem aprova", () => {
    const doPapel = (chave: string) =>
      ultima(
        sql(`select string_agg(rp.permission_key, ',' order by rp.permission_key)
               from public.clinic_role_permissions rp join public.clinic_roles r on r.id = rp.role_id
              where r.organization_id = '${ORG_A}' and r.system_key = '${chave}' and rp.permission_key like 'pops.%';`),
      );
    expect(doPapel("administrador")).toBe("pops.aprovar,pops.editar,pops.imprimir,pops.ver");
    expect(doPapel("visualizador")).toBe("pops.imprimir,pops.ver");
  });

  it("a opção é só de admin, e anon não executa as funções", () => {
    expect(erro(como(GERENTE_A, `select public.fn_clinic_definir_procedimentos('${ORG_A}', true);`))).toMatch(/clinic_flag_forbidden/);
    expect(ultima(sql(como(ADMIN_A, `select public.fn_clinic_definir_procedimentos('${ORG_A}', true);`)))).toContain('"mudou": true');
    for (const fn of [
      "public.fn_clinic_definir_procedimentos(uuid, boolean)",
      "public.fn_pop_criar(uuid, text, jsonb, text)",
      "public.fn_pop_aprovar(uuid, integer)",
      "public.fn_pop_nova_versao(uuid, boolean, text)",
    ]) {
      expect(ultima(sql(`select has_function_privilege('anon', '${fn}', 'execute');`))).toBe("f");
    }
  });
});
