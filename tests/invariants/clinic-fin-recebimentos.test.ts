/**
 * clinic (fork, financeiro FN2) — migration 9040: recebimentos e parcelas.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. opção desligada recusa; o fechamento do núcleo continua igual;
 *   2. pagamento dividido: a soma tem de bater o total; crédito 6x vira 6
 *      contas a receber + 6 taxas (competência hoje, vencimentos D+30…), o
 *      dinheiro entra pago; taxa congelada (vigência e %); idempotente;
 *   3. comissão sobre o LÍQUIDO (padrão) e sobre o bruto (configurável);
 *   4. baixa manual, baixa automática no vencimento (cron), antecipação;
 *   5. estorno: tudo contra-lançado, a comanda soma zero; parcelas estornadas;
 *   6. pagamento e parcela não se alteram por fora das funções;
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

const ORG = "f2000000-0000-4000-8000-00000000000a";
const ORG_B = "f2000000-0000-4000-8000-00000000000b";
const ORG_OFF = "f2000000-0000-4000-8000-00000000000c";
const ADM = "f2000000-1111-4000-8000-0000000000a1";
const PROF = "f2000000-1111-4000-8000-0000000000a2";
const ADM_B = "f2000000-1111-4000-8000-0000000000b1";
const ADM_OFF = "f2000000-1111-4000-8000-0000000000c1";
const CONTA = "f2000000-4444-4000-8000-00000000000a";
const CARTAO = "f2000000-3333-4000-8000-00000000000a";
const PIX = "f2000000-3333-4000-8000-00000000000b";
const DINHEIRO = "f2000000-3333-4000-8000-00000000000c";
const CONTA_OFF = "f2000000-4444-4000-8000-00000000000c";
const FORMA_OFF = "f2000000-3333-4000-8000-00000000000d";

let numero = 1000;
/** Comanda aberta: item de R$ 3.000 de PROF a 40% e item de R$ 500 sem profissional. */
function comanda(org = ORG): string {
  numero += 1;
  return ultima(
    sql(`
      with s as (
        insert into public.sales (organization_id, number) values ('${org}', ${numero}) returning id
      ), i as (
        insert into public.sale_items (organization_id, sale_id, description, attendant_user_id, unit_price_cents, total_cents, commission_percent)
        select '${org}'::uuid, s.id, 'Procedimento fictício', '${PROF}'::uuid, 300000, 300000, 40 from s
        union all
        select '${org}'::uuid, s.id, 'Produto fictício', null::uuid, 50000, 50000, 0 from s
        returning 1
      )
      select id from s;`),
  );
}
const finalizar = (sale: string, pagamentos: unknown[], ator = ADM, org = ORG) =>
  fn(ator, "fn_clinic_fin_finalizar", `'${org}', '${sale}', ${dados(pagamentos)}, 0`);

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'fin2-adm@invariant.test'), ('${PROF}', 'fin2-prof@invariant.test'),
      ('${ADM_B}', 'fin2-adm-b@invariant.test'), ('${ADM_OFF}', 'fin2-adm-off@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'fin2-inv-a', 'Financeiro2 Invariant A', 'Fin2 A', '{"clinic":{}}'::jsonb),
      ('${ORG_B}', 'fin2-inv-b', 'Financeiro2 Invariant B', 'Fin2 B', '{"clinic":{"financeiro_avancado":true}}'::jsonb),
      ('${ORG_OFF}', 'fin2-inv-c', 'Financeiro2 Invariant C', 'Fin2 C', '{"clinic":{}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${PROF}', '${ORG}', 'agent', now()),
      ('${ADM_B}', '${ORG_B}', 'admin', now()), ('${ADM_OFF}', '${ORG_OFF}', 'admin', now())
      on conflict do nothing;
    insert into public.financial_accounts (id, organization_id, name, kind) values
      ('${CONTA}', '${ORG}', 'Banco fictício', 'bank'), ('${CONTA_OFF}', '${ORG_OFF}', 'Banco C', 'bank')
      on conflict (id) do nothing;
    insert into public.payment_methods (id, organization_id, name, account_id) values
      ('${CARTAO}', '${ORG}', 'Cartão', '${CONTA}'), ('${PIX}', '${ORG}', 'Pix', '${CONTA}'),
      ('${DINHEIRO}', '${ORG}', 'Dinheiro', '${CONTA}'), ('${FORMA_OFF}', '${ORG_OFF}', 'Dinheiro C', '${CONTA_OFF}')
      on conflict (id) do nothing;
  `);
  sql(fn(ADM, "fn_clinic_definir_financeiro_avancado", `'${ORG}', true`));
  const adq = json<{ id: string }>(
    sql(
      fn(
        ADM,
        "fn_clinic_fin_adquirente_salvar",
        `'${ORG}', null, ${dados({ nome: "Maquininha fictícia", prazo_pix_dias: 0, prazo_debito_dias: 1, prazo_credito_dias: 30, antecipacao_pct: 1.5, antecipacao_modo: "por_mes" })}`,
      ),
    ),
  ).id;
  sql(
    fn(
      ADM,
      "fn_clinic_fin_tabela_publicar",
      `'${ORG}', '${adq}', '2026-01-01', ${dados([
        { bandeira: null, modalidade: "pix", parcelas_de: 1, parcelas_ate: 1, mdr_pct: 0.99 },
        { bandeira: null, modalidade: "credito", parcelas_de: 1, parcelas_ate: 1, mdr_pct: 4.3 },
        { bandeira: null, modalidade: "credito", parcelas_de: 2, parcelas_ate: 12, mdr_pct: 11.3 },
      ])}`,
    ),
  );
  sql(fn(ADM, "fn_clinic_fin_forma_salvar", `'${ORG}', '${CARTAO}', 'credito', '${adq}'`));
  sql(fn(ADM, "fn_clinic_fin_forma_salvar", `'${ORG}', '${PIX}', 'pix', '${adq}'`));
  sql(fn(ADM, "fn_clinic_fin_forma_salvar", `'${ORG}', '${DINHEIRO}', 'dinheiro', null`));
});

describe("opção", () => {
  it("desligada recusa; o fechamento do núcleo continua funcionando", () => {
    const s = comanda(ORG_OFF);
    expect(erro(finalizar(s, [{ payment_method_id: FORMA_OFF, valor_cents: 350000 }], ADM_OFF, ORG_OFF))).toMatch(
      /financeiro_avancado_desligado/,
    );
    const r = json<{ total_cents: number }>(sql(fn(ADM_OFF, "fn_finalizar_comanda", `'${ORG_OFF}', '${s}', '${FORMA_OFF}', 0`)));
    expect(r.total_cents).toBe(350000);
  });
});

let vendaCartao = "";

describe("pagamento dividido, parcelas e taxa", () => {
  it("a soma tem de bater o total", () => {
    const s = comanda();
    expect(erro(finalizar(s, [{ payment_method_id: DINHEIRO, valor_cents: 349999 }]))).toMatch(/fin_soma_diferente/);
    expect(erro(finalizar(s, [{ payment_method_id: DINHEIRO, valor_cents: 350000, parcelas: 2 }]))).toMatch(
      /fin_parcelas_invalidas/,
    );
  });
  it("crédito 6x + dinheiro: 6 a receber, 6 taxas, dinheiro pago; comissão sobre o líquido", () => {
    vendaCartao = comanda();
    const r = json<{ total_cents: number; liquido_cents: number; comissao_base: string }>(
      sql(
        finalizar(vendaCartao, [
          { payment_method_id: CARTAO, valor_cents: 300000, parcelas: 6 },
          { payment_method_id: DINHEIRO, valor_cents: 50000 },
        ]),
      ),
    );
    expect(r.total_cents).toBe(350000);
    // 300000 × 11,30% = 33900 de taxa
    expect(r.liquido_cents).toBe(350000 - 33900);
    expect(r.comissao_base).toBe("liquido");
    const resumo = ultima(
      sql(`select
        (select count(*) from public.clinic_fin_parcelas where sale_id = '${vendaCartao}')
        || '|' || (select sum(bruto_cents) from public.clinic_fin_parcelas where sale_id = '${vendaCartao}')
        || '|' || (select count(*) from public.financial_entries where sale_id = '${vendaCartao}' and origin = 'receivable' and status = 'pending')
        || '|' || (select sum(amount_cents) from public.financial_entries where sale_id = '${vendaCartao}' and origin = 'card_fee')
        || '|' || (select string_agg(status || ':' || amount_cents, ',') from public.financial_entries where sale_id = '${vendaCartao}' and origin = 'sale')
        || '|' || (select count(*) from public.financial_entries where sale_id = '${vendaCartao}' and competence_date = public.fn_clinic_fin_hoje('${ORG}'))
        || '|' || (select min(due_date - competence_date) || '-' || max(due_date - competence_date) from public.financial_entries where sale_id = '${vendaCartao}' and origin = 'receivable');`),
    );
    expect(resumo).toBe("6|300000|6|33900|paid:50000|13|30-180");
    // comissão: 300000 × 40% × (316100 ÷ 350000) = 108377,14 → 108377
    expect(ultima(sql(`select c.amount_cents from public.commissions c join public.sale_items i on i.id = c.sale_item_id where i.sale_id = '${vendaCartao}';`))).toBe(
      "108377",
    );
    // a taxa está congelada no pagamento
    expect(ultima(sql(`select mdr_pct::float8 || '|' || (tabela_id is not null) from public.clinic_fin_pagamentos where sale_id = '${vendaCartao}' and modalidade = 'credito';`))).toBe(
      "11.3|true",
    );
  });
  it("idempotente: chamar de novo não lança nada em dobro", () => {
    const r = json<{ ja_finalizada: boolean }>(sql(finalizar(vendaCartao, [{ payment_method_id: DINHEIRO, valor_cents: 350000 }])));
    expect(r.ja_finalizada).toBe(true);
    expect(ultima(sql(`select count(*) from public.clinic_fin_pagamentos where sale_id = '${vendaCartao}';`))).toBe("2");
  });
  it("Pix pela maquininha D+0 entra recebido na hora, com a taxa paga", () => {
    const s = comanda();
    sql(finalizar(s, [{ payment_method_id: PIX, valor_cents: 350000 }]));
    expect(
      ultima(sql(`select string_agg(origin || ':' || status, ',' order by origin) from public.financial_entries where sale_id = '${s}';`)),
    ).toBe("card_fee:paid,receivable:paid");
    expect(ultima(sql(`select status from public.clinic_fin_parcelas where sale_id = '${s}';`))).toBe("recebida");
  });
  it("comissão sobre o bruto quando a clínica escolhe", () => {
    sql(fn(ADM, "fn_clinic_fin_config_salvar", `'${ORG}', ${dados({ comissao_base: "bruto" })}`));
    const s = comanda();
    sql(finalizar(s, [{ payment_method_id: CARTAO, valor_cents: 350000, parcelas: 3 }]));
    expect(ultima(sql(`select c.amount_cents from public.commissions c join public.sale_items i on i.id = c.sale_item_id where i.sale_id = '${s}';`))).toBe(
      "120000",
    );
    sql(fn(ADM, "fn_clinic_fin_config_salvar", `'${ORG}', ${dados({ comissao_base: "liquido" })}`));
    expect(erro(fn(ADM, "fn_clinic_fin_config_salvar", `'${ORG}', ${dados({ outra: 1 })}`))).toMatch(/fin_dados_invalidos/);
  });
  it("custo direto da comanda: comissão estimada (insumos só com estoque.custos)", () => {
    const s = comanda();
    const c = json<{ comissao_cents: number; insumos_visiveis: boolean }>(sql(fn(ADM, "fn_clinic_fin_custo_da_comanda", `'${ORG}', '${s}'`)));
    expect(c.comissao_cents).toBe(120000);
  });
});

describe("recebimento", () => {
  it("baixa manual: a parcela e as duas entradas viram pagas; não baixa duas vezes", () => {
    const p = ultima(sql(`select id from public.clinic_fin_parcelas where sale_id = '${vendaCartao}' and n = 1;`));
    sql(fn(ADM, "fn_clinic_fin_receber_parcela", `'${ORG}', '${p}'`));
    expect(
      ultima(sql(`select p.status || '|' || e.status || '|' || t.status from public.clinic_fin_parcelas p
                   join public.financial_entries e on e.id = p.entrada_id join public.financial_entries t on t.id = p.taxa_id
                  where p.id = '${p}';`)),
    ).toBe("recebida|paid|paid");
    expect(erro(fn(ADM, "fn_clinic_fin_receber_parcela", `'${ORG}', '${p}'`))).toMatch(/fin_parcela_fechada/);
  });
  it("cron: a parcela que venceu é baixada; a que não venceu, não", () => {
    const p = ultima(sql(`select id from public.clinic_fin_parcelas where sale_id = '${vendaCartao}' and n = 2;`));
    sql(`set session_replication_role = replica;
         update public.clinic_fin_parcelas set vencimento = current_date - 400 where id = '${p}';`);
    const n = Number(ultima(sql(`set role service_role; select public.fn_clinic_fin_baixar_vencidas();`)));
    expect(n).toBeGreaterThanOrEqual(1);
    expect(ultima(sql(`select status from public.clinic_fin_parcelas where id = '${p}';`))).toBe("recebida");
    expect(ultima(sql(`select count(*) from public.clinic_fin_parcelas where sale_id = '${vendaCartao}' and status = 'prevista';`))).toBe("4");
    expect(erro(como(ADM, `select public.fn_clinic_fin_baixar_vencidas();`))).toMatch(/permission denied/);
  });
  it("antecipação: simular não muda nada; confirmar baixa as previstas e lança o custo", () => {
    const pag = ultima(sql(`select id from public.clinic_fin_pagamentos where sale_id = '${vendaCartao}' and modalidade = 'credito';`));
    const sim = json<{ parcelas: number; custo_cents: number }>(sql(fn(ADM, "fn_clinic_fin_antecipar", `'${ORG}', '${pag}', false`)));
    expect(sim.parcelas).toBe(4);
    expect(sim.custo_cents).toBeGreaterThan(0);
    expect(ultima(sql(`select count(*) from public.clinic_fin_parcelas where pagamento_id = '${pag}' and status = 'prevista';`))).toBe("4");
    const ok = json<{ custo_cents: number }>(sql(fn(ADM, "fn_clinic_fin_antecipar", `'${ORG}', '${pag}', true`)));
    expect(ok.custo_cents).toBe(sim.custo_cents);
    expect(
      ultima(sql(`select count(*) || '|' || sum(antecipacao_cents) from public.clinic_fin_parcelas where pagamento_id = '${pag}' and status = 'antecipada';`)),
    ).toBe(`4|${sim.custo_cents}`);
    expect(
      ultima(sql(`select amount_cents || '|' || status from public.financial_entries where sale_id = '${vendaCartao}' and origin = 'anticipation';`)),
    ).toBe(`${sim.custo_cents}|paid`);
    expect(erro(fn(ADM, "fn_clinic_fin_antecipar", `'${ORG}', '${pag}', true`))).toMatch(/fin_nada_a_antecipar/);
  });
});

describe("estorno", () => {
  it("contra-lança tudo: a comanda soma zero, parcelas estornadas, comissão revertida", () => {
    const s = comanda();
    sql(
      finalizar(s, [
        { payment_method_id: CARTAO, valor_cents: 200000, parcelas: 4 },
        { payment_method_id: DINHEIRO, valor_cents: 150000 },
      ]),
    );
    sql(fn(ADM, "fn_clinic_fin_estornar", `'${ORG}', '${s}', 'Lançamento de teste errado'`));
    expect(
      ultima(sql(`select sum(case when direction = 'in' then amount_cents else -amount_cents end) from public.financial_entries where sale_id = '${s}';`)),
    ).toBe("0");
    expect(ultima(sql(`select count(*) from public.financial_entries where sale_id = '${s}' and status = 'pending';`))).toBe("0");
    expect(ultima(sql(`select string_agg(distinct status, ',') from public.clinic_fin_parcelas where sale_id = '${s}';`))).toBe("estornada");
    expect(ultima(sql(`select c.status from public.commissions c join public.sale_items i on i.id = c.sale_item_id where i.sale_id = '${s}';`))).toBe(
      "reversed",
    );
    const de_novo = json<{ ja_estornada: boolean }>(sql(fn(ADM, "fn_clinic_fin_estornar", `'${ORG}', '${s}', 'de novo'`)));
    expect(de_novo.ja_estornada).toBe(true);
  });
});

describe("imutabilidade e isolamento", () => {
  it("pagamento e parcela não mudam por fora; ninguém escreve direto", () => {
    expect(erro(`update public.clinic_fin_pagamentos set bruto_cents = 1 where sale_id = '${vendaCartao}';`)).toMatch(
      /fin_recebimento_imutavel|clinic_fin_pagamentos_valores/,
    );
    expect(erro(`update public.clinic_fin_parcelas set bruto_cents = 1 where sale_id = '${vendaCartao}';`)).toMatch(
      /fin_recebimento_imutavel|clinic_fin_parcelas_valores/,
    );
    expect(erro(`delete from public.clinic_fin_parcelas where sale_id = '${vendaCartao}';`)).toMatch(/fin_recebimento_imutavel/);
    expect(erro(como(ADM, `update public.clinic_fin_parcelas set status = 'recebida' where sale_id = '${vendaCartao}';`))).toMatch(
      /permission denied/,
    );
  });
  it("outra empresa não lê nem fecha a comanda alheia", () => {
    for (const t of ["clinic_fin_pagamentos", "clinic_fin_parcelas"]) {
      expect(ultima(sql(como(ADM_B, `select count(*) from public.${t} where organization_id = '${ORG}';`)))).toBe("0");
    }
    const s = comanda();
    expect(erro(finalizar(s, [{ payment_method_id: DINHEIRO, valor_cents: 350000 }], ADM_B, ORG_B))).toMatch(
      /comanda_nao_encontrada/,
    );
    expect(erro(finalizar(s, [{ payment_method_id: DINHEIRO, valor_cents: 350000 }], ADM_B, ORG))).toMatch(/acesso_proibido/);
    const p = ultima(sql(`select id from public.clinic_fin_parcelas where organization_id = '${ORG}' limit 1;`));
    expect(erro(fn(ADM_B, "fn_clinic_fin_receber_parcela", `'${ORG_B}', '${p}'`))).toMatch(/fin_parcela_invalida/);
  });
  it("anon não executa", () => {
    expect(erro(`set role anon; select public.fn_clinic_fin_finalizar('${ORG}', '${vendaCartao}', '[]'::jsonb, 0);`)).toMatch(
      /permission denied/,
    );
  });
});
