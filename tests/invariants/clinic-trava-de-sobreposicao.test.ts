/**
 * clinic (fork) — migration 9005: trava de sobreposição na agenda.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. com a opção DESLIGADA nada muda (a organização B sobrepõe à vontade);
 *   2. ligada: cruzar outro compromisso que ocupa é 23P01; encostar não é;
 *      outro profissional, compromisso cancelado e espelho do Google passam;
 *   3. reativar um cancelado em cima de outro é recusado;
 *   4. sobreposição ANTIGA não trava a operação de hoje (pending → confirmed),
 *      mas mover o horário para dentro dela, sim;
 *   5. A CORRIDA: duas sessões gravando horários que se cruzam ao mesmo tempo — só uma passa;
 *   6. a opção é só de admin, e anon/authenticated não executam o trigger.
 */
import { execFileSync, spawn } from "node:child_process";

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

/** Mesmo `sql`, assíncrono — para duas sessões rodarem AO MESMO TEMPO. */
function sqlAsync(script: string): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const p = spawn("docker", ["exec", "-i", containerName, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-f", "-"]);
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

const ORG_A = "7a7a0000-0000-4000-8000-00000000000a";
const ORG_B = "7a7a0000-0000-4000-8000-00000000000b";
const ADMIN_A = "7a7a0000-1111-4000-8000-0000000000a1";
const MANAGER_A = "7a7a0000-1111-4000-8000-0000000000a3";
const PROF_A1 = "7a7a0000-1111-4000-8000-0000000000b1";
const PROF_A2 = "7a7a0000-1111-4000-8000-0000000000b2";
const PROF_B = "7a7a0000-1111-4000-8000-0000000000c1";

let seq = 0;
/** INSERT de um compromisso; devolve o SQL. Horários no dia fixo 2030-01-10 (UTC). */
function marcar(org: string, dono: string, de: string, ate: string, extra: { status?: string; source?: string; id?: string } = {}) {
  seq += 1;
  const id = extra.id ?? `7a7a0000-3333-4000-8000-${String(seq).padStart(12, "0")}`;
  const status = extra.status ?? "confirmed";
  const canceladoEm = status === "cancelled" ? "now()" : "null";
  return `insert into public.calendar_appointments (id, organization_id, title, starts_at, ends_at, owner_user_id, status, source, cancelled_at)
          values ('${id}', '${org}', 'Consulta ${seq}', '2030-01-10 ${de}+00', '2030-01-10 ${ate}+00', '${dono}',
                  '${status}', '${extra.source ?? "ui"}', ${canceladoEm});`;
}

const ligar = (org: string, v: boolean) =>
  `update public.organizations set settings = jsonb_set(coalesce(settings,'{}'::jsonb), '{clinic}',
     coalesce(settings->'clinic','{}'::jsonb) || jsonb_build_object('trava_sobreposicao', ${v}), true) where id = '${org}';`;

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADMIN_A}', 'trava-admin-a@invariant.test'),
      ('${MANAGER_A}', 'trava-manager-a@invariant.test'),
      ('${PROF_A1}', 'trava-prof-a1@invariant.test'),
      ('${PROF_A2}', 'trava-prof-a2@invariant.test'),
      ('${PROF_B}', 'trava-prof-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG_A}', 'trava-inv-a', 'Trava Invariant A', 'Trava A', '{"clinic":{"profissionais":true}}'::jsonb),
      ('${ORG_B}', 'trava-inv-b', 'Trava Invariant B', 'Trava B', '{}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADMIN_A}', '${ORG_A}', 'admin', now()),
      ('${MANAGER_A}', '${ORG_A}', 'manager', now()),
      ('${PROF_A1}', '${ORG_A}', 'agent', now()),
      ('${PROF_A2}', '${ORG_A}', 'agent', now()),
      ('${PROF_B}', '${ORG_B}', 'agent', now())
      on conflict do nothing;
  `);
});

describe("opção desligada: nada muda", () => {
  it("a organização B sobrepõe dois compromissos do mesmo profissional", () => {
    expect(erro(marcar(ORG_B, PROF_B, "10:00", "10:30") + marcar(ORG_B, PROF_B, "10:15", "10:45"))).toBeNull();
  });
});

describe("opção ligada", () => {
  beforeAll(() => {
    sql(ligar(ORG_A, true));
    sql(marcar(ORG_A, PROF_A1, "10:00", "10:30"));
  });

  it("cruzar outro compromisso que ocupa é 23P01 agenda_horario_indisponivel", () => {
    const e = erro(marcar(ORG_A, PROF_A1, "10:15", "10:45"));
    expect(e).toMatch(/agenda_horario_indisponivel/);
  });

  it("o SQLSTATE é 23P01 (o handler traduz para o 422 de sempre)", () => {
    const out = sql(`do $$ begin ${marcar(ORG_A, PROF_A1, "10:20", "10:40")} exception when sqlstate '23P01' then raise notice 'pegou-23P01'; end $$;
                     select 'ok';`);
    expect(ultima(out)).toBe("ok");
  });

  it("encostar não é ocupar", () => {
    expect(erro(marcar(ORG_A, PROF_A1, "10:30", "11:00"))).toBeNull();
  });

  it("outro profissional no mesmo horário passa", () => {
    expect(erro(marcar(ORG_A, PROF_A2, "10:00", "10:30"))).toBeNull();
  });

  it("compromisso cancelado não ocupa nem é conferido", () => {
    expect(erro(marcar(ORG_A, PROF_A1, "10:00", "10:30", { status: "cancelled", id: "7a7a0000-3333-4000-8000-0000000000cc" }))).toBeNull();
  });

  it("reativar o cancelado em cima de outro é recusado", () => {
    expect(
      erro(`update public.calendar_appointments set status = 'confirmed' where id = '7a7a0000-3333-4000-8000-0000000000cc';`),
    ).toMatch(/agenda_horario_indisponivel/);
  });

  it("o espelho do Google passa (ele reflete o que já existe lá fora)", () => {
    expect(erro(marcar(ORG_A, PROF_A1, "10:05", "10:25", { source: "google_sync" }))).toBeNull();
  });

  it("a trava vale para a gravação da sessão do usuário (RLS não esconde a ocupação)", () => {
    const e = erro(
      como(
        PROF_A2,
        marcar(ORG_A, PROF_A1, "10:07", "10:20"),
      ),
    );
    // Recusado pela trava ou pela RLS de escrita — nunca gravado.
    expect(e).not.toBeNull();
    expect(
      ultima(sql(`select count(*) from public.calendar_appointments where organization_id = '${ORG_A}' and starts_at = '2030-01-10 10:07+00';`)),
    ).toBe("0");
  });
});

describe("sobreposição antiga", () => {
  const X = "7a7a0000-3333-4000-8000-0000000000d1";
  const Y = "7a7a0000-3333-4000-8000-0000000000d2";
  beforeAll(() => {
    sql(ligar(ORG_A, false));
    sql(marcar(ORG_A, PROF_A2, "14:00", "14:30", { id: X, status: "pending" }) + marcar(ORG_A, PROF_A2, "14:10", "14:40", { id: Y }));
    sql(ligar(ORG_A, true));
  });

  it("não trava a operação de hoje: pending → confirmed passa", () => {
    expect(erro(`update public.calendar_appointments set status = 'confirmed' where id = '${X}';`)).toBeNull();
  });

  it("mover o horário para dentro de outro é recusado", () => {
    expect(erro(`update public.calendar_appointments set starts_at = '2030-01-10 14:05+00' where id = '${Y}';`)).toMatch(
      /agenda_horario_indisponivel/,
    );
  });
});

describe("a corrida", () => {
  it("duas sessões gravando horários que se cruzam ao mesmo tempo: só uma passa", async () => {
    const sessao = (n: number) =>
      `begin; ${marcar(ORG_A, PROF_A1, n === 1 ? "16:00" : "16:10", n === 1 ? "16:30" : "16:40", { id: `7a7a0000-3333-4000-8000-00000000e00${n}` })} select pg_sleep(1.5); commit;`;
    const [a, b] = await Promise.all([sqlAsync(sessao(1)), sqlAsync(sessao(2))]);
    // 3 = o psql com ON_ERROR_STOP parou num erro de SQL (a recusa da trava).
    expect([a.code, b.code].sort()).toEqual([0, 3]);
    expect(a.stderr + b.stderr).toMatch(/agenda_horario_indisponivel/);
    expect(
      ultima(sql(`select count(*) from public.calendar_appointments where organization_id = '${ORG_A}' and starts_at >= '2030-01-10 16:00+00' and starts_at < '2030-01-10 17:00+00';`)),
    ).toBe("1");
  });

  it("controle: SEM a trava as duas passariam (a corrida é real)", async () => {
    sql(ligar(ORG_B, false));
    const sessao = (n: number) =>
      `begin; ${marcar(ORG_B, PROF_B, n === 1 ? "16:00" : "16:10", n === 1 ? "16:30" : "16:40", { id: `7a7a0000-3333-4000-8000-00000000f00${n}` })} select pg_sleep(1.5); commit;`;
    const [a, b] = await Promise.all([sqlAsync(sessao(1)), sqlAsync(sessao(2))]);
    expect([a.code, b.code]).toEqual([0, 0]);
  });
});

describe("opção trava_sobreposicao", () => {
  it("gerente não liga: 42501", () => {
    expect(erro(como(MANAGER_A, `select public.fn_clinic_definir_trava_sobreposicao('${ORG_A}', false);`))).toMatch(
      /clinic_flag_forbidden/,
    );
  });

  it("admin desliga e liga, e as outras chaves de settings.clinic ficam", () => {
    sql(como(ADMIN_A, `select public.fn_clinic_definir_trava_sobreposicao('${ORG_A}', false);`));
    const out = sql(como(ADMIN_A, `select public.fn_clinic_definir_trava_sobreposicao('${ORG_A}', true);`));
    expect(ultima(out)).toContain('"mudou": true');
    expect(
      ultima(sql(`select settings->'clinic'->>'trava_sobreposicao', settings->'clinic'->>'profissionais' from public.organizations where id = '${ORG_A}';`)),
    ).toBe("true|true");
  });

  it.each([
    ["anon", "public.fn_clinic_definir_trava_sobreposicao(uuid, boolean)"],
    ["anon", "public.fn_clinic_trava_sobreposicao()"],
    ["authenticated", "public.fn_clinic_trava_sobreposicao()"],
  ])("%s não executa %s", (papel, fn) => {
    expect(ultima(sql(`select has_function_privilege('${papel}', '${fn}', 'execute');`))).toBe("f");
  });
});
