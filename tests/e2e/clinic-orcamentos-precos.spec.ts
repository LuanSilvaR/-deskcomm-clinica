/**
 * FORK clinic (orçamento O1, migration 8006) — a tabela de preços, PELA TELA:
 *
 *   1. desligada, a tela avisa e não oferece publicar;
 *   2. ligar em Configurações › Profissionais;
 *   3. publicar o preço avulso e o pacote de um procedimento;
 *   4. mudar o preço: o novo vale e o antigo aparece no histórico;
 *   5. tirar o pacote da tabela.
 * Dados fictícios. Desliga a opção no fim se estava desligada.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "orcamentos");

interface Creds {
  password: string;
  users: Record<string, { email: string; id?: string } | undefined>;
}
const creds = JSON.parse(fs.readFileSync(path.join(RAIZ, ".e2e-creds.json"), "utf8")) as Creds;

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

async function opcao(page: Page, ligar: boolean): Promise<boolean> {
  await page.goto("/app/settings/tenant/profissionais");
  const bloco = page.getByRole("main").getByTestId("clinic-orcamentos");
  await expect(bloco).toBeVisible({ timeout: 20_000 });
  const estava = await bloco.getByText("Orçamentos ligados").isVisible();
  if (estava !== ligar) {
    await bloco.getByTestId("clinic-orcamentos-alternar").click();
    await expect(bloco.getByText(ligar ? "Orçamentos ligados" : "Orçamentos desligados")).toBeVisible({ timeout: 20_000 });
  }
  return estava;
}

test("tabela de preços: avulso, pacote, mudança com histórico e saída da tabela — pela tela", async ({ page }) => {
  test.setTimeout(240_000);
  await loginComoAdmin(page, creds as unknown as CredsE2E);
  const estava = await opcao(page, false);

  const sufixo = Date.now().toString().slice(-6);
  const nome = `Limpeza E2E ${sufixo}`;
  const criado = await page.request.post("/api/v1/clinic/procedimentos", {
    data: { name: nome, short_description: "Procedimento fictício de teste" },
  });
  expect(criado.status(), await criado.text()).toBe(201);

  try {
    // ── 1. desligada ─────────────────────────────────────────────────────
    await page.goto("/app/settings/tenant/precos");
    const m = page.getByRole("main");
    await expect(m.getByTestId("precos-desligado")).toBeVisible({ timeout: 20_000 });
    await expect(m.getByTestId("precos-novo")).toHaveCount(0);

    // ── 2. ligar ─────────────────────────────────────────────────────────
    await opcao(page, true);
    await page.goto("/app/settings/tenant/precos");
    const novo = m.getByTestId("precos-novo");
    await expect(novo).toBeVisible({ timeout: 20_000 });

    // ── 3. avulso e pacote ───────────────────────────────────────────────
    const item = m.getByTestId("precos-item").filter({ hasText: nome });
    await novo.getByLabel("Procedimento ou serviço").selectOption({ label: nome });
    await novo.getByLabel("Preço (R$)").fill("150,00");
    await novo.getByTestId("precos-adicionar").click();
    await expect(item.filter({ hasText: "avulso" })).toContainText(/R\$\s150,00/, { timeout: 20_000 });

    await novo.getByLabel("Procedimento ou serviço").selectOption({ label: nome });
    await novo.getByLabel("Sessões").fill("10");
    await novo.getByLabel("Preço (R$)").fill("1.200,00");
    await novo.getByLabel("Descrição (opcional)").fill("Pacote 10 sessões");
    await novo.getByTestId("precos-adicionar").click();
    const pacote = item.filter({ hasText: "10 sessões" });
    await expect(pacote).toContainText(/R\$\s1\.200,00/, { timeout: 20_000 });
    await expect(pacote).toContainText(/R\$\s120,00 por sessão/);
    await foto(page, "1-avulso-e-pacote");

    // ── 4. mudar o preço avulso ──────────────────────────────────────────
    const avulso = item.filter({ hasText: "avulso" });
    await avulso.getByRole("button", { name: "Mudar preço" }).click();
    await avulso.getByLabel("Novo preço (R$)").fill("180,00");
    await avulso.getByRole("button", { name: "Publicar novo preço" }).click();
    await expect(avulso.getByTestId("precos-valor")).toHaveText(/R\$\s180,00/, { timeout: 20_000 });
    await avulso.getByRole("button", { name: "Histórico" }).click();
    await expect(avulso).toContainText(/R\$\s150,00/);
    await foto(page, "2-historico");

    // ── 5. tirar o pacote da tabela ──────────────────────────────────────
    await pacote.getByRole("button", { name: "Tirar da tabela" }).click();
    await expect(item.filter({ hasText: "10 sessões" })).toHaveCount(0, { timeout: 20_000 });
    await expect(item.filter({ hasText: "avulso" })).toHaveCount(1);
    await foto(page, "3-pacote-fora");
  } finally {
    if (!estava) await opcao(page, false);
  }
});
