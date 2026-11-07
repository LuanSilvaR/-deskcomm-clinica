/**
 * FORK clinic (8011) — Configurações › Organização, PELA TELA:
 *
 *   1. digitar o CEP preenche logradouro, bairro, cidade e UF sozinho;
 *   2. telefone e número digitados à mão;
 *   3. Salvar, recarregar: tudo continua lá;
 *   4. CEP não encontrado vira aviso.
 * A rota de CEP é simulada (`page.route`): o teste não depende da internet.
 * Dados fictícios. No fim, devolve o endereço da organização de teste ao vazio.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, "evidence", "empresa-endereco");
const creds = JSON.parse(fs.readFileSync(path.join(RAIZ, ".e2e-creds.json"), "utf8")) as CredsE2E;

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

async function simularCep(page: Page): Promise<void> {
  await page.route("**/api/v1/clinic/cep/*", async (rota) => {
    const cep = rota.request().url().split("/").pop();
    const data =
      cep === "01310100"
        ? {
            tipo: "encontrado",
            endereco: {
              cep: "01310100",
              logradouro: "Avenida Paulista",
              bairro: "Bela Vista",
              cidade: "São Paulo",
              uf: "SP",
              codigo_ibge: "3550308",
            },
          }
        : { tipo: "nao_encontrado" };
    await rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data }) });
  });
}

test("organização: CEP preenche o endereço, salva telefone e endereço e mantém ao recarregar", async ({ page }) => {
  test.setTimeout(180_000);
  await loginComoAdmin(page, creds);
  await simularCep(page);

  await page.goto("/app/settings/tenant");
  const secao = page.getByTestId("org-contato-endereco");
  await expect(secao).toBeVisible({ timeout: 30_000 });

  try {
    // ── 1 e 2. CEP preenche; telefone e número à mão ──────────────────────
    await secao.getByLabel("Telefone de contato").fill("(11) 3333-4444");
    await secao.getByLabel("CEP").fill("01310-100");
    await expect(secao.getByLabel("Logradouro")).toHaveValue("Avenida Paulista", { timeout: 15_000 });
    await expect(secao.getByLabel("Bairro")).toHaveValue("Bela Vista");
    await expect(secao.getByLabel("Cidade")).toHaveValue("São Paulo");
    await expect(secao.getByLabel("UF")).toHaveValue("SP");
    await secao.getByLabel("Número").fill("1000");
    await secao.getByLabel("Complemento (opcional)").fill("Sala 12");
    await foto(page, "1-cep-preenche-endereco");

    // ── 3. salvar e recarregar ────────────────────────────────────────────
    await page.getByRole("button", { name: "Salvar", exact: true }).first().click();
    await expect(page.getByText("Organização atualizada.")).toBeVisible({ timeout: 30_000 });
    await page.reload();
    const depois = page.getByTestId("org-contato-endereco");
    await expect(depois.getByLabel("Logradouro")).toHaveValue("Avenida Paulista", { timeout: 30_000 });
    await expect(depois.getByLabel("Telefone de contato")).toHaveValue("(11) 3333-4444");
    await expect(depois.getByLabel("CEP")).toHaveValue("01310-100");
    await expect(depois.getByLabel("Número")).toHaveValue("1000");
    await expect(depois.getByLabel("Complemento (opcional)")).toHaveValue("Sala 12");
    await foto(page, "2-salvo-e-recarregado");

    // ── 4. CEP não encontrado ─────────────────────────────────────────────
    await depois.getByLabel("CEP").fill("99999-999");
    await expect(page.getByTestId("org-cep-aviso")).toContainText("CEP não encontrado", { timeout: 15_000 });
    await foto(page, "3-cep-nao-encontrado");
  } finally {
    // devolve a organização de teste ao estado sem endereço
    await page.goto("/app/settings/tenant");
    const s = page.getByTestId("org-contato-endereco");
    await expect(s).toBeVisible({ timeout: 30_000 });
    for (const rotulo of ["Telefone de contato", "CEP", "Logradouro", "Número", "Complemento (opcional)", "Bairro", "Cidade", "UF"]) {
      await s.getByLabel(rotulo).fill("");
    }
    await page.getByRole("button", { name: "Salvar", exact: true }).first().click();
    await expect(page.getByText("Organização atualizada.")).toBeVisible({ timeout: 30_000 });
  }
});
