/**
 * clinic (fork, estoque E3) — migration 9031: kit por procedimento e reservas.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. kit: só quem gerencia procedimentos grava; produto/procedimento de outra
 *      empresa recusado; ninguém escreve direto;
 *   2. véspera (cron): agendamento ligado a sessão de plano reserva o kit;
 *      disponível = saldo − reservas; agendamento cancelado expira a reserva;
 *   3. iniciar o atendimento converte a reserva do agendamento e reserva o kit
 *      da sessão; registrar procedimento troca pela soma dos kits; anular o
 *      procedimento volta ao kit da sessão; finalizar converte; anular o
 *      atendimento libera;
 *   4. disponibilidade: quem registra atendimento lê, outra empresa não;
 *   5. isolamento; anon não executa.
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

const ORG = "e8000000-0000-4000-8000-00000000000a";
const ORG_B = "e8000000-0000-4000-8000-00000000000b";
const ADM = "e8000000-1111-4000-8000-0000000000a1";
const PROF = "e8000000-1111-4000-8000-0000000000a2";
const ADM_B = "e8000000-1111-4000-8000-0000000000b1";
const PAC = "e8000000-3333-4000-8000-00000000000a";
const AG = "e8000000-4444-4000-8000-000000000001"; // amanhã, sessão do plano
const AG_CANC = "e8000000-4444-4000-8000-000000000002"; // amanhã, depois cancelado
const AG_ANUL = "e8000000-4444-4000-8000-000000000003"; // agora, atendimento anulado
const PLANO = "e8000000-5555-4000-8000-00000000000a";
const PROC_A = "e8000000-6666-4000-8000-00000000000a";
const PROC_B = "e8000000-6666-4000-8000-00000000000b";
const PROC_DE_B = "e8000000-6666-4000-8000-0000000000bb";
const TOX = "e8000000-2222-4000-8000-000000000001";
const GAZE = "e8000000-2222-4000-8000-000000000002";
const PROD_DE_B = "e8000000-2222-4000-8000-0000000000bb";

const fn = (ator: string, nome: string, args: string) => como(ator, `select public.${nome}(${args});`);
const dados = (o: unknown) => `'${JSON.stringify(o)}'::jsonb`;
const cron = () => json<{ reservadas: number; expiradas: number }>(sql(`set role service_role; select public.fn_clinic_estoque_reservar_agenda();`));
const reservas = (filtro: string) =>
  sql(`select r.product_id || ':' || r.quantidade::numeric(14,0) || ':' || r.status
         from public.clinic_estoque_reservas r where r.organization_id = '${ORG}' and ${filtro}
        order by r.created_at, r.product_id;`)
    .split("\n")
    .filter(Boolean);
const disponivel = (ator: string, produto: string) => {
  const lista = json<Array<{ product_id: string; disponivel: number; lote: string | null }>>(
    sql(fn(ator, "fn_clinic_estoque_disponibilidade", `'${ORG}'`)),
  );
  return lista.find((x) => x.product_id === produto);
};

let atendimento = "";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'kit-adm@invariant.test'), ('${PROF}', 'kit-prof@invariant.test'), ('${ADM_B}', 'kit-adm-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'kit-inv-a', 'Kit Invariant A', 'Kit A', '{"clinic":{"prontuario":true}}'::jsonb),
      ('${ORG_B}', 'kit-inv-b', 'Kit Invariant B', 'Kit B', '{"clinic":{"estoque":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${PROF}', '${ORG}', 'agent', now()), ('${ADM_B}', '${ORG_B}', 'admin', now())
      on conflict do nothing;
    insert into public.clinic_professionals (organization_id, user_id, display_name) values
      ('${ORG}', '${PROF}', 'Profissional fictício') on conflict do nothing;
    insert into public.catalog_products (id, organization_id, codigo, nome, preco_cents) values
      ('${TOX}', '${ORG}', 'K-TOX', 'Toxina fictícia', 0), ('${GAZE}', '${ORG}', 'K-GAZE', 'Gaze fictícia', 0),
      ('${PROD_DE_B}', '${ORG_B}', 'K-B', 'Produto de B', 0)
      on conflict (id) do nothing;
    insert into public.clinic_procedures (id, organization_id, name, short_description) values
      ('${PROC_A}', '${ORG}', 'Toxina fictícia (kit)', 'Aplicação fictícia'),
      ('${PROC_B}', '${ORG}', 'Toxina dose alta (kit)', 'Aplicação fictícia'),
      ('${PROC_DE_B}', '${ORG_B}', 'Procedimento de B', 'Fictício')
      on conflict (id) do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PAC}', '${ORG}', 'Paciente Kit', '+5511990000801') on conflict (id) do nothing;
    insert into public.calendar_appointments (id, organization_id, title, starts_at, ends_at, owner_user_id, contact_id, status) values
      ('${AG}', '${ORG}', 'Sessão 1', now() + interval '20 hours', now() + interval '21 hours', '${PROF}', '${PAC}', 'confirmed'),
      ('${AG_CANC}', '${ORG}', 'Sessão 2', now() + interval '22 hours', now() + interval '23 hours', '${PROF}', '${PAC}', 'confirmed'),
      ('${AG_ANUL}', '${ORG}', 'Sessão 3', now() - interval '10 minutes', now() + interval '50 minutes', '${PROF}', '${PAC}', 'confirmed')
      on conflict (id) do nothing;
    insert into public.clinic_planos_tratamento (id, organization_id, contact_id, titulo) values
      ('${PLANO}', '${ORG}', '${PAC}', 'Plano fictício') on conflict (id) do nothing;
    insert into public.clinic_plano_sessoes (organization_id, plano_id, numero, descricao, procedure_id, status, appointment_id) values
      ('${ORG}', '${PLANO}', 1, 'Sessão 1', '${PROC_A}', 'agendada', '${AG}'),
      ('${ORG}', '${PLANO}', 2, 'Sessão 2', '${PROC_A}', 'agendada', '${AG_CANC}'),
      ('${ORG}', '${PLANO}', 3, 'Sessão 3', '${PROC_A}', 'agendada', '${AG_ANUL}');
  `);
  sql(fn(ADM, "fn_clinic_definir_estoque", `'${ORG}', true`));
  sql(fn(ADM, "fn_clinic_estoque_produto_salvar", `'${ORG}', '${TOX}', ${dados({ unidade_estoque: "frasco", unidade_aplicacao: "U", fator_conversao: 100 })}, null`));
  sql(fn(ADM, "fn_clinic_estoque_produto_salvar", `'${ORG}', '${GAZE}', ${dados({})}, null`));
  const local = ultima(sql(`select id from public.clinic_estoque_locais where organization_id = '${ORG}' and padrao;`));
  sql(fn(ADM, "fn_clinic_estoque_entrada", `'${ORG}', ${dados({ product_id: TOX, local_id: local, quantidade: 1, em_unidade_estoque: true, lote: "K1", validade: "2099-12-31" })}`));
  sql(fn(ADM, "fn_clinic_estoque_entrada", `'${ORG}', ${dados({ product_id: GAZE, local_id: local, quantidade: 10 })}`));
});

describe("kit", () => {
  it("só quem gerencia procedimentos grava; outra empresa recusada", () => {
    expect(erro(fn(PROF, "fn_clinic_estoque_kit_salvar", `'${ORG}', '${PROC_A}', ${dados([{ product_id: TOX, quantidade: 20 }])}`))).toMatch(
      /acesso_proibido/,
    );
    expect(erro(fn(ADM, "fn_clinic_estoque_kit_salvar", `'${ORG}', '${PROC_DE_B}', ${dados([{ product_id: TOX, quantidade: 20 }])}`))).toMatch(
      /estoque_procedimento_invalido/,
    );
    expect(erro(fn(ADM, "fn_clinic_estoque_kit_salvar", `'${ORG}', '${PROC_A}', ${dados([{ product_id: PROD_DE_B, quantidade: 1 }])}`))).toMatch(
      /estoque_produto_invalido/,
    );
    expect(
      erro(fn(ADM, "fn_clinic_estoque_kit_salvar", `'${ORG}', '${PROC_A}', ${dados([{ product_id: TOX, quantidade: 1 }, { product_id: TOX, quantidade: 2 }])}`)),
    ).toMatch(/estoque_dados_invalidos/);
    sql(fn(ADM, "fn_clinic_estoque_kit_salvar", `'${ORG}', '${PROC_A}', ${dados([{ product_id: TOX, quantidade: 20 }, { product_id: GAZE, quantidade: 2 }])}`));
    sql(fn(ADM, "fn_clinic_estoque_kit_salvar", `'${ORG}', '${PROC_B}', ${dados([{ product_id: TOX, quantidade: 50 }])}`));
    expect(ultima(sql(como(PROF, `select count(*) from public.clinic_procedimento_kits where organization_id = '${ORG}';`)))).toBe("3");
    expect(ultima(sql(como(ADM_B, `select count(*) from public.clinic_procedimento_kits;`)))).toBe("0");
    expect(
      erro(como(ADM, `insert into public.clinic_procedimento_kits (organization_id, procedure_id, product_id, quantidade) values ('${ORG}', '${PROC_A}', '${TOX}', 1);`)),
    ).toMatch(/permission denied/);
  });
});

describe("reservas", () => {
  it("véspera: o cron reserva o kit da sessão; disponível desconta; cancelado expira", () => {
    expect(disponivel(PROF, TOX)?.disponivel).toBe(100);
    const r = cron();
    expect(r.reservadas).toBe(4);
    expect(reservas(`r.appointment_id = '${AG}' and r.status = 'ativa'`)).toEqual([`${TOX}:20:ativa`, `${GAZE}:2:ativa`].sort());
    expect(disponivel(PROF, TOX)?.disponivel).toBe(60); // 100 − 20 (AG) − 20 (AG_CANC); AG_ANUL já começou
    expect(disponivel(PROF, TOX)?.lote).toBe("K1");
    sql(`update public.calendar_appointments set status = 'cancelled', cancelled_at = now() where id = '${AG_CANC}';`);
    expect(cron().expiradas).toBe(2);
    expect(reservas(`r.appointment_id = '${AG_CANC}'`).every((x) => x.endsWith(":expirada"))).toBe(true);
    expect(disponivel(PROF, TOX)?.disponivel).toBe(80);
    // de novo não duplica
    cron();
    expect(reservas(`r.appointment_id = '${AG}' and r.status = 'ativa'`)).toHaveLength(2);
  });

  it("iniciar converte a da véspera e reserva o kit da sessão no atendimento", () => {
    atendimento = json<{ id: string }>(sql(como(PROF, `select public.fn_clinic_iniciar_atendimento('${ORG}', '${AG}');`))).id;
    expect(reservas(`r.appointment_id = '${AG}' and r.atendimento_id is null`).every((x) => x.endsWith(":convertida"))).toBe(true);
    expect(reservas(`r.atendimento_id = '${atendimento}' and r.status = 'ativa'`).sort()).toEqual([`${TOX}:20:ativa`, `${GAZE}:2:ativa`].sort());
    expect(disponivel(PROF, TOX)?.disponivel).toBe(80);
  });

  it("registrar procedimento troca pela soma dos kits; anular volta ao kit da sessão", () => {
    const p = json<{ id: string }>(
      sql(
        como(
          PROF,
          `select public.fn_clinic_procedimento_salvar('${ORG}', '${atendimento}', null, '${JSON.stringify({ descricao: "Dose alta", procedure_id: PROC_B })}'::jsonb, '[]'::jsonb, 0);`,
        ),
      ),
    ).id;
    expect(reservas(`r.atendimento_id = '${atendimento}' and r.status = 'ativa'`)).toEqual([`${TOX}:50:ativa`]);
    expect(disponivel(PROF, TOX)?.disponivel).toBe(50);
    sql(como(PROF, `select public.fn_clinic_procedimento_anular('${ORG}', '${p}', 'Lançado errado');`));
    expect(reservas(`r.atendimento_id = '${atendimento}' and r.status = 'ativa'`).sort()).toEqual([`${TOX}:20:ativa`, `${GAZE}:2:ativa`].sort());
  });

  it("finalizar converte as reservas", () => {
    sql(
      como(
        PROF,
        `select public.fn_clinic_procedimento_salvar('${ORG}', '${atendimento}', null, '${JSON.stringify({ descricao: "Toxina", procedure_id: PROC_A })}'::jsonb, '[]'::jsonb, 0);`,
      ),
    );
    sql(como(PROF, `select public.fn_clinic_salvar_evolucao('${ORG}', '${atendimento}', 'Sem intercorrências.', null, null, null, null, 0);`));
    sql(como(PROF, `select public.fn_clinic_finalizar_atendimento('${ORG}', '${atendimento}');`));
    expect(reservas(`r.atendimento_id = '${atendimento}' and r.status = 'ativa'`)).toEqual([]);
    expect(reservas(`r.atendimento_id = '${atendimento}' and r.status = 'convertida'`).sort()).toEqual(
      [`${TOX}:20:convertida`, `${GAZE}:2:convertida`].sort(),
    );
    expect(disponivel(PROF, TOX)?.disponivel).toBe(100);
  });

  it("anular o atendimento libera as reservas", () => {
    const at = json<{ id: string }>(sql(como(PROF, `select public.fn_clinic_iniciar_atendimento('${ORG}', '${AG_ANUL}');`))).id;
    expect(reservas(`r.atendimento_id = '${at}' and r.status = 'ativa'`)).toHaveLength(2);
    sql(como(PROF, `select public.fn_clinic_anular_atendimento('${ORG}', '${at}', 'Aberto no paciente errado');`));
    expect(reservas(`r.atendimento_id = '${at}'`).every((x) => x.endsWith(":liberada"))).toBe(true);
  });
});

describe("leitura e isolamento", () => {
  it("disponibilidade: outra empresa recusada; reservas de A invisíveis para B; ninguém escreve direto", () => {
    expect(erro(fn(ADM_B, "fn_clinic_estoque_disponibilidade", `'${ORG}'`))).toMatch(/acesso_proibido/);
    expect(ultima(sql(como(ADM_B, `select count(*) from public.clinic_estoque_reservas;`)))).toBe("0");
    expect(
      erro(como(ADM, `insert into public.clinic_estoque_reservas (organization_id, appointment_id, product_id, quantidade) values ('${ORG}', '${AG}', '${TOX}', 1);`)),
    ).toMatch(/permission denied/);
  });

  it("a véspera só pelo service role; anon não executa", () => {
    expect(erro(fn(ADM, "fn_clinic_estoque_reservar_agenda", ""))).toMatch(/permission denied/);
    expect(
      ultima(
        sql(`select bool_or(has_function_privilege('anon', p.oid, 'execute'))
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public'
                and p.proname in ('fn_clinic_estoque_kit_salvar', 'fn_clinic_estoque_disponibilidade',
                                  'fn_clinic_estoque_reservar_agenda', 'fn_clinic_estoque_reservar_atendimento');`),
      ),
    ).toBe("f");
  });
});
