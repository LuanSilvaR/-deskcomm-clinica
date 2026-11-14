/**
 * clinic (fork) — migration 9004: confirmação de consulta pelo WhatsApp.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. um pedido por agendamento (unique) e status só do vocabulário;
 *   2. isolamento entre organizações;
 *   3. atendente registra/atualiza; visualizador não altera;
 *   4. a opção `confirmacao_automatica`: só admin liga; gerente recebe 42501;
 *      ligar preserva as outras chaves de settings.clinic;
 *   5. anon não lê a tabela nem executa a função.
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

const ORG_A = "c0f10000-0000-4000-8000-00000000000a";
const ORG_B = "c0f10000-0000-4000-8000-00000000000b";
const ADMIN_A = "c0f10000-1111-4000-8000-0000000000a1";
const MANAGER_A = "c0f10000-1111-4000-8000-0000000000a3";
const AGENT_A = "c0f10000-1111-4000-8000-00000000000a";
const VIEWER_A = "c0f10000-1111-4000-8000-00000000000c";
const AGENT_B = "c0f10000-1111-4000-8000-00000000000b";
const PACIENTE_A = "c0f10000-2222-4000-8000-00000000000a";
const PACIENTE_B = "c0f10000-2222-4000-8000-00000000000b";
const AG_A = "c0f10000-3333-4000-8000-00000000000a";
const AG_B = "c0f10000-3333-4000-8000-00000000000b";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADMIN_A}', 'confirmacao-admin-a@invariant.test'),
      ('${MANAGER_A}', 'confirmacao-manager-a@invariant.test'),
      ('${AGENT_A}', 'confirmacao-agent-a@invariant.test'),
      ('${VIEWER_A}', 'confirmacao-viewer-a@invariant.test'),
      ('${AGENT_B}', 'confirmacao-agent-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG_A}', 'confirmacao-inv-a', 'Confirmacao Invariant A', 'Confirmação A', '{"clinic":{"profissionais":true}}'::jsonb),
      ('${ORG_B}', 'confirmacao-inv-b', 'Confirmacao Invariant B', 'Confirmação B', '{}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADMIN_A}', '${ORG_A}', 'admin', now()),
      ('${MANAGER_A}', '${ORG_A}', 'manager', now()),
      ('${AGENT_A}', '${ORG_A}', 'agent', now()),
      ('${VIEWER_A}', '${ORG_A}', 'viewer', now()),
      ('${AGENT_B}', '${ORG_B}', 'agent', now())
      on conflict do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PACIENTE_A}', '${ORG_A}', 'Paciente Confirmação A', '+5511990000201'),
      ('${PACIENTE_B}', '${ORG_B}', 'Paciente Confirmação B', '+5511990000202')
      on conflict (id) do nothing;
    insert into public.calendar_appointments (id, organization_id, title, starts_at, ends_at, owner_user_id, contact_id, status) values
      ('${AG_A}', '${ORG_A}', 'Consulta A', now() + interval '1 day', now() + interval '25 hours', '${AGENT_A}', '${PACIENTE_A}', 'pending'),
      ('${AG_B}', '${ORG_B}', 'Consulta B', now() + interval '1 day', now() + interval '25 hours', '${AGENT_B}', '${PACIENTE_B}', 'pending')
      on conflict (id) do nothing;
    insert into public.clinic_confirmation_requests (organization_id, appointment_id, contact_id) values
      ('${ORG_B}', '${AG_B}', '${PACIENTE_B}')
      on conflict (appointment_id) do nothing;
  `);
});

describe("pedido de confirmação — registro", () => {
  it("atendente registra o pedido; nasce aguardando", () => {
    expect(
      erroComo(
        AGENT_A,
        `insert into public.clinic_confirmation_requests (organization_id, appointment_id, contact_id)
         values ('${ORG_A}', '${AG_A}', '${PACIENTE_A}');`,
      ),
    ).toBeNull();
    expect(ultima(sql(`select status from public.clinic_confirmation_requests where appointment_id = '${AG_A}';`))).toBe(
      "aguardando",
    );
  });

  it("um pedido por agendamento", () => {
    expect(
      erroComo(
        AGENT_A,
        `insert into public.clinic_confirmation_requests (organization_id, appointment_id, contact_id)
         values ('${ORG_A}', '${AG_A}', '${PACIENTE_A}');`,
      ),
    ).toMatch(/clinic_confirmation_requests_agendamento_key/);
  });

  it("status fora do vocabulário é recusado", () => {
    expect(
      erroComo(AGENT_A, `update public.clinic_confirmation_requests set status = 'talvez' where appointment_id = '${AG_A}';`),
    ).toMatch(/clinic_confirmation_requests_status_check/);
  });

  it("atendente marca confirmado", () => {
    sql(
      como(
        AGENT_A,
        `update public.clinic_confirmation_requests set status = 'confirmado', answered_at = now()
          where appointment_id = '${AG_A}';`,
      ),
    );
    expect(ultima(sql(`select status from public.clinic_confirmation_requests where appointment_id = '${AG_A}';`))).toBe(
      "confirmado",
    );
  });

  it("visualizador não altera", () => {
    sql(como(VIEWER_A, `update public.clinic_confirmation_requests set status = 'recusado' where appointment_id = '${AG_A}';`));
    expect(ultima(sql(`select status from public.clinic_confirmation_requests where appointment_id = '${AG_A}';`))).toBe(
      "confirmado",
    );
  });
});

describe("pedido de confirmação — isolamento", () => {
  it("quem é da org A não enxerga o pedido da org B", () => {
    expect(
      ultima(sql(como(AGENT_A, `select count(*) from public.clinic_confirmation_requests where organization_id = '${ORG_B}';`))),
    ).toBe("0");
  });

  it("quem é da org A não grava pedido na org B", () => {
    sql(`delete from public.clinic_confirmation_requests where appointment_id = '${AG_B}';`);
    expect(
      erroComo(
        AGENT_A,
        `insert into public.clinic_confirmation_requests (organization_id, appointment_id, contact_id)
         values ('${ORG_B}', '${AG_B}', '${PACIENTE_B}');`,
      ),
    ).toMatch(/row-level security/);
  });
});

describe("opção confirmacao_automatica", () => {
  it("gerente não liga: 42501", () => {
    expect(erroComo(MANAGER_A, `select public.fn_clinic_definir_confirmacao_automatica('${ORG_A}', true);`)).toMatch(
      /clinic_flag_forbidden/,
    );
  });

  it("admin de OUTRA org não liga a da org A", () => {
    expect(erroComo(AGENT_B, `select public.fn_clinic_definir_confirmacao_automatica('${ORG_A}', true);`)).toMatch(
      /clinic_flag_forbidden/,
    );
  });

  it("admin liga, e as outras chaves de settings.clinic ficam", () => {
    const out = sql(como(ADMIN_A, `select public.fn_clinic_definir_confirmacao_automatica('${ORG_A}', true);`));
    expect(ultima(out)).toContain('"mudou": true');
    expect(
      ultima(
        sql(`select settings->'clinic'->>'confirmacao_automatica', settings->'clinic'->>'profissionais'
               from public.organizations where id = '${ORG_A}';`),
      ),
    ).toBe("true|true");
  });

  it("anon não lê a tabela nem executa a função", () => {
    expect(ultima(sql(`select has_table_privilege('anon', 'public.clinic_confirmation_requests', 'select');`))).toBe("f");
    expect(
      ultima(sql(`select has_function_privilege('anon', 'public.fn_clinic_definir_confirmacao_automatica(uuid, boolean)', 'execute');`)),
    ).toBe("f");
  });
});

describe("migration 9006: o lembrete que falhou", () => {
  it("falha só aceita envio_falhou ou nao_enviado", () => {
    expect(
      erroComo(AGENT_A, `update public.clinic_confirmation_requests set falha = 'talvez' where appointment_id = '${AG_A}';`),
    ).toMatch(/clinic_confirmation_requests_falha_check/);
    expect(
      erroComo(AGENT_A, `update public.clinic_confirmation_requests set falha = 'envio_falhou' where appointment_id = '${AG_A}';`),
    ).toBeNull();
  });

  it("reminder_message_id aponta para messages (e some com a mensagem, sem apagar o pedido)", () => {
    const fk = ultima(
      sql(`select confdeltype from pg_constraint
            where conrelid = 'public.clinic_confirmation_requests'::regclass
              and contype = 'f'
              and conkey = array[(select attnum from pg_attribute
                                    where attrelid = 'public.clinic_confirmation_requests'::regclass
                                      and attname = 'reminder_message_id')]::smallint[];`),
    );
    expect(fk).toBe("n"); // on delete set null
  });
});
