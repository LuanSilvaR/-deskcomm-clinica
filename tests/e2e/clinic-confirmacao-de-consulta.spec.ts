/**
 * FORK clinic (migration 9004) — a confirmação de consulta, PELA TELA:
 *
 *   1. o admin liga "Confirmação automática" em Configurações › Profissionais;
 *   2. o lembrete da véspera saiu (o pedido é gravado como o cron o grava — o
 *      envio pelo WhatsApp exige WAHA pareado, e o texto com SIM/NÃO é provado
 *      em lib/clinic/confirmacao/servidor.test.ts); o detalhe do compromisso e o
 *      painel da Recepção mostram "Confirmação pedida";
 *   3. o paciente responde "Sim" (mensagem inbound de verdade, pelo trigger de
 *      `messages` → `event_log` → dreno) e a tela passa a "Paciente confirmou";
 *   4. outro paciente, a menos de 4 h da consulta, não respondeu: o cron abre a
 *      tarefa "Ligar para confirmar a consulta", que aparece em Tarefas, e o
 *      selo vira "Sem resposta — ligar";
 *   5. ele responde "não posso": "Pediu para remarcar" e a tarefa de remarcar;
 *   6. desliga a opção (deixa o ambiente como achou).
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "confirmacao-de-consulta");
const FUSO = "America/Sao_Paulo";

interface Creds {
  org_id: string;
  users: Record<string, { email: string; id?: string } | undefined>;
}

const creds = JSON.parse(fs.readFileSync(path.join(RAIZ, ".e2e-creds.json"), "utf8")) as Creds;

// O playwright.config publica o .env.e2e aqui e recusa Supabase fora do
// localhost; a trava se repete porque esta spec ESCREVE com a service role.
const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(URL_SUPABASE)) {
  throw new Error(`Supabase não é local (${URL_SUPABASE}) — esta spec só roda no ambiente de teste.`);
}
const admin = createClient(URL_SUPABASE, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { autoRefreshToken: false, persistSession: false },
});

function segredoDoCron(): string {
  const s = (process.env.INTERNAL_CRON_SECRET || process.env.INTERNAL_SECRET || "").trim();
  if (!s) throw new Error("INTERNAL_CRON_SECRET/INTERNAL_SECRET ausente no .env.e2e");
  return s;
}

async function cron(page: Page, rota: "event-log-drain" | "clinic-confirmacao-sem-resposta"): Promise<unknown> {
  const r = await page.request.post(`/api/v1/cron/${rota}`, { headers: { authorization: `Bearer ${segredoDoCron()}` } });
  expect(r.status(), await r.text()).toBe(200);
  return ((await r.json()) as { data: unknown }).data;
}

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

const dia = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

async function ligarConfirmacao(page: Page, ligar: boolean): Promise<void> {
  await page.goto("/app/settings/tenant/profissionais");
  const bloco = page.getByTestId("clinic-confirmacao");
  await expect(bloco).toBeVisible({ timeout: 20_000 });
  const ligada = await bloco.getByText("Confirmação automática ligada").isVisible();
  if (ligada !== ligar) {
    await page.getByTestId("clinic-confirmacao-alternar").click();
    await expect(bloco.getByText(ligar ? "Confirmação automática ligada" : "Confirmação automática desligada")).toBeVisible();
  }
}

/** Sessão de canal da organização (qualquer uma serve para a conversa existir). */
async function sessaoDoCanal(): Promise<string> {
  const { data } = await admin.from("channel_sessions").select("id").eq("organization_id", creds.org_id).limit(1).maybeSingle();
  if (data) return (data as { id: string }).id;
  const { data: nova, error } = await admin
    .from("channel_sessions")
    .insert({ organization_id: creds.org_id, waha_session_name: `e2e-confirmacao-${Date.now()}`, webhook_secret_encrypted: "e2e" })
    .select("id")
    .single();
  if (error) throw new Error(`channel_sessions: ${error.message}`);
  return (nova as { id: string }).id;
}

interface Cenario {
  contatoId: string;
  conversaId: string;
  agendamentoId: string;
  nome: string;
  inicio: string;
}

/** Paciente + agendamento confirmado + conversa + o pedido que o lembrete grava. */
async function cenario(nome: string, telefone: string, inicio: Date, sessao: string): Promise<Cenario> {
  const donoId = creds.users.agent?.id;
  if (!donoId) throw new Error(".e2e-creds.json sem agent");
  const { data: c, error: e1 } = await admin
    .from("contacts")
    .insert({ organization_id: creds.org_id, name: nome, phone_number: telefone })
    .select("id")
    .single();
  if (e1) throw new Error(`contato: ${e1.message}`);
  const contatoId = (c as { id: string }).id;
  const { data: a, error: e2 } = await admin
    .from("calendar_appointments")
    .insert({
      organization_id: creds.org_id,
      title: "Consulta de retorno",
      starts_at: inicio.toISOString(),
      ends_at: new Date(inicio.getTime() + 30 * 60_000).toISOString(),
      owner_user_id: donoId,
      contact_id: contatoId,
      status: "confirmed",
    })
    .select("id")
    .single();
  if (e2) throw new Error(`agendamento: ${e2.message}`);
  const agendamentoId = (a as { id: string }).id;
  const { data: conv, error: e3 } = await admin
    .from("conversations")
    .insert({ organization_id: creds.org_id, contact_id: contatoId, channel_session_id: sessao, status: "open" })
    .select("id")
    .single();
  if (e3) throw new Error(`conversa: ${e3.message}`);
  const conversaId = (conv as { id: string }).id;
  const { error: e4 } = await admin.from("clinic_confirmation_requests").insert({
    organization_id: creds.org_id,
    appointment_id: agendamentoId,
    contact_id: contatoId,
    conversation_id: conversaId,
  });
  if (e4) throw new Error(`pedido: ${e4.message}`);
  return { contatoId, conversaId, agendamentoId, nome, inicio: inicio.toISOString() };
}

async function pacienteResponde(c: Cenario, sessao: string, texto: string): Promise<void> {
  const { error } = await admin.from("messages").insert({
    organization_id: creds.org_id,
    conversation_id: c.conversaId,
    channel_session_id: sessao,
    contact_id: c.contatoId,
    direction: "inbound",
    type: "text",
    body: texto,
    external_id: `e2e-confirmacao-${c.agendamentoId}-${Date.now()}`,
    status: "delivered",
  });
  if (error) throw new Error(`mensagem: ${error.message}`);
}

async function seloNoDetalhe(page: Page, c: Cenario): Promise<ReturnType<Page["getByTestId"]>> {
  await page.goto(`/app/agenda?compromisso=${c.agendamentoId}`);
  const visita = page.getByTestId("visita-do-paciente");
  await expect(visita).toBeVisible({ timeout: 20_000 });
  return visita.getByTestId("selo-da-confirmacao");
}

test("confirmação de consulta: SIM, NÃO e sem resposta — pela tela", async ({ page }) => {
  test.setTimeout(240_000);
  await loginComoAdmin(page, creds as unknown as CredsE2E);

  // ── 1. liga a opção ────────────────────────────────────────────────────────
  await ligarConfirmacao(page, true);
  await foto(page, "01-confirmacao-ligada");

  const sessao = await sessaoDoCanal();
  const sufixo = Date.now().toString().slice(-8);

  // ── 2. pedido enviado: "Confirmação pedida" ───────────────────────────────
  const amanha = new Date(Date.now() + 26 * 3_600_000);
  const ana = await cenario(`Ana Confirma${sufixo}`, `+551195${sufixo}`, amanha, sessao);
  let selo = await seloNoDetalhe(page, ana);
  await expect(selo).toHaveText("Confirmação pedida");
  await foto(page, "02-detalhe-confirmacao-pedida");

  // ── 3. o paciente responde "Sim" ──────────────────────────────────────────
  await pacienteResponde(ana, sessao, "Sim!");
  await cron(page, "event-log-drain");
  await expect
    .poll(async () => {
      const { data } = await admin.from("clinic_confirmation_requests").select("status").eq("appointment_id", ana.agendamentoId).single();
      return (data as { status: string }).status;
    }, { timeout: 30_000 })
    .toBe("confirmado");
  selo = await seloNoDetalhe(page, ana);
  await expect(selo).toHaveText("Paciente confirmou");
  await foto(page, "03-detalhe-paciente-confirmou");

  await page.goto(`/app/recepcao?dia=${dia(ana.inicio)}`);
  const cartaoAna = page.getByTestId("cartao-da-recepcao").filter({ hasText: ana.nome });
  await expect(cartaoAna.getByTestId("selo-da-confirmacao")).toHaveText("Paciente confirmou", { timeout: 20_000 });
  await foto(page, "04-painel-paciente-confirmou");

  // ── 4. sem resposta a menos de 4 h: tarefa de ligar ───────────────────────
  const daquiADuasHoras = new Date(Date.now() + 2 * 3_600_000);
  const bruno = await cenario(`Bruno Silencio${sufixo}`, `+551194${sufixo}`, daquiADuasHoras, sessao);
  const resultado = (await cron(page, "clinic-confirmacao-sem-resposta")) as { marcados: number };
  expect(resultado.marcados).toBeGreaterThanOrEqual(1);
  selo = await seloNoDetalhe(page, bruno);
  await expect(selo).toHaveText("Sem resposta — ligar");
  await foto(page, "05-detalhe-sem-resposta");

  const { data: tarefaLigar } = await admin
    .from("crm_tasks")
    .select("id, title, status")
    .eq("organization_id", creds.org_id)
    .eq("contact_id", bruno.contatoId)
    .single();
  expect(tarefaLigar).toMatchObject({ title: "Ligar para confirmar a consulta", status: "pending" });
  await page.goto("/app/tasks");
  await expect(page.getByText("Ligar para confirmar a consulta").first()).toBeVisible({ timeout: 20_000 });
  await foto(page, "06-tarefas-ligar-para-confirmar");

  // ── 5. ele responde "não posso": remarcar ─────────────────────────────────
  await pacienteResponde(bruno, sessao, "não posso");
  await cron(page, "event-log-drain");
  await expect
    .poll(async () => {
      const { data } = await admin.from("clinic_confirmation_requests").select("status").eq("appointment_id", bruno.agendamentoId).single();
      return (data as { status: string }).status;
    }, { timeout: 30_000 })
    .toBe("recusado");
  selo = await seloNoDetalhe(page, bruno);
  await expect(selo).toHaveText("Pediu para remarcar");
  await foto(page, "07-detalhe-pediu-para-remarcar");

  const { data: tarefas } = await admin
    .from("crm_tasks")
    .select("title, status")
    .eq("organization_id", creds.org_id)
    .eq("contact_id", bruno.contatoId)
    .order("created_at", { ascending: true });
  expect(tarefas).toEqual([
    { title: "Ligar para confirmar a consulta", status: "done" },
    { title: "Paciente pediu para remarcar", status: "pending" },
  ]);

  // ── 6. deixa o ambiente como achou ────────────────────────────────────────
  await ligarConfirmacao(page, false);
});
