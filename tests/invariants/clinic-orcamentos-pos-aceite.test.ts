/**
 * clinic (fork, orçamento O4) — migration 8009: pós-aceite.
 *
 * Prova no Postgres real:
 *   - o aceite do contrato (pelo link, sem usuário) cria o PLANO ativo com as
 *     sessões contratadas (sessões × quantidade) e a COMANDA aberta com os itens,
 *     o desconto e a comissão da regra em vigor; a observação traz o pagamento;
 *   - idempotente: reprocessar não duplica plano, sessões nem comanda;
 *   - falha no pós-aceite NÃO derruba o aceite: o orçamento fica aprovado com
 *     pos_aceite_erro, e reprocessar gera o que faltou;
 *   - clinic_orcamento_vendas: outra empresa lê 0; ninguém escreve direto;
 *   - reprocessar: só orcamentos.criar da própria empresa; anon sem EXECUTE.
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

const ORG = "c8009000-0000-4000-8000-00000000000a";
const ORG_B = "c8009000-0000-4000-8000-00000000000b";
const GER = "c8009000-1111-4000-8000-0000000000a2";
const ATE = "c8009000-1111-4000-8000-0000000000a3";
const GER_B = "c8009000-1111-4000-8000-0000000000b1";
const PROC = "c8009000-2222-4000-8000-0000000000a1";
const TIPO = "c8009000-2222-4000-8000-0000000000a2";
const PAC = "c8009000-3333-4000-8000-0000000000a1";
const MOD = "c8009000-4444-4000-8000-0000000000a1";
const VER = "c8009000-4444-4000-8000-0000000000a2";

let precoPacote = "";
let precoServico = "";
let link = 0;

function aprovarPeloLink(itens: object[], extra: object = {}): string {
  const id = (
    JSON.parse(
      ultima(
        sql(
          como(
            ATE,
            `select public.fn_clinic_orcamento_salvar('${ORG}', null, '${JSON.stringify({
              contact_id: PAC,
              itens,
              desconto_cents: 1000,
              condicao_pagamento: { forma: "parcelado", parcelas: 4, entrada: { valor_cents: 5000, forma: "pix" } },
              ...extra,
            })}'::jsonb);`,
          ),
        ),
      ),
    ) as { id: string }
  ).id;
  sql(como(ATE, `select public.fn_clinic_orcamento_enviar('${ORG}', '${id}', '${VER}', 'Contrato', 'Texto congelado.');`));
  const doc = ultima(sql(`select documento_id from public.clinic_orcamentos where id = '${id}';`));
  link += 1;
  const hash = `${"a".repeat(60)}${String(link).padStart(4, "0")}`;
  sql(como(ATE, `select public.fn_clinic_documento_link_criar('${ORG}', '${doc}', '${hash}', 72);`));
  sql(`set role service_role; select public.fn_clinic_documento_publico_aceitar('${hash}', 'Paciente Fictício', '{}'::jsonb, '127.0.0.1', 'teste');`);
  return id;
}
const campo = (id: string, expr: string) => ultima(sql(`select ${expr} from public.clinic_orcamentos where id = '${id}';`));

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${GER}', 'pos-ger@invariant.test'), ('${ATE}', 'pos-ate@invariant.test'), ('${GER_B}', 'pos-ger-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'pos-inv-a', 'Pós-aceite Invariant A', 'Pós A', '{"clinic":{"orcamentos":true,"prontuario":true}}'::jsonb),
      ('${ORG_B}', 'pos-inv-b', 'Pós-aceite Invariant B', 'Pós B', '{"clinic":{"orcamentos":true,"prontuario":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${GER}', '${ORG}', 'manager', now()), ('${ATE}', '${ORG}', 'agent', now()), ('${GER_B}', '${ORG_B}', 'manager', now())
      on conflict do nothing;
    insert into public.clinic_procedures (id, organization_id, name, short_description) values
      ('${PROC}', '${ORG}', 'Limpeza de pele', 'Procedimento de teste') on conflict (id) do nothing;
    insert into public.calendar_event_types (id, organization_id, name, slug, category, duration_minutes) values
      ('${TIPO}', '${ORG}', 'Avaliação', 'avaliacao-pos-inv', 'outro', 30) on conflict (id) do nothing;
    insert into public.commission_rules (organization_id, event_type_id, percent) values ('${ORG}', '${TIPO}', 12.5);
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PAC}', '${ORG}', 'Paciente Fictício Pós', '+5511900008091') on conflict (id) do nothing;
    insert into public.clinic_modelos_documento (id, organization_id, tipo, nome, ativo) values
      ('${MOD}', '${ORG}', 'contrato', 'Contrato invariante 8009', true) on conflict (id) do nothing;
    insert into public.clinic_modelos_documento_versoes (id, organization_id, modelo_id, numero, conteudo, sha256) values
      ('${VER}', '${ORG}', '${MOD}', 1, 'Contrato {{orcamento.itens}}', 'x') on conflict (id) do nothing;
  `);
  const pub = (dados: string) =>
    (JSON.parse(ultima(sql(como(GER, `select public.fn_clinic_preco_publicar('${ORG}', '${dados}'::jsonb);`)))) as { id: string }).id;
  precoPacote = pub(`{"procedure_id":"${PROC}","sessoes":3,"preco_cents":45000}`);
  precoServico = pub(`{"event_type_id":"${TIPO}","preco_cents":10000}`);
});

describe("pós-aceite (8009)", () => {
  let id = "";

  it("o aceite pelo link cria o plano com as sessões e a comanda aberta", () => {
    id = aprovarPeloLink([{ preco_id: precoPacote, quantidade: 2 }, { preco_id: precoServico }]);
    expect(campo(id, "status || '|' || (plano_id is not null)::text || '|' || (pos_aceite_em is not null)::text || '|' || coalesce(pos_aceite_erro, '-')")).toBe(
      "aprovado|true|true|-",
    );
    const plano = campo(id, "plano_id");
    expect(ultima(sql(`select status || '|' || contact_id from public.clinic_planos_tratamento where id = '${plano}';`))).toBe(`ativo|${PAC}`);
    // 3 sessões × 2 + 1 = 7 sessões planejadas, numeradas
    expect(ultima(sql(`select count(*) || '|' || max(numero) || '|' || count(*) filter (where status = 'planejada') from public.clinic_plano_sessoes where plano_id = '${plano}';`))).toBe(
      "7|7|7",
    );
    const venda = ultima(sql(`select sale_id from public.clinic_orcamento_vendas where orcamento_id = '${id}';`));
    expect(ultima(sql(`select status || '|' || discount_cents || '|' || total_cents || '|' || contact_id from public.sales where id = '${venda}';`))).toBe(
      `open|1000|99000|${PAC}`,
    );
    expect(ultima(sql(`select notes like '%entrada de R$ 50.00 (pix) + 4x no cartão de crédito%' from public.sales where id = '${venda}';`))).toBe("t");
    expect(
      ultima(sql(`select string_agg(quantity || 'x' || unit_price_cents || '=' || total_cents || '@' || commission_percent, ',' order by unit_price_cents desc) from public.sale_items where sale_id = '${venda}';`)),
    ).toBe("2x45000=90000@0.00,1x10000=10000@12.50");
  });

  it("idempotente: reprocessar não duplica nada", () => {
    sql(como(ATE, `select public.fn_clinic_orcamento_reprocessar('${ORG}', '${id}');`));
    sql(como(ATE, `select public.fn_clinic_orcamento_reprocessar('${ORG}', '${id}');`));
    expect(ultima(sql(`select count(*) from public.clinic_orcamento_vendas where orcamento_id = '${id}';`))).toBe("1");
    expect(ultima(sql(`select count(*) from public.clinic_plano_sessoes s join public.clinic_orcamentos o on o.plano_id = s.plano_id where o.id = '${id}';`))).toBe("7");
    expect(ultima(sql(`select count(*) from public.clinic_planos_tratamento where contact_id = '${PAC}';`))).toBe("1");
  });

  it("falha no pós-aceite não derruba o aceite; reprocessar gera o que faltou", () => {
    // pacote de 100 sessões × 6 = 600 > teto de 500: o pós-aceite falha, o aceite fica
    const grande = (JSON.parse(ultima(sql(como(GER, `select public.fn_clinic_preco_publicar('${ORG}', '{"procedure_id":"${PROC}","sessoes":100,"preco_cents":100}'::jsonb);`)))) as { id: string }).id;
    const falho = aprovarPeloLink([{ preco_id: grande, quantidade: 6 }], { desconto_cents: 0, condicao_pagamento: { forma: "pix" } });
    expect(campo(falho, "status || '|' || (plano_id is null)::text || '|' || (pos_aceite_erro like '%orcamento_sessoes_demais%')::text")).toBe(
      "aprovado|true|true",
    );
    expect(ultima(sql(`select count(*) from public.clinic_orcamento_vendas where orcamento_id = '${falho}';`))).toBe("0");
    expect(erro(como(ATE, `select public.fn_clinic_orcamento_reprocessar('${ORG}', '${falho}');`))).toMatch(/orcamento_sessoes_demais/);
  });

  it("reprocessar exige orçamento aprovado da própria empresa; anon não executa", () => {
    const rascunho = (
      JSON.parse(
        ultima(sql(como(ATE, `select public.fn_clinic_orcamento_salvar('${ORG}', null, '{"contact_id":"${PAC}","itens":[{"preco_id":"${precoServico}"}],"condicao_pagamento":{"forma":"pix"}}'::jsonb);`))),
      ) as { id: string }
    ).id;
    expect(erro(como(ATE, `select public.fn_clinic_orcamento_reprocessar('${ORG}', '${rascunho}');`))).toMatch(/orcamento_nao_aprovado/);
    expect(erro(como(GER_B, `select public.fn_clinic_orcamento_reprocessar('${ORG}', '${id}');`))).toMatch(/acesso_proibido/);
    expect(erro(`set role anon; select public.fn_clinic_orcamento_reprocessar('${ORG}', '${id}');`)).toMatch(/permission denied/);
    expect(erro(`set role authenticated; select public.fn_clinic_orcamento_pos_aceite('${ORG}', '${id}');`)).toMatch(/permission denied/);
  });

  it("clinic_orcamento_vendas: outra empresa lê 0; ninguém escreve direto", () => {
    expect(ultima(sql(como(GER_B, `select count(*) from public.clinic_orcamento_vendas where organization_id = '${ORG}';`)))).toBe("0");
    expect(ultima(sql(como(ATE, `select count(*) from public.clinic_orcamento_vendas where organization_id = '${ORG}';`)))).toBe("1");
    expect(erro(como(GER, `delete from public.clinic_orcamento_vendas where organization_id = '${ORG}';`))).toMatch(/permission denied/);
  });
});
