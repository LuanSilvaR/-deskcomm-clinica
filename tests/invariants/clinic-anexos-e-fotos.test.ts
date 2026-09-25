/**
 * clinic (fork, prontuário F7) — migration 9024: anexos e fotos clínicas.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. bucket `clinical-files` privado e SEM policy em storage.objects;
 *   2. registrar: recepção recusada; caminho de outra empresa/paciente
 *      recusado; cota da clínica respeitada;
 *   3. leitura por tipo (fotos.ver / anexos.ver): profissional lê; admin sem
 *      papel clínico e recepção leem 0; outra empresa lê 0; escrita direta negada;
 *   4. imutável: trocar o arquivo recusado; DELETE recusado; anular com motivo;
 *      anulado não muda mais;
 *   5. divulgação: recusada sem termo; aceita na opção autorizada; revogar o
 *      termo desmarca a foto sozinho;
 *   6. anon não executa.
 */
import { randomUUID } from "node:crypto";
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

const ORG = "b7e10000-0000-4000-8000-00000000000a";
const ORG_B = "b7e10000-0000-4000-8000-00000000000b";
const ADM = "b7e10000-1111-4000-8000-0000000000a1";
const RECEP = "b7e10000-1111-4000-8000-0000000000a2";
const PROF = "b7e10000-1111-4000-8000-0000000000a3";
const PROF_B = "b7e10000-1111-4000-8000-0000000000b1";
const PAC = "b7e10000-2222-4000-8000-00000000000a";
const PAC_2 = "b7e10000-2222-4000-8000-00000000000c";
const SHA = "a".repeat(64);

const chave = (org = ORG, pac = PAC, ext = "webp") => `${org}/${pac}/${randomUUID()}.${ext}`;
const dados = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ tipo: "foto", storage_key: chave(), mime: "image/webp", bytes: 200_000, sha256: SHA, regiao: "Face", momento: "antes", ...extra });
const registrar = (ator: string, d: string, pac = PAC) =>
  como(ator, `select public.fn_clinic_anexo_registrar('${ORG}', '${pac}', '${d}'::jsonb);`);
const mudar = (ator: string, anexo: string, acao: string, valor: string | null) =>
  como(ator, `select public.fn_clinic_anexo_mudar('${ORG}', '${anexo}', '${acao}', ${valor ? `'${valor}'` : "null"});`);
const contar = (ator: string, org = ORG) =>
  ultima(sql(como(ator, `select count(*) from public.clinic_anexos where organization_id = '${org}';`)));

let foto = "";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'anx-adm@invariant.test'), ('${RECEP}', 'anx-recep@invariant.test'),
      ('${PROF}', 'anx-prof@invariant.test'), ('${PROF_B}', 'anx-prof-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'anx-inv-a', 'Anexos Invariant A', 'Anexos A', '{"clinic":{"prontuario":true,"cota_arquivos_mb":1}}'::jsonb),
      ('${ORG_B}', 'anx-inv-b', 'Anexos Invariant B', 'Anexos B', '{"clinic":{"prontuario":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${RECEP}', '${ORG}', 'agent', now()),
      ('${PROF}', '${ORG}', 'agent', now()), ('${PROF_B}', '${ORG_B}', 'agent', now())
      on conflict do nothing;
    insert into public.clinic_professionals (organization_id, user_id, display_name) values
      ('${ORG}', '${PROF}', 'Profissional A'), ('${ORG_B}', '${PROF_B}', 'Profissional B')
      on conflict do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PAC}', '${ORG}', 'Paciente Anexo A', '+5511990000801'), ('${PAC_2}', '${ORG}', 'Outro Anexo A', '+5511990000803')
      on conflict (id) do nothing;
  `);
});

describe("bucket", () => {
  it("clinical-files é privado e não tem policy em storage.objects", () => {
    expect(ultima(sql(`select public from storage.buckets where id = 'clinical-files';`))).toBe("f");
    expect(
      ultima(
        sql(`select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
               and (coalesce(qual, '') || coalesce(with_check, '')) like '%clinical-files%';`),
      ),
    ).toBe("0");
  });
});

describe("registrar", () => {
  it("recepção recusada; caminho de outra empresa ou paciente recusado", () => {
    expect(erro(registrar(RECEP, dados()))).toMatch(/acesso_proibido/);
    expect(erro(registrar(PROF, dados({ storage_key: chave(ORG_B) })))).toMatch(/anexo_invalido/);
    expect(erro(registrar(PROF, dados({ storage_key: chave(ORG, PAC_2) })))).toMatch(/anexo_invalido/);
    foto = json<{ id: string }>(sql(registrar(PROF, dados()))).id;
  });

  it("cota da clínica (1 MB aqui) é respeitada", () => {
    expect(erro(registrar(PROF, dados({ bytes: 900_000 })))).toMatch(/anexo_cota_excedida/);
    expect(json<{ usados: number; cota: number }>(sql(como(PROF, `select public.fn_clinic_uso_de_arquivos('${ORG}');`)))).toEqual({
      usados: 200_000,
      cota: 1_048_576,
    });
    expect(erro(como(PROF_B, `select public.fn_clinic_uso_de_arquivos('${ORG}');`))).toMatch(/acesso_proibido/);
  });
});

describe("leitura", () => {
  it("profissional lê; admin sem papel clínico e recepção leem 0; outra empresa lê 0; ninguém escreve direto", () => {
    expect(contar(PROF)).toBe("1");
    expect(contar(ADM)).toBe("0");
    expect(contar(RECEP)).toBe("0");
    expect(contar(PROF_B)).toBe("0");
    expect(
      erro(
        como(
          PROF,
          `insert into public.clinic_anexos (organization_id, contact_id, tipo, storage_key, mime, bytes, sha256)
           values ('${ORG}', '${PAC}', 'foto', '${chave()}', 'image/webp', 1, '${SHA}');`,
        ),
      ),
    ).toMatch(/permission denied/);
  });
});

describe("divulgação e revogação", () => {
  it("sem termo, recusada; com a opção autorizada, aceita; revogar desmarca", () => {
    expect(erro(mudar(PROF, foto, "divulgacao", "divulgacao_sem_rosto"))).toMatch(/anexo_sem_autorizacao_de_imagem/);
    const versao = ultima(
      sql(`select v.id from public.clinic_modelos_documento m join public.clinic_modelos_documento_versoes v on v.modelo_id = m.id
            where m.organization_id = '${ORG}' and m.tipo = 'uso_imagem';`),
    );
    const doc = json<{ id: string }>(
      sql(
        como(
          RECEP,
          `select public.fn_clinic_documento_emitir('${ORG}', '${PAC}', '${versao}', 'Uso de imagem', 'Texto de teste.', null, null, null);`,
        ),
      ),
    ).id;
    const escolhas = {
      ensino_sem_identificacao: false,
      divulgacao_sem_rosto: true,
      divulgacao_com_identificacao: false,
      redes_sociais: true,
      site: false,
      material_impresso: false,
    };
    sql(
      como(RECEP, `select public.fn_clinic_documento_aceitar('${ORG}', '${doc}', 'Paciente Anexo A', '${JSON.stringify(escolhas)}'::jsonb, 'teste');`),
    );
    expect(erro(mudar(PROF, foto, "divulgacao", "divulgacao_com_identificacao"))).toMatch(/anexo_sem_autorizacao_de_imagem/);
    sql(mudar(PROF, foto, "divulgacao", "divulgacao_sem_rosto"));
    expect(ultima(sql(`select divulgacao_opcao from public.clinic_anexos where id = '${foto}';`))).toBe("divulgacao_sem_rosto");

    sql(como(ADM, `select public.fn_clinic_documento_encerrar('${ORG}', '${doc}', 'revogar', 'Paciente pediu');`));
    expect(ultima(sql(`select coalesce(divulgacao_opcao, 'so_clinico') from public.clinic_anexos where id = '${foto}';`))).toBe("so_clinico");
  });
});

describe("imutabilidade", () => {
  it("arquivo não troca; DELETE recusado; anular com motivo; anulado não muda", () => {
    expect(erro(`update public.clinic_anexos set storage_key = '${chave()}' where id = '${foto}';`)).toMatch(/prontuario_imutavel/);
    expect(erro(`delete from public.clinic_anexos where id = '${foto}';`)).toMatch(/prontuario_imutavel/);
    expect(erro(mudar(PROF, foto, "anular", null))).toMatch(/anexo_sem_motivo/);
    sql(mudar(PROF, foto, "anular", "Foto do paciente errado"));
    expect(ultima(sql(`select status from public.clinic_anexos where id = '${foto}';`))).toBe("anulado");
    expect(erro(mudar(PROF, foto, "anular", "de novo"))).toMatch(/prontuario_imutavel/);
  });
});

describe("anon", () => {
  it("não executa", () => {
    for (const f of [
      `public.fn_clinic_anexo_registrar('${ORG}', '${PAC}', '{}'::jsonb)`,
      `public.fn_clinic_anexo_mudar('${ORG}', '${foto}', 'anular', 'xxx')`,
      `public.fn_clinic_uso_de_arquivos('${ORG}')`,
    ]) {
      expect(erro(`set role anon; select ${f};`)).toMatch(/permission denied/);
    }
  });
});
