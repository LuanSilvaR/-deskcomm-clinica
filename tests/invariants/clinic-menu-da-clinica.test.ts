/**
 * clinic (fork) — migration 9014: menu por módulos da clínica.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. a opção nasce desligada (nenhuma chave gravada);
 *   2. gerente não liga (42501 clinic_flag_forbidden); admin liga e desliga,
 *      preservando as outras chaves de `settings.clinic`;
 *   3. admin de OUTRA organização não liga a desta;
 *   4. anon não executa a função.
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

const ORG_A = "5a1a0000-0000-4000-8000-0000000014aa";
const ORG_B = "5a1a0000-0000-4000-8000-0000000014bb";
const ADMIN_A = "5a1a0000-1111-4000-8000-0000000014a1";
const MANAGER_A = "5a1a0000-1111-4000-8000-0000000014a2";
const ADMIN_B = "5a1a0000-1111-4000-8000-0000000014b1";

const menuDe = (org: string) =>
  ultima(sql(`select coalesce(settings->'clinic'->>'menu_clinica', '-') from public.organizations where id = '${org}';`));

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADMIN_A}', 'menu-admin-a@invariant.test'), ('${MANAGER_A}', 'menu-manager-a@invariant.test'),
      ('${ADMIN_B}', 'menu-admin-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG_A}', 'menu-inv-a', 'Menu Invariant A', 'Menu A', '{"clinic":{"profissionais":true}}'::jsonb),
      ('${ORG_B}', 'menu-inv-b', 'Menu Invariant B', 'Menu B', '{}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADMIN_A}', '${ORG_A}', 'admin', now()), ('${MANAGER_A}', '${ORG_A}', 'manager', now()),
      ('${ADMIN_B}', '${ORG_B}', 'admin', now())
      on conflict do nothing;
  `);
});

describe("menu da clínica (9014)", () => {
  it("nasce desligado: nenhuma chave gravada", () => {
    expect(menuDe(ORG_A)).toBe("-");
    expect(menuDe(ORG_B)).toBe("-");
  });

  it("gerente não liga: 42501", () => {
    expect(erro(como(MANAGER_A, `select public.fn_clinic_definir_menu_clinica('${ORG_A}', true);`))).toMatch(
      /clinic_flag_forbidden/,
    );
    expect(menuDe(ORG_A)).toBe("-");
  });

  it("admin de outra organização não liga a desta", () => {
    expect(erro(como(ADMIN_B, `select public.fn_clinic_definir_menu_clinica('${ORG_A}', true);`))).toMatch(
      /clinic_flag_forbidden/,
    );
    expect(menuDe(ORG_A)).toBe("-");
  });

  it("admin liga e desliga, preservando as outras chaves", () => {
    expect(ultima(sql(como(ADMIN_A, `select public.fn_clinic_definir_menu_clinica('${ORG_A}', true);`)))).toContain(
      '"mudou": true',
    );
    expect(
      ultima(
        sql(
          `select settings->'clinic'->>'menu_clinica', settings->'clinic'->>'profissionais' from public.organizations where id = '${ORG_A}';`,
        ),
      ),
    ).toBe("true|true");
    expect(ultima(sql(como(ADMIN_A, `select public.fn_clinic_definir_menu_clinica('${ORG_A}', true);`)))).toContain(
      '"mudou": false',
    );
    sql(como(ADMIN_A, `select public.fn_clinic_definir_menu_clinica('${ORG_A}', false);`));
    expect(menuDe(ORG_A)).toBe("false");
    expect(menuDe(ORG_B)).toBe("-");
  });

  it("anon não executa a função", () => {
    expect(
      ultima(sql(`select has_function_privilege('anon', 'public.fn_clinic_definir_menu_clinica(uuid, boolean)', 'execute');`)),
    ).toBe("f");
  });
});
