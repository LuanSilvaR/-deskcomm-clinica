/**
 * clinic (fork, orçamento O1) — migration 8006: tabela de preços com vigência.
 *
 * Prova no Postgres real:
 *   - a opção nasce desligada; só o administrador liga; desligada, ninguém publica;
 *   - quem publica é `orcamentos.precos` (gerente); atendente e visualizador não;
 *   - mudar o preço ACRESCENTA uma vigência; a view devolve a mais nova; publicar
 *     igual não cria linha; `ativo = false` tira o item da tabela vigente;
 *   - UPDATE/DELETE direto recusados (authenticated sem privilégio; dono do banco
 *     pelo trigger); só a cascata da exclusão da empresa apaga;
 *   - isolamento entre 2 empresas: quem é da A lê 0 linhas da B, não publica na B
 *     e não usa procedimento da B;
 *   - sem `orcamentos.ver` (visualizador) lê 0 linhas;
 *   - anon não executa as funções.
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

const ORG = "c8006000-0000-4000-8000-00000000000a";
const ORG_B = "c8006000-0000-4000-8000-00000000000b";
const ADM = "c8006000-1111-4000-8000-0000000000a1";
const GER = "c8006000-1111-4000-8000-0000000000a2";
const ATE = "c8006000-1111-4000-8000-0000000000a3";
const VIS = "c8006000-1111-4000-8000-0000000000a4";
const GER_B = "c8006000-1111-4000-8000-0000000000b1";
const PROC = "c8006000-2222-4000-8000-0000000000a1";
const PROC_B = "c8006000-2222-4000-8000-0000000000b1";

const publicar = (user: string, org: string, dados: string) =>
  ultima(sql(como(user, `select public.fn_clinic_preco_publicar('${org}', '${dados}'::jsonb);`)));
const vigente = (user: string, item: string, sessoes = 1) =>
  ultima(
    sql(
      como(
        user,
        `select coalesce((select preco_cents::text from public.clinic_precos_vigentes
                           where procedure_id = '${item}' and sessoes = ${sessoes}), 'nenhum');`,
      ),
    ),
  );
const linhas = (user: string, org: string) =>
  ultima(sql(como(user, `select count(*) from public.clinic_precos where organization_id = '${org}';`)));

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'precos-adm@invariant.test'), ('${GER}', 'precos-ger@invariant.test'),
      ('${ATE}', 'precos-ate@invariant.test'), ('${VIS}', 'precos-vis@invariant.test'),
      ('${GER_B}', 'precos-ger-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name) values
      ('${ORG}', 'precos-inv-a', 'Preços Invariant A', 'Preços A'),
      ('${ORG_B}', 'precos-inv-b', 'Preços Invariant B', 'Preços B')
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
    update public.organizations
       set settings = jsonb_build_object('clinic', jsonb_build_object('orcamentos', true))
     where id = '${ORG_B}';
  `);
});

describe("tabela de preços (8006)", () => {
  it("a opção nasce desligada e, desligada, ninguém publica", () => {
    expect(ultima(sql(`select coalesce(settings -> 'clinic' ->> 'orcamentos', 'ausente') from public.organizations where id = '${ORG}';`))).toBe(
      "ausente",
    );
    expect(erro(como(GER, `select public.fn_clinic_preco_publicar('${ORG}', '{"procedure_id":"${PROC}","preco_cents":15000}'::jsonb);`))).toMatch(
      /orcamentos_desligado/,
    );
  });

  it("só o administrador liga a opção", () => {
    expect(erro(como(GER, `select public.fn_clinic_definir_orcamentos('${ORG}', true);`))).toMatch(/clinic_flag_forbidden/);
    const r = JSON.parse(ultima(sql(como(ADM, `select public.fn_clinic_definir_orcamentos('${ORG}', true);`)))) as { ligado: boolean; mudou: boolean };
    expect(r).toEqual({ ligado: true, mudou: true });
  });

  it("gerente publica; atendente e visualizador são recusados", () => {
    const r = JSON.parse(publicar(GER, ORG, `{"procedure_id":"${PROC}","preco_cents":15000}`)) as { mudou: boolean };
    expect(r.mudou).toBe(true);
    expect(erro(como(ATE, `select public.fn_clinic_preco_publicar('${ORG}', '{"procedure_id":"${PROC}","preco_cents":1}'::jsonb);`))).toMatch(
      /acesso_proibido/,
    );
    expect(erro(como(VIS, `select public.fn_clinic_preco_publicar('${ORG}', '{"procedure_id":"${PROC}","preco_cents":1}'::jsonb);`))).toMatch(
      /acesso_proibido/,
    );
  });

  it("atendente lê a tabela; visualizador (sem orcamentos.ver) lê 0 linhas", () => {
    expect(vigente(ATE, PROC)).toBe("15000");
    expect(linhas(VIS, ORG)).toBe("0");
  });

  it("mudar o preço acrescenta vigência; publicar igual não cria linha", () => {
    publicar(GER, ORG, `{"procedure_id":"${PROC}","preco_cents":18000}`);
    expect(vigente(GER, PROC)).toBe("18000");
    expect(linhas(GER, ORG)).toBe("2");
    const igual = JSON.parse(publicar(GER, ORG, `{"procedure_id":"${PROC}","preco_cents":18000}`)) as { mudou: boolean };
    expect(igual.mudou).toBe(false);
    expect(linhas(GER, ORG)).toBe("2");
  });

  it("pacote é outro item (nº de sessões); desativar tira da tabela vigente", () => {
    publicar(GER, ORG, `{"procedure_id":"${PROC}","sessoes":10,"preco_cents":150000,"descricao":"Pacote 10 sessões"}`);
    expect(vigente(GER, PROC, 10)).toBe("150000");
    expect(vigente(GER, PROC, 1)).toBe("18000");
    publicar(GER, ORG, `{"procedure_id":"${PROC}","sessoes":10,"preco_cents":150000,"descricao":"Pacote 10 sessões","ativo":false}`);
    expect(vigente(GER, PROC, 10)).toBe("nenhum");
    expect(vigente(GER, PROC, 1)).toBe("18000");
  });

  it("dado inválido é recusado", () => {
    expect(erro(como(GER, `select public.fn_clinic_preco_publicar('${ORG}', '{"procedure_id":"${PROC}","preco_cents":-1}'::jsonb);`))).toMatch(
      /preco_dados_invalidos/,
    );
    expect(erro(como(GER, `select public.fn_clinic_preco_publicar('${ORG}', '{"procedure_id":"${PROC}","sessoes":0,"preco_cents":1}'::jsonb);`))).toMatch(
      /preco_dados_invalidos/,
    );
    expect(erro(como(GER, `select public.fn_clinic_preco_publicar('${ORG}', '{"preco_cents":1}'::jsonb);`))).toMatch(/preco_dados_invalidos/);
  });

  it("o histórico não muda: UPDATE/DELETE direto recusados", () => {
    expect(erro(como(GER, `update public.clinic_precos set preco_cents = 1 where organization_id = '${ORG}';`))).toMatch(/permission denied/);
    expect(erro(como(GER, `delete from public.clinic_precos where organization_id = '${ORG}';`))).toMatch(/permission denied/);
    expect(erro(como(GER, `insert into public.clinic_precos (organization_id, procedure_id, preco_cents) values ('${ORG}', '${PROC}', 1);`))).toMatch(
      /permission denied/,
    );
    expect(erro(`update public.clinic_precos set preco_cents = 1 where organization_id = '${ORG}';`)).toMatch(/preco_imutavel/);
    expect(erro(`delete from public.clinic_precos where organization_id = '${ORG}';`)).toMatch(/preco_imutavel/);
  });

  it("isolamento entre 2 empresas", () => {
    publicar(GER_B, ORG_B, `{"procedure_id":"${PROC_B}","preco_cents":9900}`);
    expect(linhas(GER, ORG_B)).toBe("0");
    expect(linhas(GER_B, ORG)).toBe("0");
    expect(vigente(GER, PROC_B)).toBe("nenhum");
    expect(erro(como(GER, `select public.fn_clinic_preco_publicar('${ORG_B}', '{"procedure_id":"${PROC_B}","preco_cents":1}'::jsonb);`))).toMatch(
      /acesso_proibido/,
    );
    expect(erro(como(GER, `select public.fn_clinic_preco_publicar('${ORG}', '{"procedure_id":"${PROC_B}","preco_cents":1}'::jsonb);`))).toMatch(
      /preco_item_invalido/,
    );
  });

  it("anon não executa as funções", () => {
    expect(erro(`set role anon; select public.fn_clinic_definir_orcamentos('${ORG}', true);`)).toMatch(/permission denied/);
    expect(erro(`set role anon; select public.fn_clinic_preco_publicar('${ORG}', '{}'::jsonb);`)).toMatch(/permission denied/);
    expect(erro(`set role authenticated; select public.fn_clinic_orcamentos_exigir('${ORG}', 'orcamentos.ver');`)).toMatch(/permission denied/);
  });

  it("a cascata da exclusão da empresa apaga os preços", () => {
    sql(`delete from public.organizations where id = '${ORG_B}';`);
    expect(ultima(sql(`select count(*) from public.clinic_precos where organization_id = '${ORG_B}';`))).toBe("0");
  });
});
