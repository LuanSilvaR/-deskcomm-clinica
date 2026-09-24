/**
 * FORK clinic (Agenda do dia, 9014) — PELA TELA:
 *
 *   1. desligada, a tela diz como ligar; o admin liga em Configurações ›
 *      Profissionais e a Agenda ganha o botão "Agenda do dia";
 *   2. num dia com jornada, o bloco do atendente mostra estado, ocupação e o
 *      compromisso do paciente com o selo "Agendado";
 *   3. filtros: busca pelo nome do paciente (chip + limpar), status sem
 *      "Agendado" esconde a linha, "somente horários livres" mostra só vagas —
 *      e o filtro fica na URL (recarregar mantém);
 *   4. "Paciente chegou" muda o selo para "Na recepção";
 *   5. desfaz (compromisso e opção).
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "agenda-do-dia");
const FUSO = "America/Sao_Paulo";

interface Creds {
  users: Record<string, { email: string; id?: string } | undefined>;
  agenda?: { tipo_nome: string };
}
const creds = JSON.parse(fs.readFileSync(path.join(RAIZ, ".e2e-creds.json"), "utf8")) as Creds;

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

async function opcao(page: Page, ligar: boolean): Promise<void> {
  await page.goto("/app/settings/tenant/profissionais");
  const bloco = page.getByRole("main").getByTestId("clinic-agenda-do-dia");
  await expect(bloco).toBeVisible({ timeout: 20_000 });
  const ligada = await bloco.getByText("Agenda do dia ligada").isVisible();
  if (ligada !== ligar) {
    await bloco.getByTestId("clinic-agenda-do-dia-alternar").click();
    await expect(bloco.getByText(ligar ? "Agenda do dia ligada" : "Agenda do dia desligada")).toBeVisible({ timeout: 20_000 });
  }
}

const diaLocal = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

test("agenda do dia: bloco por profissional, filtros na URL e status — pela tela", async ({ page }) => {
  test.setTimeout(240_000);
  if (!creds.agenda || !creds.users.agent?.id) throw new Error(".e2e-creds.json sem agenda/agent");
  const agente = creds.users.agent.id;
  await loginComoAdmin(page, creds as unknown as CredsE2E);
  await opcao(page, false);

  // ── 1. desligada → liga ──────────────────────────────────────────────────
  await page.goto("/app/agenda/dia");
  await expect(page.getByTestId("agenda-do-dia-desligada")).toBeVisible({ timeout: 20_000 });
  await opcao(page, true);

  // ── dados: paciente e compromisso num dia com jornada ────────────────────
  const sufixo = Date.now().toString().slice(-8);
  const nomePaciente = `Clara Dia${sufixo}`;
  const criado = await page.request.post("/api/v1/contacts", {
    data: { name: nomePaciente, phone_number: `+551196${sufixo}`, source: "whatsapp" },
  });
  expect(criado.status(), await criado.text()).toBe(201);
  const contatoId = ((await criado.json()) as { data: { contact: { id: string } } }).data.contact.id;
  const tipos = ((await (await page.request.get("/api/v1/agenda/tipos")).json()) as { data: { id: string; name: string }[] }).data;
  const tipoId = tipos.find((t) => t.name === creds.agenda!.tipo_nome)!.id;
  const agora = Date.now();
  const livres = (await (
    await page.request.get(
      `/api/v1/agenda/horarios-livres?event_type_id=${tipoId}&owner_user_id=${agente}` +
        `&de=${new Date(agora + 2 * 86_400_000).toISOString()}&ate=${new Date(agora + 12 * 86_400_000).toISOString()}`,
    )
  ).json()) as { data: { slots: { inicio: string }[] } };
  const slot = livres.data.slots[1] ?? livres.data.slots[0];
  if (!slot) throw new Error("nenhum horário livre para o teste");
  const dia = diaLocal(slot.inicio);
  const marcado = await page.request.post("/api/v1/agenda/agendamentos", {
    data: { event_type_id: tipoId, starts_at: slot.inicio, contact_id: contatoId, owner_user_id: agente },
  });
  expect(marcado.status(), await marcado.text()).toBe(201);
  const agendamentoId = ((await marcado.json()) as { data: { id: string } }).data.id;

  try {
    // ── a porta na Agenda ──────────────────────────────────────────────────
    await page.goto("/app/agenda");
    await page.getByTestId("agenda-abrir-agenda-do-dia").click();
    await expect(page).toHaveURL(/\/app\/agenda\/dia/);
    const main = page.getByRole("main");
    await main.getByTestId("agenda-dia").fill(dia);
    await expect(page).toHaveURL(new RegExp(`dia=${dia}`));

    // ── 2. o bloco do atendente ────────────────────────────────────────────
    const bloco = main.locator(`[data-testid="bloco-profissional"][data-profissional="${agente}"]`);
    await expect(bloco).toBeVisible({ timeout: 20_000 });
    await expect(bloco.getByTestId("estado-do-dia")).toBeVisible();
    await expect(bloco.getByRole("meter")).toBeVisible();
    const linha = bloco.locator(`[data-testid="linha-compromisso"][data-id="${agendamentoId}"]`);
    await expect(linha).toContainText(nomePaciente);
    await expect(linha.getByTestId("selo-de-status")).toHaveAttribute("data-status", "agendado");
    await foto(page, "01-agenda-do-dia");

    // ── 3a. busca pelo paciente ────────────────────────────────────────────
    await main.getByTestId("filtro-paciente").fill(nomePaciente);
    await expect(page).toHaveURL(/q=Clara/);
    await expect(main.getByTestId("linha-compromisso")).toHaveCount(1);
    await expect(main.getByTestId("linha-livre")).toHaveCount(0);
    await expect(main.getByTestId("filtros-ativos")).toContainText(nomePaciente);
    await foto(page, "02-busca-do-paciente");
    await main.getByTestId("filtros-limpar").click();
    await expect(main.getByTestId("filtro-paciente")).toHaveValue("");

    // ── 3b. status sem "Agendado" esconde a linha ──────────────────────────
    await main.getByTestId("filtro-status").click();
    await page.getByTestId("filtro-status-agendado").uncheck();
    await expect(page).toHaveURL(/status=/);
    await page.keyboard.press("Escape");
    await expect(linha).toHaveCount(0);
    await main.getByTestId("filtros-limpar").click();
    await expect(linha).toBeVisible();

    // ── 3c. somente horários livres, e a URL guarda ────────────────────────
    await main.getByTestId("filtro-livres").check();
    await expect(page).toHaveURL(/livres=1/);
    await expect(linha).toHaveCount(0);
    await expect(bloco.getByTestId("linha-livre").first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("main").getByTestId("filtro-livres")).toBeChecked({ timeout: 20_000 });
    await foto(page, "03-somente-livres");
    await page.getByRole("main").getByTestId("filtros-limpar").click();

    // ── 4. "Paciente chegou" ───────────────────────────────────────────────
    const linhaDeNovo = page.getByRole("main").locator(`[data-testid="linha-compromisso"][data-id="${agendamentoId}"]`);
    await linhaDeNovo.getByTestId("linha-avancar").click();
    await expect(linhaDeNovo.getByTestId("selo-de-status")).toHaveAttribute("data-status", "na_recepcao", { timeout: 20_000 });
    await foto(page, "04-na-recepcao");
  } finally {
    // ── 5. desfaz ──────────────────────────────────────────────────────────
    await page.request.delete("/api/v1/agenda/agendamentos", { data: { id: agendamentoId, reason: "limpeza do teste e2e" } });
    await opcao(page, false);
  }
});
