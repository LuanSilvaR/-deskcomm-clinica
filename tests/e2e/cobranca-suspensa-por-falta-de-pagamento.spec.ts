/**
 * EMPRESA SUSPENSA POR FALTA DE PAGAMENTO, PELA TELA — FORK (card #160c).
 *
 * A régua suspende POR COBRANÇA (`suspended_kind = 'cobranca'`, migration 8028).
 * Quem administra cai em /account-suspended e vê o painel do plano com o
 * caminho para pagar ("Assinar"/"Já paguei") — é por aí que volta sozinho. A
 * suspensão administrativa (do dono) segue mostrando só o contato.
 *
 * A spec monta o estado direto no banco (plano, assinatura em atraso e a
 * suspensão tipada) e desfaz tudo no fim: reativa a empresa e apaga o que criou.
 * Nada aqui fala com provedor: sem provedor conectado, "Assinar" responde com a
 * frase de leigo.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { credenciaisSupabaseDeTeste } from "../../scripts/lib/env-de-teste";
import { lerCreds, loginComoAdmin } from "./helpers/login-admin";

const { url, serviceRole } = credenciaisSupabaseDeTeste();
const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

const EVIDENCIA = path.join(process.cwd(), "evidence", "cobranca-suspensa-por-falta-de-pagamento");
function evidencia(nome: string): string {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  return path.join(EVIDENCIA, nome);
}

const NOME_DO_PLANO = `Standard e2e régua ${Date.now().toString(36)}`;
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
  if (orgId) {
    await admin.rpc("fn_reativar_organizacao", { p_org: orgId, p_kind_exigido: "cobranca", p_ator: null });
    await admin.from("cobranca_assinaturas").delete().eq("organization_id", orgId);
  }
  if (planoId) await admin.from("cobranca_planos").delete().eq("id", planoId);
  await admin.from("platform_config").delete().eq("chave", "MODULO_COBRANCA");
}

test.describe("Empresa suspensa por falta de pagamento (#160c)", () => {
  test.beforeAll(async () => {
    orgId = await orgDoAdmin();
    await admin.from("cobranca_assinaturas").delete().eq("organization_id", orgId);
    const { data: plano, error } = await admin
      .from("cobranca_planos")
      .insert({ nome: NOME_DO_PLANO, preco_cents: 12900, intervalo: "mes", trial_dias: 14 })
      .select("id")
      .single();
    if (error || !plano) throw new Error(`plano do e2e: ${error?.message}`);
    planoId = (plano as { id: string }).id;
    await admin.from("cobranca_assinaturas").insert({
      organization_id: orgId,
      plano_id: planoId,
      estado: "em_atraso",
      vencida_desde: new Date(Date.now() - 10 * 86_400_000).toISOString(),
    });
    await admin
      .from("platform_config")
      .upsert({ chave: "MODULO_COBRANCA", valor: "ligado", eh_segredo: false, semeado_do_env: false }, { onConflict: "chave" });
    const { data: r, error: erroSusp } = await admin.rpc("fn_cobranca_suspender_se_devendo", {
      p_org: orgId,
      p_motivo: "Falta de pagamento",
    });
    if (erroSusp || !(r as { changed?: boolean } | null)?.changed) throw new Error(`suspensão do e2e: ${erroSusp?.message ?? JSON.stringify(r)}`);
  });
  test.afterAll(limpar);

  test("quem administra vê o caminho para pagar; sem provedor, a frase de leigo", async ({ page }) => {
    test.setTimeout(120_000);
    await loginComoAdmin(page, lerCreds());
    await page.goto("/app");
    await expect(page).toHaveURL(/\/account-suspended/, { timeout: 30_000 });
    await expect(page.getByText(/suspensa por falta de pagamento/i)).toBeVisible();
    await expect(page.getByTestId("hub-pagamento")).toBeVisible();
    await expect(page.getByText(NOME_DO_PLANO)).toBeVisible();
    await page.screenshot({ path: evidencia("1-hub-de-pagamento.png"), fullPage: true });

    await page.getByRole("button", { name: /^assinar/i }).first().click();
    await expect(page.getByText(/ainda não conectou a cobrança/i).first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: evidencia("2-assinar-sem-provedor.png"), fullPage: true });
  });
});
