/**
 * clinic (fork) — migration 9008: prazo mínimo para o paciente desmarcar.
 *
 * Prova no Postgres real: só admin grava; a faixa é 0 a 168 horas; gravar
 * preserva as outras chaves de settings.clinic; anon não executa.
 * A regra em si (o agente não desmarca dentro do prazo) é do handler e é
 * provada em lib/clinic/agenda/prazo-do-paciente.test.ts.
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

const ORG = "9a8a0000-0000-4000-8000-00000000000a";
const ADMIN = "9a8a0000-1111-4000-8000-0000000000a1";
const MANAGER = "9a8a0000-1111-4000-8000-0000000000a3";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADMIN}', 'prazo-admin@invariant.test'), ('${MANAGER}', 'prazo-manager@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'prazo-inv', 'Prazo Invariant', 'Prazo', '{"clinic":{"profissionais":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADMIN}', '${ORG}', 'admin', now()), ('${MANAGER}', '${ORG}', 'manager', now())
      on conflict do nothing;
  `);
});

describe("prazo do paciente", () => {
  it("gerente não grava: 42501", () => {
    expect(erro(como(MANAGER, `select public.fn_clinic_definir_prazo_do_paciente('${ORG}', 24);`))).toMatch(/clinic_flag_forbidden/);
  });

  it.each([-1, 169])("fora da faixa (%d h) é recusado", (h) => {
    expect(erro(como(ADMIN, `select public.fn_clinic_definir_prazo_do_paciente('${ORG}', ${h});`))).toMatch(/clinic_prazo_invalido/);
  });

  it("admin grava 24 h e as outras chaves ficam", () => {
    expect(ultima(sql(como(ADMIN, `select public.fn_clinic_definir_prazo_do_paciente('${ORG}', 24);`)))).toContain('"mudou": true');
    expect(
      ultima(sql(`select settings->'clinic'->>'prazo_paciente_horas', settings->'clinic'->>'profissionais' from public.organizations where id = '${ORG}';`)),
    ).toBe("24|true");
    expect(ultima(sql(como(ADMIN, `select public.fn_clinic_definir_prazo_do_paciente('${ORG}', 24);`)))).toContain('"mudou": false');
  });

  it("anon não executa", () => {
    expect(ultima(sql(`select has_function_privilege('anon', 'public.fn_clinic_definir_prazo_do_paciente(uuid, integer)', 'execute');`))).toBe("f");
  });
});
