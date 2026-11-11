/**
 * clinic (fork, marca) — migration 8012: favicon da empresa.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   - admin grava e apaga `settings.clinic.favicon_path`, sem tocar nas outras
 *     opções da clínica nem em `settings.branding`;
 *   - quem não é admin é recusado (42501);
 *   - caminho de OUTRA organização, JPG ou fora da forma: 22023;
 *   - só o service_role executa (authenticated e anon não).
 * Dados fictícios.
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
const ultima = (out: string) => out.split("\n").at(-1) ?? "";

const ORG = "c8012000-0000-4000-8000-00000000000a";
const OUTRA = "c8012000-0000-4000-8000-00000000000b";
const ADM = "c8012000-1111-4000-8000-0000000000a1";
const AGT = "c8012000-1111-4000-8000-0000000000a2";
const ARQ = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const chamar = (ator: string, caminho: string | null, org = ORG) =>
  `set role service_role; select public.fn_clinic_definir_favicon('${org}', '${ator}', ${caminho === null ? "null" : `'${caminho}'`});`;
const settings = () => ultima(sql(`select settings::text from public.organizations where id = '${ORG}';`));

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'favicon-adm@invariant.test'), ('${AGT}', 'favicon-agt@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'favicon-inv', 'Favicon Invariant', 'Favicon',
       jsonb_build_object('clinic', jsonb_build_object('encaixe', true),
                          'branding', jsonb_build_object('app_name', 'Marca Ficticia'))),
      ('${OUTRA}', 'favicon-inv-outra', 'Favicon Outra', 'Outra', '{}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${AGT}', '${ORG}', 'agent', now())
      on conflict do nothing;
  `);
});

describe("8012 — favicon da empresa", () => {
  it("admin grava o caminho em settings.clinic e preserva o resto", () => {
    expect(ultima(sql(chamar(ADM, `${ORG}/${ARQ}.png`)))).toBe("1");
    const s = JSON.parse(settings()) as { clinic: Record<string, unknown>; branding: Record<string, unknown> };
    expect(s.clinic.favicon_path).toBe(`${ORG}/${ARQ}.png`);
    expect(s.clinic.encaixe).toBe(true);
    expect(s.branding.app_name).toBe("Marca Ficticia");
  });

  it("apagar remove só a chave do favicon", () => {
    expect(ultima(sql(chamar(ADM, null)))).toBe("1");
    const s = JSON.parse(settings()) as { clinic: Record<string, unknown> };
    expect(s.clinic.favicon_path).toBeUndefined();
    expect(s.clinic.encaixe).toBe(true);
  });

  it("quem não é admin é recusado", () => {
    expect(erro(chamar(AGT, `${ORG}/${ARQ}.png`))).toContain("favicon_sem_permissao");
  });

  it.each([
    ["outra organização", `${OUTRA}/${ARQ}.png`],
    ["JPG", `${ORG}/${ARQ}.jpg`],
    ["subindo de pasta", `${ORG}/../platform/${ARQ}.png`],
  ])("recusa caminho: %s", (_n, caminho) => {
    expect(erro(chamar(ADM, caminho))).toContain("favicon_caminho_fora_do_escopo");
  });

  it("authenticated e anon não executam", () => {
    for (const papel of ["authenticated", "anon"]) {
      const e = erro(
        `set role ${papel}; select public.fn_clinic_definir_favicon('${ORG}', '${ADM}', null);`,
      );
      expect(e, papel).toMatch(/permission denied/);
    }
  });
});
