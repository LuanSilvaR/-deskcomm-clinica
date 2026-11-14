/**
 * clinic (fork, prontuário F5) — migration 9022: procedimentos realizados e
 * insumos (lote/validade) e o evento de estoque.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. salvar: recepção recusada; produto/procedimento de outra empresa
 *      recusados; conflito de versão; insumos trocados junto;
 *   2. anular em vez de apagar (DELETE direto recusado), com motivo;
 *   3. requisito `procedimento` configurável;
 *   4. finalizar: procedimento vira finalizado; UPDATE direto em procedimento e
 *      insumo recusado; UM evento `clinic.procedimento_confirmado` por
 *      procedimento, com lote/validade e sem texto clínico; o anulado não gera
 *      evento; o consumidor de estoque pode gravar só o `movimento_estoque_id`;
 *   5. adendo no procedimento; leitura por papel; isolamento; anon.
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

const ORG = "b5e10000-0000-4000-8000-00000000000a";
const ORG_B = "b5e10000-0000-4000-8000-00000000000b";
const ADM = "b5e10000-1111-4000-8000-0000000000a1";
const RECEP = "b5e10000-1111-4000-8000-0000000000a2";
const PROF = "b5e10000-1111-4000-8000-0000000000a3";
const PROF_B = "b5e10000-1111-4000-8000-0000000000b1";
const PAC = "b5e10000-2222-4000-8000-00000000000a";
const AG = "b5e10000-3333-4000-8000-000000000001";
const PROD = "b5e10000-6666-4000-8000-000000000001";
const PROD_B = "b5e10000-6666-4000-8000-0000000000b1";
const PROC = "b5e10000-7777-4000-8000-000000000001";

const dados = (extra: object = {}) =>
  JSON.stringify({ descricao: "Toxina botulínica", procedure_id: PROC, regiao: "Frontal", parametros: { unidades: "20" }, ...extra });
const insumos = (prod = PROD, lote = "L123") =>
  JSON.stringify([{ descricao: "Frasco 100U", quantidade: 0.2, unidade: "fr", product_id: prod, lote, validade: "2027-12-31" }]);
const salvar = (ator: string, proc: string | null, d: string, i: string, versao: number) =>
  como(
    ator,
    `select public.fn_clinic_procedimento_salvar('${ORG}', '${at}', ${proc ? `'${proc}'` : "null"}, '${d}'::jsonb, '${i}'::jsonb, ${versao});`,
  );
const contar = (ator: string, tabela: string, org = ORG) =>
  ultima(sql(como(ator, `select count(*) from public.${tabela} where organization_id = '${org}';`)));

let at = "";
let p1 = "";
let p2 = "";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'pro-adm@invariant.test'), ('${RECEP}', 'pro-recep@invariant.test'),
      ('${PROF}', 'pro-prof@invariant.test'), ('${PROF_B}', 'pro-prof-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'pro-inv-a', 'Procedimentos Invariant A', 'Proc A', '{"clinic":{"prontuario":true}}'::jsonb),
      ('${ORG_B}', 'pro-inv-b', 'Procedimentos Invariant B', 'Proc B', '{"clinic":{"prontuario":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${RECEP}', '${ORG}', 'agent', now()),
      ('${PROF}', '${ORG}', 'agent', now()), ('${PROF_B}', '${ORG_B}', 'agent', now())
      on conflict do nothing;
    insert into public.clinic_professionals (organization_id, user_id, display_name) values
      ('${ORG}', '${PROF}', 'Profissional A'), ('${ORG_B}', '${PROF_B}', 'Profissional B')
      on conflict do nothing;
    insert into public.catalog_products (id, organization_id, codigo, nome, preco_cents) values
      ('${PROD}', '${ORG}', 'INV-TOX', 'Toxina (invariante)', 100000),
      ('${PROD_B}', '${ORG_B}', 'INV-TOX-B', 'Toxina B (invariante)', 100000)
      on conflict (id) do nothing;
    insert into public.clinic_procedures (id, organization_id, name, short_description) values
      ('${PROC}', '${ORG}', 'Toxina botulínica', 'Aplicação de toxina')
      on conflict (id) do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PAC}', '${ORG}', 'Paciente Proc A', '+5511990000601')
      on conflict (id) do nothing;
    insert into public.calendar_appointments (id, organization_id, title, starts_at, ends_at, owner_user_id, contact_id, status) values
      ('${AG}', '${ORG}', 'Toxina', now() - interval '1 hour', now(), '${PROF}', '${PAC}', 'confirmed')
      on conflict (id) do nothing;
  `);
  at = json<{ id: string }>(sql(como(PROF, `select public.fn_clinic_iniciar_atendimento('${ORG}', '${AG}');`))).id;
});

describe("salvar", () => {
  it("recepção recusada; produto de outra empresa recusado", () => {
    expect(erro(salvar(RECEP, null, dados(), insumos(), 0))).toMatch(/acesso_proibido/);
    expect(erro(salvar(PROF, null, dados(), insumos(PROD_B), 0))).toMatch(/procedimento_invalido/);
  });

  it("cria, atualiza com versão (insumos trocados), recusa versão velha", () => {
    const r = json<{ id: string; versao: number }>(sql(salvar(PROF, null, dados(), insumos(), 0)));
    p1 = r.id;
    sql(salvar(PROF, p1, dados({ regiao: "Frontal e glabela" }), insumos(PROD, "L999"), 1));
    expect(erro(salvar(PROF, p1, dados(), insumos(), 1))).toMatch(/registro_conflito/);
    expect(ultima(sql(`select string_agg(lote, ',') from public.clinic_procedimento_insumos where procedimento_id = '${p1}';`))).toBe("L999");
  });

  it("anular em vez de apagar; DELETE direto recusado", () => {
    p2 = json<{ id: string }>(sql(salvar(PROF, null, dados({ descricao: "Registro errado" }), "[]", 0))).id;
    expect(erro(`delete from public.clinic_procedimentos_realizados where id = '${p2}';`)).toMatch(/prontuario_imutavel/);
    expect(erro(como(PROF, `select public.fn_clinic_procedimento_anular('${ORG}', '${p2}', null);`))).toMatch(/procedimento_sem_motivo/);
    sql(como(PROF, `select public.fn_clinic_procedimento_anular('${ORG}', '${p2}', 'Lançado no paciente errado');`));
    expect(ultima(sql(`select status from public.clinic_procedimentos_realizados where id = '${p2}';`))).toBe("anulado");
  });

  it("requisito procedimento: anulado não conta", () => {
    sql(`insert into public.clinic_requisitos_finalizacao (organization_id, secao) values ('${ORG}', 'procedimento');`);
    expect(ultima(sql(`select array_to_string(public.fn_clinic_requisitos_faltando('${at}'), ',');`))).toBe("evolucao");
  });
});

describe("finalizar", () => {
  it("congela, gera um evento por procedimento confirmado, com lote e sem texto clínico", () => {
    sql(como(PROF, `select public.fn_clinic_salvar_evolucao('${ORG}', '${at}', 'Aplicação sem intercorrências.', null, null, null, null, 0);`));
    sql(como(PROF, `select public.fn_clinic_finalizar_atendimento('${ORG}', '${at}');`));
    expect(ultima(sql(`select status from public.clinic_procedimentos_realizados where id = '${p1}';`))).toBe("finalizado");
    expect(erro(`update public.clinic_procedimentos_realizados set regiao = 'x' where id = '${p1}';`)).toMatch(/prontuario_imutavel/);
    expect(erro(`update public.clinic_procedimento_insumos set lote = 'X' where procedimento_id = '${p1}';`)).toMatch(/prontuario_imutavel/);
    // O consumidor de estoque grava só o movimento.
    sql(`update public.clinic_procedimento_insumos set movimento_estoque_id = gen_random_uuid() where procedimento_id = '${p1}';`);

    const eventos = sql(
      `select payload::text from public.event_log where organization_id = '${ORG}' and event_type = 'clinic.procedimento_confirmado';`,
    )
      .split("\n")
      .filter(Boolean);
    expect(eventos).toHaveLength(1);
    const payload = JSON.parse(eventos[0]!) as { insumos: Array<{ lote: string; validade: string }> };
    expect(payload.insumos[0]).toMatchObject({ lote: "L999", validade: "2027-12-31" });
    expect(eventos[0]).not.toMatch(/Toxina|Frontal|intercorr/i);
  });

  it("adendo no procedimento finalizado", () => {
    expect(
      json<{ id: string }>(
        sql(
          como(
            PROF,
            `select public.fn_clinic_adicionar_adendo('${ORG}', '${at}', 'procedimento', '${p1}', 'Faltou registrar a glabela', 'Complemento');`,
          ),
        ),
      ).id,
    ).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("leitura e acesso", () => {
  it("profissional lê; admin sem papel clínico e recepção leem 0; outra empresa lê 0", () => {
    for (const t of ["clinic_procedimentos_realizados", "clinic_procedimento_insumos"]) {
      expect(Number(contar(PROF, t))).toBeGreaterThan(0);
      expect(contar(ADM, t)).toBe("0");
      expect(contar(RECEP, t)).toBe("0");
      expect(contar(PROF_B, t)).toBe("0");
    }
  });

  it("anon não executa", () => {
    for (const f of [
      `public.fn_clinic_procedimento_salvar('${ORG}', '${at}', null, '{}'::jsonb, '[]'::jsonb, 0)`,
      `public.fn_clinic_procedimento_anular('${ORG}', '${p1}', 'xxx')`,
    ]) {
      expect(erro(`set role anon; select ${f};`)).toMatch(/permission denied/);
    }
  });
});
