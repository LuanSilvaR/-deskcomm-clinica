/**
 * clinic (fork, estoque E0) — migration 9028: base do estoque.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. opção desligada recusa; ligar cria o local padrão;
 *   2. entrada (com conversão de unidade), lote vencido recusado, lote
 *      obrigatório em produto rastreado;
 *   3. permissão: quem só vê (atendente) lê mas não movimenta;
 *   4. saldo = soma dos movimentos; transferência e perda nunca deixam saldo
 *      negativo — nem com duas saídas concorrentes no mesmo lote;
 *   5. movimentos e operações só acrescentam (UPDATE/DELETE recusados, até para
 *      service role); ninguém escreve direto;
 *   6. estorno inverte, uma vez só, e não estorna o que deixaria saldo negativo;
 *   7. isolamento entre empresas; anon não executa.
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

const ORG = "e5000000-0000-4000-8000-00000000000a";
const ORG_B = "e5000000-0000-4000-8000-00000000000b";
const ORG_OFF = "e5000000-0000-4000-8000-00000000000c";
const ADM = "e5000000-1111-4000-8000-0000000000a1";
const ATEND = "e5000000-1111-4000-8000-0000000000a2";
const ADM_B = "e5000000-1111-4000-8000-0000000000b1";
const ADM_OFF = "e5000000-1111-4000-8000-0000000000c1";
const PROD = "e5000000-2222-4000-8000-00000000000a";
const PROD_RASTREADO = "e5000000-2222-4000-8000-00000000000d";
const PROD_B = "e5000000-2222-4000-8000-00000000000b";
const PROD_OFF = "e5000000-2222-4000-8000-00000000000c";

const fn = (ator: string, nome: string, args: string) => como(ator, `select public.${nome}(${args});`);
const dados = (o: Record<string, unknown>) => `'${JSON.stringify(o)}'::jsonb`;
const saldo = (lote: string, local: string) =>
  ultima(
    sql(`select coalesce(sum(saldo), 0) from public.clinic_estoque_saldos
          where organization_id = '${ORG}' and lote_id = '${lote}' and local_id = '${local}';`),
  );
const somaDireta = (lote: string, local: string) =>
  ultima(
    sql(`select coalesce(sum(quantidade), 0) from public.clinic_estoque_movimentos
          where organization_id = '${ORG}' and lote_id = '${lote}' and local_id = '${local}';`),
  );

let localA = "";
let localB = "";
let lote = "";
let entrada = "";
let transferencia = "";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'est-adm@invariant.test'), ('${ATEND}', 'est-atend@invariant.test'),
      ('${ADM_B}', 'est-adm-b@invariant.test'), ('${ADM_OFF}', 'est-adm-off@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'est-inv-a', 'Estoque Invariant A', 'Estoque A', '{"clinic":{}}'::jsonb),
      ('${ORG_B}', 'est-inv-b', 'Estoque Invariant B', 'Estoque B', '{"clinic":{"estoque":true}}'::jsonb),
      ('${ORG_OFF}', 'est-inv-c', 'Estoque Invariant C', 'Estoque C', '{"clinic":{}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${ATEND}', '${ORG}', 'agent', now()),
      ('${ADM_B}', '${ORG_B}', 'admin', now()), ('${ADM_OFF}', '${ORG_OFF}', 'admin', now())
      on conflict do nothing;
    insert into public.catalog_products (id, organization_id, codigo, nome, preco_cents) values
      ('${PROD}', '${ORG}', 'TOX-100', 'Toxina fictícia 100 U', 0),
      ('${PROD_RASTREADO}', '${ORG}', 'PREENCH-1', 'Preenchedor fictício', 0),
      ('${PROD_B}', '${ORG_B}', 'B-1', 'Produto B', 0),
      ('${PROD_OFF}', '${ORG_OFF}', 'C-1', 'Produto C', 0)
      on conflict (id) do nothing;
  `);
});

describe("opção", () => {
  it("desligada recusa; ligar cria o local padrão", () => {
    expect(erro(fn(ADM_OFF, "fn_clinic_estoque_local_salvar", `'${ORG_OFF}', null, ${dados({ nome: "Sala 1" })}`))).toMatch(
      /estoque_desligado/,
    );
    sql(fn(ADM, "fn_clinic_definir_estoque", `'${ORG}', true`));
    expect(
      ultima(sql(`select nome || ':' || padrao from public.clinic_estoque_locais where organization_id = '${ORG}';`)),
    ).toBe("Estoque central:true");
    localA = ultima(sql(`select id from public.clinic_estoque_locais where organization_id = '${ORG}' and padrao;`));
    localB = json<{ id: string }>(
      sql(fn(ADM, "fn_clinic_estoque_local_salvar", `'${ORG}', null, ${dados({ nome: "Sala de procedimentos", tipo: "sala" })}`)),
    ).id;
  });
});

describe("entrada", () => {
  it("converte frasco em U, recusa lote vencido e exige lote em produto rastreado", () => {
    sql(
      fn(
        ADM,
        "fn_clinic_estoque_produto_salvar",
        `'${ORG}', '${PROD}', ${dados({ unidade_estoque: "frasco", unidade_aplicacao: "U", fator_conversao: 100 })}, null`,
      ),
    );
    const r = json<{ operacao_id: string; lote_id: string }>(
      sql(
        fn(
          ADM,
          "fn_clinic_estoque_entrada",
          `'${ORG}', ${dados({ product_id: PROD, local_id: localA, quantidade: 2, em_unidade_estoque: true, lote: "L1", validade: "2099-12-31", custo_unitario_cents: 100000 })}`,
        ),
      ),
    );
    lote = r.lote_id;
    entrada = r.operacao_id;
    expect(saldo(lote, localA)).toBe("200.000");
    expect(ultima(sql(`select custo_unitario_cents from public.clinic_estoque_lotes where id = '${lote}';`))).toBe("1000.0000");

    expect(
      erro(fn(ADM, "fn_clinic_estoque_entrada", `'${ORG}', ${dados({ product_id: PROD, local_id: localA, quantidade: 1, lote: "VELHO", validade: "2000-01-01" })}`)),
    ).toMatch(/estoque_lote_vencido/);

    sql(fn(ADM, "fn_clinic_estoque_produto_salvar", `'${ORG}', '${PROD_RASTREADO}', ${dados({ rastreado: true })}, null`));
    expect(
      erro(fn(ADM, "fn_clinic_estoque_entrada", `'${ORG}', ${dados({ product_id: PROD_RASTREADO, local_id: localA, quantidade: 1 })}`)),
    ).toMatch(/estoque_lote_obrigatorio/);
  });

  it("atendente lê, mas não movimenta; produto de outra empresa recusado", () => {
    expect(ultima(sql(como(ATEND, `select count(*) from public.clinic_estoque_movimentos where organization_id = '${ORG}';`)))).toBe(
      "1",
    );
    expect(
      erro(fn(ATEND, "fn_clinic_estoque_entrada", `'${ORG}', ${dados({ product_id: PROD, local_id: localA, quantidade: 1 })}`)),
    ).toMatch(/acesso_proibido/);
    expect(
      erro(fn(ADM, "fn_clinic_estoque_entrada", `'${ORG}', ${dados({ product_id: PROD_B, local_id: localA, quantidade: 1 })}`)),
    ).toMatch(/estoque_produto_invalido/);
  });
});

describe("saldo nunca negativo", () => {
  it("transferência e perda; saldo da view = soma dos movimentos", () => {
    transferencia = json<{ operacao_id: string }>(
      sql(fn(ADM, "fn_clinic_estoque_transferir", `'${ORG}', ${dados({ lote_id: lote, origem_id: localA, destino_id: localB, quantidade: 50 })}`)),
    ).operacao_id;
    expect(saldo(lote, localA)).toBe("150.000");
    expect(saldo(lote, localB)).toBe("50.000");
    expect(
      erro(fn(ADM, "fn_clinic_estoque_transferir", `'${ORG}', ${dados({ lote_id: lote, origem_id: localB, destino_id: localA, quantidade: 51 })}`)),
    ).toMatch(/estoque_insuficiente/);
    expect(erro(fn(ADM, "fn_clinic_estoque_perda", `'${ORG}', ${dados({ lote_id: lote, local_id: localB, quantidade: 5 })}`))).toMatch(
      /estoque_sem_motivo/,
    );
    sql(fn(ADM, "fn_clinic_estoque_perda", `'${ORG}', ${dados({ lote_id: lote, local_id: localB, quantidade: 5, motivo: "Frasco quebrado" })}`));
    expect(saldo(lote, localB)).toBe("45.000");
    expect(somaDireta(lote, localB)).toBe("45.000");
  });

  it("duas saídas concorrentes do mesmo lote: só uma passa", async () => {
    const saida = (n: number) => `
      begin;
      set role authenticated;
      select set_config('request.jwt.claims', '{"sub":"${ADM}"}', true);
      select public.fn_clinic_estoque_perda('${ORG}', '{"lote_id":"${lote}","local_id":"${localB}","quantidade":30,"motivo":"Concorrência ${n}"}'::jsonb);
      select pg_sleep(1);
      commit;`;
    const [a, b] = await Promise.all([sqlAsync(saida(1)), sqlAsync(saida(2))]);
    const falhas = [a, b].filter((x) => x !== null);
    expect(falhas).toHaveLength(1);
    expect(falhas[0]).toMatch(/estoque_insuficiente/);
    expect(saldo(lote, localB)).toBe("15.000");
  });

  it("ajuste leva ao saldo contado", () => {
    expect(erro(fn(ATEND, "fn_clinic_estoque_ajustar", `'${ORG}', ${dados({ lote_id: lote, local_id: localA, saldo_correto: 1, motivo: "Contagem" })}`))).toMatch(
      /acesso_proibido/,
    );
    const r = json<{ diferenca: number }>(
      sql(fn(ADM, "fn_clinic_estoque_ajustar", `'${ORG}', ${dados({ lote_id: lote, local_id: localA, saldo_correto: 148, motivo: "Contagem" })}`)),
    );
    expect(r.diferenca).toBe(-2);
    expect(saldo(lote, localA)).toBe("148.000");
  });
});

describe("só acrescenta", () => {
  it("UPDATE/DELETE recusados (até para postgres e service role); ninguém insere direto", () => {
    expect(erro(`update public.clinic_estoque_movimentos set quantidade = 999 where organization_id = '${ORG}';`)).toMatch(
      /estoque_imutavel/,
    );
    expect(erro(`delete from public.clinic_estoque_operacoes where organization_id = '${ORG}';`)).toMatch(/estoque_imutavel/);
    expect(erro(`set role service_role; delete from public.clinic_estoque_movimentos where organization_id = '${ORG}';`)).toMatch(
      /permission denied/,
    );
    expect(
      erro(
        como(
          ADM,
          `insert into public.clinic_estoque_operacoes (organization_id, tipo) values ('${ORG}', 'entrada');`,
        ),
      ),
    ).toMatch(/permission denied/);
  });
});

describe("estorno", () => {
  it("inverte uma vez só; não estorna estorno; não deixa saldo negativo", () => {
    // a 1ª transferência (50) já foi consumida na Sala: estorná-la deixaria a Sala negativa
    expect(erro(fn(ADM, "fn_clinic_estoque_estornar", `'${ORG}', '${transferencia}', 'Transferência errada'`))).toMatch(
      /estoque_insuficiente/,
    );
    const nova = json<{ operacao_id: string }>(
      sql(fn(ADM, "fn_clinic_estoque_transferir", `'${ORG}', ${dados({ lote_id: lote, origem_id: localA, destino_id: localB, quantidade: 10 })}`)),
    ).operacao_id;
    expect(saldo(lote, localA)).toBe("138.000");
    const est = json<{ operacao_id: string }>(
      sql(fn(ADM, "fn_clinic_estoque_estornar", `'${ORG}', '${nova}', 'Transferência errada'`)),
    ).operacao_id;
    expect(saldo(lote, localA)).toBe("148.000");
    expect(saldo(lote, localB)).toBe("15.000");
    expect(erro(fn(ADM, "fn_clinic_estoque_estornar", `'${ORG}', '${nova}', 'De novo'`))).toMatch(/estoque_ja_estornada/);
    expect(erro(fn(ADM, "fn_clinic_estoque_estornar", `'${ORG}', '${est}', 'Estorno do estorno'`))).toMatch(/estoque_estorno_de_estorno/);
    // a entrada já foi parcialmente usada: estornar deixaria o saldo negativo
    expect(erro(fn(ADM, "fn_clinic_estoque_estornar", `'${ORG}', '${entrada}', 'Nota errada'`))).toMatch(/estoque_insuficiente/);
  });
});

describe("isolamento e anon", () => {
  it("outra empresa não lê nem usa o lote", () => {
    expect(ultima(sql(como(ADM_B, `select count(*) from public.clinic_estoque_movimentos where organization_id = '${ORG}';`)))).toBe("0");
    expect(ultima(sql(como(ADM_B, `select count(*) from public.clinic_estoque_saldos where organization_id = '${ORG}';`)))).toBe("0");
    expect(ultima(sql(como(ADM_B, `select count(*) from public.clinic_estoque_lotes where organization_id = '${ORG}';`)))).toBe("0");
    expect(
      erro(fn(ADM_B, "fn_clinic_estoque_perda", `'${ORG_B}', ${dados({ lote_id: lote, local_id: localA, quantidade: 1, motivo: "Tentativa" })}`)),
    ).toMatch(/estoque_lote_invalido/);
    expect(
      erro(fn(ADM_B, "fn_clinic_estoque_entrada", `'${ORG}', ${dados({ product_id: PROD, local_id: localA, quantidade: 1 })}`)),
    ).toMatch(/acesso_proibido/);
  });

  it("anon não executa", () => {
    for (const f of [
      `public.fn_clinic_definir_estoque('${ORG}', true)`,
      `public.fn_clinic_estoque_entrada('${ORG}', '{}'::jsonb)`,
      `public.fn_clinic_estoque_estornar('${ORG}', '${entrada}', 'xxx')`,
    ]) {
      expect(erro(`set role anon; select ${f};`)).toMatch(/permission denied/);
    }
  });
});
