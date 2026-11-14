/**
 * FORK clinic (migration 9001) — profissionais, especialidades e bloqueios,
 * provados PELA TELA como a gerência de uma clínica faria.
 *
 * Cada ação é feita na interface (Configurações › Profissionais e
 * especialidades, e a tela da Agenda). O EFEITO é medido na mesma rota de
 * horários livres que a tela de marcar e o agente de IA consultam — é ela que
 * decide o que o paciente recebe como oferta.
 *
 * Roteiro:
 *   0. módulo desligado: fotografa os horários do atendente (a régua do fim);
 *   1. liga o módulo, cria a especialidade, exige-a no tipo semeado;
 *   2. ninguém habilitado → a consulta recusa e a Agenda avisa;
 *   3. ficha do atendente com a especialidade → horários voltam;
 *   4. bloqueio de PERÍODO (2 dias) e RECORRENTE (14h–16h) pela tela → somem;
 *   5. desfaz tudo e desliga → horários idênticos aos do passo 0.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "clinic-profissionais");
const FUSO = "America/Sao_Paulo";

interface Creds {
  password: string;
  users: Record<string, { email: string; id?: string } | undefined>;
  agenda?: { tipo_nome: string; tipo_slug: string; tipo_id?: string };
}

function lerCreds(): Creds {
  const p = path.join(RAIZ, ".e2e-creds.json");
  if (!fs.existsSync(p)) throw new Error("`.e2e-creds.json` ausente — rode `scripts/seed-e2e-credentials.ts`");
  let c = JSON.parse(fs.readFileSync(p, "utf8")) as Creds;
  if (!c.agenda) {
    execFileSync("npx", ["tsx", "scripts/seed-e2e-agenda.ts"], { stdio: "inherit" });
    c = JSON.parse(fs.readFileSync(p, "utf8")) as Creds;
  }
  return c;
}

/** YYYY-MM-DD de um Date, no fuso da clínica. */
function dia(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
}

/** A terça-feira da semana seguinte e os dois dias úteis depois dela. */
function diasDoTeste(): [string, string, string] {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1);
  const um = new Date(d.getTime() + 86_400_000);
  const dois = new Date(d.getTime() + 2 * 86_400_000);
  return [dia(d), dia(um), dia(dois)];
}

type Consulta = { status: number; codigo?: string; porDia: Record<string, string[]> };

async function horarios(page: Page, tipoId: string, donoId: string, de: string, ate: string): Promise<Consulta> {
  const qs = new URLSearchParams({
    event_type_id: tipoId,
    owner_user_id: donoId,
    de: new Date(`${de}T00:00:00-03:00`).toISOString(),
    ate: new Date(`${ate}T23:59:00-03:00`).toISOString(),
  });
  const r = await page.request.get(`/api/v1/agenda/horarios-livres?${qs}`);
  const corpo = (await r.json()) as { data?: { slots: { inicio: string }[] }; error?: { code: string } };
  const porDia: Record<string, string[]> = {};
  for (const s of corpo.data?.slots ?? []) (porDia[dia(new Date(s.inicio))] ??= []).push(hora(s.inicio));
  return { status: r.status(), codigo: corpo.error?.code, porDia };
}

async function tipoIdPeloNome(page: Page, nome: string): Promise<string> {
  const r = await page.request.get("/api/v1/agenda/tipos");
  const lista = ((await r.json()) as { data: { id: string; name: string }[] }).data;
  const tipo = lista.find((t) => t.name === nome);
  if (!tipo) throw new Error(`tipo "${nome}" não encontrado`);
  return tipo.id;
}

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

test("clínica cadastra especialidade, habilita profissional e bloqueia a agenda — tudo pela tela", async ({ page }) => {
  test.setTimeout(180_000);
  const creds = lerCreds();
  const admin = creds.users.admin;
  const atendente = creds.users.agent;
  if (!admin || !atendente?.id || !creds.agenda) throw new Error(".e2e-creds.json incompleto (admin, agent.id, agenda)");
  const nomeDoTipo = creds.agenda.tipo_nome;
  const especialidade = `Harmonização E2E ${Date.now().toString(36)}`;
  const [d1, d2, d3] = diasDoTeste();

  // O admin do seed tem TOTP: o helper prova o segundo fator — e é essa sessão
  // aal2 que `fn_clinic_definir_flag` exige para ligar o módulo.
  await loginComoAdmin(page, creds as unknown as CredsE2E);

  const tipoId = await tipoIdPeloNome(page, nomeDoTipo);

  // Estado limpo — o banco do E2E é compartilhado e uma rodada interrompida
  // deixaria exigência no tipo e bloqueios de pé, mudando o que se mede aqui.
  expect((await page.request.put(`/api/v1/clinic/tipos/${tipoId}/especialidades`, { data: { specialty_ids: [] } })).status()).toBe(200);
  const sobras = ((await (await page.request.get("/api/v1/clinic/bloqueios")).json()) as { data: { id: string; reason: string | null }[] }).data;
  for (const b of sobras.filter((x) => x.reason?.includes("E2E"))) {
    await page.request.delete("/api/v1/clinic/bloqueios", { data: { id: b.id } });
  }

  // ── 0. módulo desligado: a régua ───────────────────────────────────────────
  await page.goto("/app/settings/tenant/profissionais");
  const modulo = page.getByRole("main").getByTestId("clinic-modulo");
  await expect(modulo).toBeVisible({ timeout: 20_000 });
  if (await modulo.getByText("Regras de profissionais ligadas").isVisible()) {
    await page.getByRole("main").getByTestId("clinic-modulo-alternar").click();
    await expect(modulo.getByText("Regras de profissionais desligadas")).toBeVisible();
  }
  const antes = await horarios(page, tipoId, atendente.id, d1, d3);
  expect(antes.status).toBe(200);
  expect(antes.porDia[d1]?.length ?? 0, `sem horários em ${d1} — a jornada semeada não cobre a terça?`).toBeGreaterThan(0);
  await foto(page, "00-modulo-desligado");

  // ── 1. liga, cria a especialidade e exige-a no tipo ────────────────────────
  await page.getByRole("main").getByTestId("clinic-modulo-alternar").click();
  await expect(modulo.getByText("Regras de profissionais ligadas")).toBeVisible();

  await page.getByRole("tab", { name: "Especialidades" }).click();
  await page.getByTestId("nova-especialidade").fill(especialidade);
  await page.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByTestId("especialidade").filter({ hasText: especialidade })).toBeVisible();

  await page.getByRole("tab", { name: "Atendimentos" }).click();
  const linhaDoTipo = page.getByTestId("exigencias-do-tipo").filter({ hasText: nomeDoTipo });
  const exigir = page.waitForResponse((r) => r.url().includes(`/api/v1/clinic/tipos/${tipoId}/especialidades`) && r.request().method() === "PUT");
  await linhaDoTipo.getByLabel(especialidade).check();
  expect((await exigir).status()).toBe(200);
  await expect(linhaDoTipo.getByText("Só quem tem uma das especialidades marcadas.")).toBeVisible();
  await foto(page, "01-tipo-exige-especialidade");

  // ── 2. ninguém habilitado ──────────────────────────────────────────────────
  const semNinguem = await horarios(page, tipoId, atendente.id, d1, d3);
  expect(semNinguem.status).toBe(422);
  expect(semNinguem.codigo).toBe("validation_failed");

  await page.goto("/app/agenda");
  await expect(page.getByTestId("tela-agenda").first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /novo agendamento/i }).click();
  await expect(page.getByTestId("painel-de-marcacao")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: new RegExp(`^${nomeDoTipo}`) }).click();
  await expect(page.getByTestId("clinic-sem-habilitados")).toBeVisible({ timeout: 10_000 });
  await foto(page, "02-agenda-sem-habilitados");

  // ── 3. habilita o atendente pela ficha ─────────────────────────────────────
  await page.goto("/app/settings/tenant/profissionais");
  const linhaDoAtendente = page.getByTestId("profissional").filter({ hasText: "E2E Agent" });
  await linhaDoAtendente.getByRole("button", { name: /Criar ficha|Editar ficha/ }).click();
  const ficha = page.getByTestId("ficha-do-profissional");
  await ficha.getByLabel("Conselho").selectOption("CRBM");
  await ficha.getByLabel("Número do registro").fill("12345");
  await ficha.getByLabel("UF", { exact: true }).fill("SP");
  await ficha.getByLabel(especialidade).check();
  // Espera o POST, e não o nome na linha: o formulário aberto também mostra o
  // nome da especialidade, e a checagem passaria antes de salvar.
  const salvarFicha = page.waitForResponse(
    (r) => r.url().endsWith("/api/v1/clinic/profissionais") && r.request().method() === "POST",
  );
  await ficha.getByRole("button", { name: "Salvar" }).click();
  expect((await salvarFicha).status()).toBe(200);
  await expect(ficha).toHaveCount(0);
  await expect(linhaDoAtendente.getByText(especialidade)).toBeVisible();
  await foto(page, "03-ficha-do-profissional");

  const habilitado = await horarios(page, tipoId, atendente.id, d1, d3);
  expect(habilitado.status).toBe(200);
  expect(habilitado.porDia).toEqual(antes.porDia);

  await page.goto("/app/agenda");
  await page.getByRole("button", { name: /novo agendamento/i }).click();
  await page.getByRole("button", { name: new RegExp(`^${nomeDoTipo}`) }).click();
  await expect(page.getByTestId("clinic-profissional")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("clinic-profissional").locator("option")).toHaveText(["E2E Agent"]);
  await foto(page, "04-agenda-so-habilitados");

  // ── 4. bloqueios pela tela ─────────────────────────────────────────────────
  await page.goto("/app/settings/tenant/profissionais");
  await page.getByRole("tab", { name: "Bloqueios" }).click();
  const bloqueios = page.getByTestId("clinic-bloqueios");
  await bloqueios.getByTestId("bloqueio-quem").selectOption(atendente.id);
  await bloqueios.getByTestId("bloqueio-de").fill(d1);
  await bloqueios.getByTestId("bloqueio-ate").fill(d2);
  await bloqueios.getByLabel("Motivo (opcional)").fill("Congresso E2E");
  await bloqueios.getByTestId("bloqueio-salvar").click();
  await expect(bloqueios.getByTestId("bloqueio").filter({ hasText: "Congresso E2E" })).toBeVisible();

  const quinta = new Date(`${d3}T12:00:00-03:00`).getUTCDay();
  await bloqueios.getByTestId("bloqueio-quem").selectOption(atendente.id);
  await bloqueios.getByTestId("bloqueio-de").fill(d1);
  await bloqueios.getByTestId("bloqueio-ate").fill(d3);
  await bloqueios.getByLabel("Dia inteiro").uncheck();
  await bloqueios.getByLabel("Das").fill("14:00");
  await bloqueios.getByLabel("Às").fill("16:00");
  await bloqueios.getByLabel(["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][quinta] ?? "Qui").check();
  await bloqueios.getByLabel("Motivo (opcional)").fill("Reunião semanal E2E");
  await bloqueios.getByTestId("bloqueio-salvar").click();
  await expect(bloqueios.getByTestId("bloqueio").filter({ hasText: "Reunião semanal E2E" })).toBeVisible();
  await foto(page, "05-bloqueios");

  const bloqueado = await horarios(page, tipoId, atendente.id, d1, d3);
  expect(bloqueado.status).toBe(200);
  expect(bloqueado.porDia[d1] ?? []).toEqual([]);
  expect(bloqueado.porDia[d2] ?? []).toEqual([]);
  const esperadoD3 = (antes.porDia[d3] ?? []).filter((h) => h < "14:00" || h >= "16:00");
  expect(bloqueado.porDia[d3]).toEqual(esperadoD3);
  expect(esperadoD3.length).toBeLessThan((antes.porDia[d3] ?? []).length);

  // ── 5. desfaz e desliga: a agenda volta a ser a do upstream ────────────────
  for (const motivo of ["Congresso E2E", "Reunião semanal E2E"]) {
    await bloqueios.getByTestId("bloqueio").filter({ hasText: motivo }).getByRole("button", { name: "Remover" }).click();
    await expect(bloqueios.getByTestId("bloqueio").filter({ hasText: motivo })).toHaveCount(0);
  }
  await page.getByRole("tab", { name: "Atendimentos" }).click();
  const desfazer = page.waitForResponse((r) => r.url().includes(`/api/v1/clinic/tipos/${tipoId}/especialidades`) && r.request().method() === "PUT");
  await page.getByTestId("exigencias-do-tipo").filter({ hasText: nomeDoTipo }).getByLabel(especialidade).uncheck();
  expect((await desfazer).status()).toBe(200);
  await page.getByRole("main").getByTestId("clinic-modulo-alternar").click();
  await expect(modulo.getByText("Regras de profissionais desligadas")).toBeVisible();

  const depois = await horarios(page, tipoId, atendente.id, d1, d3);
  expect(depois.status).toBe(200);
  expect(depois.porDia).toEqual(antes.porDia);
  await foto(page, "06-desligado-igual-ao-inicio");
});
