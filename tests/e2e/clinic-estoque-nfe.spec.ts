/**
 * FORK clinic (estoque E5, migration 9033) — compras pelo XML da NF-e, PELA TELA:
 *
 *   1. produto de estoque com EAN (pela API);
 *   2. Estoque › Compras (NF-e): importar um XML fictício → a nota abre em
 *      conferência com o produto sugerido "pelo EAN";
 *   3. conferir o item (lote e validade do rastro) e "Lançar no estoque";
 *   4. a nota fica "Lançada" e a Posição mostra o saldo que entrou;
 *   5. importar o MESMO XML de novo é recusado (chave repetida).
 * Dados fictícios (chave com dígito verificador calculado aqui).
 * Desliga o estoque no fim se estava desligado.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "estoque-nfe");

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

function chaveFicticia(sufixo: string): string {
  const base = `352610000000000001915500100${sufixo.padStart(9, "0")}1000000`.slice(0, 43);
  let soma = 0;
  let peso = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += Number(base[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return base + String(resto < 2 ? 0 : 11 - resto);
}

function xml(chave: string, ean: string, numero: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe${chave}" versao="4.00">
<ide><serie>1</serie><nNF>${numero}</nNF><dhEmi>2026-09-30T10:00:00-03:00</dhEmi></ide>
<emit><CNPJ>00000000000191</CNPJ><xNome>Distribuidora Fictícia E2E</xNome></emit>
<dest><CNPJ>11111111000111</CNPJ></dest>
<det nItem="1"><prod><cProd>E2E-1</cProd><cEAN>${ean}</cEAN><xProd>LUVA FICTICIA E2E</xProd><NCM>40151900</NCM>
<uCom>CX</uCom><qCom>3</qCom><vUnCom>20.00</vUnCom><vProd>60.00</vProd>
<rastro><nLote>LT-E2E</nLote><qLote>3</qLote><dVal>2099-06-30</dVal></rastro></prod></det>
<total><ICMSTot><vNF>60.00</vNF></ICMSTot></total>
</infNFe></NFe></nfeProc>`;
}

test("estoque: importar, conferir e lançar NF-e — pela tela", async ({ page }) => {
  test.setTimeout(300_000);
  await loginComoAdmin(page, creds);
  const estava = await opcao(page, true);
  const sufixo = Date.now().toString().slice(-8);
  const nome = `Luva NF-e E2E ${sufixo}`;
  const ean = `789${sufixo.padStart(10, "0")}`.slice(0, 13);

  try {
    const prod = await page.request.post("/api/v1/products", {
      data: { codigo: `NFE-E2E-${sufixo}`, nome, preco_cents: 0 },
    });
    expect(prod.status(), await prod.text()).toBe(201);
    const productId = ((await prod.json()) as { data: { id: string } }).data.id;
    const cfg = await page.request.put(`/api/v1/clinic/estoque/produtos/${productId}`, {
      data: {
        ean,
        unidade_estoque: "cx",
        unidade_aplicacao: "un",
        fator_conversao: 50,
        fracionavel: false,
        rastreado: true,
        controlado: false,
        conselhos_permitidos: [],
        estoque_minimo: 0,
        gerenciado: true,
      },
    });
    expect(cfg.status(), await cfg.text()).toBe(200);
    const arquivo = { name: "nota.xml", mimeType: "application/xml", buffer: Buffer.from(xml(chaveFicticia(sufixo), ean, sufixo)) };

    await page.goto("/app/estoque");
    const m = page.getByRole("main");
    await expect(m.getByTestId("painel-do-estoque")).toBeVisible({ timeout: 20_000 });
    await m.getByTestId("estoque-aba-compras").click();
    await m.getByTestId("nfe-arquivo").setInputFiles(arquivo);

    // ── conferência ─────────────────────────────────────────────────────────
    const conf = m.getByTestId("nfe-conferencia");
    await expect(conf).toBeVisible({ timeout: 20_000 });
    const item = conf.getByTestId("nfe-item").first();
    await expect(item).toContainText("pelo EAN");
    await expect(item.getByTestId("nfe-item-fator")).toHaveValue("50");
    await expect(item.getByTestId("nfe-item-lote")).toHaveValue("LT-E2E");
    await foto(page, "1-conferencia");
    await item.getByTestId("nfe-item-conferir").click();
    await expect(item).toContainText("conferido", { timeout: 20_000 });
    await conf.getByTestId("nfe-lancar").click();
    await expect(conf).toContainText("Lançada", { timeout: 20_000 });
    await foto(page, "2-lancada");

    // ── posição: 3 cx × 50 = 150 un ─────────────────────────────────────────
    await m.getByTestId("nfe-voltar").click();
    await m.getByTestId("estoque-aba-posicao").click();
    await m.getByPlaceholder("Buscar produto por nome ou código").fill(nome);
    await expect(m.getByTestId("estoque-produto").filter({ hasText: nome }).getByTestId("estoque-saldo")).toContainText("150", {
      timeout: 20_000,
    });

    // ── a mesma nota de novo é recusada ─────────────────────────────────────
    const repetida = await page.request.post("/api/v1/clinic/estoque/nfe", { multipart: { arquivo } });
    expect(repetida.status()).toBe(409);
  } finally {
    if (!estava) await opcao(page, false);
  }
});
