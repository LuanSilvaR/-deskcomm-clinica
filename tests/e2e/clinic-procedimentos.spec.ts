/**
 * FORK clinic (9015) — Procedimentos, PELA TELA:
 *
 *   1. desligado, a tela diz como ligar; o admin liga em Configurações › Profissionais;
 *   2. "Novo procedimento": nome, descrição breve, duração, uma especialização
 *      JÁ cadastrada e um profissional JÁ cadastrado que a tem ("Apto");
 *      quem não tem a especialização aparece desabilitado;
 *   3. salvar leva ao procedimento; a lista mostra a linha com "Sem POP";
 *   4. editar a duração persiste; a API recusa profissional sem a especialização (422);
 *   5. o visualizador vê a lista mas a API recusa criar (403);
 *   6. desfaz: desativa o procedimento e volta a opção como estava.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "procedimentos-pop");

interface Creds {
  password: string;
  users: Record<string, { email: string; id?: string } | undefined>;
}
const creds = JSON.parse(fs.readFileSync(path.join(RAIZ, ".e2e-creds.json"), "utf8")) as Creds;

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

/** Liga/desliga a opção e devolve como ela estava. */
async function opcao(page: Page, ligar: boolean): Promise<boolean> {
  await page.goto("/app/settings/tenant/profissionais");
  const bloco = page.getByRole("main").getByTestId("clinic-procedimentos");
  await expect(bloco).toBeVisible({ timeout: 20_000 });
  const estava = await bloco.getByText("Procedimentos e POP ligados").isVisible();
  if (estava !== ligar) {
    await bloco.getByTestId("clinic-procedimentos-alternar").click();
    await expect(bloco.getByText(ligar ? "Procedimentos e POP ligados" : "Procedimentos e POP desligados")).toBeVisible({ timeout: 20_000 });
  }
  return estava;
}

interface Profissional {
  id: string;
  user_id: string;
  display_name: string | null;
  is_active: boolean;
  specialty_ids: string[];
}

test("procedimentos: cadastro com especialização e profissionais existentes — pela tela", async ({ page }) => {
  test.setTimeout(240_000);
  await loginComoAdmin(page, creds as unknown as CredsE2E);
  const estava = await opcao(page, false);

  // ── 1. desligado → liga ──────────────────────────────────────────────────
  await page.goto("/app/procedimentos");
  await expect(page.getByTestId("procedimentos-desligado")).toBeVisible({ timeout: 20_000 });
  await opcao(page, true);

  // Uma especialização nova, dada ao atendente de teste (o cadastro JÁ existente
  // de profissionais), preservando as que ele já tem.
  const agente = creds.users.agent?.id;
  if (!agente) throw new Error(".e2e-creds.json sem agent");
  const sufixo = Date.now().toString().slice(-6);
  const novaEsp = await page.request.post("/api/v1/clinic/especialidades", { data: { name: `Esteticista E2E ${sufixo}` } });
  expect(novaEsp.status(), await novaEsp.text()).toBe(201);
  const esp = ((await novaEsp.json()) as { data: { id: string; name: string } }).data;
  const lerProfissionais = async () =>
    ((await (await page.request.get("/api/v1/clinic/profissionais")).json()) as { data: { profissionais: Profissional[] } }).data.profissionais;
  const doAgente = (await lerProfissionais()).find((p) => p.user_id === agente);
  const salvouProf = await page.request.post("/api/v1/clinic/profissionais", {
    data: { user_id: agente, is_active: true, specialty_ids: [...(doAgente?.specialty_ids ?? []), esp.id] },
  });
  expect(salvouProf.status(), await salvouProf.text()).toBeLessThan(300);
  const profissionais = (await lerProfissionais()).filter((p) => p.is_active);
  const apto = profissionais.find((p) => p.user_id === agente)!;
  const inapto = profissionais.find((p) => !p.specialty_ids.includes(esp.id));

  const nome = `Toxina E2E ${sufixo}`;
  let id = "";
  try {
    // ── 2. novo procedimento ───────────────────────────────────────────────
    await page.goto("/app/procedimentos");
    await page.getByRole("main").getByTestId("proc-novo").click();
    await expect(page).toHaveURL(/\/app\/procedimentos\/novo/);
    const m = page.getByRole("main");
    await m.getByTestId("proc-nome").fill(nome);
    await m.getByTestId("proc-breve").fill("Aplicação de toxina botulínica");
    await m.getByTestId("proc-duracao").fill("40");
    await m.getByTestId(`proc-esp-${esp.name}`).check();
    const linhaApto = m.locator(`[data-testid="proc-profissional"][data-id="${apto.id}"]`);
    await expect(linhaApto).toContainText("Apto");
    await linhaApto.getByRole("checkbox").check();
    if (inapto) {
      const linhaInapto = m.locator(`[data-testid="proc-profissional"][data-id="${inapto.id}"]`);
      await expect(linhaInapto.getByRole("checkbox")).toBeDisabled();
      await expect(linhaInapto.getByTestId("proc-prof-inapto")).toBeVisible();
    }
    await foto(page, "01-novo-procedimento");

    // ── 3. salva e vai ao procedimento ─────────────────────────────────────
    const criou = page.waitForResponse((r) => r.url().endsWith("/api/v1/clinic/procedimentos") && r.request().method() === "POST");
    await m.getByTestId("proc-salvar").click();
    const resposta = await criou;
    expect(resposta.status()).toBe(201);
    id = ((await resposta.json()) as { data: { id: string } }).data.id;
    await expect(page).toHaveURL(new RegExp(`/app/procedimentos/${id}`), { timeout: 20_000 });
    await expect(page.getByRole("main").getByTestId("detalhe-do-procedimento")).toContainText(nome);

    const salvo = ((await (await page.request.get(`/api/v1/clinic/procedimentos/${id}`)).json()) as {
      data: { specialty_ids: string[]; professional_ids: string[] };
    }).data;
    expect(salvo.specialty_ids).toEqual([esp.id]);
    expect(salvo.professional_ids).toEqual([apto.id]);

    // ── 4. editar persiste; a API recusa profissional sem a especialização ─
    await page.getByRole("main").getByTestId("proc-duracao").fill("45");
    await page.getByRole("main").getByTestId("proc-salvar").click();
    await expect(page.getByText("Procedimento salvo.")).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.getByRole("main").getByTestId("proc-duracao")).toHaveValue("45", { timeout: 20_000 });
    if (inapto) {
      const recusa = await page.request.put(`/api/v1/clinic/procedimentos/${id}/vinculos`, {
        data: { specialty_ids: [esp.id], professional_ids: [apto.id, inapto.id] },
      });
      expect(recusa.status()).toBe(422);
      expect(((await recusa.json()) as { error: { code: string } }).error.code).toBe("procedimento_profissional_sem_especialidade");
    }

    await page.goto("/app/procedimentos");
    const linha = page.getByRole("main").locator(`[data-testid="proc-linha"][data-nome="${nome}"]`);
    await expect(linha).toContainText("Sem POP", { timeout: 20_000 });
    await foto(page, "02-lista-de-procedimentos");
  } finally {
    if (id) await page.request.patch(`/api/v1/clinic/procedimentos/${id}`, { data: { is_active: false } });
    await page.request.patch("/api/v1/clinic/especialidades", { data: { id: esp.id, is_active: false } });
  }

  // ── 5. visualizador: vê a lista, não cria ──────────────────────────────
  const visualizador = creds.users.viewer;
  if (visualizador) {
    const ctx = await page.context().browser()!.newContext();
    const vp = await ctx.newPage();
    await vp.goto("/login");
    await vp.getByLabel(/e-?mail/i).fill(visualizador.email);
    await vp.getByLabel(/senha/i).fill(creds.password);
    await vp.getByRole("button", { name: "Entrar", exact: true }).click();
    await vp.waitForURL(/\/app(?:\/|$)/, { timeout: 60_000 });
    expect((await vp.request.get("/api/v1/clinic/procedimentos")).status()).toBe(200);
    const nega = await vp.request.post("/api/v1/clinic/procedimentos", { data: { name: "Nao pode", short_description: "x" } });
    expect(nega.status()).toBe(403);
    await ctx.close();
  }

  // ── 6. a opção volta como estava ─────────────────────────────────────────
  await opcao(page, estava);
});
