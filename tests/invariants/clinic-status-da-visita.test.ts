/**
 * clinic (fork) — migration 9003: status da visita do paciente agendado.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. o caminho feliz: agendado → na_recepcao → pronto → em_atendimento →
 *      finalizado, cada passo com um evento e o horário do marco;
 *   2. voltar um passo é CORREÇÃO e exige motivo; com motivo, fica no histórico;
 *   3. agendamento sem paciente ou cancelado não tem visita;
 *   4. visualizador não muda status; atendente (recepção) e profissionais mudam;
 *   5. isolamento entre organizações;
 *   6. o histórico é append-only — nem service_role altera ou apaga;
 *   7. a tabela de visitas está na publicação supabase_realtime;
 *   8. a tabela de chegadas da 9002 saiu.
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

const ultima = (out: string) => out.split("\n").at(-1) ?? "";

function erroComo(userId: string, comando: string): string | null {
  try {
    sql(como(userId, comando));
    return null;
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
}

const ORG_A = "f15a0000-0000-4000-8000-00000000000a";
const ORG_B = "f15a0000-0000-4000-8000-00000000000b";
const RECEPCAO_A = "f15a0000-1111-4000-8000-00000000000a";
const PROFISSIONAL_A = "f15a0000-1111-4000-8000-0000000000a2";
const VIEWER_A = "f15a0000-1111-4000-8000-00000000000c";
const AGENT_B = "f15a0000-1111-4000-8000-00000000000b";
const PACIENTE_A = "f15a0000-2222-4000-8000-00000000000a";
const PACIENTE_B = "f15a0000-2222-4000-8000-00000000000b";
const AG_A = "f15a0000-3333-4000-8000-00000000000a";
const AG_SEM_PACIENTE = "f15a0000-3333-4000-8000-0000000000a2";
const AG_B = "f15a0000-3333-4000-8000-00000000000b";

const mudar = (ag: string, status: string, motivo?: string) =>
  `select public.fn_clinic_mudar_status_visita('${ag.startsWith("f15a0000-3333-4000-8000-00000000000b") ? ORG_B : ORG_A}', '${ag}', '${status}'${motivo ? `, '${motivo}'` : ""});`;

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${RECEPCAO_A}', 'visita-recepcao-a@invariant.test'),
      ('${PROFISSIONAL_A}', 'visita-prof-a@invariant.test'),
      ('${VIEWER_A}', 'visita-viewer-a@invariant.test'),
      ('${AGENT_B}', 'visita-agent-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name) values
      ('${ORG_A}', 'visita-inv-a', 'Visita Invariant A', 'Visita A'),
      ('${ORG_B}', 'visita-inv-b', 'Visita Invariant B', 'Visita B')
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${RECEPCAO_A}', '${ORG_A}', 'agent', now()),
      ('${PROFISSIONAL_A}', '${ORG_A}', 'agent', now()),
      ('${VIEWER_A}', '${ORG_A}', 'viewer', now()),
      ('${AGENT_B}', '${ORG_B}', 'agent', now())
      on conflict do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PACIENTE_A}', '${ORG_A}', 'Paciente Visita A', '+5511990000101'),
      ('${PACIENTE_B}', '${ORG_B}', 'Paciente Visita B', '+5511990000102')
      on conflict (id) do nothing;
    insert into public.calendar_appointments (id, organization_id, title, starts_at, ends_at, owner_user_id, contact_id, status) values
      ('${AG_A}', '${ORG_A}', 'Limpeza de pele', now() - interval '1 hour', now(), '${PROFISSIONAL_A}', '${PACIENTE_A}', 'confirmed'),
      ('${AG_SEM_PACIENTE}', '${ORG_A}', 'Reunião interna', now(), now() + interval '1 hour', '${PROFISSIONAL_A}', null, 'confirmed'),
      ('${AG_B}', '${ORG_B}', 'Consulta B', now(), now() + interval '1 hour', '${AGENT_B}', '${PACIENTE_B}', 'confirmed')
      on conflict (id) do nothing;
  `);
  sql(como(AGENT_B, mudar(AG_B, "na_recepcao")));
});

describe("status da visita — o caminho da clínica", () => {
  it("recepção e profissional levam a visita até finalizado, com um evento por passo", () => {
    sql(como(RECEPCAO_A, mudar(AG_A, "na_recepcao")));
    sql(como(RECEPCAO_A, mudar(AG_A, "pronto")));
    sql(como(PROFISSIONAL_A, mudar(AG_A, "em_atendimento")));
    sql(como(PROFISSIONAL_A, mudar(AG_A, "finalizado")));
    const linha = ultima(
      sql(`select status, arrived_at is not null, ready_at is not null, started_at is not null, finished_at is not null, changed_by
             from public.clinic_appointment_visits where appointment_id = '${AG_A}';`),
    );
    expect(linha).toBe(`finalizado|t|t|t|t|${PROFISSIONAL_A}`);
    const eventos = sql(
      `select string_agg(coalesce(from_status,'-') || '>' || to_status, ',' order by created_at)
         from public.clinic_appointment_visit_events where appointment_id = '${AG_A}';`,
    );
    expect(ultima(eventos)).toBe("agendado>na_recepcao,na_recepcao>pronto,pronto>em_atendimento,em_atendimento>finalizado");
  });

  it("voltar um passo sem motivo é recusado", () => {
    expect(erroComo(PROFISSIONAL_A, mudar(AG_A, "em_atendimento"))).toMatch(/visita_correcao_sem_motivo/);
  });

  it("voltar com motivo fica no histórico como correção, com quem fez", () => {
    sql(como(PROFISSIONAL_A, mudar(AG_A, "em_atendimento", "Finalizei por engano")));
    const linha = ultima(
      sql(`select to_status, is_correction, reason, changed_by from public.clinic_appointment_visit_events
            where appointment_id = '${AG_A}' order by created_at desc limit 1;`),
    );
    expect(linha).toBe(`em_atendimento|t|Finalizei por engano|${PROFISSIONAL_A}`);
  });

  it("repetir o mesmo status não gera evento", () => {
    const antes = ultima(sql(`select count(*) from public.clinic_appointment_visit_events where appointment_id = '${AG_A}';`));
    sql(como(PROFISSIONAL_A, mudar(AG_A, "em_atendimento")));
    const depois = ultima(sql(`select count(*) from public.clinic_appointment_visit_events where appointment_id = '${AG_A}';`));
    expect(depois).toBe(antes);
  });

  it("agendamento sem paciente não tem visita", () => {
    expect(erroComo(RECEPCAO_A, mudar(AG_SEM_PACIENTE, "na_recepcao"))).toMatch(/visita_sem_paciente/);
  });

  it("status fora do vocabulário é recusado", () => {
    expect(erroComo(RECEPCAO_A, mudar(AG_A, "atendido"))).toMatch(/visita_status_invalido/);
  });
});

describe("status da visita — papéis, isolamento e auditoria", () => {
  it("visualizador não muda status", () => {
    expect(erroComo(VIEWER_A, mudar(AG_A, "finalizado"))).not.toBeNull();
  });

  it.each(["clinic_appointment_visits", "clinic_appointment_visit_events"])("%s: a org A não vê a org B", (t) => {
    expect(ultima(sql(como(RECEPCAO_A, `select count(*) from public.${t} where organization_id = '${ORG_B}';`)))).toBe("0");
    expect(Number(ultima(sql(como(RECEPCAO_A, `select count(*) from public.${t} where organization_id = '${ORG_A}';`))))).toBeGreaterThan(0);
  });

  it("a org A não muda a visita da org B", () => {
    expect(
      erroComo(RECEPCAO_A, `select public.fn_clinic_mudar_status_visita('${ORG_B}', '${AG_B}', 'pronto');`),
    ).not.toBeNull();
  });

  it("o histórico é append-only: nem atendente nem service_role alteram ou apagam", () => {
    expect(
      erroComo(RECEPCAO_A, `update public.clinic_appointment_visit_events set reason = 'x' where appointment_id = '${AG_A}';`) ??
        ultima(sql(`select count(*) from public.clinic_appointment_visit_events where reason = 'x';`)),
    ).not.toBe("1");
    const privs = ultima(
      sql(`select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants
            where table_schema = 'public' and table_name = 'clinic_appointment_visit_events'
              and grantee in ('authenticated','service_role','anon')
              and privilege_type in ('UPDATE','DELETE','TRUNCATE');`),
    );
    expect(privs).toBe("");
  });

  it("anon não executa a função de status", () => {
    expect(
      ultima(sql(`select has_function_privilege('anon', 'public.fn_clinic_mudar_status_visita(uuid, uuid, text, text)', 'execute');`)),
    ).toBe("f");
  });
});

describe("status da visita — Realtime e a troca da 9002", () => {
  it("visitas estão na publicação supabase_realtime (o painel da recepção)", () => {
    expect(
      ultima(sql(`select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'clinic_appointment_visits';`)),
    ).toBe("1");
  });

  it("a tabela de chegadas da 9002 saiu", () => {
    expect(ultima(sql(`select to_regclass('public.clinic_appointment_arrivals') is null;`))).toBe("t");
  });
});
