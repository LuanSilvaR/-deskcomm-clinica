/**
 * clinic (fork, estoque E2) — migration 9030: baixa pelo prontuário.
 *
 * Prova no Postgres real, com o baseline aplicado, pelo fluxo de verdade
 * (iniciar → procedimento com insumos → finalizar → consumidor):
 *   1. FEFO sem lote informado (pula lote vencido, usa mais de um lote) e
 *      conversão da unidade de estoque; movimentos com atendimento, paciente,
 *      profissional e procedimento; insumo ligado à operação; catálogo (E1);
 *   2. o que não baixa vira pendência (lote desconhecido, sem saldo); produto
 *      fora do estoque é consumo livre; controlado com conselho não permitido
 *      baixa e abre pendência de revisão;
 *   3. idempotência (evento entregue de novo não baixa duas vezes);
 *   4. resolver: baixar escolhendo lote/local, descartar e "ciente" com motivo;
 *      quem só vê não resolve;
 *   5. só o service role baixa; isolamento entre empresas; opção desligada.
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

const ORG = "e7000000-0000-4000-8000-00000000000a";
const ORG_B = "e7000000-0000-4000-8000-00000000000b";
const ADM = "e7000000-1111-4000-8000-0000000000a1";
const PROF = "e7000000-1111-4000-8000-0000000000a2";
const ADM_B = "e7000000-1111-4000-8000-0000000000b1";
const PAC = "e7000000-3333-4000-8000-00000000000a";
const AG = "e7000000-4444-4000-8000-00000000000a";
const TOX = "e7000000-2222-4000-8000-000000000001";
const AGU = "e7000000-2222-4000-8000-000000000002";
const FIO = "e7000000-2222-4000-8000-000000000003";
const LIVRE = "e7000000-2222-4000-8000-000000000004";
const CTRL = "e7000000-2222-4000-8000-000000000005";
const SORO = "e7000000-2222-4000-8000-000000000006";

const fn = (ator: string, nome: string, args: string) => como(ator, `select public.${nome}(${args});`);
const dados = (o: Record<string, unknown>) => `'${JSON.stringify(o)}'::jsonb`;
const baixar = (org: string, proc: string) =>
  sql(`set role service_role; select public.fn_clinic_estoque_baixar_procedimento('${org}', '${proc}');`);
const saldoDoLote = (lote: string) =>
  ultima(sql(`select coalesce(sum(quantidade), 0) from public.clinic_estoque_movimentos where lote_id = '${lote}';`));
const pendencia = (product: string, motivo: string) =>
  ultima(
    sql(`select id from public.clinic_estoque_pendencias
          where organization_id = '${ORG}' and product_id = '${product}' and motivo = '${motivo}';`),
  );
const insumoDe = (product: string) =>
  ultima(sql(`select id from public.clinic_procedimento_insumos where organization_id = '${ORG}' and product_id = '${product}';`));

let local = "";
let loteCedo = "";
let loteTarde = "";
let loteVencido = "";
let proc = "";
let resumo: { ligado: boolean; baixados: number; pendencias: number; livres: number };

function entrada(product: string, qtd: number, extra: Record<string, unknown> = {}): string {
  return json<{ lote_id: string }>(
    sql(fn(ADM, "fn_clinic_estoque_entrada", `'${ORG}', ${dados({ product_id: product, local_id: local, quantidade: qtd, ...extra })}`)),
  ).lote_id;
}

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'cons-adm@invariant.test'), ('${PROF}', 'cons-prof@invariant.test'), ('${ADM_B}', 'cons-adm-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'cons-inv-a', 'Consumo Invariant A', 'Consumo A', '{"clinic":{"prontuario":true}}'::jsonb),
      ('${ORG_B}', 'cons-inv-b', 'Consumo Invariant B', 'Consumo B', '{"clinic":{"estoque":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${PROF}', '${ORG}', 'agent', now()), ('${ADM_B}', '${ORG_B}', 'admin', now())
      on conflict do nothing;
    insert into public.clinic_professionals (organization_id, user_id, display_name, council, council_number, council_uf) values
      ('${ORG}', '${PROF}', 'Profissional fictício', 'CRM', '12345', 'SP')
      on conflict do nothing;
    insert into public.catalog_products (id, organization_id, codigo, nome, preco_cents) values
      ('${TOX}', '${ORG}', 'C-TOX', 'Toxina fictícia', 0), ('${AGU}', '${ORG}', 'C-AGU', 'Agulha fictícia', 0),
      ('${FIO}', '${ORG}', 'C-FIO', 'Fio fictício', 0), ('${LIVRE}', '${ORG}', 'C-LIVRE', 'Fora do estoque', 0),
      ('${CTRL}', '${ORG}', 'C-CTRL', 'Controlado fictício', 0), ('${SORO}', '${ORG}', 'C-SORO', 'Soro fictício', 0)
      on conflict (id) do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PAC}', '${ORG}', 'Paciente Consumo', '+5511990000701')
      on conflict (id) do nothing;
    insert into public.calendar_appointments (id, organization_id, title, starts_at, ends_at, owner_user_id, contact_id, status) values
      ('${AG}', '${ORG}', 'Toxina', now() - interval '1 hour', now(), '${PROF}', '${PAC}', 'confirmed')
      on conflict (id) do nothing;
  `);
  sql(fn(ADM, "fn_clinic_definir_estoque", `'${ORG}', true`));
  local = ultima(sql(`select id from public.clinic_estoque_locais where organization_id = '${ORG}' and padrao;`));

  const cfg = (product: string, o: Record<string, unknown>) =>
    sql(fn(ADM, "fn_clinic_estoque_produto_salvar", `'${ORG}', '${product}', ${dados(o)}, null`));
  cfg(TOX, { unidade_estoque: "frasco", unidade_aplicacao: "U", fator_conversao: 100 });
  cfg(AGU, {});
  cfg(FIO, {});
  cfg(CTRL, { controlado: true, conselhos_permitidos: ["CRO"] });
  cfg(SORO, { unidade_estoque: "cx", unidade_aplicacao: "un", fator_conversao: 10 });

  loteCedo = entrada(TOX, 10, { lote: "CEDO", validade: "2030-01-31" });
  loteTarde = entrada(TOX, 100, { lote: "TARDE", validade: "2099-12-31" });
  // lote vencido com saldo (entrou antes de vencer): direto, como superusuário
  loteVencido = ultima(
    sql(`
      with l as (insert into public.clinic_estoque_lotes (organization_id, product_id, codigo, validade)
                 values ('${ORG}', '${TOX}', 'VENC', '2020-01-01') returning id),
           o as (insert into public.clinic_estoque_operacoes (organization_id, tipo, origem_tipo)
                 values ('${ORG}', 'entrada', 'manual') returning id),
           m as (insert into public.clinic_estoque_movimentos (organization_id, operacao_id, product_id, lote_id, local_id, quantidade)
                 select '${ORG}', o.id, '${TOX}', l.id, '${local}', 50 from l, o
                 returning lote_id)
      select lote_id from m;`),
  );
  entrada(AGU, 100);
  entrada(CTRL, 10);
  entrada(SORO, 3, { em_unidade_estoque: true });

  // o atendimento de verdade
  const at = json<{ id: string }>(sql(como(PROF, `select public.fn_clinic_iniciar_atendimento('${ORG}', '${AG}');`))).id;
  const insumos = [
    { descricao: "Toxina", quantidade: 20, unidade: "U", product_id: TOX },
    { descricao: "Agulha", quantidade: 5, unidade: "un", product_id: AGU, lote: "NAO-EXISTE" },
    { descricao: "Fio", quantidade: 3, unidade: "un", product_id: FIO },
    { descricao: "Fora", quantidade: 1, unidade: "un", product_id: LIVRE },
    { descricao: "Controlado", quantidade: 1, unidade: "un", product_id: CTRL },
    { descricao: "Soro", quantidade: 1, unidade: "cx", product_id: SORO },
    { descricao: "Gaze avulsa", quantidade: 2, unidade: "un" },
  ];
  proc = json<{ id: string }>(
    sql(
      como(
        PROF,
        `select public.fn_clinic_procedimento_salvar('${ORG}', '${at}', null, '${JSON.stringify({ descricao: "Aplicação fictícia" })}'::jsonb, '${JSON.stringify(insumos)}'::jsonb, 0);`,
      ),
    ),
  ).id;
  sql(como(PROF, `select public.fn_clinic_salvar_evolucao('${ORG}', '${at}', 'Sem intercorrências.', null, null, null, null, 0);`));
  sql(como(PROF, `select public.fn_clinic_finalizar_atendimento('${ORG}', '${at}');`));
});

describe("a baixa ao finalizar", () => {
  it("o evento sai com o procedimento; só o service role baixa", () => {
    expect(
      ultima(
        sql(`select count(*) from public.event_log
              where organization_id = '${ORG}' and event_type = 'clinic.procedimento_confirmado' and entity_id = '${proc}';`),
      ),
    ).toBe("1");
    expect(erro(fn(ADM, "fn_clinic_estoque_baixar_procedimento", `'${ORG}', '${proc}'`))).toMatch(/permission denied/);
    resumo = json(baixar(ORG, proc));
    expect(resumo).toEqual({ ligado: true, baixados: 3, pendencias: 3, livres: 1 });
  });

  it("FEFO: pula o vencido, esgota o que vence antes e completa com o seguinte", () => {
    expect(saldoDoLote(loteCedo)).toBe("0.000");
    expect(saldoDoLote(loteTarde)).toBe("90.000");
    expect(saldoDoLote(loteVencido)).toBe("50.000");
    const op = insumoDe(TOX);
    const linhas = sql(`
      select m.atendimento_id is not null, m.contact_id = '${PAC}', m.profissional_user_id = '${PROF}', o.tipo
        from public.clinic_procedimento_insumos i
        join public.clinic_estoque_operacoes o on o.id = i.movimento_estoque_id
        join public.clinic_estoque_movimentos m on m.operacao_id = o.id
       where i.id = '${op}';`);
    expect(linhas.split("\n")).toEqual(["t|t|t|consumo", "t|t|t|consumo"]);
    expect(ultima(sql(`select quantidade from public.catalog_products where id = '${TOX}';`))).toBe("1");
  });

  it("converte a unidade de estoque (1 cx = 10 un)", () => {
    expect(
      ultima(sql(`select sum(saldo) from public.clinic_estoque_saldos where organization_id = '${ORG}' and product_id = '${SORO}';`)),
    ).toBe("20.000");
  });

  it("pendências: lote desconhecido, sem saldo e controlado fora do conselho (que baixa)", () => {
    expect(pendencia(AGU, "lote_desconhecido")).not.toBe("");
    expect(pendencia(FIO, "sem_saldo")).not.toBe("");
    expect(pendencia(CTRL, "profissional_nao_habilitado")).not.toBe("");
    expect(
      ultima(sql(`select sum(saldo) from public.clinic_estoque_saldos where organization_id = '${ORG}' and product_id = '${CTRL}';`)),
    ).toBe("9.000");
    expect(ultima(sql(`select count(*) from public.clinic_estoque_pendencias where organization_id = '${ORG}';`))).toBe("3");
    expect(ultima(sql(`select movimento_estoque_id is null from public.clinic_procedimento_insumos where id = '${insumoDe(LIVRE)}';`))).toBe(
      "t",
    );
  });

  it("evento entregue de novo não baixa duas vezes", () => {
    const antes = ultima(sql(`select count(*) from public.clinic_estoque_operacoes where organization_id = '${ORG}' and tipo = 'consumo';`));
    expect(json(baixar(ORG, proc))).toEqual(resumo);
    expect(ultima(sql(`select count(*) from public.clinic_estoque_operacoes where organization_id = '${ORG}' and tipo = 'consumo';`))).toBe(
      antes,
    );
    expect(ultima(sql(`select count(*) from public.clinic_estoque_pendencias where organization_id = '${ORG}';`))).toBe("3");
    expect(saldoDoLote(loteTarde)).toBe("90.000");
  });
});

describe("resolver pendências", () => {
  it("quem só vê lê, mas não resolve; outra empresa não enxerga", () => {
    expect(ultima(sql(como(PROF, `select count(*) from public.clinic_estoque_pendencias where organization_id = '${ORG}';`)))).toBe("3");
    expect(
      erro(fn(PROF, "fn_clinic_estoque_pendencia_resolver", `'${ORG}', '${pendencia(AGU, "lote_desconhecido")}', ${dados({ acao: "descartar", motivo: "Não era do estoque" })}`)),
    ).toMatch(/acesso_proibido/);
    expect(ultima(sql(como(ADM_B, `select count(*) from public.clinic_estoque_pendencias;`)))).toBe("0");
    expect(
      erro(fn(ADM_B, "fn_clinic_estoque_pendencia_resolver", `'${ORG_B}', '${pendencia(AGU, "lote_desconhecido")}', ${dados({ acao: "descartar", motivo: "Tentativa" })}`)),
    ).toMatch(/estoque_pendencia_invalida/);
  });

  it("sem saldo: dá entrada e baixa escolhendo lote e local; não resolve duas vezes", () => {
    const lote = entrada(FIO, 5);
    const id = pendencia(FIO, "sem_saldo");
    const r = json<{ status: string; operacao_id: string }>(
      sql(fn(ADM, "fn_clinic_estoque_pendencia_resolver", `'${ORG}', '${id}', ${dados({ acao: "baixar", lote_id: lote, local_id: local })}`)),
    );
    expect(r.status).toBe("resolvida");
    expect(saldoDoLote(lote)).toBe("2.000");
    expect(ultima(sql(`select movimento_estoque_id = '${r.operacao_id}' from public.clinic_procedimento_insumos where id = '${insumoDe(FIO)}';`))).toBe(
      "t",
    );
    expect(
      erro(fn(ADM, "fn_clinic_estoque_pendencia_resolver", `'${ORG}', '${id}', ${dados({ acao: "baixar", lote_id: lote, local_id: local })}`)),
    ).toMatch(/estoque_pendencia_fechada/);
  });

  it("lote de outro produto recusado; descartar exige motivo", () => {
    const id = pendencia(AGU, "lote_desconhecido");
    expect(
      erro(fn(ADM, "fn_clinic_estoque_pendencia_resolver", `'${ORG}', '${id}', ${dados({ acao: "baixar", lote_id: loteTarde, local_id: local })}`)),
    ).toMatch(/estoque_lote_invalido/);
    expect(erro(fn(ADM, "fn_clinic_estoque_pendencia_resolver", `'${ORG}', '${id}', ${dados({ acao: "descartar" })}`))).toMatch(
      /estoque_sem_motivo/,
    );
    expect(
      json<{ status: string }>(
        sql(fn(ADM, "fn_clinic_estoque_pendencia_resolver", `'${ORG}', '${id}', ${dados({ acao: "descartar", motivo: "Agulha da caixa avulsa" })}`)),
      ).status,
    ).toBe("descartada");
  });

  it("controlado: não se 'baixa' de novo; revisão com 'ciente'", () => {
    const id = pendencia(CTRL, "profissional_nao_habilitado");
    expect(erro(fn(ADM, "fn_clinic_estoque_pendencia_resolver", `'${ORG}', '${id}', ${dados({ acao: "baixar", lote_id: loteTarde, local_id: local })}`))).toMatch(
      /estoque_dados_invalidos/,
    );
    expect(
      json<{ status: string }>(
        sql(fn(ADM, "fn_clinic_estoque_pendencia_resolver", `'${ORG}', '${id}', ${dados({ acao: "ciente", motivo: "Supervisão de médico habilitado" })}`)),
      ).status,
    ).toBe("resolvida");
  });

  it("estorno da baixa devolve o saldo", () => {
    const op = ultima(sql(`select movimento_estoque_id from public.clinic_procedimento_insumos where id = '${insumoDe(TOX)}';`));
    sql(fn(ADM, "fn_clinic_estoque_estornar", `'${ORG}', '${op}', 'Lançado no procedimento errado'`));
    expect(saldoDoLote(loteCedo)).toBe("10.000");
    expect(saldoDoLote(loteTarde)).toBe("100.000");
  });
});

describe("opção e tabela", () => {
  it("opção desligada: não baixa nada", () => {
    sql(fn(ADM, "fn_clinic_definir_estoque", `'${ORG}', false`));
    expect(json(baixar(ORG, proc))).toEqual({ ligado: false });
    sql(fn(ADM, "fn_clinic_definir_estoque", `'${ORG}', true`));
  });

  it("ninguém escreve direto nas pendências", () => {
    expect(erro(como(ADM, `update public.clinic_estoque_pendencias set status = 'resolvida' where organization_id = '${ORG}';`))).toMatch(
      /permission denied/,
    );
  });
});
