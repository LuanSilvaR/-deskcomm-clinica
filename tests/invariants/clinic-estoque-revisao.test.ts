/**
 * clinic (fork, estoque E10) — migration 9038: correções das revisões.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   C11 código de lote normalizado (minúsculas/espaços viram o mesmo lote);
 *   C7  fracionável sem prazo pós-abertura e controlado com "outro" recusados;
 *   C1  insumo de produto rastreado sem lote/validade recusado; lote escolhido
 *       pela FEFO fica `lote_presumido`; C8 lote bloqueado fora da FEFO;
 *   C4  lote vencido aplicado: baixa e alerta de evento (a varredura não o fecha);
 *   C2/S1 recall pelo prontuário (baixado, presumido, pendente, estornado),
 *       auditado e limitado no banco; a RPC antiga fora do alcance do cliente;
 *   C3  NF-e com dois `rastro` vira dois lotes; soma divergente recusada;
 *   S4  NF-e sem o XML no Storage recusada; C6 registro divergente vira alerta;
 *   C9  estorno que devolveria a frasco encerrado recusado; C10 perda com categoria;
 *   S2/C13 `estoque.ver` não lê custo nem a ligação indireta com o atendimento;
 *   e outra empresa é recusada.
 * Dados fictícios.
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

const ORG = "ee000000-0000-4000-8000-00000000000a";
const ORG_B = "ee000000-0000-4000-8000-00000000000b";
const ADM = "ee000000-1111-4000-8000-0000000000a1";
const ATEND = "ee000000-1111-4000-8000-0000000000a2";
const PROF = "ee000000-1111-4000-8000-0000000000a3";
const ADM_B = "ee000000-1111-4000-8000-0000000000b1";
const PAC = "ee000000-3333-4000-8000-00000000000a";
const AG1 = "ee000000-4444-4000-8000-000000000001";
const AG2 = "ee000000-4444-4000-8000-000000000002";
const RAS = "ee000000-2222-4000-8000-000000000001";
const TOX = "ee000000-2222-4000-8000-000000000002";
const VEN = "ee000000-2222-4000-8000-000000000003";
const FRA = "ee000000-2222-4000-8000-000000000004";
const CHAVE = "35261000000000000191550010000099991000000010";
const CHAVE_SEM_XML = "35261000000000000191550010000099981000000015";

const fn = (ator: string, nome: string, args: string) => como(ator, `select public.${nome}(${args});`);
const dados = (o: unknown) => `'${JSON.stringify(o)}'::jsonb`;
const cfg = (product: string, o: Record<string, unknown>) =>
  sql(fn(ADM, "fn_clinic_estoque_produto_salvar", `'${ORG}', '${product}', ${dados(o)}, null`));

let local = "";
let loteRas = "";
let loteCedo = "";
let loteTarde = "";
let loteVencido = "";
let opRas = "";

function entrada(product: string, qtd: number, extra: Record<string, unknown> = {}): string {
  return json<{ lote_id: string }>(
    sql(fn(ADM, "fn_clinic_estoque_entrada", `'${ORG}', ${dados({ product_id: product, local_id: local, quantidade: qtd, ...extra })}`)),
  ).lote_id;
}
function atender(ag: string, insumos: unknown[]): { at: string; proc: string } {
  const at = json<{ id: string }>(sql(como(PROF, `select public.fn_clinic_iniciar_atendimento('${ORG}', '${ag}');`))).id;
  const proc = json<{ id: string }>(
    sql(
      como(
        PROF,
        `select public.fn_clinic_procedimento_salvar('${ORG}', '${at}', null, '${JSON.stringify({ descricao: "Aplicação fictícia" })}'::jsonb, '${JSON.stringify(insumos)}'::jsonb, 0);`,
      ),
    ),
  ).id;
  sql(como(PROF, `select public.fn_clinic_salvar_evolucao('${ORG}', '${at}', 'Sem intercorrências.', null, null, null, null, 0);`));
  sql(como(PROF, `select public.fn_clinic_finalizar_atendimento('${ORG}', '${at}');`));
  sql(`set role service_role; select public.fn_clinic_estoque_baixar_procedimento('${ORG}', '${proc}');`);
  return { at, proc };
}
type Recall = { lote: { codigo: string }; pacientes: Array<{ paciente: string; status: string }> };
const recall = (lote: string, ator = PROF) =>
  json<Recall>(sql(fn(ator, "fn_clinic_estoque_rel_rastreio_lote", `'${ORG}', '${lote}', 'auditoria'`)));

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'rev-adm@invariant.test'), ('${ATEND}', 'rev-atend@invariant.test'),
      ('${PROF}', 'rev-prof@invariant.test'), ('${ADM_B}', 'rev-adm-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'rev-inv-a', 'Revisao Invariant A', 'Rev A', '{"clinic":{"prontuario":true}}'::jsonb),
      ('${ORG_B}', 'rev-inv-b', 'Revisao Invariant B', 'Rev B', '{"clinic":{"estoque":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${ATEND}', '${ORG}', 'agent', now()),
      ('${PROF}', '${ORG}', 'manager', now()), ('${ADM_B}', '${ORG_B}', 'admin', now())
      on conflict do nothing;
    insert into public.clinic_professionals (organization_id, user_id, display_name, council, council_number, council_uf) values
      ('${ORG}', '${PROF}', 'Dra. Fictícia', 'CRM', '12345', 'SP') on conflict do nothing;
    insert into public.catalog_products (id, organization_id, codigo, nome, preco_cents) values
      ('${RAS}', '${ORG}', 'V-RAS', 'Preenchedor fictício', 0), ('${TOX}', '${ORG}', 'V-TOX', 'Toxina fictícia', 0),
      ('${VEN}', '${ORG}', 'V-VEN', 'Anestésico fictício', 0), ('${FRA}', '${ORG}', 'V-FRA', 'Frasco fictício', 0)
      on conflict (id) do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PAC}', '${ORG}', 'Paciente Revisao', '+5511990003801') on conflict (id) do nothing;
    insert into public.calendar_appointments (id, organization_id, title, starts_at, ends_at, owner_user_id, contact_id, status) values
      ('${AG1}', '${ORG}', 'Procedimento 1', now() - interval '3 hours', now() - interval '2 hours', '${PROF}', '${PAC}', 'confirmed'),
      ('${AG2}', '${ORG}', 'Procedimento 2', now() - interval '1 hour', now(), '${PROF}', '${PAC}', 'confirmed')
      on conflict (id) do nothing;
  `);
  sql(fn(ADM, "fn_clinic_definir_estoque", `'${ORG}', true`));
  local = ultima(sql(`select id from public.clinic_estoque_locais where organization_id = '${ORG}' and padrao;`));
  cfg(RAS, { rastreado: true, registro_anvisa: "1.0000.0000.001-1" });
  cfg(TOX, {});
  cfg(VEN, {});
  cfg(FRA, { unidade_estoque: "frasco", unidade_aplicacao: "U", fator_conversao: 10, fracionavel: true, validade_pos_abertura_horas: 24 });
  loteRas = entrada(RAS, 20, { lote: "  ab-1 ", validade: "2099-01-31" });
  loteCedo = entrada(TOX, 50, { lote: "CEDO", validade: "2030-01-31" });
  loteTarde = entrada(TOX, 50, { lote: "TARDE", validade: "2099-12-31" });
  loteVencido = ultima(
    sql(`
      with l as (insert into public.clinic_estoque_lotes (organization_id, product_id, codigo, validade)
                 values ('${ORG}', '${VEN}', 'vx', '2020-01-01') returning id),
           o as (insert into public.clinic_estoque_operacoes (organization_id, tipo, origem_tipo)
                 values ('${ORG}', 'entrada', 'manual') returning id),
           m as (insert into public.clinic_estoque_movimentos (organization_id, operacao_id, product_id, lote_id, local_id, quantidade)
                 select '${ORG}', o.id, '${VEN}', l.id, '${local}', 1 from l, o returning lote_id)
      select lote_id from m;`),
  );
});

describe("cadastro e lote (C11, C7, C5, C8)", () => {
  it("código do lote é normalizado: minúsculas e espaços caem no mesmo lote", () => {
    expect(ultima(sql(`select codigo from public.clinic_estoque_lotes where id = '${loteRas}';`))).toBe("AB-1");
    expect(entrada(RAS, 1, { lote: "AB-1", validade: "2099-01-31" })).toBe(loteRas);
    expect(ultima(sql(`select codigo from public.clinic_estoque_lotes where id = '${loteVencido}';`))).toBe("VX");
  });

  it("fracionável sem prazo e controlado com 'outro' são recusados", () => {
    expect(erro(fn(ADM, "fn_clinic_estoque_produto_salvar", `'${ORG}', '${FRA}', ${dados({ fracionavel: true })}, null`))).toMatch(
      /clinic_produto_estoque_fracionavel_prazo/,
    );
    expect(
      erro(fn(ADM, "fn_clinic_estoque_produto_salvar", `'${ORG}', '${VEN}', ${dados({ controlado: true, conselhos_permitidos: ["outro"] })}, null`)),
    ).toMatch(/clinic_produto_estoque_controlado_conselho/);
  });

  it("bloquear lote: só com estoque.configurar, com motivo, só da própria empresa", () => {
    expect(erro(fn(ATEND, "fn_clinic_estoque_lote_bloquear", `'${ORG}', '${loteCedo}', true, 'Recall fictício'`))).toMatch(/acesso_proibido/);
    expect(erro(fn(ADM, "fn_clinic_estoque_lote_bloquear", `'${ORG}', '${loteCedo}', true, null`))).toMatch(/estoque_sem_motivo/);
    expect(erro(fn(ADM_B, "fn_clinic_estoque_lote_bloquear", `'${ORG}', '${loteCedo}', true, 'Recall fictício'`))).toMatch(/acesso_proibido/);
    sql(fn(ADM, "fn_clinic_estoque_lote_bloquear", `'${ORG}', '${loteCedo}', true, 'Recall fictício do fabricante'`));
    expect(ultima(sql(`select bloqueado_em is not null from public.clinic_estoque_lotes where id = '${loteCedo}';`))).toBe("t");
  });
});

describe("baixa pelo prontuário (C1, C8, C4)", () => {
  it("insumo de produto rastreado sem lote/validade é recusado", () => {
    const at = json<{ id: string }>(sql(como(PROF, `select public.fn_clinic_iniciar_atendimento('${ORG}', '${AG1}');`))).id;
    const sem = [{ descricao: "Preenchedor", quantidade: 1, unidade: "un", product_id: RAS }];
    expect(
      erro(
        como(
          PROF,
          `select public.fn_clinic_procedimento_salvar('${ORG}', '${at}', null, '${JSON.stringify({ descricao: "x" })}'::jsonb, '${JSON.stringify(sem)}'::jsonb, 0);`,
        ),
      ),
    ).toMatch(/insumo_lote_obrigatorio/);
  });

  it("FEFO pula o lote bloqueado e marca presumido; lote informado não é presumido; vencido aplicado gera alerta", () => {
    atender(AG1, [
      { descricao: "Preenchedor", quantidade: 2, unidade: "un", product_id: RAS, lote: "ab-1", validade: "2099-01-31" },
      { descricao: "Toxina", quantidade: 10, unidade: "un", product_id: TOX },
      { descricao: "Anestésico", quantidade: 1, unidade: "un", product_id: VEN, lote: "VX" },
    ]);
    // o lote bloqueado (vence antes) ficou intacto; saiu do seguinte, presumido
    expect(ultima(sql(`select sum(quantidade) from public.clinic_estoque_movimentos where lote_id = '${loteCedo}';`))).toBe("50.000");
    expect(
      ultima(sql(`select string_agg(distinct lote_presumido::text, ',') from public.clinic_estoque_movimentos where lote_id = '${loteTarde}' and quantidade < 0;`)),
    ).toBe("true");
    opRas = ultima(
      sql(`select operacao_id from public.clinic_estoque_movimentos where lote_id = '${loteRas}' and quantidade < 0 and not lote_presumido;`),
    );
    expect(opRas).toMatch(/^[0-9a-f-]{36}$/);
    // lote vencido informado: baixou e abriu alerta de evento
    expect(ultima(sql(`select sum(quantidade) from public.clinic_estoque_movimentos where lote_id = '${loteVencido}';`))).toBe("0.000");
    expect(
      ultima(sql(`select count(*) from public.clinic_estoque_alertas where organization_id = '${ORG}' and tipo = 'consumo_lote_vencido' and status = 'aberto';`)),
    ).toBe("1");
    sql(`set role service_role; select public.fn_clinic_estoque_varrer_alertas();`);
    expect(
      ultima(sql(`select status from public.clinic_estoque_alertas where organization_id = '${ORG}' and tipo = 'consumo_lote_vencido';`)),
    ).toBe("aberto");
  });
});

describe("recall pelo prontuário, auditado (C2, S1)", () => {
  it("acha o baixado e o presumido; registra a consulta no banco, só com ids e contagem", () => {
    const antes = Number(ultima(sql(`select count(*) from public.api_audit_log where action = 'clinic.estoque_rastreio_consultado' and organization_id = '${ORG}';`)));
    const r = recall(loteRas);
    expect(r.lote.codigo).toBe("AB-1");
    expect(r.pacientes).toEqual([expect.objectContaining({ paciente: "Paciente Revisao", status: "baixado" })]);
    expect(recall(loteTarde).pacientes).toEqual([expect.objectContaining({ status: "lote_presumido" })]);
    const log = sql(`select metadata::text from public.api_audit_log where action = 'clinic.estoque_rastreio_consultado' and organization_id = '${ORG}' order by created_at;`)
      .split("\n");
    expect(log.length).toBe(antes + 2);
    expect(JSON.parse(log.at(-2)!)).toEqual({ numero: 1, tipo: "auditoria" });
  });

  it("pendente (lote com validade que não confere) e estornado aparecem com status", () => {
    atender(AG2, [{ descricao: "Preenchedor", quantidade: 1, unidade: "un", product_id: RAS, lote: "AB-1", validade: "2098-01-01" }]);
    sql(fn(ADM, "fn_clinic_estoque_estornar", `'${ORG}', '${opRas}', 'Lançado no lote errado'`));
    const status = recall(loteRas).pacientes.map((p) => p.status).sort();
    expect(status).toEqual(["estornado", "pendente"]);
  });

  it("admin sem papel clínico, atendente e outra empresa recusados; RPC antiga fora do cliente; tipo livre recusado", () => {
    for (const ator of [ADM, ATEND]) {
      expect(erro(fn(ator, "fn_clinic_estoque_rel_rastreio_lote", `'${ORG}', '${loteRas}', 'auditoria'`))).toMatch(/acesso_proibido/);
    }
    expect(erro(fn(ADM_B, "fn_clinic_estoque_rel_rastreio_lote", `'${ORG}', '${loteRas}', 'auditoria'`))).toMatch(/acesso_proibido/);
    expect(erro(fn(PROF, "fn_clinic_estoque_rel_rastreio_lote", `'${ORG}', '${loteRas}'`))).toMatch(/permission denied/);
    expect(erro(fn(PROF, "fn_clinic_estoque_rel_rastreio_lote", `'${ORG}', '${loteRas}', 'paciente X'`))).toMatch(/estoque_dados_invalidos/);
  });

  it("limite: 30 consultas por hora por pessoa", () => {
    sql(`insert into public.api_audit_log (organization_id, actor_user_id, action, resource_type, metadata)
         select '${ORG}', '${PROF}', 'clinic.estoque_rastreio_consultado', 'clinic_estoque_lote', '{}'::jsonb
           from generate_series(1, 30);`);
    expect(erro(fn(PROF, "fn_clinic_estoque_rel_rastreio_lote", `'${ORG}', '${loteRas}', 'auditoria'`))).toMatch(/estoque_limite_consultas/);
  });
});

describe("NF-e (S4, C3, C6)", () => {
  const nota = (chave: string, rastro: Array<{ lote: string; quantidade: number; validade: string; fabricacao?: string }>) => ({
    chave,
    numero: "999",
    serie: "1",
    emissao: "2026-10-01",
    emitente: { cnpj: "00000000000191", nome: "Distribuidora Fictícia" },
    destinatario_cnpj: "11111111000111",
    total_cents: 10000,
    sha256: "0".repeat(64),
    arquivo_path: `${ORG}/${chave}.xml`,
    itens: [
      {
        numero: 1, codigo: "PRE-1", descricao: "PREENCHEDOR FICTICIO", unidade: "UN", quantidade: 5,
        valor_total_cents: 10000, custo_total_cents: 10000, registro_anvisa: "9999999999999", rastro, product_id: RAS,
      },
    ],
  });

  it("sem o XML no Storage da clínica não registra", () => {
    expect(erro(fn(ADM, "fn_clinic_estoque_nfe_registrar", `'${ORG}', ${dados(nota(CHAVE_SEM_XML, []))}`))).toMatch(/estoque_nfe_sem_arquivo/);
  });

  it("dois rastros viram dois lotes (com fabricação); soma divergente é recusada; registro divergente alerta", () => {
    sql(`insert into storage.objects (bucket_id, name) values ('clinic-nfe', '${ORG}/${CHAVE}.xml') on conflict do nothing;`);
    const rastros = [
      { lote: "n-1", quantidade: 3, validade: "2099-03-31", fabricacao: "2026-01-10" },
      { lote: "n-2", quantidade: 1, validade: "2099-04-30" },
    ];
    const nfe = json<{ id: string }>(sql(fn(ADM, "fn_clinic_estoque_nfe_registrar", `'${ORG}', ${dados(nota(CHAVE, rastros))}`))).id;
    const item = ultima(sql(`select id from public.clinic_estoque_nfe_itens where nfe_id = '${nfe}';`));
    // com vários rastros, a conferência não pede lote (vem do XML)
    sql(fn(ADM, "fn_clinic_estoque_nfe_item_conferir", `'${ORG}', '${item}', ${dados({ product_id: RAS, fator: 1 })}`));
    expect(erro(fn(ADM, "fn_clinic_estoque_nfe_lancar", `'${ORG}', '${nfe}', ${dados({ local_id: local })}`))).toMatch(
      /estoque_nfe_rastro_divergente/,
    );
    // corrige a nota fictícia para a soma bater (3 + 2 = 5)
    sql(`update public.clinic_estoque_nfe_itens set rastro = jsonb_set(rastro, '{1,quantidade}', '2') where id = '${item}';`);
    sql(fn(ADM, "fn_clinic_estoque_nfe_lancar", `'${ORG}', '${nfe}', ${dados({ local_id: local })}`));
    expect(
      sql(`select l.codigo || ':' || coalesce(l.fabricacao::text, '-') || ':' || coalesce(l.registro_anvisa, '-') || ':' || sum(m.quantidade)
             from public.clinic_estoque_lotes l join public.clinic_estoque_movimentos m on m.lote_id = l.id
            where l.organization_id = '${ORG}' and l.codigo in ('N-1', 'N-2')
            group by l.id order by l.codigo;`).split("\n"),
    ).toEqual(["N-1:2026-01-10:9999999999999:3.000", "N-2:-:9999999999999:2.000"]);
    expect(
      ultima(sql(`select count(*) from public.clinic_estoque_alertas where organization_id = '${ORG}' and tipo = 'nfe_registro_divergente';`)),
    ).toBe("1");
  });
});

describe("frasco, perda e estorno (C9, C10)", () => {
  it("perda com categoria; categoria inválida recusada; encerrar frasco = pós-abertura; estorno não volta ao frasco encerrado", () => {
    const lote = entrada(FRA, 2, { em_unidade_estoque: true });
    const perda = json<{ operacao_id: string }>(
      sql(fn(ADM, "fn_clinic_estoque_perda", `'${ORG}', ${dados({ lote_id: lote, local_id: local, quantidade: 1, motivo: "Contaminou na bancada", categoria: "contaminacao" })}`)),
    ).operacao_id;
    expect(ultima(sql(`select motivo_categoria from public.clinic_estoque_operacoes where id = '${perda}';`))).toBe("contaminacao");
    expect(
      erro(fn(ADM, "fn_clinic_estoque_perda", `'${ORG}', ${dados({ lote_id: lote, local_id: local, quantidade: 1, motivo: "Teste", categoria: "qualquer" })}`)),
    ).toMatch(/estoque_dados_invalidos/);
    const frasco = json<{ frasco_id: string }>(sql(fn(ADM, "fn_clinic_estoque_frasco_abrir", `'${ORG}', ${dados({ lote_id: lote, local_id: local })}`))).frasco_id;
    sql(fn(ADM, "fn_clinic_estoque_frasco_encerrar", `'${ORG}', '${frasco}', 'Fim do prazo fictício'`));
    const opEncerrar = ultima(sql(`select id from public.clinic_estoque_operacoes where organization_id = '${ORG}' and origem_tipo = 'frasco' and tipo = 'perda' order by created_at desc limit 1;`));
    expect(ultima(sql(`select motivo_categoria from public.clinic_estoque_operacoes where id = '${opEncerrar}';`))).toBe("pos_abertura");
    expect(erro(fn(ADM, "fn_clinic_estoque_estornar", `'${ORG}', '${opEncerrar}', 'Engano fictício'`))).toMatch(/estoque_frasco_encerrado/);
  });
});

describe("custo e ligação com o atendimento fora da leitura direta (S2, C13)", () => {
  it("quem só vê o estoque não lê custo, origem nem atendimento; vê lote e saldo", () => {
    for (const q of [
      "select custo_unitario_cents from public.clinic_estoque_lotes limit 1",
      "select custo_unitario_cents from public.clinic_estoque_movimentos limit 1",
      "select origem_id from public.clinic_estoque_operacoes limit 1",
      "select atendimento_id from public.clinic_estoque_pendencias limit 1",
      "select appointment_id from public.clinic_estoque_reservas limit 1",
    ]) {
      expect(erro(como(ATEND, `${q};`))).toMatch(/permission denied/);
    }
    expect(Number(ultima(sql(como(ATEND, `select count(*) from public.clinic_estoque_lotes where organization_id = '${ORG}';`))))).toBeGreaterThan(0);
    expect(ultima(sql(como(ATEND, `select count(*) from public.clinic_estoque_nfe_itens where organization_id = '${ORG}';`)))).toBe("0");
    expect(erro(fn(ATEND, "fn_clinic_estoque_custos_lotes", `'${ORG}', null`))).toMatch(/acesso_proibido/);
    expect(erro(fn(ADM_B, "fn_clinic_estoque_custos_lotes", `'${ORG}', null`))).toMatch(/acesso_proibido/);
    expect(Number(ultima(sql(como(ADM, `select count(*) from public.fn_clinic_estoque_custos_lotes('${ORG}', null);`))))).toBeGreaterThan(0);
  });
});
