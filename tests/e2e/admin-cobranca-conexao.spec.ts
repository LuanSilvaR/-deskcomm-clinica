/**
 * COBRANÇA — A CONEXÃO COM O PROVEDOR PELA TELA (FORK, card #160a).
 *
 * Prova pela tela o portão que vem ANTES de qualquer chave: o provedor só
 * entrega aviso de pagamento num endereço https público. Na bancada do e2e o
 * app roda em http://localhost, então a tela diz isso antes do clique e o botão
 * "Testar e conectar" fica travado — nenhuma chave sai para provedor nenhum.
 * Asaas é o padrão (Pix e boleto). Banco compartilhado: liga e desliga o módulo.
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

const EVIDENCIA = path.join(process.cwd(), "evidence", "admin-cobranca-conexao");
function evidencia(nome: string): string {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  return path.join(EVIDENCIA, nome);
}

async function desligar(): Promise<void> {
  await admin.from("platform_config").delete().eq("chave", "MODULO_COBRANCA");
}

test.describe("Cobrança — Conexão com o provedor (#160a)", () => {
  test.beforeAll(async () => {
    await afirmarDonoDoServidor(lerCreds().users.dono!.email);
    await admin
      .from("platform_config")
      .upsert({ chave: "MODULO_COBRANCA", valor: "ligado", eh_segredo: false, semeado_do_env: false }, { onConflict: "chave" });
  });
  test.afterAll(desligar);

  test("sem https público, a tela avisa antes do clique e não deixa conectar", async ({ page }) => {
    test.setTimeout(90_000);
    await loginComoDono(page, lerCreds());
    await page.goto("/admin/cobranca");
    const conexao = page.getByTestId("conexao-da-cobranca");
    await expect(conexao).toBeVisible();
    await expect(page.locator("#provedor")).toHaveValue("asaas");
    await expect(conexao.getByRole("alert")).toContainText(/endereço https público/i);
    await page.locator("#chave-secreta").fill("$aact_hmlg_chave_de_teste_que_nao_sai_daqui");
    await expect(page.getByRole("button", { name: /testar e conectar/i })).toBeDisabled();
    await page.screenshot({ path: evidencia("1-conexao-sem-https.png"), fullPage: true });
  });
});
