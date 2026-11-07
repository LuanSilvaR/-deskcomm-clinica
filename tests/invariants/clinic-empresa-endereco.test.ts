/**
 * clinic (fork, organização) — migration 8011: telefone e endereço da empresa.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   - as 9 colunas existem e são anuláveis (empresa antiga continua válida);
 *   - os CHECKs recusam telefone sem DDD, CEP fora de 8 dígitos, UF fora de 2
 *     letras maiúsculas e IBGE fora de 7 dígitos — a mesma régua do `tenantSchema`;
 *   - valores normalizados entram; null volta a entrar (apagar o endereço).
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

const ORG = "c8011000-0000-4000-8000-00000000000a";
const COLUNAS = [
  "contact_phone",
  "address_cep",
  "address_street",
  "address_number",
  "address_complement",
  "address_district",
  "address_city",
  "address_uf",
  "address_city_ibge_code",
];

beforeAll(() => {
  sql(`
    insert into public.organizations (id, slug, legal_name, display_name) values
      ('${ORG}', 'empresa-endereco-inv', 'Empresa Endereco Invariant', 'Empresa Endereco')
      on conflict (id) do nothing;
  `);
});

describe("8011 — telefone e endereço da empresa", () => {
  it("as 9 colunas existem, são text e anuláveis", () => {
    const out = sql(`
      select column_name || ':' || data_type || ':' || is_nullable
        from information_schema.columns
       where table_schema = 'public' and table_name = 'organizations'
         and column_name in (${COLUNAS.map((c) => `'${c}'`).join(", ")})
       order by column_name;
    `);
    const linhas = out.split("\n").filter(Boolean);
    expect(linhas).toHaveLength(COLUNAS.length);
    for (const l of linhas) expect(l).toMatch(/:text:YES$/);
  });

  it("empresa sem endereço continua válida (tudo null)", () => {
    expect(ultima(sql(`select count(*) from public.organizations where id = '${ORG}' and address_cep is null and contact_phone is null;`))).toBe("1");
  });

  it("aceita valores normalizados e volta a aceitar null", () => {
    sql(`
      update public.organizations set
        contact_phone = '1133334444', address_cep = '01310100', address_street = 'Avenida Ficticia',
        address_number = '100', address_district = 'Centro', address_city = 'Cidade Ficticia',
        address_uf = 'SP', address_city_ibge_code = '3550308'
       where id = '${ORG}';
    `);
    expect(ultima(sql(`select address_cep || '|' || address_uf from public.organizations where id = '${ORG}';`))).toBe("01310100|SP");
    sql(`update public.organizations set contact_phone = null, address_cep = null, address_uf = null, address_city_ibge_code = null where id = '${ORG}';`);
    expect(ultima(sql(`select count(*) from public.organizations where id = '${ORG}' and address_cep is null;`))).toBe("1");
  });

  it.each([
    ["contact_phone", "33334444", "organizations_contact_phone_digitos"],
    ["contact_phone", "(11) 3333-4444", "organizations_contact_phone_digitos"],
    ["address_cep", "01310-100", "organizations_address_cep_digitos"],
    ["address_uf", "sp", "organizations_address_uf_sigla"],
    ["address_city_ibge_code", "355030", "organizations_address_ibge_digitos"],
  ])("recusa %s = %s", (coluna, valor, constraint) => {
    const e = erro(`update public.organizations set ${coluna} = '${valor}' where id = '${ORG}';`);
    expect(e).toContain(constraint);
  });
});
