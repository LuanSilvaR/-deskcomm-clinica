/**
 * FORK clinic (orçamento O2, migration 8007) — o orçamento em rascunho, PELA TELA,
 * na aba "Orçamentos" da ficha do paciente:
 *
 *   1. montar com itens da Tabela de preços (avulso ×2 + pacote);
 *   2. parcelado no cartão com entrada: a prévia mostra as parcelas e o total;
 *   3. salvar: número, status Rascunho, total e pagamento vêm do banco;
 *   4. editar para Pix à vista;
 *   5. cancelar com motivo — o orçamento fica, como Cancelado.
 * Dados fictícios. Desliga a opção no fim se estava desligada.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "orcamentos");

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
  const bloco = page.getByRole("main").getByTestId("clinic-orcamentos");
  await expect(bloco).toBeVisible({ timeout: 20_000 });
  const estava = await bloco.getByText("Orçamentos ligados").isVisible();
  if (estava !== ligar) {
    await bloco.getByTestId("clinic-orcamentos-alternar").click();
    await expect(bloco.getByText(ligar ? "Orçamentos ligados" : "Orçamentos desligados")).toBeVisible({ timeout: 20_000 });
  }
  return estava;
}

test("orçamento em rascunho: itens, parcelado com entrada, edição e cancelamento — pela tela", async ({ page }) => {
  test.setTimeout(240_000);
  page.on("dialog", (d) => void d.accept("Paciente vai pensar"));
  await loginComoAdmin(page, creds as unknown as CredsE2E);
  const estava = await opcao(page, true);

  const sufixo = Date.now().toString().slice(-8);
  const nome = `Limpeza Orc ${sufixo}`;
  const proc = await page.request.post("/api/v1/clinic/procedimentos", {
    data: { name: nome, short_description: "Procedimento fictício de teste" },
  });
  expect(proc.status(), await proc.text()).toBe(201);
  const procId = ((await proc.json()) as { data: { id: string } }).data.id;
  for (const [sessoes, preco_cents] of [
    [1, 15000],
    [10, 120000],
  ] as const) {
    const r = await page.request.post("/api/v1/clinic/precos", { data: { procedure_id: procId, sessoes, preco_cents } });
    expect(r.status(), await r.text()).toBe(201);
  }
  const contato = await page.request.post("/api/v1/contacts", {
    data: { name: `Paciente Orc${sufixo}`, phone_number: `+551196${sufixo}`, source: "whatsapp" },
  });
  expect(contato.status(), await contato.text()).toBe(201);
  const contatoId = ((await contato.json()) as { data: { contact: { id: string } } }).data.contact.id;

  try {
    await page.goto(`/app/contacts/${contatoId}?aba=orcamentos`);
    const m = page.getByRole("main");
    await m.getByTestId("orcamento-novo").click({ timeout: 20_000 });
    const ed = m.getByTestId("orcamento-editor");

    // ── 1. itens ─────────────────────────────────────────────────────────
    const item = ed.getByLabel("Item da tabela de preços");
    const escolher = async (comeco: string) => {
      const opcoes = await item.locator("option").allTextContents();
      const i = opcoes.findIndex((o) => o.startsWith(comeco));
      expect(i, `opção "${comeco}" em ${JSON.stringify(opcoes)}`).toBeGreaterThan(0);
      await item.selectOption({ index: i });
      await ed.getByTestId("orcamento-adicionar-item").click();
    };
    await escolher(`${nome} ·`);
    await escolher(`${nome} — 10 sessões`);
    await ed.getByLabel("Quantidade").first().fill("2");

    // ── 2. parcelado com entrada ────────────────────────────────────────
    await ed.getByLabel("Forma de pagamento").selectOption("parcelado");
    await ed.getByLabel("Parcelas no cartão").selectOption("3");
    await ed.getByLabel("Entrada (R$, opcional)").fill("300,00");
    await ed.getByLabel("Forma da entrada").selectOption("dinheiro");
    const previa = ed.getByTestId("orcamento-previa");
    await expect(previa).toContainText(/Total: R\$\s1\.500,00/);
    await expect(ed.getByTestId("orcamento-previa-parcelas")).toContainText(/3× R\$\s400,00/);
    await foto(page, "o2-1-editor");

    // ── 3. salvar ────────────────────────────────────────────────────────
    await ed.getByTestId("orcamento-salvar").click();
    const orc = m.getByTestId("orcamento").first();
    await expect(orc.getByTestId("orcamento-status")).toHaveText("Rascunho", { timeout: 20_000 });
    await expect(orc.getByTestId("orcamento-total")).toHaveText(/R\$\s1\.500,00/);
    await expect(orc.getByTestId("orcamento-pagamento")).toContainText(/3× R\$\s400,00 no cartão de crédito/);
    await expect(orc).toContainText("Nº");
    await foto(page, "o2-2-salvo");

    // ── 4. editar para Pix à vista ──────────────────────────────────────
    await orc.getByRole("button", { name: "Editar" }).click();
    await ed.getByLabel("Forma de pagamento").selectOption("pix");
    await ed.getByTestId("orcamento-salvar").click();
    await expect(orc.getByTestId("orcamento-pagamento")).toHaveText("Pix · à vista", { timeout: 20_000 });

    // ── 5. cancelar ─────────────────────────────────────────────────────
    await orc.getByRole("button", { name: "Cancelar orçamento" }).click();
    await expect(orc.getByTestId("orcamento-status")).toHaveText("Cancelado", { timeout: 20_000 });
    await expect(orc).toContainText("Paciente vai pensar");
    await expect(orc.getByRole("button", { name: "Editar" })).toHaveCount(0);
    await foto(page, "o2-3-cancelado");
  } finally {
    if (!estava) await opcao(page, false);
  }
});
