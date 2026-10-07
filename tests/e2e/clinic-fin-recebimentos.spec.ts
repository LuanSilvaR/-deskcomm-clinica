/**
 * FORK clinic (financeiro FN2, migration 9040) — fechar a comanda com taxa e
 * parcelas, PELA TELA:
 *
 *   1. (API) liga o financeiro da clínica, cria conta, forma "Cartão", uma
 *      maquininha a partir do modelo Cielo Smart e uma comanda de R$ 3.500;
 *   2. no balcão: Cartão em 6x mostra taxa R$ 395,50 e líquido R$ 3.104,50
 *      ANTES de finalizar; dividir em duas formas exige a soma bater;
 *   3. finaliza; em Contas a receber aparecem as 6 parcelas da comanda;
 *   4. estornar a comanda deixa as parcelas estornadas.
 * Dados fictícios. Desliga a opção no fim se estava desligada.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "financeiro");
const creds = JSON.parse(fs.readFileSync(path.join(RAIZ, ".e2e-creds.json"), "utf8")) as unknown as CredsE2E;

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

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

async function post<T>(page: Page, url: string, data: unknown, metodo: "post" | "put" = "post"): Promise<T> {
  const r = await page.request[metodo](url, { data });
  expect(r.ok(), `${url}: ${await r.text()}`).toBeTruthy();
  return ((await r.json()) as { data: T }).data;
}

test("fechamento com taxa: cartão 6x, contas a receber e estorno — pela tela", async ({ page }) => {
  test.setTimeout(300_000);
  await loginComoAdmin(page, creds);
  const estava = await opcao(page, true);
  const sufixo = Date.now().toString().slice(-6);
  let adquirente: string | null = null;
  try {
    // ── 1. preparo pela API ───────────────────────────────────────────────
    const conta = await post<{ id: string }>(page, "/api/v1/financeiro/catalogo/contas", { name: `Banco E2E ${sufixo}`, kind: "bank" });
    const forma = await post<{ id: string }>(page, "/api/v1/financeiro/catalogo/formas_de_pagamento", {
      name: `Cartão E2E ${sufixo}`,
      account_id: conta.id,
    });
    adquirente = (
      await post<{ id: string }>(page, "/api/v1/clinic/financeiro/adquirentes", {
        nome: `Maquininha E2E ${sufixo}`,
        prazo_credito_dias: 30,
      })
    ).id;
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    await post(page, `/api/v1/clinic/financeiro/adquirentes/${adquirente}/tabelas`, {
      vigente_desde: hoje,
      linhas: [
        { bandeira: null, modalidade: "credito", parcelas_de: 1, parcelas_ate: 1, mdr_pct: 4.3 },
        { bandeira: null, modalidade: "credito", parcelas_de: 2, parcelas_ate: 12, mdr_pct: 11.3 },
      ],
    });
    await post(page, `/api/v1/clinic/financeiro/formas/${forma.id}`, { tipo: "credito", adquirente_id: adquirente }, "put");
    const comanda = await post<{ id: string; number: number }>(page, "/api/v1/financeiro/comandas", {});
    await post(page, `/api/v1/financeiro/comandas/${comanda.id}/itens`, {
      description: "Harmonização facial fictícia",
      unit_price_cents: 350000,
    });

    // ── 2. o balcão ───────────────────────────────────────────────────────
    await page.goto("/app/comandas");
    const m = page.getByRole("main");
    await m.getByTestId(`comanda-${comanda.number}`).click();
    const fechamento = m.getByTestId("fechamento-com-taxas");
    await expect(fechamento).toBeVisible({ timeout: 20_000 });
    const linha = fechamento.getByTestId("pagamento-linha").first();
    await linha.getByTestId("forma-de-pagamento").selectOption(forma.id);
    await linha.getByTestId("pagamento-parcelas").selectOption("6");
    await expect(fechamento.getByTestId("fechamento-taxas")).toContainText("395,50");
    await expect(fechamento.getByTestId("fechamento-liquido")).toContainText("3.104,50");
    await foto(page, "03-fechamento-6x");

    // dividir: a soma precisa bater
    await linha.getByTestId("pagamento-valor").fill("3.000,00");
    await expect(fechamento.getByTestId("falta-pagar")).toContainText("500,00");
    await expect(fechamento.getByTestId("finalizar-comanda")).toBeDisabled();
    await linha.getByTestId("pagamento-valor").fill("3.500,00");
    await expect(fechamento.getByTestId("falta-pagar")).toContainText("Soma confere");

    await fechamento.getByTestId("finalizar-comanda").click();
    await expect(m.getByTestId("estornar-comanda")).toBeVisible({ timeout: 20_000 });

    // ── 3. contas a receber ──────────────────────────────────────────────
    await page.goto("/app/financeiro/recebiveis");
    const tabela = page.getByRole("main").getByTestId("recebiveis-tabela");
    await expect(tabela.getByTestId("recebivel").filter({ hasText: `#${comanda.number}` })).toHaveCount(6, { timeout: 20_000 });
    await foto(page, "04-contas-a-receber");

    // ── 4. estorno ────────────────────────────────────────────────────────
    await page.goto("/app/comandas");
    await page.getByRole("main").getByTestId(`comanda-${comanda.number}`).click();
    await page.getByRole("main").getByTestId("motivo-do-estorno").fill("Lançamento de teste errado");
    await page.getByRole("main").getByTestId("estornar-comanda").click();
    await expect(page.getByRole("main").getByTestId("estornar-comanda")).toBeHidden({ timeout: 20_000 });
    await page.goto("/app/financeiro/recebiveis");
    await page.getByRole("main").getByTestId("recebiveis-status").selectOption("estornada");
    await expect(
      page.getByRole("main").getByTestId("recebivel").filter({ hasText: `#${comanda.number}` }),
    ).toHaveCount(6, { timeout: 20_000 });
  } finally {
    if (adquirente) await page.request.patch(`/api/v1/clinic/financeiro/adquirentes/${adquirente}`, { data: { ativo: false } });
    if (!estava) await opcao(page, false);
  }
});
