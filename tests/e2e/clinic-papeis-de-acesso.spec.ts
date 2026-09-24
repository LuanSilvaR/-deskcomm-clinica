/**
 * FORK clinic (ACL-015) — papéis de acesso, PELA TELA:
 *
 *   1. o admin abre Configurações › Papéis de acesso pelo hub;
 *   2. cria "Recepcionista" pela matriz: marcar "Marcar compromisso" marca
 *      junto "Ver a agenda" (dependência) e avisa;
 *   3. dá o papel ao usuário visualizador (no lugar do Visualizador) e liga o modo;
 *   4. o usuário entra: o Financeiro some do hub de Análise; a tela de papéis
 *      diz "Acesso não autorizado"; a API de papéis responde 403; as permissões
 *      efetivas são exatamente as do papel;
 *   5. REVOGAÇÃO: o admin (outra sessão) tira "Bloquear horários" do papel e a
 *      próxima requisição do usuário já recebe 403 — nada no JWT, sem cache;
 *   6. desfaz na ordem certa (papel de volta, modo desligado, papel excluído) —
 *      o nível legado do usuário volta a viewer;
 *   7. o papel Administrador não pode ser excluído (antitravamento).
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Browser, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "papeis-de-acesso");

interface Creds {
  password: string;
  users: Record<string, { email: string; id?: string } | undefined>;
}
const creds = JSON.parse(fs.readFileSync(path.join(RAIZ, ".e2e-creds.json"), "utf8")) as Creds;

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

async function entrarComo(page: Page, email: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(creds.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/app(?:\/|$)/, { timeout: 60_000 });
}

async function modo(page: Page, ligar: boolean): Promise<void> {
  await page.goto("/app/settings/tenant/papeis");
  const bloco = page.getByRole("main").getByTestId("acesso-modo");
  await expect(bloco).toBeVisible({ timeout: 20_000 });
  const ligado = await bloco.getByText("Acesso pelos papéis desta tela").isVisible();
  if (ligado !== ligar) {
    await bloco.getByTestId("acesso-modo-alternar").click();
    await expect(bloco.getByText(ligar ? "Acesso pelos papéis desta tela" : "Acesso pelo papel de sempre")).toBeVisible({ timeout: 20_000 });
  }
}

async function papeisDoMembro(page: Page, userId: string, marcar: string[], desmarcar: string[]): Promise<void> {
  await page.goto("/app/settings/tenant/papeis");
  await page.getByRole("tab", { name: "Membros" }).click();
  const linha = page.locator(`[data-testid="membro-linha"][data-user="${userId}"]`);
  await expect(linha).toBeVisible({ timeout: 20_000 });
  for (const n of desmarcar) await linha.getByTestId(`membro-papel-${n}`).uncheck();
  for (const n of marcar) await linha.getByTestId(`membro-papel-${n}`).check();
  const salvou = page.waitForResponse((r) => r.url().includes(`/api/v1/clinic/acesso/membros/${userId}/papeis`) && r.request().method() === "PUT");
  await linha.getByTestId("membro-salvar").click();
  expect((await salvou).status()).toBe(200);
}

async function comoAdmin<T>(browser: Browser, fn: (page: Page) => Promise<T>): Promise<T> {
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    await loginComoAdmin(page, creds as unknown as CredsE2E);
    return await fn(page);
  } finally {
    await ctx.close();
  }
}

test("papéis de acesso: Recepcionista criada pela tela vale para o usuário — pela tela", async ({ page, browser }) => {
  test.setTimeout(300_000);
  const visualizador = creds.users.viewer;
  if (!visualizador?.id) throw new Error(".e2e-creds.json sem viewer");
  const nome = `Recepcionista E2E${Date.now().toString().slice(-6)}`;
  await loginComoAdmin(page, creds as unknown as CredsE2E);
  await modo(page, false);

  // ── 1. a porta pelo hub de Configurações ────────────────────────────────
  await page.goto("/app/settings");
  await page.locator('a[href="/app/settings/tenant/papeis"]').first().click();
  await expect(page).toHaveURL(/\/app\/settings\/tenant\/papeis/);

  // ── 2. cria Recepcionista pela matriz ───────────────────────────────────
  await page.getByTestId("papel-novo").click();
  const editor = page.getByTestId("editor-de-papel");
  await editor.getByTestId("papel-nome").fill(nome);
  await editor.getByTestId("perm-agenda.marcar").check();
  await expect(editor.getByTestId("perm-agenda.ver")).toBeChecked();
  await expect(editor.getByTestId("aviso-de-dependencia")).toContainText("Ver a agenda");
  await editor.getByTestId("perm-pacientes.criar").check();
  await expect(editor.getByTestId("perm-pacientes.ver")).toBeChecked();
  await editor.getByTestId("perm-agenda.bloquear_horario").check();
  await foto(page, "01-matriz-recepcionista");
  const criou = page.waitForResponse((r) => r.url().endsWith("/api/v1/clinic/acesso/papeis") && r.request().method() === "POST");
  await editor.getByTestId("papel-salvar").click();
  expect((await criou).status()).toBe(201);
  const linha = page.locator(`[data-testid="papel-linha"][data-nome="${nome}"]`);
  await expect(linha).toContainText("5 permissões");

  // ── 3. dá o papel ao visualizador e liga o modo ─────────────────────────
  await papeisDoMembro(page, visualizador.id, [nome], ["Visualizador"]);
  await modo(page, true);
  await foto(page, "02-modo-ligado");

  try {
    // ── 4. o usuário entra ────────────────────────────────────────────────
    await entrarComo(page, visualizador.email);
    const eu = (await (await page.request.get("/api/v1/clinic/acesso/eu")).json()) as { data: { permissoes: string[]; modo_ligado: boolean } };
    expect(eu.data.modo_ligado).toBe(true);
    expect(eu.data.permissoes).toEqual(["agenda.bloquear_horario", "agenda.marcar", "agenda.ver", "pacientes.criar", "pacientes.ver"]);

    await page.goto("/app/analise");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator('a[href="/app/faturamento"]')).toHaveCount(0);
    await foto(page, "03-analise-sem-financeiro");

    await page.goto("/app/settings/tenant/papeis");
    await expect(page.getByTestId("acesso-nao-autorizado")).toBeVisible({ timeout: 20_000 });
    await foto(page, "04-papeis-acesso-nao-autorizado");
    const api = await page.request.get("/api/v1/clinic/acesso/papeis");
    expect(api.status()).toBe(403);
    expect(((await api.json()) as { error: { code: string } }).error.code).toBe("forbidden_permission");

    // ── 5. revogação vale na próxima requisição ──────────────────────────
    // Corpo vazio: com a permissão a rota recusa o CORPO (422); sem, recusa o ACESSO (403).
    const bloquear = () => page.request.post("/api/v1/clinic/bloqueios", { data: {} });
    expect((await bloquear()).status()).toBe(422);
    await comoAdmin(browser, async (admin) => {
      await admin.goto("/app/settings/tenant/papeis");
      await admin.locator(`[data-testid="papel-linha"][data-nome="${nome}"]`).getByTestId("papel-editar").click();
      const ed = admin.getByTestId("editor-de-papel");
      await ed.getByTestId("perm-agenda.bloquear_horario").uncheck();
      const salvou = admin.waitForResponse((r) => r.url().includes("/api/v1/clinic/acesso/papeis/") && r.request().method() === "PATCH");
      await ed.getByTestId("papel-salvar").click();
      expect((await salvou).status()).toBe(200);
    });
    const negado = await bloquear();
    expect(negado.status()).toBe(403);
    expect(((await negado.json()) as { error: { details?: { permissao?: string } } }).error.details?.permissao).toBe("agenda.bloquear_horario");
  } finally {
    // ── 6. desfaz na ordem certa ─────────────────────────────────────────
    await loginComoAdmin(page, creds as unknown as CredsE2E);
    await papeisDoMembro(page, visualizador.id, ["Visualizador"], [nome]);
    await modo(page, false);
    await page.goto("/app/settings/tenant/papeis");
    const excluiu = page.waitForResponse((r) => r.url().includes("/api/v1/clinic/acesso/papeis/") && r.request().method() === "DELETE");
    await page.locator(`[data-testid="papel-linha"][data-nome="${nome}"]`).getByTestId("papel-excluir").click();
    expect((await excluiu).status()).toBe(200);
  }

  // o nível legado do visualizador voltou a viewer
  const membros = (await (await page.request.get("/api/v1/clinic/acesso/membros")).json()) as {
    data: { user_id: string; nivel_legado: string }[];
  };
  expect(membros.data.find((m) => m.user_id === visualizador.id)?.nivel_legado).toBe("viewer");

  // ── 7. o Administrador não sai (antitravamento no banco) ───────────────
  const papeis = (await (await page.request.get("/api/v1/clinic/acesso/papeis")).json()) as {
    data: { id: string; system_key: string | null }[];
  };
  const administrador = papeis.data.find((p) => p.system_key === "administrador");
  if (!administrador) throw new Error("papel Administrador ausente");
  const recusa = await page.request.delete(`/api/v1/clinic/acesso/papeis/${administrador.id}`);
  expect(recusa.status()).toBe(422);
  expect(((await recusa.json()) as { error: { code: string } }).error.code).toBe("acesso_papel_de_sistema");
});
