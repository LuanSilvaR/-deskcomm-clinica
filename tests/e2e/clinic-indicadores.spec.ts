/**
 * FORK clinic (épico E6) — indicadores da agenda, PELA TELA:
 *
 *   1. Faltas → "Ver indicadores da agenda";
 *   2. um atendimento realizado e uma falta nos últimos 7 dias entram na conta
 *      (a spec mede a DIFERENÇA: o banco de teste tem dados de outras specs);
 *   3. a tabela por profissional mostra a linha do profissional com ocupação;
 *   4. trocar o período para 90 dias nunca conta menos que 7.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "indicadores");

interface Creds {
  org_id: string;
  users: Record<string, { email: string; id?: string } | undefined>;
}

const creds = JSON.parse(fs.readFileSync(path.join(RAIZ, ".e2e-creds.json"), "utf8")) as Creds;

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(URL_SUPABASE)) {
  throw new Error(`Supabase não é local (${URL_SUPABASE}) — esta spec só roda no ambiente de teste.`);
}
const admin = createClient(URL_SUPABASE, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface Resposta {
  data: { faltas: number; realizados: number; agendados: number; por_profissional: { profissional_id: string; faltas: number; realizados: number }[] };
}

async function indicadores(page: Page, dias: number): Promise<Resposta["data"]> {
  const r = await page.request.get(`/api/v1/clinic/indicadores?dias=${dias}`);
  expect(r.status(), await r.text()).toBe(200);
  return ((await r.json()) as Resposta).data;
}

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

test("indicadores da agenda: faltas e realizados entram na conta — pela tela", async ({ page }) => {
  test.setTimeout(180_000);
  const dono = creds.users.agent?.id;
  if (!dono) throw new Error(".e2e-creds.json sem agent");
  await loginComoAdmin(page, creds as unknown as CredsE2E);

  const antes = await indicadores(page, 7);
  const antesDoDono = antes.por_profissional.find((p) => p.profissional_id === dono) ?? { faltas: 0, realizados: 0 };

  // ── um realizado e uma falta há 2 dias ──────────────────────────────────
  const linha = (horas: number, status: string) => {
    const inicio = new Date(Date.now() - 2 * 86_400_000 + horas * 3_600_000);
    return {
      organization_id: creds.org_id,
      title: "Consulta indicadores E2E",
      starts_at: inicio.toISOString(),
      ends_at: new Date(inicio.getTime() + 30 * 60_000).toISOString(),
      owner_user_id: dono,
      status,
    };
  };
  const { error } = await admin.from("calendar_appointments").insert([linha(0, "completed"), linha(1, "no_show")]);
  if (error) throw new Error(`compromissos: ${error.message}`);

  // ── 1. a porta ───────────────────────────────────────────────────────────
  await page.goto("/app/agenda/faltas");
  await page.getByTestId("faltas-abrir-indicadores").click();
  await expect(page).toHaveURL(/\/app\/agenda\/indicadores/);
  await page.getByTestId("periodo-7").click();
  await expect(page.getByTestId("indicador-faltas")).toBeVisible({ timeout: 20_000 });

  // ── 2. a diferença ───────────────────────────────────────────────────────
  const depois = await indicadores(page, 7);
  expect(depois.faltas - antes.faltas).toBe(1);
  expect(depois.realizados - antes.realizados).toBe(1);
  const doDono = depois.por_profissional.find((p) => p.profissional_id === dono)!;
  expect(doDono.faltas - antesDoDono.faltas).toBe(1);
  expect(doDono.realizados - antesDoDono.realizados).toBe(1);
  await expect(page.getByTestId("indicador-faltas")).toContainText(`Faltas: ${depois.faltas} · Realizados: ${depois.realizados}`);

  // ── 3. a linha do profissional ───────────────────────────────────────────
  const linhaDoDono = page.locator(`[data-testid="indicadores-do-profissional"][data-profissional="${dono}"]`);
  await expect(linhaDoDono).toBeVisible();
  await expect(linhaDoDono.getByTestId("ocupacao")).toHaveText(/\d+\s?%|—/);
  await foto(page, "01-indicadores-7-dias");

  // ── 4. 90 dias nunca conta menos que 7 ──────────────────────────────────
  await page.getByTestId("periodo-90").click();
  await expect(page.getByTestId("periodo-90")).toHaveAttribute("aria-pressed", "true");
  const noventa = await indicadores(page, 90);
  expect(noventa.agendados).toBeGreaterThanOrEqual(depois.agendados);
  await foto(page, "02-indicadores-90-dias");
});
