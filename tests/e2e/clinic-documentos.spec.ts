/**
 * FORK clinic (prontuário F6, migration 9023) — termos e aceite, PELA TELA:
 *
 *   1. o admin liga a opção "prontuario" e abre a aba Documentos de um paciente;
 *   2. emite o termo de consentimento e colhe o aceite ali mesmo (presencial);
 *   3. emite a autorização de uso de imagem e gera o link;
 *   4. o paciente, SEM login, abre o link, responde cada opção (nenhuma vem
 *      marcada), digita o nome e aceita; o link não abre de novo;
 *   5. o documento aparece "Aceito" com as escolhas; desfaz a opção.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { lerCreds, loginComoAdmin } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "documentos");
const extra = JSON.parse(fs.readFileSync(path.join(RAIZ, ".e2e-creds.json"), "utf8")) as { org_id: string };
let creds = lerCreds();

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(URL_SUPABASE)) {
  throw new Error(`Supabase não é local (${URL_SUPABASE}) — esta spec só roda no ambiente de teste.`);
}
const admin = createClient(URL_SUPABASE, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

test.describe.configure({ mode: "serial", timeout: 240_000 });

test("termos: aceite presencial e por link (uso de imagem) — pela tela", async ({ page, browser }) => {
  const sufixo = Date.now().toString().slice(-6);
  creds = await loginComoAdmin(page, creds);
  const ligar = await page.request.patch("/api/v1/clinic/config", { data: { prontuario: true } });
  expect(ligar.status(), await ligar.text()).toBe(200);
  const { data: contato, error } = await admin
    .from("contacts")
    .insert({ organization_id: extra.org_id, name: `Paciente Termo E2E ${sufixo}`, phone_number: `+55119${sufixo}0088` } as never)
    .select("id")
    .single();
  expect(error?.message ?? null).toBeNull();
  const contactId = (contato as { id: string }).id;

  try {
    await page.goto(`/app/contacts/${contactId}?aba=documentos`);
    const docs = page.getByTestId("documentos-do-paciente");
    await expect(docs).toBeVisible({ timeout: 20_000 });

    // 2. consentimento, aceite presencial.
    await docs.getByTestId("documento-modelo").selectOption({ label: "Termo de consentimento para procedimento" });
    await docs.getByTestId("documento-emitir").click();
    const consentimento = docs.getByTestId("documento").filter({ hasText: "Termo de consentimento" });
    await expect(consentimento.getByTestId("documento-status")).toHaveText("Aguardando aceite", { timeout: 20_000 });
    await consentimento.getByTestId("documento-colher").click();
    await consentimento.getByTestId("aceite-nome").fill(`Paciente Termo E2E ${sufixo}`);
    await consentimento.getByTestId("aceite-confirmar").click();
    await expect(consentimento.getByTestId("documento-status")).toHaveText("Aceito", { timeout: 20_000 });
    await foto(page, "1-presencial");

    // 3. uso de imagem, link.
    await docs.getByTestId("documento-modelo").selectOption({ label: "Autorização de uso de imagem" });
    await docs.getByTestId("documento-emitir").click();
    const imagem = docs.getByTestId("documento").filter({ hasText: "Autorização de uso de imagem" });
    await expect(imagem.getByTestId("documento-status")).toHaveText("Aguardando aceite", { timeout: 20_000 });
    await imagem.getByTestId("documento-link").click();
    const url = await imagem.getByTestId("documento-link-gerado").getByRole("textbox").inputValue();
    expect(url).toMatch(/\/termo\/[A-Za-z0-9_-]{43}$/);

    // 4. o paciente, sem login.
    const anonimo = await browser.newContext();
    const pPac = await anonimo.newPage();
    await pPac.goto(url);
    const termo = pPac.getByTestId("termo-publico");
    await expect(termo.getByRole("heading", { level: 1 })).toHaveText("Autorização de uso de imagem", { timeout: 20_000 });
    await expect(termo.getByTestId("aceite-confirmar")).toBeDisabled();
    for (const chave of ["ensino_sem_identificacao", "divulgacao_com_identificacao", "site", "material_impresso"]) {
      await termo.getByTestId(`opcao-${chave}-nao`).check();
    }
    await termo.getByTestId("opcao-divulgacao_sem_rosto-sim").check();
    await termo.getByTestId("opcao-redes_sociais-sim").check();
    await termo.getByTestId("aceite-nome").fill(`Paciente Termo E2E ${sufixo}`);
    await foto(pPac, "2-link");
    await termo.getByTestId("aceite-confirmar").click();
    await expect(pPac.getByTestId("termo-aceito")).toBeVisible({ timeout: 20_000 });
    await pPac.goto(url);
    await expect(pPac.getByRole("alert").filter({ hasText: "expirou ou já foi usado" })).toBeVisible({ timeout: 20_000 });
    await anonimo.close();

    // 5. aceito, com as escolhas.
    await page.reload();
    const aceito = page.getByTestId("documento").filter({ hasText: "Autorização de uso de imagem" });
    await expect(aceito.getByTestId("documento-status")).toHaveText("Aceito", { timeout: 20_000 });
    await expect(aceito).toContainText("pelo link");
    await foto(page, "3-aceito");
  } finally {
    await page.request.patch("/api/v1/clinic/config", { data: { prontuario: false } });
  }
});
