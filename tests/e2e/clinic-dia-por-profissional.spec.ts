/**
 * FORK clinic (E1.4) — o dia por profissional, PELA TELA:
 *
 *   1. com as regras de profissionais ligadas, a Agenda mostra o botão
 *      "Dia por profissional";
 *   2. num dia com jornada, a coluna do profissional mostra a jornada, o
 *      bloqueio (com o motivo) e o compromisso marcado, em ordem de horário;
 *   3. o compromisso leva ao detalhe na Agenda;
 *   4. desfaz tudo (bloqueio, compromisso e módulo).
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "dia-por-profissional");
const FUSO = "America/Sao_Paulo";

interface Creds {
  users: Record<string, { email: string; id?: string } | undefined>;
  agenda?: { tipo_nome: string };
}

const creds = JSON.parse(fs.readFileSync(path.join(RAIZ, ".e2e-creds.json"), "utf8")) as Creds;

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

async function modulo(page: Page, ligar: boolean): Promise<void> {
  await page.goto("/app/settings/tenant/profissionais");
  const bloco = page.getByTestId("clinic-modulo");
  await expect(bloco).toBeVisible({ timeout: 20_000 });
  const ligado = await bloco.getByText("Regras de profissionais ligadas").isVisible();
  if (ligado !== ligar) {
    await page.getByTestId("clinic-modulo-alternar").click();
    await expect(bloco.getByText(ligar ? "Regras de profissionais ligadas" : "Regras de profissionais desligadas")).toBeVisible();
  }
}

const diaLocal = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

test("dia por profissional: jornada, bloqueio e compromisso lado a lado — pela tela", async ({ page }) => {
  test.setTimeout(180_000);
  if (!creds.agenda || !creds.users.agent?.id) throw new Error(".e2e-creds.json sem agenda/agent");
  const agente = creds.users.agent.id;
  await loginComoAdmin(page, creds as unknown as CredsE2E);
  const tipos = ((await (await page.request.get("/api/v1/agenda/tipos")).json()) as { data: { id: string; name: string }[] }).data;
  const tipoId = tipos.find((t) => t.name === creds.agenda!.tipo_nome)!.id;
  expect((await page.request.put(`/api/v1/clinic/tipos/${tipoId}/especialidades`, { data: { specialty_ids: [] } })).status()).toBe(200);
  await modulo(page, true);

  // ── um dia com jornada: o primeiro horário livre do atendente ─────────────
  const agora = Date.now();
  const livres = (await (
    await page.request.get(
      `/api/v1/agenda/horarios-livres?event_type_id=${tipoId}&owner_user_id=${agente}` +
        `&de=${new Date(agora + 2 * 86_400_000).toISOString()}&ate=${new Date(agora + 12 * 86_400_000).toISOString()}`,
    )
  ).json()) as { data: { slots: { inicio: string }[] } };
  const slot = livres.data.slots[2] ?? livres.data.slots[0];
  if (!slot) throw new Error("nenhum horário livre para o teste");
  const dia = diaLocal(slot.inicio);

  const marcado = await page.request.post("/api/v1/agenda/agendamentos", {
    data: { event_type_id: tipoId, starts_at: slot.inicio, owner_user_id: agente },
  });
  expect(marcado.status(), await marcado.text()).toBe(201);
  const agendamentoId = ((await marcado.json()) as { data: { id: string } }).data.id;

  const bloqueio = await page.request.post("/api/v1/clinic/bloqueios", {
    data: { user_id: agente, starts_on: dia, ends_on: dia, start_minute: 1140, end_minute: 1200, reason: "Curso E2E" },
  });
  expect(bloqueio.status(), await bloqueio.text()).toBe(201);
  const bloqueioId = ((await bloqueio.json()) as { data: { id: string } }).data.id;

  // ── 1. a porta na Agenda ──────────────────────────────────────────────────
  await page.goto("/app/agenda");
  await page.getByTestId("agenda-abrir-dia-por-profissional").click();
  await expect(page).toHaveURL(/\/app\/agenda\/profissionais/);
  await page.getByTestId("dia-por-profissional-data").fill(dia);
  await expect(page).toHaveURL(new RegExp(`dia=${dia}`));

  // ── 2. a coluna do atendente ──────────────────────────────────────────────
  const coluna = page.locator(`[data-testid="coluna-do-profissional"][data-profissional="${agente}"]`);
  await expect(coluna).toBeVisible({ timeout: 20_000 });
  await expect(coluna.getByTestId("jornada-do-dia")).toHaveText(/\d{2}:\d{2}–\d{2}:\d{2}/);
  await expect(coluna.getByTestId("bloqueio-do-dia").filter({ hasText: "Curso E2E" })).toContainText("19:00–20:00 · Bloqueado");
  const compromisso = coluna.locator(`[data-testid="compromisso-do-dia"][href="/app/agenda?compromisso=${agendamentoId}"]`);
  await expect(compromisso).toBeVisible();
  await foto(page, "01-dia-por-profissional");

  // ── 3. o compromisso leva ao detalhe ──────────────────────────────────────
  await compromisso.click();
  await expect(page).toHaveURL(new RegExp(`compromisso=${agendamentoId}`));

  // ── 4. desfaz ─────────────────────────────────────────────────────────────
  expect((await page.request.delete("/api/v1/clinic/bloqueios", { data: { id: bloqueioId } })).status()).toBe(200);
  expect(
    (await page.request.delete("/api/v1/agenda/agendamentos", { data: { id: agendamentoId, reason: "limpeza do teste e2e" } })).status(),
  ).toBe(200);
  await modulo(page, false);
});
