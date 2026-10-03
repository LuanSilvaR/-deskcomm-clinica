/**
 * clinic (fork, estoque E5) — migration 9033: compras pelo XML da NF-e.
 *
 * Prova no Postgres real, com o baseline aplicado (a leitura do XML é provada
 * em lib/clinic/estoque/nfe/parser.test.ts; aqui entram os dados já lidos):
 *   1. registrar: chave única por empresa; fornecedor pelo CNPJ; sugestão de
 *      produto de outra empresa vira nula; só com estoque.compras;
 *   2. conferir: produto da empresa; rastreado exige lote e validade; vencido
 *      recusado; ignorar item;
 *   3. lançar: só com tudo conferido; entrada por item com quantidade
 *      convertida e custo rateado; de/para aprendido; conta a pagar pendente só
 *      com financeiro.lancar; não lança duas vezes;
 *   4. cancelar só em conferência; isolamento; ninguém escreve direto.
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

const ORG = "ea000000-0000-4000-8000-00000000000a";
const ORG_B = "ea000000-0000-4000-8000-00000000000b";
const ADM = "ea000000-1111-4000-8000-0000000000a1";
const ATEND = "ea000000-1111-4000-8000-0000000000a2";
const ADM_B = "ea000000-1111-4000-8000-0000000000b1";
const TOX = "ea000000-2222-4000-8000-000000000001";
const GAZE = "ea000000-2222-4000-8000-000000000002";
const PROD_B = "ea000000-2222-4000-8000-0000000000bb";
const CONTA = "ea000000-7777-4000-8000-00000000000a";
const CONTA_B = "ea000000-7777-4000-8000-00000000000b";
const CHAVE = "35261000000000000191550010000012341000000017";
const CHAVE_2 = "35261000000000000191550010000012351000000012";

const fn = (ator: string, nome: string, args: string) => como(ator, `select public.${nome}(${args});`);
const dados = (o: unknown) => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;
const SHA = "a".repeat(64);

const nota = (chave: string, sugestaoTox: string | null = TOX) => ({
  chave,
  numero: "1234",
  serie: "1",
  emissao: "2026-09-30",
  emitente: { cnpj: "00000000000191", nome: "Distribuidora Fictícia" },
  destinatario_cnpj: "11111111000111",
  total_cents: 197050,
  sha256: SHA,
  arquivo_path: `${ORG}/${chave}.xml`,
  itens: [
    {
      numero: 1, codigo: "TOX-100", descricao: "TOXINA FICTICIA 100U", ean: "07891234567895", ncm: "30049099",
      unidade: "FR", quantidade: 2, valor_total_cents: 200000, custo_total_cents: 193550,
      rastro: [{ lote: "L-ABC", quantidade: 2, validade: "2099-01-31" }],
      product_id: sugestaoTox, origem_casamento: "ean", fator: 100, lote: "L-ABC", validade: "2099-01-31",
    },
    {
      numero: 2, codigo: "GZ-1", descricao: "GAZE FICTICIA", unidade: "PCT", quantidade: 10,
      valor_total_cents: 3500, custo_total_cents: 3500, product_id: null,
    },
    { numero: 3, codigo: "FRETE", descricao: "FRETE", unidade: "UN", quantidade: 1, valor_total_cents: 0, custo_total_cents: 0 },
  ],
});

let nfe = "";
const item = (n: number) => ultima(sql(`select id from public.clinic_estoque_nfe_itens where nfe_id = '${nfe}' and numero = ${n};`));

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'nfe-adm@invariant.test'), ('${ATEND}', 'nfe-atend@invariant.test'), ('${ADM_B}', 'nfe-adm-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'nfe-inv-a', 'NFe Invariant A', 'NFe A', '{"clinic":{}}'::jsonb),
      ('${ORG_B}', 'nfe-inv-b', 'NFe Invariant B', 'NFe B', '{"clinic":{"estoque":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${ATEND}', '${ORG}', 'agent', now()), ('${ADM_B}', '${ORG_B}', 'admin', now())
      on conflict do nothing;
    insert into public.catalog_products (id, organization_id, codigo, nome, preco_cents) values
      ('${TOX}', '${ORG}', 'N-TOX', 'Toxina fictícia', 0), ('${GAZE}', '${ORG}', 'N-GAZE', 'Gaze fictícia', 0),
      ('${PROD_B}', '${ORG_B}', 'N-B', 'Produto de B', 0)
      on conflict (id) do nothing;
    insert into public.financial_accounts (id, organization_id, name) values
      ('${CONTA}', '${ORG}', 'Caixa fictício'), ('${CONTA_B}', '${ORG_B}', 'Caixa de B')
      on conflict (id) do nothing;
  `);
  sql(fn(ADM, "fn_clinic_definir_estoque", `'${ORG}', true`));
  sql(
    fn(
      ADM,
      "fn_clinic_estoque_produto_salvar",
      `'${ORG}', '${TOX}', ${dados({ unidade_estoque: "frasco", unidade_aplicacao: "U", fator_conversao: 100, rastreado: true })}, null`,
    ),
  );
});

describe("registrar", () => {
  it("só com estoque.compras; fornecedor pelo CNPJ; chave única", () => {
    expect(erro(fn(ATEND, "fn_clinic_estoque_nfe_registrar", `'${ORG}', ${dados(nota(CHAVE))}`))).toMatch(/acesso_proibido/);
    nfe = json<{ id: string }>(sql(fn(ADM, "fn_clinic_estoque_nfe_registrar", `'${ORG}', ${dados(nota(CHAVE))}`))).id;
    expect(ultima(sql(`select status || ':' || (fornecedor_id is not null) from public.clinic_estoque_nfe where id = '${nfe}';`))).toBe(
      "conferencia:true",
    );
    expect(erro(fn(ADM, "fn_clinic_estoque_nfe_registrar", `'${ORG}', ${dados(nota(CHAVE))}`))).toMatch(/estoque_nfe_duplicada/);
    // a mesma chave em OUTRA empresa é outra nota; sugestão de produto alheio vira nula
    const b = json<{ id: string }>(sql(fn(ADM_B, "fn_clinic_estoque_nfe_registrar", `'${ORG_B}', ${dados(nota(CHAVE))}`))).id;
    expect(ultima(sql(`select product_id is null from public.clinic_estoque_nfe_itens where nfe_id = '${b}' and numero = 1;`))).toBe("t");
  });
});

describe("conferir e lançar", () => {
  it("não lança sem conferir; rastreado exige lote; vencido recusado; produto de outra empresa recusado", () => {
    const local = ultima(sql(`select id from public.clinic_estoque_locais where organization_id = '${ORG}' and padrao;`));
    expect(erro(fn(ADM, "fn_clinic_estoque_nfe_lancar", `'${ORG}', '${nfe}', ${dados({ local_id: local })}`))).toMatch(
      /estoque_nfe_sem_conferencia/,
    );
    expect(erro(fn(ADM, "fn_clinic_estoque_nfe_item_conferir", `'${ORG}', '${item(1)}', ${dados({ product_id: TOX, fator: 100 })}`))).toMatch(
      /estoque_lote_obrigatorio/,
    );
    expect(
      erro(fn(ADM, "fn_clinic_estoque_nfe_item_conferir", `'${ORG}', '${item(1)}', ${dados({ product_id: TOX, fator: 100, lote: "X", validade: "2000-01-01" })}`)),
    ).toMatch(/estoque_lote_vencido/);
    expect(erro(fn(ADM, "fn_clinic_estoque_nfe_item_conferir", `'${ORG}', '${item(2)}', ${dados({ product_id: PROD_B })}`))).toMatch(
      /estoque_produto_invalido/,
    );
    sql(fn(ADM, "fn_clinic_estoque_nfe_item_conferir", `'${ORG}', '${item(1)}', ${dados({ product_id: TOX, fator: 100, lote: "L-ABC", validade: "2099-01-31" })}`));
    sql(fn(ADM, "fn_clinic_estoque_nfe_item_conferir", `'${ORG}', '${item(2)}', ${dados({ product_id: GAZE, fator: 1 })}`));
    sql(fn(ADM, "fn_clinic_estoque_nfe_item_conferir", `'${ORG}', '${item(3)}', ${dados({ ignorar: true })}`));
    expect(ultima(sql(`select origem_casamento from public.clinic_estoque_nfe_itens where id = '${item(1)}';`))).toBe("ean");
    expect(ultima(sql(`select origem_casamento from public.clinic_estoque_nfe_itens where id = '${item(2)}';`))).toBe("manual");
  });

  it("conta a pagar só com financeiro.lancar e conta da empresa; lança entrada, custo e de/para", () => {
    const local = ultima(sql(`select id from public.clinic_estoque_locais where organization_id = '${ORG}' and padrao;`));
    expect(
      erro(fn(ADM, "fn_clinic_estoque_nfe_lancar", `'${ORG}', '${nfe}', ${dados({ local_id: local, conta_id: CONTA_B })}`)),
    ).toMatch(/estoque_conta_invalida/);
    const r = json<{ entradas: number; financial_entry_id: string }>(
      sql(fn(ADM, "fn_clinic_estoque_nfe_lancar", `'${ORG}', '${nfe}', ${dados({ local_id: local, conta_id: CONTA })}`)),
    );
    expect(r.entradas).toBe(2);
    // 2 frascos × 100 = 200 U; custo 193550 ÷ 200 = 967,75 centavos por U
    expect(
      ultima(
        sql(`select m.quantidade || ':' || m.custo_unitario_cents || ':' || l.codigo
               from public.clinic_estoque_movimentos m join public.clinic_estoque_lotes l on l.id = m.lote_id
              where m.organization_id = '${ORG}' and m.product_id = '${TOX}';`),
      ),
    ).toBe("200.000:967.7500:L-ABC");
    expect(
      ultima(sql(`select direction || ':' || amount_cents || ':' || status from public.financial_entries where id = '${r.financial_entry_id}';`)),
    ).toBe("out:197050:pending");
    expect(ultima(sql(`select count(*) from public.clinic_estoque_fornecedor_produtos where organization_id = '${ORG}';`))).toBe("2");
    expect(erro(fn(ADM, "fn_clinic_estoque_nfe_lancar", `'${ORG}', '${nfe}', ${dados({ local_id: local })}`))).toMatch(/estoque_nfe_fechada/);
    expect(erro(fn(ADM, "fn_clinic_estoque_nfe_cancelar", `'${ORG}', '${nfe}', 'Tarde demais'`))).toMatch(/estoque_nfe_fechada/);
  });
});

describe("cancelar e isolamento", () => {
  it("cancela em conferência com motivo; outra empresa não vê nem mexe; ninguém escreve direto", () => {
    const n2 = json<{ id: string }>(sql(fn(ADM, "fn_clinic_estoque_nfe_registrar", `'${ORG}', ${dados(nota(CHAVE_2))}`))).id;
    expect(erro(fn(ADM, "fn_clinic_estoque_nfe_cancelar", `'${ORG}', '${n2}', null`))).toMatch(/estoque_sem_motivo/);
    expect(erro(fn(ADM_B, "fn_clinic_estoque_nfe_cancelar", `'${ORG_B}', '${n2}', 'Tentativa'`))).toMatch(/estoque_nfe_invalida/);
    expect(
      erro(fn(ADM_B, "fn_clinic_estoque_nfe_item_conferir", `'${ORG_B}', '${item(2)}', ${dados({ ignorar: true })}`)),
    ).toMatch(/estoque_nfe_invalida/);
    sql(fn(ADM, "fn_clinic_estoque_nfe_cancelar", `'${ORG}', '${n2}', 'Nota enviada por engano'`));
    expect(ultima(sql(`select status from public.clinic_estoque_nfe where id = '${n2}';`))).toBe("cancelada");
    for (const t of ["clinic_estoque_nfe", "clinic_estoque_nfe_itens", "clinic_estoque_fornecedores", "clinic_estoque_fornecedor_produtos"]) {
      expect(ultima(sql(como(ADM_B, `select count(*) from public.${t} where organization_id = '${ORG}';`)))).toBe("0");
    }
    expect(
      erro(como(ADM, `insert into public.clinic_estoque_fornecedores (organization_id, cnpj, nome) values ('${ORG}', '22222222000122', 'X');`)),
    ).toMatch(/permission denied/);
  });
});
