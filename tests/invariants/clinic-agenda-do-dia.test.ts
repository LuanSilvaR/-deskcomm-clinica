/**
 * clinic (fork) — migration 9014: a opção "Agenda do dia".
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. nasce desligada (organização sem a chave);
 *   2. só o admin da PRÓPRIA empresa liga/desliga — gerente e admin de outra
 *      empresa recebem 42501; as outras chaves de settings.clinic ficam;
 *   3. anon não executa a função.
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

const ultima = (out: string) => out.split("\n").at(-1) ?? "";

const ORG_A = "7d7d0000-0000-4000-8000-00000000000a";
const ORG_B = "7d7d0000-0000-4000-8000-00000000000b";
const ADMIN_A = "7d7d0000-1111-4000-8000-0000000000a1";
const MANAGER_A = "7d7d0000-1111-4000-8000-0000000000a2";
const ADMIN_B = "7d7d0000-1111-4000-8000-0000000000b1";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADMIN_A}', 'dia-admin-a@invariant.test'),
      ('${MANAGER_A}', 'dia-manager-a@invariant.test'),
      ('${ADMIN_B}', 'dia-admin-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG_A}', 'dia-inv-a', 'Dia Invariant A', 'Dia A', '{"clinic":{"profissionais":true}}'::jsonb),
      ('${ORG_B}', 'dia-inv-b', 'Dia Invariant B', 'Dia B', '{}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADMIN_A}', '${ORG_A}', 'admin', now()),
      ('${MANAGER_A}', '${ORG_A}', 'manager', now()),
      ('${ADMIN_B}', '${ORG_B}', 'admin', now())
      on conflict do nothing;
  `);
});

describe("opção agenda_do_dia (9014)", () => {
  it("nasce desligada", () => {
    expect(ultima(sql(`select coalesce(settings->'clinic'->>'agenda_do_dia', 'ausente') from public.organizations where id = '${ORG_A}';`))).toBe(
      "ausente",
    );
  });

  it("gerente não liga: 42501", () => {
    expect(erro(como(MANAGER_A, `select public.fn_clinic_definir_agenda_do_dia('${ORG_A}', true);`))).toMatch(/clinic_flag_forbidden/);
  });

  it("admin de OUTRA empresa não liga: 42501", () => {
    expect(erro(como(ADMIN_B, `select public.fn_clinic_definir_agenda_do_dia('${ORG_A}', true);`))).toMatch(/clinic_flag_forbidden/);
  });

  it("admin liga e desliga, e as outras chaves de settings.clinic ficam", () => {
    expect(ultima(sql(como(ADMIN_A, `select public.fn_clinic_definir_agenda_do_dia('${ORG_A}', true);`)))).toContain('"mudou": true');
    expect(ultima(sql(como(ADMIN_A, `select public.fn_clinic_definir_agenda_do_dia('${ORG_A}', true);`)))).toContain('"mudou": false');
    expect(
      ultima(sql(`select settings->'clinic'->>'agenda_do_dia', settings->'clinic'->>'profissionais' from public.organizations where id = '${ORG_A}';`)),
    ).toBe("true|true");
    sql(como(ADMIN_A, `select public.fn_clinic_definir_agenda_do_dia('${ORG_A}', false);`));
    expect(ultima(sql(`select settings->'clinic'->>'agenda_do_dia' from public.organizations where id = '${ORG_A}';`))).toBe("false");
  });

  it("anon não executa", () => {
    expect(ultima(sql(`select has_function_privilege('anon', 'public.fn_clinic_definir_agenda_do_dia(uuid, boolean)', 'execute');`))).toBe("f");
  });
});
