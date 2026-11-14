/**
 * clinic (fork) — migration 9007: salas e equipamentos.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. opção DESLIGADA: nada é alocado nem recusado;
 *   2. ligada: o compromisso aloca uma sala livre da categoria; com as salas
 *      ocupadas, o terceiro no mesmo horário é recusado (23P01 recurso_indisponivel);
 *   3. equipamento específico: o segundo procedimento com laser no mesmo horário
 *      é recusado; o tipo que exige laser + sala aloca os dois;
 *   4. cancelar libera; remarcar realoca; confirmar não realoca;
 *   5. o espelho do Google não aloca;
 *   6. A CORRIDA: duas sessões disputando a última sala — só uma grava;
 *   7. RLS: isolamento entre organizações; configuração a partir de gerente;
 *      ninguém escreve alocação à mão; a opção é só de admin.
 */
import { execFileSync, spawn } from "node:child_process";

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

function sqlAsync(script: string): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const p = spawn("docker", PSQL);
    let stderr = "";
    p.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    p.on("close", (code) => resolve({ code: code ?? 1, stderr }));
    p.stdin.end(script);
  });
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

const ORG_A = "5a1a0000-0000-4000-8000-00000000000a";
const ORG_B = "5a1a0000-0000-4000-8000-00000000000b";
const ADMIN_A = "5a1a0000-1111-4000-8000-0000000000a1";
const MANAGER_A = "5a1a0000-1111-4000-8000-0000000000a3";
const P1 = "5a1a0000-1111-4000-8000-0000000000b1";
const P2 = "5a1a0000-1111-4000-8000-0000000000b2";
const P3 = "5a1a0000-1111-4000-8000-0000000000b3";
const P4 = "5a1a0000-1111-4000-8000-0000000000b4";
const PB = "5a1a0000-1111-4000-8000-0000000000c1";
const SALA_1 = "5a1a0000-2222-4000-8000-000000000001";
const SALA_2 = "5a1a0000-2222-4000-8000-000000000002";
const LASER = "5a1a0000-2222-4000-8000-000000000003";
const T_SALA = "5a1a0000-4444-4000-8000-000000000001";
const T_LASER = "5a1a0000-4444-4000-8000-000000000002";
const T_B = "5a1a0000-4444-4000-8000-00000000000b";

let seq = 0;
function marcar(org: string, tipo: string, dono: string, de: string, ate: string, extra: { id?: string; source?: string } = {}) {
  seq += 1;
  const id = extra.id ?? `5a1a0000-3333-4000-8000-${String(seq).padStart(12, "0")}`;
  return {
    id,
    sql: `insert into public.calendar_appointments (id, organization_id, event_type_id, title, starts_at, ends_at, owner_user_id, status, source)
          values ('${id}', '${org}', '${tipo}', 'Procedimento', '2030-02-12 ${de}+00', '2030-02-12 ${ate}+00', '${dono}', 'confirmed', '${extra.source ?? "ui"}');`,
  };
}

const recursosDe = (ag: string) =>
  ultima(
    sql(`select coalesce(string_agg(r.name, ',' order by r.name), '-')
           from public.clinic_appointment_resources a join public.clinic_resources r on r.id = a.resource_id
          where a.appointment_id = '${ag}';`),
  );

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADMIN_A}', 'recursos-admin-a@invariant.test'), ('${MANAGER_A}', 'recursos-manager-a@invariant.test'),
      ('${P1}', 'recursos-p1@invariant.test'), ('${P2}', 'recursos-p2@invariant.test'),
      ('${P3}', 'recursos-p3@invariant.test'), ('${P4}', 'recursos-p4@invariant.test'),
      ('${PB}', 'recursos-pb@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG_A}', 'recursos-inv-a', 'Recursos Invariant A', 'Recursos A', '{"clinic":{"recursos":true,"profissionais":true}}'::jsonb),
      ('${ORG_B}', 'recursos-inv-b', 'Recursos Invariant B', 'Recursos B', '{}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADMIN_A}', '${ORG_A}', 'admin', now()), ('${MANAGER_A}', '${ORG_A}', 'manager', now()),
      ('${P1}', '${ORG_A}', 'agent', now()), ('${P2}', '${ORG_A}', 'agent', now()),
      ('${P3}', '${ORG_A}', 'agent', now()), ('${P4}', '${ORG_A}', 'agent', now()),
      ('${PB}', '${ORG_B}', 'agent', now())
      on conflict do nothing;
    insert into public.calendar_event_types (id, organization_id, name, slug) values
      ('${T_SALA}', '${ORG_A}', 'Limpeza de pele', 'limpeza-recursos-inv'),
      ('${T_LASER}', '${ORG_A}', 'Depilação a laser', 'laser-recursos-inv'),
      ('${T_B}', '${ORG_B}', 'Consulta B', 'consulta-recursos-inv')
      on conflict (id) do nothing;
    insert into public.clinic_resources (id, organization_id, name, category) values
      ('${SALA_1}', '${ORG_A}', 'Sala 1', 'Sala'), ('${SALA_2}', '${ORG_A}', 'Sala 2', 'Sala'),
      ('${LASER}', '${ORG_A}', 'Laser Alexandrite', 'Equipamento')
      on conflict (id) do nothing;
    insert into public.clinic_event_type_resources (organization_id, event_type_id, category, resource_id) values
      ('${ORG_A}', '${T_SALA}', 'sala', null),
      ('${ORG_A}', '${T_LASER}', null, '${LASER}'),
      ('${ORG_A}', '${T_LASER}', 'Sala', null);
  `);
});

describe("opção desligada", () => {
  it("a organização B marca sem alocar nada", () => {
    const a = marcar(ORG_B, T_B, PB, "10:00", "10:30");
    expect(erro(a.sql)).toBeNull();
    expect(recursosDe(a.id)).toBe("-");
  });
});

describe("salas", () => {
  const a1 = marcar(ORG_A, T_SALA, P1, "10:00", "10:30");
  const a2 = marcar(ORG_A, T_SALA, P2, "10:00", "10:30");

  it("aloca uma sala livre da categoria (sem diferenciar maiúsculas)", () => {
    sql(a1.sql);
    expect(recursosDe(a1.id)).toBe("Sala 1");
    sql(a2.sql);
    expect(recursosDe(a2.id)).toBe("Sala 2");
  });

  it("com as duas salas ocupadas, o terceiro no mesmo horário é recusado com 23P01", () => {
    const a3 = marcar(ORG_A, T_SALA, P3, "10:15", "10:45");
    expect(erro(a3.sql)).toMatch(/recurso_indisponivel/);
    const out = sql(`do $$ begin ${marcar(ORG_A, T_SALA, P3, "10:10", "10:40").sql} exception when sqlstate '23P01' then null; end $$; select 'ok';`);
    expect(ultima(out)).toBe("ok");
  });

  it("encostar não é ocupar", () => {
    const a = marcar(ORG_A, T_SALA, P3, "10:30", "11:00");
    expect(erro(a.sql)).toBeNull();
    expect(recursosDe(a.id)).toBe("Sala 1");
  });

  it("confirmar de novo não realoca; cancelar libera a sala", () => {
    sql(`update public.calendar_appointments set status = 'pending' where id = '${a1.id}';`);
    expect(recursosDe(a1.id)).toBe("Sala 1");
    sql(`update public.calendar_appointments set status = 'cancelled', cancelled_at = now() where id = '${a1.id}';`);
    expect(recursosDe(a1.id)).toBe("-");
    const a = marcar(ORG_A, T_SALA, P3, "10:00", "10:20");
    expect(erro(a.sql)).toBeNull();
    expect(recursosDe(a.id)).toBe("Sala 1");
  });

  it("remarcar realoca no horário novo", () => {
    sql(`update public.calendar_appointments set starts_at = '2030-02-12 15:00+00', ends_at = '2030-02-12 15:30+00' where id = '${a2.id}';`);
    expect(ultima(sql(`select to_char(starts_at at time zone 'UTC', 'HH24:MI') from public.clinic_appointment_resources where appointment_id = '${a2.id}';`))).toBe("15:00");
  });

  it("o espelho do Google não aloca", () => {
    const a = marcar(ORG_A, T_SALA, P4, "10:00", "10:30", { source: "google_sync" });
    expect(erro(a.sql)).toBeNull();
    expect(recursosDe(a.id)).toBe("-");
  });
});

describe("equipamento específico", () => {
  it("laser + sala: aloca os dois; o segundo laser no mesmo horário é recusado", () => {
    const l1 = marcar(ORG_A, T_LASER, P1, "13:00", "13:30");
    sql(l1.sql);
    expect(recursosDe(l1.id)).toBe("Laser Alexandrite,Sala 1");
    expect(erro(marcar(ORG_A, T_LASER, P2, "13:15", "13:45").sql)).toMatch(/recurso_indisponivel/);
    // a outra sala segue livre para quem não precisa do laser
    const s = marcar(ORG_A, T_SALA, P2, "13:15", "13:45");
    expect(erro(s.sql)).toBeNull();
    expect(recursosDe(s.id)).toBe("Sala 2");
  });
});

describe("a corrida", () => {
  it("duas sessões disputando a última sala livre: só uma grava", async () => {
    // 17:00: Sala 1 ocupada; resta a Sala 2 para duas marcações simultâneas.
    sql(marcar(ORG_A, T_SALA, P1, "17:00", "17:30").sql);
    const sessao = (dono: string, n: number) =>
      `begin; ${marcar(ORG_A, T_SALA, dono, "17:00", "17:30", { id: `5a1a0000-3333-4000-8000-00000000e00${n}` }).sql} select pg_sleep(1.5); commit;`;
    const [a, b] = await Promise.all([sqlAsync(sessao(P2, 1)), sqlAsync(sessao(P3, 2))]);
    expect([a.code, b.code].sort()).toEqual([0, 3]);
    expect(a.stderr + b.stderr).toMatch(/recurso_indisponivel/);
    expect(
      ultima(
        sql(`select count(*) from public.clinic_appointment_resources where organization_id = '${ORG_A}'
               and starts_at = '2030-02-12 17:00+00' and resource_id = '${SALA_2}';`),
      ),
    ).toBe("1");
  });
});

describe("RLS e opção", () => {
  it("quem é da org B não enxerga recursos nem alocações da A", () => {
    expect(ultima(sql(como(PB, `select count(*) from public.clinic_resources where organization_id = '${ORG_A}';`)))).toBe("0");
    expect(ultima(sql(como(PB, `select count(*) from public.clinic_appointment_resources where organization_id = '${ORG_A}';`)))).toBe("0");
  });

  it("atendente não cadastra recurso; gerente cadastra", () => {
    expect(erro(como(P1, `insert into public.clinic_resources (organization_id, name, category) values ('${ORG_A}', 'Sala X', 'Sala');`))).toMatch(
      /row-level security/,
    );
    expect(erro(como(MANAGER_A, `insert into public.clinic_resources (organization_id, name, category) values ('${ORG_A}', 'Sala 3', 'Sala');`))).toBeNull();
  });

  it("ninguém escreve alocação à mão (nem gerente)", () => {
    expect(
      erro(
        como(
          MANAGER_A,
          `insert into public.clinic_appointment_resources (organization_id, appointment_id, resource_id, starts_at, ends_at)
           select '${ORG_A}', id, '${SALA_1}', starts_at, ends_at from public.calendar_appointments where organization_id = '${ORG_A}' limit 1;`,
        ),
      ),
    ).toMatch(/permission denied|row-level security/);
  });

  it("exigência precisa de categoria OU recurso, não dos dois", () => {
    expect(
      erro(`insert into public.clinic_event_type_resources (organization_id, event_type_id, category, resource_id)
            values ('${ORG_A}', '${T_SALA}', 'Sala', '${SALA_1}');`),
    ).toMatch(/clinic_event_type_resources_um_dos_dois/);
  });

  it("gerente não liga a opção: 42501; admin liga e preserva as outras chaves", () => {
    expect(erro(como(MANAGER_A, `select public.fn_clinic_definir_recursos('${ORG_A}', false);`))).toMatch(/clinic_flag_forbidden/);
    sql(como(ADMIN_A, `select public.fn_clinic_definir_recursos('${ORG_A}', false);`));
    expect(ultima(sql(como(ADMIN_A, `select public.fn_clinic_definir_recursos('${ORG_A}', true);`)))).toContain('"mudou": true');
    expect(
      ultima(sql(`select settings->'clinic'->>'recursos', settings->'clinic'->>'profissionais' from public.organizations where id = '${ORG_A}';`)),
    ).toBe("true|true");
  });

  it.each([
    ["anon", "public.fn_clinic_definir_recursos(uuid, boolean)"],
    ["anon", "public.fn_clinic_alocar_recursos()"],
    ["authenticated", "public.fn_clinic_alocar_recursos()"],
  ])("%s não executa %s", (papel, fn) => {
    expect(ultima(sql(`select has_function_privilege('${papel}', '${fn}', 'execute');`))).toBe("f");
  });
});
