/**
 * clinic (fork, agenda #80) — migration 8005: opção da duração escolhida na marcação.
 *
 * Prova no Postgres real:
 *   - nasce desligada; só o administrador liga (e desliga);
 *   - gerente é recusado (`clinic_flag_forbidden`);
 *   - a função só mexe em `settings.clinic.duracao_na_marcacao` (as outras opções ficam);
 *   - anon não executa.
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

const ORG = "c8005000-0000-4000-8000-00000000000a";
const ADM = "c8005000-1111-4000-8000-0000000000a1";
const GER = "c8005000-1111-4000-8000-0000000000a2";

const opcao = () =>
  ultima(sql(`select coalesce(settings -> 'clinic' ->> 'duracao_na_marcacao', 'ausente') from public.organizations where id = '${ORG}';`));

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'duracao-adm@invariant.test'), ('${GER}', 'duracao-ger@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'duracao-na-marcacao-inv', 'Duração Livre Invariant', 'Duração Livre',
       jsonb_build_object('clinic', jsonb_build_object('encaixe', true)))
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${GER}', '${ORG}', 'manager', now())
      on conflict do nothing;
  `);
});

describe("opção da duração na marcação (8005)", () => {
  it("nasce desligada", () => {
    expect(opcao()).toBe("ausente");
  });

  it("gerente não liga", () => {
    expect(erro(como(GER, `select public.fn_clinic_definir_duracao_na_marcacao('${ORG}', true);`))).toMatch(/clinic_flag_forbidden/);
    expect(opcao()).toBe("ausente");
  });

  it("⭐ o administrador liga e desliga, sem mexer nas outras opções", () => {
    const ligou = ultima(sql(como(ADM, `select public.fn_clinic_definir_duracao_na_marcacao('${ORG}', true);`)));
    expect(JSON.parse(ligou)).toEqual({ ligado: true, mudou: true });
    expect(opcao()).toBe("true");
    expect(ultima(sql(`select settings -> 'clinic' ->> 'encaixe' from public.organizations where id = '${ORG}';`))).toBe("true");

    const de_novo = ultima(sql(como(ADM, `select public.fn_clinic_definir_duracao_na_marcacao('${ORG}', true);`)));
    expect(JSON.parse(de_novo)).toEqual({ ligado: true, mudou: false });

    sql(como(ADM, `select public.fn_clinic_definir_duracao_na_marcacao('${ORG}', false);`));
    expect(opcao()).toBe("false");
  });

  it("anon não executa", () => {
    expect(erro(`set role anon; select public.fn_clinic_definir_duracao_na_marcacao('${ORG}', true);`)).toMatch(/permission denied/);
  });
});
