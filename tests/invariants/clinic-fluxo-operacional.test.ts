/**
 * clinic (fork, agenda S4) — migration 9043: fluxo recepção → profissional.
 *
 * Prova no Postgres real:
 *   - a recepção leva a visita até "pronto" e NÃO inicia nem finaliza;
 *   - ninguém escreve direto nas tabelas da visita (só pela função);
 *   - só o profissional do agendamento inicia; só quem iniciou finaliza;
 *   - o próprio profissional reabre no mesmo dia (a visita volta junto) e não
 *     no dia seguinte; a recepção não "corrige" um finalizado;
 *   - o histórico do agendamento nasce por trigger, é append-only e isolado
 *     por organização.
 */
import { execFileSync } from "node:child_process";

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

const ORG = "c9430000-0000-4000-8000-00000000000a";
const ORG_B = "c9430000-0000-4000-8000-00000000000b";
const REC = "c9430000-1111-4000-8000-0000000000a1";
const PROF = "c9430000-1111-4000-8000-0000000000a2";
const OUTRO = "c9430000-1111-4000-8000-0000000000a3";
const AGENTE_B = "c9430000-1111-4000-8000-0000000000b1";
const PAC = "c9430000-2222-4000-8000-00000000000a";
const AG = "c9430000-3333-4000-8000-000000000001";
const AG_REM = "c9430000-3333-4000-8000-000000000002";

const mudar = (status: string, motivo?: string) =>
  `select public.fn_clinic_mudar_status_visita('${ORG}', '${AG}', '${status}'${motivo ? `, '${motivo}'` : ""});`;
let at = "";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${REC}', 'fluxo-rec@invariant.test'), ('${PROF}', 'fluxo-prof@invariant.test'),
      ('${OUTRO}', 'fluxo-outro@invariant.test'), ('${AGENTE_B}', 'fluxo-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'fluxo-inv-a', 'Fluxo Invariant A', 'Fluxo A', '{"clinic":{"prontuario":true}}'::jsonb),
      ('${ORG_B}', 'fluxo-inv-b', 'Fluxo Invariant B', 'Fluxo B', '{}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${REC}', '${ORG}', 'agent', now()), ('${PROF}', '${ORG}', 'agent', now()),
      ('${OUTRO}', '${ORG}', 'agent', now()), ('${AGENTE_B}', '${ORG_B}', 'agent', now())
      on conflict do nothing;
    insert into public.clinic_professionals (organization_id, user_id, display_name) values
      ('${ORG}', '${PROF}', 'Profissional Fluxo'), ('${ORG}', '${OUTRO}', 'Outro Profissional Fluxo')
      on conflict do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PAC}', '${ORG}', 'Paciente Fluxo', '+5511990004301')
      on conflict (id) do nothing;
    insert into public.calendar_appointments (id, organization_id, title, starts_at, ends_at, owner_user_id, contact_id, status) values
      ('${AG}', '${ORG}', 'Consulta', now() - interval '1 hour', now(), '${PROF}', '${PAC}', 'confirmed'),
      ('${AG_REM}', '${ORG}', 'Retorno', now() + interval '1 day', now() + interval '1 day 30 minutes', '${PROF}', '${PAC}', 'pending')
      on conflict (id) do nothing;
  `);
});

describe("recepção: até 'pronto', nunca o atendimento", () => {
  it("chegada e pronto pela recepção", () => {
    sql(como(REC, mudar("na_recepcao")));
    sql(como(REC, mudar("pronto")));
    expect(ultima(sql(`select status from public.clinic_appointment_visits where appointment_id = '${AG}';`))).toBe("pronto");
  });

  it("a recepção não inicia nem finaliza", () => {
    expect(erro(como(REC, mudar("em_atendimento")))).toMatch(/visita_so_o_profissional/);
    expect(erro(como(REC, mudar("finalizado")))).toMatch(/visita_so_o_profissional/);
  });

  it.each(["clinic_appointment_visits", "clinic_appointment_visit_events"])("%s: sem escrita direta pelo PostgREST", (t) => {
    const privs = ultima(
      sql(`select coalesce(string_agg(privilege_type, ',' order by privilege_type), '') from information_schema.role_table_grants
            where table_schema = 'public' and table_name = '${t}' and grantee = 'authenticated'
              and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');`),
    );
    expect(privs).toBe("");
    expect(erro(como(REC, `update public.clinic_appointment_visits set status = 'finalizado' where appointment_id = '${AG}';`))).toMatch(
      /permission denied/,
    );
  });
});

describe("atendimento: só o profissional do agendamento", () => {
  it("outro profissional não inicia o atendimento alheio", () => {
    expect(erro(como(OUTRO, `select public.fn_clinic_iniciar_atendimento('${ORG}', '${AG}');`))).toMatch(/atendimento_so_o_profissional/);
  });

  it("o dono inicia, e a visita vai a 'em atendimento'", () => {
    at = json<{ id: string }>(sql(como(PROF, `select public.fn_clinic_iniciar_atendimento('${ORG}', '${AG}');`))).id;
    expect(ultima(sql(`select status from public.clinic_appointment_visits where appointment_id = '${AG}';`))).toBe("em_atendimento");
  });

  it("outro profissional não finaliza; quem iniciou finaliza", () => {
    sql(como(PROF, `select public.fn_clinic_salvar_evolucao('${ORG}', '${at}', 'Evolução de teste.', null, null, null, null, 0);`));
    expect(erro(como(OUTRO, `select public.fn_clinic_finalizar_atendimento('${ORG}', '${at}');`))).toMatch(/atendimento_so_o_profissional/);
    expect(json<{ mudou: boolean }>(sql(como(PROF, `select public.fn_clinic_finalizar_atendimento('${ORG}', '${at}');`))).mudou).toBe(true);
    sql(como(PROF, mudar("finalizado")));
  });

  it("a recepção não 'corrige' um finalizado", () => {
    expect(erro(como(REC, mudar("pronto", "Volta por engano")))).toMatch(/visita_finalizada_bloqueada/);
  });
});

describe("depois de finalizado: o próprio profissional, no mesmo dia", () => {
  it("o dono reabre no mesmo dia e a visita volta a 'em atendimento'", () => {
    sql(como(PROF, `select public.fn_clinic_reabrir_atendimento('${ORG}', '${at}', 'Faltou registrar a conduta');`));
    expect(ultima(sql(`select status from public.clinic_atendimentos where id = '${at}';`))).toBe("em_andamento");
    expect(ultima(sql(`select status from public.clinic_appointment_visits where appointment_id = '${AG}';`))).toBe("em_atendimento");
  });

  it("no dia seguinte, o próprio profissional já não reabre", () => {
    sql(como(PROF, `select public.fn_clinic_finalizar_atendimento('${ORG}', '${at}');`));
    sql(`set session_replication_role = replica;
         update public.clinic_atendimentos set finished_at = now() - interval '2 days' where id = '${at}';`);
    expect(erro(como(PROF, `select public.fn_clinic_reabrir_atendimento('${ORG}', '${at}', 'Tarde demais');`))).toMatch(/acesso_proibido/);
  });
});

describe("histórico do agendamento", () => {
  it("nasce por trigger: criado e remarcado (de → para)", () => {
    sql(`update public.calendar_appointments set starts_at = starts_at + interval '2 hours', ends_at = ends_at + interval '2 hours'
          where id = '${AG_REM}';`);
    expect(ultima(sql(`select string_agg(tipo, ',' order by created_at) from public.clinic_agenda_historico where appointment_id = '${AG_REM}';`))).toBe(
      "criado,remarcado",
    );
    expect(
      ultima(sql(`select inicio_depois - inicio_antes from public.clinic_agenda_historico where appointment_id = '${AG_REM}' and tipo = 'remarcado';`)),
    ).toBe("02:00:00");
  });

  it("append-only: a sessão não escreve nem apaga", () => {
    expect(erro(como(PROF, `delete from public.clinic_agenda_historico where appointment_id = '${AG_REM}';`))).toMatch(/permission denied/);
    expect(
      erro(como(PROF, `insert into public.clinic_agenda_historico (organization_id, appointment_id, tipo) values ('${ORG}', '${AG_REM}', 'confirmado');`)),
    ).toMatch(/permission denied/);
  });

  it("isolado por organização", () => {
    expect(ultima(sql(como(AGENTE_B, `select count(*) from public.clinic_agenda_historico where organization_id = '${ORG}';`)))).toBe("0");
    expect(Number(ultima(sql(como(PROF, `select count(*) from public.clinic_agenda_historico where organization_id = '${ORG}';`))))).toBeGreaterThan(0);
  });
});
