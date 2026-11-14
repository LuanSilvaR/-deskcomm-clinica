/**
 * clinic (fork, estoque E1) — migration 9029: quantidade do catálogo = saldo.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. produto gerenciado: entrada, perda e estorno atualizam
 *      `catalog_products.quantidade` (saldo ÷ fator, arredondado para baixo);
 *   2. UPDATE direto (tela de produtos / importação da planilha) não sobrescreve
 *      a quantidade de produto gerenciado — nem com upsert por código;
 *   3. produto não gerenciado e empresa com a opção desligada: comportamento
 *      antigo (a quantidade digitada vale);
 *   4. ligar `gerenciado` ressincroniza; desligar devolve a edição manual;
 *   5. duas saídas concorrentes no mesmo produto: a quantidade final confere
 *      com a soma dos movimentos;
 *   6. as funções da sincronia não são executáveis por authenticated/anon.
 */
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";

import { beforeAll, describe, expect, it } from "vitest";

const container = process.env.TEST_DB_CONTAINER;
if (!container) {
  throw new Error("TEST_DB_CONTAINER not set — rode esta suíte via `pnpm test:db` (scripts/test-db.sh)");
}
const containerName: string = container;
const PSQL = ["exec", "-i", containerName, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-f", "-"];
const execFileAsync = promisify(execFile);

function sql(script: string): string {
  return execFileSync("docker", PSQL, { input: script, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}
async function sqlAsync(script: string): Promise<string | null> {
  try {
    const p = execFileAsync("docker", PSQL, { encoding: "utf8" });
    p.child.stdin?.end(script);
    await p;
    return null;
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
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

const ORG = "e6000000-0000-4000-8000-00000000000a";
const ORG_OFF = "e6000000-0000-4000-8000-00000000000c";
const ADM = "e6000000-1111-4000-8000-0000000000a1";
const GER = "e6000000-1111-4000-8000-0000000000a2";
const ADM_OFF = "e6000000-1111-4000-8000-0000000000c1";
const PROD = "e6000000-2222-4000-8000-00000000000a";
const PROD_LIVRE = "e6000000-2222-4000-8000-00000000000b";
const PROD_OFF = "e6000000-2222-4000-8000-00000000000c";

const fn = (ator: string, nome: string, args: string) => como(ator, `select public.${nome}(${args});`);
const dados = (o: Record<string, unknown>) => `'${JSON.stringify(o)}'::jsonb`;
const qtd = (produto: string) => ultima(sql(`select quantidade from public.catalog_products where id = '${produto}';`));
const somaEmFrascos = (produto: string) =>
  ultima(
    sql(`select greatest(0, floor(coalesce(sum(m.quantidade), 0) / 100))::int
           from public.clinic_estoque_movimentos m where m.product_id = '${produto}';`),
  );

let local = "";
let lote = "";
let perda = "";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'sinc-adm@invariant.test'), ('${GER}', 'sinc-ger@invariant.test'),
      ('${ADM_OFF}', 'sinc-adm-off@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'sinc-inv-a', 'Sincronia Invariant A', 'Sincronia A', '{"clinic":{}}'::jsonb),
      ('${ORG_OFF}', 'sinc-inv-c', 'Sincronia Invariant C', 'Sincronia C', '{"clinic":{}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${GER}', '${ORG}', 'manager', now()),
      ('${ADM_OFF}', '${ORG_OFF}', 'admin', now())
      on conflict do nothing;
    insert into public.catalog_products (id, organization_id, codigo, nome, preco_cents, quantidade) values
      ('${PROD}', '${ORG}', 'SINC-TOX', 'Toxina fictícia', 0, 7),
      ('${PROD_LIVRE}', '${ORG}', 'SINC-LIVRE', 'Produto não gerenciado', 0, 3),
      ('${PROD_OFF}', '${ORG_OFF}', 'SINC-OFF', 'Produto sem estoque', 0, 4)
      on conflict (id) do nothing;
  `);
  sql(fn(ADM, "fn_clinic_definir_estoque", `'${ORG}', true`));
  local = ultima(sql(`select id from public.clinic_estoque_locais where organization_id = '${ORG}' and padrao;`));
});

describe("produto gerenciado", () => {
  it("configurar zera para o saldo real; entrada, perda e estorno movem a quantidade", () => {
    sql(
      fn(
        ADM,
        "fn_clinic_estoque_produto_salvar",
        `'${ORG}', '${PROD}', ${dados({ unidade_estoque: "frasco", unidade_aplicacao: "U", fator_conversao: 100 })}, null`,
      ),
    );
    expect(qtd(PROD)).toBe("0");

    lote = json<{ lote_id: string }>(
      sql(
        fn(
          ADM,
          "fn_clinic_estoque_entrada",
          `'${ORG}', ${dados({ product_id: PROD, local_id: local, quantidade: 3, em_unidade_estoque: true, lote: "S1", validade: "2099-12-31" })}`,
        ),
      ),
    ).lote_id;
    expect(qtd(PROD)).toBe("3");

    perda = json<{ operacao_id: string }>(
      sql(fn(ADM, "fn_clinic_estoque_perda", `'${ORG}', ${dados({ lote_id: lote, local_id: local, quantidade: 50, motivo: "Frasco quebrado" })}`)),
    ).operacao_id;
    expect(qtd(PROD)).toBe("2"); // 250 U → 2 frascos (para baixo)

    sql(fn(ADM, "fn_clinic_estoque_estornar", `'${ORG}', '${perda}', 'Lançamento errado'`));
    expect(qtd(PROD)).toBe("3");
  });

  it("UPDATE direto e upsert da planilha não sobrescrevem", () => {
    sql(como(GER, `update public.catalog_products set quantidade = 99 where id = '${PROD}';`));
    expect(qtd(PROD)).toBe("3");
    sql(`update public.catalog_products set quantidade = 42, nome = 'Toxina fictícia (renomeada)' where id = '${PROD}';`);
    expect(qtd(PROD)).toBe("3");
    expect(ultima(sql(`select nome from public.catalog_products where id = '${PROD}';`))).toBe("Toxina fictícia (renomeada)");
    sql(
      como(
        GER,
        `insert into public.catalog_products (organization_id, codigo, nome, preco_cents, quantidade)
           values ('${ORG}', 'SINC-TOX', 'Toxina fictícia', 0, 500)
           on conflict (organization_id, codigo) do update set quantidade = excluded.quantidade, nome = excluded.nome;`,
      ),
    );
    expect(qtd(PROD)).toBe("3");
  });

  it("mudar o fator recalcula", () => {
    sql(
      fn(
        ADM,
        "fn_clinic_estoque_produto_salvar",
        `'${ORG}', '${PROD}', ${dados({ unidade_estoque: "caixa", unidade_aplicacao: "U", fator_conversao: 1000 })}, null`,
      ),
    );
    expect(qtd(PROD)).toBe("0");
    sql(
      fn(
        ADM,
        "fn_clinic_estoque_produto_salvar",
        `'${ORG}', '${PROD}', ${dados({ unidade_estoque: "frasco", unidade_aplicacao: "U", fator_conversao: 100 })}, null`,
      ),
    );
    expect(qtd(PROD)).toBe("3");
  });
});

describe("fora da sincronia", () => {
  it("produto não gerenciado: a quantidade digitada vale; ligar gerenciado ressincroniza", () => {
    sql(fn(ADM, "fn_clinic_estoque_produto_salvar", `'${ORG}', '${PROD_LIVRE}', ${dados({ gerenciado: false })}, null`));
    expect(qtd(PROD_LIVRE)).toBe("3");
    sql(fn(ADM, "fn_clinic_estoque_entrada", `'${ORG}', ${dados({ product_id: PROD_LIVRE, local_id: local, quantidade: 10 })}`));
    expect(qtd(PROD_LIVRE)).toBe("3");
    sql(como(GER, `update public.catalog_products set quantidade = 8 where id = '${PROD_LIVRE}';`));
    expect(qtd(PROD_LIVRE)).toBe("8");

    sql(fn(ADM, "fn_clinic_estoque_produto_salvar", `'${ORG}', '${PROD_LIVRE}', ${dados({ gerenciado: true })}, null`));
    expect(qtd(PROD_LIVRE)).toBe("10");
    sql(fn(ADM, "fn_clinic_estoque_produto_salvar", `'${ORG}', '${PROD_LIVRE}', ${dados({ gerenciado: false })}, null`));
    sql(como(GER, `update public.catalog_products set quantidade = 1 where id = '${PROD_LIVRE}';`));
    expect(qtd(PROD_LIVRE)).toBe("1");
  });

  it("empresa com a opção desligada: nada muda", () => {
    sql(`insert into public.clinic_produto_estoque (organization_id, product_id) values ('${ORG_OFF}', '${PROD_OFF}');`);
    expect(qtd(PROD_OFF)).toBe("4");
    sql(`update public.catalog_products set quantidade = 6 where id = '${PROD_OFF}';`);
    expect(qtd(PROD_OFF)).toBe("6");
  });

  it("desligar a opção devolve a edição manual; religar ressincroniza", () => {
    sql(fn(ADM, "fn_clinic_definir_estoque", `'${ORG}', false`));
    sql(`update public.catalog_products set quantidade = 77 where id = '${PROD}';`);
    expect(qtd(PROD)).toBe("77");
    sql(fn(ADM, "fn_clinic_definir_estoque", `'${ORG}', true`));
    expect(qtd(PROD)).toBe("3");
  });
});

describe("concorrência", () => {
  it("duas saídas simultâneas no mesmo produto: quantidade = soma dos movimentos", async () => {
    const saida = (n: number) => `
      begin;
      set role authenticated;
      select set_config('request.jwt.claims', '{"sub":"${ADM}"}', true);
      select public.fn_clinic_estoque_perda('${ORG}', '{"lote_id":"${lote}","local_id":"${local}","quantidade":100,"motivo":"Concorrência ${n}"}'::jsonb);
      select pg_sleep(0.3);
      commit;
    `;
    const [a, b] = await Promise.all([sqlAsync(saida(1)), sqlAsync(saida(2))]);
    expect([a, b].filter((x) => x !== null)).toHaveLength(0);
    expect(qtd(PROD)).toBe("1");
    expect(qtd(PROD)).toBe(somaEmFrascos(PROD));
  });
});

describe("superfície", () => {
  it("as funções da sincronia não são executáveis por authenticated nem anon", () => {
    for (const papel of ["authenticated", "anon"]) {
      expect(
        ultima(
          sql(`select bool_or(has_function_privilege('${papel}', p.oid, 'execute'))
                 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public'
                  and p.proname in ('fn_clinic_estoque_sincronizar', 'fn_clinic_estoque_qtd_catalogo',
                                    'fn_clinic_estoque_gerencia', 'fn_clinic_estoque_movimentos_sincronizar',
                                    'fn_clinic_produto_estoque_sincronizar', 'fn_clinic_catalogo_quantidade_do_estoque');`),
        ),
      ).toBe("f");
    }
    expect(erro(fn(ADM, "fn_clinic_estoque_sincronizar", `'${ORG}', array['${PROD}']::uuid[]`))).toMatch(/permission denied/);
  });
});
