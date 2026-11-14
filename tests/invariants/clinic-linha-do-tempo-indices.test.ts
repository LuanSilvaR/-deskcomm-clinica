/**
 * clinic (fork, prontuário F9) — as consultas da linha do tempo do prontuário
 * usam índice (EXPLAIN no Postgres real, com o baseline aplicado).
 *
 * Com poucas linhas o planejador prefere varrer a tabela; `enable_seqscan = off`
 * obriga-o a dizer se EXISTE um índice que atende cada consulta. Se alguém
 * apagar ou mudar um desses índices, este teste acusa antes da produção sentir.
 * As consultas espelham `lib/clinic/prontuario/linha-do-tempo.ts` e `leitura.ts`.
 */
import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const container = process.env.TEST_DB_CONTAINER;
if (!container) {
  throw new Error("TEST_DB_CONTAINER not set — rode esta suíte via `pnpm test:db` (scripts/test-db.sh)");
}
const containerName: string = container;
const PSQL = ["exec", "-i", containerName, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-f", "-"];

function plano(consulta: string): string {
  return execFileSync("docker", PSQL, {
    input: `set enable_seqscan = off; explain (costs off) ${consulta};`,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

const ORG = "'00000000-0000-4000-8000-000000000001'";
const PAC = "'00000000-0000-4000-8000-000000000002'";
const IDS = "array['00000000-0000-4000-8000-000000000003'::uuid, '00000000-0000-4000-8000-000000000004'::uuid]";

const CONSULTAS: Record<string, { sql: string; indice: RegExp }> = {
  "atendimentos do paciente (página)": {
    sql: `select id from public.clinic_atendimentos
           where organization_id = ${ORG} and contact_id = ${PAC} and status <> 'anulado'
             and started_at < now() order by started_at desc limit 21`,
    indice: /clinic_atendimentos_paciente_idx/,
  },
  "atendimentos por profissional": {
    sql: `select id from public.clinic_atendimentos
           where organization_id = ${ORG} and professional_user_id = ${PAC} and contact_id = ${PAC}
           order by started_at desc limit 21`,
    indice: /clinic_atendimentos_(paciente|profissional)_idx/,
  },
  "formulários da página": {
    sql: `select id from public.clinic_formularios_preenchidos where organization_id = ${ORG} and atendimento_id = any(${IDS})`,
    indice: /Index/,
  },
  "evoluções da página": {
    sql: `select id from public.clinic_evolucoes where organization_id = ${ORG} and atendimento_id = any(${IDS})`,
    indice: /Index/,
  },
  "condutas da página": {
    sql: `select id from public.clinic_condutas where organization_id = ${ORG} and atendimento_id = any(${IDS})`,
    indice: /Index/,
  },
  "procedimentos da página": {
    sql: `select id from public.clinic_procedimentos_realizados where organization_id = ${ORG} and atendimento_id = any(${IDS})`,
    indice: /Index/,
  },
  "adendos da página": {
    sql: `select id from public.clinic_adendos where organization_id = ${ORG} and atendimento_id = any(${IDS})`,
    indice: /Index/,
  },
  "sessões do plano (filtro por plano)": {
    sql: `select atendimento_id from public.clinic_plano_sessoes where organization_id = ${ORG} and plano_id = ${PAC}`,
    indice: /clinic_plano_sessoes_plano_idx/,
  },
};

describe("linha do tempo do prontuário — índices", () => {
  for (const [nome, { sql, indice }] of Object.entries(CONSULTAS)) {
    it(`${nome}: usa índice, sem varrer a tabela`, () => {
      const p = plano(sql);
      expect(p, p).not.toMatch(/Seq Scan/);
      expect(p, p).toMatch(indice);
    });
  }
});
