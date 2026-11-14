/**
 * clinic (fork, estoque E6) — migration 9034: inventário (contagem) por local.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. abrir fotografa o saldo dos lotes do local; um aberto por local; só com
 *      estoque.inventariar;
 *   2. contar/desfazer; fechar gera UMA operação `inventario` com a diferença
 *      (contado − saldo ao fechar), só dos lotes contados; nada a acertar →
 *      nenhuma operação;
 *   3. fechado não se mexe; cancelar não mexe no saldo;
 *   4. isolamento; ninguém escreve direto.
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

const ORG = "eb000000-0000-4000-8000-00000000000a";
const ORG_B = "eb000000-0000-4000-8000-00000000000b";
const ADM = "eb000000-1111-4000-8000-0000000000a1";
const ATEND = "eb000000-1111-4000-8000-0000000000a2";
const ADM_B = "eb000000-1111-4000-8000-0000000000b1";
const GAZE = "eb000000-2222-4000-8000-000000000001";
const LUVA = "eb000000-2222-4000-8000-000000000002";

const fn = (ator: string, nome: string, args: string) => como(ator, `select public.${nome}(${args});`);
const dados = (o: unknown) => `'${JSON.stringify(o)}'::jsonb`;
const saldo = (lote: string) =>
  ultima(sql(`select coalesce(sum(quantidade), 0) from public.clinic_estoque_movimentos where lote_id = '${lote}';`));

let local = "";
let loteGaze = "";
let loteLuva = "";
let inv = "";
const itemDe = (lote: string) =>
  ultima(sql(`select id from public.clinic_estoque_inventario_itens where inventario_id = '${inv}' and lote_id = '${lote}';`));

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'inv-adm@invariant.test'), ('${ATEND}', 'inv-atend@invariant.test'), ('${ADM_B}', 'inv-adm-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'inv-inv-a', 'Inventario Invariant A', 'Inv A', '{"clinic":{}}'::jsonb),
      ('${ORG_B}', 'inv-inv-b', 'Inventario Invariant B', 'Inv B', '{"clinic":{"estoque":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${ATEND}', '${ORG}', 'agent', now()), ('${ADM_B}', '${ORG_B}', 'admin', now())
      on conflict do nothing;
    insert into public.catalog_products (id, organization_id, codigo, nome, preco_cents) values
      ('${GAZE}', '${ORG}', 'I-GAZE', 'Gaze fictícia', 0), ('${LUVA}', '${ORG}', 'I-LUVA', 'Luva fictícia', 0)
      on conflict (id) do nothing;
  `);
  sql(fn(ADM, "fn_clinic_definir_estoque", `'${ORG}', true`));
  local = ultima(sql(`select id from public.clinic_estoque_locais where organization_id = '${ORG}' and padrao;`));
  loteGaze = json<{ lote_id: string }>(sql(fn(ADM, "fn_clinic_estoque_entrada", `'${ORG}', ${dados({ product_id: GAZE, local_id: local, quantidade: 10 })}`))).lote_id;
  loteLuva = json<{ lote_id: string }>(sql(fn(ADM, "fn_clinic_estoque_entrada", `'${ORG}', ${dados({ product_id: LUVA, local_id: local, quantidade: 50 })}`))).lote_id;
});

describe("abrir e contar", () => {
  it("só quem inventaria; fotografa os lotes; um aberto por local", () => {
    expect(erro(fn(ATEND, "fn_clinic_estoque_inventario_abrir", `'${ORG}', '${local}'`))).toMatch(/acesso_proibido/);
    const r = json<{ id: string; itens: number }>(sql(fn(ADM, "fn_clinic_estoque_inventario_abrir", `'${ORG}', '${local}'`)));
    inv = r.id;
    expect(r.itens).toBe(2);
    expect(ultima(sql(`select quantidade_sistema from public.clinic_estoque_inventario_itens where id = '${itemDe(loteGaze)}';`))).toBe("10.000");
    expect(erro(fn(ADM, "fn_clinic_estoque_inventario_abrir", `'${ORG}', '${local}'`))).toMatch(/estoque_inventario_aberto/);
  });

  it("contar, desfazer e recusar negativo", () => {
    expect(erro(fn(ADM, "fn_clinic_estoque_inventario_contar", `'${ORG}', '${itemDe(loteGaze)}', -1`))).toMatch(/estoque_quantidade_invalida/);
    sql(fn(ADM, "fn_clinic_estoque_inventario_contar", `'${ORG}', '${itemDe(loteLuva)}', 1`));
    sql(fn(ADM, "fn_clinic_estoque_inventario_contar", `'${ORG}', '${itemDe(loteLuva)}', null`));
    sql(fn(ADM, "fn_clinic_estoque_inventario_contar", `'${ORG}', '${itemDe(loteGaze)}', 7`));
  });
});

describe("fechar", () => {
  it("acerta pela diferença ao fechar, só dos lotes contados, numa operação", () => {
    // entre a contagem e o fechamento, uma perda de 1 gaze: a contagem (7) vale
    sql(fn(ADM, "fn_clinic_estoque_perda", `'${ORG}', ${dados({ lote_id: loteGaze, local_id: local, quantidade: 1, motivo: "Molhou" })}`));
    const r = json<{ ajustes: number; operacao_id: string }>(sql(fn(ADM, "fn_clinic_estoque_inventario_fechar", `'${ORG}', '${inv}', 'Contagem mensal'`)));
    expect(r.ajustes).toBe(1);
    expect(saldo(loteGaze)).toBe("7.000");
    expect(saldo(loteLuva)).toBe("50.000");
    expect(ultima(sql(`select tipo || ':' || origem_tipo from public.clinic_estoque_operacoes where id = '${r.operacao_id}';`))).toBe(
      "inventario:inventario",
    );
    expect(erro(fn(ADM, "fn_clinic_estoque_inventario_contar", `'${ORG}', '${itemDe(loteGaze)}', 5`))).toMatch(/estoque_inventario_fechado/);
  });

  it("nada a acertar: fecha sem operação; cancelar não mexe no saldo", () => {
    inv = json<{ id: string }>(sql(fn(ADM, "fn_clinic_estoque_inventario_abrir", `'${ORG}', '${local}'`))).id;
    sql(fn(ADM, "fn_clinic_estoque_inventario_contar", `'${ORG}', '${itemDe(loteGaze)}', 7`));
    expect(json<{ ajustes: number; operacao_id: string | null }>(sql(fn(ADM, "fn_clinic_estoque_inventario_fechar", `'${ORG}', '${inv}', null`)))).toEqual({
      ajustes: 0,
      operacao_id: null,
    });
    inv = json<{ id: string }>(sql(fn(ADM, "fn_clinic_estoque_inventario_abrir", `'${ORG}', '${local}'`))).id;
    sql(fn(ADM, "fn_clinic_estoque_inventario_contar", `'${ORG}', '${itemDe(loteLuva)}', 0`));
    sql(fn(ADM, "fn_clinic_estoque_inventario_cancelar", `'${ORG}', '${inv}'`));
    expect(saldo(loteLuva)).toBe("50.000");
  });
});

describe("isolamento", () => {
  it("outra empresa não vê nem mexe; ninguém escreve direto", () => {
    expect(ultima(sql(como(ADM_B, `select count(*) from public.clinic_estoque_inventarios where organization_id = '${ORG}';`)))).toBe("0");
    expect(ultima(sql(como(ADM_B, `select count(*) from public.clinic_estoque_inventario_itens where organization_id = '${ORG}';`)))).toBe("0");
    expect(erro(fn(ADM_B, "fn_clinic_estoque_inventario_abrir", `'${ORG_B}', '${local}'`))).toMatch(/estoque_local_invalido/);
    expect(erro(fn(ADM_B, "fn_clinic_estoque_inventario_cancelar", `'${ORG_B}', '${inv}'`))).toMatch(/estoque_inventario_invalido/);
    expect(
      erro(como(ADM, `insert into public.clinic_estoque_inventarios (organization_id, local_id) values ('${ORG}', '${local}');`)),
    ).toMatch(/permission denied/);
  });
});
