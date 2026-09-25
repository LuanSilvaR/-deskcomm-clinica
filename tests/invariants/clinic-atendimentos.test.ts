/**
 * clinic (fork, prontuário F1) — migration 9017: o atendimento clínico.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. opção `prontuario` desligada: ninguém inicia;
 *   2. ligada: recepcionista e admin sem cadastro de profissional são recusados;
 *      profissional inicia, a visita vira `em_atendimento`, um evento é gravado;
 *      iniciar de novo devolve o mesmo atendimento (idempotente);
 *   3. agendamento de outra empresa, sem paciente ou cancelado é recusado;
 *   4. leitura: só quem tem `prontuario.ver` enxerga — admin sem papel clínico e
 *      recepção leem 0 linhas; outra empresa lê 0 linhas;
 *   5. ninguém escreve direto; eventos são append-only;
 *   6. finalizar: exige a permissão, grava status/horário/quem e evento;
 *      repetir não duplica; iniciar de novo um finalizado é recusado;
 *   7. anon não executa as funções.
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

const ORG = "a7e10000-0000-4000-8000-00000000000a";
const ORG_B = "a7e10000-0000-4000-8000-00000000000b";
const ADM = "a7e10000-1111-4000-8000-0000000000a1";
const RECEP = "a7e10000-1111-4000-8000-0000000000a2";
const PROF = "a7e10000-1111-4000-8000-0000000000a3";
const PROF_B = "a7e10000-1111-4000-8000-0000000000b1";
const PAC = "a7e10000-2222-4000-8000-00000000000a";
const PAC_B = "a7e10000-2222-4000-8000-00000000000b";
const AG = "a7e10000-3333-4000-8000-000000000001";
const AG_SEM_PACIENTE = "a7e10000-3333-4000-8000-000000000002";
const AG_CANCELADO = "a7e10000-3333-4000-8000-000000000003";
const AG_B = "a7e10000-3333-4000-8000-0000000000b1";

const iniciar = (ator: string, ag: string, org = ORG) =>
  como(ator, `select public.fn_clinic_iniciar_atendimento('${org}', '${ag}');`);
const flag = (org: string, v: boolean) =>
  sql(`update public.organizations set settings = jsonb_set(coalesce(settings,'{}'::jsonb), '{clinic}',
         coalesce(settings->'clinic','{}'::jsonb) || jsonb_build_object('prontuario', ${v}), true) where id = '${org}';`);
const contarComo = (ator: string, tabela: string, org = ORG) =>
  ultima(sql(como(ator, `select count(*) from public.${tabela} where organization_id = '${org}';`)));

let atendimentoId = "";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'atend-adm@invariant.test'), ('${RECEP}', 'atend-recep@invariant.test'),
      ('${PROF}', 'atend-prof@invariant.test'), ('${PROF_B}', 'atend-prof-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name) values
      ('${ORG}', 'atend-inv-a', 'Atendimento Invariant A', 'Atendimento A'),
      ('${ORG_B}', 'atend-inv-b', 'Atendimento Invariant B', 'Atendimento B')
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${RECEP}', '${ORG}', 'agent', now()),
      ('${PROF}', '${ORG}', 'agent', now()), ('${PROF_B}', '${ORG_B}', 'agent', now())
      on conflict do nothing;
    insert into public.clinic_professionals (organization_id, user_id, display_name) values
      ('${ORG}', '${PROF}', 'Profissional A'), ('${ORG_B}', '${PROF_B}', 'Profissional B')
      on conflict do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PAC}', '${ORG}', 'Paciente Atendimento A', '+5511990000201'),
      ('${PAC_B}', '${ORG_B}', 'Paciente Atendimento B', '+5511990000202')
      on conflict (id) do nothing;
    insert into public.calendar_appointments (id, organization_id, title, starts_at, ends_at, owner_user_id, contact_id, status, cancelled_at) values
      ('${AG}', '${ORG}', 'Avaliação', now() - interval '1 hour', now(), '${PROF}', '${PAC}', 'confirmed', null),
      ('${AG_SEM_PACIENTE}', '${ORG}', 'Reunião interna', now(), now() + interval '1 hour', '${PROF}', null, 'confirmed', null),
      ('${AG_CANCELADO}', '${ORG}', 'Cancelado', now(), now() + interval '1 hour', '${PROF}', '${PAC}', 'cancelled', now()),
      ('${AG_B}', '${ORG_B}', 'Consulta B', now(), now() + interval '1 hour', '${PROF_B}', '${PAC_B}', 'confirmed', null)
      on conflict (id) do nothing;
  `);
});

describe("iniciar", () => {
  it("com a opção prontuario desligada ninguém inicia", () => {
    expect(erro(iniciar(PROF, AG))).toMatch(/prontuario_desligado/);
  });

  it("ligada: recepcionista e admin sem cadastro de profissional são recusados (sem chave clínica)", () => {
    flag(ORG, true);
    flag(ORG_B, true);
    expect(erro(iniciar(RECEP, AG))).toMatch(/acesso_proibido/);
    expect(erro(iniciar(ADM, AG))).toMatch(/acesso_proibido/);
  });

  it("profissional inicia: atendimento em andamento, visita em atendimento, evento gravado", () => {
    const r = JSON.parse(ultima(sql(iniciar(PROF, AG)))) as { id: string; criado: boolean };
    expect(r.criado).toBe(true);
    atendimentoId = r.id;
    expect(
      ultima(sql(`select status || '|' || contact_id || '|' || professional_user_id from public.clinic_atendimentos where id = '${r.id}';`)),
    ).toBe(`em_andamento|${PAC}|${PROF}`);
    expect(ultima(sql(`select status from public.clinic_appointment_visits where appointment_id = '${AG}';`))).toBe("em_atendimento");
    expect(ultima(sql(`select string_agg(tipo, ',') from public.clinic_atendimento_eventos where atendimento_id = '${r.id}';`))).toBe(
      "iniciado",
    );
  });

  it("iniciar de novo devolve o mesmo atendimento (idempotente)", () => {
    const r = JSON.parse(ultima(sql(iniciar(PROF, AG)))) as { id: string; criado: boolean };
    expect(r).toEqual({ id: atendimentoId, criado: false });
    expect(ultima(sql(`select count(*) from public.clinic_atendimentos where appointment_id = '${AG}';`))).toBe("1");
  });

  it("agendamento de outra empresa, sem paciente ou cancelado é recusado", () => {
    expect(erro(iniciar(PROF, AG_B))).toMatch(/atendimento_agendamento_nao_encontrado/);
    expect(erro(iniciar(PROF, AG_SEM_PACIENTE))).toMatch(/atendimento_sem_paciente/);
    expect(erro(iniciar(PROF, AG_CANCELADO))).toMatch(/atendimento_agendamento_cancelado/);
    expect(erro(iniciar(PROF, AG_B, ORG_B))).toMatch(/acesso_proibido/);
  });
});

describe("leitura e isolamento", () => {
  it("profissional lê; admin sem papel clínico e recepção leem 0 linhas", () => {
    expect(contarComo(PROF, "clinic_atendimentos")).toBe("1");
    expect(contarComo(PROF, "clinic_atendimento_eventos")).toBe("1");
    expect(contarComo(ADM, "clinic_atendimentos")).toBe("0");
    expect(contarComo(RECEP, "clinic_atendimentos")).toBe("0");
    expect(contarComo(RECEP, "clinic_atendimento_eventos")).toBe("0");
  });

  it("quem é da B lê 0 linhas da A (e vice-versa)", () => {
    sql(iniciar(PROF_B, AG_B, ORG_B));
    expect(contarComo(PROF_B, "clinic_atendimentos", ORG)).toBe("0");
    expect(contarComo(PROF, "clinic_atendimentos", ORG_B)).toBe("0");
    expect(contarComo(PROF_B, "clinic_atendimentos", ORG_B)).toBe("1");
  });

  it("ninguém escreve direto; eventos não aceitam UPDATE nem DELETE", () => {
    expect(
      erro(
        como(
          PROF,
          `insert into public.clinic_atendimentos (organization_id, contact_id, appointment_id) values ('${ORG}', '${PAC}', '${AG_CANCELADO}');`,
        ),
      ),
    ).toMatch(/permission denied/);
    expect(erro(como(PROF, `update public.clinic_atendimentos set status = 'anulado' where id = '${atendimentoId}';`))).toMatch(
      /permission denied/,
    );
    expect(erro(`set role service_role; delete from public.clinic_atendimento_eventos where atendimento_id = '${atendimentoId}';`)).toMatch(
      /permission denied/,
    );
  });

  it("FK composta: evento não aponta para atendimento de outra empresa", () => {
    expect(
      erro(
        `insert into public.clinic_atendimento_eventos (organization_id, atendimento_id, tipo, status_depois) values ('${ORG_B}', '${atendimentoId}', 'iniciado', 'em_andamento');`,
      ),
    ).toMatch(/clinic_atendimento_eventos_do_atendimento/);
  });
});

describe("finalizar", () => {
  it("recepção não finaliza", () => {
    expect(erro(como(RECEP, `select public.fn_clinic_finalizar_atendimento('${ORG}', '${atendimentoId}');`))).toMatch(/acesso_proibido/);
  });

  it("profissional finaliza: status, horário, quem e evento; repetir não duplica", () => {
    // 9019: o mínimo para finalizar é a evolução com conteúdo.
    expect(erro(como(PROF, `select public.fn_clinic_finalizar_atendimento('${ORG}', '${atendimentoId}');`))).toMatch(
      /requisitos_pendentes/,
    );
    sql(
      como(
        PROF,
        `select public.fn_clinic_salvar_evolucao('${ORG}', '${atendimentoId}', 'Boa resposta.', null, null, null, null, 0);`,
      ),
    );
    const r = JSON.parse(ultima(sql(como(PROF, `select public.fn_clinic_finalizar_atendimento('${ORG}', '${atendimentoId}');`)))) as {
      mudou: boolean;
      appointment_id: string;
    };
    expect(r.mudou).toBe(true);
    expect(r.appointment_id).toBe(AG);
    expect(
      ultima(
        sql(`select status || '|' || (finished_at is not null) || '|' || finalizado_por || '|' || versao from public.clinic_atendimentos where id = '${atendimentoId}';`),
      ),
    ).toBe(`finalizado|true|${PROF}|2`);
    const de2 = JSON.parse(ultima(sql(como(PROF, `select public.fn_clinic_finalizar_atendimento('${ORG}', '${atendimentoId}');`)))) as {
      mudou: boolean;
    };
    expect(de2.mudou).toBe(false);
    expect(ultima(sql(`select string_agg(tipo, ',' order by created_at) from public.clinic_atendimento_eventos where atendimento_id = '${atendimentoId}';`))).toBe(
      "iniciado,finalizado",
    );
  });

  it("iniciar de novo um atendimento encerrado é recusado", () => {
    expect(erro(iniciar(PROF, AG))).toMatch(/atendimento_ja_encerrado/);
  });
});

describe("privilégios", () => {
  it.each(["public.fn_clinic_iniciar_atendimento(uuid, uuid, uuid)", "public.fn_clinic_finalizar_atendimento(uuid, uuid)"])(
    "anon não executa %s",
    (fn) => {
      expect(ultima(sql(`select has_function_privilege('anon', '${fn}', 'execute');`))).toBe("f");
    },
  );
});
