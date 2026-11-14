/**
 * FORK clinic (agenda S5) — a experiência do profissional, PELA TELA, sobre o
 * seed de demonstração (`scripts/seed-demo-simulacao.ts`), onde Dr. Bruno tem o
 * papel "Profissional de saúde" e Dra. Ana a coordenação clínica:
 *
 *   1. o profissional entra e cai no "Meu dia" (contadores só dele);
 *   2. o menu não tem Financeiro, Conversas, Funis, Estoque nem Equipe;
 *   3. URL administrativa digitada à mão é recusada (a página nega);
 *   4. a Agenda é "Minha agenda", sem a porta do painel da recepção;
 *   5. a API de pacientes só devolve os da própria agenda, e o detalhe de um
 *      paciente de colega é 404;
 *   6. "Bloquear horário" abre o diálogo com o tipo;
 *   7. a coordenação (Ana) vê a clínica inteira (sem recorte de pacientes).
 *
 * FORA DO CI (motivo no e2e.yml): depende do seed de demonstração, que o banco
 * do e2e não tem. Rodar: `DEMO_SENHA=… pnpm exec playwright test clinic-experiencia-do-profissional`.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "experiencia-do-profissional");
const SENHA = process.env.DEMO_SENHA ?? "";

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

/** Todos os contatos que a API devolve a quem está logado (pagina pelo cursor). */
async function idsDosContatos(page: Page): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 20; i++) {
    const r = await page.request.get(`/api/v1/contacts?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    expect(r.status()).toBe(200);
    const j = (await r.json()) as { data: { id: string }[]; meta?: { cursor?: string | null; has_more?: boolean } };
    ids.push(...j.data.map((c) => c.id));
    if (!j.meta?.has_more || !j.meta.cursor) break;
    cursor = j.meta.cursor;
  }
  return ids;
}

test.beforeAll(() => {
  if (!SENHA) throw new Error("DEMO_SENHA ausente — a senha dos usuários do seed de demonstração");
});

test("profissional: Meu dia, menu enxuto, rotas negadas, só os próprios pacientes", async ({ page }) => {
  test.setTimeout(180_000);
  await entrar(page, "dr.bruno@clinica-demo.test");

  // 1. a casa do profissional
  await page.goto("/app");
  await page.waitForURL(/\/app\/meu-dia/, { timeout: 30_000 });
  await expect(page.getByTestId("meu-dia")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("meu-dia-total")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Olá, Bruno" })).toBeVisible();
  await foto(page, "01-meu-dia-bruno");

  // 2. o menu: nada administrativo
  const nav = page.getByRole("navigation").first();
  await expect(nav.getByRole("link", { name: /Meu dia/ })).toBeVisible();
  for (const rotulo of [/Financeiro/, /Conversas/, /Funis/, /Estoque/, /^Equipe$/]) {
    await expect(nav.getByRole("link", { name: rotulo })).toHaveCount(0);
  }

  // 3. URL administrativa à mão
  for (const url of ["/app/comandas", "/app/faturamento", "/app/team", "/app/kanban"]) {
    await page.goto(url);
    await expect(page.getByTestId("acesso-nao-autorizado")).toBeVisible({ timeout: 20_000 });
  }
  await foto(page, "02-rota-administrativa-negada");

  // 4. Minha agenda
  await page.goto("/app/agenda?visao=dia");
  await expect(page.getByRole("heading", { name: "Minha agenda" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("agenda-abrir-recepcao")).toHaveCount(0);
  // quem não tem agenda.marcar não vê o botão de marcar
  await expect(page.getByRole("button", { name: "Novo agendamento" })).toHaveCount(0);

  // 6. bloquear horário
  await page.getByTestId("agenda-bloquear-horario").click();
  await expect(page.getByTestId("dialogo-bloquear-horario")).toBeVisible();
  await expect(page.getByTestId("bloqueio-tipo")).toBeVisible();
  await foto(page, "03-bloquear-horario");
  await page.keyboard.press("Escape");

  // 5. pacientes: só os da própria agenda
  const meus = await idsDosContatos(page);
  const fila = (await (await page.request.get("/api/v1/clinic/atendimentos/fila")).json()) as {
    data: { fila: Record<string, { paciente_id: string; profissional_id: string | null }[]> };
  };
  const daFila = Object.values(fila.data.fila).flat().map((i) => i.paciente_id);
  for (const id of daFila) expect(meus).toContain(id);

  // um paciente que a coordenação vê e o Bruno não
  const contexto = page.context();
  await contexto.clearCookies();
  await entrar(page, "dra.ana@clinica-demo.test");
  const todos = await idsDosContatos(page);
  expect(todos.length).toBeGreaterThan(meus.length);
  const deColega = todos.find((id) => !meus.includes(id));
  expect(deColega).toBeTruthy();

  await contexto.clearCookies();
  await entrar(page, "dr.bruno@clinica-demo.test");
  expect((await page.request.get(`/api/v1/contacts/${deColega}`)).status()).toBe(404);
  expect((await page.request.get(`/api/v1/clinic/pacientes/${deColega}/prontuario`)).status()).toBe(404);
});

test("coordenação: a Agenda é da equipe e a casa segue o Início", async ({ page }) => {
  test.setTimeout(120_000);
  await entrar(page, "dra.ana@clinica-demo.test");
  await page.goto("/app/agenda?visao=dia");
  await expect(page.getByRole("heading", { name: "Agenda", exact: true })).toBeVisible({ timeout: 30_000 });
  await foto(page, "04-agenda-coordenacao");
});
