/**
 * clinic (fork) — migration 9002: cifragem de CPF e ficha do paciente.
 *
 * Prova no Postgres real, com o baseline aplicado:
 *   1. encrypt_cpf/decrypt_cpf fazem ida e volta com a chave, e falham com a
 *      chave errada — o CPF grava sem violar contacts_cpf_consistency;
 *   2. anon não executa as funções de CPF nem a da flag;
 *   3. clinic_patient_profiles e clinic_appointment_arrivals não vazam entre orgs;
 *   4. atendente (agent) preenche a ficha e registra chegada; viewer não;
 *   5. anonimizar o contato apaga a ficha (trigger);
 *   6. só admin mexe na flag ficha_obrigatoria.
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

function comoUsuario(userId: string, corpo: string): string {
  return `
    set role authenticated;
    select set_config('request.jwt.claims', '{"sub":"${userId}"}', false);
    ${corpo}
  `;
}

function ultimaLinha(out: string): string {
  return out.split("\n").at(-1) ?? "";
}

function erroComo(userId: string, comando: string): string | null {
  try {
    sql(comoUsuario(userId, comando));
    return null;
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
}

const CHAVE = "chave-sintetica-do-invariante-cpf-32c";
const ORG_A = "f1c4a000-0000-4000-8000-00000000000a";
const ORG_B = "f1c4a000-0000-4000-8000-00000000000b";
const AGENT_A = "f1c4a000-1111-4000-8000-00000000000a";
const VIEWER_A = "f1c4a000-1111-4000-8000-00000000000c";
const MANAGER_A = "f1c4a000-1111-4000-8000-00000000000d";
const AGENT_B = "f1c4a000-1111-4000-8000-00000000000b";
const CONTATO_A = "f1c4a000-2222-4000-8000-00000000000a";
const CONTATO_B = "f1c4a000-2222-4000-8000-00000000000b";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${AGENT_A}',   'ficha-agent-a@invariant.test'),
      ('${VIEWER_A}',  'ficha-viewer-a@invariant.test'),
      ('${MANAGER_A}', 'ficha-mgr-a@invariant.test'),
      ('${AGENT_B}',   'ficha-agent-b@invariant.test')
      on conflict (id) do nothing;

    insert into public.organizations (id, slug, legal_name, display_name) values
      ('${ORG_A}', 'ficha-inv-a', 'Ficha Invariant A', 'Ficha A'),
      ('${ORG_B}', 'ficha-inv-b', 'Ficha Invariant B', 'Ficha B')
      on conflict (id) do nothing;

    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${AGENT_A}',   '${ORG_A}', 'agent',   now()),
      ('${VIEWER_A}',  '${ORG_A}', 'viewer',  now()),
      ('${MANAGER_A}', '${ORG_A}', 'manager', now()),
      ('${AGENT_B}',   '${ORG_B}', 'agent',   now())
      on conflict do nothing;

    insert into public.contacts (id, organization_id, name, phone_number) values
      ('${CONTATO_A}', '${ORG_A}', 'Paciente A', '+5511990000001'),
      ('${CONTATO_B}', '${ORG_B}', 'Paciente B', '+5511990000002')
      on conflict (id) do nothing;

    insert into public.clinic_patient_profiles (organization_id, contact_id, sex, city, emergency_name)
    values ('${ORG_A}', '${CONTATO_A}', 'feminino', 'São Paulo', 'Mãe A'),
           ('${ORG_B}', '${CONTATO_B}', 'masculino', 'Rio de Janeiro', 'Pai B')
    on conflict (organization_id, contact_id) do nothing;
  `);
});

describe("CPF — cifragem do núcleo consertada", () => {
  it("ida e volta com a chave certa", () => {
    const claro = ultimaLinha(sql(`select public.decrypt_cpf(public.encrypt_cpf('52998224725', '${CHAVE}'), '${CHAVE}');`));
    expect(claro).toBe("52998224725");
  });

  it("chave errada não decifra", () => {
    expect(() =>
      sql(`select public.decrypt_cpf(public.encrypt_cpf('52998224725', '${CHAVE}'), 'outra-chave-com-mais-de-16');`),
    ).toThrow();
  });

  it("chave curta ou documento vazio são recusados; documento com letras cifra", () => {
    expect(() => sql(`select public.encrypt_cpf('52998224725', 'curta');`)).toThrow(/cpf_key_ausente/);
    expect(() => sql(`select public.encrypt_cpf('   ', '${CHAVE}');`)).toThrow(/cpf_invalido/);
    // Documento de outro país (com letras) cifra: a validação por país é da aplicação.
    expect(ultimaLinha(sql(`select public.decrypt_cpf(public.encrypt_cpf('123456789XI000', '${CHAVE}'), '${CHAVE}');`))).toBe("123456789XI000");
  });

  it("cifra de enfeite (byte \\x00, bytea vazio, texto) volta como 'sem CPF', sem erro (guarda da #754)", () => {
    expect(ultimaLinha(sql(`select coalesce(public.decrypt_cpf('\\x00'::bytea, '${CHAVE}'), 'NULO');`))).toBe("NULO");
    expect(ultimaLinha(sql(`select coalesce(public.decrypt_cpf(''::bytea, '${CHAVE}'), 'NULO');`))).toBe("NULO");
    expect(
      ultimaLinha(sql(`select coalesce(public.decrypt_cpf(convert_to(repeat('x', 80), 'UTF8'), '${CHAVE}'), 'NULO');`)),
    ).toBe("NULO");
  });

  it("o par hash + cifra grava no contato sem violar contacts_cpf_consistency", () => {
    const erro = erroComo(
      MANAGER_A,
      `update public.contacts
          set cpf_encrypted = public.encrypt_cpf('52998224725', '${CHAVE}'),
              cpf_hash = encode(extensions.digest('52998224725', 'sha256'), 'hex')
        where id = '${CONTATO_A}';`,
    );
    expect(erro).toBeNull();
  });

  it.each([
    "public.encrypt_cpf(text, text)",
    "public.decrypt_cpf(bytea, text)",
    "public.fn_clinic_definir_ficha_obrigatoria(uuid, boolean)",
  ])("anon não executa %s", (fn) => {
    expect(ultimaLinha(sql(`select has_function_privilege('anon', '${fn}', 'execute');`))).toBe("f");
  });
});

describe("ficha do paciente — isolamento e papéis", () => {
  it.each(["clinic_patient_profiles", "clinic_appointment_arrivals"])(
    "%s: quem é da org A não enxerga a org B",
    (tabela) => {
      const out = sql(comoUsuario(AGENT_A, `select count(*) from public.${tabela} where organization_id = '${ORG_B}';`));
      expect(ultimaLinha(out)).toBe("0");
    },
  );

  it("atendente preenche a ficha (é a recepção)", () => {
    const erro = erroComo(
      AGENT_A,
      `update public.clinic_patient_profiles set street = 'Rua das Flores', number = '10'
        where contact_id = '${CONTATO_A}';`,
    );
    expect(erro).toBeNull();
    expect(ultimaLinha(sql(`select street from public.clinic_patient_profiles where contact_id = '${CONTATO_A}';`))).toBe(
      "Rua das Flores",
    );
  });

  it("visualizador não altera a ficha", () => {
    const antes = ultimaLinha(sql(`select coalesce(district,'') from public.clinic_patient_profiles where contact_id = '${CONTATO_A}';`));
    sql(comoUsuario(VIEWER_A, `update public.clinic_patient_profiles set district = 'Centro' where contact_id = '${CONTATO_A}';`));
    const depois = ultimaLinha(sql(`select coalesce(district,'') from public.clinic_patient_profiles where contact_id = '${CONTATO_A}';`));
    expect(depois).toBe(antes);
  });

  it("CHECKs da ficha recusam CEP, UF e telefone fora do formato", () => {
    expect(erroComo(MANAGER_A, `update public.clinic_patient_profiles set cep = '01310-100' where contact_id = '${CONTATO_A}';`)).toMatch(
      /clinic_patient_profiles_cep_formato/,
    );
    expect(erroComo(MANAGER_A, `update public.clinic_patient_profiles set uf = 'sp' where contact_id = '${CONTATO_A}';`)).toMatch(
      /clinic_patient_profiles_uf_formato/,
    );
    expect(
      erroComo(MANAGER_A, `update public.clinic_patient_profiles set emergency_phone = '11 99999' where contact_id = '${CONTATO_A}';`),
    ).toMatch(/clinic_patient_profiles_emergencia_e164/);
  });

  it("só admin mexe na flag: gerente recebe 42501", () => {
    expect(erroComo(MANAGER_A, `select public.fn_clinic_definir_ficha_obrigatoria('${ORG_A}', true);`)).toMatch(
      /clinic_flag_forbidden/,
    );
  });
});

describe("LGPD — anonimizar o contato apaga a ficha", () => {
  it("a ficha da org A some; a da org B fica", () => {
    sql(`update public.contacts set is_anonymized = true, anonymized_at = now(), name = null, phone_number = null
          where id = '${CONTATO_A}';`);
    expect(ultimaLinha(sql(`select count(*) from public.clinic_patient_profiles where contact_id = '${CONTATO_A}';`))).toBe("0");
    expect(ultimaLinha(sql(`select count(*) from public.clinic_patient_profiles where contact_id = '${CONTATO_B}';`))).toBe("1");
  });
});
