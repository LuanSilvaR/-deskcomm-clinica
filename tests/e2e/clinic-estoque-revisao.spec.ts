/**
 * FORK clinic (estoque E10, migration 9038) — correções das revisões, PELA TELA:
 *
 *   1. produto com lote (pela API); na posição, "Bloquear" com motivo: o lote
 *      aparece como bloqueado (fora da FEFO);
 *   2. "Perda" com categoria "Quebra": o relatório de perdas mostra "Quebra".
 * Dados fictícios. Desliga o estoque no fim se estava desligado.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "estoque-revisao");

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

test("estoque: bloquear lote e perda com categoria — pela tela", async ({ page }) => {
  test.setTimeout(240_000);
  await loginComoAdmin(page, creds);
  const estava = await opcao(page, true);
  const sufixo = Date.now().toString().slice(-6);
  const nome = `Agulha revisão E2E ${sufixo}`;

  try {
    const prod = await page.request.post("/api/v1/products", {
      data: { codigo: `REV-E2E-${sufixo}`, nome, preco_cents: 0 },
    });
    expect(prod.status(), await prod.text()).toBe(201);
    const productId = ((await prod.json()) as { data: { id: string } }).data.id;
    const cfg = await page.request.put(`/api/v1/clinic/estoque/produtos/${productId}`, {
      data: {
        unidade_estoque: "un",
        unidade_aplicacao: "un",
        fator_conversao: 1,
        fracionavel: false,
        rastreado: true,
        controlado: false,
        conselhos_permitidos: [],
        estoque_minimo: 0,
        gerenciado: true,
      },
    });
    expect(cfg.status(), await cfg.text()).toBe(200);
    const posicao = (await (await page.request.get("/api/v1/clinic/estoque/posicao")).json()) as {
      data: { locais: Array<{ id: string; padrao: boolean }> };
    };
    const local = posicao.data.locais.find((l) => l.padrao)!.id;
    const ent = await page.request.post("/api/v1/clinic/estoque/movimentos", {
      data: { acao: "entrada", product_id: productId, local_id: local, quantidade: 10, lote: `rev-${sufixo}`, validade: "2099-12-31" },
    });
    expect(ent.status(), await ent.text()).toBe(200);

    await page.goto("/app/estoque");
    const m = page.getByRole("main");
    await expect(m.getByTestId("painel-do-estoque")).toBeVisible({ timeout: 20_000 });
    await m.getByPlaceholder("Buscar produto por nome ou código").fill(nome);
    const produto = m.getByTestId("estoque-produto").filter({ hasText: nome });
    await produto.getByRole("button", { name: new RegExp(nome) }).click();
    // o código do lote foi normalizado
    await expect(produto.getByTestId("estoque-lotes")).toContainText(`REV-${sufixo}`);

    // ── bloquear ────────────────────────────────────────────────────────────
    await produto.getByTestId("estoque-lote-bloquear").first().click();
    await produto.getByTestId("estoque-bloqueio-motivo").fill("Recall fictício do fabricante");
    await produto.getByTestId("estoque-bloqueio-salvar").click();
    await expect(produto.getByTestId("estoque-lote-bloqueado")).toBeVisible({ timeout: 20_000 });
    await foto(page, "1-bloqueado");

    // ── perda com categoria ─────────────────────────────────────────────────
    await produto.getByRole("button", { name: "Perda" }).first().click();
    const form = produto.getByTestId("estoque-form-perda");
    await form.getByTestId("estoque-perda-qtd").fill("2");
    await form.getByTestId("estoque-perda-categoria").selectOption("quebra");
    await form.getByRole("textbox").last().fill("Caiu no chão");
    await form.getByTestId("estoque-perda-salvar").click();
    await expect(form).toHaveCount(0, { timeout: 20_000 });

    await m.getByTestId("estoque-aba-relatorios").click();
    const perdas = m.getByTestId("relatorio-perdas").getByRole("row").filter({ hasText: nome });
    await expect(perdas).toContainText("Quebra", { timeout: 20_000 });
    await foto(page, "2-perda-categoria");
  } finally {
    if (!estava) await opcao(page, false);
  }
});
