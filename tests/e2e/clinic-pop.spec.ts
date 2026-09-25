/**
 * FORK clinic (9015) — o POP do procedimento, PELA TELA:
 *
 *   1. sem POP, "Usar modelo padrão" cria a 1.0 em rascunho (POP-NNN) com as
 *      seções do modelo; o cabeçalho mostra código, versão, status e quem criou;
 *   2. editar o texto salva sozinho ("Salvo às …") e o texto volta ao recarregar;
 *   3. aprovar: status Aprovado, documento em leitura (sem barra);
 *   4. nova versão com motivo → 1.1 em rascunho (conteúdo copiado); editar; aprovar;
 *   5. histórico: 1.1 Aprovado e 1.0 Substituído; abrir a 1.0 avisa que não é vigente;
 *   6. API: editar versão aprovada = 409; lock velho = 409 (outra pessoa salvou);
 *      visualizador lê o POP mas não aprova (403);
 *   7. imprimir: o botão leva ao PDF A4 da versão; a 1.0 (substituída) e a 1.1
 *      (vigente) saem como application/pdf; o visualizador também imprime.
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

async function escreverNoFim(page: Page, texto: string): Promise<void> {
  const area = page.getByRole("main").getByTestId("pop-texto");
  await area.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type(texto);
  await expect(page.getByRole("main").getByTestId("pop-salvamento")).toContainText("Salvo às", { timeout: 20_000 });
}

test("POP: modelo, autosave, aprovação, nova versão e histórico — pela tela", async ({ page }) => {
  test.setTimeout(300_000);
  page.on("dialog", (d) => void d.accept());
  await loginComoAdmin(page, creds as unknown as CredsE2E);
  const estava = await opcao(page, true);

  const sufixo = Date.now().toString().slice(-6);
  const criado = await page.request.post("/api/v1/clinic/procedimentos", {
    data: { name: `Peeling E2E ${sufixo}`, short_description: "Peeling químico superficial", duration_minutes: 30 },
  });
  expect(criado.status(), await criado.text()).toBe(201);
  const procId = ((await criado.json()) as { data: { id: string } }).data.id;

  try {
    // ── 1. modelo padrão ─────────────────────────────────────────────────
    await page.goto(`/app/procedimentos/${procId}`);
    const m = page.getByRole("main");
    await m.getByTestId("proc-aba-pop").click();
    await expect(m.getByTestId("pop-sem")).toBeVisible({ timeout: 20_000 });
    await m.getByTestId("pop-novo-modelo").click();
    await expect(m.getByTestId("pop-status")).toHaveText("Rascunho", { timeout: 20_000 });
    await expect(m.getByTestId("pop-versao")).toContainText("1.0");
    await expect(m.getByTestId("pop-codigo")).toHaveText(/^POP-\d{3}$/);
    await expect(m.getByTestId("pop-criado")).not.toContainText("—");
    await expect(m.getByTestId("pop-texto")).toContainText("1. IDENTIFICAÇÃO");
    await expect(m.getByTestId("pop-texto")).toContainText("21. CONTROLE DE REVISÕES");
    await expect(m.getByTestId("pop-barra")).toBeVisible();

    // ── 2. editar salva sozinho e persiste ─────────────────────────────────
    await escreverNoFim(page, "Uso obrigatório de luvas nitrílicas.");
    await foto(page, "03-pop-rascunho");
    await page.reload();
    await page.getByRole("main").getByTestId("proc-aba-pop").click();
    await expect(page.getByRole("main").getByTestId("pop-texto")).toContainText("Uso obrigatório de luvas nitrílicas.", { timeout: 20_000 });

    // ── 3. aprovar ─────────────────────────────────────────────────────────
    await page.getByRole("main").getByTestId("pop-aprovar").click();
    await expect(page.getByRole("main").getByTestId("pop-status")).toHaveText("Aprovado", { timeout: 20_000 });
    await expect(page.getByRole("main").getByTestId("pop-barra")).toHaveCount(0);
    await expect(page.getByRole("main").getByTestId("pop-aprovado")).not.toHaveText("—");
    await foto(page, "04-pop-aprovado");

    const dados = ((await (await page.request.get(`/api/v1/clinic/procedimentos/${procId}`)).json()) as {
      data: { pop: { id: string; vigente: { id: string } } };
    }).data;
    const popId = dados.pop.id;
    const v10 = dados.pop.vigente.id;

    // editar a aprovada pela API: recusado
    const imutavel = await page.request.patch(`/api/v1/clinic/pops/versoes/${v10}`, {
      data: { content: { type: "doc", content: [{ type: "paragraph" }] }, lock_version: 99 },
    });
    expect(imutavel.status()).toBe(409);
    expect(((await imutavel.json()) as { error: { code: string } }).error.code).toBe("pop_versao_imutavel");

    // ── 4. nova versão 1.1 ─────────────────────────────────────────────────
    await page.getByRole("main").getByTestId("pop-nova-versao").click();
    await page.getByRole("main").getByTestId("pop-motivo").fill("Atualização dos EPIs");
    await page.getByRole("main").getByTestId("pop-criar-versao").click();
    await expect(page.getByRole("main").getByTestId("pop-versao")).toContainText("1.1", { timeout: 20_000 });
    await expect(page.getByRole("main").getByTestId("pop-status")).toHaveText("Rascunho");
    await expect(page.getByRole("main").getByTestId("pop-texto")).toContainText("Uso obrigatório de luvas nitrílicas.");
    await escreverNoFim(page, "Incluir óculos de proteção.");

    // lock velho: outra pessoa "salvou antes"
    const v11 = ((await (await page.request.get(`/api/v1/clinic/pops/${popId}`)).json()) as { data: { versoes: { id: string; status: string }[] } }).data.versoes.find(
      (v) => v.status === "draft",
    )!.id;
    const conflito = await page.request.patch(`/api/v1/clinic/pops/versoes/${v11}`, {
      data: { content: { type: "doc", content: [{ type: "paragraph" }] }, lock_version: 1 },
    });
    expect(conflito.status()).toBe(409);
    expect(((await conflito.json()) as { error: { code: string } }).error.code).toBe("pop_editado_por_outra_pessoa");

    await page.getByRole("main").getByTestId("pop-aprovar").click();
    await expect(page.getByRole("main").getByTestId("pop-status")).toHaveText("Aprovado", { timeout: 20_000 });
    await expect(page.getByRole("main").getByTestId("pop-versao")).toContainText("1.1");

    // ── 5. histórico ───────────────────────────────────────────────────────
    await page.getByRole("main").getByTestId("proc-aba-historico").click();
    const hist = page.getByRole("main").getByTestId("pop-historico");
    await expect(hist.locator('[data-testid="pop-historico-versao"][data-versao="1.1"]')).toHaveAttribute("data-status", "approved", { timeout: 20_000 });
    const antiga = hist.locator('[data-testid="pop-historico-versao"][data-versao="1.0"]');
    await expect(antiga).toHaveAttribute("data-status", "superseded");
    await antiga.click();
    await expect(hist.getByTestId("pop-nao-vigente")).toBeVisible({ timeout: 20_000 });
    await expect(hist.getByTestId("pop-barra")).toHaveCount(0);
    await foto(page, "05-pop-historico");

    // ── 7. imprimir ────────────────────────────────────────────────────────
    const doHistorico = ((await (await page.request.get(`/api/v1/clinic/pops/${popId}`)).json()) as {
      data: { versoes: { id: string; major: number; minor: number; status: string }[] };
    }).data.versoes;
    const antigaId = doHistorico.find((x) => x.major === 1 && x.minor === 0)!.id;
    const vigenteId = doHistorico.find((x) => x.status === "approved")!.id;
    await expect(hist.getByTestId("pop-imprimir")).toHaveAttribute("href", `/api/v1/clinic/pops/versoes/${antigaId}/pdf`);
    for (const [vid, arquivo] of [
      [antigaId, "06-pop-1.0-substituida.pdf"],
      [vigenteId, "07-pop-1.1-vigente.pdf"],
    ] as const) {
      const pdf = await page.request.get(`/api/v1/clinic/pops/versoes/${vid}/pdf`);
      expect(pdf.status()).toBe(200);
      expect(pdf.headers()["content-type"]).toContain("application/pdf");
      const corpo = await pdf.body();
      expect(corpo.subarray(0, 4).toString()).toBe("%PDF");
      fs.mkdirSync(EVIDENCIA, { recursive: true });
      fs.writeFileSync(path.join(EVIDENCIA, arquivo), corpo);
    }

    // ── 6. visualizador lê e não aprova ────────────────────────────────────
    const visualizador = creds.users.viewer;
    if (visualizador) {
      const nova = await page.request.post(`/api/v1/clinic/pops/${popId}/versoes`, { data: { maior: true, motivo: "Teste de permissão" } });
      expect(nova.status()).toBe(201);
      const rascunhoId = ((await nova.json()) as { data: { versao_id: string } }).data.versao_id;
      const ctx = await page.context().browser()!.newContext();
      const vp = await ctx.newPage();
      await vp.goto("/login");
      await vp.getByLabel(/e-?mail/i).fill(visualizador.email);
      await vp.getByLabel(/senha/i).fill(creds.password);
      await vp.getByRole("button", { name: "Entrar", exact: true }).click();
      await vp.waitForURL(/\/app(?:\/|$)/, { timeout: 60_000 });
      expect((await vp.request.get(`/api/v1/clinic/pops/${popId}`)).status()).toBe(200);
      expect((await vp.request.post(`/api/v1/clinic/pops/versoes/${rascunhoId}/aprovar`, { data: {} })).status()).toBe(403);
      expect((await vp.request.get(`/api/v1/clinic/pops/versoes/${rascunhoId}/pdf`)).status()).toBe(200);
      await ctx.close();
      expect((await page.request.delete(`/api/v1/clinic/pops/versoes/${rascunhoId}`)).status()).toBe(200);
    }
  } finally {
    await page.request.patch(`/api/v1/clinic/procedimentos/${procId}`, { data: { is_active: false } });
    await opcao(page, estava);
  }
});
