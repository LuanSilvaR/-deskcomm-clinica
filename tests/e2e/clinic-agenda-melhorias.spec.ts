/**
 * FORK clinic (melhorias da Agenda) — na PRÓPRIA /app/agenda, PELA TELA:
 *
 *   1. o histórico mostra o selo do status da visita ("Agendado") ao lado da
 *      situação do núcleo;
 *   2. a barra de filtros: busca pelo nome do paciente deixa só ele (chip +
 *      "Limpar filtros"); status sem "Agendado" o esconde; o filtro fica na URL
 *      e sobrevive ao recarregar;
 *   3. visão Dia › "Lista por profissional": o bloco do atendente com estado e
 *      ocupação, a linha do paciente com o selo; "somente horários livres"
 *      mostra só vagas; "Paciente chegou" muda para "Na recepção";
 *   4. de volta à grade do dia, o bloco do compromisso traz o ícone do status;
 *   5. desfaz o compromisso.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "agenda-melhorias");
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

const diaLocal = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);

test("agenda: status da visita, filtros e lista do dia na própria Agenda — pela tela", async ({ page }) => {
  test.setTimeout(240_000);
  if (!creds.agenda || !creds.users.agent?.id) throw new Error(".e2e-creds.json sem agenda/agent");
  const agente = creds.users.agent.id;
  await loginComoAdmin(page, creds as unknown as CredsE2E);

  // ── dados: paciente e compromisso num dia com jornada ────────────────────
  const sufixo = Date.now().toString().slice(-8);
  const nomePaciente = `Clara Agenda${sufixo}`;
  const criado = await page.request.post("/api/v1/contacts", {
    data: { name: nomePaciente, phone_number: `+551195${sufixo}`, source: "whatsapp" },
  });
  expect(criado.status(), await criado.text()).toBe(201);
  const contatoId = ((await criado.json()) as { data: { contact: { id: string } } }).data.contact.id;
  const tipos = ((await (await page.request.get("/api/v1/agenda/tipos")).json()) as { data: { id: string; name: string }[] }).data;
  const tipoId = tipos.find((t) => t.name === creds.agenda!.tipo_nome)!.id;
  const agora = Date.now();
  const livres = (await (
    await page.request.get(
      `/api/v1/agenda/horarios-livres?event_type_id=${tipoId}&owner_user_id=${agente}` +
        `&de=${new Date(agora + 2 * 86_400_000).toISOString()}&ate=${new Date(agora + 12 * 86_400_000).toISOString()}`,
    )
  ).json()) as { data: { slots: { inicio: string }[] } };
  const slot = livres.data.slots[1] ?? livres.data.slots[0];
  if (!slot) throw new Error("nenhum horário livre para o teste");
  const dia = diaLocal(slot.inicio);
  const marcado = await page.request.post("/api/v1/agenda/agendamentos", {
    data: { event_type_id: tipoId, starts_at: slot.inicio, contact_id: contatoId, owner_user_id: agente },
  });
  expect(marcado.status(), await marcado.text()).toBe(201);
  const agendamentoId = ((await marcado.json()) as { data: { id: string } }).data.id;

  try {
    await page.goto("/app/agenda");
    const m = page.getByRole("main");
    await expect(m.getByTestId("tela-agenda")).toBeVisible({ timeout: 30_000 });

    // O histórico lista a JANELA visível: vai para o dia do compromisso.
    const irParaODia = async () => {
      await m.getByTestId("visao-dia").click();
      const hoje = diaLocal(new Date().toISOString());
      for (let i = 0; i < diasEntre(hoje, dia); i++) await m.getByTestId("periodo-seguinte").click();
    };
    await irParaODia();

    // ── 1 + 2a. busca pelo paciente; o selo do status na linha do histórico ─
    await m.getByTestId("filtro-paciente").fill(nomePaciente);
    await expect(page).toHaveURL(/q=Clara/);
    const linha = m.getByTestId(`linha-${agendamentoId}`);
    await expect(linha).toBeVisible({ timeout: 20_000 });
    await expect(m.getByTestId("filtros-ativos")).toContainText(nomePaciente);
    await expect(linha.getByTestId("selo-de-status")).toHaveAttribute("data-status", "agendado", { timeout: 20_000 });
    await foto(page, "01-busca-e-selo-no-historico");

    // ── 2b. status sem "Agendado" esconde; a URL guarda e o reload mantém ──
    await m.getByTestId("filtro-status").click();
    await page.getByTestId("filtro-status-agendado").uncheck();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/status=/);
    await expect(linha).toHaveCount(0);
    await page.reload();
    await expect(m.getByTestId("filtros-ativos")).toContainText("Status", { timeout: 30_000 });
    await expect(m.getByTestId("filtro-paciente")).toHaveValue(nomePaciente);
    await m.getByTestId("filtros-limpar").click();
    await expect(m.getByTestId("filtro-paciente")).toHaveValue("");
    await expect(page).not.toHaveURL(/status=|q=/);

    // ── 3. visão Dia › Lista por profissional ─────────────────────────────
    await irParaODia();
    await m.getByTestId("modo-do-dia-lista").click();
    const bloco = m.locator(`[data-testid="bloco-profissional"][data-profissional="${agente}"]`);
    await expect(bloco).toBeVisible({ timeout: 20_000 });
    await expect(bloco.getByTestId("estado-do-dia")).toBeVisible();
    await expect(bloco.getByRole("meter")).toBeVisible();
    const naLista = bloco.locator(`[data-testid="linha-compromisso"][data-id="${agendamentoId}"]`);
    await expect(naLista).toContainText(nomePaciente);
    await expect(naLista.getByTestId("selo-de-status")).toHaveAttribute("data-status", "agendado");
    await foto(page, "02-dia-em-lista");

    await m.getByTestId("filtro-livres").check();
    await expect(naLista).toHaveCount(0);
    await expect(bloco.getByTestId("linha-livre").first()).toBeVisible();
    await foto(page, "03-somente-livres");
    await m.getByTestId("filtros-limpar").click();

    await naLista.getByTestId("linha-avancar").click();
    await expect(naLista.getByTestId("selo-de-status")).toHaveAttribute("data-status", "na_recepcao", { timeout: 20_000 });

    // ── 4. a grade do dia mostra o ícone do status no bloco ───────────────
    await m.getByTestId("modo-do-dia-grade").click();
    const blocoDaGrade = m.getByTestId(`agendamento-${agendamentoId}`);
    await expect(blocoDaGrade.getByTestId("status-no-bloco")).toHaveAttribute("data-status", "na_recepcao", { timeout: 20_000 });
    await expect(blocoDaGrade).toHaveAttribute("aria-label", /Na recepção/);
    await foto(page, "04-grade-com-status");
  } finally {
    // ── 5. desfaz ──────────────────────────────────────────────────────────
    await page.request.delete("/api/v1/agenda/agendamentos", { data: { id: agendamentoId, reason: "limpeza do teste e2e" } });
  }
});
