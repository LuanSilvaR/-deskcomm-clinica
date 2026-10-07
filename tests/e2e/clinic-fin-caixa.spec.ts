/**
 * FORK clinic (financeiro FN3, migration 9041) — o caixa do dia, PELA TELA:
 * abrir a gaveta com R$ 100 de fundo, registrar sangria de R$ 30, fechar
 * contando R$ 70 (sem diferença → encerra direto) e ver a sessão fechada.
 * Dados fictícios. Desliga a opção no fim se estava desligada.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "financeiro");
const creds = JSON.parse(fs.readFileSync(path.join(RAIZ, ".e2e-creds.json"), "utf8")) as unknown as CredsE2E;

async function opcao(page: Page, ligar: boolean): Promise<boolean> {
  await page.goto("/app/settings/tenant/profissionais");
  const bloco = page.getByRole("main").getByTestId("clinic-financeiro");
  await expect(bloco).toBeVisible({ timeout: 20_000 });
  const estava = await bloco.getByText("Financeiro da clínica ligado").isVisible();
  if (estava !== ligar) {
    await bloco.getByTestId("clinic-financeiro-alternar").click();
    await expect(
      bloco.getByText(ligar ? "Financeiro da clínica ligado" : "Financeiro da clínica desligado"),
    ).toBeVisible({ timeout: 20_000 });
  }
  return estava;
}

test("caixa do dia: abrir, sangria e fechar sem diferença — pela tela", async ({ page }) => {
  test.setTimeout(240_000);
  await loginComoAdmin(page, creds);
  const estava = await opcao(page, true);
  try {
    const sufixo = Date.now().toString().slice(-6);
    const r = await page.request.post("/api/v1/financeiro/catalogo/contas", { data: { name: `Gaveta E2E ${sufixo}`, kind: "cash" } });
    expect(r.ok(), await r.text()).toBeTruthy();
    const conta = ((await r.json()) as { data: { id: string } }).data.id;

    await page.goto("/app/financeiro/caixa");
    const m = page.getByRole("main");
    await expect(m.getByTestId("caixa-resumo")).toBeVisible({ timeout: 20_000 });
    await m.getByTestId("caixa-conta").selectOption(conta);
    await m.getByTestId("caixa-fundo").fill("100,00");
    await m.getByTestId("caixa-abrir").click();
    const sessao = m.getByTestId("caixa-sessao").filter({ hasText: `Gaveta E2E ${sufixo}` });
    await expect(sessao.getByTestId("caixa-esperado")).toContainText("100,00", { timeout: 20_000 });

    await sessao.getByTestId("caixa-movimentar").click();
    await sessao.getByLabel("Valor (R$)").fill("30,00");
    await sessao.getByLabel("Descrição").fill("Depósito no banco");
    await sessao.getByRole("button", { name: "Registrar" }).click();
    await expect(sessao.getByTestId("caixa-esperado")).toContainText("70,00", { timeout: 20_000 });

    await sessao.getByTestId("caixa-fechar").click();
    await sessao.getByTestId("caixa-cedula-5000").fill("1");
    await sessao.getByTestId("caixa-cedula-2000").fill("1");
    await expect(sessao.getByTestId("caixa-contado")).toContainText("70,00");
    await sessao.getByTestId("caixa-confirmar-fechamento").click();
    await expect(sessao.getByTestId("caixa-diferenca")).toContainText("0,00", { timeout: 20_000 });
    await expect(sessao).toContainText("Fechado");
    fs.mkdirSync(EVIDENCIA, { recursive: true });
    await page.screenshot({ path: path.join(EVIDENCIA, "05-caixa-do-dia.png"), fullPage: true });
  } finally {
    if (!estava) await opcao(page, false);
  }
});
