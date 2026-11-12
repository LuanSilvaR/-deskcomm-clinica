/**
 * FORK clinic (#87) — atestado de anonimização, PELA TELA:
 *
 *   1. o admin liga "Atestado de anonimização" em Profissionais;
 *   2. um paciente fictício é anonimizado pelo diálogo e o código curto aparece;
 *   3. "Baixar atestado" devolve um PDF (link assinado que responde 200);
 *   4. na página LGPD, o código digitado em minúsculas e com espaços é achado;
 *   5. um código que não existe diz "Nenhum atestado com este código";
 *   6. desliga a chave (deixa o ambiente como achou).
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, "evidence", "87-atestado-anonimizacao");

function lerCreds(): CredsE2E {
  const p = path.join(RAIZ, ".e2e-creds.json");
  if (!fs.existsSync(p)) throw new Error("`.e2e-creds.json` ausente — rode `scripts/seed-e2e-credentials.ts`");
  return JSON.parse(fs.readFileSync(p, "utf8")) as CredsE2E;
}

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

async function chave(page: Page, ligar: boolean): Promise<void> {
  await page.goto("/app/settings/tenant/profissionais");
  const bloco = page.getByRole("main").getByTestId("clinic-atestado-anonimizacao");
  await expect(bloco).toBeVisible({ timeout: 20_000 });
  const botao = page.getByRole("main").getByTestId("clinic-atestado-anonimizacao-alternar");
  const textoAtual = (await botao.innerText()).trim();
  const ligada = textoAtual === "Desligar";
  if (ligada !== ligar) {
    await botao.click();
    await expect(botao).toHaveText(ligar ? "Desligar" : "Ligar", { timeout: 15_000 });
  }
}

test("atestado de anonimização: gerar, baixar e conferir — pela tela", async ({ page }) => {
  test.setTimeout(180_000);
  await loginComoAdmin(page, lerCreds());
  let ligouAqui = false;

  try {
    // ── 1. liga a chave ────────────────────────────────────────────────────
    await chave(page, true);
    ligouAqui = true;
    await foto(page, "01-chave-ligada");

    // ── 2. paciente fictício, anonimizado pelo diálogo ─────────────────────
    const sufixo = Date.now().toString().slice(-8);
    const criado = await page.request.post("/api/v1/contacts", {
      data: { name: "Contato Teste Atestado", phone_number: `+551196${sufixo}`, source: "manual" },
    });
    expect(criado.status(), await criado.text()).toBe(201);
    const contatoId = ((await criado.json()) as { data: { contact: { id: string } } }).data.contact.id;

    await page.goto(`/app/contacts/${contatoId}`);
    await page.getByRole("tab", { name: /LGPD/i }).click();
    await page.getByRole("button", { name: "Anonimizar paciente" }).click();
    await page.getByLabel("Justificativa (mínimo 10 caracteres)").fill("Teste automatizado do atestado de anonimização");
    await foto(page, "02-dialogo-anonimizar");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Confirmação").fill("ANONIMIZAR");
    await page.getByRole("button", { name: "Anonimizar permanentemente" }).click();

    // ── 3. o código curto aparece ──────────────────────────────────────────
    const codigoEl = page.getByTestId("atestado-codigo-gerado");
    await expect(codigoEl).toBeVisible({ timeout: 30_000 });
    const codigo = (await codigoEl.innerText()).trim();
    expect(codigo).toMatch(/^[0-9A-Fa-f]{4}(-[0-9A-Fa-f]{4}){3}$/);
    await foto(page, "03-codigo-gerado");

    // ── 4. baixar: o link assinado devolve o PDF ───────────────────────────
    const resposta = page.waitForResponse(
      (r) => /\/api\/v1\/clinic\/lgpd\/atestados\/[0-9a-f-]{36}$/.test(r.url()) && r.request().method() === "GET",
    );
    await page.getByTestId("atestado-baixar-dialogo").click();
    const corpo = (await (await resposta).json()) as { data: { url: string } };
    const pdf = await page.request.get(corpo.data.url);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

    // ── 5. LGPD: conferir com minúsculas e espaços ─────────────────────────
    await page.goto("/app/lgpd/requests");
    await expect(page.getByTestId("atestados-panel")).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("Código do atestado").fill(`  ${codigo.toLowerCase().replace(/-/g, " ")}  `);
    await page.getByTestId("atestado-conferir-botao").click();
    await expect(page.getByTestId("atestado-conferir-resultado")).toContainText("Atestado encontrado");
    await foto(page, "04-conferido");
    await expect(page.getByTestId("atestados-emitidos").getByText(codigo)).toBeVisible();

    // ── 5b. #151: o código leva à ficha anonimizada (prontuário guardado) ──
    await page.getByTestId("atestado-abrir-ficha").click();
    await expect(page).toHaveURL(new RegExp(`/app/contacts/${contatoId}`), { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /Contato Anonimizado/ })).toBeVisible({ timeout: 30_000 });
    await foto(page, "07-ficha-pelo-codigo");
    await page.goto("/app/lgpd/requests");
    await expect(page.getByTestId("atestados-panel")).toBeVisible({ timeout: 20_000 });

    // ── 6. código que não existe ───────────────────────────────────────────
    await page.getByLabel("Código do atestado").fill("0000-0000-0000-0000");
    await page.getByTestId("atestado-conferir-botao").click();
    await expect(page.getByTestId("atestado-conferir-resultado")).toContainText("Nenhum atestado com este código");
    await foto(page, "05-nao-encontrado");
  } finally {
    // ── 7. desliga (deixa o ambiente como achou) ───────────────────────────
    if (ligouAqui) {
      await chave(page, false);
      await foto(page, "06-chave-desligada");
    }
  }
});
