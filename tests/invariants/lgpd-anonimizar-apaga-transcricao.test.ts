import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * ANONIMIZAR APAGA A TRANSCRIÇÃO DA MÍDIA (migration 8001 do fork, #95).
 *
 * Adaptado do upstream #1989 (teste da 0497). `messages.media_derived_text` é o
 * texto que o `media-derive-worker` tira da mídia (transcrição do áudio, leitura
 * da imagem). A cascata do banco trocava o body por '[mensagem anonimizada]' e
 * deixava a transcrição legível.
 *
 * Prova, no Postgres real e pelo COMPORTAMENTO:
 *   - o pedido formal (`fn_lgpd_cascade_redact_contact`) zera a transcrição;
 *   - a mensagem de OUTRO contato da mesma org fica intacta;
 *   - a cura do apêndice (lida do `baseline.sql`, não copiada) alcança quem JÁ
 *     era anonimizado e poupa a mensagem nova de quem voltou a escrever;
 *   - todo UPDATE de messages que redige o body, no corpo instalado, zera a
 *     transcrição.
 *
 * Diferença para o upstream: o fork ainda não tem o gatilho da virada de
 * `is_anonymized` (upstream 0391/0494), então não há prova por esse caminho.
 */

const pool = new pg.Pool({
  connectionString: `postgresql://postgres:postgres@127.0.0.1:${process.env.TEST_DB_PORT}/postgres`,
});
afterAll(() => pool.end());
const q = (text: string, args: unknown[] = []) => pool.query(text, args);

const ORG = randomUUID();
const SESSAO = randomUUID();
const PELO_PEDIDO = randomUUID(); // anonimizado pela RPC do pedido formal
const VIZINHO = randomUUID(); // mesma org, NÃO anonimizado
const JA_ANONIMIZADO = randomUUID(); // anonimizado antes da 8001 — alvo da cura

const conversaDe = new Map<string, string>();
const TRANSCRICAO = "oi, aqui é a paciente de teste, meu documento é 000";

async function audio(contato: string, body: string | null = null, metadata: object = {}) {
  const id = randomUUID();
  await q(
    `insert into messages(id,organization_id,conversation_id,channel_session_id,contact_id,type,direction,status,
                          sent_via,body,media_storage_path,media_derived_text,media_derived_status,sent_at,metadata)
     values($1,$2,$3,$4,$5,'audio','inbound','delivered','external_device',$6,$7,$8,'ready',now(),$9::jsonb)`,
    [id, ORG, conversaDe.get(contato), SESSAO, contato, body, `${ORG}/${id}.ogg`, TRANSCRICAO, JSON.stringify(metadata)],
  );
  return id;
}

async function transcricao(id: string): Promise<string | null> {
  return (await q("select media_derived_text from messages where id=$1", [id])).rows[0].media_derived_text;
}

let doPedido: string;
let doVizinho: string;
let residuo: string;
let deQuemVoltou: string;

beforeAll(async () => {
  await q("insert into organizations(id,slug,legal_name,display_name) values($1::uuid,$1::text,'Transcrição LGPD','Transcrição LGPD')", [ORG]);
  await q(
    "insert into channel_sessions(id,organization_id,waha_session_name,webhook_secret_encrypted) values($1::uuid,$2,$1::text,'\\x00'::bytea)",
    [SESSAO, ORG],
  );
  for (const [id, nome, telefone] of [
    [PELO_PEDIDO, "Pelo Pedido", "+5521911110497"],
    [VIZINHO, "Vizinho", "+5531922220497"],
  ] as const) {
    await q("insert into contacts(id,organization_id,name,display_name,phone_number) values($1,$2,$3,$3,$4)", [id, ORG, nome, telefone]);
  }
  // Já anonimizado ANTES da 8001: nasce com is_anonymized (o gatilho só dispara na virada).
  await q(
    "insert into contacts(id,organization_id,name,display_name,is_anonymized,anonymized_at) values($1,$2,'Cliente Anonimizado','Cliente Anonimizado',true,now())",
    [JA_ANONIMIZADO, ORG],
  );
  for (const contato of [PELO_PEDIDO, VIZINHO, JA_ANONIMIZADO]) {
    const conversa = randomUUID();
    conversaDe.set(contato, conversa);
    await q(
      "insert into conversations(id,organization_id,contact_id,channel_session_id,status,is_group) values($1,$2,$3,$4,'open',$5)",
      [conversa, ORG, contato, SESSAO, false],
    );
  }

  doPedido = await audio(PELO_PEDIDO);
  doVizinho = await audio(VIZINHO);
  // O estado que a main deixava: body redigido, transcrição legível.
  residuo = await audio(JA_ANONIMIZADO, "[mensagem anonimizada]");
  // Quem voltou a escrever depois de anonimizado (religado pelo LID): body de verdade.
  deQuemVoltou = await audio(JA_ANONIMIZADO, "voltei, quero o orçamento");
});

describe("LGPD: anonimizar apaga a transcrição da mídia (8001)", () => {
  it("antes: todas as mensagens guardam a transcrição — o experimento tem massa", async () => {
    for (const id of [doPedido, doVizinho, residuo, deQuemVoltou]) {
      expect(await transcricao(id)).toBe(TRANSCRICAO);
    }
  });

  it("⭐ o pedido formal (fn_lgpd_cascade_redact_contact) chega ao mesmo estado", async () => {
    await q("select public.fn_lgpd_cascade_redact_contact($1,$2,null)", [ORG, PELO_PEDIDO]);
    expect(await transcricao(doPedido)).toBeNull();
    const m = (await q("select body, media_derived_status from messages where id=$1", [doPedido])).rows[0];
    expect(m.body).toBe("[mensagem anonimizada]");
    // O status é vocabulário, não conteúdo: é ele que diz ao drain que a derivação terminou.
    expect(m.media_derived_status).toBe("ready");
  });

  it("⭐ a mensagem de OUTRO contato da mesma org não é tocada", async () => {
    expect(await transcricao(doVizinho)).toBe(TRANSCRICAO);
  });

  it("⭐ a cura do apêndice alcança quem já era anonimizado e poupa quem voltou", async () => {
    const baseline = readFileSync(join(process.cwd(), "supabase", "baseline.sql"), "utf8");
    const bloco = baseline.slice(baseline.indexOf("(migration 8001, fork) ----"));
    const cura = /update public\.messages set\s+media_derived_text = null,[\s\S]*?where body = '\[mensagem anonimizada\]'[\s\S]*?;/.exec(
      bloco.slice(0, bloco.indexOf("\n-- ---- fim clinic (migration 8001")),
    )?.[0];
    expect(cura, "a cura da 8001 não foi achada no apêndice do baseline").toBeTruthy();

    await q(cura!);

    expect(await transcricao(residuo)).toBeNull();
    expect(await transcricao(deQuemVoltou)).toBe(TRANSCRICAO);
    expect(await transcricao(doVizinho)).toBe(TRANSCRICAO);
  });

  it("⭐ todo UPDATE de messages que redige o body zera a transcrição, no corpo instalado", async () => {
    for (const funcao of ["fn_lgpd_cascade_redact_contact"]) {
      const { rows } = await q(
        "select pg_get_functiondef(p.oid) def from pg_proc p where p.proname = $1 and p.pronamespace = 'public'::regnamespace",
        [funcao],
      );
      expect(rows, `função ${funcao} não existe (ou existe em dobro) em public`).toHaveLength(1);
      const blocos = [...(rows[0].def as string).matchAll(/update\s+(?:public\.)?messages\s+set([\s\S]*?)\bwhere\b/gi)].map(
        (m) => m[1] ?? "",
      );
      expect(blocos.length, `nenhum UPDATE de messages em ${funcao} — a sonda ficou cega`).toBeGreaterThan(0);
      for (const bloco of blocos) {
        expect(bloco, `${funcao}: UPDATE de messages que redige o body e deixa a transcrição`).toContain(
          "[mensagem anonimizada]",
        );
        expect(bloco, `${funcao}: UPDATE de messages sem media_derived_text = null`).toMatch(
          /media_derived_text\s*=\s*null/,
        );
      }
    }
  });
});
