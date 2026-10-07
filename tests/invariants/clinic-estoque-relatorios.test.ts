/**
 * clinic (fork, estoque E8) — migration 9036: relatórios e rastreio de lote.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. quem só tem estoque.ver NÃO lê mais contact_id/atendimento_id/
 *      profissional_user_id direto dos movimentos (privilégio por coluna), mas
 *      as colunas do saldo seguem legíveis;
 *   2. consumo por procedimento/profissional/produto, líquido de estorno; custo
 *      só com estoque.custos;
 *   3. perdas por motivo, perda estornada não conta; sugestão de compra;
 *   4. rastreio de lote: só com a chave clínica (profissional gerente sim;
 *      administrador sem papel clínico, atendente e outra empresa não).
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

const ORG = "ed000000-0000-4000-8000-00000000000a";
const ORG_B = "ed000000-0000-4000-8000-00000000000b";
const ADM = "ed000000-1111-4000-8000-0000000000a1";
const ATEND = "ed000000-1111-4000-8000-0000000000a2";
const PROF = "ed000000-1111-4000-8000-0000000000a3";
const ADM_B = "ed000000-1111-4000-8000-0000000000b1";
const PAC = "ed000000-3333-4000-8000-00000000000a";
const AT1 = "ed000000-4444-4000-8000-000000000001";
const AT2 = "ed000000-4444-4000-8000-000000000002";
const PROC = "ed000000-6666-4000-8000-00000000000a";
const TOX = "ed000000-2222-4000-8000-000000000001";

const fn = (ator: string, nome: string, args: string) => como(ator, `select public.${nome}(${args});`);
const dados = (o: unknown) => `'${JSON.stringify(o)}'::jsonb`;
const hoje = new Date().toISOString().slice(0, 10);

let local = "";
let lote = "";
let consumo2 = "";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'rel-adm@invariant.test'), ('${ATEND}', 'rel-atend@invariant.test'),
      ('${PROF}', 'rel-prof@invariant.test'), ('${ADM_B}', 'rel-adm-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'rel-inv-a', 'Relatorios Invariant A', 'Rel A', '{"clinic":{"prontuario":true}}'::jsonb),
      ('${ORG_B}', 'rel-inv-b', 'Relatorios Invariant B', 'Rel B', '{"clinic":{"estoque":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${ATEND}', '${ORG}', 'agent', now()),
      ('${PROF}', '${ORG}', 'manager', now()), ('${ADM_B}', '${ORG_B}', 'admin', now())
      on conflict do nothing;
    insert into public.clinic_professionals (organization_id, user_id, display_name) values
      ('${ORG}', '${PROF}', 'Dra. Fictícia') on conflict do nothing;
    insert into public.catalog_products (id, organization_id, codigo, nome, preco_cents) values
      ('${TOX}', '${ORG}', 'R-TOX', 'Toxina fictícia', 0) on conflict (id) do nothing;
    insert into public.clinic_procedures (id, organization_id, name, short_description) values
      ('${PROC}', '${ORG}', 'Toxina (relatório)', 'Fictício') on conflict (id) do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PAC}', '${ORG}', 'Paciente Recall', '+5511990001001') on conflict (id) do nothing;
  `);
  sql(fn(ADM, "fn_clinic_definir_estoque", `'${ORG}', true`));
  local = ultima(sql(`select id from public.clinic_estoque_locais where organization_id = '${ORG}' and padrao;`));
  sql(
    fn(
      ADM,
      "fn_clinic_estoque_produto_salvar",
      `'${ORG}', '${TOX}', ${dados({ unidade_estoque: "frasco", unidade_aplicacao: "U", fator_conversao: 100, estoque_minimo: 150, ponto_pedido: 200 })}, null`,
    ),
  );
  lote = json<{ lote_id: string }>(
    sql(fn(ADM, "fn_clinic_estoque_entrada", `'${ORG}', ${dados({ product_id: TOX, local_id: local, quantidade: 2, em_unidade_estoque: true, lote: "R1", validade: "2099-12-31", custo_unitario_cents: 100000 })}`)),
  ).lote_id;
  // dois consumos de atendimento (como a baixa da E2 grava), direto como superusuário
  const consumo = (at: string, qtd: number) =>
    ultima(
      sql(`
        with o as (insert into public.clinic_estoque_operacoes (organization_id, tipo, origem_tipo, origem_id)
                   values ('${ORG}', 'consumo', 'insumo', gen_random_uuid()) returning id),
             m as (insert into public.clinic_estoque_movimentos
                     (organization_id, operacao_id, product_id, lote_id, local_id, quantidade, custo_unitario_cents,
                      atendimento_id, contact_id, profissional_user_id, procedure_id)
                   select '${ORG}', o.id, '${TOX}', '${lote}', '${local}', -${qtd}, 1000, '${at}', '${PAC}', '${PROF}', '${PROC}' from o
                   returning operacao_id)
        select operacao_id from m;`),
    );
  consumo(AT1, 20);
  consumo2 = consumo(AT2, 30);
  sql(fn(ADM, "fn_clinic_estoque_perda", `'${ORG}', ${dados({ lote_id: lote, local_id: local, quantidade: 5, motivo: "Frasco quebrado", categoria: "quebra" })}`));
  const perdaEstornada = json<{ operacao_id: string }>(
    sql(fn(ADM, "fn_clinic_estoque_perda", `'${ORG}', ${dados({ lote_id: lote, local_id: local, quantidade: 7, motivo: "Lançado errado" })}`)),
  ).operacao_id;
  sql(fn(ADM, "fn_clinic_estoque_estornar", `'${ORG}', '${perdaEstornada}', 'Não houve perda'`));
});

describe("privilégio por coluna", () => {
  it("quem só vê o estoque não lê a ligação com o paciente; o saldo segue legível", () => {
    expect(erro(como(ATEND, `select contact_id from public.clinic_estoque_movimentos limit 1;`))).toMatch(/permission denied/);
    expect(erro(como(ATEND, `select atendimento_id, profissional_user_id from public.clinic_estoque_movimentos limit 1;`))).toMatch(
      /permission denied/,
    );
    expect(Number(ultima(sql(como(ATEND, `select count(*) from public.clinic_estoque_movimentos where organization_id = '${ORG}';`))))).toBeGreaterThan(0);
    expect(ultima(sql(como(ATEND, `select sum(saldo) from public.clinic_estoque_saldos where organization_id = '${ORG}';`)))).toBe("145.000");
  });
});

describe("consumo, perdas e compra", () => {
  it("consumo por procedimento e profissional, líquido de estorno; custo só com estoque.custos", () => {
    type Linha = { grupo: string; quantidade: number; atendimentos: number; custo_cents: number | null };
    const porProc = json<Linha[]>(sql(fn(ADM, "fn_clinic_estoque_rel_consumo", `'${ORG}', '${hoje}', '${hoje}', 'procedimento'`)));
    expect(porProc).toEqual([expect.objectContaining({ grupo: "Toxina (relatório)", quantidade: 50, atendimentos: 2, custo_cents: 50000 })]);
    sql(fn(ADM, "fn_clinic_estoque_estornar", `'${ORG}', '${consumo2}', 'Lançado no paciente errado'`));
    const porProf = json<Linha[]>(sql(fn(ADM, "fn_clinic_estoque_rel_consumo", `'${ORG}', '${hoje}', '${hoje}', 'profissional'`)));
    expect(porProf).toEqual([expect.objectContaining({ grupo: "Dra. Fictícia", quantidade: 20 })]);
    const semCusto = json<Linha[]>(sql(fn(ATEND, "fn_clinic_estoque_rel_consumo", `'${ORG}', '${hoje}', '${hoje}', 'produto'`)));
    expect(semCusto[0]?.custo_cents).toBeNull();
    expect(erro(fn(ADM, "fn_clinic_estoque_rel_consumo", `'${ORG}', '${hoje}', '${hoje}', 'paciente'`))).toMatch(/estoque_dados_invalidos/);
  });

  it("perdas por motivo, sem a estornada", () => {
    const perdas = json<Array<{ motivo: string; quantidade: number }>>(sql(fn(ADM, "fn_clinic_estoque_rel_perdas", `'${ORG}', '${hoje}', '${hoje}'`)));
    expect(perdas).toEqual([expect.objectContaining({ categoria: "quebra", motivo: "Quebra", quantidade: 5 })]);
  });

  it("sugestão de compra: abaixo do ponto de pedido, até o dobro do nível", () => {
    // saldo 200 − 20 − 5 = 175 U ≤ 200 (ponto) → sugere ceil((400 − 175) / 100) = 3 frascos
    const compra = json<Array<{ disponivel: number; sugerido: number; unidade_estoque: string }>>(sql(fn(ATEND, "fn_clinic_estoque_rel_compra", `'${ORG}'`)));
    expect(compra).toEqual([expect.objectContaining({ disponivel: 175, sugerido: 3, unidade_estoque: "frasco" })]);
  });
});

describe("rastreio de lote (recall)", () => {
  it("profissional com a chave clínica vê os pacientes do lote", () => {
    const r = json<{ lote: { codigo: string }; pacientes: Array<{ paciente: string; quantidade: number; profissional: string }> }>(
      sql(fn(PROF, "fn_clinic_estoque_rel_rastreio_lote", `'${ORG}', '${lote}', 'auditoria'`)),
    );
    expect(r.lote.codigo).toBe("R1");
    // Desde a 9038 o recall parte dos INSUMOS do prontuário; os consumos deste
    // arquivo são gravados direto (sem insumo), então não aparecem aqui. A prova
    // do recall completo (baixado, estornado, pendente, presumido) está em
    // tests/invariants/clinic-estoque-revisao.test.ts.
    expect(Array.isArray(r.pacientes)).toBe(true);
  });

  it("administrador sem papel clínico, atendente e outra empresa são recusados", () => {
    expect(erro(fn(ADM, "fn_clinic_estoque_rel_rastreio_lote", `'${ORG}', '${lote}', 'auditoria'`))).toMatch(/acesso_proibido/);
    expect(erro(fn(ATEND, "fn_clinic_estoque_rel_rastreio_lote", `'${ORG}', '${lote}', 'auditoria'`))).toMatch(/acesso_proibido/);
    expect(erro(fn(ADM_B, "fn_clinic_estoque_rel_rastreio_lote", `'${ORG}', '${lote}', 'auditoria'`))).toMatch(/acesso_proibido/);
    expect(erro(fn(ADM_B, "fn_clinic_estoque_rel_consumo", `'${ORG}', '${hoje}', '${hoje}', 'produto'`))).toMatch(/acesso_proibido/);
  });
});
