/**
 * O roteiro da clínica de demonstração (scripts/seed-demo-clinica) roda no
 * Postgres real, com o baseline aplicado, e entrega o que promete:
 *   - passa pelas MESMAS funções da tela, com a permissão de cada pessoa
 *     (se uma regra mudar e o seed quebrar, este teste avisa);
 *   - 4 atendimentos finalizados com baixa do estoque; o enfermeiro que
 *     aplicou produto controlado gera pendência de habilitação;
 *   - recepção e administrador sem papel clínico não leem atendimentos;
 *   - rodar duas vezes não duplica nada.
 * Dados fictícios (o roteiro só usa nomes "(fictício/a)" e domínio .test).
 */
import { execFileSync } from "node:child_process";

import { beforeAll, describe, expect, it } from "vitest";

import {
  ORG_DEMO,
  PESSOAS_DEMO,
  roteiroDemo,
  scriptDoPasso,
  type IdsDasPessoas,
} from "../../scripts/seed-demo-clinica/roteiro";

const container = process.env.TEST_DB_CONTAINER;
if (!container) {
  throw new Error("TEST_DB_CONTAINER not set — rode esta suíte via `pnpm test:db` (scripts/test-db.sh)");
}
const containerName: string = container;
const PSQL = ["exec", "-i", containerName, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-f", "-"];

function sql(script: string): string {
  return execFileSync("docker", PSQL, { input: script, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}
const ultima = (out: string) => out.split("\n").at(-1) ?? "";
const como = (userId: string, corpo: string) =>
  `set role authenticated; select set_config('request.jwt.claims', '{"sub":"${userId}"}', false); ${corpo}`;

const ids = Object.fromEntries(
  PESSOAS_DEMO.map((p, i) => [p.chave, `de000000-0099-4000-8000-${String(i + 1).padStart(12, "0")}`]),
) as IdsDasPessoas;

function rodarRoteiro(): void {
  for (const passo of roteiroDemo(ids)) {
    try {
      sql(scriptDoPasso(passo));
    } catch (e) {
      throw new Error(`passo "${passo.titulo}": ${String((e as { stderr?: string }).stderr ?? e)}`);
    }
  }
}

beforeAll(() => {
  // no Supabase de verdade o script cria os usuários pela API de auth
  sql(`insert into auth.users (id, email) values
       ${PESSOAS_DEMO.map((p) => `('${ids[p.chave]}', '${p.email}')`).join(", ")}
       on conflict (id) do nothing;`);
  rodarRoteiro();
});

describe("clínica de demonstração", () => {
  it("4 atendimentos finalizados, cada um do seu profissional", () => {
    expect(ultima(sql(`select count(*) from public.clinic_atendimentos where organization_id = '${ORG_DEMO}' and status = 'finalizado';`))).toBe("4");
  });

  it("a baixa saiu do estoque: toxina 300 + 100 U − 30 U; pendência de habilitação do enfermeiro", () => {
    expect(
      ultima(sql(`select sum(m.quantidade) from public.clinic_estoque_movimentos m
                   join public.catalog_products c on c.id = m.product_id
                  where m.organization_id = '${ORG_DEMO}' and c.codigo = 'DEMO-TOX100';`)),
    ).toBe("370.000");
    expect(
      ultima(sql(`select count(*) from public.clinic_estoque_pendencias where organization_id = '${ORG_DEMO}'
                    and motivo = 'profissional_nao_habilitado' and status = 'aberta';`)),
    ).toBe("1");
    expect(Number(ultima(sql(`select count(*) from public.clinic_estoque_alertas where organization_id = '${ORG_DEMO}' and status = 'aberto';`)))).toBeGreaterThan(0);
  });

  it("recepção e administrador sem papel clínico não leem atendimentos; a médica lê", () => {
    expect(ultima(sql(como(ids.recepcao!, `select count(*) from public.clinic_atendimentos where organization_id = '${ORG_DEMO}';`)))).toBe("0");
    expect(ultima(sql(como(ids.dono!, `select count(*) from public.clinic_atendimentos where organization_id = '${ORG_DEMO}';`)))).toBe("0");
    expect(ultima(sql(como(ids.ana!, `select count(*) from public.clinic_atendimentos where organization_id = '${ORG_DEMO}';`)))).toBe("4");
  });

  it("rodar de novo não duplica nada", () => {
    const contar = () =>
      sql(`select (select count(*) from public.clinic_atendimentos where organization_id = '${ORG_DEMO}') || ':' ||
                  (select count(*) from public.clinic_estoque_movimentos where organization_id = '${ORG_DEMO}') || ':' ||
                  (select count(*) from public.calendar_appointments where organization_id = '${ORG_DEMO}');`);
    const antes = contar();
    rodarRoteiro();
    expect(contar()).toBe(antes);
  });
});
