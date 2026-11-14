/**
 * clinic (fork, prontuário F4) — migration 9021: conduta, plano de tratamento e
 * sessões.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. conduta: recepção não registra; autosave com versão; exigível como
 *      requisito; congelada ao finalizar (UPDATE direto recusado); aceita adendo;
 *   2. plano: só com `planos.gerenciar`; paciente de outra empresa recusado;
 *      conflito de versão;
 *   3. sessões: planejada → agendada só com agendamento do MESMO paciente; um
 *      agendamento, uma sessão; finalizar o atendimento daquele agendamento a
 *      torna REALIZADA; realizada não muda; cancelar exige motivo; o CHECK de
 *      coerência recusa "agendada sem agendamento";
 *   4. leitura: profissional lê; admin sem papel clínico e recepção leem 0;
 *      outra empresa lê 0; ninguém escreve direto; anon sem EXECUTE.
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

const ORG = "b4e10000-0000-4000-8000-00000000000a";
const ORG_B = "b4e10000-0000-4000-8000-00000000000b";
const ADM = "b4e10000-1111-4000-8000-0000000000a1";
const RECEP = "b4e10000-1111-4000-8000-0000000000a2";
const PROF = "b4e10000-1111-4000-8000-0000000000a3";
const PROF_B = "b4e10000-1111-4000-8000-0000000000b1";
const PAC = "b4e10000-2222-4000-8000-00000000000a";
const PAC_2 = "b4e10000-2222-4000-8000-00000000000c";
const PAC_B = "b4e10000-2222-4000-8000-00000000000b";
const AG = "b4e10000-3333-4000-8000-000000000001";
const AG_SESSAO = "b4e10000-3333-4000-8000-000000000002";
const AG_OUTRO = "b4e10000-3333-4000-8000-000000000003";

const conduta = (ator: string, at: string, texto: string, versao: number) =>
  como(ator, `select public.fn_clinic_salvar_conduta('${ORG}', '${at}', '${texto}', null, null, ${versao});`);
const evolucao = (at: string) =>
  como(PROF, `select public.fn_clinic_salvar_evolucao('${ORG}', '${at}', 'Evolução de teste.', null, null, null, null, 0);`);
const finalizar = (at: string) => como(PROF, `select public.fn_clinic_finalizar_atendimento('${ORG}', '${at}');`);
const salvarPlano = (ator: string, contato: string, plano: string | null, status: string, versao: number, org = ORG) =>
  como(
    ator,
    `select public.fn_clinic_plano_salvar('${org}', ${plano ? `'${plano}'` : "null"}, '${contato}', 'Plano facial', 'Uniformizar a pele', null,
       current_date, current_date + 60, null, null, '${status}', ${versao});`,
  );
const mudar = (sessao: string, acao: string, ag: string | null, motivo: string | null) =>
  como(
    PROF,
    `select public.fn_clinic_plano_sessao_mudar('${ORG}', '${sessao}', '${acao}', ${ag ? `'${ag}'` : "null"}, ${motivo ? `'${motivo}'` : "null"});`,
  );
const contar = (ator: string, tabela: string, org = ORG) =>
  ultima(sql(como(ator, `select count(*) from public.${tabela} where organization_id = '${org}';`)));

let at1 = "";
let atSessao = "";
let condutaId = "";
let plano = "";
let sessoes: string[] = [];

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'pla-adm@invariant.test'), ('${RECEP}', 'pla-recep@invariant.test'),
      ('${PROF}', 'pla-prof@invariant.test'), ('${PROF_B}', 'pla-prof-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'pla-inv-a', 'Planos Invariant A', 'Planos A', '{"clinic":{"prontuario":true}}'::jsonb),
      ('${ORG_B}', 'pla-inv-b', 'Planos Invariant B', 'Planos B', '{"clinic":{"prontuario":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${RECEP}', '${ORG}', 'agent', now()),
      ('${PROF}', '${ORG}', 'agent', now()), ('${PROF_B}', '${ORG_B}', 'agent', now())
      on conflict do nothing;
    insert into public.clinic_professionals (organization_id, user_id, display_name) values
      ('${ORG}', '${PROF}', 'Profissional A'), ('${ORG_B}', '${PROF_B}', 'Profissional B')
      on conflict do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PAC}', '${ORG}', 'Paciente Planos A', '+5511990000501'),
      ('${PAC_2}', '${ORG}', 'Outro Paciente A', '+5511990000503'),
      ('${PAC_B}', '${ORG_B}', 'Paciente Planos B', '+5511990000502')
      on conflict (id) do nothing;
    insert into public.calendar_appointments (id, organization_id, title, starts_at, ends_at, owner_user_id, contact_id, status) values
      ('${AG}', '${ORG}', 'Avaliação', now() - interval '1 hour', now(), '${PROF}', '${PAC}', 'confirmed'),
      ('${AG_SESSAO}', '${ORG}', 'Sessão 1', now() - interval '20 minutes', now() + interval '10 minutes', '${PROF}', '${PAC}', 'confirmed'),
      ('${AG_OUTRO}', '${ORG}', 'Outro', now() + interval '1 day', now() + interval '1 day 1 hour', '${PROF}', '${PAC_2}', 'confirmed')
      on conflict (id) do nothing;
  `);
  at1 = json<{ id: string }>(sql(como(PROF, `select public.fn_clinic_iniciar_atendimento('${ORG}', '${AG}');`))).id;
});

describe("conduta", () => {
  it("recepção não registra; autosave com versão", () => {
    expect(erro(conduta(RECEP, at1, "x", 0))).toMatch(/acesso_proibido/);
    const r = json<{ id: string; versao: number; criado: boolean }>(sql(conduta(PROF, at1, "Peeling em 4 sessões", 0)));
    expect(r).toMatchObject({ versao: 1, criado: true });
    condutaId = r.id;
    expect(erro(conduta(PROF, at1, "aba velha", 0))).toMatch(/registro_conflito/);
    expect(json<{ versao: number }>(sql(conduta(PROF, at1, "Peeling em 4 sessões, intervalo de 15 dias", 1))).versao).toBe(2);
  });

  it("exigível como requisito", () => {
    sql(`insert into public.clinic_requisitos_finalizacao (organization_id, secao) values ('${ORG}', 'conduta');`);
    expect(ultima(sql(`select array_to_string(public.fn_clinic_requisitos_faltando('${at1}'), ',');`))).toBe("evolucao");
    sql(conduta(PROF, at1, "", 2));
    expect(ultima(sql(`select array_to_string(public.fn_clinic_requisitos_faltando('${at1}'), ',');`))).toBe("evolucao,conduta");
    sql(conduta(PROF, at1, "Peeling em 4 sessões", 3));
  });
});

describe("plano de tratamento", () => {
  it("só com planos.gerenciar; paciente de outra empresa recusado; conflito de versão", () => {
    expect(erro(salvarPlano(RECEP, PAC, null, "ativo", 0))).toMatch(/acesso_proibido/);
    expect(erro(salvarPlano(PROF, PAC_B, null, "ativo", 0))).toMatch(/plano_paciente_invalido/);
    const r = json<{ id: string; versao: number }>(sql(salvarPlano(PROF, PAC, null, "ativo", 0)));
    plano = r.id;
    expect(json<{ versao: number }>(sql(salvarPlano(PROF, PAC, plano, "ativo", 1))).versao).toBe(2);
    expect(erro(salvarPlano(PROF, PAC, plano, "pausado", 1))).toMatch(/registro_conflito/);
    expect(erro(salvarPlano(PROF_B, PAC, plano, "ativo", 2, ORG_B))).toMatch(/plano_nao_encontrado/);
  });

  it("sessões: planejada → agendada → realizada; coerência pelo banco", () => {
    expect(
      ultima(
        sql(
          como(PROF, `select public.fn_clinic_plano_adicionar_sessoes('${ORG}', '${plano}', 'Peeling', null, null, 3, current_date, 15);`),
        ),
      ),
    ).toBe("3");
    sessoes = sql(`select id from public.clinic_plano_sessoes where plano_id = '${plano}' order by numero;`).split("\n");
    expect(ultima(sql(`select string_agg(previsao - current_date || '', ',' order by numero) from public.clinic_plano_sessoes where plano_id = '${plano}';`))).toBe(
      "0,15,30",
    );
    // Agendamento de outro paciente: recusado.
    expect(erro(mudar(sessoes[0]!, "agendar", AG_OUTRO, null))).toMatch(/plano_agendamento_invalido/);
    sql(mudar(sessoes[0]!, "agendar", AG_SESSAO, null));
    // Um agendamento, uma sessão.
    expect(erro(mudar(sessoes[1]!, "agendar", AG_SESSAO, null))).toMatch(/plano_agendamento_em_uso/);
    // Cancelar exige motivo.
    expect(erro(mudar(sessoes[2]!, "cancelar", null, null))).toMatch(/plano_sessao_sem_motivo/);
    sql(mudar(sessoes[2]!, "cancelar", null, "Paciente desistiu"));
    // CHECK: agendada sem agendamento não existe.
    expect(erro(`update public.clinic_plano_sessoes set status = 'agendada' where id = '${sessoes[1]}';`)).toMatch(
      /clinic_plano_sessoes_coerencia/,
    );

    atSessao = json<{ id: string }>(sql(como(PROF, `select public.fn_clinic_iniciar_atendimento('${ORG}', '${AG_SESSAO}');`))).id;
    sql(evolucao(atSessao));
    sql(conduta(PROF, atSessao, "Sessão 1 feita", 0));
    sql(finalizar(atSessao));
    expect(ultima(sql(`select status || ':' || (atendimento_id = '${atSessao}') from public.clinic_plano_sessoes where id = '${sessoes[0]}';`))).toBe(
      "realizada:true",
    );
    expect(erro(mudar(sessoes[0]!, "desagendar", null, null))).toMatch(/plano_sessao_encerrada/);
  });
});

describe("finalizar congela a conduta; adendo", () => {
  it("congelada; UPDATE direto recusado até como superusuário; adendo aceito", () => {
    sql(evolucao(at1));
    sql(finalizar(at1));
    expect(ultima(sql(`select status from public.clinic_condutas where id = '${condutaId}';`))).toBe("finalizado");
    expect(erro(`update public.clinic_condutas set descricao = 'reescrito' where id = '${condutaId}';`)).toMatch(/prontuario_imutavel/);
    expect(erro(conduta(PROF, at1, "depois", 4))).toMatch(/prontuario_imutavel/);
    const r = json<{ id: string }>(
      sql(
        como(
          PROF,
          `select public.fn_clinic_adicionar_adendo('${ORG}', '${at1}', 'conduta', '${condutaId}', 'Intervalo passa a 21 dias', 'Ajuste de conduta');`,
        ),
      ),
    );
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("leitura e escrita direta", () => {
  it("profissional lê; admin sem papel clínico e recepção leem 0; outra empresa lê 0", () => {
    for (const t of ["clinic_condutas", "clinic_planos_tratamento", "clinic_plano_sessoes"]) {
      expect(Number(contar(PROF, t))).toBeGreaterThan(0);
      expect(contar(ADM, t)).toBe("0");
      expect(contar(RECEP, t)).toBe("0");
      expect(contar(PROF_B, t)).toBe("0");
    }
  });

  it("ninguém escreve direto; anon não executa", () => {
    expect(
      erro(
        como(
          PROF,
          `insert into public.clinic_planos_tratamento (organization_id, contact_id, titulo) values ('${ORG}', '${PAC}', 'direto');`,
        ),
      ),
    ).toMatch(/permission denied/);
    for (const f of [
      `public.fn_clinic_salvar_conduta('${ORG}', '${at1}', 'x', null, null, 0)`,
      `public.fn_clinic_plano_salvar('${ORG}', null, '${PAC}', 'x', null, null, null, null, null, null, 'ativo', 0)`,
      `public.fn_clinic_plano_adicionar_sessoes('${ORG}', '${plano}', 'x', null, null, 1, null, 0)`,
      `public.fn_clinic_plano_sessao_mudar('${ORG}', '${plano}', 'cancelar', null, 'xxx')`,
      `public.fn_clinic_congelar_registros('${at1}')`,
    ]) {
      expect(erro(`set role anon; select ${f};`)).toMatch(/permission denied/);
    }
  });
});
