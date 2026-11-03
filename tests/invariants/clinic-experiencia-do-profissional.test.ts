/**
 * clinic (fork, agenda S5) — migration 9044: experiência do profissional.
 *
 * Prova no Postgres real:
 *   - toda empresa (e a nova) tem o papel "Profissional de saúde", com a lista
 *     fechada do código (`PAPEL_PROFISSIONAL`);
 *   - cadastrar profissional com o modo por papéis ligado dá a ele esse papel e
 *     tira o modelo "Atendente" que era o único;
 *   - prontuário: o profissional lê o PRÓPRIO atendimento e não o do colega; a
 *     coordenação (`prontuario.ver_outros`) lê os dois; outra empresa, nenhum;
 *   - `clinic_agenda_blocks.tipo` só aceita os tipos conhecidos.
 */
import { execFileSync } from "node:child_process";

import { beforeAll, describe, expect, it } from "vitest";

import { PAPEL_PROFISSIONAL } from "@/lib/clinic/acesso/catalogo";

const container = process.env.TEST_DB_CONTAINER;
if (!container) {
  throw new Error("TEST_DB_CONTAINER not set — rode esta suíte via `pnpm test:db` (scripts/test-db.sh)");
}
const containerName: string = container;
const PSQL = ["exec", "-i", containerName, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-f", "-"];

function sql(script: string): string {
  return execFileSync("docker", PSQL, { input: script, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
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
const json = <T,>(out: string) => JSON.parse(ultima(out)) as T;
const lista = (out: string) =>
  out
    .split("\n")
    .filter((l) => l && l !== "SET" && !l.startsWith("{"))
    .sort();

const ORG = "c9440000-0000-4000-8000-00000000000a";
const ORG_B = "c9440000-0000-4000-8000-00000000000b";
const ORG_NOVA = "c9440000-0000-4000-8000-00000000000c";
const PROF = "c9440000-1111-4000-8000-0000000000a1";
const COLEGA = "c9440000-1111-4000-8000-0000000000a2";
const COORD = "c9440000-1111-4000-8000-0000000000a3";
const MEMBRO_B = "c9440000-1111-4000-8000-0000000000b1";
const PAC1 = "c9440000-2222-4000-8000-000000000001";
const PAC2 = "c9440000-2222-4000-8000-000000000002";
const AG1 = "c9440000-3333-4000-8000-000000000001";
const AG2 = "c9440000-3333-4000-8000-000000000002";

let at1 = "";
let at2 = "";

const papeisDe = (user: string) =>
  lista(
    sql(`select r.system_key from public.clinic_member_roles mr join public.clinic_roles r on r.id = mr.role_id
          where mr.organization_id = '${ORG}' and mr.user_id = '${user}';`),
  );

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${PROF}', 'exp-prof@invariant.test'), ('${COLEGA}', 'exp-colega@invariant.test'),
      ('${COORD}', 'exp-coord@invariant.test'), ('${MEMBRO_B}', 'exp-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'exp-inv-a', 'Experiencia Invariant A', 'Exp A', '{"clinic":{"prontuario":true,"acesso_por_permissoes":true}}'::jsonb),
      ('${ORG_B}', 'exp-inv-b', 'Experiencia Invariant B', 'Exp B', '{"clinic":{"prontuario":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${PROF}', '${ORG}', 'agent', now()), ('${COLEGA}', '${ORG}', 'agent', now()),
      ('${COORD}', '${ORG}', 'manager', now()), ('${MEMBRO_B}', '${ORG_B}', 'manager', now())
      on conflict do nothing;
    insert into public.clinic_professionals (organization_id, user_id, display_name) values
      ('${ORG}', '${PROF}', 'Profissional Exp'), ('${ORG}', '${COLEGA}', 'Colega Exp')
      on conflict do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PAC1}', '${ORG}', 'Paciente Exp Um', '+5511990004401'), ('${PAC2}', '${ORG}', 'Paciente Exp Dois', '+5511990004402')
      on conflict (id) do nothing;
    insert into public.calendar_appointments (id, organization_id, title, starts_at, ends_at, owner_user_id, contact_id, status) values
      ('${AG1}', '${ORG}', 'Consulta', now() - interval '1 hour', now(), '${PROF}', '${PAC1}', 'confirmed'),
      ('${AG2}', '${ORG}', 'Consulta', now() - interval '1 hour', now(), '${COLEGA}', '${PAC2}', 'confirmed')
      on conflict (id) do nothing;
  `);
  // a coordenação: o papel de sistema "gerente" mais as chaves clínicas de ver os outros
  sql(`
    insert into public.clinic_role_permissions (organization_id, role_id, permission_key)
    select '${ORG}', r.id, k from public.clinic_roles r
     cross join (values ('prontuario.ver'), ('prontuario.ver_outros')) as x(k)
     where r.organization_id = '${ORG}' and r.system_key = 'gerente'
    on conflict do nothing;
  `);
  at1 = json<{ id: string }>(sql(como(PROF, `select public.fn_clinic_iniciar_atendimento('${ORG}', '${AG1}');`))).id;
  at2 = json<{ id: string }>(sql(como(COLEGA, `select public.fn_clinic_iniciar_atendimento('${ORG}', '${AG2}');`))).id;
});

describe("o papel Profissional de saúde", () => {
  it.each([ORG, ORG_B])("existe na empresa %s, sem ser de sistema", (org) => {
    expect(ultima(sql(`select is_system from public.clinic_roles where organization_id = '${org}' and system_key = 'profissional';`))).toBe("f");
  });

  it("empresa nova já nasce com ele", () => {
    sql(`insert into public.organizations (id, slug, legal_name, display_name) values
           ('${ORG_NOVA}', 'exp-inv-c', 'Experiencia Invariant C', 'Exp C') on conflict (id) do nothing;`);
    expect(ultima(sql(`select count(*) from public.clinic_roles where organization_id = '${ORG_NOVA}' and system_key = 'profissional';`))).toBe("1");
  });

  it("as chaves são exatamente as do código", () => {
    const banco = lista(
      sql(`select rp.permission_key from public.clinic_role_permissions rp join public.clinic_roles r on r.id = rp.role_id
            where r.organization_id = '${ORG}' and r.system_key = 'profissional';`),
    );
    expect(banco).toEqual([...PAPEL_PROFISSIONAL.chaves].sort());
  });

  it("cadastrar profissional com o modo ligado troca o Atendente pelo Profissional", () => {
    expect(papeisDe(PROF)).toEqual(["profissional"]);
    const efetivas = lista(sql(como(PROF, `select * from public.fn_member_permissions('${ORG}');`)));
    expect(efetivas).toContain("atendimento.iniciar");
    expect(efetivas).not.toContain("agenda.ver_outros");
    expect(efetivas).not.toContain("prontuario.ver_outros");
    expect(efetivas).not.toContain("pacientes.ver_todos");
  });

  it("papel dado pelo admin fica: o gerente que vira profissional segue gerente", () => {
    sql(`insert into public.clinic_professionals (organization_id, user_id, display_name) values
           ('${ORG}', '${COORD}', 'Coordenação Exp') on conflict do nothing;`);
    expect(papeisDe(COORD)).toEqual(["gerente", "profissional"]);
  });
});

describe("prontuário: só o próprio, com exceção por permissão", () => {
  const conta = (user: string, tabela: string, cond: string) =>
    ultima(sql(como(user, `select count(*) from public.${tabela} where ${cond};`)));

  it("o profissional lê o próprio atendimento e não o do colega", () => {
    expect(conta(PROF, "clinic_atendimentos", `id = '${at1}'`)).toBe("1");
    expect(conta(PROF, "clinic_atendimentos", `id = '${at2}'`)).toBe("0");
  });

  it("os eventos do atendimento do colega também ficam de fora", () => {
    expect(conta(PROF, "clinic_atendimento_eventos", `atendimento_id = '${at2}'`)).toBe("0");
    expect(Number(conta(COLEGA, "clinic_atendimento_eventos", `atendimento_id = '${at2}'`))).toBeGreaterThan(0);
  });

  it("a coordenação (prontuario.ver_outros) lê os dois", () => {
    expect(conta(COORD, "clinic_atendimentos", `id in ('${at1}', '${at2}')`)).toBe("2");
  });

  it("outra empresa não lê nenhum", () => {
    expect(conta(MEMBRO_B, "clinic_atendimentos", `organization_id = '${ORG}'`)).toBe("0");
  });

  it("o colega não registra no atendimento que não é dele", () => {
    expect(erro(como(COLEGA, `select public.fn_clinic_salvar_evolucao('${ORG}', '${at1}', 'Tentativa.', null, null, null, null, 0);`))).not.toBeNull();
  });
});

describe("bloqueio com tipo", () => {
  it("aceita os tipos conhecidos e recusa o resto", () => {
    sql(como(PROF, `insert into public.clinic_agenda_blocks (organization_id, user_id, starts_on, ends_on, start_minute, end_minute, tipo, created_by)
                    values ('${ORG}', '${PROF}', current_date, current_date, 720, 780, 'almoco', '${PROF}');`));
    expect(
      erro(como(PROF, `insert into public.clinic_agenda_blocks (organization_id, user_id, starts_on, ends_on, start_minute, end_minute, tipo, created_by)
                       values ('${ORG}', '${PROF}', current_date, current_date, 800, 830, 'ferias_eternas', '${PROF}');`)),
    ).toMatch(/check/);
  });
});
