/**
 * clinic (fork, financeiro FN1) — migration 9039: motor de taxas de maquininha.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. opção desligada recusa; permissão financeiro.taxas (atendente não configura);
 *   2. vigência: a taxa nunca muda o passado (linhas e tabelas imutáveis, até
 *      para o service role); só vigência FUTURA pode ser substituída; data no
 *      passado só na primeira tabela;
 *   3. PARIDADE: fn_clinic_fin_calcular devolve exatamente o que o motor TS
 *      (lib/clinic/financeiro/taxas.ts) calcula, em ~240 casos gerados;
 *   4. forma de pagamento: tipo e adquirente; adquirente de outra empresa recusada;
 *   5. isolamento entre empresas; sem financeiro.ver lê 0; anon não executa.
 */
import { execFileSync } from "node:child_process";

import { beforeAll, describe, expect, it } from "vitest";

import {
  BANDEIRAS,
  calcularRecebimento,
  ErroDeTaxa,
  type Adquirente,
  type Bandeira,
  type LinhaDeTaxa,
  type Modalidade,
  type Recebimento,
} from "../../lib/clinic/financeiro/taxas";

const container = process.env.TEST_DB_CONTAINER;
if (!container) {
  throw new Error("TEST_DB_CONTAINER not set — rode esta suíte via `pnpm test:db` (scripts/test-db.sh)");
}
const containerName: string = container;
const PSQL = ["exec", "-i", containerName, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-f", "-"];

function sql(script: string): string {
  return execFileSync("docker", PSQL, { input: script, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }).trim();
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

const ORG = "f1000000-0000-4000-8000-00000000000a";
const ORG_B = "f1000000-0000-4000-8000-00000000000b";
const ORG_OFF = "f1000000-0000-4000-8000-00000000000c";
const ADM = "f1000000-1111-4000-8000-0000000000a1";
const ATEND = "f1000000-1111-4000-8000-0000000000a2";
const ADM_B = "f1000000-1111-4000-8000-0000000000b1";
const ADM_OFF = "f1000000-1111-4000-8000-0000000000c1";
const FORMA = "f1000000-3333-4000-8000-00000000000a";
const CONTA = "f1000000-4444-4000-8000-00000000000a";

const fn = (ator: string, nome: string, args: string) => como(ator, `select public.${nome}(${args});`);
const dados = (o: unknown) => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;
const hoje = () => ultima(sql(`select current_date::text;`));
const somarDiasSql = (dias: number) => ultima(sql(`select (current_date + ${dias})::text;`));

const LINHAS: LinhaDeTaxa[] = [
  { bandeira: null, modalidade: "pix", parcelas_de: 1, parcelas_ate: 1, mdr_pct: 0.99 },
  { bandeira: null, modalidade: "debito", parcelas_de: 1, parcelas_ate: 1, mdr_pct: 1.9 },
  { bandeira: "amex", modalidade: "debito", parcelas_de: 1, parcelas_ate: 1, mdr_pct: 2.35 },
  { bandeira: null, modalidade: "credito", parcelas_de: 1, parcelas_ate: 1, mdr_pct: 4.3 },
  { bandeira: null, modalidade: "credito", parcelas_de: 2, parcelas_ate: 6, mdr_pct: 7.7 },
  { bandeira: null, modalidade: "credito", parcelas_de: 6, parcelas_ate: 6, mdr_pct: 11.3 },
  { bandeira: "elo", modalidade: "credito", parcelas_de: 2, parcelas_ate: 12, mdr_pct: 9.4567 },
  { bandeira: null, modalidade: "credito", parcelas_de: 7, parcelas_ate: 12, mdr_pct: 19 },
  { bandeira: null, modalidade: "credito", parcelas_de: 13, parcelas_ate: 21, mdr_pct: 14.87 },
];

let adqPorMes = "";
let adqFixa = "";
let adqB = "";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'fin-adm@invariant.test'), ('${ATEND}', 'fin-atend@invariant.test'),
      ('${ADM_B}', 'fin-adm-b@invariant.test'), ('${ADM_OFF}', 'fin-adm-off@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'fin-inv-a', 'Financeiro Invariant A', 'Fin A', '{"clinic":{}}'::jsonb),
      ('${ORG_B}', 'fin-inv-b', 'Financeiro Invariant B', 'Fin B', '{"clinic":{"financeiro_avancado":true}}'::jsonb),
      ('${ORG_OFF}', 'fin-inv-c', 'Financeiro Invariant C', 'Fin C', '{"clinic":{}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${ATEND}', '${ORG}', 'agent', now()),
      ('${ADM_B}', '${ORG_B}', 'admin', now()), ('${ADM_OFF}', '${ORG_OFF}', 'admin', now())
      on conflict do nothing;
    insert into public.financial_accounts (id, organization_id, name, kind) values
      ('${CONTA}', '${ORG}', 'Conta fictícia', 'bank') on conflict (id) do nothing;
    insert into public.payment_methods (id, organization_id, name, account_id) values
      ('${FORMA}', '${ORG}', 'Cartão fictício', '${CONTA}') on conflict (id) do nothing;
  `);
});

describe("opção e permissão", () => {
  it("desligada recusa; ligar libera", () => {
    expect(erro(fn(ADM_OFF, "fn_clinic_fin_adquirente_salvar", `'${ORG_OFF}', null, ${dados({ nome: "X" })}`))).toMatch(
      /financeiro_avancado_desligado/,
    );
    sql(fn(ADM, "fn_clinic_definir_financeiro_avancado", `'${ORG}', true`));
    adqPorMes = json<{ id: string }>(
      sql(
        fn(
          ADM,
          "fn_clinic_fin_adquirente_salvar",
          `'${ORG}', null, ${dados({ nome: "Adquirente por mês", prazo_pix_dias: 0, prazo_debito_dias: 1, prazo_credito_dias: 30, tarifa_fixa_cents: 39, antecipacao_pct: 1.99, antecipacao_modo: "por_mes" })}`,
        ),
      ),
    ).id;
    adqFixa = json<{ id: string }>(
      sql(
        fn(
          ADM,
          "fn_clinic_fin_adquirente_salvar",
          `'${ORG}', null, ${dados({ nome: "Adquirente fixa", prazo_debito_dias: 2, prazo_credito_dias: 1, antecipacao_pct: 4.5, antecipacao_modo: "fixa" })}`,
        ),
      ),
    ).id;
    expect(adqPorMes).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("atendente lê mas não configura", () => {
    expect(erro(fn(ATEND, "fn_clinic_fin_adquirente_salvar", `'${ORG}', null, ${dados({ nome: "Y" })}`))).toMatch(
      /acesso_proibido/,
    );
    expect(ultima(sql(como(ATEND, `select count(*) from public.clinic_fin_adquirentes;`)))).toBe("2");
  });
  it("nome repetido na mesma empresa é recusado", () => {
    expect(erro(fn(ADM, "fn_clinic_fin_adquirente_salvar", `'${ORG}', null, ${dados({ nome: "adquirente FIXA" })}`))).toMatch(
      /unique|duplicate/i,
    );
  });
});

describe("vigência: a taxa nunca muda o passado", () => {
  it("primeira tabela pode valer desde o passado; as seguintes, não", () => {
    for (const adq of [adqPorMes, adqFixa]) {
      sql(fn(ADM, "fn_clinic_fin_tabela_publicar", `'${ORG}', '${adq}', '2026-01-01', ${dados(LINHAS)}`));
    }
    expect(
      erro(fn(ADM, "fn_clinic_fin_tabela_publicar", `'${ORG}', '${adqPorMes}', '2026-01-02', ${dados(LINHAS)}`)),
    ).toMatch(/fin_vigencia_no_passado/);
  });
  it("linhas e tabelas são imutáveis, até para o service role", () => {
    expect(erro(`update public.clinic_fin_taxas set mdr_pct = 1 where organization_id = '${ORG}';`)).toMatch(/fin_taxa_imutavel/);
    expect(erro(`delete from public.clinic_fin_taxas where organization_id = '${ORG}';`)).toMatch(/fin_taxa_imutavel/);
    expect(
      erro(`set role service_role; update public.clinic_fin_taxas set mdr_pct = 1 where organization_id = '${ORG}';`),
    ).toMatch(/permission denied|fin_taxa_imutavel/);
    expect(
      erro(`update public.clinic_fin_tabelas set vigente_desde = '2025-01-01' where organization_id = '${ORG}';`),
    ).toMatch(/fin_taxa_imutavel/);
    expect(erro(como(ADM, `insert into public.clinic_fin_adquirentes (organization_id, nome) values ('${ORG}', 'direto');`))).toMatch(
      /permission denied/,
    );
  });
  it("vigência futura substitui a futura; a de hoje não se reescreve", () => {
    const amanha = somarDiasSql(1);
    const futura = [{ bandeira: null, modalidade: "debito", parcelas_de: 1, parcelas_ate: 1, mdr_pct: 3 }];
    const a = json<{ id: string }>(sql(fn(ADM, "fn_clinic_fin_tabela_publicar", `'${ORG}', '${adqFixa}', '${amanha}', ${dados(futura)}`)));
    const b = json<{ id: string; substituiu: string }>(
      sql(fn(ADM, "fn_clinic_fin_tabela_publicar", `'${ORG}', '${adqFixa}', '${amanha}', ${dados([{ ...futura[0], mdr_pct: 2.5 }])}`)),
    );
    expect(b.substituiu).toBe(a.id);
    sql(fn(ADM, "fn_clinic_fin_tabela_publicar", `'${ORG}', '${adqPorMes}', '${hoje()}', ${dados(LINHAS)}`));
    expect(
      erro(fn(ADM, "fn_clinic_fin_tabela_publicar", `'${ORG}', '${adqPorMes}', '${hoje()}', ${dados(LINHAS)}`)),
    ).toMatch(/fin_vigencia_existente/);
    // a venda de ontem continua na tabela de 2026-01-01; a de amanhã, na nova
    const ontem = ultima(sql(`select (current_date - 1)::text;`));
    const r1 = json<Recebimento>(sql(`select public.fn_clinic_fin_calcular('${ORG}', '${adqFixa}', 'debito', null, 1, 10000, '${ontem}');`));
    const r2 = json<Recebimento>(sql(`select public.fn_clinic_fin_calcular('${ORG}', '${adqFixa}', 'debito', null, 1, 10000, '${amanha}');`));
    expect(Number(r1.mdr_pct)).toBe(1.9);
    expect(Number(r2.mdr_pct)).toBe(2.5);
  });
  it("linha inválida é recusada inteira (débito em 2x, MDR acima de 100%)", () => {
    const amanha2 = somarDiasSql(2);
    expect(
      erro(
        fn(ADM, "fn_clinic_fin_tabela_publicar", `'${ORG}', '${adqFixa}', '${amanha2}', ${dados([{ modalidade: "debito", parcelas_de: 1, parcelas_ate: 2, mdr_pct: 1 }])}`),
      ),
    ).toMatch(/clinic_fin_taxas_parcelas/);
    expect(
      erro(
        fn(ADM, "fn_clinic_fin_tabela_publicar", `'${ORG}', '${adqFixa}', '${amanha2}', ${dados([{ modalidade: "pix", parcelas_de: 1, parcelas_ate: 1, mdr_pct: 101 }])}`),
      ),
    ).toMatch(/clinic_fin_taxas_mdr/);
  });
});

describe("paridade TS × SQL", () => {
  it("fn_clinic_fin_calcular devolve o mesmo que o motor TS, centavo a centavo", () => {
    // gerador determinístico
    let s = 20261007;
    const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)] as T;
    const adquirentes: Record<string, Adquirente> = {
      [adqPorMes]: { id: adqPorMes, nome: "por mês", prazo_pix_dias: 0, prazo_debito_dias: 1, prazo_credito_dias: 30, tarifa_fixa_cents: 39, antecipacao_pct: 1.99, antecipacao_modo: "por_mes" },
      [adqFixa]: { id: adqFixa, nome: "fixa", prazo_pix_dias: 0, prazo_debito_dias: 2, prazo_credito_dias: 1, tarifa_fixa_cents: 0, antecipacao_pct: 4.5, antecipacao_modo: "fixa" },
    };
    const casos = Array.from({ length: 240 }, () => {
      const modalidade = pick<Modalidade>(["pix", "debito", "credito", "credito", "credito"]);
      return {
        adq: pick([adqPorMes, adqFixa]),
        modalidade,
        bandeira: pick<Bandeira | null>([null, ...BANDEIRAS]),
        parcelas: modalidade === "credito" ? 1 + Math.floor(rnd() * 22) : 1,
        bruto: 1 + Math.floor(rnd() * (rnd() < 0.3 ? 500 : 2_000_000)),
        data: pick(["2026-02-28", "2026-03-31", "2026-12-15", "2027-01-30"]),
        antecipar: rnd() < 0.5,
      };
    });
    // cada chamada que falha (taxa ausente, taxa > valor) devolveria erro e abortaria;
    // por isso só entram casos que o TS calcula, e os de erro são conferidos à parte
    // as tabelas como o banco as tem agora (cada adquirente tem as suas vigências)
    const tabelasDe = (adq: string) =>
      json<Array<{ vigente_desde: string; linhas: LinhaDeTaxa[] }>>(
        sql(`select coalesce(json_agg(json_build_object('vigente_desde', t.vigente_desde::text, 'linhas',
                (select json_agg(json_build_object('bandeira', x.bandeira, 'modalidade', x.modalidade,
                   'parcelas_de', x.parcelas_de, 'parcelas_ate', x.parcelas_ate, 'mdr_pct', x.mdr_pct::float8))
                   from public.clinic_fin_taxas x where x.tabela_id = t.id))), '[]')
               from public.clinic_fin_tabelas t where t.adquirente_id = '${adq}' and t.cancelada_em is null;`),
      );
    const tabelasPorAdq: Record<string, ReturnType<typeof tabelasDe>> = {
      [adqPorMes]: tabelasDe(adqPorMes),
      [adqFixa]: tabelasDe(adqFixa),
    };
    const okTs: Array<{ c: (typeof casos)[number]; r: Recebimento }> = [];
    const errosTs: Array<{ c: (typeof casos)[number]; codigo: string }> = [];
    for (const c of casos) {
      try {
        okTs.push({
          c,
          r: calcularRecebimento({
            adquirente: adquirentes[c.adq]!,
            tabelas: tabelasPorAdq[c.adq]!,
            modalidade: c.modalidade,
            bandeira: c.bandeira,
            parcelas: c.parcelas,
            bruto_cents: c.bruto,
            data: c.data,
            antecipar: c.antecipar,
            data_antecipacao: c.data,
          }),
        });
      } catch (e) {
        errosTs.push({ c, codigo: (e as ErroDeTaxa).codigo });
      }
    }
    expect(okTs.length).toBeGreaterThan(150);
    const linhasSql = sql(
      okTs
        .map(
          ({ c }) =>
            `select public.fn_clinic_fin_calcular('${ORG}', '${c.adq}', '${c.modalidade}', ${c.bandeira ? `'${c.bandeira}'` : "null"}, ${c.parcelas}, ${c.bruto}, '${c.data}', ${c.antecipar}, '${c.data}');`,
        )
        .join("\n"),
    ).split("\n");
    expect(linhasSql).toHaveLength(okTs.length);
    linhasSql.forEach((linha, i) => {
      const doBanco = JSON.parse(linha) as Recebimento;
      const doTs = okTs[i]?.r;
      expect({ ...doBanco, mdr_pct: Number(doBanco.mdr_pct), custo_total_pct: Number(doBanco.custo_total_pct) }).toEqual(doTs);
    });
    // os casos que o TS recusa, o banco também recusa, com o mesmo código
    for (const { c, codigo } of errosTs.slice(0, 20)) {
      expect(
        erro(`select public.fn_clinic_fin_calcular('${ORG}', '${c.adq}', '${c.modalidade}', ${c.bandeira ? `'${c.bandeira}'` : "null"}, ${c.parcelas}, ${c.bruto}, '${c.data}', ${c.antecipar}, '${c.data}');`),
      ).toContain(codigo);
    }
  });
  it("o cálculo é interno: authenticated não executa", () => {
    expect(
      erro(como(ADM, `select public.fn_clinic_fin_calcular('${ORG}', '${adqPorMes}', 'pix', null, 1, 100, '2026-05-01');`)),
    ).toMatch(/permission denied/);
  });
});

describe("forma de pagamento", () => {
  it("guarda tipo e adquirente; Pix/débito/crédito podem ter adquirente, dinheiro não", () => {
    sql(fn(ADM, "fn_clinic_fin_forma_salvar", `'${ORG}', '${FORMA}', 'credito', '${adqPorMes}'`));
    expect(ultima(sql(`select tipo || '|' || adquirente_id from public.clinic_fin_forma_extras where payment_method_id = '${FORMA}';`))).toBe(
      `credito|${adqPorMes}`,
    );
    expect(erro(fn(ADM, "fn_clinic_fin_forma_salvar", `'${ORG}', '${FORMA}', 'dinheiro', '${adqPorMes}'`))).toMatch(
      /fin_dados_invalidos/,
    );
  });
});

describe("isolamento", () => {
  it("outra empresa não lê nem usa", () => {
    adqB = json<{ id: string }>(sql(fn(ADM_B, "fn_clinic_fin_adquirente_salvar", `'${ORG_B}', null, ${dados({ nome: "B" })}`))).id;
    for (const t of ["clinic_fin_adquirentes", "clinic_fin_tabelas", "clinic_fin_taxas", "clinic_fin_forma_extras"]) {
      expect(ultima(sql(como(ADM_B, `select count(*) from public.${t} where organization_id = '${ORG}';`)))).toBe("0");
    }
    expect(erro(fn(ADM, "fn_clinic_fin_forma_salvar", `'${ORG}', '${FORMA}', 'credito', '${adqB}'`))).toMatch(
      /fin_adquirente_invalida/,
    );
    expect(erro(fn(ADM_B, "fn_clinic_fin_tabela_publicar", `'${ORG_B}', '${adqPorMes}', '2026-01-01', ${dados(LINHAS)}`))).toMatch(
      /fin_adquirente_invalida/,
    );
    expect(erro(fn(ADM_B, "fn_clinic_fin_adquirente_salvar", `'${ORG}', '${adqPorMes}', ${dados({ nome: "roubo" })}`))).toMatch(
      /acesso_proibido/,
    );
  });
  it("anon não executa", () => {
    expect(
      erro(`set role anon; select public.fn_clinic_fin_adquirente_salvar('${ORG}', null, '{"nome":"x"}'::jsonb);`),
    ).toMatch(/permission denied/);
  });
});
