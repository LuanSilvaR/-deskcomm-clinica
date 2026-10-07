/**
 * clinic (fork, estoque E4) — migration 9032: frascos abertos e fracionamento.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. abrir frasco não muda o saldo do lote/local; só produto fracionável; só
 *      quem movimenta o estoque;
 *   2. ninguém tira do lacrado o que está num frasco (conferência por gaveta);
 *   3. a baixa pelo prontuário usa primeiro o frasco aberto e, acabando, abre
 *      outro sozinho;
 *   4. frasco vencido sai da baixa (vira pendência) e aparece como vencido;
 *      encerrar registra a sobra como perda, com motivo, uma vez só;
 *   5. isolamento; ninguém escreve direto.
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

const ORG = "e9000000-0000-4000-8000-00000000000a";
const ORG_B = "e9000000-0000-4000-8000-00000000000b";
const ADM = "e9000000-1111-4000-8000-0000000000a1";
const PROF = "e9000000-1111-4000-8000-0000000000a2";
const ADM_B = "e9000000-1111-4000-8000-0000000000b1";
const PAC = "e9000000-3333-4000-8000-00000000000a";
const AG1 = "e9000000-4444-4000-8000-000000000001";
const AG2 = "e9000000-4444-4000-8000-000000000002";
const TOX = "e9000000-2222-4000-8000-000000000001";
const GAZE = "e9000000-2222-4000-8000-000000000002";

const fn = (ator: string, nome: string, args: string) => como(ator, `select public.${nome}(${args});`);
const dados = (o: unknown) => `'${JSON.stringify(o)}'::jsonb`;
const baixar = (proc: string) =>
  json<{ baixados: number; pendencias: number }>(
    sql(`set role service_role; select public.fn_clinic_estoque_baixar_procedimento('${ORG}', '${proc}');`),
  );
const saldoTox = () =>
  ultima(sql(`select coalesce(sum(quantidade), 0) from public.clinic_estoque_movimentos where organization_id = '${ORG}' and product_id = '${TOX}';`));
const lacrado = () =>
  ultima(
    sql(`select coalesce(sum(quantidade), 0) from public.clinic_estoque_movimentos
          where organization_id = '${ORG}' and product_id = '${TOX}' and frasco_id is null;`),
  );
const frascos = () =>
  sql(`select conteudo::numeric(14,0) || ':' || vencido from public.clinic_estoque_frascos_abertos
        where organization_id = '${ORG}' order by aberto_em, id;`)
    .split("\n")
    .filter(Boolean);

let local = "";
let lote = "";
let frasco1 = "";

function atendimentoCom(ag: string, quantidades: number[]): string[] {
  const at = json<{ id: string }>(sql(como(PROF, `select public.fn_clinic_iniciar_atendimento('${ORG}', '${ag}');`))).id;
  const procs = quantidades.map(
    (q) =>
      json<{ id: string }>(
        sql(
          como(
            PROF,
            `select public.fn_clinic_procedimento_salvar('${ORG}', '${at}', null, '${JSON.stringify({ descricao: "Toxina" })}'::jsonb, '${JSON.stringify([{ descricao: "Toxina", quantidade: q, unidade: "U", product_id: TOX }])}'::jsonb, 0);`,
          ),
        ),
      ).id,
  );
  sql(como(PROF, `select public.fn_clinic_salvar_evolucao('${ORG}', '${at}', 'Sem intercorrências.', null, null, null, null, 0);`));
  sql(como(PROF, `select public.fn_clinic_finalizar_atendimento('${ORG}', '${at}');`));
  return procs;
}

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'fr-adm@invariant.test'), ('${PROF}', 'fr-prof@invariant.test'), ('${ADM_B}', 'fr-adm-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'fr-inv-a', 'Frascos Invariant A', 'Frascos A', '{"clinic":{"prontuario":true}}'::jsonb),
      ('${ORG_B}', 'fr-inv-b', 'Frascos Invariant B', 'Frascos B', '{"clinic":{"estoque":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${PROF}', '${ORG}', 'agent', now()), ('${ADM_B}', '${ORG_B}', 'admin', now())
      on conflict do nothing;
    insert into public.clinic_professionals (organization_id, user_id, display_name) values
      ('${ORG}', '${PROF}', 'Profissional fictício') on conflict do nothing;
    insert into public.catalog_products (id, organization_id, codigo, nome, preco_cents) values
      ('${TOX}', '${ORG}', 'FR-TOX', 'Toxina fictícia', 0), ('${GAZE}', '${ORG}', 'FR-GAZE', 'Gaze fictícia', 0)
      on conflict (id) do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PAC}', '${ORG}', 'Paciente Frasco', '+5511990000901') on conflict (id) do nothing;
    insert into public.calendar_appointments (id, organization_id, title, starts_at, ends_at, owner_user_id, contact_id, status) values
      ('${AG1}', '${ORG}', 'Toxina 1', now() - interval '1 hour', now(), '${PROF}', '${PAC}', 'confirmed'),
      ('${AG2}', '${ORG}', 'Toxina 2', now() - interval '30 minutes', now() + interval '30 minutes', '${PROF}', '${PAC}', 'confirmed')
      on conflict (id) do nothing;
  `);
  sql(fn(ADM, "fn_clinic_definir_estoque", `'${ORG}', true`));
  local = ultima(sql(`select id from public.clinic_estoque_locais where organization_id = '${ORG}' and padrao;`));
  sql(
    fn(
      ADM,
      "fn_clinic_estoque_produto_salvar",
      `'${ORG}', '${TOX}', ${dados({ unidade_estoque: "frasco", unidade_aplicacao: "U", fator_conversao: 100, fracionavel: true, validade_pos_abertura_horas: 24 })}, null`,
    ),
  );
  sql(fn(ADM, "fn_clinic_estoque_produto_salvar", `'${ORG}', '${GAZE}', ${dados({})}, null`));
  lote = json<{ lote_id: string }>(
    sql(fn(ADM, "fn_clinic_estoque_entrada", `'${ORG}', ${dados({ product_id: TOX, local_id: local, quantidade: 2, em_unidade_estoque: true, lote: "FR1", validade: "2099-12-31" })}`)),
  ).lote_id;
  sql(fn(ADM, "fn_clinic_estoque_entrada", `'${ORG}', ${dados({ product_id: GAZE, local_id: local, quantidade: 10 })}`));
});

describe("abrir frasco", () => {
  it("só fracionável e só quem movimenta; o saldo não muda", () => {
    expect(erro(fn(PROF, "fn_clinic_estoque_frasco_abrir", `'${ORG}', ${dados({ lote_id: lote, local_id: local })}`))).toMatch(/acesso_proibido/);
    const loteGaze = ultima(sql(`select id from public.clinic_estoque_lotes where product_id = '${GAZE}';`));
    expect(erro(fn(ADM, "fn_clinic_estoque_frasco_abrir", `'${ORG}', ${dados({ lote_id: loteGaze, local_id: local })}`))).toMatch(
      /estoque_nao_fracionavel/,
    );
    frasco1 = json<{ frasco_id: string }>(sql(fn(ADM, "fn_clinic_estoque_frasco_abrir", `'${ORG}', ${dados({ lote_id: lote, local_id: local })}`))).frasco_id;
    expect(saldoTox()).toBe("200.000");
    expect(lacrado()).toBe("100.000");
    expect(frascos()).toEqual(["100:false"]);
    expect(
      ultima(sql(`select (vence_em between now() + interval '23 hours' and now() + interval '25 hours') from public.clinic_estoque_frascos where id = '${frasco1}';`)),
    ).toBe("t");
  });

  it("perda do lacrado não come o que está no frasco", () => {
    expect(
      erro(fn(ADM, "fn_clinic_estoque_perda", `'${ORG}', ${dados({ lote_id: lote, local_id: local, quantidade: 150, motivo: "Teste de gaveta" })}`)),
    ).toMatch(/estoque_insuficiente/);
    expect(saldoTox()).toBe("200.000");
  });
});

describe("baixa pelo prontuário", () => {
  it("usa o frasco aberto primeiro e, acabando, abre outro sozinho", () => {
    const [p1, p2] = atendimentoCom(AG1, [30, 120]);
    expect(baixar(p1!).baixados).toBe(1);
    expect(frascos()).toEqual(["70:false"]);
    expect(lacrado()).toBe("100.000");
    expect(baixar(p2!).baixados).toBe(1);
    expect(frascos()).toEqual(["0:false", "50:false"]);
    expect(lacrado()).toBe("0.000");
    expect(saldoTox()).toBe("50.000");
    // o catálogo (E1) acompanha: 50 U = 0 frasco
    expect(ultima(sql(`select quantidade from public.catalog_products where id = '${TOX}';`))).toBe("0");
  });

  it("frasco vencido não entra na baixa (vira pendência) e aparece vencido", () => {
    sql(`update public.clinic_estoque_frascos set vence_em = now() - interval '1 minute'
          where organization_id = '${ORG}' and id <> '${frasco1}' and status = 'aberto';`);
    const [p3] = atendimentoCom(AG2, [10]);
    expect(baixar(p3!)).toMatchObject({ baixados: 0, pendencias: 1 });
    expect(frascos()).toEqual(["0:false", "50:true"]);
  });
});

describe("encerrar", () => {
  it("a sobra vira perda com motivo, uma vez só", () => {
    const vencido = ultima(sql(`select id from public.clinic_estoque_frascos_abertos where organization_id = '${ORG}' and vencido;`));
    expect(erro(fn(ADM, "fn_clinic_estoque_frasco_encerrar", `'${ORG}', '${vencido}', null`))).toMatch(/estoque_sem_motivo/);
    expect(json<{ perda: number }>(sql(fn(ADM, "fn_clinic_estoque_frasco_encerrar", `'${ORG}', '${vencido}', 'Frasco vencido'`))).perda).toBe(50);
    expect(saldoTox()).toBe("0.000");
    expect(erro(fn(ADM, "fn_clinic_estoque_frasco_encerrar", `'${ORG}', '${vencido}', 'De novo'`))).toMatch(/estoque_frasco_encerrado/);
    sql(fn(ADM, "fn_clinic_estoque_frasco_encerrar", `'${ORG}', '${frasco1}', 'Frasco vazio'`));
    expect(frascos()).toEqual([]);
  });
});

describe("isolamento", () => {
  it("outra empresa não vê nem abre; ninguém escreve direto", () => {
    expect(ultima(sql(como(ADM_B, `select count(*) from public.clinic_estoque_frascos;`)))).toBe("0");
    expect(ultima(sql(como(ADM_B, `select count(*) from public.clinic_estoque_frascos_abertos;`)))).toBe("0");
    expect(erro(fn(ADM_B, "fn_clinic_estoque_frasco_abrir", `'${ORG_B}', ${dados({ lote_id: lote, local_id: local })}`))).toMatch(
      /estoque_lote_invalido/,
    );
    expect(erro(fn(ADM_B, "fn_clinic_estoque_frasco_encerrar", `'${ORG_B}', '${frasco1}', 'Tentativa'`))).toMatch(/estoque_frasco_invalido/);
    expect(
      erro(como(ADM, `insert into public.clinic_estoque_frascos (organization_id, product_id, lote_id, local_id) values ('${ORG}', '${TOX}', '${lote}', '${local}');`)),
    ).toMatch(/permission denied/);
  });
});
