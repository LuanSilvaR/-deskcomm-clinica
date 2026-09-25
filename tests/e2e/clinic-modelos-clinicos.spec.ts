/**
 * FORK clinic (prontuário F3, migration 9020) — Configurações › Modelos clínicos, PELA TELA:
 *
 *   1. o admin (modelos_clinicos.gerenciar, sem papel clínico) abre a tela;
 *   2. cria um modelo de anamnese com um campo e vê a prévia;
 *   3. o modelo aparece na lista, versão 1; edita a pergunta e publica a versão 2;
 *   4. na aba Requisitos, exige anamnese para todos os atendimentos e salva;
 *   5. desfaz: remove a regra e desativa o modelo (service role, só local).
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { lerCreds, loginComoAdmin } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "modelos-clinicos");

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

test.describe.configure({ mode: "serial", timeout: 180_000 });

test("modelos clínicos: criar, publicar versão e exigir anamnese — pela tela", async ({ page }) => {
  const nome = `Anamnese E2E ${Date.now().toString().slice(-6)}`;
  creds = await loginComoAdmin(page, creds);
  try {
    await page.goto("/app/settings/tenant/modelos-clinicos");
    await expect(page.getByTestId("lista-de-modelos")).toBeVisible({ timeout: 20_000 });

    // 2. novo modelo com um campo.
    await page.getByTestId("modelo-novo").click();
    await page.getByTestId("modelo-nome").fill(nome);
    await page.getByTestId("campo-novo").click();
    const campo = page.getByTestId("campo-do-modelo").first();
    await campo.getByLabel("Pergunta").fill("Queixa do teste");
    await campo.getByLabel("Tipo de resposta").selectOption("texto_longo");
    await campo.getByText("Obrigatório para finalizar").click();
    await expect(page.getByRole("complementary", { name: "Prévia" }).getByText("Queixa do teste")).toBeVisible();
    await foto(page, "1-editor");
    await page.getByTestId("modelo-criar").click();

    // 3. aparece na lista; publica a versão 2.
    const item = page.getByTestId("modelo-item").filter({ hasText: nome });
    await expect(item).toContainText("Versão 1", { timeout: 20_000 });
    await item.getByRole("button", { name: "Editar" }).click();
    await page.getByTestId("campo-do-modelo").first().getByLabel("Pergunta").fill("Queixa principal do teste");
    await page.getByTestId("modelo-publicar").click();
    await expect(page.getByTestId("modelo-item").filter({ hasText: nome })).toContainText("Versão 2", { timeout: 20_000 });
    await foto(page, "2-lista");

    // 4. requisito: anamnese em todos os atendimentos.
    await page.getByTestId("aba-requisitos").click();
    await page.getByTestId("regra-nova").click();
    await page.getByTestId("regras-salvar").click();
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("clinic_requisitos_finalizacao")
          .select("secao")
          .eq("organization_id", extra.org_id)
          .eq("secao", "anamnese");
        return (data ?? []).length;
      })
      .toBe(1);
    await foto(page, "3-requisitos");
  } finally {
    // 5. desfaz.
    await admin.from("clinic_requisitos_finalizacao").delete().eq("organization_id", extra.org_id);
    await admin.from("clinic_modelos_formulario").update({ ativo: false } as never).eq("organization_id", extra.org_id).eq("nome", nome);
  }
});
