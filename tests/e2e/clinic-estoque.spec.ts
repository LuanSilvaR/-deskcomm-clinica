/**
 * FORK clinic (estoque E0, migration 9028) — o estoque, PELA TELA:
 *
 *   1. ligar em Configurações › Profissionais cria o local "Estoque central";
 *   2. configurar o produto (frasco = 100 U, rastreado) e dar entrada de 2
 *      frascos com lote e validade → saldo 200 U;
 *   3. criar o local "Sala E2E", transferir 50 U e registrar perda de 5 U;
 *   4. transferir mais do que tem é recusado (saldo nunca negativo);
 *   5. Movimentações: estornar a perda devolve o saldo; o estorno não se estorna.
 * Dados fictícios. Desliga o estoque no fim se estava desligado.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "estoque");

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
  const bloco = page.getByRole("main").getByTestId("clinic-estoque");
  await expect(bloco).toBeVisible({ timeout: 20_000 });
  const estava = await bloco.getByText("Estoque ligado").isVisible();
  if (estava !== ligar) {
    await bloco.getByTestId("clinic-estoque-alternar").click();
    await expect(bloco.getByText(ligar ? "Estoque ligado" : "Estoque desligado")).toBeVisible({ timeout: 20_000 });
  }
  return estava;
}

test("estoque: entrada com lote, transferência, perda e estorno — pela tela", async ({ page }) => {
  test.setTimeout(300_000);
  page.on("dialog", (d) => void d.accept("Lançamento de teste errado"));
  await loginComoAdmin(page, creds as unknown as CredsE2E);
  const estava = await opcao(page, true);

  const sufixo = Date.now().toString().slice(-6);
  const nome = `Toxina E2E ${sufixo}`;
  const criado = await page.request.post("/api/v1/products", {
    data: { codigo: `TOX-E2E-${sufixo}`, nome, preco_cents: 0 },
  });
  expect(criado.status(), await criado.text()).toBe(201);

  try {
    await page.goto("/app/estoque");
    const m = page.getByRole("main");
    await expect(m.getByTestId("painel-do-estoque")).toBeVisible({ timeout: 20_000 });

    // ── 2. configurar e dar entrada ──────────────────────────────────────
    await m.getByPlaceholder("Buscar produto por nome ou código").fill(nome);
    const produto = m.getByTestId("estoque-produto").filter({ hasText: nome });
    await produto.getByRole("button", { name: new RegExp(nome) }).click();
    await produto.getByTestId("estoque-configurar").click();
    const cfg = produto.getByTestId("estoque-form-config");
    await cfg.getByLabel("Unidade de compra/estoque").fill("frasco");
    await cfg.getByLabel("Unidade de aplicação").fill("U");
    await cfg.getByLabel("Quantas unidades de aplicação em 1 de estoque").fill("100");
    await cfg.getByText("Rastreado por lote").click();
    await cfg.getByTestId("estoque-config-salvar").click();
    await expect(cfg).toHaveCount(0, { timeout: 20_000 });

    await produto.getByTestId("estoque-dar-entrada").click();
    const ent = produto.getByTestId("estoque-form-entrada");
    await ent.getByTestId("estoque-entrada-qtd").fill("2");
    await ent.getByTestId("estoque-entrada-lote").fill(`L-E2E-${sufixo}`);
    await ent.getByLabel("Validade (obrigatória)").fill("2099-12-31");
    await ent.getByTestId("estoque-entrada-salvar").click();
    await expect(produto.getByTestId("estoque-saldo")).toContainText("200", { timeout: 20_000 });
    await foto(page, "1-entrada");

    // ── 3. novo local, transferência e perda ─────────────────────────────
    await m.getByTestId("estoque-aba-locais").click();
    await m.getByTestId("estoque-local-nome").fill(`Sala E2E ${sufixo}`);
    await m.getByTestId("estoque-local-criar").click();
    await expect(m.getByTestId("estoque-locais")).toContainText(`Sala E2E ${sufixo}`, { timeout: 20_000 });

    await m.getByTestId("estoque-aba-posicao").click();
    await m.getByPlaceholder("Buscar produto por nome ou código").fill(nome);
    await produto.getByRole("button", { name: new RegExp(nome) }).click();
    await produto.getByTestId("estoque-lotes").getByRole("button", { name: "Transferir" }).first().click();
    const tr = produto.getByTestId("estoque-form-transferencia");
    await tr.getByLabel("Para").selectOption({ label: `Sala E2E ${sufixo}` });
    await tr.getByTestId("estoque-transferencia-qtd").fill("50");
    await tr.getByTestId("estoque-transferencia-salvar").click();
    await expect(produto.getByTestId("estoque-lotes")).toContainText(`Sala E2E ${sufixo}`, { timeout: 20_000 });

    const linhaSala = produto.getByTestId("estoque-lotes").getByRole("row").filter({ hasText: `Sala E2E ${sufixo}` });
    await linhaSala.getByRole("button", { name: "Perda" }).click();
    const pe = produto.getByTestId("estoque-form-perda");
    await pe.getByTestId("estoque-perda-qtd").fill("5");
    await pe.getByLabel("Motivo (obrigatório)").fill("Frasco quebrado");
    await pe.getByTestId("estoque-perda-salvar").click();
    await expect(produto.getByTestId("estoque-saldo")).toContainText("195", { timeout: 20_000 });

    // ── 4. saldo nunca negativo ──────────────────────────────────────────
    await linhaSala.getByRole("button", { name: "Transferir" }).click();
    const tr2 = produto.getByTestId("estoque-form-transferencia");
    await tr2.getByTestId("estoque-transferencia-qtd").fill("999");
    await tr2.getByTestId("estoque-transferencia-salvar").click();
    await expect(page.getByText("Saldo insuficiente nesse lote e local. Nada foi alterado.")).toBeVisible({ timeout: 20_000 });
    await expect(produto.getByTestId("estoque-saldo")).toContainText("195");
    await foto(page, "2-posicao");

    // ── 5. estorno ───────────────────────────────────────────────────────
    await m.getByTestId("estoque-aba-movimentacoes").click();
    const perda = m.getByTestId("estoque-operacao").filter({ hasText: "Perda" }).first();
    await perda.getByTestId("estoque-estornar").click();
    await expect(perda).toContainText("estornada", { timeout: 20_000 });
    const estorno = m.getByTestId("estoque-operacao").filter({ hasText: "Estorno" }).first();
    await expect(estorno.getByTestId("estoque-estornar")).toHaveCount(0);
    await foto(page, "3-movimentacoes");

    await m.getByTestId("estoque-aba-posicao").click();
    await m.getByPlaceholder("Buscar produto por nome ou código").fill(nome);
    await expect(m.getByTestId("estoque-produto").filter({ hasText: nome }).getByTestId("estoque-saldo")).toContainText("200", {
      timeout: 20_000,
    });
  } finally {
    if (!estava) await opcao(page, false);
  }
});
