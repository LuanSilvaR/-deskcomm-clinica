/**
 * Cobrança da plataforma — a régua no banco (fork 8028, card #160c; origem
 * upstream 0501 + 0601 §C/§D/§E).
 *
 * Prova no Postgres real, cada caso numa transação desfeita no fim:
 *   - suspensão TIPADA: a de cobrança nunca desfaz a administrativa, e a
 *     reativação exige o mesmo tipo;
 *   - `fn_cobranca_suspender_se_devendo` só suspende quem AINDA deve;
 *   - `fn_cobranca_registrar_aviso`: o mesmo aviso da mesma dívida ganha uma
 *     vez; grava o item `cobranca` na Central e fecha o anterior;
 *   - `fn_cobranca_reconciliaveis` relê quem tem provedor e ainda pode mudar;
 *   - backfill: suspensa sem tipo vale como administrativa;
 *   - anon/authenticated não executam nenhuma das funções.
 */
import { describe, expect, it } from "vitest";

import { sql } from "./gov-helpers";

const ORG = "c8028000-2222-4000-8000-00000000000a";
const PLANO = "c8028000-1111-4000-8000-000000000001";

const seed = `begin;
insert into public.organizations(id, slug, legal_name, display_name) values ('${ORG}','org-8028','Org 8028','Org 8028');
insert into public.cobranca_planos(id,nome,preco_cents,intervalo) values ('${PLANO}','Standard',12900,'mes');
insert into public.cobranca_assinaturas(organization_id, plano_id, estado) values ('${ORG}','${PLANO}','em_atraso');`;

function prove(corpo: string) {
  expect(sql(`${seed}\n${corpo}\nrollback; select 'proved';`)).toContain("proved");
}

const status = `(select status || '/' || coalesce(suspended_kind,'-') from public.organizations where id = '${ORG}')`;

describe("cobrança — régua no banco (8028)", () => {
  it("suspensão por cobrança suspende quem deve e a reativação exige o mesmo tipo", () => {
    prove(`do $$ declare r jsonb; begin
      r := public.fn_cobranca_suspender_se_devendo('${ORG}', 'Falta de pagamento');
      if not (r->>'changed')::boolean or ${status} <> 'suspended/cobranca' then raise exception 'não suspendeu: % %', r, ${status}; end if;
      r := public.fn_reativar_organizacao('${ORG}', 'administrativa', null);
      if (r->>'changed')::boolean or r->>'motivo' <> 'suspensao_de_cobranca' then raise exception 'administrativa desfez cobrança: %', r; end if;
      r := public.fn_reativar_organizacao('${ORG}', 'cobranca', null);
      if not (r->>'changed')::boolean or ${status} <> 'active/-' then raise exception 'não reativou: %', r; end if;
      if (select count(*) from public.event_log where organization_id = '${ORG}' and event_type in ('tenant.suspended','tenant.reactivated')) <> 2 then
        raise exception 'eventos de suspensão/reativação ausentes';
      end if;
    end $$;`);
  });

  it("a administrativa prevalece: a régua não a troca nem a desfaz", () => {
    prove(`do $$ declare r jsonb; begin
      perform public.fn_suspender_organizacao('${ORG}', 'administrativa', 'Decisão do dono', null);
      r := public.fn_cobranca_suspender_se_devendo('${ORG}', 'Falta de pagamento');
      if (r->>'changed')::boolean or r->>'motivo' <> 'administrativa_prevalece' then raise exception 'cobrança sobrescreveu: %', r; end if;
      r := public.fn_reativar_organizacao('${ORG}', 'cobranca', null);
      if (r->>'changed')::boolean or ${status} <> 'suspended/administrativa' then raise exception 'régua reativou a administrativa'; end if;
    end $$;`);
  });

  it("quem pagou no meio (estado ativa) não é suspenso", () => {
    prove(`update public.cobranca_assinaturas set estado = 'ativa' where organization_id = '${ORG}';
    do $$ declare r jsonb; begin
      r := public.fn_cobranca_suspender_se_devendo('${ORG}', 'Falta de pagamento');
      if (r->>'changed')::boolean or r->>'motivo' <> 'nao_deve' or ${status} <> 'active/-' then raise exception 'suspendeu quem pagou: %', r; end if;
    end $$;`);
  });

  it("o mesmo aviso da mesma dívida ganha uma vez; o novo fecha o anterior na Central", () => {
    prove(`do $$ begin
      if not public.fn_cobranca_registrar_aviso('${ORG}', 'venceu', now() - interval '1 day', 'Venceu', 'corpo', 'warn') then raise exception 'primeiro aviso perdeu'; end if;
      if public.fn_cobranca_registrar_aviso('${ORG}', 'venceu', now() - interval '1 day', 'Venceu', 'corpo', 'warn') then raise exception 'aviso repetido ganhou'; end if;
      if not public.fn_cobranca_registrar_aviso('${ORG}', 'suspende_em_breve', now() - interval '1 day', 'Suspende', 'corpo', 'critical') then raise exception 'aviso novo perdeu'; end if;
      if (select count(*) from public.agent_inbox_items where organization_id = '${ORG}' and kind = 'cobranca' and status = 'open') <> 1 then
        raise exception 'a Central devia ter só o aviso mais novo aberto';
      end if;
      if (select ultimo_aviso from public.cobranca_assinaturas where organization_id = '${ORG}') <> 'suspende_em_breve' then raise exception 'ultimo_aviso errado'; end if;
    end $$;`);
  });

  it("aviso de 80% do teto de IA: um por mês", () => {
    prove(`do $$ begin
      if not public.fn_cobranca_avisar_teto_de_ia('${ORG}', 'IA', 'corpo') then raise exception 'primeiro aviso perdeu'; end if;
      if public.fn_cobranca_avisar_teto_de_ia('${ORG}', 'IA', 'corpo') then raise exception 'segundo aviso no mesmo mês ganhou'; end if;
    end $$;`);
  });

  it("reconciliáveis: só com provedor; nunca lida precisa reler", () => {
    prove(`do $$ begin
      if exists (select 1 from public.fn_cobranca_reconciliaveis() where organization_id = '${ORG}') then raise exception 'sem provedor entrou'; end if;
      update public.cobranca_assinaturas set provedor = 'asaas', modo = 'teste', provedor_cliente_id = 'cus_1' where organization_id = '${ORG}';
      if not (select precisa_reler from public.fn_cobranca_reconciliaveis() where organization_id = '${ORG}') then raise exception 'nunca lida devia reler'; end if;
    end $$;`);
  });

  it("suspensa antiga sem tipo vale como administrativa; anon/authenticated não executam", () => {
    prove(`update public.organizations set status = 'suspended', suspended_kind = null where id = '${ORG}';
    do $$ declare r jsonb; begin
      r := public.fn_reativar_organizacao('${ORG}', 'cobranca', null);
      if (r->>'changed')::boolean then raise exception 'régua reativou suspensa sem tipo'; end if;
      if has_function_privilege('anon','public.fn_suspender_organizacao(uuid, text, text, uuid)','execute')
         or has_function_privilege('authenticated','public.fn_reativar_organizacao(uuid, text, uuid)','execute')
         or has_function_privilege('authenticated','public.fn_cobranca_registrar_aviso(uuid, text, timestamptz, text, text, text)','execute')
         or has_function_privilege('anon','public.fn_cobranca_suspender_se_devendo(uuid, text)','execute')
         or has_function_privilege('authenticated','public.fn_cobranca_reconciliaveis()','execute')
         or has_function_privilege('authenticated','public.fn_cobranca_avisar_teto_de_ia(uuid, text, text)','execute') then
        raise exception 'EXECUTE vazou';
      end if;
    end $$;`);
  });
});
