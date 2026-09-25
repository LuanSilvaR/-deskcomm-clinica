/**
 * clinic (fork, prontuário F8) — migration 9025: reabrir atendimento.
 *
 * Prova no Postgres real: sem `atendimento.reabrir` (profissional agente)
 * recusado; sem motivo recusado; gerente com papel clínico reabre; o evento
 * guarda motivo e estado; o que já foi finalizado CONTINUA imutável; dá para
 * acrescentar um registro novo e finalizar de novo; anon não executa.
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

const ORG = "b8e10000-0000-4000-8000-00000000000a";
const PROF = "b8e10000-1111-4000-8000-0000000000a3";
const GER = "b8e10000-1111-4000-8000-0000000000a4";
const PAC = "b8e10000-2222-4000-8000-00000000000a";
const AG = "b8e10000-3333-4000-8000-000000000001";

let at = "";
const reabrir = (ator: string, motivo: string | null) =>
  como(ator, `select public.fn_clinic_reabrir_atendimento('${ORG}', '${at}', ${motivo ? `'${motivo}'` : "null"});`);

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${PROF}', 'rea-prof@invariant.test'), ('${GER}', 'rea-ger@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'rea-inv-a', 'Reabrir Invariant A', 'Reabrir A', '{"clinic":{"prontuario":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${PROF}', '${ORG}', 'agent', now()), ('${GER}', '${ORG}', 'manager', now())
      on conflict do nothing;
    insert into public.clinic_professionals (organization_id, user_id, display_name) values
      ('${ORG}', '${PROF}', 'Profissional A'), ('${ORG}', '${GER}', 'Coordenação A')
      on conflict do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PAC}', '${ORG}', 'Paciente Reabrir A', '+5511990000901')
      on conflict (id) do nothing;
    insert into public.calendar_appointments (id, organization_id, title, starts_at, ends_at, owner_user_id, contact_id, status) values
      ('${AG}', '${ORG}', 'Consulta', now() - interval '1 hour', now(), '${PROF}', '${PAC}', 'confirmed')
      on conflict (id) do nothing;
  `);
  at = json<{ id: string }>(sql(como(PROF, `select public.fn_clinic_iniciar_atendimento('${ORG}', '${AG}');`))).id;
  sql(como(PROF, `select public.fn_clinic_salvar_evolucao('${ORG}', '${at}', 'Evolução de teste.', null, null, null, null, 0);`));
  sql(como(PROF, `select public.fn_clinic_finalizar_atendimento('${ORG}', '${at}');`));
});

describe("reabrir atendimento", () => {
  it("profissional sem atendimento.reabrir recusado; sem motivo recusado", () => {
    expect(erro(reabrir(PROF, "Faltou o procedimento"))).toMatch(/acesso_proibido/);
    expect(erro(reabrir(GER, null))).toMatch(/atendimento_sem_motivo/);
  });

  it("gerência clínica reabre com motivo; evento com antes/depois", () => {
    sql(reabrir(GER, "Faltou registrar o procedimento"));
    expect(ultima(sql(`select status || ':' || (finished_at is null) from public.clinic_atendimentos where id = '${at}';`))).toBe(
      "em_andamento:true",
    );
    expect(
      ultima(
        sql(`select tipo || ':' || status_antes || '>' || status_depois || ':' || motivo from public.clinic_atendimento_eventos
              where atendimento_id = '${at}' order by created_at desc limit 1;`),
      ),
    ).toBe("reaberto:finalizado>em_andamento:Faltou registrar o procedimento");
    expect(erro(reabrir(GER, "de novo"))).toMatch(/atendimento_nao_finalizado/);
  });

  it("o que foi finalizado continua imutável; o novo entra; finaliza de novo", () => {
    expect(erro(como(PROF, `select public.fn_clinic_salvar_evolucao('${ORG}', '${at}', 'reescrita', null, null, null, null, 1);`))).toMatch(
      /prontuario_imutavel/,
    );
    sql(
      como(
        PROF,
        `select public.fn_clinic_procedimento_salvar('${ORG}', '${at}', null, '{"descricao":"Procedimento esquecido"}'::jsonb, '[]'::jsonb, 0);`,
      ),
    );
    expect(json<{ mudou: boolean }>(sql(como(PROF, `select public.fn_clinic_finalizar_atendimento('${ORG}', '${at}');`))).mudou).toBe(true);
    expect(ultima(sql(`select string_agg(status, ',') from public.clinic_procedimentos_realizados where atendimento_id = '${at}';`))).toBe(
      "finalizado",
    );
  });

  it("anon não executa", () => {
    expect(erro(`set role anon; select public.fn_clinic_reabrir_atendimento('${ORG}', '${at}', 'xxx');`)).toMatch(/permission denied/);
  });
});
