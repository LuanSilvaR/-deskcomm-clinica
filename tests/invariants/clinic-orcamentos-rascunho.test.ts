/**
 * clinic (fork, orçamento O2) — migration 8007: orçamento em rascunho.
 *
 * Prova no Postgres real:
 *   - o preço do item vem da vigência ATUAL da tabela (não do corpo); preço
 *     desatualizado ou fora da tabela é recusado; descrição congelada;
 *   - número sequencial por empresa; totais calculados no banco;
 *   - condição de pagamento: só as 5 formas; parcelado 2–24× com entrada
 *     opcional (dinheiro/pix/débito); o centavo que sobra vai na 1ª parcela;
 *   - desconto acima do limite fica pendente para o atendente e é aprovado por
 *     quem tem orcamentos.aprovar_desconto; o limite é configurável pelo admin;
 *   - cancelar exige motivo e permissão; cancelado não se edita; itens não mudam
 *     fora do rascunho; orçamento não se apaga (só na cascata da empresa);
 *   - visualizador (sem orcamentos.ver) lê 0; 2 empresas isoladas; anon sem EXECUTE.
 */
import { execFileSync } from "node:child_process";

import { beforeAll, describe, expect, it } from "vitest";

const container = process.env.TEST_DB_CONTAINER;
if (!container) {
  throw new Error("TEST_DB_CONTAINER not set — rode esta suíte via `pnpm test:db` (scripts/test-db.sh)");
}
const containerName: string = container;

function sql(script: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", containerName, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-f", "-"],
    { input: script, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
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

const ORG = "c8007000-0000-4000-8000-00000000000a";
const ORG_B = "c8007000-0000-4000-8000-00000000000b";
const ADM = "c8007000-1111-4000-8000-0000000000a1";
const GER = "c8007000-1111-4000-8000-0000000000a2";
const ATE = "c8007000-1111-4000-8000-0000000000a3";
const VIS = "c8007000-1111-4000-8000-0000000000a4";
const GER_B = "c8007000-1111-4000-8000-0000000000b1";
const PROC = "c8007000-2222-4000-8000-0000000000a1";
const PROC_B = "c8007000-2222-4000-8000-0000000000b1";
const PAC = "c8007000-3333-4000-8000-0000000000a1";
const PAC_B = "c8007000-3333-4000-8000-0000000000b1";

type Salvo = { id: string; numero: number; total_cents: number; desconto_pendente: boolean };

function publicar(user: string, org: string, proc: string, sessoes: number, cents: number): string {
  const r = JSON.parse(
    ultima(sql(como(user, `select public.fn_clinic_preco_publicar('${org}', '{"procedure_id":"${proc}","sessoes":${sessoes},"preco_cents":${cents}}'::jsonb);`))),
  ) as { id: string };
  return r.id;
}
const salvar = (user: string, org: string, id: string | null, dados: object): Salvo =>
  JSON.parse(
    ultima(
      sql(
        como(
          user,
          `select public.fn_clinic_orcamento_salvar('${org}', ${id ? `'${id}'` : "null"}, '${JSON.stringify(dados)}'::jsonb);`,
        ),
      ),
    ),
  ) as Salvo;
const erroAoSalvar = (user: string, org: string, id: string | null, dados: object) =>
  erro(
    como(user, `select public.fn_clinic_orcamento_salvar('${org}', ${id ? `'${id}'` : "null"}, '${JSON.stringify(dados)}'::jsonb);`),
  );
const campo = (id: string, expr: string) =>
  ultima(sql(`select ${expr} from public.clinic_orcamentos where id = '${id}';`));

let avulso = "";
let pacote = "";
let precoB = "";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'orc-adm@invariant.test'), ('${GER}', 'orc-ger@invariant.test'),
      ('${ATE}', 'orc-ate@invariant.test'), ('${VIS}', 'orc-vis@invariant.test'),
      ('${GER_B}', 'orc-ger-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'orc-inv-a', 'Orçamento Invariant A', 'Orçamento A', '{"clinic":{"orcamentos":true}}'::jsonb),
      ('${ORG_B}', 'orc-inv-b', 'Orçamento Invariant B', 'Orçamento B', '{"clinic":{"orcamentos":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${GER}', '${ORG}', 'manager', now()),
      ('${ATE}', '${ORG}', 'agent', now()), ('${VIS}', '${ORG}', 'viewer', now()),
      ('${GER_B}', '${ORG_B}', 'manager', now())
      on conflict do nothing;
    insert into public.clinic_procedures (id, organization_id, name, short_description) values
      ('${PROC}', '${ORG}', 'Limpeza de pele', 'Procedimento de teste'),
      ('${PROC_B}', '${ORG_B}', 'Peeling', 'Procedimento de teste')
      on conflict (id) do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PAC}', '${ORG}', 'Paciente Fictício A', '+5511900008007'), ('${PAC_B}', '${ORG_B}', 'Paciente Fictício B', '+5511900008008')
      on conflict (id) do nothing;
  `);
  avulso = publicar(GER, ORG, PROC, 1, 15000);
  pacote = publicar(GER, ORG, PROC, 10, 120000);
  precoB = publicar(GER_B, ORG_B, PROC_B, 1, 9900);
});

describe("orçamento em rascunho (8007)", () => {
  let o1 = "";

  it("atendente cria: preço da tabela, número 1, totais do banco, descrição congelada", () => {
    const r = salvar(ATE, ORG, null, {
      contact_id: PAC,
      itens: [{ preco_id: avulso, quantidade: 2 }, { preco_id: pacote }],
      condicao_pagamento: { forma: "pix" },
    });
    o1 = r.id;
    expect(r.numero).toBe(1);
    expect(r.total_cents).toBe(150000);
    expect(campo(o1, "status || '|' || subtotal_cents || '|' || validade_ate::text")).toBe(
      `rascunho|150000|${ultima(sql("select (current_date + 15)::text;"))}`,
    );
    expect(ultima(sql(`select string_agg(descricao || ':' || total_cents, ',' order by posicao) from public.clinic_orcamento_itens where orcamento_id = '${o1}';`))).toBe(
      "Limpeza de pele:30000,Limpeza de pele — 10 sessões:120000",
    );
    const r2 = salvar(ATE, ORG, null, { contact_id: PAC, itens: [{ preco_id: avulso }], condicao_pagamento: { forma: "dinheiro" } });
    expect(r2.numero).toBe(2);
  });

  it("preço desatualizado (a tabela mudou) é recusado; preço de outra empresa também", () => {
    const antigo = avulso;
    avulso = publicar(GER, ORG, PROC, 1, 18000);
    expect(erroAoSalvar(ATE, ORG, null, { contact_id: PAC, itens: [{ preco_id: antigo }], condicao_pagamento: { forma: "pix" } })).toMatch(
      /orcamento_preco_desatualizado/,
    );
    expect(erroAoSalvar(ATE, ORG, null, { contact_id: PAC, itens: [{ preco_id: precoB }], condicao_pagamento: { forma: "pix" } })).toMatch(
      /orcamento_preco_desatualizado/,
    );
  });

  it("parcelado com entrada: o centavo que sobra vai na 1ª parcela", () => {
    salvar(ATE, ORG, o1, {
      itens: [{ preco_id: pacote }],
      desconto_cents: 1,
      condicao_pagamento: { forma: "parcelado", parcelas: 7, entrada: { valor_cents: 20000, forma: "dinheiro" } },
    });
    // total 119999; restante 99999 em 7× → 14285 (×7 = 99995), 1ª = 14289
    expect(campo(o1, "condicao_pagamento::text")).toBe(
      '{"forma": "parcelado", "entrada": {"forma": "dinheiro", "valor_cents": 20000}, "parcelas": 7, "valor_parcela_cents": 14285, "primeira_parcela_cents": 14289}',
    );
  });

  it("só as 5 formas; à vista sem parcelas; parcelado 2–24×; entrada válida", () => {
    const base = { itens: [{ preco_id: pacote }] };
    for (const condicao of [
      { forma: "boleto" },
      { forma: "transferencia" },
      { forma: "pix", parcelas: 3 },
      { forma: "parcelado", parcelas: 1 },
      { forma: "parcelado", parcelas: 25 },
      { forma: "parcelado", parcelas: 3, entrada: { valor_cents: 500, forma: "credito" } },
      { forma: "parcelado", parcelas: 3, entrada: { valor_cents: 120000, forma: "pix" } },
      { forma: "debito", entrada: { valor_cents: 500, forma: "pix" } },
    ]) {
      expect(erroAoSalvar(ATE, ORG, o1, { ...base, condicao_pagamento: condicao }), JSON.stringify(condicao)).toMatch(
        /orcamento_pagamento_invalido/,
      );
    }
  });

  it("desconto acima do limite fica pendente; gerente aprova; limite é do admin", () => {
    const r = salvar(ATE, ORG, o1, { itens: [{ preco_id: pacote }], desconto_cents: 24000, condicao_pagamento: { forma: "pix" } });
    expect(r.desconto_pendente).toBe(true); // 20% > 10%
    expect(erro(como(ATE, `select public.fn_clinic_orcamento_aprovar_desconto('${ORG}', '${o1}');`))).toMatch(/acesso_proibido/);
    sql(como(GER, `select public.fn_clinic_orcamento_aprovar_desconto('${ORG}', '${o1}');`));
    expect(campo(o1, "desconto_pendente::text || '|' || (desconto_aprovado_por = '" + GER + "')::text")).toBe("false|true");
    // salvar de novo zera a aprovação; o gerente aprova ao salvar
    expect(salvar(ATE, ORG, o1, { itens: [{ preco_id: pacote }], desconto_cents: 24000, condicao_pagamento: { forma: "pix" } }).desconto_pendente).toBe(true);
    expect(salvar(GER, ORG, o1, { itens: [{ preco_id: pacote }], desconto_cents: 24000, condicao_pagamento: { forma: "pix" } }).desconto_pendente).toBe(false);
    // dentro do limite novo, não pende
    expect(erro(como(GER, `select public.fn_clinic_definir_orcamentos_desconto_max('${ORG}', 25);`))).toMatch(/clinic_flag_forbidden/);
    sql(como(ADM, `select public.fn_clinic_definir_orcamentos_desconto_max('${ORG}', 25);`));
    expect(salvar(ATE, ORG, o1, { itens: [{ preco_id: pacote }], desconto_cents: 24000, condicao_pagamento: { forma: "pix" } }).desconto_pendente).toBe(false);
    expect(erroAoSalvar(ATE, ORG, o1, { itens: [{ preco_id: pacote }], desconto_cents: 120001, condicao_pagamento: { forma: "pix" } })).toMatch(
      /orcamento_desconto_invalido/,
    );
  });

  it("visualizador não cria nem lê; atendente não cancela", () => {
    expect(erroAoSalvar(VIS, ORG, null, { contact_id: PAC, itens: [{ preco_id: pacote }], condicao_pagamento: { forma: "pix" } })).toMatch(
      /acesso_proibido/,
    );
    expect(ultima(sql(como(VIS, `select count(*) from public.clinic_orcamentos where organization_id = '${ORG}';`)))).toBe("0");
    expect(ultima(sql(como(ATE, `select count(*) from public.clinic_orcamentos where organization_id = '${ORG}';`)))).toBe("2");
    expect(erro(como(ATE, `select public.fn_clinic_orcamento_cancelar('${ORG}', '${o1}', 'Paciente desistiu');`))).toMatch(/acesso_proibido/);
  });

  it("escrita direta recusada; orçamento não se apaga; itens só mudam em rascunho", () => {
    expect(erro(como(GER, `update public.clinic_orcamentos set total_cents = 1 where id = '${o1}';`))).toMatch(/permission denied/);
    expect(erro(como(GER, `insert into public.clinic_orcamento_itens (organization_id, orcamento_id, preco_id, descricao, sessoes, preco_unit_cents, total_cents) values ('${ORG}', '${o1}', '${pacote}', 'x', 1, 1, 1);`))).toMatch(
      /permission denied/,
    );
    expect(erro(`delete from public.clinic_orcamentos where id = '${o1}';`)).toMatch(/orcamento_imutavel/);
  });

  it("cancelar exige motivo; cancelado não se edita nem muda itens", () => {
    expect(erro(como(GER, `select public.fn_clinic_orcamento_cancelar('${ORG}', '${o1}', ' ');`))).toMatch(/orcamento_sem_motivo/);
    sql(como(GER, `select public.fn_clinic_orcamento_cancelar('${ORG}', '${o1}', 'Paciente desistiu');`));
    expect(campo(o1, "status")).toBe("cancelado");
    expect(erroAoSalvar(ATE, ORG, o1, { itens: [{ preco_id: pacote }], condicao_pagamento: { forma: "pix" } })).toMatch(/orcamento_nao_editavel/);
    expect(erro(`update public.clinic_orcamento_itens set quantidade = 2, total_cents = preco_unit_cents * 2 where orcamento_id = '${o1}';`)).toMatch(
      /orcamento_nao_editavel/,
    );
    expect(erro(como(GER, `select public.fn_clinic_orcamento_cancelar('${ORG}', '${o1}', 'De novo');`))).toMatch(/orcamento_nao_editavel/);
  });

  it("isolamento entre 2 empresas", () => {
    const b = salvar(GER_B, ORG_B, null, { contact_id: PAC_B, itens: [{ preco_id: precoB }], condicao_pagamento: { forma: "pix" } });
    expect(b.numero).toBe(1);
    expect(ultima(sql(como(GER, `select count(*) from public.clinic_orcamentos where organization_id = '${ORG_B}';`)))).toBe("0");
    expect(ultima(sql(como(GER, `select count(*) from public.clinic_orcamento_itens where organization_id = '${ORG_B}';`)))).toBe("0");
    expect(erroAoSalvar(GER, ORG, null, { contact_id: PAC_B, itens: [{ preco_id: pacote }], condicao_pagamento: { forma: "pix" } })).toMatch(
      /orcamento_paciente_invalido/,
    );
    expect(erroAoSalvar(GER, ORG, b.id, { itens: [{ preco_id: pacote }], condicao_pagamento: { forma: "pix" } })).toMatch(/orcamento_invalido/);
    expect(erroAoSalvar(GER, ORG_B, null, { contact_id: PAC_B, itens: [{ preco_id: precoB }], condicao_pagamento: { forma: "pix" } })).toMatch(
      /acesso_proibido/,
    );
  });

  it("opção desligada recusa; anon não executa", () => {
    sql(`update public.organizations set settings = '{}'::jsonb where id = '${ORG_B}';`);
    expect(erroAoSalvar(GER_B, ORG_B, null, { contact_id: PAC_B, itens: [{ preco_id: precoB }], condicao_pagamento: { forma: "pix" } })).toMatch(
      /orcamentos_desligado/,
    );
    expect(erro(`set role anon; select public.fn_clinic_orcamento_salvar('${ORG}', null, '{}'::jsonb);`)).toMatch(/permission denied/);
    expect(erro(`set role anon; select public.fn_clinic_orcamento_cancelar('${ORG}', '${o1}', 'x');`)).toMatch(/permission denied/);
    expect(erro(`set role anon; select public.fn_clinic_orcamento_aprovar_desconto('${ORG}', '${o1}');`)).toMatch(/permission denied/);
    expect(erro(`set role anon; select public.fn_clinic_definir_orcamentos_desconto_max('${ORG}', 5);`)).toMatch(/permission denied/);
    expect(erro(`set role authenticated; select public.fn_clinic_orcamento_condicao('{}'::jsonb, 1);`)).toMatch(/permission denied/);
  });

  it("a cascata da exclusão da empresa apaga orçamentos e itens", () => {
    sql(`delete from public.organizations where id = '${ORG_B}';`);
    expect(ultima(sql(`select count(*) from public.clinic_orcamentos where organization_id = '${ORG_B}';`))).toBe("0");
  });
});
