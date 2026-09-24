/**
 * FORK clinic (migration 9005) — a trava de horário duplicado, PELA TELA:
 *
 *   1. o admin liga "Trava de horário duplicado" em Configurações › Profissionais;
 *   2. duas marcações que se cruzam na agenda do mesmo profissional saem AO MESMO
 *      TEMPO (como a recepção e o agente de IA) — exatamente uma é gravada, a
 *      outra recebe 422 `agenda_horario_indisponivel`;
 *   3. a agenda mostra um compromisso só naquele horário;
 *   4. desliga a trava (deixa o ambiente como achou).
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "trava-de-sobreposicao");

interface Creds {
  users: Record<string, { email: string; id?: string } | undefined>;
  agenda?: { tipo_nome: string };
}

const creds = JSON.parse(fs.readFileSync(path.join(RAIZ, ".e2e-creds.json"), "utf8")) as Creds;

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

async function ligarTrava(page: Page, ligar: boolean): Promise<void> {
  await page.goto("/app/settings/tenant/profissionais");
  const bloco = page.getByRole("main").getByTestId("clinic-trava");
  await expect(bloco).toBeVisible({ timeout: 20_000 });
  const ligada = await bloco.getByText("Trava de horário duplicado ligada").isVisible();
  if (ligada !== ligar) {
    await page.getByRole("main").getByTestId("clinic-trava-alternar").click();
    await expect(bloco.getByText(ligar ? "Trava de horário duplicado ligada" : "Trava de horário duplicado desligada")).toBeVisible();
  }
}

test("trava de horário duplicado: duas marcações simultâneas, uma só gravada — pela tela", async ({ page }) => {
  test.setTimeout(180_000);
  if (!creds.agenda || !creds.users.agent?.id) throw new Error(".e2e-creds.json sem agenda/agent");
  await loginComoAdmin(page, creds as unknown as CredsE2E);

  // ── 1. liga a trava ────────────────────────────────────────────────────────
  await ligarTrava(page, true);
  await foto(page, "01-trava-ligada");

  // ── 2. duas marcações que se cruzam, ao mesmo tempo ───────────────────────
  const tipos = ((await (await page.request.get("/api/v1/agenda/tipos")).json()) as { data: { id: string; name: string }[] }).data;
  const tipo = tipos.find((t) => t.name === creds.agenda!.tipo_nome);
  if (!tipo) throw new Error("tipo semeado não encontrado");
  const de = new Date(Date.now() + 3 * 86_400_000).toISOString();
  const ate = new Date(Date.now() + 13 * 86_400_000).toISOString();
  const livres = (await (
    await page.request.get(`/api/v1/agenda/horarios-livres?event_type_id=${tipo.id}&owner_user_id=${creds.users.agent.id}&de=${de}&ate=${ate}`)
  ).json()) as { data?: { slots: { inicio: string }[] } };
  const slot = livres.data?.slots?.[7] ?? livres.data?.slots?.[0];
  if (!slot) throw new Error("nenhum horário livre para o teste");
  // A segunda começa 10 min depois: cruza a primeira sem ter o MESMO início (esse
  // caso o índice único do núcleo já cobria antes da trava).
  const inicioB = new Date(new Date(slot.inicio).getTime() + 10 * 60_000).toISOString();
  const marcar = (inicio: string) =>
    page.request.post("/api/v1/agenda/agendamentos", {
      data: { event_type_id: tipo.id, starts_at: inicio, owner_user_id: creds.users.agent!.id },
    });
  const [a, b] = await Promise.all([marcar(slot.inicio), marcar(inicioB)]);
  const status = [a.status(), b.status()].sort();
  expect(status, `${await a.text()} | ${await b.text()}`).toEqual([201, 422]);
  const recusada = a.status() === 422 ? a : b;
  expect(((await recusada.json()) as { error: { code: string } }).error.code).toBe("agenda_horario_indisponivel");
  const gravada = a.status() === 201 ? a : b;
  const gravadaId = ((await gravada.json()) as { data: { id: string } }).data.id;

  // ── 3. a agenda mostra um compromisso só naquele horário ──────────────────
  const naJanela = (await (
    await page.request.get(
      `/api/v1/agenda/agendamentos?de=${new Date(new Date(slot.inicio).getTime() - 60_000).toISOString()}&ate=${new Date(new Date(slot.inicio).getTime() + 3_600_000).toISOString()}`,
    )
  ).json()) as { data: { id: string; donoId: string | null; situacao?: string }[] };
  const doProfissional = naJanela.data.filter((c) => c.donoId === creds.users.agent!.id && c.situacao !== "cancelled");
  expect(doProfissional.map((c) => c.id)).toEqual([gravadaId]);

  await page.goto(`/app/agenda?compromisso=${gravadaId}`);
  await expect(page.getByTestId("visita-do-paciente").or(page.getByRole("dialog")).first()).toBeVisible({ timeout: 20_000 });
  await foto(page, "02-um-compromisso-so");

  // limpa o compromisso do teste (o horário volta a ficar livre para a próxima rodada)
  const cancelado = await page.request.delete("/api/v1/agenda/agendamentos", {
    data: { id: gravadaId, reason: "limpeza do teste e2e" },
  });
  expect(cancelado.status(), await cancelado.text()).toBe(200);

  // ── 4. deixa o ambiente como achou ────────────────────────────────────────
  await ligarTrava(page, false);
});
