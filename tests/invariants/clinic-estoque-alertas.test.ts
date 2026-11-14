/**
 * clinic (fork, estoque E7) — migration 9035: alertas do estoque.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. a varredura (só service role) abre abaixo do mínimo, ponto de pedido,
 *      validade próxima (com faixa), lote vencido e frasco vencido; não
 *      duplica ao rodar de novo;
 *   2. o que deixa de valer se resolve sozinho;
 *   3. dispensar exige permissão e motivo; dispensado não volta por 7 dias;
 *   4. opção desligada não gera alerta; isolamento; ninguém escreve direto.
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

const ORG = "ec000000-0000-4000-8000-00000000000a";
const ORG_OFF = "ec000000-0000-4000-8000-00000000000c";
const ADM = "ec000000-1111-4000-8000-0000000000a1";
const ATEND = "ec000000-1111-4000-8000-0000000000a2";
const ADM_OFF = "ec000000-1111-4000-8000-0000000000c1";
const GAZE = "ec000000-2222-4000-8000-000000000001";
const LUVA = "ec000000-2222-4000-8000-000000000002";
const TOX = "ec000000-2222-4000-8000-000000000003";
const PROD_OFF = "ec000000-2222-4000-8000-00000000000c";

const fn = (ator: string, nome: string, args: string) => como(ator, `select public.${nome}(${args});`);
const dados = (o: unknown) => `'${JSON.stringify(o)}'::jsonb`;
const varrer = () => json<{ abertos: number; resolvidos: number }>(sql(`set role service_role; select public.fn_clinic_estoque_varrer_alertas();`));
const abertos = (org = ORG) =>
  sql(`select chave from public.clinic_estoque_alertas where organization_id = '${org}' and status = 'aberto' order by chave;`)
    .split("\n")
    .filter(Boolean);

let local = "";
let loteGaze = "";
let loteLuva = "";
let loteTox = "";
let frasco = "";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'al-adm@invariant.test'), ('${ATEND}', 'al-atend@invariant.test'), ('${ADM_OFF}', 'al-adm-off@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'al-inv-a', 'Alertas Invariant A', 'Alertas A', '{"clinic":{}}'::jsonb),
      ('${ORG_OFF}', 'al-inv-c', 'Alertas Invariant C', 'Alertas C', '{"clinic":{}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${ATEND}', '${ORG}', 'agent', now()), ('${ADM_OFF}', '${ORG_OFF}', 'admin', now())
      on conflict do nothing;
    insert into public.catalog_products (id, organization_id, codigo, nome, preco_cents) values
      ('${GAZE}', '${ORG}', 'A-GAZE', 'Gaze fictícia', 0), ('${LUVA}', '${ORG}', 'A-LUVA', 'Luva fictícia', 0),
      ('${TOX}', '${ORG}', 'A-TOX', 'Toxina fictícia', 0), ('${PROD_OFF}', '${ORG_OFF}', 'A-OFF', 'Produto C', 0)
      on conflict (id) do nothing;
  `);
  sql(fn(ADM, "fn_clinic_definir_estoque", `'${ORG}', true`));
  local = ultima(sql(`select id from public.clinic_estoque_locais where organization_id = '${ORG}' and padrao;`));
  sql(fn(ADM, "fn_clinic_estoque_produto_salvar", `'${ORG}', '${GAZE}', ${dados({ estoque_minimo: 20 })}, null`));
  sql(fn(ADM, "fn_clinic_estoque_produto_salvar", `'${ORG}', '${LUVA}', ${dados({ ponto_pedido: 100 })}, null`));
  sql(
    fn(
      ADM,
      "fn_clinic_estoque_produto_salvar",
      `'${ORG}', '${TOX}', ${dados({ unidade_estoque: "frasco", unidade_aplicacao: "U", fator_conversao: 100, fracionavel: true, validade_pos_abertura_horas: 24 })}, null`,
    ),
  );
  const prazo = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
  loteGaze = json<{ lote_id: string }>(sql(fn(ADM, "fn_clinic_estoque_entrada", `'${ORG}', ${dados({ product_id: GAZE, local_id: local, quantidade: 10, lote: "G1", validade: prazo })}`))).lote_id;
  loteLuva = json<{ lote_id: string }>(sql(fn(ADM, "fn_clinic_estoque_entrada", `'${ORG}', ${dados({ product_id: LUVA, local_id: local, quantidade: 80 })}`))).lote_id;
  loteTox = json<{ lote_id: string }>(
    sql(fn(ADM, "fn_clinic_estoque_entrada", `'${ORG}', ${dados({ product_id: TOX, local_id: local, quantidade: 1, em_unidade_estoque: true, lote: "T1", validade: "2099-12-31" })}`)),
  ).lote_id;
  frasco = json<{ frasco_id: string }>(sql(fn(ADM, "fn_clinic_estoque_frasco_abrir", `'${ORG}', ${dados({ lote_id: loteTox, local_id: local })}`))).frasco_id;
  // lote vencido com saldo e frasco vencido: direto, como superusuário
  sql(`update public.clinic_estoque_frascos set vence_em = now() - interval '1 hour' where id = '${frasco}';`);
  sql(`
    insert into public.catalog_products (id, organization_id, codigo, nome, preco_cents, quantidade) values
      ('${PROD_OFF}', '${ORG_OFF}', 'A-OFF', 'Produto C', 0, 0) on conflict (id) do nothing;
    insert into public.clinic_produto_estoque (organization_id, product_id, estoque_minimo) values ('${ORG_OFF}', '${PROD_OFF}', 5)
      on conflict do nothing;
  `);
});

describe("varredura", () => {
  it("só o service role varre", () => {
    expect(erro(fn(ADM, "fn_clinic_estoque_varrer_alertas", ""))).toMatch(/permission denied/);
  });

  it("abre os alertas do que vale agora, sem duplicar", () => {
    const r = varrer();
    expect(r.abertos).toBeGreaterThanOrEqual(4);
    expect(abertos()).toEqual(
      [`abaixo_minimo:${GAZE}`, `frasco_vencido:${frasco}`, `ponto_pedido:${LUVA}`, `validade:${loteGaze}:30`].sort(),
    );
    expect(varrer().abertos).toBe(0);
    expect(abertos(ORG_OFF)).toEqual([]);
    expect(
      ultima(sql(`select detalhe ->> 'saldo' || '/' || (detalhe ->> 'minimo') from public.clinic_estoque_alertas where chave = 'abaixo_minimo:${GAZE}';`)),
    ).toBe("10.000/20.000");
  });

  it("o que deixa de valer se resolve sozinho", () => {
    sql(fn(ADM, "fn_clinic_estoque_entrada", `'${ORG}', ${dados({ product_id: LUVA, local_id: local, quantidade: 50 })}`));
    sql(fn(ADM, "fn_clinic_estoque_frasco_encerrar", `'${ORG}', '${frasco}', 'Frasco vencido'`));
    expect(varrer().resolvidos).toBe(2);
    expect(abertos()).toEqual([`abaixo_minimo:${GAZE}`, `validade:${loteGaze}:30`].sort());
  });
});

describe("dispensar", () => {
  it("exige permissão e motivo; dispensado não volta na próxima varredura", () => {
    const id = ultima(sql(`select id from public.clinic_estoque_alertas where chave = 'abaixo_minimo:${GAZE}' and status = 'aberto';`));
    expect(erro(fn(ATEND, "fn_clinic_estoque_alerta_dispensar", `'${ORG}', '${id}', 'Sei disso'`))).toMatch(/acesso_proibido/);
    expect(erro(fn(ADM, "fn_clinic_estoque_alerta_dispensar", `'${ORG}', '${id}', null`))).toMatch(/estoque_sem_motivo/);
    expect(erro(fn(ADM_OFF, "fn_clinic_estoque_alerta_dispensar", `'${ORG_OFF}', '${id}', 'Tentativa'`))).toMatch(/estoque_desligado|estoque_alerta_invalido/);
    sql(fn(ADM, "fn_clinic_estoque_alerta_dispensar", `'${ORG}', '${id}', 'Compra já feita'`));
    varrer();
    expect(abertos()).toEqual([`validade:${loteGaze}:30`]);
    expect(erro(fn(ADM, "fn_clinic_estoque_alerta_dispensar", `'${ORG}', '${id}', 'De novo'`))).toMatch(/estoque_alerta_fechado/);
  });

  it("lote vencido com saldo abre alerta", () => {
    sql(`update public.clinic_estoque_lotes set validade = current_date - 1 where id = '${loteLuva}';`);
    varrer();
    expect(abertos()).toContain(`lote_vencido:${loteLuva}`);
  });
});

describe("isolamento", () => {
  it("quem só vê lê; outra empresa não vê; ninguém escreve direto", () => {
    expect(Number(ultima(sql(como(ATEND, `select count(*) from public.clinic_estoque_alertas where organization_id = '${ORG}';`))))).toBeGreaterThan(0);
    expect(ultima(sql(como(ADM_OFF, `select count(*) from public.clinic_estoque_alertas where organization_id = '${ORG}';`)))).toBe("0");
    expect(
      erro(como(ADM, `insert into public.clinic_estoque_alertas (organization_id, tipo, chave) values ('${ORG}', 'abaixo_minimo', 'x');`)),
    ).toMatch(/permission denied/);
  });
});
