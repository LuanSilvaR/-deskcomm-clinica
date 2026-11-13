/**
 * Cobrança da plataforma (fork 8026, card #159; origem upstream 0583/0679).
 *
 * Prova no Postgres real, cada caso numa transação desfeita no fim:
 *   - chave DESLIGADA (padrão): nada muda — tenant nasce isento, `plano_id` é
 *     recusado, o gatilho do teste grátis não cria nada;
 *   - `fn_create_tenant_with_owner` UNIFICADA: criador provisório quando o dono
 *     é outra pessoa (fork 0237), `settings.plan` gravado, e com a chave ligada
 *     o `plano_id` cria a assinatura em teste grátis; plano arquivado é recusado;
 *     0 dia de teste marca `pagamento_inicial_pendente`;
 *   - gatilho: org criada por quem NÃO é admin de plataforma nasce no plano do
 *     cadastro; a criada por admin de plataforma não;
 *   - um único plano do cadastro;
 *   - RLS: `cobranca_planos` invisível a authenticated; assinatura só para o
 *     admin da própria org (2 orgs); ninguém escreve pela sessão; anon sem EXECUTE.
 */
import { describe, expect, it } from "vitest";

import { sql } from "./gov-helpers";

const ADMIN_PLAT = "c8026000-0000-4000-8000-000000000001";
const DONO = "c8026000-0000-4000-8000-000000000002";
const CLIENTE = "c8026000-0000-4000-8000-000000000003";
const PLANO = "c8026000-1111-4000-8000-000000000001";
const PLANO_ZERO = "c8026000-1111-4000-8000-000000000002";
const ORG_A = "c8026000-2222-4000-8000-00000000000a";
const ORG_B = "c8026000-2222-4000-8000-00000000000b";

const seed = `begin;
insert into auth.users(id,email) values
  ('${ADMIN_PLAT}','plat-8026@invariant.test'), ('${DONO}','dono-8026@invariant.test'), ('${CLIENTE}','cliente-8026@invariant.test');
insert into public.platform_admins(user_id,granted_by,scope,mfa_required,reason)
  values ('${ADMIN_PLAT}','${ADMIN_PLAT}','full',false,'Local invariant fixture');
insert into public.cobranca_planos(id,nome,preco_cents,intervalo,trial_dias,padrao_no_cadastro)
  values ('${PLANO}','Standard',12900,'mes',14,true), ('${PLANO_ZERO}','Combo IA',49900,'mes',0,false);`;
const ligar = `insert into public.platform_config(chave, valor, eh_segredo, semeado_do_env)
  values ('MODULO_COBRANCA','ligado',false,false) on conflict (chave) do update set valor = 'ligado';`;
const criar = (key: string, extra = "") =>
  `public.fn_create_tenant_with_owner('${ADMIN_PLAT}', '${key}', '{"display_name":"Clínica 8026","slug":"clinica-8026-${key.slice(-4)}","plan":"standard","owner_email":"dono-8026@invariant.test"${extra}}'::jsonb, 'abcd')`;

function prove(corpo: string) {
  expect(sql(`${seed}\n${corpo}\nrollback; select 'proved';`)).toContain("proved");
}

describe("cobrança — planos e assinaturas (8026)", () => {
  it("chave desligada: tenant nasce isento, plano_id recusado; criador provisório e settings.plan como no fork", () => {
    prove(`do $$
    declare r jsonb; v_org uuid;
    begin
      if public.fn_cobranca_ligada() then raise exception 'cobrança deveria nascer desligada'; end if;
      r := ${criar("c8026000-3333-4000-8000-000000000001")};
      v_org := (r->>'id')::uuid;
      if exists (select 1 from public.cobranca_assinaturas where organization_id = v_org) then
        raise exception 'tenant devia nascer isento';
      end if;
      if (select settings->>'plan' from public.organizations where id = v_org) <> 'standard' then
        raise exception 'settings.plan perdido';
      end if;
      if not (select provisional_until_handover from public.user_organizations where organization_id = v_org and user_id = '${ADMIN_PLAT}') then
        raise exception 'criador provisório perdido (0237)';
      end if;
      begin
        perform ${criar("c8026000-3333-4000-8000-000000000002", `,"plano_id":"${PLANO}"`)};
        raise exception 'aceitou plano com a chave desligada';
      exception when others then
        if sqlerrm <> 'cobranca_desligada' then raise; end if;
      end;
    end $$;`);
  });

  it("chave ligada: plano_id cria a assinatura em teste grátis; 0 dia marca entrada paga; arquivado é recusado", () => {
    prove(`${ligar}
    do $$
    declare r jsonb; a public.cobranca_assinaturas;
    begin
      r := ${criar("c8026000-3333-4000-8000-000000000003", `,"plano_id":"${PLANO}"`)};
      select * into a from public.cobranca_assinaturas where organization_id = (r->>'id')::uuid;
      if a.plano_id <> '${PLANO}' or a.estado <> 'trial' or a.pagamento_inicial_pendente
         or a.trial_ate < now() + interval '13 days' or a.trial_ate > now() + interval '15 days' then
        raise exception 'assinatura errada: %', row_to_json(a);
      end if;
      r := ${criar("c8026000-3333-4000-8000-000000000004", `,"plano_id":"${PLANO_ZERO}"`)};
      if not (select pagamento_inicial_pendente from public.cobranca_assinaturas where organization_id = (r->>'id')::uuid) then
        raise exception 'plano sem teste devia marcar a entrada paga';
      end if;
      update public.cobranca_planos set arquivado_em = now() where id = '${PLANO_ZERO}';
      begin
        perform ${criar("c8026000-3333-4000-8000-000000000005", `,"plano_id":"${PLANO_ZERO}"`)};
        raise exception 'aceitou plano arquivado';
      exception when others then
        if sqlerrm <> 'plano_invalido' then raise; end if;
      end;
    end $$;`);
  });

  it("gatilho: org de cliente nasce no plano do cadastro; a do admin de plataforma, não; desligada, nada", () => {
    prove(`
    insert into public.organizations(id, slug, legal_name, display_name, created_by) values
      ('${ORG_A}','org-a-8026','A','A','${CLIENTE}');
    ${ligar}
    insert into public.organizations(id, slug, legal_name, display_name, created_by) values
      ('${ORG_B}','org-b-8026','B','B','${CLIENTE}');
    insert into public.organizations(slug, legal_name, display_name, created_by) values
      ('org-c-8026','C','C','${ADMIN_PLAT}');
    do $$ begin
      if exists (select 1 from public.cobranca_assinaturas where organization_id = '${ORG_A}') then
        raise exception 'org criada com a chave desligada ganhou assinatura';
      end if;
      if (select plano_id from public.cobranca_assinaturas where organization_id = '${ORG_B}') is distinct from '${PLANO}' then
        raise exception 'org do cliente devia nascer no plano do cadastro';
      end if;
      if exists (select 1 from public.cobranca_assinaturas a join public.organizations o on o.id = a.organization_id where o.slug = 'org-c-8026') then
        raise exception 'org do admin de plataforma não recebe o plano do cadastro';
      end if;
    end $$;`);
  });

  it("um único plano do cadastro", () => {
    prove(`do $$ begin
      begin
        insert into public.cobranca_planos(nome,preco_cents,intervalo,padrao_no_cadastro) values ('Outro',28900,'mes',true);
        raise exception 'aceitou dois planos do cadastro';
      exception when unique_violation then null;
      end;
    end $$;`);
  });

  it("RLS: assinatura só para o admin da própria org (2 orgs); agente não vê", () => {
    const out = sql(`${seed}
    ${ligar}
    insert into public.organizations(id, slug, legal_name, display_name, created_by) values
      ('${ORG_A}','org-a-8026','A','A','${CLIENTE}'), ('${ORG_B}','org-b-8026','B','B','${CLIENTE}');
    insert into public.user_organizations(organization_id, user_id, role, accepted_at) values
      ('${ORG_A}','${CLIENTE}','admin',now()), ('${ORG_B}','${DONO}','agent',now());
    set local role authenticated;
    select set_config('request.jwt.claims', '{"sub":"${CLIENTE}"}', true);
    select 'minhas=' || count(*) from public.cobranca_assinaturas;
    select 'da_b=' || count(*) from public.cobranca_assinaturas where organization_id = '${ORG_B}';
    select set_config('request.jwt.claims', '{"sub":"${DONO}"}', true);
    select 'agente=' || count(*) from public.cobranca_assinaturas;
    rollback;`);
    expect(out).toContain("minhas=1");
    expect(out).toContain("da_b=0");
    expect(out).toContain("agente=0");
  });

  it("sessão não lê planos nem escreve assinatura; anon não executa as funções", () => {
    prove(`do $$ begin
      set local role authenticated;
      begin
        perform 1 from public.cobranca_planos;
        raise exception 'authenticated leu cobranca_planos';
      exception when insufficient_privilege then null;
      end;
      begin
        insert into public.cobranca_assinaturas(organization_id, plano_id) values ('${ORG_A}', '${PLANO}');
        raise exception 'authenticated escreveu cobranca_assinaturas';
      exception when insufficient_privilege then null;
      end;
      reset role;
      if has_function_privilege('anon','public.fn_cobranca_ligada()','execute')
         or has_function_privilege('authenticated','public.fn_cobranca_ligada()','execute')
         or has_function_privilege('anon','public.fn_trial_na_criacao_da_org()','execute') then
        raise exception 'EXECUTE vazou';
      end if;
    end $$;`);
  });
});
