/**
 * clinic (fork, profissionais #97) — migration 8004: o profissional grava o
 * PRÓPRIO registro no conselho.
 *
 * Prova no Postgres real:
 *   - o profissional altera conselho, número e UF da própria ficha;
 *   - a ficha do colega não muda (a função só olha auth.uid());
 *   - especialidades e "ativo" ficam como a gerência deixou;
 *   - sem ficha, recusa (não cria);
 *   - empresa de que não é membro, recusa;
 *   - a escrita direta na tabela continua barrada para o profissional (RLS);
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

const ORG = "c8004000-0000-4000-8000-00000000000a";
const ORG_B = "c8004000-0000-4000-8000-00000000000b";
const PROF = "c8004000-1111-4000-8000-0000000000a1";
const COLEGA = "c8004000-1111-4000-8000-0000000000a2";
const SEM_FICHA = "c8004000-1111-4000-8000-0000000000a3";
const MEMBRO_B = "c8004000-1111-4000-8000-0000000000b1";
const ESP = "c8004000-2222-4000-8000-000000000001";

const fichaDe = (org: string, user: string) =>
  ultima(
    sql(`select concat_ws('|', coalesce(council, '-'), coalesce(council_number, '-'), coalesce(council_uf, '-'), is_active::text)
           from public.clinic_professionals where organization_id = '${org}' and user_id = '${user}';`),
  );

const salvar = (user: string, org: string, conselho: string, numero: string, uf: string) =>
  como(user, `select public.fn_clinic_salvar_meu_registro('${org}', '${conselho}', '${numero}', '${uf}');`);

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${PROF}', 'reg-prof@invariant.test'), ('${COLEGA}', 'reg-colega@invariant.test'),
      ('${SEM_FICHA}', 'reg-sem@invariant.test'), ('${MEMBRO_B}', 'reg-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name) values
      ('${ORG}', 'reg-inv-a', 'Registro Invariant A', 'Reg A'),
      ('${ORG_B}', 'reg-inv-b', 'Registro Invariant B', 'Reg B')
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${PROF}', '${ORG}', 'agent', now()), ('${COLEGA}', '${ORG}', 'agent', now()),
      ('${SEM_FICHA}', '${ORG}', 'agent', now()), ('${MEMBRO_B}', '${ORG_B}', 'manager', now())
      on conflict do nothing;
    insert into public.clinic_professionals (organization_id, user_id, council, council_number, council_uf, is_active) values
      ('${ORG}', '${PROF}', 'CRM', '1000', 'SP', false),
      ('${ORG}', '${COLEGA}', 'CRO', '2000', 'RJ', true),
      ('${ORG_B}', '${MEMBRO_B}', 'CRM', '3000', 'MG', true)
      on conflict do nothing;
    insert into public.clinic_specialties (id, organization_id, name) values ('${ESP}', '${ORG}', 'Estética facial')
      on conflict (id) do nothing;
    insert into public.clinic_professional_specialties (organization_id, professional_id, specialty_id)
    select '${ORG}', p.id, '${ESP}' from public.clinic_professionals p
     where p.organization_id = '${ORG}' and p.user_id = '${PROF}'
    on conflict do nothing;
  `);
});

describe("o profissional grava o próprio registro (8004)", () => {
  it("⭐ altera conselho, número e UF da própria ficha", () => {
    const out = ultima(sql(salvar(PROF, ORG, "CRBM", " 4321 ", "pr")));
    expect(JSON.parse(out)).toHaveProperty("id");
    expect(fichaDe(ORG, PROF)).toBe("CRBM|4321|PR|false");
  });

  it("⭐ a ficha do colega não muda", () => {
    expect(fichaDe(ORG, COLEGA)).toBe("CRO|2000|RJ|true");
  });

  it("especialidades e 'ativo' ficam como a gerência deixou", () => {
    expect(
      ultima(
        sql(`select count(*) from public.clinic_professional_specialties s
               join public.clinic_professionals p on p.id = s.professional_id
              where p.organization_id = '${ORG}' and p.user_id = '${PROF}';`),
      ),
    ).toBe("1");
    expect(fichaDe(ORG, PROF).endsWith("|false")).toBe(true);
  });

  it("valores vazios limpam o registro", () => {
    sql(salvar(PROF, ORG, "", "", ""));
    expect(fichaDe(ORG, PROF)).toBe("-|-|-|false");
  });

  it("sem ficha, recusa e não cria", () => {
    expect(erro(salvar(SEM_FICHA, ORG, "CRM", "1", "SP"))).toMatch(/clinic_ficha_inexistente/);
    expect(fichaDe(ORG, SEM_FICHA)).toBe("");
  });

  it("empresa de que não é membro, recusa", () => {
    expect(erro(salvar(PROF, ORG_B, "CRM", "9", "SP"))).toMatch(/acesso_proibido/);
    expect(fichaDe(ORG_B, MEMBRO_B)).toBe("CRM|3000|MG|true");
  });

  it("valor fora da regra da tabela é recusado pelo banco", () => {
    expect(erro(salvar(PROF, ORG, "XYZ", "1", "SP"))).toMatch(/clinic_professionals_conselho_check/);
  });

  it("escrita direta na tabela continua barrada para o profissional", () => {
    sql(como(PROF, `update public.clinic_professionals set council_number = '999' where organization_id = '${ORG}' and user_id = '${COLEGA}';`));
    expect(fichaDe(ORG, COLEGA)).toBe("CRO|2000|RJ|true");
  });

  it("anon não executa", () => {
    expect(erro(`set role anon; select public.fn_clinic_salvar_meu_registro('${ORG}', 'CRM', '1', 'SP');`)).toMatch(
      /permission denied/,
    );
  });
});
