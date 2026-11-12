/**
 * clinic (fork, #154) — migration 8025: pacote inicial da clínica.
 *
 * Prova no Postgres real:
 *   - o service role liga os 9 módulos do pacote numa organização nova;
 *   - chave já presente em settings.clinic vence o pacote (não sobrescreve);
 *   - outras chaves de settings ficam intactas e a outra organização não muda;
 *   - authenticated (mesmo admin da organização) e anon não executam a função;
 *   - organização inexistente = P0002.
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
function erro(script: string): string | null {
  try {
    sql(script);
    return null;
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
}
const ultima = (out: string) => out.split("\n").at(-1) ?? "";

const ORG = "c8025000-0000-4000-8000-00000000000a";
const ORG_B = "c8025000-0000-4000-8000-00000000000b";
const ADM = "c8025000-1111-4000-8000-0000000000a1";
const PACOTE = ["encaixe", "estoque", "menu_clinica", "orcamentos", "procedimentos", "profissionais", "prontuario", "recursos", "trava_sobreposicao"];

const clinic = (org: string): Record<string, unknown> =>
  JSON.parse(ultima(sql(`select coalesce(settings -> 'clinic', '{}'::jsonb) from public.organizations where id = '${org}';`)));

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values ('${ADM}', 'pacote-adm@invariant.test') on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name) values
      ('${ORG}', 'pacote-inv-a', 'Pacote Invariant A', 'Pacote A'),
      ('${ORG_B}', 'pacote-inv-b', 'Pacote Invariant B', 'Pacote B')
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()) on conflict do nothing;
    update public.organizations
       set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{clinic}', '{"estoque": false, "titulo_livre": true}'::jsonb, true)
     where id = '${ORG}';
  `);
});

afterAll(() => {
  sql(`
    delete from public.organizations where id in ('${ORG}', '${ORG_B}');
    delete from auth.users where id = '${ADM}';
  `);
});

describe("pacote inicial da clínica (8025)", () => {
  it("authenticated (mesmo admin) e anon não executam", () => {
    expect(
      erro(`set role authenticated; select set_config('request.jwt.claims', '{"sub":"${ADM}"}', false);
            select public.fn_clinic_aplicar_pacote_inicial('${ORG}');`),
    ).toMatch(/permission denied/);
    expect(erro(`set role anon; select public.fn_clinic_aplicar_pacote_inicial('${ORG}');`)).toMatch(/permission denied/);
    expect(clinic(ORG)).toEqual({ estoque: false, titulo_livre: true });
  });

  it("service role liga o pacote sem sobrescrever o que já foi escolhido", () => {
    const antesB = clinic(ORG_B);
    sql(`set role service_role; select public.fn_clinic_aplicar_pacote_inicial('${ORG}');`);
    const depois = clinic(ORG);
    for (const chave of PACOTE.filter((k) => k !== "estoque")) expect(depois[chave]).toBe(true);
    expect(depois.estoque).toBe(false);
    expect(depois.titulo_livre).toBe(true);
    expect(clinic(ORG_B)).toEqual(antesB);
  });

  it("idempotente: reaplicar não muda nada", () => {
    const antes = clinic(ORG);
    sql(`set role service_role; select public.fn_clinic_aplicar_pacote_inicial('${ORG}');`);
    expect(clinic(ORG)).toEqual(antes);
  });

  it("organização inexistente = P0002", () => {
    expect(
      erro(`set role service_role; select public.fn_clinic_aplicar_pacote_inicial('c8025000-0000-4000-8000-0000000000ff');`),
    ).toMatch(/organization_not_found/);
  });
});
