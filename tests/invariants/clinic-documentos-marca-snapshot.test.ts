/**
 * clinic (fork, papel timbrado D3) — migration 8014: o documento emitido guarda
 * a marca da primeira geração do PDF, e ela não muda mais.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   - `fn_clinic_documento_fixar_marca` grava uma vez (true) e na segunda
 *     devolve false sem mudar nada;
 *   - nenhum UPDATE direto troca o snapshot depois de fixado (55000);
 *   - só o service_role executa a função.
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

const ORG = "c8014000-0000-4000-8000-00000000000a";
const CONTATO = "c8014000-2222-4000-8000-00000000000c";
const DOC = "c8014000-3333-4000-8000-00000000000d";
const MODELO = "c8014000-4444-4000-8000-00000000000e";
const VERSAO = "c8014000-5555-4000-8000-00000000000f";

const fixar = (snap: string) =>
  `set role service_role; select public.fn_clinic_documento_fixar_marca('${ORG}', '${DOC}', '${snap}'::jsonb, '2.0.0');`;

beforeAll(() => {
  sql(`
    insert into public.organizations (id, slug, legal_name, display_name) values
      ('${ORG}', 'doc-snapshot-inv', 'Doc Snapshot Invariant', 'Doc Snapshot') on conflict (id) do nothing;
    insert into public.contacts (id, organization_id, name) values ('${CONTATO}', '${ORG}', 'Paciente Ficticia')
      on conflict (id) do nothing;
    insert into public.clinic_modelos_documento (id, organization_id, tipo, nome)
      values ('${MODELO}', '${ORG}', 'ciencia', 'Modelo ficticio') on conflict (id) do nothing;
    insert into public.clinic_modelos_documento_versoes (id, organization_id, modelo_id, numero, conteudo, sha256)
      values ('${VERSAO}', '${ORG}', '${MODELO}', 1, 'Texto ficticio.', repeat('b', 64)) on conflict (id) do nothing;
    insert into public.clinic_documentos_emitidos (id, organization_id, contact_id, modelo_versao_id, tipo, titulo, conteudo, sha256, status)
      values ('${DOC}', '${ORG}', '${CONTATO}', '${VERSAO}', 'ciencia', 'Termo ficticio', 'Texto ficticio.', repeat('a', 64), 'emitido')
      on conflict (id) do nothing;
  `);
});

describe("8014 — snapshot da marca do documento emitido", () => {
  it("fixa uma vez; a segunda chamada não muda nada", () => {
    expect(ultima(sql(fixar('{"nomeDaMarca":"Primeira","logoPath":null,"faviconPath":null}')))).toBe("t");
    expect(ultima(sql(fixar('{"nomeDaMarca":"Segunda","logoPath":null,"faviconPath":null}')))).toBe("f");
    expect(ultima(sql(`select marca_snapshot ->> 'nomeDaMarca' || '|' || layout_versao from public.clinic_documentos_emitidos where id = '${DOC}';`))).toBe(
      "Primeira|2.0.0",
    );
  });

  it("UPDATE direto não troca o snapshot fixado", () => {
    expect(erro(`update public.clinic_documentos_emitidos set marca_snapshot = '{"x":1}'::jsonb where id = '${DOC}';`)).toContain("documento_marca_fixa");
    expect(erro(`update public.clinic_documentos_emitidos set layout_versao = '9.9.9' where id = '${DOC}';`)).toContain("documento_marca_fixa");
  });

  it("o aceite (mudança de status) continua funcionando com o snapshot fixado", () => {
    sql(`update public.clinic_documentos_emitidos set status = 'aceito' where id = '${DOC}';`);
    expect(ultima(sql(`select status from public.clinic_documentos_emitidos where id = '${DOC}';`))).toBe("aceito");
  });

  it("authenticated e anon não executam", () => {
    for (const papel of ["authenticated", "anon"]) {
      expect(
        erro(`set role ${papel}; select public.fn_clinic_documento_fixar_marca('${ORG}', '${DOC}', '{}'::jsonb, '2.0.0');`),
        papel,
      ).toMatch(/permission denied/);
    }
  });
});
