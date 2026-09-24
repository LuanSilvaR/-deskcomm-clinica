/**
 * FORK clinic (migration 9002) — a jornada da recepção, PELA TELA:
 *
 *   0. o menu diz "Pacientes";
 *   1. o admin liga "Exigir ficha completa na chegada";
 *   2. um paciente nasce como no WhatsApp — só nome e telefone — e tem um horário;
 *      a lista mostra "Ficha incompleta";
 *   3. na agenda, "Paciente chegou" abre a ficha ali mesmo; a data de nascimento
 *      de menor faz aparecer o responsável; ao salvar completa, a chegada é registrada;
 *   4. a lista mostra "Ficha completa" e o CPF ficou gravado (cifrado);
 *   4b. ao marcar, a recepção acha a paciente pelo CPF e pela data de nascimento;
 *   5. desliga a exigência (deixa o ambiente como achou).
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "ficha-do-paciente");

interface Creds {
  users: Record<string, { email: string; id?: string } | undefined>;
  agenda?: { tipo_nome: string; tipo_slug: string };
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

/**
 * Um CPF VÁLIDO novo a cada rodada: o CPF é único por organização
 * (uniq_contacts_org_cpf), e repetir o de uma rodada anterior dá 409 — que é o
 * produto certo, não defeito.
 */
function cpfValidoNovo(): string {
  // Os 9 últimos dígitos do relógio: muda a cada milissegundo.
  const base = String(Date.now()).slice(-9).split("").map(Number);
  if (base.every((d) => d === base[0])) base[8] = (base[8]! + 1) % 10;
  const dv = (nums: number[]) => {
    const soma = nums.reduce((acc, n, i) => acc + n * (nums.length + 1 - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  return [...base, d1, d2].join("");
}

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

/** A lista de pacientes filtrada pela busca da própria tela. */
async function buscarNaLista(page: Page, termo: string): Promise<void> {
  await page.goto("/app/contacts");
  await page.getByPlaceholder("Buscar por nome, email ou telefone…").fill(termo);
}

async function exigirFicha(page: Page, ligar: boolean): Promise<void> {
  await page.goto("/app/settings/tenant/profissionais");
  const bloco = page.getByRole("main").getByTestId("clinic-ficha-obrigatoria");
  await expect(bloco).toBeVisible({ timeout: 20_000 });
  const ligada = await bloco.getByText("Ficha do paciente exigida na chegada").isVisible();
  if (ligada !== ligar) {
    await page.getByRole("main").getByTestId("clinic-ficha-obrigatoria-alternar").click();
    await expect(
      bloco.getByText(ligar ? "Ficha do paciente exigida na chegada" : "Ficha do paciente não é exigida"),
    ).toBeVisible();
  }
}

test("recepção completa a ficha do paciente na chegada — pela tela", async ({ page }) => {
  test.setTimeout(180_000);
  const creds = lerCreds();
  if (!creds.agenda || !creds.users.agent?.id) throw new Error(".e2e-creds.json sem agenda/agent");
  await loginComoAdmin(page, creds as unknown as CredsE2E);

  // ── 0. o menu diz Pacientes ────────────────────────────────────────────────
  await page.goto("/app/contacts");
  await expect(page.getByRole("heading", { name: "Pacientes", exact: true })).toBeVisible({ timeout: 20_000 });

  // ── 1. exige a ficha ───────────────────────────────────────────────────────
  await exigirFicha(page, true);
  await foto(page, "01-exigir-ficha-ligado");

  // ── 2. paciente do WhatsApp: só nome e telefone, com um horário ────────────
  const sufixo = Date.now().toString().slice(-8);
  const telefone = `+551197${sufixo}`;
  const criado = await page.request.post("/api/v1/contacts", {
    data: { name: `Bruna E2E${sufixo}`, phone_number: telefone, source: "whatsapp" },
  });
  expect(criado.status(), await criado.text()).toBe(201);
  // O POST de contatos devolve `{ data: { contact, action } }` (envelope do ok()).
  const contatoId = ((await criado.json()) as { data: { contact: { id: string } } }).data.contact.id;
  expect(contatoId).toMatch(/^[0-9a-f-]{36}$/);

  const tipos = ((await (await page.request.get("/api/v1/agenda/tipos")).json()) as { data: { id: string; name: string }[] }).data;
  const tipo = tipos.find((t) => t.name === creds.agenda!.tipo_nome);
  if (!tipo) throw new Error("tipo semeado não encontrado");
  const de = new Date(Date.now() + 2 * 86_400_000);
  const ate = new Date(Date.now() + 12 * 86_400_000);
  const livres = (await (
    await page.request.get(
      `/api/v1/agenda/horarios-livres?event_type_id=${tipo.id}&owner_user_id=${creds.users.agent.id}&de=${de.toISOString()}&ate=${ate.toISOString()}`,
    )
  ).json()) as { data?: { slots: { inicio: string }[] } };
  const slot = livres.data?.slots?.[3] ?? livres.data?.slots?.[0];
  if (!slot) throw new Error("nenhum horário livre para o teste");
  const marcado = await page.request.post("/api/v1/agenda/agendamentos", {
    data: { event_type_id: tipo.id, starts_at: slot.inicio, contact_id: contatoId, owner_user_id: creds.users.agent.id },
  });
  expect(marcado.status(), await marcado.text()).toBe(201);
  const agendamentoId = ((await marcado.json()) as { data: { id: string } }).data.id;

  // "Compareceu" num horário FUTURO é recusado antes, por outra regra
  // (agenda_ainda_nao_aconteceu); a trava da ficha no Compareceu é provada em
  // lib/clinic/pacientes/servidor.test.ts (fichaPermiteAtendimento).

  await buscarNaLista(page, `E2E${sufixo}`);
  const linha = page.getByRole("row").filter({ hasText: `Bruna E2E${sufixo}` });
  await expect(linha.getByTestId("selo-ficha-incompleta")).toBeVisible({ timeout: 20_000 });
  await foto(page, "02-lista-ficha-incompleta");

  // ── 3. "Paciente chegou" abre a ficha na agenda ────────────────────────────
  await page.goto(`/app/agenda?compromisso=${agendamentoId}`);
  // "Paciente chegou" é o primeiro passo do status da visita (migration 9003).
  const chegou = page.getByTestId("visita-na_recepcao");
  await expect(chegou).toBeVisible({ timeout: 20_000 });
  await chegou.click();
  const ficha = page.getByTestId("ficha-do-paciente-form");
  await expect(ficha).toBeVisible({ timeout: 10_000 });
  await expect(ficha.getByTestId("ficha-faltando")).toContainText("CPF");
  await foto(page, "03-chegada-abre-a-ficha");

  await ficha.getByLabel("Nome completo").fill(`Bruna Souza E2E${sufixo}`);
  const cpfDaPaciente = cpfValidoNovo();
  await ficha.getByLabel("CPF", { exact: true }).fill(cpfDaPaciente);
  // Menor de idade: a seção do responsável aparece na hora.
  await ficha.getByLabel("Data de nascimento").fill("2012-03-15");
  await expect(ficha.getByLabel("Nome do responsável")).toBeVisible();
  await ficha.getByLabel("Sexo").selectOption("feminino");
  await ficha.getByLabel("CEP").fill("01310-100");
  await ficha.getByLabel("Logradouro").fill("Avenida Paulista");
  await ficha.getByLabel("Número", { exact: true }).fill("1000");
  await ficha.getByLabel("Bairro").fill("Bela Vista");
  await ficha.getByLabel("Cidade").fill("São Paulo");
  await ficha.getByLabel("UF", { exact: true }).fill("SP");
  await ficha.getByLabel("Nome", { exact: true }).fill("Carla Souza");
  await ficha.getByLabel("Parentesco", { exact: true }).fill("Mãe");
  await ficha.getByLabel("Telefone", { exact: true }).fill("(11) 98888-7777");
  await ficha.getByLabel("Nome do responsável").fill("Carla Souza");
  await ficha.getByLabel("CPF do responsável").fill("111.444.777-35");
  await ficha.getByLabel("Parentesco do responsável").fill("Mãe");
  await foto(page, "04-ficha-preenchida-menor");

  const salvar = page.waitForResponse((r) => r.url().includes(`/api/v1/clinic/pacientes/${contatoId}/ficha`) && r.request().method() === "PUT");
  const registrar = page.waitForResponse(
    (r) => r.url().includes(`/api/v1/clinic/agendamentos/${agendamentoId}/visita`) && r.request().method() === "POST" && r.status() === 200,
  );
  await ficha.getByTestId("ficha-salvar").click();
  expect((await salvar).status()).toBe(200);
  await registrar;
  await expect(page.getByTestId("visita-do-paciente").getByTestId("selo-da-visita")).toHaveText("Na recepção", { timeout: 10_000 });
  await foto(page, "05-chegada-registrada");

  // ── 4. lista mostra completa; o CPF foi gravado (par hash + cifra) ──────────
  const lida = (await (await page.request.get(`/api/v1/clinic/pacientes/${contatoId}/ficha`)).json()) as {
    data: { contato: { tem_cpf: boolean }; situacao: { completa: boolean } };
  };
  expect(lida.data.contato.tem_cpf).toBe(true);
  expect(lida.data.situacao.completa).toBe(true);

  await buscarNaLista(page, `E2E${sufixo}`);
  await expect(
    page.getByRole("row").filter({ hasText: `Bruna Souza E2E${sufixo}` }).getByTestId("selo-ficha-completa"),
  ).toBeVisible({ timeout: 20_000 });
  await foto(page, "06-lista-ficha-completa");

  await page.goto(`/app/contacts/${contatoId}`);
  await page.getByRole("tab", { name: "Ficha do paciente" }).click();
  await expect(page.getByTestId("ficha-situacao")).toContainText("Ficha completa");
  await foto(page, "07-aba-ficha-do-paciente");

  // ── E1: ao marcar, a recepção acha a paciente por CPF ou por nascimento ────
  await page.goto("/app/agenda");
  await page.getByRole("button", { name: /novo agendamento/i }).click();
  const quem = page.getByTestId("quem-sera-atendido");
  await quem.fill(cpfDaPaciente.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"));
  await expect(page.getByRole("option", { name: new RegExp(`Bruna Souza E2E${sufixo}`) })).toBeVisible({ timeout: 10_000 });
  await quem.fill("15/03/2012");
  const porNascimento = page.getByRole("option", { name: new RegExp(`Bruna Souza E2E${sufixo}`) });
  await expect(porNascimento).toBeVisible({ timeout: 10_000 });
  await expect(porNascimento).toContainText("15/03/2012");
  await foto(page, "08-busca-por-nascimento-ao-marcar");

  // ── 5. deixa o ambiente como achou ─────────────────────────────────────────
  await exigirFicha(page, false);
});
