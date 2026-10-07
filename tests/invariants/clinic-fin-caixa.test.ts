/**
 * clinic (fork, financeiro FN3) — migration 9041: caixa diário.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. abrir: opção ligada, permissão financeiro.caixa, uma sessão aberta por conta;
 *   2. fundo de troco, suprimento e sangria NÃO viram lançamento; caixa pequeno
 *      vira saída paga; sangria acima do que tem na gaveta é recusada;
 *   3. esperado = fundo + lançamentos pagos na conta + suprimento − sangria;
 *   4. fechar sem diferença e abaixo do limite encerra direto; com diferença
 *      espera a conferência de OUTRA pessoa com financeiro.conferir; a
 *      diferença vira lançamento `cash`;
 *   5. sessão fechada e movimentos não se alteram;
 *   6. o resumo do dia: entradas, saídas, saldo, categorias;
 *   7. isolamento entre empresas; anon não executa.
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
const dados = (o: unknown) => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;
const fn = (ator: string, nome: string, args: string) => como(ator, `select public.${nome}(${args});`);

const ORG = "f3000000-0000-4000-8000-00000000000a";
const ORG_B = "f3000000-0000-4000-8000-00000000000b";
const ADM = "f3000000-1111-4000-8000-0000000000a1";
const RECEPCAO = "f3000000-1111-4000-8000-0000000000a2";
const GERENTE = "f3000000-1111-4000-8000-0000000000a3";
const ADM_B = "f3000000-1111-4000-8000-0000000000b1";
const GAVETA = "f3000000-4444-4000-8000-00000000000a";
const GAVETA2 = "f3000000-4444-4000-8000-00000000000b";
const PLANO_DESPESA = "f3000000-5555-4000-8000-00000000000a";

let caixa = "";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'fin3-adm@invariant.test'), ('${RECEPCAO}', 'fin3-rec@invariant.test'),
      ('${GERENTE}', 'fin3-ger@invariant.test'), ('${ADM_B}', 'fin3-adm-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'fin3-inv-a', 'Financeiro3 Invariant A', 'Fin3 A', '{"clinic":{}}'::jsonb),
      ('${ORG_B}', 'fin3-inv-b', 'Financeiro3 Invariant B', 'Fin3 B', '{"clinic":{"financeiro_avancado":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${RECEPCAO}', '${ORG}', 'agent', now()),
      ('${GERENTE}', '${ORG}', 'manager', now()), ('${ADM_B}', '${ORG_B}', 'admin', now())
      on conflict do nothing;
    insert into public.financial_accounts (id, organization_id, name, kind) values
      ('${GAVETA}', '${ORG}', 'Gaveta da recepção', 'cash'), ('${GAVETA2}', '${ORG}', 'Gaveta 2', 'cash')
      on conflict (id) do nothing;
    insert into public.account_plans (id, organization_id, name, direction) values
      ('${PLANO_DESPESA}', '${ORG}', 'Material de escritório', 'out') on conflict (id) do nothing;
  `);
});

describe("abrir", () => {
  it("opção desligada recusa; ligada abre uma sessão por conta", () => {
    expect(erro(fn(RECEPCAO, "fn_clinic_fin_caixa_abrir", `'${ORG}', '${GAVETA}', 20000`))).toMatch(/financeiro_avancado_desligado/);
    sql(fn(ADM, "fn_clinic_definir_financeiro_avancado", `'${ORG}', true`));
    caixa = json<{ id: string }>(sql(fn(RECEPCAO, "fn_clinic_fin_caixa_abrir", `'${ORG}', '${GAVETA}', 20000`))).id;
    expect(erro(fn(RECEPCAO, "fn_clinic_fin_caixa_abrir", `'${ORG}', '${GAVETA}', 0`))).toMatch(/fin_caixa_ja_aberto/);
  });
});

describe("movimentos e esperado", () => {
  it("fundo, suprimento e sangria não viram lançamento; caixa pequeno vira saída paga", () => {
    sql(fn(RECEPCAO, "fn_clinic_fin_caixa_movimentar", `'${ORG}', '${caixa}', 'suprimento', 10000, 'Troco do cofre', null`));
    // venda em dinheiro de R$ 150 entra na gaveta
    sql(`insert into public.financial_entries (organization_id, account_id, direction, amount_cents, status, paid_at, origin)
         values ('${ORG}', '${GAVETA}', 'in', 15000, 'paid', now(), 'sale');`);
    sql(fn(RECEPCAO, "fn_clinic_fin_caixa_movimentar", `'${ORG}', '${caixa}', 'caixa_pequeno', 2500, 'Canetas', '${PLANO_DESPESA}'`));
    const r = json<{ esperado_cents: number }>(
      sql(fn(RECEPCAO, "fn_clinic_fin_caixa_movimentar", `'${ORG}', '${caixa}', 'sangria', 12000, 'Depósito no banco', null`)),
    );
    // 20000 + 10000 + 15000 − 2500 − 12000
    expect(r.esperado_cents).toBe(30500);
    expect(
      ultima(sql(`select count(*) || '|' || sum(amount_cents) from public.financial_entries where account_id = '${GAVETA}' and origin = 'cash';`)),
    ).toBe("1|2500");
    expect(erro(fn(RECEPCAO, "fn_clinic_fin_caixa_movimentar", `'${ORG}', '${caixa}', 'sangria', 999999, 'Demais', null`))).toMatch(
      /fin_caixa_sem_saldo/,
    );
    expect(erro(fn(RECEPCAO, "fn_clinic_fin_caixa_movimentar", `'${ORG}', '${caixa}', 'sangria', 100, 'Com plano', '${PLANO_DESPESA}'`))).toMatch(
      /fin_dados_invalidos/,
    );
  });
});

describe("fechar e conferir", () => {
  it("com diferença: espera a conferência de outra pessoa; a falta vira lançamento", () => {
    // contou R$ 300 (200 × 1 + 50 × 2), esperado R$ 305 → falta R$ 5
    const r = json<{ diferenca_cents: number; precisa_conferencia: boolean }>(
      sql(fn(RECEPCAO, "fn_clinic_fin_caixa_fechar", `'${ORG}', '${caixa}', ${dados({ "20000": 1, "5000": 2 })}, 'Faltou troco'`)),
    );
    expect(r).toMatchObject({ diferenca_cents: -500, precisa_conferencia: true });
    expect(erro(fn(RECEPCAO, "fn_clinic_fin_caixa_movimentar", `'${ORG}', '${caixa}', 'suprimento', 100, 'Depois', null`))).toMatch(
      /fin_caixa_fechado/,
    );
    // a recepção não confere (sem permissão) e quem fechou não confere o próprio
    expect(erro(fn(RECEPCAO, "fn_clinic_fin_caixa_conferir", `'${ORG}', '${caixa}'`))).toMatch(/acesso_proibido/);
    sql(fn(GERENTE, "fn_clinic_fin_caixa_conferir", `'${ORG}', '${caixa}'`));
    expect(
      ultima(sql(`select c.status || '|' || (c.conferido_por = '${GERENTE}') || '|' || e.direction || ':' || e.amount_cents || ':' || e.origin
                    from public.clinic_fin_caixas c join public.financial_entries e on e.id = c.diferenca_entry_id where c.id = '${caixa}';`)),
    ).toBe("fechado|true|out:500:cash");
  });
  it("quem fechou não confere o próprio caixa", () => {
    const c = json<{ id: string }>(sql(fn(GERENTE, "fn_clinic_fin_caixa_abrir", `'${ORG}', '${GAVETA2}', 1000`))).id;
    sql(fn(GERENTE, "fn_clinic_fin_caixa_fechar", `'${ORG}', '${c}', ${dados({ "500": 1 })}, null`));
    expect(erro(fn(GERENTE, "fn_clinic_fin_caixa_conferir", `'${ORG}', '${c}'`))).toMatch(/fin_conferencia_mesma_pessoa/);
    sql(fn(ADM, "fn_clinic_fin_caixa_conferir", `'${ORG}', '${c}'`));
  });
  it("sem diferença e abaixo do limite: encerra direto, sem lançamento", () => {
    const c = json<{ id: string }>(sql(fn(RECEPCAO, "fn_clinic_fin_caixa_abrir", `'${ORG}', '${GAVETA2}', 5000`))).id;
    const r = json<{ precisa_conferencia: boolean }>(
      sql(fn(RECEPCAO, "fn_clinic_fin_caixa_fechar", `'${ORG}', '${c}', ${dados({ "5000": 1 })}, null`)),
    );
    expect(r.precisa_conferencia).toBe(false);
    expect(ultima(sql(`select status || '|' || (diferenca_entry_id is null) from public.clinic_fin_caixas where id = '${c}';`))).toBe("fechado|true");
  });
  it("acima do limite da clínica exige conferência mesmo sem diferença", () => {
    sql(fn(ADM, "fn_clinic_fin_config_salvar", `'${ORG}', ${dados({ limite_conferencia_cents: 1000 })}`));
    const c = json<{ id: string }>(sql(fn(RECEPCAO, "fn_clinic_fin_caixa_abrir", `'${ORG}', '${GAVETA2}', 5000`))).id;
    const r = json<{ precisa_conferencia: boolean; diferenca_cents: number }>(
      sql(fn(RECEPCAO, "fn_clinic_fin_caixa_fechar", `'${ORG}', '${c}', ${dados({ "5000": 1 })}, null`)),
    );
    expect(r).toMatchObject({ precisa_conferencia: true, diferenca_cents: 0 });
    expect(erro(fn(RECEPCAO, "fn_clinic_fin_caixa_fechar", `'${ORG}', '${c}', ${dados({ "x": 1 })}, null`))).toMatch(
      /fin_caixa_fechado|fin_contagem_invalida/,
    );
  });
  it("contagem inválida é recusada", () => {
    const novo = json<{ id: string }>(sql(fn(RECEPCAO, "fn_clinic_fin_caixa_abrir", `'${ORG}', '${GAVETA}', 0`))).id;
    expect(erro(fn(RECEPCAO, "fn_clinic_fin_caixa_fechar", `'${ORG}', '${novo}', ${dados({ abc: 1 })}, null`))).toMatch(
      /fin_contagem_invalida/,
    );
    expect(erro(fn(RECEPCAO, "fn_clinic_fin_caixa_fechar", `'${ORG}', '${novo}', ${dados({ "100": -1 })}, null`))).toMatch(
      /fin_contagem_invalida/,
    );
  });
});

describe("imutabilidade, resumo e isolamento", () => {
  it("sessão fechada e movimentos não se alteram; ninguém escreve direto", () => {
    expect(erro(`update public.clinic_fin_caixas set contado_cents = 1 where id = '${caixa}';`)).toMatch(/fin_caixa_imutavel/);
    expect(erro(`delete from public.clinic_fin_caixa_movimentos where caixa_id = '${caixa}';`)).toMatch(/fin_caixa_imutavel/);
    expect(erro(como(ADM, `insert into public.clinic_fin_caixas (organization_id, account_id, aberto_por) values ('${ORG}', '${GAVETA}', '${ADM}');`))).toMatch(
      /permission denied/,
    );
  });
  it("o resumo do dia soma entradas e saídas pagas e separa por categoria", () => {
    const hoje = ultima(sql(`select public.fn_clinic_fin_hoje('${ORG}')::text;`));
    const r = json<{ entradas_cents: number; saidas_cents: number; saldo_cents: number; por_categoria: Array<{ categoria: string }> }>(
      sql(fn(RECEPCAO, "fn_clinic_fin_dia", `'${ORG}', '${hoje}'`)),
    );
    expect(r.entradas_cents).toBe(15000);
    // caixa pequeno 2500 + falta 500 (gaveta 1) + falta 500 (gaveta 2: fundo 1000, contou 500)
    expect(r.saidas_cents).toBe(3500);
    expect(r.saldo_cents).toBe(11500);
    expect(r.por_categoria.map((c) => c.categoria)).toEqual(
      expect.arrayContaining(["Vendas", "Material de escritório", "Caixa (caixa pequeno, sobras e faltas)"]),
    );
  });
  it("outra empresa não lê nem mexe", () => {
    for (const t of ["clinic_fin_caixas", "clinic_fin_caixa_movimentos"]) {
      expect(ultima(sql(como(ADM_B, `select count(*) from public.${t} where organization_id = '${ORG}';`)))).toBe("0");
    }
    expect(erro(fn(ADM_B, "fn_clinic_fin_caixa_abrir", `'${ORG_B}', '${GAVETA}', 0`))).toMatch(/fin_conta_invalida/);
    const aberto = ultima(sql(`select id from public.clinic_fin_caixas where organization_id = '${ORG}' and status = 'aberto' limit 1;`));
    expect(erro(fn(ADM_B, "fn_clinic_fin_caixa_movimentar", `'${ORG_B}', '${aberto}', 'suprimento', 100, 'Invasão', null`))).toMatch(
      /fin_caixa_invalido/,
    );
    expect(erro(fn(ADM_B, "fn_clinic_fin_dia", `'${ORG}', current_date`))).toMatch(/acesso_proibido/);
  });
  it("anon não executa", () => {
    expect(erro(`set role anon; select public.fn_clinic_fin_caixa_abrir('${ORG}', '${GAVETA}', 0);`)).toMatch(/permission denied/);
  });
});
