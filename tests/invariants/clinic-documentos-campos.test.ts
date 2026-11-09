/**
 * clinic (fork, papel timbrado D2) — migration 8013: campos dos documentos.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   - as 5 colunas novas existem, são text e anuláveis;
 *   - os CHECKs recusam site sem http(s), WhatsApp sem DDD e textos longos;
 *   - `fn_clinic_definir_cor_filetes`: admin grava/apaga em settings.clinic sem
 *     tocar no resto; não-admin 42501; cor inválida 22023; só o service_role executa.
 * Dados fictícios.
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
function erro(script: string): string | null {
  try {
    sql(script);
    return null;
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
}
const ultima = (out: string) => out.split("\n").at(-1) ?? "";

const ORG = "c8013000-0000-4000-8000-00000000000a";
const ADM = "c8013000-1111-4000-8000-0000000000a1";
const AGT = "c8013000-1111-4000-8000-0000000000a2";
const COLUNAS = ["website", "whatsapp_phone", "descriptor", "technical_lead_name", "technical_lead_registry"];

const cor = (ator: string, hex: string | null) =>
  `set role service_role; select public.fn_clinic_definir_cor_filetes('${ORG}', '${ator}', ${hex === null ? "null" : `'${hex}'`});`;

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'doc-campos-adm@invariant.test'), ('${AGT}', 'doc-campos-agt@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'doc-campos-inv', 'Doc Campos Invariant', 'Doc Campos',
       jsonb_build_object('clinic', jsonb_build_object('encaixe', true)))
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${AGT}', '${ORG}', 'agent', now())
      on conflict do nothing;
  `);
});

describe("8013 — campos do papel timbrado", () => {
  it("as 5 colunas existem, text e anuláveis", () => {
    const out = sql(`
      select column_name || ':' || data_type || ':' || is_nullable from information_schema.columns
       where table_schema = 'public' and table_name = 'organizations'
         and column_name in (${COLUNAS.map((c) => `'${c}'`).join(", ")});
    `);
    const linhas = out.split("\n").filter(Boolean);
    expect(linhas).toHaveLength(COLUNAS.length);
    for (const l of linhas) expect(l).toMatch(/:text:YES$/);
  });

  it("aceita valores válidos e volta a aceitar null", () => {
    sql(`update public.organizations set website = 'https://clinica-ficticia.com.br', whatsapp_phone = '61999998888',
           descriptor = 'Estética Avançada', technical_lead_name = 'Pessoa Ficticia', technical_lead_registry = 'CRBM 0000'
         where id = '${ORG}';`);
    sql(`update public.organizations set website = null, whatsapp_phone = null, descriptor = null where id = '${ORG}';`);
    expect(ultima(sql(`select count(*) from public.organizations where id = '${ORG}' and website is null;`))).toBe("1");
  });

  it.each([
    ["website", "clinica-ficticia.com.br", "organizations_website_formato"],
    ["whatsapp_phone", "99998888", "organizations_whatsapp_digitos"],
    ["descriptor", "x".repeat(61), "organizations_descriptor_tamanho"],
  ])("recusa %s = %s", (coluna, valor, constraint) => {
    expect(erro(`update public.organizations set ${coluna} = '${valor}' where id = '${ORG}';`)).toContain(constraint);
  });

  it("cor dos filetes: admin grava e apaga só a chave, preservando o resto", () => {
    expect(ultima(sql(cor(ADM, "#D4AF7C")))).toBe("1");
    expect(ultima(sql(`select settings -> 'clinic' ->> 'cor_filetes' from public.organizations where id = '${ORG}';`))).toBe("#d4af7c");
    expect(ultima(sql(`select settings -> 'clinic' ->> 'encaixe' from public.organizations where id = '${ORG}';`))).toBe("true");
    expect(ultima(sql(cor(ADM, null)))).toBe("1");
    expect(ultima(sql(`select coalesce(settings -> 'clinic' ->> 'cor_filetes', 'ausente') from public.organizations where id = '${ORG}';`))).toBe("ausente");
  });

  it("cor dos filetes: não-admin 42501, cor inválida 22023, authenticated/anon não executam", () => {
    expect(erro(cor(AGT, "#d4af7c"))).toContain("cor_filetes_sem_permissao");
    expect(erro(cor(ADM, "dourado"))).toContain("cor_filetes_invalida");
    for (const papel of ["authenticated", "anon"]) {
      expect(erro(`set role ${papel}; select public.fn_clinic_definir_cor_filetes('${ORG}', '${ADM}', null);`), papel).toMatch(/permission denied/);
    }
  });
});
