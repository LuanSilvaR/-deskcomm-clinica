/**
 * FORK clinic (E1.3) — o primeiro horário livre entre os profissionais, PELA TELA:
 *
 *   1. com as regras de profissionais ligadas, "Novo agendamento" mostra
 *      "Próximos horários livres": o primeiro horário de cada profissional que
 *      pode fazer o atendimento;
 *   2. o horário é o MESMO que a consulta de horários livres (grade e IA)
 *      devolve para aquele profissional;
 *   3. um clique escolhe profissional e horário; confirmar marca na agenda dele;
 *   4. cancela o compromisso e desliga o módulo (deixa o ambiente como achou).
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "proximo-livre");

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

test("próximo horário livre entre os profissionais: um clique escolhe quem e quando — pela tela", async ({ page }) => {
  test.setTimeout(180_000);
  if (!creds.agenda || !creds.users.agent?.id) throw new Error(".e2e-creds.json sem agenda/agent");
  await loginComoAdmin(page, creds as unknown as CredsE2E);
  const nomeDoTipo = creds.agenda.tipo_nome;
  const tipos = ((await (await page.request.get("/api/v1/agenda/tipos")).json()) as { data: { id: string; name: string }[] }).data;
  const tipoId = tipos.find((t) => t.name === nomeDoTipo)!.id;
  // O tipo semeado não exige especialidade nesta spec: quem publicou jornada serve.
  expect((await page.request.put(`/api/v1/clinic/tipos/${tipoId}/especialidades`, { data: { specialty_ids: [] } })).status()).toBe(200);

  // ── 1. liga o módulo e abre a marcação ────────────────────────────────────
  await modulo(page, true);
  await page.goto("/app/agenda");
  await expect(page.getByTestId("tela-agenda").first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /novo agendamento/i }).click();
  await expect(page.getByTestId("painel-de-marcacao")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: new RegExp(`^${nomeDoTipo}`) }).click();

  const lista = page.getByTestId("clinic-proximos-livres");
  const primeiro = lista.getByTestId("clinic-proximo-livre").first();
  await expect(primeiro).toBeVisible({ timeout: 20_000 });
  await foto(page, "01-proximos-horarios-livres");

  // ── 2. é o mesmo horário que a consulta da grade e da IA devolve ──────────
  const api = (await (await page.request.get(`/api/v1/clinic/proximos-livres?event_type_id=${tipoId}`)).json()) as {
    data: { proximos: { profissional_id: string; inicio: string }[] };
  };
  const escolhido = api.data.proximos[0]!;
  expect(await primeiro.getAttribute("data-profissional")).toBe(escolhido.profissional_id);
  const agora = Date.now();
  const grade = (await (
    await page.request.get(
      `/api/v1/agenda/horarios-livres?event_type_id=${tipoId}&owner_user_id=${escolhido.profissional_id}` +
        `&de=${new Date(agora).toISOString()}&ate=${new Date(agora + 30 * 86_400_000).toISOString()}`,
    )
  ).json()) as { data: { slots: { inicio: string }[] } };
  expect(grade.data.slots[0]?.inicio).toBe(escolhido.inicio);

  // ── 3. um clique escolhe quem e quando; confirmar marca na agenda dele ────
  await primeiro.click();
  await expect(page.getByTestId("clinic-profissional")).toHaveValue(escolhido.profissional_id);
  const marcou = page.waitForResponse((r) => r.url().endsWith("/api/v1/agenda/agendamentos") && r.request().method() === "POST");
  await page.getByTestId("confirmar-marcacao").click();
  const resposta = await marcou;
  expect(resposta.status(), await resposta.text()).toBe(201);
  const criado = ((await resposta.json()) as { data: { id: string; starts_at: string } }).data;
  expect(new Date(criado.starts_at).toISOString()).toBe(escolhido.inicio);
  // O POST não devolve o dono; a listagem da agenda (a que a grade desenha) diz.
  const naAgenda = (await (
    await page.request.get(`/api/v1/agenda/agendamentos?owner_user_id=${escolhido.profissional_id}&de=${escolhido.inicio}&ate=${new Date(new Date(escolhido.inicio).getTime() + 60_000).toISOString()}`)
  ).json()) as { data: { id: string; donoId: string | null }[] };
  expect(naAgenda.data.find((c) => c.id === criado.id)?.donoId).toBe(escolhido.profissional_id);
  await foto(page, "02-marcado-no-primeiro-livre");

  // ── 4. deixa o ambiente como achou ────────────────────────────────────────
  const cancelado = await page.request.delete("/api/v1/agenda/agendamentos", {
    data: { id: criado.id, reason: "limpeza do teste e2e" },
  });
  expect(cancelado.status(), await cancelado.text()).toBe(200);
  await modulo(page, false);
});
