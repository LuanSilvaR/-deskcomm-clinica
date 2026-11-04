/**
 * FORK clinic (agenda por profissional, S1) — PELA TELA:
 *
 *   1. a Agenda abre com UM profissional em contexto, e ele está na URL (CA01, CA16);
 *   2. trocar de profissional busca por parte do nome e NÃO recarrega a página (CA02, CA03);
 *   3. F5 mantém o profissional; sair e voltar restaura o último (CA04, CA16);
 *   4. clicar num horário livre abre o painel com o profissional fixo e o horário
 *      escolhido, sem perguntar de novo quem atende (CA11, CA12, CA19);
 *
 * Fora daqui: a recusa da agenda de um colega sem `agenda.ver_outros` (o seed do
 * e2e não tem papel sem a chave). A regra é a de `escopoDaLeitura`, coberta em
 * `tests/unit/clinic-agenda-por-profissional.test.ts`.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { irParaASemanaSeguinte } from "./helpers/agenda-semana-integra";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "agenda-por-profissional");

interface Creds {
  password: string;
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

async function entrar(page: Page, creds: Creds) {
  const usuario = creds.users.manager;
  if (!usuario) throw new Error(".e2e-creds.json sem o usuário `manager`");
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(usuario.email);
  await page.getByLabel(/senha/i).fill(creds.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/app(\/|$)/, { timeout: 20_000 });
}

const contexto = (page: Page) => page.getByTestId("contexto-da-agenda");

test("agenda por profissional: contexto, troca sem recarregar, URL, memória e marcação", async ({ page }) => {
  test.setTimeout(180_000);
  const creds = lerCreds();
  const agente = creds.users.agent?.id;
  if (!agente) throw new Error(".e2e-creds.json sem users.agent.id");
  await entrar(page, creds);

  const lista = (
    (await (await page.request.get("/api/v1/clinic/agenda/profissionais")).json()) as {
      data: { profissionais: { user_id: string; nome: string }[]; pode_ver_outros: boolean };
    }
  ).data;
  expect(lista.pode_ver_outros).toBe(true);
  const doAgente = lista.profissionais.find((p) => p.user_id === agente);
  expect(doAgente, "o atendente com jornada precisa estar na lista").toBeTruthy();
  const outro = lista.profissionais.find((p) => p.user_id !== agente);

  // ── 1. abre com um profissional em contexto, e ele vai para a URL ─────────
  await page.goto("/app/agenda");
  await expect(contexto(page)).toBeVisible({ timeout: 20_000 });
  const inicial = await contexto(page).getAttribute("data-profissional");
  expect(inicial).toBeTruthy();
  await expect(page).toHaveURL(new RegExp(`profissional=${inicial}`));
  await expect(page).toHaveURL(/data=\d{4}-\d{2}-\d{2}/);
  // A faixa de avatares (filtro de pessoas) saiu: o profissional não é filtro.
  await expect(page.locator('[data-testid^="botao-pessoa-"]')).toHaveCount(0);
  await foto(page, "1-contexto-inicial");

  // ── 2. troca por busca, sem recarregar ────────────────────────────────────
  if (outro) {
    await page.evaluate(() => {
      (window as unknown as { __semRecarga?: boolean }).__semRecarga = true;
    });
    const alvo = inicial === agente ? outro : doAgente!;
    await page.getByTestId("trocar-profissional").click();
    const parte = alvo.nome.split(/\s+/).find((p) => p.length > 3) ?? alvo.nome;
    await page.getByTestId("buscar-profissional").fill(parte.slice(0, 4).toLowerCase());
    await expect(page.getByTestId(`opcao-profissional-${alvo.user_id}`)).toBeVisible();
    await page.getByTestId(`opcao-profissional-${alvo.user_id}`).click();
    await expect(contexto(page)).toHaveAttribute("data-profissional", alvo.user_id);
    await expect(page).toHaveURL(new RegExp(`profissional=${alvo.user_id}`));
    expect(await page.evaluate(() => (window as unknown as { __semRecarga?: boolean }).__semRecarga)).toBe(true);
    await foto(page, "2-trocou-sem-recarregar");
  }

  // Deixa o atendente (dono da jornada do seed) em contexto para os passos seguintes.
  if ((await contexto(page).getAttribute("data-profissional")) !== agente) {
    await page.getByTestId("trocar-profissional").click();
    await page.getByTestId(`opcao-profissional-${agente}`).click();
    await expect(contexto(page)).toHaveAttribute("data-profissional", agente);
  }

  // ── 3. F5 mantém; sair e voltar sem parâmetro restaura o último ───────────
  await page.reload();
  await expect(contexto(page)).toHaveAttribute("data-profissional", agente, { timeout: 20_000 });
  await page.goto("/app");
  await page.goto("/app/agenda");
  await expect(contexto(page)).toHaveAttribute("data-profissional", agente, { timeout: 20_000 });

  // ── 4. horário livre → painel com o profissional fixo e o horário escolhido ─
  const seletorDeTipo = page.getByTestId("tipo-da-grade");
  if ((await seletorDeTipo.count()) > 0 && creds.agenda) {
    await seletorDeTipo.getByRole("button", { name: new RegExp(`^${creds.agenda.tipo_nome}$`) }).click();
  }
  await irParaASemanaSeguinte(page);
  const livre = page.locator('[data-testid^="bloco-"][data-livre="true"]').first();
  await expect(livre, "a semana seguinte do atendente tem horário livre").toBeAttached({ timeout: 25_000 });
  const testid = (await livre.getAttribute("data-testid")) ?? "";
  const hora = /-(\d{2}:\d{2})$/.exec(testid)?.[1];
  await livre.click();
  await expect(page.getByTestId("profissional-do-contexto")).toContainText(doAgente!.nome);
  await expect(page.getByTestId("clinic-profissional")).toHaveCount(0);
  if (hora) await expect(page.getByRole("dialog")).toContainText(hora);
  await foto(page, "4-painel-com-profissional-fixo");
});
