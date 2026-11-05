/**
 * FORK clinic (agenda S6a, issue #69) — as ações da agenda pela CHAVE, PELA TELA, sobre o
 * seed de demonstração: Dr. Bruno ("Profissional de saúde": só agenda.ver + bloquear_horario)
 * e Dra. Ana (gerente: todas as chaves da agenda).
 *
 *   C14 — Bruno não vê Remarcar/Cancelar/Confirmar/Faltou na lista; PATCH/DELETE direto = 403
 *         com a chave em details.permissao;
 *   C15 — sem agenda.ver_outros: sem o menu "Dia por profissional", a página redireciona para a
 *         própria agenda e a rota do dia por profissional dá 403;
 *   C17 — Ana (gerente) segue vendo as ações e a porta.
 *
 * FORA DO CI (motivo no e2e.yml): depende do seed de demonstração.
 * Rodar contra a 3001: `DEMO_SENHA=… pnpm exec playwright test clinic-agenda-acl`.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "agenda-acl");
const SENHA = process.env.DEMO_SENHA ?? "";
const ID_FICTICIO = "00000000-0000-4000-8000-000000000000";

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

async function entrar(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(SENHA);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/app(\/|$)/, { timeout: 30_000 });
}

test.beforeAll(() => {
  if (!SENHA) throw new Error("DEMO_SENHA ausente — a senha dos usuários do seed de demonstração");
});

test("profissional: sem ações da agenda na tela, 403 na API, sem dia por profissional", async ({ page }) => {
  test.setTimeout(180_000);
  await entrar(page, "dr.bruno@clinica-demo.test");

  await page.goto("/app/agenda");
  await expect(page.getByRole("heading", { name: "Minha agenda" })).toBeVisible({ timeout: 60_000 });
  // C14: nenhuma ação de linha na lista (o seed dá ao Bruno compromissos próximos e passados)
  for (const prefixo of ["remarcar-", "cancelar-", "confirmar-", "faltou-", "realizado-"]) {
    await expect(page.locator(`[data-testid^="${prefixo}"]`)).toHaveCount(0);
  }
  await foto(page, "01-bruno-lista-sem-acoes");

  // C14: a API recusa pela chave, antes de procurar o compromisso
  const casos: Array<[string, "patch" | "delete", Record<string, unknown>, string]> = [
    ["remarcar", "patch", { id: ID_FICTICIO, starts_at: "2026-12-01T10:00:00-03:00" }, "agenda.remarcar"],
    ["desfecho", "patch", { id: ID_FICTICIO, status: "no_show" }, "agenda.registrar_desfecho"],
    ["cancelar", "delete", { id: ID_FICTICIO, reason: "teste de permissão" }, "agenda.cancelar"],
  ];
  for (const [, metodo, corpo, chave] of casos) {
    const r = await page.request[metodo]("/api/v1/agenda/agendamentos", { data: corpo });
    expect(r.status()).toBe(403);
    const j = (await r.json()) as { error: { code: string; details?: { permissao?: string } } };
    expect(j.error.code).toBe("forbidden_permission");
    expect(j.error.details?.permissao).toBe(chave);
  }

  // C15: sem a porta no menu, página por URL volta à própria agenda, rota = 403
  const nav = page.getByRole("navigation").first();
  await expect(nav.getByRole("link", { name: /Dia por profissional/ })).toHaveCount(0);
  await page.goto("/app/agenda/profissionais");
  await page.waitForURL(/\/app\/agenda(\?|$)/, { timeout: 30_000 });
  const dia = await page.request.get("/api/v1/clinic/dia-por-profissional");
  expect(dia.status()).toBe(403);
  await foto(page, "02-bruno-dia-por-profissional-volta");
});

test("gerente: vê as ações e a porta do dia por profissional", async ({ page }) => {
  test.setTimeout(180_000);
  await entrar(page, "dra.ana@clinica-demo.test");

  await page.goto("/app/agenda");
  await expect(page.getByRole("heading", { name: "Agenda", exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-testid^="remarcar-"]').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid^="cancelar-"]').first()).toBeEnabled();
  await foto(page, "03-ana-lista-com-acoes");

  await page.goto("/app/agenda/profissionais");
  await expect(page.getByRole("heading", { name: "Dia por profissional" })).toBeVisible({ timeout: 60_000 });
  const dia = await page.request.get("/api/v1/clinic/dia-por-profissional");
  expect(dia.status()).toBe(200);
  await foto(page, "04-ana-dia-por-profissional");
});
