/**
 * FORK clinic (estoque E7, migration 9035) — alertas do estoque, PELA TELA:
 *
 *   1. produto com mínimo 20 e só 5 no estoque (pela API);
 *   2. a varredura roda (a MESMA rota do cron, com o segredo interno);
 *   3. aba Alertas: "Abaixo do mínimo" do produto, com o contador na aba;
 *   4. "Dispensar" com motivo: o alerta some.
 * Dados fictícios. Desliga o estoque no fim se estava desligado.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { carregarEnvLocal } from "../../scripts/lib/env-de-teste";
import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "estoque-alertas");

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

test("estoque: alerta de mínimo aparece e é dispensado — pela tela", async ({ page }) => {
  test.setTimeout(240_000);
  page.on("dialog", (d) => void d.accept("Compra já encomendada"));
  await loginComoAdmin(page, creds);
  const estava = await opcao(page, true);
  const sufixo = Date.now().toString().slice(-6);
  const nome = `Gaze alerta E2E ${sufixo}`;

  try {
    const prod = await page.request.post("/api/v1/products", {
      data: { codigo: `AL-E2E-${sufixo}`, nome, preco_cents: 0 },
    });
    expect(prod.status(), await prod.text()).toBe(201);
    const productId = ((await prod.json()) as { data: { id: string } }).data.id;
    const cfg = await page.request.put(`/api/v1/clinic/estoque/produtos/${productId}`, {
      data: {
        unidade_estoque: "un",
        unidade_aplicacao: "un",
        fator_conversao: 1,
        fracionavel: false,
        rastreado: false,
        controlado: false,
        conselhos_permitidos: [],
        estoque_minimo: 20,
        gerenciado: true,
      },
    });
    expect(cfg.status(), await cfg.text()).toBe(200);
    const posicao = (await (await page.request.get("/api/v1/clinic/estoque/posicao")).json()) as {
      data: { locais: Array<{ id: string; padrao: boolean }> };
    };
    const local = posicao.data.locais.find((l) => l.padrao)!.id;
    const ent = await page.request.post("/api/v1/clinic/estoque/movimentos", {
      data: { acao: "entrada", product_id: productId, local_id: local, quantidade: 5 },
    });
    expect(ent.status(), await ent.text()).toBe(200);

    const secret = carregarEnvLocal().INTERNAL_SECRET?.trim();
    if (!secret) throw new Error("INTERNAL_SECRET não encontrado no ambiente");
    const cron = await page.request.post("/api/v1/cron/estoque-alertas", { headers: { authorization: `Bearer ${secret}` } });
    expect(cron.status(), await cron.text()).toBe(200);

    await page.goto("/app/estoque");
    const m = page.getByRole("main");
    await expect(m.getByTestId("estoque-alertas-contador")).toBeVisible({ timeout: 20_000 });
    await m.getByTestId("estoque-aba-alertas").click();
    const alerta = m.getByTestId("estoque-alerta").filter({ hasText: nome });
    await expect(alerta).toContainText("Abaixo do mínimo", { timeout: 20_000 });
    await foto(page, "1-alerta");
    await alerta.getByTestId("estoque-alerta-dispensar").click();
    await expect(m.getByTestId("estoque-alerta").filter({ hasText: nome })).toHaveCount(0, { timeout: 20_000 });
    await foto(page, "2-dispensado");
  } finally {
    if (!estava) await opcao(page, false);
  }
});
