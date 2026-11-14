/**
 * clinic (fork, agenda S6b) — migration 9045: encaixe.
 *
 * Prova no Postgres real:
 *   - só quem tem `agenda.encaixe` (gerente) encaixa; atendente é recusado;
 *   - flag desligada (como nasce), motivo curto e outra empresa são recusados;
 *   - encaixe sobre pending/confirmed grava agendamento + encaixe + histórico;
 *   - realizado sobreposto recusa; GUC forjado fora da função não passa;
 *   - o encaixe é isolado por empresa, append-only para a sessão, e anon não executa.
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

const ORG = "c9450000-0000-4000-8000-00000000000a";
const ORG_B = "c9450000-0000-4000-8000-00000000000b";
const GER = "c9450000-1111-4000-8000-0000000000a1";
const ATE = "c9450000-1111-4000-8000-0000000000a2";
const PROF = "c9450000-1111-4000-8000-0000000000a3";
const AGENTE_B = "c9450000-1111-4000-8000-0000000000b1";
const BASE = "c9450000-3333-4000-8000-000000000001";
const FEITO = "c9450000-3333-4000-8000-000000000002";

const linha = (org: string, ini: string, fim: string) =>
  `jsonb_build_object('organization_id', '${org}', 'title', 'Encaixe', 'starts_at', '${ini}'::timestamptz,
     'ends_at', '${fim}'::timestamptz, 'owner_user_id', '${PROF}', 'status', 'confirmed')`;
const encaixar = (org: string, ini: string, fim: string, motivo: string) =>
  `select public.fn_clinic_agenda_encaixar(${linha(org, ini, fim)}, '${motivo}');`;
const flag = (ligada: boolean) =>
  sql(`update public.organizations set settings = jsonb_build_object('clinic',
         jsonb_build_object('trava_sobreposicao', true, 'encaixe', ${ligada})) where id = '${ORG}';`);

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${GER}', 'enc-ger@invariant.test'), ('${ATE}', 'enc-ate@invariant.test'),
      ('${PROF}', 'enc-prof@invariant.test'), ('${AGENTE_B}', 'enc-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'encaixe-inv-a', 'Encaixe Invariant A', 'Encaixe A', '{}'::jsonb),
      ('${ORG_B}', 'encaixe-inv-b', 'Encaixe Invariant B', 'Encaixe B', '{}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${GER}', '${ORG}', 'manager', now()), ('${ATE}', '${ORG}', 'agent', now()),
      ('${PROF}', '${ORG}', 'agent', now()), ('${AGENTE_B}', '${ORG_B}', 'manager', now())
      on conflict do nothing;
    insert into public.calendar_appointments (id, organization_id, title, starts_at, ends_at, owner_user_id, status) values
      ('${BASE}', '${ORG}', 'Consulta', '2031-03-10 14:00+00', '2031-03-10 15:00+00', '${PROF}', 'confirmed'),
      ('${FEITO}', '${ORG}', 'Realizada', '2031-03-11 14:00+00', '2031-03-11 15:00+00', '${PROF}', 'completed')
      on conflict (id) do nothing;
  `);
  flag(false);
});

describe("quem pode encaixar", () => {
  it("flag desligada (como nasce): encaixe_desligado", () => {
    expect(erro(como(GER, encaixar(ORG, "2031-03-10 14:30+00", "2031-03-10 15:30+00", "Urgência da paciente")))).toMatch(
      /encaixe_desligado/,
    );
  });

  it("atendente (sem agenda.encaixe) é recusado; outra empresa também", () => {
    flag(true);
    expect(erro(como(ATE, encaixar(ORG, "2031-03-10 14:30+00", "2031-03-10 15:30+00", "Urgência da paciente")))).toMatch(
      /sem_permissao/,
    );
    expect(erro(como(AGENTE_B, encaixar(ORG, "2031-03-10 14:30+00", "2031-03-10 15:30+00", "Urgência da paciente")))).toMatch(
      /sem_permissao/,
    );
  });

  it("motivo curto: motivo_invalido; nada gravado", () => {
    expect(erro(como(GER, encaixar(ORG, "2031-03-10 14:30+00", "2031-03-10 15:30+00", "ok")))).toMatch(/motivo_invalido/);
    expect(ultima(sql(`select count(*) from public.clinic_agenda_encaixes where organization_id = '${ORG}';`))).toBe("0");
  });

  it("sem sessão (anon) não executa", () => {
    expect(erro(`set role anon; ${encaixar(ORG, "2031-03-10 14:30+00", "2031-03-10 15:30+00", "Urgência da paciente")}`)).toMatch(
      /permission denied/,
    );
  });
});

describe("o encaixe", () => {
  it("sobre confirmado: grava agendamento, encaixe e histórico", () => {
    const id = ultima(sql(como(GER, encaixar(ORG, "2031-03-10 14:30+00", "2031-03-10 15:30+00", "Urgência da paciente"))));
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(ultima(sql(`select source from public.calendar_appointments where id = '${id}';`))).toBe("ui");
    expect(
      ultima(sql(`select sobrepostos[1]::text || ':' || ator::text from public.clinic_agenda_encaixes where appointment_id = '${id}';`)),
    ).toBe(`${BASE}:${GER}`);
    expect(
      ultima(sql(`select count(*) from public.clinic_agenda_historico where appointment_id = '${id}' and tipo = 'encaixe' and ator = '${GER}';`)),
    ).toBe("1");
  });

  it("sobre realizado: sobreposto_finalizado, nada gravado", () => {
    const antes = ultima(sql(`select count(*) from public.calendar_appointments where organization_id = '${ORG}';`));
    expect(erro(como(GER, encaixar(ORG, "2031-03-11 14:30+00", "2031-03-11 15:30+00", "Urgência da paciente")))).toMatch(
      /sobreposto_finalizado/,
    );
    expect(ultima(sql(`select count(*) from public.calendar_appointments where organization_id = '${ORG}';`))).toBe(antes);
  });

  it("GUC forjado fora da função não libera a sobreposição (23P01)", () => {
    expect(
      erro(`
        select set_config('clinic.encaixe_id', gen_random_uuid()::text, false);
        insert into public.calendar_appointments (organization_id, title, starts_at, ends_at, owner_user_id, status)
        values ('${ORG}', 'Forjado', '2031-03-10 14:10+00', '2031-03-10 14:40+00', '${PROF}', 'confirmed');`),
    ).toMatch(/agenda_horario_indisponivel/);
  });
});

describe("a tabela de encaixes", () => {
  it("a opção (9046) só o administrador liga; anon não executa", () => {
    expect(erro(como(GER, `select public.fn_clinic_definir_encaixe('${ORG}', true);`))).toMatch(/clinic_flag_forbidden/);
    expect(erro(`set role anon; select public.fn_clinic_definir_encaixe('${ORG}', true);`)).toMatch(/permission denied/);
  });

  it("é isolada por empresa, sem escrita direta da sessão", () => {
    expect(ultima(sql(como(AGENTE_B, `select count(*) from public.clinic_agenda_encaixes where organization_id = '${ORG}';`)))).toBe("0");
    expect(ultima(sql(como(GER, `select count(*) from public.clinic_agenda_encaixes where organization_id = '${ORG}';`)))).not.toBe("0");
    expect(erro(como(GER, `delete from public.clinic_agenda_encaixes where organization_id = '${ORG}';`))).toMatch(/permission denied/);
    expect(
      erro(
        como(
          GER,
          `insert into public.clinic_agenda_encaixes (organization_id, appointment_id, sobrepostos, motivo, ator, txid)
           values ('${ORG}', '${BASE}', '{}', 'motivo qualquer', '${GER}', 1);`,
        ),
      ),
    ).toMatch(/permission denied/);
  });
});
