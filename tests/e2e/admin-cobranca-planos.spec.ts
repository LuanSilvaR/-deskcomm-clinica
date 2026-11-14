/**
 * COBRANÇA DA PLATAFORMA PELA TELA — FORK (card #159, migration 8026).
 *
 * Prova os critérios do card:
 *   (1) desligada, nada muda: /admin/cobranca não existe, o menu não tem a
 *       porta e o cadastro de tenant não oferece plano;
 *   (2) ligada pelo Sistema, o dono cria, edita, marca como plano do cadastro
 *       e arquiva planos; uma clínica nova nasce em TESTE GRÁTIS no plano
 *       escolhido (lido no banco: `cobranca_assinaturas`).
 *
 * Banco compartilhado sem reset: a spec desliga o módulo e apaga o que criou
 * no fim, para o gatilho do teste grátis não alcançar as orgs das outras specs.
 * Nada aqui cobra de verdade — provedor e checkout chegam no card #160.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { credenciaisSupabaseDeTeste } from "../../scripts/lib/env-de-teste";
import { lerCreds, loginComoDono } from "./helpers/login-admin";
import { afirmarDonoDoServidor } from "./utils/precondicao";

const { url, serviceRole } = credenciaisSupabaseDeTeste();
const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

const EVIDENCIA = path.join(process.cwd(), "evidence", "admin-cobranca-planos");
function evidencia(nome: string): string {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  return path.join(EVIDENCIA, nome);
}

const SUFIXO = Date.now().toString(36);
const PLANO = `Standard e2e ${SUFIXO}`;
const PLANO_ARQUIVAR = `Agentes IA e2e ${SUFIXO}`;
const SLUG = `e2e-159-${SUFIXO}`;

async function desligarELimpar(): Promise<void> {
  await admin.from("platform_config").delete().eq("chave", "MODULO_COBRANCA");
  const { data: planos } = await admin.from("cobranca_planos").select("id").like("nome", `%e2e ${SUFIXO}`);
  const ids = (planos ?? []).map((p) => p.id as string);
  if (ids.length > 0) {
    await admin.from("cobranca_assinaturas").delete().in("plano_id", ids);
    await admin.from("cobranca_planos").delete().in("id", ids);
  }
}

test.describe("Cobrança da plataforma — planos e assinaturas (#159)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await afirmarDonoDoServidor(lerCreds().users.dono!.email);
    await desligarELimpar();
  });

  test.afterAll(async () => {
    await desligarELimpar();
  });

  test("(1) desligada, nada muda; (2) ligada, planos pela tela e clínica nova em teste grátis", async ({ page }) => {
    test.setTimeout(180_000);
    await loginComoDono(page, lerCreds());

    // ── (1) Desligada ────────────────────────────────────────────────────────
    const resp = await page.goto("/admin/cobranca");
    expect(resp?.status()).toBe(404);
    await page.goto("/admin/tenants/new");
    await expect(page.locator("#display_name")).toBeVisible();
    await expect(page.locator('nav[aria-label] a[href="/admin/cobranca"]')).toHaveCount(0);
    await expect(page.locator("#plano_de_cobranca")).toHaveCount(0);

    // ── Ligar pelo Sistema ───────────────────────────────────────────────────
    await page.goto("/admin/sistema");
    const chave = page.locator("#modulo-cobranca");
    await expect(chave).toHaveAttribute("aria-checked", "false");
    await chave.click();
    await expect(chave).toHaveAttribute("aria-checked", "true");
    await expect
      .poll(async () => (await admin.from("platform_config").select("valor").eq("chave", "MODULO_COBRANCA").maybeSingle()).data?.valor)
      .toBe("ligado");
    await page.screenshot({ path: evidencia("1-modulo-ligado.png"), fullPage: true });

    // ── (2) Planos pela tela ─────────────────────────────────────────────────
    await page.goto("/admin/cobranca");
    await expect(page.locator('nav[aria-label] a[href="/admin/cobranca"]').first()).toBeVisible();
    await expect(page.getByTestId("planos-da-plataforma")).toBeVisible();

    async function criar(nome: string, preco: string, trial: string) {
      await page.locator("#plano-nome").fill(nome);
      await page.locator("#plano-preco").fill(preco);
      await page.locator("#plano-trial").fill(trial);
      await page.getByRole("button", { name: /salvar plano/i }).click();
      await expect(page.getByTestId("plano-de-cobranca").filter({ hasText: nome })).toBeVisible({ timeout: 15_000 });
    }
    await criar(PLANO, "129,00", "14");
    await criar(PLANO_ARQUIVAR, "749,00", "7");

    // Editar: o nome muda, o preço (sem assinantes) também.
    const linha = page.getByTestId("plano-de-cobranca").filter({ hasText: PLANO });
    await linha.getByRole("button", { name: /^editar$/i }).click();
    await page.locator("#plano-preco").fill("139,00");
    await page.getByRole("button", { name: /salvar alterações/i }).click();
    await expect(linha).toContainText("139,00", { timeout: 15_000 });

    // Plano do cadastro.
    await linha.getByRole("button", { name: /usar no cadastro/i }).click();
    await expect(linha).toContainText(/plano do cadastro/i, { timeout: 15_000 });

    // Arquivar o outro.
    const outra = page.getByTestId("plano-de-cobranca").filter({ hasText: PLANO_ARQUIVAR });
    await outra.getByRole("button", { name: /^arquivar$/i }).click();
    await expect(outra).toContainText(/arquivado/i, { timeout: 15_000 });
    await page.screenshot({ path: evidencia("2-planos.png"), fullPage: true });

    // ── Clínica nova nasce em teste grátis no plano do cadastro ─────────────
    await page.goto("/admin/tenants/new");
    await expect(page.locator("#plano_de_cobranca")).toContainText(PLANO);
    await page.locator("#display_name").fill(`Clínica e2e ${SUFIXO}`);
    await page.locator("#slug").fill(SLUG);
    await page.locator("#owner_email").fill(lerCreds().users.dono!.email);
    await page.screenshot({ path: evidencia("3-cadastro-com-plano.png"), fullPage: true });
    await page.getByRole("button", { name: /criar organização/i }).click();
    await expect(page.getByText(/organização criada/i)).toBeVisible({ timeout: 30_000 });

    const { data: org } = await admin.from("organizations").select("id").eq("slug", SLUG).single();
    const { data: assinatura } = await admin
      .from("cobranca_assinaturas")
      .select("estado, trial_ate, plano_id")
      .eq("organization_id", org!.id)
      .single();
    expect(assinatura?.estado).toBe("trial");
    expect(new Date(assinatura!.trial_ate as string).getTime()).toBeGreaterThan(Date.now() + 13 * 86_400_000);
    const { data: plano } = await admin.from("cobranca_planos").select("nome").eq("id", assinatura!.plano_id).single();
    expect(plano?.nome).toBe(PLANO);
  });
});
