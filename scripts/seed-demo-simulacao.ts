/**
 * SIMULAÇÃO de uso da clínica de demonstração: apaga TODOS os dados da empresa
 * de demonstração e recria 30 dias de uso passado + a agenda dos próximos 30
 * dias, com pacientes fictícios de nome realista.
 *
 * Mantém os usuários de teste e as senhas deles (auth.users não é tocado, só o
 * nome de exibição). Os usuários precisam existir: rode antes
 * `scripts/seed-demo-clinica.ts` se for um banco novo.
 *
 * Uso (banco local):
 *   npx tsx scripts/seed-demo-simulacao.ts
 * Banco remoto de TESTE (nunca produção):
 *   npx tsx scripts/seed-demo-simulacao.ts --confirmo-que-nao-e-producao
 */
import pg from "pg";

import { anunciarDestino, credenciaisSupabaseDeTeste, destinoEhLocal } from "./lib/env-de-teste";
import { ORG_DEMO, PESSOAS_DEMO, type IdsDasPessoas } from "./seed-demo-clinica/roteiro";
import { montarSimulacao, RECARIMBAR_SQL, type PassoDaSimulacao } from "./seed-demo-simulacao/roteiro";

const credenciais = credenciaisSupabaseDeTeste();
anunciarDestino("seed-demo-simulacao", credenciais);

const local = destinoEhLocal(credenciais.url) && destinoEhLocal(credenciais.dbUrl);
if (!local && !process.argv.includes("--confirmo-que-nao-e-producao")) {
  console.error(
    "[seed-demo-simulacao] RECUSADO: o destino não é local. Esta simulação APAGA os dados da empresa de " +
      "demonstração. Se o banco é de TESTE (nunca produção), rode de novo com --confirmo-que-nao-e-producao.",
  );
  process.exit(1);
}
if (!credenciais.dbUrl) {
  console.error("[seed-demo-simulacao] Falta SUPABASE_DB_URL (conexão direta ao Postgres) no ambiente ou no .env.local.");
  process.exit(1);
}

const APAGAR_EMPRESA_SQL = `
set session_replication_role = replica;
do $sim$
declare t record;
begin
  for t in
    select k.relname
      from pg_class k
      join pg_namespace n on n.oid = k.relnamespace
      join pg_attribute a on a.attrelid = k.oid and a.attname = 'organization_id' and not a.attisdropped
     where n.nspname = 'public' and k.relkind in ('r', 'p') and not k.relispartition and k.relname <> 'organizations'
  loop
    execute format('delete from public.%I where organization_id = $1', t.relname) using '${ORG_DEMO}'::uuid;
  end loop;
  delete from public.organizations where id = '${ORG_DEMO}';
end
$sim$;
set session_replication_role = origin;
`;

function envolver(passo: PassoDaSimulacao): string {
  let papel = "";
  if (passo.ator === "service_role") papel = "set local role service_role;";
  else if (passo.ator !== "superuser") {
    if (!/^[0-9a-f-]{36}$/.test(passo.ator)) throw new Error(`ator inválido no passo "${passo.titulo}"`);
    const claims = JSON.stringify({ sub: passo.ator, role: "authenticated" });
    papel = `set local role authenticated;\nselect set_config('request.jwt.claims', '${claims}', true);`;
  }
  const desloc = passo.alvo ? `'${passo.alvo.toISOString()}'::timestamptz - now()` : "null";
  return `begin;
${papel}
${passo.sql.trim()}
reset role;
insert into seed_sim.marcas (titulo, tx_ts, desloc) values ('${passo.titulo.replace(/'/g, "''")}', now(), ${desloc});
commit;`;
}

async function main(): Promise<void> {
  const db = new pg.Client({ connectionString: credenciais.dbUrl });
  await db.connect();
  try {
    const { rows } = await db.query<{ email: string; id: string }>(
      "select email, id from auth.users where email = any($1)",
      [PESSOAS_DEMO.map((x) => x.email)],
    );
    const ids = {} as IdsDasPessoas;
    for (const pessoa of PESSOAS_DEMO) {
      const achado = rows.find((x) => x.email === pessoa.email);
      if (!achado) throw new Error(`usuário ${pessoa.email} não existe — rode scripts/seed-demo-clinica.ts antes`);
      ids[pessoa.chave] = achado.id;
    }

    const agora = new Date();
    const { passos, resumo } = montarSimulacao(ids, agora);

    await db.query(APAGAR_EMPRESA_SQL);
    console.info("[seed-demo-simulacao] dados anteriores da empresa de demonstração apagados");

    await db.query(`
      drop schema if exists seed_sim cascade;
      create schema seed_sim;
      create table seed_sim.marcas (ordem serial primary key, titulo text, tx_ts timestamptz not null,
                                    desloc interval, prox_ts timestamptz);
    `);

    for (const [i, passo] of passos.entries()) {
      try {
        await db.query(envolver(passo));
      } catch (e) {
        await db.query("rollback").catch(() => undefined);
        throw new Error(`passo "${passo.titulo}": ${e instanceof Error ? e.message : String(e)}`);
      }
      if ((i + 1) % 200 === 0) console.info(`[seed-demo-simulacao] ${i + 1}/${passos.length} passos`);
    }

    await db.query(`
      update seed_sim.marcas m set prox_ts = coalesce(x.prox, clock_timestamp())
        from (select ordem, lead(tx_ts) over (order by ordem) as prox from seed_sim.marcas) x
       where x.ordem = m.ordem;
    `);
    await db.query(`begin; set local session_replication_role = replica; ${RECARIMBAR_SQL} commit;`);
    console.info("[seed-demo-simulacao] horários do passado reposicionados no dia simulado");

    // parcelas da maquininha que já venceram no tempo simulado: a mesma baixa
    // do robô diário (fn_clinic_fin_baixar_vencidas), datada no vencimento
    await db.query(`
      begin;
      create temp table baixadas on commit drop as
        select id, vencimento, entrada_id, taxa_id from public.clinic_fin_parcelas
         where organization_id = '${ORG_DEMO}' and status = 'prevista'
           and vencimento <= (now() at time zone 'America/Sao_Paulo')::date;
      select public.fn_clinic_fin_baixar_parcela(b.id, 'recebida', b.vencimento) from baixadas b;
      set local session_replication_role = replica;
      update public.clinic_fin_parcelas p
         set recebida_em = (b.vencimento + time '10:00') at time zone 'America/Sao_Paulo'
        from baixadas b where p.id = b.id;
      update public.financial_entries e
         set paid_at = (b.vencimento + time '10:00') at time zone 'America/Sao_Paulo'
        from baixadas b where e.id in (b.entrada_id, b.taxa_id);
      commit;
    `);

    // 1ª quinzena de comissões paga, com o repasse lançado no financeiro
    await db.query(`
      begin;
      set local session_replication_role = replica;
      with pagas as (
        update public.commissions c set status = 'paid', paid_at = now() - interval '9 days'
         where c.organization_id = '${ORG_DEMO}' and c.status = 'pending' and c.created_at < now() - interval '15 days'
        returning c.attendant_user_id, c.amount_cents
      )
      insert into public.financial_entries (organization_id, account_id, account_plan_id, direction, amount_cents, description,
                                            entry_date, status, paid_at, origin, created_by_user_id, created_at)
      select '${ORG_DEMO}', 'de000000-0019-4000-8000-000000000001', 'de000000-0021-4000-8000-000000000018', 'out', sum(p.amount_cents),
             'Repasse de comissões — ' || coalesce(cp.display_name, 'profissional'),
             (now() - interval '9 days')::date, 'paid', now() - interval '9 days', 'manual', '${ids.dono}', now() - interval '9 days'
        from pagas p
        left join public.clinic_professionals cp on cp.user_id = p.attendant_user_id and cp.organization_id = '${ORG_DEMO}'
       group by cp.display_name
      having sum(p.amount_cents) > 0;
      commit;
    `);
    await db.query("drop schema seed_sim cascade;");
    // milhares de gravações seguidas deixam as estatísticas velhas: a primeira
    // leitura da tela estourava o tempo limite da API sem isto
    await db.query("vacuum analyze;");

    console.info("\n[seed-demo-simulacao] pronto:");
    for (const [k, v] of Object.entries(resumo)) console.info(`  ${k.padEnd(26)} ${v}`);
  } finally {
    await db.end();
  }
}

main().catch((erro) => {
  console.error(`[seed-demo-simulacao] falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
  process.exit(1);
});
