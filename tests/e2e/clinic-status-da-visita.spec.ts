/**
 * FORK clinic (migration 9003) — o status da visita e o histórico, PELA TELA:
 *
 *   1. paciente agendado aparece em "Agendado" no painel da Recepção;
 *   2. a recepção marca "Paciente chegou" e "Pronto para atendimento" pelo painel;
 *   3. uma SEGUNDA tela parada no painel vê a mudança sem recarregar (Realtime);
 *   4. no detalhe do compromisso: "Iniciar atendimento" e "Finalizar atendimento";
 *   5. "Corrigir status" volta um passo com motivo — e sem motivo não deixa;
 *   6. a aba Timeline do paciente mostra o agendamento com os marcos e a correção.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "status-da-visita");
const FUSO = "America/Sao_Paulo";

interface Creds {
  users: Record<string, { email: string; id?: string } | undefined>;
  agenda?: { tipo_nome: string };
}

function lerCreds(): Creds {
  const p = path.join(RAIZ, ".e2e-creds.json");
  if (!fs.existsSync(p)) throw new Error("`.e2e-creds.json` ausente — rode `scripts/seed-e2e-credentials.ts`");
  let c = JSON.parse(fs.readFileSync(p, "utf8")) as Creds;
  if (!c.agenda) {
    execFileSync("npx", ["tsx", "scripts/seed-e2e-agenda.ts"], { stdio: "inherit" });
    c = JSON.parse(fs.readFileSync(p, "utf8")) as Creds;
  }
  return c;
}

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

const dia = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

test("recepção e profissional levam a visita até finalizado, com histórico — pela tela", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const creds = lerCreds();
  if (!creds.agenda || !creds.users.agent?.id) throw new Error(".e2e-creds.json sem agenda/agent");
  const credsAdmin = creds as unknown as CredsE2E;
  await loginComoAdmin(page, credsAdmin);

  // A ficha obrigatória fica DESLIGADA aqui: esta spec mede o status da visita.
  const cfg = await page.request.patch("/api/v1/clinic/config", { data: { ficha_obrigatoria: false } });
  expect(cfg.status(), await cfg.text()).toBe(200);

  // ── paciente e agendamento ────────────────────────────────────────────────
  const sufixo = Date.now().toString().slice(-8);
  const criado = await page.request.post("/api/v1/contacts", {
    data: { name: `Carla Visita${sufixo}`, phone_number: `+551196${sufixo}`, source: "whatsapp" },
  });
  expect(criado.status(), await criado.text()).toBe(201);
  const contatoId = ((await criado.json()) as { data: { contact: { id: string } } }).data.contact.id;
  const tipos = ((await (await page.request.get("/api/v1/agenda/tipos")).json()) as { data: { id: string; name: string }[] }).data;
  const tipo = tipos.find((t) => t.name === creds.agenda!.tipo_nome)!;
  const de = new Date(Date.now() + 2 * 86_400_000).toISOString();
  const ate = new Date(Date.now() + 12 * 86_400_000).toISOString();
  const livres = (await (
    await page.request.get(`/api/v1/agenda/horarios-livres?event_type_id=${tipo.id}&owner_user_id=${creds.users.agent.id}&de=${de}&ate=${ate}`)
  ).json()) as { data?: { slots: { inicio: string }[] } };
  const slot = livres.data?.slots?.[5] ?? livres.data?.slots?.[0];
  if (!slot) throw new Error("nenhum horário livre para o teste");
  const marcado = await page.request.post("/api/v1/agenda/agendamentos", {
    data: { event_type_id: tipo.id, starts_at: slot.inicio, contact_id: contatoId, owner_user_id: creds.users.agent.id },
  });
  expect(marcado.status(), await marcado.text()).toBe(201);
  const agendamentoId = ((await marcado.json()) as { data: { id: string } }).data.id;
  const diaDoAgendamento = dia(slot.inicio);
  const cartao = (p: Page) => p.getByTestId("cartao-da-recepcao").filter({ hasText: `Carla Visita${sufixo}` });

  // ── 1. o painel mostra o paciente em "Agendado" ─────────────────────────────
  await page.goto(`/app/recepcao?dia=${diaDoAgendamento}`);
  await expect(page.getByTestId("coluna-agendado").getByTestId("cartao-da-recepcao").filter({ hasText: `Carla Visita${sufixo}` })).toBeVisible({ timeout: 20_000 });

  // Uma SEGUNDA tela, parada no painel, para provar o tempo real.
  const outraAba = await browser.newContext();
  const painel2 = await outraAba.newPage();
  await loginComoAdmin(painel2, credsAdmin);
  await painel2.goto(`/app/recepcao?dia=${diaDoAgendamento}`);
  await expect(painel2.getByTestId("painel-da-recepcao")).toHaveAttribute("data-realtime-status", "subscribed", { timeout: 30_000 });
  await expect(painel2.getByTestId("coluna-agendado").getByTestId("cartao-da-recepcao").filter({ hasText: `Carla Visita${sufixo}` })).toBeVisible();
  await foto(page, "01-painel-agendado");

  // ── 2. recepção: chegou → pronto, pelo painel ───────────────────────────────
  await cartao(page).getByTestId("recepcao-na_recepcao").click();
  await expect(page.getByTestId("coluna-na_recepcao").getByTestId("cartao-da-recepcao").filter({ hasText: `Carla Visita${sufixo}` })).toBeVisible({ timeout: 15_000 });
  // ── 3. a outra tela muda de coluna SEM recarregar ───────────────────────────
  await expect(painel2.getByTestId("coluna-na_recepcao").getByTestId("cartao-da-recepcao").filter({ hasText: `Carla Visita${sufixo}` })).toBeVisible({ timeout: 20_000 });
  await foto(painel2, "02-outra-tela-atualizou-sozinha");

  await cartao(page).getByTestId("recepcao-pronto").click();
  await expect(page.getByTestId("coluna-pronto").getByTestId("cartao-da-recepcao").filter({ hasText: `Carla Visita${sufixo}` })).toBeVisible({ timeout: 15_000 });
  await expect(painel2.getByTestId("coluna-pronto").getByTestId("cartao-da-recepcao").filter({ hasText: `Carla Visita${sufixo}` })).toBeVisible({ timeout: 20_000 });
  await foto(page, "03-pronto-para-atendimento");
  await outraAba.close();

  // ── 4. profissional: iniciar e finalizar no detalhe do compromisso ─────────
  await page.goto(`/app/agenda?compromisso=${agendamentoId}`);
  const visita = page.getByTestId("visita-do-paciente");
  await expect(visita.getByTestId("selo-da-visita")).toHaveText("Pronto para atendimento", { timeout: 20_000 });
  await visita.getByTestId("visita-em_atendimento").click();
  await expect(visita.getByTestId("selo-da-visita")).toHaveText("Em atendimento", { timeout: 10_000 });
  await visita.getByTestId("visita-finalizado").click();
  await expect(visita.getByTestId("selo-da-visita")).toHaveText("Finalizado", { timeout: 10_000 });
  await foto(page, "04-finalizado");

  // ── 5. correção: sem motivo não deixa; com motivo volta um passo ────────────
  await visita.getByTestId("visita-corrigir").click();
  const correcao = visita.getByTestId("visita-correcao");
  await correcao.getByLabel("Novo status").selectOption("em_atendimento");
  await expect(correcao.getByRole("button", { name: "Salvar status" })).toBeDisabled();
  await correcao.getByLabel("Motivo da correção").fill("Finalizei por engano");
  await correcao.getByRole("button", { name: "Salvar status" }).click();
  await expect(visita.getByTestId("selo-da-visita")).toHaveText("Em atendimento", { timeout: 10_000 });
  await expect(visita.getByTestId("visita-historico")).toContainText("Finalizei por engano");
  await foto(page, "05-correcao-com-motivo");

  // ── 6. a timeline do paciente mostra o histórico com os marcos ──────────────
  await page.goto(`/app/contacts/${contatoId}`);
  await page.getByRole("tab", { name: "Timeline" }).click();
  const item = page.getByTestId("historico-de-atendimentos").getByTestId("item-do-historico").first();
  await expect(item).toBeVisible({ timeout: 20_000 });
  const marcos = item.getByTestId("marcos-da-visita");
  await expect(marcos.locator("li")).toHaveCount(5);
  await expect(marcos).toContainText("Na recepção");
  await expect(marcos).toContainText("Pronto para atendimento");
  await expect(marcos).toContainText("Finalizado");
  await expect(marcos).toContainText("Finalizei por engano");
  await foto(page, "06-timeline-do-paciente");
});
