/**
 * FORK clinic (estoque E4, migration 9032) — frascos abertos, PELA TELA:
 *
 *   1. produto fracionável (frasco = 100 U) com 2 frascos lacrados (pela API);
 *   2. "Abrir frasco" na linha do lote: aparece em Frascos abertos com 100 U e
 *      o saldo continua 200 U;
 *   3. "Encerrar" com motivo: a sobra vira perda → saldo 100 U, sem frascos.
 * A baixa pelo prontuário usando o frasco é provada no banco
 * (tests/invariants/clinic-estoque-frascos.test.ts).
 * Dados fictícios. Desliga o estoque no fim se estava desligado.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "estoque-frascos");

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

test("estoque: abrir e encerrar frasco — pela tela", async ({ page }) => {
  test.setTimeout(240_000);
  page.on("dialog", (d) => void d.accept("Frasco descartado no teste"));
  await loginComoAdmin(page, creds);
  const estava = await opcao(page, true);
  const sufixo = Date.now().toString().slice(-6);
  const nome = `Toxina frasco E2E ${sufixo}`;

  try {
    const prod = await page.request.post("/api/v1/products", {
      data: { codigo: `FR-E2E-${sufixo}`, nome, preco_cents: 0 },
    });
    expect(prod.status(), await prod.text()).toBe(201);
    const productId = ((await prod.json()) as { data: { id: string } }).data.id;
    const cfg = await page.request.put(`/api/v1/clinic/estoque/produtos/${productId}`, {
      data: {
        unidade_estoque: "frasco",
        unidade_aplicacao: "U",
        fator_conversao: 100,
        fracionavel: true,
        validade_pos_abertura_horas: 24,
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
      data: {
        acao: "entrada",
        product_id: productId,
        local_id: local,
        quantidade: 2,
        em_unidade_estoque: true,
        lote: `FR-${sufixo}`,
        validade: "2099-12-31",
      },
    });
    expect(ent.status(), await ent.text()).toBe(200);

    await page.goto("/app/estoque");
    const m = page.getByRole("main");
    await expect(m.getByTestId("painel-do-estoque")).toBeVisible({ timeout: 20_000 });
    await m.getByPlaceholder("Buscar produto por nome ou código").fill(nome);
    const produto = m.getByTestId("estoque-produto").filter({ hasText: nome });
    await produto.getByRole("button", { name: new RegExp(nome) }).click();

    // ── abrir ───────────────────────────────────────────────────────────────
    await produto.getByTestId("estoque-abrir-frasco").first().click();
    const frasco = produto.getByTestId("estoque-frasco");
    await expect(frasco).toHaveCount(1, { timeout: 20_000 });
    await expect(frasco).toContainText("100");
    await expect(produto.getByTestId("estoque-saldo")).toContainText("200");
    await foto(page, "1-aberto");

    // ── encerrar ────────────────────────────────────────────────────────────
    await frasco.getByTestId("estoque-encerrar-frasco").click();
    await expect(produto.getByTestId("estoque-frasco")).toHaveCount(0, { timeout: 20_000 });
    await expect(produto.getByTestId("estoque-saldo")).toContainText("100");
    await foto(page, "2-encerrado");
  } finally {
    if (!estava) await opcao(page, false);
  }
});
