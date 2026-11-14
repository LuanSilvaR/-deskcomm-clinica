/**
 * clinic (fork, agenda S3 #68) — migration 8016: procedimentos do agendamento.
 *
 * Prova no Postgres real:
 *   - a função grava a lista na ordem, troca a lista inteira e conta repetido uma vez;
 *   - procedimento de OUTRA empresa e agendamento de outra empresa são recusados;
 *   - a sessão lê só a própria empresa (isolamento de 2 orgs) e não escreve direto;
 *   - authenticated e anon não executam a função (só service_role);
 *   - a reserva da véspera passa a ler os procedimentos do agendamento.
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

const ORG = "c8016000-0000-4000-8000-00000000000a";
const ORG_B = "c8016000-0000-4000-8000-00000000000b";
const USU = "c8016000-1111-4000-8000-0000000000a1";
const USU_B = "c8016000-1111-4000-8000-0000000000b1";
const AG = "c8016000-3333-4000-8000-000000000001";
const AG_B = "c8016000-3333-4000-8000-000000000002";
const P1 = "c8016000-4444-4000-8000-000000000001";
const P2 = "c8016000-4444-4000-8000-000000000002";
const P_B = "c8016000-4444-4000-8000-0000000000b1";
const PROD = "c8016000-5555-4000-8000-000000000001";

const salvar = (org: string, ag: string, procs: string[]) =>
  `select public.fn_clinic_agendamento_procedimentos_salvar('${org}', '${ag}', array[${procs.map((p) => `'${p}'::uuid`).join(",")}]::uuid[], null);`;
const lista = (ag: string) =>
  sql(`select string_agg(procedure_id::text || ':' || ordem, ',' order by ordem) from public.clinic_agendamento_procedimentos where appointment_id = '${ag}';`);

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${USU}', 'agproc-a@invariant.test'), ('${USU_B}', 'agproc-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'agproc-inv-a', 'AgProc Invariant A', 'AgProc A', '{"clinic":{"estoque":true}}'::jsonb),
      ('${ORG_B}', 'agproc-inv-b', 'AgProc Invariant B', 'AgProc B', '{}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${USU}', '${ORG}', 'manager', now()), ('${USU_B}', '${ORG_B}', 'manager', now())
      on conflict do nothing;
    insert into public.clinic_procedures (id, organization_id, name, short_description) values
      ('${P1}', '${ORG}', 'Procedimento 1', 'Teste'), ('${P2}', '${ORG}', 'Procedimento 2', 'Teste'), ('${P_B}', '${ORG_B}', 'Procedimento B', 'Teste')
      on conflict (id) do nothing;
    insert into public.calendar_appointments (id, organization_id, title, starts_at, ends_at, owner_user_id, status) values
      ('${AG}', '${ORG}', 'Consulta', now() + interval '20 hours', now() + interval '21 hours', '${USU}', 'confirmed'),
      ('${AG_B}', '${ORG_B}', 'Consulta B', now() + interval '20 hours', now() + interval '21 hours', '${USU_B}', 'confirmed')
      on conflict (id) do nothing;
  `);
});

describe("8016 — procedimentos do agendamento", () => {
  it("grava na ordem, troca a lista inteira e conta repetido uma vez", () => {
    expect(ultima(sql(salvar(ORG, AG, [P2, P1, P2])))).toBe("2");
    expect(lista(AG)).toBe(`${P2}:0,${P1}:1`);
    expect(ultima(sql(salvar(ORG, AG, [P1])))).toBe("1");
    expect(lista(AG)).toBe(`${P1}:0`);
    expect(ultima(sql(salvar(ORG, AG, [])))).toBe("0");
    expect(lista(AG)).toBe("");
  });

  it("procedimento de outra empresa e agendamento de outra empresa são recusados", () => {
    expect(erro(salvar(ORG, AG, [P_B]))).toMatch(/procedimento_de_outra_organizacao/);
    expect(erro(salvar(ORG, AG_B, [P1]))).toMatch(/agendamento_nao_encontrado/);
  });

  it("isolamento: cada sessão lê só a própria empresa e não escreve direto", () => {
    sql(salvar(ORG, AG, [P1]));
    sql(salvar(ORG_B, AG_B, [P_B]));
    expect(ultima(sql(como(USU, `select count(*) from public.clinic_agendamento_procedimentos where organization_id in ('${ORG}', '${ORG_B}');`)))).toBe("1");
    expect(ultima(sql(como(USU_B, `select count(*) from public.clinic_agendamento_procedimentos where organization_id in ('${ORG}', '${ORG_B}');`)))).toBe("1");
    expect(
      erro(como(USU, `insert into public.clinic_agendamento_procedimentos (organization_id, appointment_id, procedure_id) values ('${ORG}', '${AG}', '${P2}');`)),
    ).toMatch(/permission denied/);
  });

  it("authenticated e anon não executam a função", () => {
    expect(erro(como(USU, salvar(ORG, AG, [P1])))).toMatch(/permission denied/);
    expect(erro(`set role anon; ${salvar(ORG, AG, [P1])}`)).toMatch(/permission denied/);
  });

  it("a reserva da véspera lê os procedimentos do agendamento", () => {
    sql(`
      insert into public.catalog_products (id, organization_id, codigo, nome, preco_cents) values ('${PROD}', '${ORG}', 'AGPROC-1', 'Insumo AgProc', 0) on conflict (id) do nothing;
      insert into public.clinic_produto_estoque (organization_id, product_id) values ('${ORG}', '${PROD}') on conflict do nothing;
      insert into public.clinic_procedimento_kits (organization_id, procedure_id, product_id, quantidade)
        values ('${ORG}', '${P2}', '${PROD}', 2) on conflict do nothing;
    `);
    sql(salvar(ORG, AG, [P2]));
    sql(`select public.fn_clinic_estoque_reservar_agenda();`);
    expect(
      sql(`select quantidade::int from public.clinic_estoque_reservas where appointment_id = '${AG}' and product_id = '${PROD}' and status = 'ativa';`),
    ).toBe("2");
  });
});
