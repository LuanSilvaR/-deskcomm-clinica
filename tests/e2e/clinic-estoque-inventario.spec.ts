/**
 * FORK clinic (estoque E6, migration 9034) — inventário, PELA TELA:
 *
 *   1. produto com 10 un no estoque central (pela API);
 *   2. Estoque › Inventário: abrir no local, contar 7 no lote do produto;
 *   3. "Fechar e acertar o estoque" com motivo → Fechado; Posição mostra 7.
 * Dados fictícios. Desliga o estoque no fim se estava desligado. Só o lote do
 * produto da spec é contado (os demais lotes ficam como estão).
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "estoque-inventario");

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

test("estoque: inventário por local — pela tela", async ({ page }) => {
  test.setTimeout(240_000);
  page.on("dialog", (d) => void d.accept("Contagem E2E"));
  await loginComoAdmin(page, creds);
  const estava = await opcao(page, true);
  const sufixo = Date.now().toString().slice(-6);
  const nome = `Gaze inventário E2E ${sufixo}`;

  try {
    const prod = await page.request.post("/api/v1/products", {
      data: { codigo: `INV-E2E-${sufixo}`, nome, preco_cents: 0 },
    });
    expect(prod.status(), await prod.text()).toBe(201);
    const productId = ((await prod.json()) as { data: { id: string } }).data.id;
    const posicao = (await (await page.request.get("/api/v1/clinic/estoque/posicao")).json()) as {
      data: { locais: Array<{ id: string; padrao: boolean }> };
    };
    const local = posicao.data.locais.find((l) => l.padrao)!.id;
    const ent = await page.request.post("/api/v1/clinic/estoque/movimentos", {
      data: { acao: "entrada", product_id: productId, local_id: local, quantidade: 10 },
    });
    expect(ent.status(), await ent.text()).toBe(200);
    // um inventário aberto de outra rodada impediria abrir: cancela antes
    const lista = (await (await page.request.get("/api/v1/clinic/estoque/inventarios")).json()) as {
      data: { inventarios: Array<{ id: string; local_id: string; status: string }> };
    };
    for (const i of lista.data.inventarios.filter((x) => x.status === "aberto" && x.local_id === local)) {
      await page.request.post(`/api/v1/clinic/estoque/inventarios/${i.id}/cancelar`, { data: {} });
    }

    await page.goto("/app/estoque");
    const m = page.getByRole("main");
    await expect(m.getByTestId("painel-do-estoque")).toBeVisible({ timeout: 20_000 });
    await m.getByTestId("estoque-aba-inventario").click();
    await m.getByTestId("inventario-local").selectOption(local);
    await m.getByTestId("inventario-abrir").click();
    const detalhe = m.getByTestId("inventario-detalhe");
    await expect(detalhe).toBeVisible({ timeout: 20_000 });
    const linha = detalhe.getByTestId("inventario-item").filter({ hasText: nome });
    await linha.getByTestId("inventario-contado").fill("7");
    await linha.getByTestId("inventario-contado").blur();
    await expect(linha).toContainText("-3", { timeout: 20_000 });
    await foto(page, "1-contagem");
    await detalhe.getByTestId("inventario-fechar").click();
    await expect(detalhe).toContainText("Fechado", { timeout: 20_000 });
    await foto(page, "2-fechado");

    await m.getByTestId("inventario-voltar").click();
    await m.getByTestId("estoque-aba-posicao").click();
    await m.getByPlaceholder("Buscar produto por nome ou código").fill(nome);
    await expect(m.getByTestId("estoque-produto").filter({ hasText: nome }).getByTestId("estoque-saldo")).toContainText("7", {
      timeout: 20_000,
    });
  } finally {
    if (!estava) await opcao(page, false);
  }
});
