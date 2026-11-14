/**
 * clinic (fork, orçamento O5) — migration 8010: correções das revisões
 * security-lgpd e health-compliance.
 *
 * Prova no Postgres real:
 *   - DISTRATO: revogar o contrato aceito cancela o orçamento, pausa o plano
 *     gerado e cancela a comanda ainda aberta;
 *   - ENVIAR recusa texto que não traz o total/itens do orçamento e recusa
 *     preço que deixou de ser o vigente (nova versão copiada de preço antigo);
 *   - ANONIMIZAR o paciente redige observação, motivos e observação do
 *     pagamento dos orçamentos dele (itens e valores ficam);
 *   - pos_aceite_erro guarda só o código.
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

const ORG = "c8010000-0000-4000-8000-00000000000a";
const GER = "c8010000-1111-4000-8000-0000000000a2";
const ATE = "c8010000-1111-4000-8000-0000000000a3";
const PROC = "c8010000-2222-4000-8000-0000000000a1";
const PAC = "c8010000-3333-4000-8000-0000000000a1";
const PAC2 = "c8010000-3333-4000-8000-0000000000a2";
const MOD = "c8010000-4444-4000-8000-0000000000a1";
const VER = "c8010000-4444-4000-8000-0000000000a2";

const texto = (id: string) =>
  `(select 'Contrato ' || translate(to_char(o.total_cents / 100.0, 'FM999,999,990.00'), ',.', '.,') || ' ' || string_agg(i.descricao, '; ') from public.clinic_orcamentos o join public.clinic_orcamento_itens i on i.orcamento_id = o.id where o.id = '${id}' group by o.total_cents)`;
let preco = "";

const novo = (paciente = PAC, extra: object = {}) =>
  (
    JSON.parse(
      ultima(
        sql(
          como(
            ATE,
            `select public.fn_clinic_orcamento_salvar('${ORG}', null, '${JSON.stringify({
              contact_id: paciente,
              itens: [{ preco_id: preco }],
              condicao_pagamento: { forma: "pix", observacao: "Paga na sexta" },
              observacao: "Prefere manhã",
              ...extra,
            })}'::jsonb);`,
          ),
        ),
      ),
    ) as { id: string }
  ).id;
const enviar = (id: string) =>
  sql(como(ATE, `select public.fn_clinic_orcamento_enviar('${ORG}', '${id}', '${VER}', 'Contrato', ${texto(id)});`));
const doc = (id: string) => ultima(sql(`select documento_id from public.clinic_orcamentos where id = '${id}';`));

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values ('${GER}', 'rev-ger@invariant.test'), ('${ATE}', 'rev-ate@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'rev-inv-a', 'Revisão Invariant A', 'Revisão A', '{"clinic":{"orcamentos":true,"prontuario":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${GER}', '${ORG}', 'manager', now()), ('${ATE}', '${ORG}', 'agent', now()) on conflict do nothing;
    insert into public.clinic_procedures (id, organization_id, name, short_description) values
      ('${PROC}', '${ORG}', 'Limpeza de pele', 'Procedimento de teste') on conflict (id) do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PAC}', '${ORG}', 'Paciente Fictício Rev', '+5511900008101'),
      ('${PAC2}', '${ORG}', 'Paciente Fictício Anon', '+5511900008102') on conflict (id) do nothing;
    insert into public.clinic_modelos_documento (id, organization_id, tipo, nome, ativo) values
      ('${MOD}', '${ORG}', 'contrato', 'Contrato invariante 8010', true) on conflict (id) do nothing;
    insert into public.clinic_modelos_documento_versoes (id, organization_id, modelo_id, numero, conteudo, sha256) values
      ('${VER}', '${ORG}', '${MOD}', 1, 'Contrato {{orcamento.itens}}', 'x') on conflict (id) do nothing;
  `);
  preco = (
    JSON.parse(
      ultima(sql(como(GER, `select public.fn_clinic_preco_publicar('${ORG}', '{"procedure_id":"${PROC}","sessoes":2,"preco_cents":123456}'::jsonb);`))),
    ) as { id: string }
  ).id;
});

describe("correções das revisões (8010)", () => {
  it("enviar recusa texto que não traz o total e os itens do orçamento", () => {
    const id = novo();
    expect(erro(como(ATE, `select public.fn_clinic_orcamento_enviar('${ORG}', '${id}', '${VER}', 't', 'Total de R$ 1,00');`))).toMatch(
      /orcamento_texto_divergente/,
    );
    enviar(id); // o texto com 1.234,56 e o item passa
    expect(ultima(sql(`select status from public.clinic_orcamentos where id = '${id}';`))).toBe("enviado");
  });

  it("aceite → plano rascunho e comanda aberta; revogar (distrato) cancela orçamento e comanda e pausa o plano", () => {
    const id = novo();
    enviar(id);
    sql(como(ATE, `select public.fn_clinic_documento_aceitar('${ORG}', '${doc(id)}', 'Paciente Fictício', '{}'::jsonb, 'teste');`));
    const plano = ultima(sql(`select plano_id from public.clinic_orcamentos where id = '${id}';`));
    const venda = ultima(sql(`select sale_id from public.clinic_orcamento_vendas where orcamento_id = '${id}';`));
    expect(ultima(sql(`select status from public.clinic_planos_tratamento where id = '${plano}';`))).toBe("rascunho");
    expect(ultima(sql(`select status from public.sales where id = '${venda}';`))).toBe("open");

    sql(como(GER, `select public.fn_clinic_documento_encerrar('${ORG}', '${doc(id)}', 'revogar', 'Paciente desistiu do tratamento');`));
    expect(ultima(sql(`select status || '|' || (motivo_cancelamento like 'Contrato revogado (distrato).%')::text from public.clinic_orcamentos where id = '${id}';`))).toBe(
      "cancelado|true",
    );
    expect(ultima(sql(`select status from public.clinic_planos_tratamento where id = '${plano}';`))).toBe("pausado");
    expect(ultima(sql(`select status || '|' || cancel_reason from public.sales where id = '${venda}';`))).toBe(
      "cancelled|Contrato do orçamento revogado (distrato).",
    );
  });

  it("nova versão com preço que deixou de valer não é enviada", () => {
    const id = novo();
    enviar(id);
    sql(como(ATE, `select public.fn_clinic_orcamento_recusar('${ORG}', '${id}', 'Achou caro');`));
    const v2 = (JSON.parse(ultima(sql(como(ATE, `select public.fn_clinic_orcamento_nova_versao('${ORG}', '${id}');`)))) as { id: string }).id;
    sql(como(GER, `select public.fn_clinic_preco_publicar('${ORG}', '{"procedure_id":"${PROC}","sessoes":2,"preco_cents":99000}'::jsonb);`));
    expect(erro(como(ATE, `select public.fn_clinic_orcamento_enviar('${ORG}', '${v2}', '${VER}', 't', ${texto(v2)});`))).toMatch(
      /orcamento_preco_desatualizado/,
    );
    // volta o preço para os próximos casos
    preco = (
      JSON.parse(
        ultima(sql(como(GER, `select public.fn_clinic_preco_publicar('${ORG}', '{"procedure_id":"${PROC}","sessoes":2,"preco_cents":123456}'::jsonb);`))),
      ) as { id: string }
    ).id;
  });

  it("anonimizar o paciente redige o texto livre dos orçamentos (itens e valores ficam)", () => {
    const id = novo(PAC2);
    enviar(id);
    sql(como(GER, `select public.fn_clinic_orcamento_cancelar('${ORG}', '${id}', 'Paciente mudou de cidade');`));
    sql(`update public.contacts set is_anonymized = true, anonymized_at = now() where id = '${PAC2}';`);
    expect(
      ultima(
        sql(
          `select coalesce(observacao, '-') || '|' || motivo_cancelamento || '|' || (condicao_pagamento ? 'observacao')::text || '|' || total_cents from public.clinic_orcamentos where id = '${id}';`,
        ),
      ),
    ).toBe("-|[anonimizado]|false|123456");
    expect(ultima(sql(`select count(*) from public.clinic_orcamento_itens where orcamento_id = '${id}';`))).toBe("1");
  });

  it("pos_aceite_erro guarda só o código, nunca a mensagem do banco", () => {
    const grande = (
      JSON.parse(
        ultima(sql(como(GER, `select public.fn_clinic_preco_publicar('${ORG}', '{"procedure_id":"${PROC}","sessoes":100,"preco_cents":100}'::jsonb);`))),
      ) as { id: string }
    ).id;
    const id = novo(PAC, { itens: [{ preco_id: grande, quantidade: 6 }] });
    enviar(id);
    sql(como(ATE, `select public.fn_clinic_documento_aceitar('${ORG}', '${doc(id)}', 'Paciente Fictício', '{}'::jsonb, 'teste');`));
    expect(ultima(sql(`select status || '|' || pos_aceite_erro from public.clinic_orcamentos where id = '${id}';`))).toBe(
      "aprovado|orcamento_sessoes_demais",
    );
  });
});
