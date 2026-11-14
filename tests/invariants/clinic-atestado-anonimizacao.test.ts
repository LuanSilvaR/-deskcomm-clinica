/**
 * clinic (fork, LGPD #87) — migration 8024: atestado de anonimização.
 *
 * Prova no Postgres real:
 *   - a chave `settings.clinic.atestado_anonimizacao` liga/desliga (só admin) e informa `mudou`;
 *   - gerente é recusado (42501);
 *   - o admin da empresa A lê a linha da A e 0 linhas da B;
 *   - `authenticated` não insere, não altera e não apaga;
 *   - um segundo atestado para o mesmo (empresa, contato) viola a unicidade (23505);
 *   - anon não executa a função.
 */
import { execFileSync } from "node:child_process";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

const ORG = "c8024000-0000-4000-8000-00000000000a";
const ORG_B = "c8024000-0000-4000-8000-00000000000b";
const ADM = "c8024000-1111-4000-8000-0000000000a1";
const GER = "c8024000-1111-4000-8000-0000000000a2";
const ADM_B = "c8024000-1111-4000-8000-0000000000b1";
const CONTATO = "c8024000-2222-4000-8000-0000000000a1";
const CONTATO_B = "c8024000-2222-4000-8000-0000000000b1";

const inserir = (org: string, contato: string) => `
  insert into public.clinic_atestados_anonimizacao
    (organization_id, contact_id, anonimizado_em, executor, codigo, codigo_curto, algoritmo, pdf_path, pdf_sha256, versao)
  values ('${org}', '${contato}', now(), '{"nome":"Executor Teste"}'::jsonb, 'COD-TESTE-LONGO', 'CURTO1',
          'hmac-sha256', 'atestados/teste.pdf', 'abc123', '1');
`;
const opcao = () =>
  ultima(
    sql(`select coalesce(settings -> 'clinic' ->> 'atestado_anonimizacao', 'ausente') from public.organizations where id = '${ORG}';`),
  );

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'atestado-adm@invariant.test'), ('${GER}', 'atestado-ger@invariant.test'),
      ('${ADM_B}', 'atestado-adm-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name) values
      ('${ORG}', 'atestado-inv-a', 'Atestado Invariant A', 'Atestado A'),
      ('${ORG_B}', 'atestado-inv-b', 'Atestado Invariant B', 'Atestado B')
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${GER}', '${ORG}', 'manager', now()),
      ('${ADM_B}', '${ORG_B}', 'admin', now())
      on conflict do nothing;
    insert into public.contacts (id, organization_id, name) values
      ('${CONTATO}', '${ORG}', 'Contato Teste A'), ('${CONTATO_B}', '${ORG_B}', 'Contato Teste B')
      on conflict (id) do nothing;
    ${inserir(ORG, CONTATO)}
    ${inserir(ORG_B, CONTATO_B)}
  `);
});

afterAll(() => {
  sql(`
    delete from public.clinic_atestados_anonimizacao where organization_id in ('${ORG}', '${ORG_B}');
    delete from public.contacts where id in ('${CONTATO}', '${CONTATO_B}');
    delete from public.organizations where id in ('${ORG}', '${ORG_B}');
    delete from auth.users where id in ('${ADM}', '${GER}', '${ADM_B}');
  `);
});

describe("atestado de anonimização (8024)", () => {
  it("a chave nasce desligada, gerente não liga, admin liga e desliga", () => {
    expect(opcao()).toBe("ausente");
    expect(erro(como(GER, `select public.fn_clinic_definir_atestado_anonimizacao('${ORG}', true);`))).toMatch(/clinic_flag_forbidden/);
    const ligou = ultima(sql(como(ADM, `select public.fn_clinic_definir_atestado_anonimizacao('${ORG}', true);`)));
    expect(JSON.parse(ligou)).toEqual({ ligado: true, mudou: true });
    expect(opcao()).toBe("true");
    const igual = ultima(sql(como(ADM, `select public.fn_clinic_definir_atestado_anonimizacao('${ORG}', true);`)));
    expect(JSON.parse(igual)).toEqual({ ligado: true, mudou: false });
    sql(como(ADM, `select public.fn_clinic_definir_atestado_anonimizacao('${ORG}', false);`));
    expect(opcao()).toBe("false");
  });

  it("anon não executa a função", () => {
    expect(erro(`set role anon; select public.fn_clinic_definir_atestado_anonimizacao('${ORG}', true);`)).toMatch(/permission denied/);
  });

  it("isolamento: admin da A lê 1 linha da A e 0 da B", () => {
    const da_a = ultima(sql(como(ADM, `select count(*) from public.clinic_atestados_anonimizacao where organization_id = '${ORG}';`)));
    const da_b = ultima(sql(como(ADM, `select count(*) from public.clinic_atestados_anonimizacao where organization_id = '${ORG_B}';`)));
    expect(da_a).toBe("1");
    expect(da_b).toBe("0");
  });

  it("gerente não lê (só admin)", () => {
    const n = ultima(sql(como(GER, `select count(*) from public.clinic_atestados_anonimizacao;`)));
    expect(n).toBe("0");
  });

  it("authenticated não insere, não altera e não apaga", () => {
    expect(erro(como(ADM, inserir(ORG, CONTATO)))).toMatch(/permission denied/);
    expect(erro(como(ADM, `update public.clinic_atestados_anonimizacao set versao = '2' where organization_id = '${ORG}';`))).toMatch(
      /permission denied/,
    );
    expect(erro(como(ADM, `delete from public.clinic_atestados_anonimizacao where organization_id = '${ORG}';`))).toMatch(
      /permission denied/,
    );
  });

  it("segundo atestado do mesmo contato viola a unicidade (23505)", () => {
    expect(erro(inserir(ORG, CONTATO))).toMatch(/23505|unique|duplicate/i);
  });
});
