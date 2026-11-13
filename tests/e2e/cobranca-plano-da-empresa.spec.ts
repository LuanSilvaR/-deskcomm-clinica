/**
 * PLANO E COBRANÇA DA EMPRESA PELA TELA — FORK (card #160b).
 *
 * Com o módulo `cobranca` ligado e a empresa em teste grátis (faltando 3 dias):
 *   - a faixa do teste grátis aparece no topo do /app para quem administra;
 *   - /app/settings/billing mostra o painel do plano e o botão "Assinar";
 *   - sem provedor conectado pelo dono da instalação, "Assinar" responde com a
 *     frase de leigo — nenhum link é gerado e nada sai para provedor nenhum.
 * Desligado, a tela volta ao cartão "em breve". Banco compartilhado: a spec
 * apaga a assinatura e o plano que criou e desliga o módulo no fim.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { credenciaisSupabaseDeTeste } from "../../scripts/lib/env-de-teste";
import { lerCreds, loginComoAdmin } from "./helpers/login-admin";

const { url, serviceRole } = credenciaisSupabaseDeTeste();
const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

const EVIDENCIA = path.join(process.cwd(), "evidence", "cobranca-plano-da-empresa");
function evidencia(nome: string): string {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  return path.join(EVIDENCIA, nome);
}

const SUFIXO = Date.now().toString(36);
const NOME_DO_PLANO = `Premium e2e ${SUFIXO}`;
let orgId = "";
let planoId = "";

async function orgDoAdmin(): Promise<string> {
  const email = lerCreds().users.admin!.email;
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const usuario = data.users.find((u) => u.email === email);
  if (!usuario) throw new Error("admin do e2e não encontrado");
  const { data: vinculo } = await admin
    .from("user_organizations")
    .select("organization_id")
    .eq("user_id", usuario.id)
    .eq("role", "admin")
    .is("revoked_at", null)
    .limit(1)
    .single();
  return (vinculo as { organization_id: string }).organization_id;
}

async function limpar(): Promise<void> {
  await admin.from("platform_config").delete().eq("chave", "MODULO_COBRANCA");
  if (orgId) await admin.from("cobranca_assinaturas").delete().eq("organization_id", orgId);
  if (planoId) await admin.from("cobranca_planos").delete().eq("id", planoId);
}

test.describe("Plano e cobrança da empresa (#160b)", () => {
  test.beforeAll(async () => {
    orgId = await orgDoAdmin();
    await admin.from("cobranca_assinaturas").delete().eq("organization_id", orgId);
    const { data: plano, error } = await admin
      .from("cobranca_planos")
      .insert({ nome: NOME_DO_PLANO, preco_cents: 28900, intervalo: "mes", trial_dias: 14 })
      .select("id")
      .single();
    if (error || !plano) throw new Error(`plano do e2e: ${error?.message}`);
    planoId = (plano as { id: string }).id;
    await admin.from("cobranca_assinaturas").insert({
      organization_id: orgId,
      plano_id: planoId,
      estado: "trial",
      trial_ate: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    });
    await admin
      .from("platform_config")
      .upsert({ chave: "MODULO_COBRANCA", valor: "ligado", eh_segredo: false, semeado_do_env: false }, { onConflict: "chave" });
  });
  test.afterAll(limpar);

  test("faixa do teste grátis, painel do plano e Assinar sem provedor conectado", async ({ page }) => {
    test.setTimeout(120_000);
    await loginComoAdmin(page, lerCreds());

    await page.goto("/app/settings/billing");
    await expect(page.getByRole("heading", { name: /plano e cobrança/i })).toBeVisible();
    await expect(page.getByText(NOME_DO_PLANO)).toBeVisible();
    // A faixa do teste grátis (últimos 7 dias) no topo do /app.
    await expect(page.getByText(/teste grátis/i).first()).toBeVisible();
    await page.screenshot({ path: evidencia("1-painel-em-teste.png"), fullPage: true });

    const assinar = page.getByRole("button", { name: /^assinar$/i });
    await expect(assinar).toBeVisible();
    await assinar.click();
    await expect(page.getByText(/ainda não conectou a cobrança/i).first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: evidencia("2-assinar-sem-provedor.png"), fullPage: true });

    // Desligado: volta o cartão de "em breve", sem painel.
    await admin.from("platform_config").delete().eq("chave", "MODULO_COBRANCA");
    await page.goto("/app/settings/billing");
    await expect(page.getByText(NOME_DO_PLANO)).toHaveCount(0);
  });
});
