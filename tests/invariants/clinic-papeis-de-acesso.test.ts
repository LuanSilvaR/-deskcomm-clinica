/**
 * clinic (fork, ACL) — migrations 9009 a 9011: papéis de acesso por empresa.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. toda empresa ganha os 4 papéis-modelo; cada membro recebe o do seu nível;
 *      e o nível derivado das permissões == nível legado para TODOS os vínculos;
 *   2. modo desligado: permissões efetivas == o que o nível legado dava;
 *   3. isolamento: outra empresa não aparece; FK composta recusa papel cruzado;
 *      ninguém escreve direto nas tabelas (só pelas funções);
 *   4. modo ligado: papel customizado (Recepcionista), união de papéis;
 *   5. travas: dependência faltando, chave inventada, concessão acima do próprio
 *      poder, papel de sistema intocável, papel em uso, último Administrador;
 *   6. A CORRIDA: dois administradores tirando o papel um do outro ao mesmo
 *      tempo — a empresa não fica sem Administrador.
 */
import { execFileSync, spawn } from "node:child_process";

import { beforeAll, describe, expect, it } from "vitest";

import { CHAVES_DE_PERMISSAO, CATALOGO_DE_PERMISSOES, permissoesDoNivel } from "@/lib/clinic/acesso/catalogo";

const container = process.env.TEST_DB_CONTAINER;
if (!container) {
  throw new Error("TEST_DB_CONTAINER not set — rode esta suíte via `pnpm test:db` (scripts/test-db.sh)");
}
const containerName: string = container;
const PSQL = ["exec", "-i", containerName, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-f", "-"];

function sql(script: string): string {
  return execFileSync("docker", PSQL, { input: script, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}
function sqlAsync(script: string): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const p = spawn("docker", PSQL);
    let stderr = "";
    p.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    p.on("close", (code) => resolve({ code: code ?? 1, stderr }));
    p.stdin.end(script);
  });
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
/** Linhas de resultado, sem o eco de `set role` (SET) e do `set_config` (o JSON das claims). */
const lista = (out: string) =>
  out
    .split("\n")
    .filter((l) => l && l !== "SET" && !l.startsWith("{"))
    .sort();
const arr = (xs: readonly string[]) => `array[${xs.map((x) => `'${x}'`).join(",")}]::text[]`;

const ORG_A = "acc10000-0000-4000-8000-00000000000a";
const ORG_B = "acc10000-0000-4000-8000-00000000000b";
const ADM_A = "acc10000-1111-4000-8000-0000000000a1";
const ADM2_A = "acc10000-1111-4000-8000-0000000000a2";
const GER_A = "acc10000-1111-4000-8000-0000000000a3";
const AT_A = "acc10000-1111-4000-8000-0000000000a4";
const VIS_A = "acc10000-1111-4000-8000-0000000000a5";
const ADM_B = "acc10000-1111-4000-8000-0000000000b1";

const papel = (org: string, systemKey: string) =>
  ultima(sql(`select id from public.clinic_roles where organization_id = '${org}' and system_key = '${systemKey}';`));
const perms = (user: string, org: string) => lista(sql(como(user, `select * from public.fn_member_permissions('${org}');`)));
const ligar = (org: string, v: boolean) =>
  sql(`update public.organizations set settings = jsonb_set(coalesce(settings,'{}'::jsonb), '{clinic}',
         coalesce(settings->'clinic','{}'::jsonb) || jsonb_build_object('acesso_por_permissoes', ${v}), true) where id = '${org}';`);
const salvar = (ator: string, id: string | null, nome: string, chaves: readonly string[], ativo = true) =>
  como(ator, `select public.fn_acesso_salvar_papel('${ORG_A}', ${id ? `'${id}'` : "null"}, '${nome}', null, ${ativo}, ${arr(chaves)});`);
const atribuir = (ator: string, alvo: string, papeis: readonly string[]) =>
  como(ator, `select public.fn_acesso_atribuir_papeis('${ORG_A}', '${alvo}', array[${papeis.map((p) => `'${p}'`).join(",")}]::uuid[]);`);

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM_A}', 'acl-adm-a@invariant.test'), ('${ADM2_A}', 'acl-adm2-a@invariant.test'),
      ('${GER_A}', 'acl-ger-a@invariant.test'), ('${AT_A}', 'acl-at-a@invariant.test'),
      ('${VIS_A}', 'acl-vis-a@invariant.test'), ('${ADM_B}', 'acl-adm-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name) values
      ('${ORG_A}', 'acl-inv-a', 'ACL Invariant A', 'ACL A'), ('${ORG_B}', 'acl-inv-b', 'ACL Invariant B', 'ACL B')
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM_A}', '${ORG_A}', 'admin', now()), ('${GER_A}', '${ORG_A}', 'manager', now()),
      ('${AT_A}', '${ORG_A}', 'agent', now()), ('${VIS_A}', '${ORG_A}', 'viewer', now()),
      ('${ADM_B}', '${ORG_B}', 'admin', now())
      on conflict do nothing;
  `);
});

describe("provisionamento e migração", () => {
  it("o catálogo do banco é o do código", () => {
    const banco = lista(sql(`select key || '|' || nivel_base || '|' || critica from public.clinic_permissions;`));
    const codigo = CHAVES_DE_PERMISSAO.map((k) => `${k}|${CATALOGO_DE_PERMISSOES[k]!.nivelBase}|${CATALOGO_DE_PERMISSOES[k]!.critica ? "true" : "false"}`).sort();
    expect(banco).toEqual(codigo);
  });

  it("empresa nova nasce com os 4 papéis; só o Administrador é de sistema", () => {
    expect(lista(sql(`select system_key || ':' || is_system from public.clinic_roles where organization_id = '${ORG_A}';`))).toEqual([
      "administrador:true",
      "atendente:false",
      "gerente:false",
      "visualizador:false",
    ]);
  });

  it("cada membro recebe o papel do seu nível", () => {
    expect(
      lista(
        sql(`select uo.role || '>' || r.system_key from public.user_organizations uo
               join public.clinic_member_roles mr on mr.organization_id = uo.organization_id and mr.user_id = uo.user_id
               join public.clinic_roles r on r.id = mr.role_id
              where uo.organization_id = '${ORG_A}';`),
      ),
    ).toEqual(["admin>administrador", "agent>atendente", "manager>gerente", "viewer>visualizador"]);
  });

  it("nível derivado das permissões == nível legado para TODOS os vínculos do banco", () => {
    const divergentes = ultima(
      sql(`select count(*) from public.user_organizations uo
            where uo.revoked_at is null and uo.role <> (
              select case max(public.fn_nivel_rank(c.nivel_base)) when 4 then 'admin' when 3 then 'manager' when 2 then 'agent' else 'viewer' end
                from public.clinic_member_roles mr
                join public.clinic_role_permissions rp on rp.role_id = mr.role_id
                join public.clinic_permissions c on c.key = rp.permission_key
               where mr.organization_id = uo.organization_id and mr.user_id = uo.user_id);`),
    );
    expect(divergentes).toBe("0");
  });
});

describe("modo desligado (como nasce): o nível legado manda", () => {
  it.each([
    [AT_A, "agent"],
    [VIS_A, "viewer"],
    [GER_A, "manager"],
  ] as const)("%s tem exatamente as permissões do nível %s", (user, nivel) => {
    expect(perms(user, ORG_A)).toEqual([...permissoesDoNivel(nivel)].sort());
  });

  it("trocar o papel legado espelha o papel-modelo", () => {
    sql(`update public.user_organizations set role = 'manager' where user_id = '${VIS_A}' and organization_id = '${ORG_A}';`);
    expect(
      ultima(sql(`select r.system_key from public.clinic_member_roles mr join public.clinic_roles r on r.id = mr.role_id
                   where mr.organization_id = '${ORG_A}' and mr.user_id = '${VIS_A}';`)),
    ).toBe("gerente");
    sql(`update public.user_organizations set role = 'viewer' where user_id = '${VIS_A}' and organization_id = '${ORG_A}';`);
  });
});

describe("isolamento", () => {
  it("quem é da A não enxerga papéis, permissões nem atribuições da B", () => {
    for (const t of ["clinic_roles", "clinic_role_permissions", "clinic_member_roles"]) {
      expect(ultima(sql(como(AT_A, `select count(*) from public.${t} where organization_id = '${ORG_B}';`)))).toBe("0");
    }
    expect(perms(AT_A, ORG_B)).toEqual([]);
  });

  it("FK composta: papel da B não entra em atribuição nem permissão da A", () => {
    const papelB = papel(ORG_B, "gerente");
    expect(erro(`insert into public.clinic_member_roles (organization_id, user_id, role_id) values ('${ORG_A}', '${AT_A}', '${papelB}');`)).toMatch(
      /clinic_member_roles_papel_da_org/,
    );
    expect(erro(`insert into public.clinic_role_permissions (organization_id, role_id, permission_key) values ('${ORG_A}', '${papelB}', 'lgpd.tratar');`)).toMatch(
      /clinic_role_permissions_papel_da_org/,
    );
  });

  it("ninguém escreve direto (nem admin): só pelas funções", () => {
    expect(erro(como(ADM_A, `insert into public.clinic_roles (organization_id, nome) values ('${ORG_A}', 'Direto');`))).toMatch(/permission denied/);
    expect(erro(como(ADM_A, `delete from public.clinic_member_roles where organization_id = '${ORG_A}';`))).toMatch(/permission denied/);
  });

  it("admin da B não mexe em papel da A", () => {
    expect(erro(como(ADM_B, `select public.fn_acesso_salvar_papel('${ORG_A}', null, 'Intruso', null, true, array['agenda.ver']::text[]);`))).toMatch(
      /acesso_proibido/,
    );
  });
});

describe("modo ligado: papéis customizados", () => {
  let recepcionista = "";
  beforeAll(() => ligar(ORG_A, true));

  it("admin cria Recepcionista e o atribui; o membro passa a ter exatamente aquilo", () => {
    const r = ultima(sql(salvar(ADM_A, null, "Recepcionista", ["agenda.ver", "agenda.marcar", "pacientes.ver", "pacientes.criar"])));
    recepcionista = (JSON.parse(r) as { id: string }).id;
    sql(atribuir(ADM_A, VIS_A, [recepcionista]));
    expect(perms(VIS_A, ORG_A)).toEqual(["agenda.marcar", "agenda.ver", "pacientes.criar", "pacientes.ver"]);
    expect(ultima(sql(como(VIS_A, `select public.fn_has_permission('${ORG_A}', 'financeiro.ver');`)))).toBe("f");
  });

  it("vários papéis: vale a união", () => {
    sql(atribuir(ADM_A, VIS_A, [recepcionista, papel(ORG_A, "visualizador")]));
    const p = perms(VIS_A, ORG_A);
    expect(p).toContain("agenda.marcar");
    expect(p).toContain("financeiro.ver");
  });

  it("revogar: tirar a permissão do papel vale na hora", () => {
    sql(salvar(ADM_A, recepcionista, "Recepcionista", ["agenda.ver", "pacientes.ver", "pacientes.criar"]));
    expect(ultima(sql(como(VIS_A, `select public.fn_has_permission('${ORG_A}', 'agenda.marcar');`)))).toBe("f");
  });

  it("papel desativado não conta", () => {
    sql(salvar(ADM_A, recepcionista, "Recepcionista", ["agenda.ver", "pacientes.ver", "pacientes.criar"], false));
    expect(perms(VIS_A, ORG_A)).not.toContain("pacientes.criar");
    sql(salvar(ADM_A, recepcionista, "Recepcionista", ["agenda.ver", "pacientes.ver", "pacientes.criar"], true));
  });

  it("dependência faltando e chave inventada são recusadas", () => {
    expect(erro(salvar(ADM_A, null, "Sem ver", ["pacientes.editar"]))).toMatch(/acesso_dependencia_faltando/);
    expect(erro(salvar(ADM_A, null, "Poder", ["sistema.superpoder"]))).toMatch(/acesso_permissao_desconhecida/);
  });

  it("quem não tem papeis.gerenciar não cria papel", () => {
    expect(erro(salvar(AT_A, null, "Do atendente", ["agenda.ver"]))).toMatch(/acesso_proibido/);
  });

  it("regra de concessão: gerente com poder de papéis não dá o que não tem", () => {
    const chefe = (JSON.parse(
      ultima(
        sql(
          salvar(ADM_A, null, "Gerente com papéis", [
            ...permissoesDoNivel("manager"),
            "papeis.ver",
            "papeis.gerenciar",
            "equipe.atribuir_papeis",
          ]),
        ),
      ),
    ) as { id: string }).id;
    sql(atribuir(ADM_A, GER_A, [chefe]));
    expect(erro(salvar(GER_A, null, "Com LGPD", ["lgpd.ver", "lgpd.tratar"]))).toMatch(/acesso_concessao_acima_do_proprio/);
    expect(erro(salvar(GER_A, null, "Só agenda", ["agenda.ver", "agenda.marcar"]))).toBeNull();
    expect(erro(atribuir(GER_A, AT_A, [papel(ORG_A, "administrador")]))).toMatch(/acesso_concessao_acima_do_proprio/);
  });

  it("papel de sistema: não perde crítica, não muda de nome, não desativa, não se exclui", () => {
    const adm = papel(ORG_A, "administrador");
    expect(erro(salvar(ADM_A, adm, "Administrador", CHAVES_DE_PERMISSAO.filter((k) => k !== "papeis.gerenciar")))).toMatch(/acesso_papel_de_sistema/);
    expect(erro(salvar(ADM_A, adm, "Dono", CHAVES_DE_PERMISSAO))).toMatch(/acesso_papel_de_sistema/);
    expect(erro(salvar(ADM_A, adm, "Administrador", CHAVES_DE_PERMISSAO, false))).toMatch(/acesso_papel_de_sistema/);
    expect(erro(como(ADM_A, `select public.fn_acesso_excluir_papel('${ORG_A}', '${adm}');`))).toMatch(/acesso_papel_de_sistema/);
  });

  it("papel em uso não se exclui; sem ninguém, sim", () => {
    expect(erro(como(ADM_A, `select public.fn_acesso_excluir_papel('${ORG_A}', '${recepcionista}');`))).toMatch(/acesso_papel_em_uso/);
    const vazio = (JSON.parse(ultima(sql(salvar(ADM_A, null, "Temporário", ["agenda.ver"])))) as { id: string }).id;
    expect(erro(como(ADM_A, `select public.fn_acesso_excluir_papel('${ORG_A}', '${vazio}');`))).toBeNull();
  });

  it("o último Administrador não sai", () => {
    expect(erro(atribuir(ADM_A, ADM_A, [papel(ORG_A, "gerente")]))).toMatch(/acesso_ultimo_administrador/);
  });

  it("A CORRIDA: dois administradores tirando o papel um do outro ao mesmo tempo — sobra um", async () => {
    sql(`insert into public.user_organizations (user_id, organization_id, role, accepted_at) values ('${ADM2_A}', '${ORG_A}', 'viewer', now()) on conflict do nothing;`);
    sql(atribuir(ADM_A, ADM2_A, [papel(ORG_A, "administrador")]));
    const tira = (ator: string, alvo: string) => `
      begin;
      set local role authenticated;
      select set_config('request.jwt.claims', '{"sub":"${ator}"}', true);
      select public.fn_acesso_atribuir_papeis('${ORG_A}', '${alvo}', array['${papel(ORG_A, "gerente")}']::uuid[]);
      select pg_sleep(1.5);
      commit;`;
    const [a, b] = await Promise.all([sqlAsync(tira(ADM_A, ADM2_A)), sqlAsync(tira(ADM2_A, ADM_A))]);
    expect([a.code, b.code].sort()).toEqual([0, 3]);
    expect(
      ultima(
        sql(`select count(*) from public.clinic_member_roles mr join public.clinic_roles r on r.id = mr.role_id
              where mr.organization_id = '${ORG_A}' and r.system_key = 'administrador';`),
      ),
    ).toBe("1");
  });

  it("com o modo ligado, mexer no papel legado NÃO sobrescreve os papéis", () => {
    const antes = perms(AT_A, ORG_A);
    sql(`update public.user_organizations set role = 'viewer' where user_id = '${AT_A}' and organization_id = '${ORG_A}';`);
    expect(perms(AT_A, ORG_A)).toEqual(antes);
  });
});

describe("permissões das funções", () => {
  it.each([
    ["anon", "public.fn_member_permissions(uuid)"],
    ["anon", "public.fn_has_permission(uuid, text)"],
    ["anon", "public.fn_acesso_salvar_papel(uuid, uuid, text, text, boolean, text[])"],
    ["anon", "public.fn_acesso_atribuir_papeis(uuid, uuid, uuid[])"],
    ["authenticated", "public.fn_acesso_eh_administrador(uuid, uuid)"],
    ["authenticated", "public.fn_acesso_provisionar_org(uuid)"],
    ["authenticated", "public.fn_acesso_exigir_concessao(uuid, text[])"],
  ])("%s não executa %s", (papelDb, fn) => {
    expect(ultima(sql(`select has_function_privilege('${papelDb}', '${fn}', 'execute');`))).toBe("f");
  });
});

describe("migration 9012: ligar o modo e o nível legado calculado", () => {
  const ORG_C = "acc10000-0000-4000-8000-00000000000c";
  const ADM_C = "acc10000-1111-4000-8000-0000000000c1";
  const AT_C = "acc10000-1111-4000-8000-0000000000c2";
  const nivel = (user: string) =>
    ultima(sql(`select role from public.user_organizations where organization_id = '${ORG_C}' and user_id = '${user}';`));
  const definir = (ator: string, v: boolean) => como(ator, `select public.fn_clinic_definir_acesso_por_permissoes('${ORG_C}', ${v});`);

  beforeAll(() => {
    sql(`
      insert into auth.users (id, email) values ('${ADM_C}', 'acl-adm-c@invariant.test'), ('${AT_C}', 'acl-at-c@invariant.test') on conflict (id) do nothing;
      insert into public.organizations (id, slug, legal_name, display_name) values ('${ORG_C}', 'acl-inv-c', 'ACL Invariant C', 'ACL C') on conflict (id) do nothing;
      insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
        ('${ADM_C}', '${ORG_C}', 'admin', now()), ('${AT_C}', '${ORG_C}', 'agent', now()) on conflict do nothing;
    `);
  });

  it("atendente não liga o modo", () => {
    expect(erro(definir(AT_C, true))).toMatch(/acesso_proibido/);
  });

  it("admin liga; nada muda de nível ao ligar (papéis-modelo == legado)", () => {
    expect(ultima(sql(definir(ADM_C, true)))).toContain('"niveis_recalculados": 0');
    expect([nivel(ADM_C), nivel(AT_C)]).toEqual(["admin", "agent"]);
  });

  it("ligado: o nível legado segue as permissões — sobe e desce", () => {
    const gerente = ultima(sql(`select id from public.clinic_roles where organization_id = '${ORG_C}' and system_key = 'gerente';`));
    const visualizador = ultima(sql(`select id from public.clinic_roles where organization_id = '${ORG_C}' and system_key = 'visualizador';`));
    sql(como(ADM_C, `select public.fn_acesso_atribuir_papeis('${ORG_C}', '${AT_C}', array['${gerente}']::uuid[]);`));
    expect(nivel(AT_C)).toBe("manager");
    sql(como(ADM_C, `select public.fn_acesso_atribuir_papeis('${ORG_C}', '${AT_C}', array['${visualizador}']::uuid[]);`));
    expect(nivel(AT_C)).toBe("viewer");
    sql(como(ADM_C, `select public.fn_acesso_atribuir_papeis('${ORG_C}', '${AT_C}', array[]::uuid[]);`));
    expect(nivel(AT_C)).toBe("viewer"); // sem papel = sem permissão fina; o piso legado é viewer
    expect(ultima(sql(como(AT_C, `select count(*) from public.fn_member_permissions('${ORG_C}');`)))).toBe("0");
  });

  it("ligado: tirar permissão do papel recalcula o nível de quem o tem", () => {
    const gerente = ultima(sql(`select id from public.clinic_roles where organization_id = '${ORG_C}' and system_key = 'gerente';`));
    sql(como(ADM_C, `select public.fn_acesso_atribuir_papeis('${ORG_C}', '${AT_C}', array['${gerente}']::uuid[]);`));
    expect(nivel(AT_C)).toBe("manager");
    sql(como(ADM_C, `select public.fn_acesso_salvar_papel('${ORG_C}', '${gerente}', 'Gerente', null, true, ${arr(permissoesDoNivel("agent"))});`));
    expect(nivel(AT_C)).toBe("agent");
    sql(como(ADM_C, `select public.fn_acesso_salvar_papel('${ORG_C}', '${gerente}', 'Gerente', null, false, ${arr(permissoesDoNivel("agent"))});`));
    expect(nivel(AT_C)).toBe("viewer"); // papel desativado não conta
  });

  it("o modo de uma empresa só é revelado a quem é membro dela", () => {
    expect(ultima(sql(como(ADM_C, `select public.fn_acesso_modo_ligado('${ORG_C}');`)))).toBe("t");
    expect(ultima(sql(como(AT_A, `select public.fn_acesso_modo_ligado('${ORG_C}');`)))).toBe("f");
    expect(ultima(sql(`select has_function_privilege('authenticated', 'public.fn_acesso_modo_interno(uuid)', 'execute');`))).toBe("f");
  });

  it("ligado: escrever o papel legado à mão (rota da Equipe, script) volta ao nível calculado", () => {
    sql(`update public.user_organizations set role = 'admin' where organization_id = '${ORG_C}' and user_id = '${AT_C}';`);
    expect(nivel(AT_C)).not.toBe("admin");
  });

  it("ligado: convite aceito recebe o papel-modelo do nível do convite", () => {
    const NOVO = "acc10000-1111-4000-8000-0000000000c3";
    sql(`insert into auth.users (id, email) values ('${NOVO}', 'acl-novo-c@invariant.test') on conflict (id) do nothing;
         insert into public.user_organizations (user_id, organization_id, role, accepted_at) values ('${NOVO}', '${ORG_C}', 'agent', now()) on conflict do nothing;`);
    expect(
      ultima(
        sql(`select r.system_key from public.clinic_member_roles mr join public.clinic_roles r on r.id = mr.role_id
              where mr.organization_id = '${ORG_C}' and mr.user_id = '${NOVO}';`),
      ),
    ).toBe("atendente");
    expect(nivel(NOVO)).toBe("agent");
  });

  it("desligar volta ao papel legado como está; religar recalcula", () => {
    sql(definir(ADM_C, false));
    expect(ultima(sql(como(AT_C, `select public.fn_has_permission('${ORG_C}', 'agenda.ver');`)))).toBe("t");
    sql(definir(ADM_C, true));
    expect(nivel(AT_C)).toBe("viewer");
  });
});
