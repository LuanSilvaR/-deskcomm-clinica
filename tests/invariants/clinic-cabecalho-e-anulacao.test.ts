/**
 * clinic (fork, prontuário F9) — migration 9026: cabeçalho clínico (alergias e
 * alertas com histórico) e anular atendimento aberto por engano.
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
const PSQL = [
  "exec",
  "-i",
  containerName,
  "psql",
  "-U",
  "postgres",
  "-d",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
  "-tA",
  "-f",
  "-",
];

function sql(script: string): string {
  return execFileSync("docker", PSQL, {
    input: script,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
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
const json = <T>(out: string) => JSON.parse(ultima(out)) as T;

const ORG = "b9e10000-0000-4000-8000-00000000000a";
const ORG_B = "b9e10000-0000-4000-8000-00000000000b";
const ADM = "b9e10000-1111-4000-8000-0000000000a1";
const RECEP = "b9e10000-1111-4000-8000-0000000000a2";
const PROF = "b9e10000-1111-4000-8000-0000000000a3";
const PROF_B = "b9e10000-1111-4000-8000-0000000000b1";
const PAC = "b9e10000-2222-4000-8000-00000000000a";
const PAC_B = "b9e10000-2222-4000-8000-00000000000b";
const AG = "b9e10000-3333-4000-8000-000000000001";
const AG2 = "b9e10000-3333-4000-8000-000000000002";

const salvar = (
  ator: string,
  pac: string,
  alergias: string | null,
  alertas: string | null,
  versao: number,
) =>
  como(
    ator,
    `select public.fn_clinic_cabecalho_salvar('${ORG}', '${pac}', ${alergias ? `'${alergias}'` : "null"}, ${alertas ? `'${alertas}'` : "null"}, ${versao});`,
  );
const iniciar = (ag: string) =>
  json<{ id: string; criado: boolean }>(
    sql(como(PROF, `select public.fn_clinic_iniciar_atendimento('${ORG}', '${ag}');`)),
  );
const anular = (at: string, motivo: string | null) =>
  como(
    PROF,
    `select public.fn_clinic_anular_atendimento('${ORG}', '${at}', ${motivo ? `'${motivo}'` : "null"});`,
  );

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'cab-adm@invariant.test'), ('${RECEP}', 'cab-recep@invariant.test'),
      ('${PROF}', 'cab-prof@invariant.test'), ('${PROF_B}', 'cab-prof-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'cab-inv-a', 'Cabeçalho Invariant A', 'Cabeçalho A', '{"clinic":{"prontuario":true}}'::jsonb),
      ('${ORG_B}', 'cab-inv-b', 'Cabeçalho Invariant B', 'Cabeçalho B', '{"clinic":{"prontuario":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${RECEP}', '${ORG}', 'agent', now()),
      ('${PROF}', '${ORG}', 'agent', now()), ('${PROF_B}', '${ORG_B}', 'agent', now())
      on conflict do nothing;
    insert into public.clinic_professionals (organization_id, user_id, display_name) values
      ('${ORG}', '${PROF}', 'Profissional A'), ('${ORG_B}', '${PROF_B}', 'Profissional B')
      on conflict do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PAC}', '${ORG}', 'Paciente Cabeçalho A', '+5511990001001'), ('${PAC_B}', '${ORG_B}', 'Paciente Cabeçalho B', '+5511990001002')
      on conflict (id) do nothing;
    insert into public.calendar_appointments (id, organization_id, title, starts_at, ends_at, owner_user_id, contact_id, status) values
      ('${AG}', '${ORG}', 'Consulta', now() - interval '1 hour', now(), '${PROF}', '${PAC}', 'confirmed'),
      ('${AG2}', '${ORG}', 'Retorno', now() - interval '30 minutes', now(), '${PROF}', '${PAC}', 'confirmed')
      on conflict (id) do nothing;
  `);
});

describe("cabeçalho clínico", () => {
  it("recepção não edita; paciente de outra empresa recusado; conflito de versão", () => {
    expect(erro(salvar(RECEP, PAC, "Dipirona", null, 0))).toMatch(/acesso_proibido/);
    expect(erro(salvar(PROF, PAC_B, "Dipirona", null, 0))).toMatch(/cabecalho_paciente_invalido/);
    expect(json<{ versao: number }>(sql(salvar(PROF, PAC, "Dipirona", null, 0))).versao).toBe(1);
    expect(erro(salvar(PROF, PAC, "Outra aba", null, 0))).toMatch(/registro_conflito/);
    sql(salvar(PROF, PAC, "Dipirona, látex", "Usa anticoagulante", 1));
  });

  it("toda mudança fica no histórico, append-only", () => {
    expect(
      sql(`select campo || ':' || coalesce(valor_anterior, '-') || '>' || coalesce(valor_novo, '-')
             from public.clinic_prontuario_alteracoes where contact_id = '${PAC}' order by created_at, campo;`).split(
        "\n",
      ),
    ).toEqual([
      "alergias:->Dipirona",
      "alergias:Dipirona>Dipirona, látex",
      "alertas:->Usa anticoagulante",
    ]);
    expect(
      erro(
        `set role service_role; delete from public.clinic_prontuario_alteracoes where contact_id = '${PAC}';`,
      ),
    ).toMatch(/permission denied/);
  });

  it("profissional lê; admin sem papel clínico e recepção leem 0; outra empresa lê 0", () => {
    const contar = (ator: string) =>
      ultima(
        sql(
          como(
            ator,
            `select count(*) from public.clinic_prontuarios where organization_id = '${ORG}';`,
          ),
        ),
      );
    expect(contar(PROF)).toBe("1");
    expect(contar(ADM)).toBe("0");
    expect(contar(RECEP)).toBe("0");
    expect(contar(PROF_B)).toBe("0");
  });
});

describe("anular atendimento", () => {
  it("sem motivo recusado; anula, visita volta a pronto; o agendamento pode ser iniciado de novo", () => {
    const at = iniciar(AG).id;
    expect(erro(anular(at, null))).toMatch(/atendimento_sem_motivo/);
    sql(anular(at, "Paciente errado"));
    expect(ultima(sql(`select status from public.clinic_atendimentos where id = '${at}';`))).toBe(
      "anulado",
    );
    expect(
      ultima(
        sql(`select status from public.clinic_appointment_visits where appointment_id = '${AG}';`),
      ),
    ).toBe("pronto");
    // 9027: a trilha da visita (que a recepção lê) leva motivo fixo, não o texto livre.
    expect(
      ultima(
        sql(
          `select reason from public.clinic_appointment_visit_events where appointment_id = '${AG}' order by created_at desc limit 1;`,
        ),
      ),
    ).toBe("Atendimento anulado");
    expect(
      ultima(
        sql(
          `select tipo || ':' || motivo from public.clinic_atendimento_eventos where atendimento_id = '${at}' order by created_at desc limit 1;`,
        ),
      ),
    ).toBe("anulado:Paciente errado");
    const novo = iniciar(AG);
    expect(novo.criado).toBe(true);
    expect(novo.id).not.toBe(at);
  });

  it("com registro clínico, não anula", () => {
    const at = iniciar(AG2).id;
    sql(
      como(
        PROF,
        `select public.fn_clinic_salvar_evolucao('${ORG}', '${at}', 'Evolução de teste.', null, null, null, null, 0);`,
      ),
    );
    expect(erro(anular(at, "Tentativa"))).toMatch(/atendimento_com_registros/);
  });

  it("anon não executa", () => {
    for (const f of [
      `public.fn_clinic_cabecalho_salvar('${ORG}', '${PAC}', 'x', null, 0)`,
      `public.fn_clinic_anular_atendimento('${ORG}', '${PAC}', 'xxx')`,
    ]) {
      expect(erro(`set role anon; select ${f};`)).toMatch(/permission denied/);
    }
  });
});
