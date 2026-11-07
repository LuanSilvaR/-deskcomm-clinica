/**
 * FORK clinic (orçamento O3, migration 8008) — o envio gera o contrato, PELA TELA:
 *
 *   1. orçamento parcelado (3× no cartão) em rascunho → "Enviar e gerar contrato";
 *   2. o contrato aparece em Documentos, ligado ao orçamento;
 *   3. o paciente abre o link SEM login e vê os itens e a FORMA DE PAGAMENTO;
 *   4. aceita → o orçamento fica "Aprovado";
 *   5. o PDF do contrato baixa;
 *   6. (O4) o aceite gerou o plano de tratamento e a comanda aberta.
 * Dados fictícios. Volta as opções ao que estavam.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "orcamentos");

interface Creds {
  password: string;
  users: Record<string, { email: string; id?: string } | undefined>;
}
const creds = JSON.parse(fs.readFileSync(path.join(RAIZ, ".e2e-creds.json"), "utf8")) as Creds;

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

test("orçamento → contrato: envio, aceite pelo link com a forma de pagamento, aprovado e PDF — pela tela", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  await loginComoAdmin(page, creds as unknown as CredsE2E);
  const antes = ((await (await page.request.get("/api/v1/clinic/config")).json()) as {
    data: { prontuario: boolean; orcamentos: boolean };
  }).data;
  const ligar = await page.request.patch("/api/v1/clinic/config", { data: { prontuario: true, orcamentos: true } });
  expect(ligar.status(), await ligar.text()).toBe(200);

  const sufixo = Date.now().toString().slice(-8);
  const nome = `Peeling Ctr ${sufixo}`;
  try {
    const proc = await page.request.post("/api/v1/clinic/procedimentos", {
      data: { name: nome, short_description: "Procedimento fictício de teste" },
    });
    expect(proc.status(), await proc.text()).toBe(201);
    const procId = ((await proc.json()) as { data: { id: string } }).data.id;
    const preco = await page.request.post("/api/v1/clinic/precos", { data: { procedure_id: procId, preco_cents: 90000 } });
    expect(preco.status(), await preco.text()).toBe(201);
    const precoId = ((await preco.json()) as { data: { id: string } }).data.id;
    const contato = await page.request.post("/api/v1/contacts", {
      data: { name: `Paciente Ctr${sufixo}`, phone_number: `+551197${sufixo}`, source: "whatsapp" },
    });
    expect(contato.status(), await contato.text()).toBe(201);
    const contatoId = ((await contato.json()) as { data: { contact: { id: string } } }).data.contact.id;
    const orc = await page.request.post("/api/v1/clinic/orcamentos", {
      data: {
        contact_id: contatoId,
        itens: [{ preco_id: precoId }],
        condicao_pagamento: { forma: "parcelado", parcelas: 3 },
      },
    });
    expect(orc.status(), await orc.text()).toBe(201);

    // ── 1. enviar ────────────────────────────────────────────────────────
    await page.goto(`/app/contacts/${contatoId}?aba=orcamentos`);
    const card = page.getByRole("main").getByTestId("orcamento").first();
    await expect(card.getByTestId("orcamento-status")).toHaveText("Rascunho", { timeout: 20_000 });
    await card.getByTestId("orcamento-enviar").click();
    await expect(card.getByTestId("orcamento-status")).toHaveText("Enviado", { timeout: 20_000 });
    await expect(card.getByTestId("orcamento-contrato-emitido")).toBeVisible();
    await foto(page, "o3-1-enviado");

    // ── 2. o contrato em Documentos ──────────────────────────────────────
    await page.goto(`/app/contacts/${contatoId}?aba=documentos`);
    const docs = page.getByTestId("documentos-do-paciente");
    const contrato = docs.getByTestId("documento").filter({ hasText: "Orçamento Nº" });
    await expect(contrato.getByTestId("documento-status")).toHaveText("Aguardando aceite", { timeout: 20_000 });
    await contrato.getByTestId("documento-link").click();
    const url = await contrato.getByTestId("documento-link-gerado").getByRole("textbox").inputValue();

    // ── 3. o paciente, sem login, vê itens e forma de pagamento ──────────
    const anonimo = await browser.newContext();
    const pPac = await anonimo.newPage();
    await pPac.goto(url);
    const termo = pPac.getByTestId("termo-publico");
    await expect(termo).toContainText(nome, { timeout: 20_000 });
    await expect(termo).toContainText("Cartão de crédito parcelado");
    await expect(termo).toContainText(/3 × R\$\s300,00 no cartão de crédito/);
    await foto(pPac, "o3-2-termo-com-pagamento");
    await termo.getByTestId("aceite-nome").fill(`Paciente Ctr${sufixo}`);
    await termo.getByTestId("aceite-confirmar").click();
    await expect(pPac.getByTestId("termo-aceito")).toBeVisible({ timeout: 20_000 });
    await anonimo.close();

    // ── 4. aprovado ──────────────────────────────────────────────────────
    await page.goto(`/app/contacts/${contatoId}?aba=orcamentos`);
    const aprovado = page.getByRole("main").getByTestId("orcamento").first();
    await expect(aprovado.getByTestId("orcamento-status")).toHaveText("Aprovado", { timeout: 20_000 });
    await expect(aprovado.getByTestId("orcamento-aprovado-em")).toBeVisible();
    // O4 (8009): o aceite gerou o plano de tratamento e a comanda aberta.
    await expect(aprovado.getByTestId("orcamento-ver-plano")).toBeVisible();
    await expect(aprovado.getByTestId("orcamento-ver-comanda")).toBeVisible();
    await expect(aprovado.getByTestId("orcamento-pos-aceite-erro")).toHaveCount(0);
    await foto(page, "o3-3-aprovado");

    // ── 5. o PDF do contrato ─────────────────────────────────────────────
    const href = await aprovado.getByTestId("orcamento-baixar-contrato").getAttribute("href");
    const pdf = await page.request.get(href!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
  } finally {
    await page.request.patch("/api/v1/clinic/config", {
      data: { prontuario: antes.prontuario, orcamentos: antes.orcamentos },
    });
  }
});
