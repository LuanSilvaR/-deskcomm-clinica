/**
 * clinic (fork, prontuário F10) — migration 9027: correções das revisões de
 * segurança/LGPD e de conformidade de saúde.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. termo de uso de imagem não aceita opção obrigatória;
 *   2. divulgação de foto exige canais, confere finalidade E cada canal, e a
 *      leitura (`fn_clinic_divulgacao_vigente`) deixa de valer quando o termo vence;
 *   3. outra empresa não enxerga a marcação vigente;
 *   4. DELETE direto de cabeçalho/atendimento é recusado (inclusive para o
 *      superusuário), service_role não tem DELETE; a exclusão da empresa ainda
 *      leva tudo em cascata;
 *   5. anonimizar o paciente preserva o prontuário (guarda legal);
 *   6. registro ANVISA do insumo tem limite de tamanho;
 *   7. anon não executa as funções novas.
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

const ORG = "c0e10000-0000-4000-8000-00000000000a";
const ORG_B = "c0e10000-0000-4000-8000-00000000000b";
const ORG_TMP = "c0e10000-0000-4000-8000-00000000000c";
const ADM = "c0e10000-1111-4000-8000-0000000000a1";
const RECEP = "c0e10000-1111-4000-8000-0000000000a2";
const PROF = "c0e10000-1111-4000-8000-0000000000a3";
const PROF_B = "c0e10000-1111-4000-8000-0000000000b1";
const PAC = "c0e10000-2222-4000-8000-00000000000a";
const PAC_TMP = "c0e10000-2222-4000-8000-00000000000c";
const SHA = "b".repeat(64);

const divulgar = (anexo: string, opcao: string, canais: string[]) =>
  como(PROF, `select public.fn_clinic_anexo_divulgar('${ORG}', '${anexo}', '${opcao}', array[${canais.map((c) => `'${c}'`).join(",")}]::text[]);`);
const vigentes = (ator: string, org = ORG) =>
  sql(como(ator, `select count(*) from public.fn_clinic_divulgacao_vigente('${org}', '${PAC}');`))
    .split("\n")
    .at(-1);

let foto = "";
let doc = "";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${ADM}', 'rev-adm@invariant.test'), ('${RECEP}', 'rev-recep@invariant.test'),
      ('${PROF}', 'rev-prof@invariant.test'), ('${PROF_B}', 'rev-prof-b@invariant.test')
      on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name, settings) values
      ('${ORG}', 'rev-inv-a', 'Revisão Invariant A', 'Revisão A', '{"clinic":{"prontuario":true}}'::jsonb),
      ('${ORG_B}', 'rev-inv-b', 'Revisão Invariant B', 'Revisão B', '{"clinic":{"prontuario":true}}'::jsonb)
      on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADM}', '${ORG}', 'admin', now()), ('${RECEP}', '${ORG}', 'agent', now()),
      ('${PROF}', '${ORG}', 'agent', now()), ('${PROF_B}', '${ORG_B}', 'agent', now())
      on conflict do nothing;
    insert into public.clinic_professionals (organization_id, user_id, display_name) values
      ('${ORG}', '${PROF}', 'Profissional A'), ('${ORG_B}', '${PROF_B}', 'Profissional B')
      on conflict do nothing;
    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${PAC}', '${ORG}', 'Paciente Revisão A', '+5511990000901')
      on conflict (id) do nothing;
  `);
  const d = JSON.stringify({ tipo: "foto", storage_key: `${ORG}/${PAC}/${randomUUID()}.webp`, mime: "image/webp", bytes: 1000, sha256: SHA, momento: "antes" });
  foto = json<{ id: string }>(sql(como(PROF, `select public.fn_clinic_anexo_registrar('${ORG}', '${PAC}', '${d}'::jsonb);`))).id;
  const versao = ultima(
    sql(`select v.id from public.clinic_modelos_documento m join public.clinic_modelos_documento_versoes v on v.modelo_id = m.id
          where m.organization_id = '${ORG}' and m.tipo = 'uso_imagem' order by v.numero desc limit 1;`),
  );
  doc = json<{ id: string }>(
    sql(
      como(
        RECEP,
        `select public.fn_clinic_documento_emitir('${ORG}', '${PAC}', '${versao}', 'Uso de imagem', 'Texto de teste.', null, null, current_date);`,
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
  sql(como(RECEP, `select public.fn_clinic_documento_aceitar('${ORG}', '${doc}', 'Paciente Revisão A', '${JSON.stringify(escolhas)}'::jsonb, 'teste');`));
});

describe("termo de uso de imagem", () => {
  it("versão com opção obrigatória é recusada", () => {
    const modelo = ultima(sql(`select id from public.clinic_modelos_documento where organization_id = '${ORG}' and tipo = 'uso_imagem' limit 1;`));
    expect(
      erro(`insert into public.clinic_modelos_documento_versoes (organization_id, modelo_id, numero, conteudo, opcoes, sha256)
            values ('${ORG}', '${modelo}', 99, 'x', '[{"chave":"divulgacao_com_identificacao","rotulo":"x","obrigatoria":true}]'::jsonb, '${SHA}');`),
    ).toMatch(/documento_opcao_obrigatoria_imagem/);
  });
});

describe("divulgação: finalidade e canais", () => {
  it("sem canal, canal não autorizado e o caminho antigo são recusados; canal autorizado aceito", () => {
    expect(erro(divulgar(foto, "divulgacao_sem_rosto", []))).toMatch(/anexo_canal_obrigatorio/);
    expect(erro(divulgar(foto, "divulgacao_sem_rosto", ["redes_sociais", "site"]))).toMatch(/anexo_sem_autorizacao_de_imagem/);
    expect(erro(divulgar(foto, "divulgacao_com_identificacao", ["redes_sociais"]))).toMatch(/anexo_sem_autorizacao_de_imagem/);
    expect(
      erro(como(PROF, `select public.fn_clinic_anexo_mudar('${ORG}', '${foto}', 'divulgacao', 'divulgacao_sem_rosto');`)),
    ).toMatch(/anexo_canal_obrigatorio/);
    sql(divulgar(foto, "divulgacao_sem_rosto", ["redes_sociais"]));
    expect(ultima(sql(`select divulgacao_opcao || ':' || array_to_string(divulgacao_canais, ',') from public.clinic_anexos where id = '${foto}';`))).toBe(
      "divulgacao_sem_rosto:redes_sociais",
    );
  });

  it("leitura vigente: profissional vê; recepção e outra empresa não", () => {
    expect(vigentes(PROF)).toBe("1");
    expect(vigentes(RECEP)).toBe("0");
    expect(vigentes(PROF_B)).toBe("0");
  });

  it("termo vencido: a marcação deixa de valer na leitura, sem ninguém desmarcar", () => {
    // Simula a passagem do tempo (o documento é imutável para quem usa o sistema).
    sql(`
      alter table public.clinic_documentos_emitidos disable trigger trg_clinic_documento_imutavel;
      update public.clinic_documentos_emitidos set validade_ate = current_date - 1 where id = '${doc}';
      alter table public.clinic_documentos_emitidos enable trigger trg_clinic_documento_imutavel;
    `);
    expect(vigentes(PROF)).toBe("0");
    expect(erro(divulgar(foto, "divulgacao_sem_rosto", ["redes_sociais"]))).toMatch(/anexo_sem_autorizacao_de_imagem/);
  });
});

describe("sem hard-delete direto", () => {
  it("cabeçalho: DELETE recusado até para o superusuário; service_role sem DELETE; exclusão da empresa leva em cascata", () => {
    sql(`
      insert into public.organizations (id, slug, legal_name, display_name, settings) values
        ('${ORG_TMP}', 'rev-inv-tmp', 'Revisão Invariant Tmp', 'Revisão Tmp', '{"clinic":{"prontuario":true}}'::jsonb)
        on conflict (id) do nothing;
      insert into public.contacts (id, organization_id, name, phone_number) values
        ('${PAC_TMP}', '${ORG_TMP}', 'Paciente Tmp', '+5511990000903') on conflict (id) do nothing;
      insert into public.clinic_prontuarios (organization_id, contact_id, alergias) values ('${ORG_TMP}', '${PAC_TMP}', 'Teste')
        on conflict do nothing;
    `);
    expect(erro(`delete from public.clinic_prontuarios where organization_id = '${ORG_TMP}';`)).toMatch(/prontuario_imutavel/);
    expect(erro(`set role service_role; delete from public.clinic_atendimentos where organization_id = '${ORG_TMP}';`)).toMatch(
      /permission denied/,
    );
    for (const t of ["clinic_atendimentos", "clinic_prontuarios", "clinic_planos_tratamento", "clinic_plano_sessoes"]) {
      expect(ultima(sql(`select has_table_privilege('service_role', 'public.${t}', 'DELETE');`))).toBe("f");
    }
    sql(`delete from public.organizations where id = '${ORG_TMP}';`);
    expect(ultima(sql(`select count(*) from public.clinic_prontuarios where organization_id = '${ORG_TMP}';`))).toBe("0");
  });
});

describe("anonimização × guarda do prontuário", () => {
  it("anonimizar o paciente preserva cabeçalho, foto e termo", () => {
    sql(`insert into public.clinic_prontuarios (organization_id, contact_id, alergias) values ('${ORG}', '${PAC}', 'Teste') on conflict do nothing;`);
    sql(`update public.contacts set is_anonymized = true, anonymized_at = now(), name = null, phone_number = null where id = '${PAC}';`);
    expect(ultima(sql(`select count(*) from public.clinic_prontuarios where contact_id = '${PAC}';`))).toBe("1");
    expect(ultima(sql(`select count(*) from public.clinic_anexos where contact_id = '${PAC}';`))).toBe("1");
    expect(ultima(sql(`select count(*) from public.clinic_documentos_emitidos where contact_id = '${PAC}';`))).toBe("1");
    expect(erro(`delete from public.contacts where id = '${PAC}';`)).not.toBeNull();
  });
});

describe("insumo", () => {
  it("registro ANVISA tem limite de tamanho", () => {
    expect(
      ultima(sql(`select pg_get_constraintdef(oid) from pg_constraint where conname = 'clinic_insumos_registro_anvisa_tamanho';`)),
    ).toMatch(/40/);
  });
});

describe("anon", () => {
  it("não executa as funções novas", () => {
    for (const f of [
      `public.fn_clinic_anexo_divulgar('${ORG}', '${foto}', 'divulgacao_sem_rosto', array['site']::text[])`,
      `public.fn_clinic_divulgacao_vigente('${ORG}', '${PAC}')`,
    ]) {
      expect(erro(`set role anon; select ${f};`)).toMatch(/permission denied/);
    }
  });
});
