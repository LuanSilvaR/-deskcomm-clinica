/**
 * Cobrança da plataforma — o aviso do provedor e a trava da exclusão (fork 8027,
 * card #160a; origem upstream 0601 §A/§B/§G).
 *
 * Prova no Postgres real, cada caso numa transação desfeita no fim:
 *   - `webhook_events_log` aceita os provedores `stripe` e `asaas` e segue
 *     recusando provedor fora do vocabulário;
 *   - o MESMO evento de cobrança não entra duas vezes (índice parcial — é a
 *     idempotência da rota do webhook); o arquivo dos canais não muda;
 *   - a organização com assinatura viva no provedor não sai do banco; a que
 *     cancela no fim do período, a sem provedor e a isenta saem;
 *   - anon/authenticated não executam a função do gatilho.
 */
import { describe, expect, it } from "vitest";

import { sql } from "./gov-helpers";

const ORG = "c8027000-2222-4000-8000-00000000000a";
const PLANO = "c8027000-1111-4000-8000-000000000001";

const seed = `begin;
insert into public.organizations(id, slug, legal_name, display_name) values ('${ORG}','org-8027','Org 8027','Org 8027');
insert into public.cobranca_planos(id,nome,preco_cents,intervalo) values ('${PLANO}','Standard',12900,'mes');`;

function prove(corpo: string) {
  expect(sql(`${seed}\n${corpo}\nrollback; select 'proved';`)).toContain("proved");
}

const ponteiro = (provedor: string, id: string) =>
  `insert into public.webhook_events_log(organization_id, provider, raw_body, valid_signature, external_id, event_type, status)
   values (null, '${provedor}', '{"id":"${id}","type":"x"}', true, '${id}', 'x', 'received')`;

describe("cobrança — webhook e trava da exclusão (8027)", () => {
  it("o arquivo aceita stripe e asaas e segue recusando provedor desconhecido", () => {
    prove(`${ponteiro("stripe", "evt_1")}; ${ponteiro("asaas", "evt_1")};
    do $$ begin
      begin
        insert into public.webhook_events_log(provider, raw_body) values ('pix_qualquer', '{}');
        raise exception 'aceitou provedor fora do vocabulário';
      exception when check_violation then null;
      end;
    end $$;`);
  });

  it("o mesmo evento de cobrança não entra duas vezes; o dos canais não é afetado", () => {
    prove(`${ponteiro("asaas", "pay_123")};
    do $$ begin
      begin
        ${ponteiro("asaas", "pay_123")};
        raise exception 'evento de cobrança duplicado entrou';
      exception when unique_violation then null;
      end;
    end $$;
    insert into public.webhook_events_log(provider, raw_body, external_id) values ('waha', '{}', 'dup'), ('waha', '{}', 'dup');`);
  });

  it("org com assinatura viva no provedor não sai do banco; cancelando no fim, sai", () => {
    prove(`
    insert into public.cobranca_assinaturas(organization_id, plano_id, estado, provedor, modo, provedor_cliente_id, assinaturas_vivas, cancela_no_fim)
      values ('${ORG}', '${PLANO}', 'ativa', 'asaas', 'teste', 'cus_1', 1, false);
    do $$ begin
      begin
        delete from public.organizations where id = '${ORG}';
        raise exception 'apagou org com assinatura viva';
      exception when sqlstate 'PT409' then
        if sqlerrm <> 'organizacao_com_assinatura_viva' then raise; end if;
      end;
    end $$;
    update public.cobranca_assinaturas set cancela_no_fim = true where organization_id = '${ORG}';
    delete from public.organizations where id = '${ORG}';
    do $$ begin
      if exists (select 1 from public.organizations where id = '${ORG}') then raise exception 'não apagou'; end if;
    end $$;`);
  });

  it("isenta (sem linha) e trial sem provedor saem normalmente", () => {
    prove(`
    insert into public.cobranca_assinaturas(organization_id, plano_id, estado) values ('${ORG}', '${PLANO}', 'trial');
    delete from public.organizations where id = '${ORG}';`);
  });

  it("anon e authenticated não executam a função do gatilho", () => {
    prove(`do $$ begin
      if has_function_privilege('anon','public.fn_cobranca_trava_exclusao_com_assinatura_viva()','execute')
         or has_function_privilege('authenticated','public.fn_cobranca_trava_exclusao_com_assinatura_viva()','execute') then
        raise exception 'EXECUTE vazou';
      end if;
    end $$;`);
  });
});
