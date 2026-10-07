/**
 * FORK clinic (financeiro FN1, migration 9039) — maquininhas e taxas, PELA TELA:
 *
 *   1. ligar o "Financeiro da clínica" em Configurações › Profissionais;
 *   2. criar uma maquininha a partir do modelo Cielo Smart (a tabela de
 *      referência entra valendo hoje, com o aviso "ajuste ao seu contrato");
 *   3. simular R$ 3.500 em 6x: taxa R$ 395,50 (11,30%) e líquido R$ 3.104,50 —
 *      o exemplo do pedido do dono;
 *   4. 4x não tem linha no modelo → o simulador pede para completar a tabela.
 * Dados fictícios. Inativa a maquininha e desliga a opção no fim se estava
 * desligada.
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

test("maquininhas: modelo Cielo Smart e simulador de 6x — pela tela", async ({ page }) => {
  test.setTimeout(240_000);
  await loginComoAdmin(page, creds);
  const estava = await opcao(page, true);
  const nome = `Cielo E2E ${Date.now().toString().slice(-6)}`;
  let id: string | null = null;
  try {
    await page.goto("/app/settings/tenant/maquininhas");
    const m = page.getByRole("main");
    await expect(m.getByRole("heading", { name: "Maquininhas e taxas" })).toBeVisible({ timeout: 20_000 });

    await m.getByTestId("fin-modelo").selectOption("cielo_smart");
    await expect(m.getByTestId("fin-modelo-aviso")).toContainText("ajuste ao seu contrato");
    await m.getByTestId("fin-adquirente-nome").fill(nome);
    await m.getByTestId("fin-adquirente-criar").click();
    const cartao = m.getByTestId("fin-adquirente").filter({ hasText: nome });
    await expect(cartao).toBeVisible({ timeout: 20_000 });
    await expect(cartao).toContainText("11,30%");
    await foto(page, "01-maquininha-pelo-modelo");

    const lista = await page.request.get("/api/v1/clinic/financeiro/maquininhas");
    const dados = (await lista.json()) as { data: { adquirentes: Array<{ id: string; nome: string }> } };
    id = dados.data.adquirentes.find((a) => a.nome === nome)?.id ?? null;

    const sim = m.getByTestId("fin-simulador");
    await sim.getByLabel("Maquininha").selectOption({ label: nome });
    await sim.getByTestId("fin-sim-valor").fill("3.500,00");
    await sim.getByLabel("Forma").selectOption("credito");
    await sim.getByTestId("fin-sim-parcelas").selectOption("6");
    await sim.getByTestId("fin-sim-calcular").click();
    await expect(sim.getByTestId("fin-sim-mdr")).toContainText("395,50", { timeout: 20_000 });
    await expect(sim.getByTestId("fin-sim-liquido")).toContainText("3.104,50");
    await foto(page, "02-simulador-6x");

    await sim.getByTestId("fin-sim-parcelas").selectOption("4");
    await sim.getByTestId("fin-sim-calcular").click();
    await expect(sim.getByTestId("fin-sim-erro")).toContainText("Complete a tabela", { timeout: 20_000 });
  } finally {
    if (id) await page.request.patch(`/api/v1/clinic/financeiro/adquirentes/${id}`, { data: { ativo: false } });
    if (!estava) await opcao(page, false);
  }
});
