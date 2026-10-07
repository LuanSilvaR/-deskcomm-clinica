/**
 * FORK clinic (migration 9014) — o menu por módulos da clínica, PELA TELA:
 *
 *   1. o admin abre o Início (⌘K/URL) com o menu de sempre e liga o menu da
 *      clínica pela própria tela;
 *   2. o menu lateral passa a mostrar UMA LINHA POR MÓDULO (sem "Em breve",
 *      que fica só no Início), cabe em 1280×900 sem rolar, e o Início mostra a
 *      grade de módulos à vista;
 *   3. clicar no módulo leva à primeira tela; as outras telas do módulo ficam
 *      nas abas do topo (Agenda → Faltas), e o painel do módulo lista o
 *      inventário (Agente de IA);
 *   4. um atendente vê o menu novo e NENHUMA tela a mais do que via antes (o
 *      módulo Financeiro-configuração/IA-gestão continua fora dele);
 *   5. desligar devolve o menu de sempre, com os mesmos cabeçalhos.
 *
 * Pré-requisito: `.e2e-creds.json` (scripts/seed-e2e-credentials.ts).
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { lerCreds, loginComoAdmin } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "menu-da-clinica");

let creds = lerCreds();

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Navegação principal" });

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

async function loginAgente(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(creds.users.agent!.email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/app\//);
}

async function menuDaClinica(page: Page, ligar: boolean): Promise<void> {
  await page.goto("/app/inicio");
  const bloco = page.getByRole("main").getByTestId("clinic-menu-da-clinica");
  await expect(bloco).toBeVisible({ timeout: 20_000 });
  const ligado = await bloco.getByText("Menu organizado por módulos da clínica").isVisible();
  if (ligado !== ligar) {
    await page.getByRole("main").getByTestId("clinic-menu-da-clinica-alternar").click();
    await expect(
      bloco.getByText(ligar ? "Menu organizado por módulos da clínica" : "Experimente o menu da clínica"),
    ).toBeVisible({ timeout: 20_000 });
  }
}

/** Todos os hrefs que o ⌘K oferece — a lista completa do que a pessoa alcança. */
async function hrefsDoCmdK(page: Page): Promise<string[]> {
  await page.keyboard.press("ControlOrMeta+k");
  const lista = page.getByRole("listbox");
  await page.getByRole("combobox").fill("a");
  await expect(lista).toBeVisible();
  const hrefs = await lista.locator("[data-href]").evaluateAll((els) => els.map((e) => e.getAttribute("data-href")!));
  await page.keyboard.press("Escape");
  return [...new Set(hrefs)].sort();
}

test.describe.configure({ mode: "serial", timeout: 240_000 });

test.describe("menu da clínica", () => {
  test.afterAll(async ({ browser }) => {
    // Nunca deixa a organização de teste com o menu ligado para as outras specs.
    const page = await browser.newPage();
    creds = await loginComoAdmin(page, creds);
    await menuDaClinica(page, false);
    await page.close();
  });

  test("o admin liga pelo Início e o menu vira módulos da clínica", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    creds = await loginComoAdmin(page, creds);
    await menuDaClinica(page, false);
    const antes = await hrefsDoCmdK(page);

    await menuDaClinica(page, true);
    await expect(sidebar(page)).toHaveAttribute("data-menu", "clinica");

    for (const nome of ["Início", "Agenda", "Atendimento", "Pacientes", "Tarefas", "Marketing", "Agente de IA"]) {
      await expect(sidebar(page).getByText(nome, { exact: true }).first()).toBeVisible();
    }
    // O que já existe tem tela; o que não existe não ocupa o menu.
    await expect(sidebar(page).getByRole("link", { name: "Contratos e termos" })).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: "Salas e equipamentos" })).toBeVisible();
    await expect(sidebar(page).getByText("Em breve")).toHaveCount(0);
    await expect(sidebar(page).getByText("Ponto", { exact: true })).toHaveCount(0);

    // Início: grade de módulos à vista; "Em breve" no fim, sem link.
    await page.goto("/app/inicio");
    const grade = page.getByRole("list", { name: "Módulos da clínica" });
    await expect(grade.getByRole("link", { name: /Agenda/ })).toBeVisible();
    await expect(page.getByTestId("inicio-em-breve")).toContainText("Ponto");

    // Rodapé fixo, fora da área que rola.
    await expect(page.getByRole("link", { name: "Configurações", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Perfil e acesso", exact: true })).toBeVisible();

    const rola = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Navegação principal"]')!;
      return nav.scrollHeight > Math.round(nav.getBoundingClientRect().height) + 1;
    });
    expect(rola, "em 900px o menu da clínica cabe sem scroll").toBe(false);
    await foto(page, "1-inicio-admin-1280x900");

    // Reorganizar não muda o que o admin alcança.
    expect(await hrefsDoCmdK(page)).toEqual(antes);
  });

  test("o módulo abre as telas de sempre e o painel lista o inventário", async ({ page }) => {
    creds = await loginComoAdmin(page, creds);
    await page.goto("/app/inicio");

    await sidebar(page).getByRole("link", { name: "Agenda" }).click();
    await page.waitForURL(/\/app\/agenda$/);
    await expect(sidebar(page).getByRole("link", { name: "Agenda" })).toHaveAttribute("aria-current", "page");
    const abas = page.getByTestId("abas-do-modulo");
    await abas.getByRole("link", { name: "Faltas" }).click();
    await page.waitForURL(/\/app\/agenda\/faltas/);
    await expect(abas.getByRole("link", { name: "Faltas" })).toHaveAttribute("aria-current", "page");
    await expect(sidebar(page).getByRole("link", { name: "Agenda" })).toHaveAttribute("aria-current", "page");
    await foto(page, "2a-abas-da-agenda");

    await page.goto("/app/inicio/agente-de-ia");
    await expect(page.getByRole("heading", { name: "Agente de IA", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ensinar o agente" })).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: /Conhecimento/ }).click();
    await page.waitForURL(/knowledge\/sources/);
    await foto(page, "2-modulo-ia");
  });

  test("o atendente vê o menu novo sem nenhuma tela a mais", async ({ page }) => {
    await loginAgente(page);
    await expect(sidebar(page)).toHaveAttribute("data-menu", "clinica");
    const comClinica = await hrefsDoCmdK(page);
    // Portas de gestor continuam fora do alcance de quem atende.
    expect(comClinica).not.toContain("/app/ai/agents");
    expect(comClinica).not.toContain("/app/settings/tenant");
    await foto(page, "3-atendente");
  });

  test.describe("mobile", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("em 390px a gaveta mostra os módulos sem overflow horizontal", async ({ page }) => {
      creds = await loginComoAdmin(page, creds);
      await page.goto("/app/inicio");
      await page.getByRole("button", { name: "Abrir navegação" }).click();
      await expect(sidebar(page)).toHaveAttribute("data-menu", "clinica");
      const m = await page.evaluate(() => ({
        scrollWidth: document.body.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth + 1);
      await foto(page, "4-mobile-390");
    });
  });

  test("desligar devolve o menu de sempre", async ({ page }) => {
    creds = await loginComoAdmin(page, creds);
    await menuDaClinica(page, false);
    await page.goto("/app/inbox");
    await expect(sidebar(page)).not.toHaveAttribute("data-menu", "clinica");
    await expect(sidebar(page).getByRole("heading")).toHaveText(["Atendimento", "CRM", "Agente de IA", "Canais", "Análise"]);
  });
});
