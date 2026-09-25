/**
 * clinic (fork, prontuário F0) — migration 9016: acesso clínico separado da administração.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. o catálogo do banco marca as MESMAS chaves clínicas que o código;
 *   2. modo legado: admin/gerente/atendente sem cadastro de profissional NÃO têm
 *      chave clínica; profissional ativo tem as do nível; inativo perde;
 *   3. modo por papéis: o papel de sistema Administrador não concede conteúdo
 *      clínico; papel clínico explícito concede — inclusive ao admin;
 *   4. suporte (impersonação "full") nunca recebe chave clínica;
 *   5. nenhum papel de sistema/modelo guarda chave clínica;
 *   6. a opção `prontuario`: nasce desligada; gerente recusado; admin liga;
 *      anon não executa.
 */
import { execFileSync } from "node:child_process";

import { beforeAll, describe, expect, it } from "vitest";

import { PERMISSOES_CLINICAS, permissoesClinicasDoNivel, permissoesDoNivel } from "@/lib/clinic/acesso/catalogo";

const container = process.env.TEST_DB_CONTAINER;
if (!container) {
  throw new Error("TEST_DB_CONTAINER not set — rode esta suíte via `pnpm test:db` (scripts/test-db.sh)");
}
const containerName: string = container;
const PSQL = ["exec", "-i", containerName, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-f", "-"];

function sql(script: string): string {
  return execFileSync("docker", PSQL, { input: script, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}
function como(userId: string, corpo: string, extra: Record<string, string> = {}): string {
  const claims = JSON.stringify({ sub: userId, ...extra });
  return `
    set role authenticated;
    select set_config('request.jwt.claims', '${claims}', false);
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
const lista = (out: string) =>
  out
    .split("\n")
    .filter((l) => l && l !== "SET" && !l.startsWith("{"))
    .sort();
const arr = (xs: readonly string[]) => `array[${xs.map((x) => `'${x}'`).join(",")}]::text[]`;

const ORG = "c11c0000-0000-4000-8000-00000000000a";
const ORG_B = "c11c0000-0000-4000-8000-00000000000b";
const ADM = "c11c0000-1111-4000-8000-0000000000a1";
const GER = "c11c0000-1111-4000-8000-0000000000a2";
const RECEP = "c11c0000-1111-4000-8000-0000000000a3";
const PROF = "c11c0000-1111-4000-8000-0000000000a4";
const PROF_VIS = "c11c0000-1111-4000-8000-0000000000a5";
const SUPORTE = "c11c0000-1111-4000-8000-0000000000f1";
const SESSAO = "c11c0000-2222-4000-8000-0000000000f1";
const SESSAO_SUPORTE = "c11c0000-3333-4000-8000-0000000000f1";

const perms = (user: string, org = ORG, extra: Record<string, string> = {}) =>
  lista(sql(como(user, `select * from public.fn_member_permissions('${org}');`, extra)));
const clinicas = (xs: string[]) => xs.filter((k) => PERMISSOES_CLINICAS.includes(k));
const ligarModo = (v: boolean) =>
  sql(`update public.organizations set settings = jsonb_set(coalesce(settings,'{}'::jsonb), '{clinic}',
         coalesce(settings->'clinic','{}'::jsonb) || jsonb_build_object('acesso_por_permissoes', ${v}), true) where id = '${ORG}';`);

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'clin-adm@invariant.test'), ('${GER}', 'clin-ger@invariant.test'),
      ('${RECEP}', 'clin-recep@invariant.test'), ('${PROF}', 'clin-prof@invariant.test'),
      ('${PROF_VIS}', 'clin-prof-vis@invariant.test'), ('${SUPORTE}', 'clin-suporte@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name) values
      ('${ORG}', 'clin-inv-a', 'Clinico Invariant A', 'Clínico A'),
      ('${ORG_B}', 'clin-inv-b', 'Clinico Invariant B', 'Clínico B')
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${GER}', '${ORG}', 'manager', now()),
      ('${RECEP}', '${ORG}', 'agent', now()), ('${PROF}', '${ORG}', 'agent', now()),
      ('${PROF_VIS}', '${ORG}', 'viewer', now())
      on conflict do nothing;
    insert into public.clinic_professionals (organization_id, user_id, display_name) values
      ('${ORG}', '${PROF}', 'Profissional'), ('${ORG}', '${PROF_VIS}', 'Profissional leitura')
      on conflict do nothing;
  `);
});

describe("catálogo", () => {
  it("o banco marca como clínicas exatamente as chaves que o código marca", () => {
    expect(lista(sql(`select key from public.clinic_permissions where clinica;`))).toEqual([...PERMISSOES_CLINICAS].sort());
  });

  it("nenhum papel de sistema ou modelo guarda chave clínica", () => {
    expect(
      ultima(
        sql(`select count(*) from public.clinic_role_permissions rp
               join public.clinic_roles r on r.id = rp.role_id
               join public.clinic_permissions c on c.key = rp.permission_key
              where c.clinica and r.system_key is not null;`),
      ),
    ).toBe("0");
  });
});

describe("modo legado (como a empresa nasce)", () => {
  it.each([
    [ADM, "admin"],
    [GER, "manager"],
    [RECEP, "agent"],
  ] as const)("%s (%s) sem cadastro de profissional não tem chave clínica", (user, nivel) => {
    const p = perms(user);
    expect(clinicas(p)).toEqual([]);
    expect(p).toEqual([...permissoesDoNivel(nivel)].sort());
  });

  it("profissional ativo tem as chaves clínicas do nível dele", () => {
    expect(perms(PROF)).toEqual([...permissoesDoNivel("agent"), ...permissoesClinicasDoNivel("agent")].sort());
    expect(perms(PROF)).not.toContain("atendimento.reabrir");
  });

  it("profissional com nível de leitura não ganha chave clínica (o nível continua valendo)", () => {
    expect(clinicas(perms(PROF_VIS))).toEqual([]);
  });

  it("profissional desativado perde o acesso clínico na hora", () => {
    sql(`update public.clinic_professionals set is_active = false where organization_id = '${ORG}' and user_id = '${PROF}';`);
    expect(clinicas(perms(PROF))).toEqual([]);
    sql(`update public.clinic_professionals set is_active = true where organization_id = '${ORG}' and user_id = '${PROF}';`);
    expect(perms(PROF)).toContain("prontuario.ver");
  });

  it("ser profissional em OUTRA empresa não dá acesso clínico nesta", () => {
    sql(`insert into public.user_organizations (user_id, organization_id, role, accepted_at) values ('${PROF}', '${ORG_B}', 'agent', now()) on conflict do nothing;`);
    expect(clinicas(perms(PROF, ORG_B))).toEqual([]);
  });
});

describe("suporte (impersonação)", () => {
  it("sessão de suporte 'full' recebe o catálogo não-clínico e nenhuma chave clínica", () => {
    sql(`
      insert into auth.sessions (id, user_id, aal) values ('${SESSAO}', '${SUPORTE}', 'aal1') on conflict do nothing;
      insert into public.platform_admins (user_id, granted_by, scope, mfa_required, reason)
        values ('${SUPORTE}', '${SUPORTE}', 'full', false, 'invariante acesso clinico')
        on conflict (user_id) do update set scope = 'full', revoked_at = null, mfa_required = false;
      insert into public.platform_support_sessions (id, organization_id, actor_user_id, auth_session_id, access_mode, expires_at)
        values ('${SESSAO_SUPORTE}', '${ORG}', '${SUPORTE}', '${SESSAO}', 'full', now() + interval '30 minutes')
        on conflict do nothing;
    `);
    const p = perms(SUPORTE, ORG, { session_id: SESSAO });
    expect(p).toContain("papeis.gerenciar");
    expect(clinicas(p)).toEqual([]);
    // 9027: nem os termos do paciente (nome + procedimento = dado de saúde).
    expect(p.filter((k) => k.startsWith("documentos."))).toEqual([]);
  });
});

describe("modo por papéis", () => {
  let papelClinico = "";
  beforeAll(() => ligarModo(true));

  it("o Administrador de sistema não lê conteúdo clínico", () => {
    expect(clinicas(perms(ADM))).toEqual([]);
  });

  it("papel clínico explícito concede — inclusive ao próprio admin", () => {
    const chaves = ["atendimento.ver_fila", "prontuario.ver", "atendimento.iniciar", "atendimento.registrar"];
    const r = ultima(
      sql(como(ADM, `select public.fn_acesso_salvar_papel('${ORG}', null, 'Profissional clínico', null, true, ${arr(chaves)});`)),
    );
    papelClinico = (JSON.parse(r) as { id: string }).id;
    const administrador = ultima(sql(`select id from public.clinic_roles where organization_id = '${ORG}' and system_key = 'administrador';`));
    sql(
      como(
        ADM,
        `select public.fn_acesso_atribuir_papeis('${ORG}', '${ADM}', array['${administrador}', '${papelClinico}']::uuid[]);`,
      ),
    );
    expect(perms(ADM)).toEqual(expect.arrayContaining(["prontuario.ver", "atendimento.iniciar", "papeis.gerenciar"]));
  });

  it("chave clínica posta no papel Administrador de sistema não vale", () => {
    const administrador = ultima(sql(`select id from public.clinic_roles where organization_id = '${ORG}' and system_key = 'administrador';`));
    sql(`insert into public.clinic_role_permissions (organization_id, role_id, permission_key) values ('${ORG}', '${administrador}', 'fotos.ver') on conflict do nothing;`);
    expect(perms(ADM)).not.toContain("fotos.ver");
    sql(`delete from public.clinic_role_permissions where role_id = '${administrador}' and permission_key = 'fotos.ver';`);
  });

  it("recepcionista com papel sem chave clínica não lê prontuário", () => {
    expect(clinicas(perms(RECEP))).toEqual([]);
  });

  it("desligar o modo volta à regra do profissional", () => {
    ligarModo(false);
    expect(perms(PROF)).toContain("prontuario.ver");
    expect(clinicas(perms(GER))).toEqual([]);
  });
});

describe("opção prontuario", () => {
  const valor = () =>
    ultima(sql(`select coalesce(settings->'clinic'->>'prontuario', '-') from public.organizations where id = '${ORG}';`));

  it("nasce desligada", () => {
    expect(valor()).toBe("-");
  });

  it("gerente não liga: 42501; admin liga", () => {
    expect(erro(como(GER, `select public.fn_clinic_definir_prontuario('${ORG}', true);`))).toMatch(/clinic_flag_forbidden/);
    expect(ultima(sql(como(ADM, `select public.fn_clinic_definir_prontuario('${ORG}', true);`)))).toContain('"mudou": true');
    expect(valor()).toBe("true");
  });

  it("anon não executa a função", () => {
    expect(
      ultima(sql(`select has_function_privilege('anon', 'public.fn_clinic_definir_prontuario(uuid, boolean)', 'execute');`)),
    ).toBe("f");
  });
});
