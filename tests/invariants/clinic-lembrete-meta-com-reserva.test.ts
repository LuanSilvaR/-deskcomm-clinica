/**
 * clinic (fork) — migration 8023: lembrete de consulta pela Meta com reserva (#83).
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. o modelo do lembrete é da mesma organização do tipo (FK composta);
 *   2. apagar o modelo zera só `reminder_meta_template_id`;
 *   3. `reminder_falha` só aceita o vocabulário combinado;
 *   4. a opção `lembrete_com_reserva`: só admin liga; anon não executa.
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

function erro(script: string): string | null {
  try {
    sql(script);
    return null;
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
}

const ORG_A = "c0f83000-0000-4000-8000-00000000000a";
const ORG_B = "c0f83000-0000-4000-8000-00000000000b";
const ADMIN_A = "c0f83000-1111-4000-8000-0000000000a1";
const AGENT_A = "c0f83000-1111-4000-8000-00000000000a";
const AGENT_B = "c0f83000-1111-4000-8000-00000000000b";
const PACIENTE_A = "c0f83000-2222-4000-8000-00000000000a";
const AG_A = "c0f83000-3333-4000-8000-00000000000a";
const MODELO_A = "c0f83000-4444-4000-8000-00000000000a";
const MODELO_B = "c0f83000-4444-4000-8000-00000000000b";
const TIPO_OK = "c0f83000-5555-4000-8000-00000000000a";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADMIN_A}', 'lembrete83-admin-a@invariant.test'),
      ('${AGENT_A}', 'lembrete83-agent-a@invariant.test'),
      ('${AGENT_B}', 'lembrete83-agent-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG_A}', 'lembrete83-inv-a', 'Lembrete83 Invariant A', 'Lembrete A', '{"clinic":{"profissionais":true}}'::jsonb),
      ('${ORG_B}', 'lembrete83-inv-b', 'Lembrete83 Invariant B', 'Lembrete B', '{}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADMIN_A}', '${ORG_A}', 'admin', now()),
      ('${AGENT_A}', '${ORG_A}', 'agent', now()),
      ('${AGENT_B}', '${ORG_B}', 'agent', now())
      on conflict do nothing;
    insert into public.meta_templates (id, organization_id, waba_id, name, language, status, components, contract_hash) values
      ('${MODELO_A}', '${ORG_A}', 'waba-a', 'lembrete_a', 'pt_BR', 'APPROVED', '[]'::jsonb, 'h-a'),
      ('${MODELO_B}', '${ORG_B}', 'waba-b', 'lembrete_b', 'pt_BR', 'APPROVED', '[]'::jsonb, 'h-b')
      on conflict (id) do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PACIENTE_A}', '${ORG_A}', 'Paciente Lembrete A', '+5511990000301')
      on conflict (id) do nothing;
    insert into public.calendar_appointments (id, organization_id, title, starts_at, ends_at, owner_user_id, contact_id, status) values
      ('${AG_A}', '${ORG_A}', 'Consulta A', now() + interval '1 day', now() + interval '25 hours', '${AGENT_A}', '${PACIENTE_A}', 'pending')
      on conflict (id) do nothing;
  `);
});

describe("modelo do lembrete no tipo de evento", () => {
  it("fk composta recusa modelo de outra org", () => {
    expect(
      erro(`insert into public.calendar_event_types (organization_id, name, slug, reminder_meta_template_id)
            values ('${ORG_A}', 'Tipo cruzado', 'tipo-cruzado', '${MODELO_B}');`),
    ).toMatch(/23503|calendar_event_types_reminder_meta_template_fk/);
  });

  it("apagar o modelo zera só o reminder_meta_template_id", () => {
    sql(`insert into public.calendar_event_types (id, organization_id, name, slug, reminder_meta_template_id)
         values ('${TIPO_OK}', '${ORG_A}', 'Tipo ok', 'tipo-ok', '${MODELO_A}');`);
    sql(`delete from public.meta_templates where id = '${MODELO_A}';`);
    expect(
      ultima(
        sql(`select (reminder_meta_template_id is null)::text || '/' || (organization_id = '${ORG_A}')::text
               from public.calendar_event_types where id = '${TIPO_OK}';`),
      ),
    ).toBe("true/true");
  });
});

describe("falha do lembrete no agendamento", () => {
  it("reminder_falha recusa valor fora do vocabulário", () => {
    expect(erro(`update public.calendar_appointments set reminder_falha = 'qualquer' where id = '${AG_A}';`)).toMatch(
      /23514|calendar_appointments_reminder_falha_check/,
    );
  });

  it("aceita os motivos combinados e as tentativas nascem vazias", () => {
    expect(ultima(sql(`select reminder_tentativas::text from public.calendar_appointments where id = '${AG_A}';`))).toBe("{}");
    for (const m of ["sem_caminho", "fora_do_horario", "meta_sem_modelo", "erro_apos_tentativas", "envio_nao_confirmado"]) {
      expect(
        erro(`update public.calendar_appointments set reminder_falha = '${m}', reminder_falha_at = now() where id = '${AG_A}';`),
      ).toBeNull();
    }
  });
});

describe("opção lembrete_com_reserva", () => {
  it("fn_clinic_definir_lembrete_com_reserva liga e desliga", () => {
    sql(como(ADMIN_A, `select public.fn_clinic_definir_lembrete_com_reserva('${ORG_A}', true);`));
    expect(ultima(sql(`select settings->'clinic'->>'lembrete_com_reserva' from public.organizations where id = '${ORG_A}';`))).toBe("true");
    expect(ultima(sql(`select settings->'clinic'->>'profissionais' from public.organizations where id = '${ORG_A}';`))).toBe("true");
    sql(como(ADMIN_A, `select public.fn_clinic_definir_lembrete_com_reserva('${ORG_A}', false);`));
    expect(ultima(sql(`select settings->'clinic'->>'lembrete_com_reserva' from public.organizations where id = '${ORG_A}';`))).toBe("false");
  });

  it("fn_clinic_definir_lembrete_com_reserva recusa quem não é admin da org", () => {
    expect(erro(como(AGENT_A, `select public.fn_clinic_definir_lembrete_com_reserva('${ORG_A}', true);`))).toMatch(
      /42501|clinic_flag_forbidden/,
    );
    expect(erro(como(AGENT_B, `select public.fn_clinic_definir_lembrete_com_reserva('${ORG_A}', true);`))).toMatch(
      /42501|clinic_flag_forbidden/,
    );
  });

  it("anon não executa a função", () => {
    expect(
      ultima(sql(`select has_function_privilege('anon', 'public.fn_clinic_definir_lembrete_com_reserva(uuid, boolean)', 'execute');`)),
    ).toBe("f");
    expect(erro(`set role anon; select public.fn_clinic_definir_lembrete_com_reserva('${ORG_A}', true);`)).toMatch(
      /42501|permission denied/,
    );
  });
});
