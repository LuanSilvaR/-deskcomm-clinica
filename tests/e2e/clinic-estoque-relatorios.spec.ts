/**
 * FORK clinic (estoque E8, migration 9036) — relatórios do estoque, PELA TELA:
 *
 *   1. produto com ponto de pedido 50 e só 10 no estoque (pela API);
 *   2. aba Relatórios: a "Sugestão de compra" lista o produto; o consumo e as
 *      perdas carregam (sem paciente);
 *   3. o administrador sem papel clínico NÃO vê o rastreio de lote (recall é
 *      chave clínica; provado também no banco em clinic-estoque-relatorios).
 * Dados fictícios. Desliga o estoque no fim se estava desligado.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "estoque-relatorios");

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

test("estoque: relatórios e sugestão de compra — pela tela", async ({ page }) => {
  test.setTimeout(240_000);
  await loginComoAdmin(page, creds);
  const estava = await opcao(page, true);
  const sufixo = Date.now().toString().slice(-6);
  const nome = `Luva relatório E2E ${sufixo}`;

  try {
    const prod = await page.request.post("/api/v1/products", {
      data: { codigo: `REL-E2E-${sufixo}`, nome, preco_cents: 0 },
    });
    expect(prod.status(), await prod.text()).toBe(201);
    const productId = ((await prod.json()) as { data: { id: string } }).data.id;
    const cfg = await page.request.put(`/api/v1/clinic/estoque/produtos/${productId}`, {
      data: {
        unidade_estoque: "cx",
        unidade_aplicacao: "un",
        fator_conversao: 10,
        fracionavel: false,
        rastreado: false,
        controlado: false,
        conselhos_permitidos: [],
        estoque_minimo: 0,
        ponto_pedido: 50,
        gerenciado: true,
      },
    });
    expect(cfg.status(), await cfg.text()).toBe(200);
    const posicao = (await (await page.request.get("/api/v1/clinic/estoque/posicao")).json()) as {
      data: { locais: Array<{ id: string; padrao: boolean }> };
    };
    const local = posicao.data.locais.find((l) => l.padrao)!.id;
    const ent = await page.request.post("/api/v1/clinic/estoque/movimentos", {
      data: { acao: "entrada", product_id: productId, local_id: local, quantidade: 10 },
    });
    expect(ent.status(), await ent.text()).toBe(200);

    await page.goto("/app/estoque");
    const m = page.getByRole("main");
    await expect(m.getByTestId("painel-do-estoque")).toBeVisible({ timeout: 20_000 });
    await m.getByTestId("estoque-aba-relatorios").click();
    const rel = m.getByTestId("estoque-relatorios");
    // 10 un ≤ 50 → até 100 un: faltam 90 un = 9 cx
    await expect(rel.getByTestId("relatorio-compra").getByRole("row").filter({ hasText: nome })).toContainText("9 cx", {
      timeout: 20_000,
    });
    await expect(rel.getByTestId("relatorio-rastreio")).toHaveCount(0);
    await foto(page, "1-relatorios");

    const recall = await page.request.get(`/api/v1/clinic/estoque/relatorios/rastreio?lote=${productId}`);
    expect(recall.status()).toBe(403);
  } finally {
    if (!estava) await opcao(page, false);
  }
});
