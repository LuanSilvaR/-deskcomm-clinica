/**
 * clinic (fork) — isolamento e papéis das tabelas de profissionais,
 * especialidades e bloqueios (migration 9001).
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. nenhuma tabela clinic_* vaza entre duas organizações;
 *   2. toda tabela clinic_* tem RLS ligada (vale para tabela futura também);
 *   3. atendente (agent) não cadastra especialidade nem profissional;
 *   4. atendente bloqueia a PRÓPRIA agenda, mas não a de colega nem a da clínica toda;
 *   5. gerente bloqueia a clínica toda;
 *   6. só admin mexe na flag — gerente recebe 42501.
 */
import { execFileSync } from "node:child_process";

import { beforeAll, describe, expect, it } from "vitest";

const container = process.env.TEST_DB_CONTAINER;
if (!container) {
  throw new Error(
    "TEST_DB_CONTAINER not set — rode esta suíte via `pnpm test:db` (scripts/test-db.sh)",
  );
}
const containerName: string = container;

function sql(script: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", containerName, "psql", "-U", "postgres", "-d", "postgres",
      "-v", "ON_ERROR_STOP=1", "-tA", "-f", "-"],
    { input: script, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
}

function comoUsuario(userId: string, corpo: string): string {
  return `
    set role authenticated;
    select set_config('request.jwt.claims', '{"sub":"${userId}"}', false);
    ${corpo}
  `;
}

function contaComo(userId: string, consulta: string): number {
  const out = sql(comoUsuario(userId, consulta));
  const ultima = out.split("\n").at(-1);
  if (ultima === undefined || !/^\d+$/.test(ultima)) throw new Error(`saída inesperada do psql: ${out}`);
  return Number(ultima);
}

/** Roda como o usuário; devolve a mensagem de erro, ou null se passou. */
function erroComo(userId: string, comando: string): string | null {
  try {
    sql(comoUsuario(userId, comando));
    return null;
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
}

const ORG_A = "c11a1c00-0000-4000-8000-00000000000a";
const ORG_B = "c11a1c00-0000-4000-8000-00000000000b";
const AGENT_A = "c11a1c00-1111-4000-8000-00000000000a";
const AGENT_A2 = "c11a1c00-1111-4000-8000-0000000000a2";
const MANAGER_A = "c11a1c00-1111-4000-8000-00000000000d";
const AGENT_B = "c11a1c00-1111-4000-8000-00000000000b";

const TABELAS_CLINIC = [
  "clinic_specialties",
  "clinic_professionals",
  "clinic_professional_specialties",
  "clinic_event_type_specialties",
  "clinic_agenda_blocks",
] as const;

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${AGENT_A}',   'clinic-agent-a@invariant.test'),
      ('${AGENT_A2}',  'clinic-agent-a2@invariant.test'),
      ('${MANAGER_A}', 'clinic-mgr-a@invariant.test'),
      ('${AGENT_B}',   'clinic-agent-b@invariant.test')
      on conflict (id) do nothing;

    insert into public.organizations (id, slug, legal_name, display_name) values
      ('${ORG_A}', 'clinic-inv-a', 'Clinic Invariant A', 'Clinic A'),
      ('${ORG_B}', 'clinic-inv-b', 'Clinic Invariant B', 'Clinic B')
      on conflict (id) do nothing;

    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${AGENT_A}',   '${ORG_A}', 'agent',   now()),
      ('${AGENT_A2}',  '${ORG_A}', 'agent',   now()),
      ('${MANAGER_A}', '${ORG_A}', 'manager', now()),
      ('${AGENT_B}',   '${ORG_B}', 'agent',   now())
      on conflict do nothing;

    insert into public.calendar_event_types (organization_id, name, slug, category, duration_minutes)
    select v.org, 'Procedimento do invariante', 'proc-clinic-inv', 'procedimento', 60
      from (values ('${ORG_A}'::uuid), ('${ORG_B}'::uuid)) as v(org)
     where not exists (select 1 from public.calendar_event_types t
                        where t.organization_id = v.org and t.slug = 'proc-clinic-inv');

    insert into public.clinic_specialties (organization_id, name)
    select v.org, 'Harmonização'
      from (values ('${ORG_A}'::uuid), ('${ORG_B}'::uuid)) as v(org)
     where not exists (select 1 from public.clinic_specialties s where s.organization_id = v.org);

    insert into public.clinic_professionals (organization_id, user_id, council, council_number, council_uf)
    values ('${ORG_A}', '${AGENT_A}', 'CRBM', '12345', 'SP'),
           ('${ORG_B}', '${AGENT_B}', 'CRM', '54321', 'RJ')
    on conflict (organization_id, user_id) do nothing;

    insert into public.clinic_professional_specialties (organization_id, professional_id, specialty_id)
    select p.organization_id, p.id, s.id
      from public.clinic_professionals p
      join public.clinic_specialties s on s.organization_id = p.organization_id
     where p.organization_id in ('${ORG_A}', '${ORG_B}')
    on conflict do nothing;

    insert into public.clinic_event_type_specialties (organization_id, event_type_id, specialty_id)
    select t.organization_id, t.id, s.id
      from public.calendar_event_types t
      join public.clinic_specialties s on s.organization_id = t.organization_id
     where t.organization_id in ('${ORG_A}', '${ORG_B}') and t.slug = 'proc-clinic-inv'
    on conflict do nothing;

    insert into public.clinic_agenda_blocks (organization_id, user_id, starts_on, ends_on, reason)
    select v.org, v.dono, current_date + 10, current_date + 12, 'férias do invariante'
      from (values ('${ORG_A}'::uuid, '${AGENT_A}'::uuid), ('${ORG_B}'::uuid, '${AGENT_B}'::uuid)) as v(org, dono)
     where not exists (select 1 from public.clinic_agenda_blocks b
                        where b.organization_id = v.org and b.reason = 'férias do invariante');
  `);
});

describe("clinic — isolamento entre organizações", () => {
  it.each(TABELAS_CLINIC)("%s: quem é da org A não enxerga linha da org B", (tabela) => {
    const daB = contaComo(
      AGENT_A,
      `select count(*) from public.${tabela} where organization_id = '${ORG_B}';`,
    );
    expect(daB).toBe(0);
    const daA = contaComo(
      AGENT_A,
      `select count(*) from public.${tabela} where organization_id = '${ORG_A}';`,
    );
    expect(daA).toBeGreaterThan(0);
  });

  it("toda tabela clinic_* tem RLS ligada (inclusive as que vierem depois)", () => {
    const semRls = sql(`
      select coalesce(string_agg(c.relname, ','), '')
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'clinic\\_%'
         and not c.relrowsecurity;
    `);
    expect(semRls).toBe("");
    const total = Number(sql(`
      select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'clinic\\_%';
    `));
    expect(total).toBeGreaterThanOrEqual(TABELAS_CLINIC.length);
  });
});

describe("clinic — papéis", () => {
  it("atendente não cadastra especialidade", () => {
    const erro = erroComo(
      AGENT_A,
      `insert into public.clinic_specialties (organization_id, name) values ('${ORG_A}', 'Laser');`,
    );
    expect(erro).toMatch(/row-level security/);
  });

  it("atendente não cadastra profissional", () => {
    const erro = erroComo(
      AGENT_A,
      `insert into public.clinic_professionals (organization_id, user_id) values ('${ORG_A}', '${AGENT_A2}');`,
    );
    expect(erro).toMatch(/row-level security/);
  });

  it("atendente bloqueia a PRÓPRIA agenda", () => {
    const erro = erroComo(
      AGENT_A,
      `insert into public.clinic_agenda_blocks (organization_id, user_id, starts_on, ends_on, weekdays, start_minute, end_minute)
       values ('${ORG_A}', '${AGENT_A}', current_date, current_date + 90, array[5]::smallint[], 840, 960);`,
    );
    expect(erro).toBeNull();
  });

  it("atendente NÃO bloqueia a agenda de colega", () => {
    const erro = erroComo(
      AGENT_A,
      `insert into public.clinic_agenda_blocks (organization_id, user_id, starts_on, ends_on)
       values ('${ORG_A}', '${AGENT_A2}', current_date, current_date);`,
    );
    expect(erro).toMatch(/row-level security/);
  });

  it("atendente NÃO bloqueia a clínica toda", () => {
    const erro = erroComo(
      AGENT_A,
      `insert into public.clinic_agenda_blocks (organization_id, user_id, starts_on, ends_on)
       values ('${ORG_A}', null, current_date, current_date);`,
    );
    expect(erro).toMatch(/row-level security/);
  });

  it("gerente bloqueia a clínica toda", () => {
    const erro = erroComo(
      MANAGER_A,
      `insert into public.clinic_agenda_blocks (organization_id, user_id, starts_on, ends_on, reason)
       values ('${ORG_A}', null, current_date + 30, current_date + 30, 'feriado municipal');`,
    );
    expect(erro).toBeNull();
  });

  it("recorrência com dia inválido é recusada pelo CHECK", () => {
    const erro = erroComo(
      MANAGER_A,
      `insert into public.clinic_agenda_blocks (organization_id, user_id, starts_on, ends_on, weekdays)
       values ('${ORG_A}', null, current_date, current_date + 7, array[7]::smallint[]);`,
    );
    expect(erro).toMatch(/clinic_agenda_blocks_dias_validos/);
  });

  it("só admin mexe na flag: gerente recebe 42501", () => {
    const erro = erroComo(MANAGER_A, `select public.fn_clinic_definir_flag('${ORG_A}', true);`);
    expect(erro).toMatch(/clinic_flag_forbidden/);
  });

  it("anon não executa a função da flag", () => {
    const pode = sql(`select has_function_privilege('anon', 'public.fn_clinic_definir_flag(uuid, boolean)', 'execute');`);
    expect(pode).toBe("f");
  });
});
