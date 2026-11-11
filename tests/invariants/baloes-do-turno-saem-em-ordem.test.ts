import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";

import type * as InboundTurn from "@/lib/agent-engine/agent/inbound-turn";
import type * as Providers from "@/lib/agent-engine/edge/llm/providers";
import type * as Queue from "@/lib/agent-engine/queue/queue";
import type * as ObsLogger from "@/lib/agent-engine/obs/logger";

/**
 * Issue #143 — balões de um turno chegavam FORA DE ORDEM no WhatsApp.
 *
 * Medido no DSV (Sofia, 2026-11-10): "Como posso ajudá-lo hoje?" às 15:47:34 e
 * "Boa tarde, Luan! Sou Sofia…" às 15:47:37 — o cumprimento, escrito primeiro,
 * chegou três segundos depois.
 *
 * Mecanismo: com `split_messages` ligado o modelo é instruído a mandar "várias
 * mensagens curtas" e passa a chamar `send_message` VÁRIAS VEZES NO MESMO PASSO.
 * O SDK (`ai`) executa as tool-calls de um passo com `Promise.all` — em paralelo.
 * A 1ª chamada paga a pausa humana (`esperaForaDoLock`, 1,2s–7,5s) e liga o flag
 * `jaEsperouComoHumano`; as seguintes veem o flag, pulam a espera e tomam o lock
 * do número ANTES dela.
 *
 * Harness igual a `limite-de-envios-por-turno.test.ts`: `createInboundTurnHandler`
 * real, modelo fake, canal que captura. O `sleep` espera de verdade, comprimido
 * 50× — a pausa humana precisa EXISTIR para a corrida aparecer.
 */

const container = process.env.TEST_DB_CONTAINER;
if (!container) {
  throw new Error("TEST_DB_CONTAINER not set — rode via `pnpm test:db` (scripts/test-db.sh)");
}

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://placeholder.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "placeholder-anon";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "placeholder-service";

const PORT = Number(process.env.TEST_DB_PORT ?? 54329);
const pool = new pg.Pool({
  connectionString: `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`,
  max: 4,
});

const ORG = "dddddddd-0143-4000-8000-000000000001";
const CONTACT = "dddddddd-0143-4000-8000-000000000002";
const SESSION = "dddddddd-0143-4000-8000-000000000003";
const CONV = "dddddddd-0143-4000-8000-000000000004";
const MSG = "dddddddd-0143-4000-8000-000000000005";

interface EnvioCapturado {
  body: string;
  seq: number;
}

type Modules = {
  createInboundTurnHandler: typeof InboundTurn.createInboundTurnHandler;
  queue: typeof Queue;
  createLogger: typeof ObsLogger.createLogger;
  createFakeRegistry: typeof Providers.createFakeRegistry;
};
let m: Modules;

let enviados: EnvioCapturado[] = [];

const CHECKPOINT = JSON.stringify({
  commitments: [],
  objections: [],
  next_action: null,
  rolling_summary: "turno de teste",
});

const USO = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

/** Modelo fake que escreve TODOS os balões num único passo (várias tool-calls de
 * `send_message` no mesmo `content`) e, no passo seguinte, encerra com o checkpoint. */
function modeloQueEscreveBaloesNoMesmoPasso(baloes: string[]) {
  let passou = false;
  return async () => {
    if (!passou) {
      passou = true;
      return {
        content: baloes.map((body, i) => ({
          type: "tool-call" as const,
          toolCallId: `b${i + 1}`,
          toolName: "send_message",
          input: JSON.stringify({ body }),
        })),
        finishReason: { unified: "tool-calls" as const, raw: undefined },
        usage: USO,
        warnings: [],
      };
    }
    return {
      content: [{ type: "text" as const, text: CHECKPOINT }],
      finishReason: { unified: "stop" as const, raw: undefined },
      usage: USO,
      warnings: [],
    };
  };
}

function montaHandler(doGenerate: unknown) {
  return m.createInboundTurnHandler({
    crmCfg: { supabase: {} as never },
    llmCfg: { anthropicApiKey: "fake" } as never,
    knobs: {
      historyLimit: 10,
      maxContextTokens: 1000,
      notesIndexMaxTokens: 500,
      maxSteps: 12,
      maxSendsPerTurn: 10,
      queuedRetryDelayMs: 1000,
      breaker: {
        exactFailureWarn: 2,
        exactFailureBlock: 5,
        sameToolFailureWarn: 3,
        sameToolFailureHalt: 8,
        noProgressWarn: 3,
        noProgressBlock: 5,
      },
    },
    log: m.createLogger(),
    registry: m.createFakeRegistry(doGenerate as never),
    channel: () =>
      ({
        channel: "captura",
        send: async (i: EnvioCapturado) => {
          enviados.push({ body: i.body, seq: i.seq });
          return { kind: "sent" as const, idempotencyKey: `k${enviados.length}`, messageId: `m${enviados.length}` };
        },
        sessionHealth: async () => ({ healthy: true, status: "WORKING" }),
        capabilities: () => ({ freeform: true, media: true, audio: true }),
        costPerMessage: () => ({ currency: "BRL", cents: 0 }),
      }) as never,
    // Terça, 15h BRT: dentro da janela anti-ban.
    clock: () => new Date("2026-07-28T18:00:00Z"),
    // Espera REAL, 50× mais curta: a pausa humana de ~6s vira ~120ms. Com `sleep`
    // no-op a corrida some e o teste passaria com o defeito no lugar.
    sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, Math.ceil(ms / 50))),
  });
}

async function rodaTurno(handler: ReturnType<typeof montaHandler>): Promise<Error | null> {
  await pool.query("update job_queue set status = 'done' where status = 'pending'");
  const { job } = await m.queue.enqueueJob(pool, ORG, {
    kind: "inbound_turn",
    leadId: CONTACT,
    payload: {
      conversation_id: CONV,
      contact_id: CONTACT,
      channel_session_id: SESSION,
      inbound_message_id: MSG,
      crm_event_id: "dddddddd-0143-4000-8000-000000000006",
    },
    maxAttempts: 1,
  });
  const [claimed] = await m.queue.claimJobs(pool, { workerId: "baloes-143", maxConcurrency: 1 });
  expect(claimed?.id).toBe(job.id);
  try {
    await handler(claimed!, pool, { workerId: "baloes-143" });
    await m.queue.completeJob(pool, claimed!.id, "baloes-143");
    return null;
  } catch (err) {
    await m.queue.failJob(pool, claimed!.id, "baloes-143", err);
    return err as Error;
  }
}

beforeAll(async () => {
  m = {
    createInboundTurnHandler: (await import("@/lib/agent-engine/agent/inbound-turn"))
      .createInboundTurnHandler,
    queue: await import("@/lib/agent-engine/queue/queue"),
    createLogger: (await import("@/lib/agent-engine/obs/logger")).createLogger,
    createFakeRegistry: (await import("@/lib/agent-engine/edge/llm/providers")).createFakeRegistry,
  };

  await pool.query(
    `insert into organizations (id, slug, legal_name, display_name)
     values ($1,'baloes-em-ordem','Baloes em Ordem','Baloes em Ordem') on conflict (id) do nothing`,
    [ORG],
  );
  await pool.query(
    `insert into contacts (id, organization_id, name, phone_number)
     values ($1,$2,'Lead dos Baloes','+5511900000143') on conflict (id) do nothing`,
    [CONTACT, ORG],
  );
  await pool.query(
    `insert into channel_sessions (id, organization_id, waha_session_name, status, webhook_secret_encrypted)
     values ($1,$2,'baloes-143-session','WORKING','\\x00'::bytea) on conflict (id) do nothing`,
    [SESSION, ORG],
  );
  await pool.query(
    `insert into conversations (id, organization_id, contact_id, channel_session_id, status, is_group)
     values ($1,$2,$3,$4,'ai_handling',false) on conflict (id) do nothing`,
    [CONV, ORG, CONTACT, SESSION],
  );
  await pool.query(
    `insert into messages (id, organization_id, conversation_id, channel_session_id, contact_id,
       type, direction, status, body, sent_via, sent_at)
     values ($1,$2,$3,$4,$5,'text','inbound','delivered','Boa tarde','external_device', now())
     on conflict (id) do nothing`,
    [MSG, ORG, CONV, SESSION, CONTACT],
  );
  await pool.query(
    `with v as (
       insert into playbook_versions (organization_id, layer, content)
       select null, 'platform', E'## Identidade\nAssistente de teste.'
       where not exists (select 1 from playbook_pointers where organization_id is null and layer = 'platform')
       returning id)
     insert into playbook_pointers (organization_id, layer, version_id)
     select null, 'platform', id from v`,
  );
});

beforeEach(() => {
  enviados = [];
});

describe("#143 — balões escritos no mesmo passo saem na ordem em que o modelo os escreveu", () => {
  it("3 balões, o 1º longo (pausa humana maior): chegam 1, 2, 3 — com seq crescente", async () => {
    const baloes = [
      // Longo de propósito: alvo da pausa humana ≈ 900 + 22×len ms (teto 7,5s).
      "Boa tarde! Aqui é a Sofia, da Farias Rocha Estética Avançada. É um prazer falar com você; " +
        "nossa clínica trabalha com protocolos sob medida, sempre com especialistas e com foco em " +
        "resultados naturais, do primeiro contato até o acompanhamento depois do procedimento.",
      "Vi que você chegou agora por aqui.",
      "Como posso te ajudar hoje?",
    ];
    const erro = await rodaTurno(montaHandler(modeloQueEscreveBaloesNoMesmoPasso(baloes)));
    expect(erro).toBeNull();

    expect(enviados.map((e) => e.body)).toEqual(baloes);
    // O ledger de envio é chaveado por (job_id, seq): seq fora de ordem faria um
    // re-run do job casar o balão errado com o registro de "já enviado".
    expect(enviados.map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  it("4 balões curtos e de tamanhos variados: a ordem se mantém", async () => {
    const baloes = [
      "Entendi, você quer cancelar a sua avaliação de quarta-feira, às 10h, com a Dra. Ana Carolina.",
      "Antes, posso te oferecer outro dia?",
      "Tenho quinta às 9h30.",
      "Você topa remarcar?",
    ];
    const erro = await rodaTurno(montaHandler(modeloQueEscreveBaloesNoMesmoPasso(baloes)));
    expect(erro).toBeNull();
    expect(enviados.map((e) => e.body)).toEqual(baloes);
  });
});
