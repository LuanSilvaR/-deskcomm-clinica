/**
 * FORK clinic (estoque E3, migration 9031) — o kit do procedimento, PELA TELA:
 *
 *   1. procedimento e produto de estoque fictícios (pela API);
 *   2. aba Kit do procedimento: adicionar o produto com 20 U e salvar;
 *   3. reabrir mostra o kit salvo (e a API devolve o mesmo).
 * A reserva e o disponível são provados no banco
 * (tests/invariants/clinic-estoque-kits-reservas.test.ts).
 * Dados fictícios. Desliga o estoque no fim se estava desligado.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "estoque-kit");

const creds = JSON.parse(fs.readFileSync(path.join(RAIZ, ".e2e-creds.json"), "utf8")) as CredsE2E;

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

async function opcao(page: Page, ligar: boolean): Promise<boolean> {
  await page.goto("/app/settings/tenant/profissionais");
  const bloco = page.getByRole("main").getByTestId("clinic-estoque");
  await expect(bloco).toBeVisible({ timeout: 20_000 });
  const estava = await bloco.getByText("Estoque ligado").isVisible();
  if (estava !== ligar) {
    await bloco.getByTestId("clinic-estoque-alternar").click();
    await expect(bloco.getByText(ligar ? "Estoque ligado" : "Estoque desligado")).toBeVisible({ timeout: 20_000 });
  }
  return estava;
}

test("estoque: kit do procedimento — pela tela", async ({ page }) => {
  test.setTimeout(240_000);
  await loginComoAdmin(page, creds);
  const estava = await opcao(page, true);
  const sufixo = Date.now().toString().slice(-6);
  const nomeProduto = `Toxina kit E2E ${sufixo}`;

  try {
    const prod = await page.request.post("/api/v1/products", {
      data: { codigo: `KIT-E2E-${sufixo}`, nome: nomeProduto, preco_cents: 0 },
    });
    expect(prod.status(), await prod.text()).toBe(201);
    const productId = ((await prod.json()) as { data: { id: string } }).data.id;
    const cfg = await page.request.put(`/api/v1/clinic/estoque/produtos/${productId}`, {
      data: {
        unidade_estoque: "frasco",
        unidade_aplicacao: "U",
        fator_conversao: 100,
        fracionavel: true,
        rastreado: false,
        controlado: false,
        conselhos_permitidos: [],
        estoque_minimo: 0,
        gerenciado: true,
      },
    });
    expect(cfg.status(), await cfg.text()).toBe(200);
    const proc = await page.request.post("/api/v1/clinic/procedimentos", {
      data: { name: `Toxina E2E ${sufixo}`, short_description: "Procedimento fictício de teste" },
    });
    expect(proc.status(), await proc.text()).toBe(201);
    const procId = ((await proc.json()) as { data: { id: string } }).data.id;

    // ── a aba Kit ───────────────────────────────────────────────────────────
    await page.goto(`/app/procedimentos/${procId}`);
    const m = page.getByRole("main");
    await m.getByTestId("proc-aba-kit").click();
    const kit = m.getByTestId("kit-do-procedimento");
    await expect(kit.getByText("Nenhum item no kit.")).toBeVisible({ timeout: 20_000 });
    await kit.getByTestId("kit-adicionar").click();
    await kit.getByTestId("kit-produto").selectOption({ label: nomeProduto });
    await kit.getByTestId("kit-quantidade").fill("20");
    await expect(kit.getByTestId("kit-item")).toContainText("U");
    await kit.getByTestId("kit-salvar").click();
    await expect(kit.getByText("Kit salvo.")).toBeVisible({ timeout: 20_000 });
    await foto(page, "1-kit");

    await page.reload();
    await m.getByTestId("proc-aba-kit").click();
    await expect(m.getByTestId("kit-quantidade")).toHaveValue("20", { timeout: 20_000 });
    const lido = await page.request.get(`/api/v1/clinic/procedimentos/${procId}/kit`);
    expect(lido.status()).toBe(200);
    const corpo = (await lido.json()) as { data: { itens: Array<{ product_id: string; quantidade: number; unidade: string }> } };
    expect(corpo.data.itens).toEqual([{ product_id: productId, quantidade: 20, unidade: "U" }]);
  } finally {
    if (!estava) await opcao(page, false);
  }
});
