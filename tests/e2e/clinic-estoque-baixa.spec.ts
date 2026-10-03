/**
 * FORK clinic (estoque E2, migration 9030) — a baixa pelo prontuário, PELA TELA:
 *
 *   1. um procedimento finalizado com insumo de um produto do estoque SEM saldo
 *      (montado pelo service role; o fluxo clínico inteiro é provado em
 *      clinic-atendimento-fila.spec.ts) publica `clinic.procedimento_confirmado`;
 *   2. o dreno roda o consumidor: finalizar não falhou, e a falta vira
 *      pendência "Sem saldo no local" na aba Pendências;
 *   3. entrada no estoque e "Baixar agora" escolhendo o lote → a pendência some,
 *      o saldo baixou e Movimentações mostra "Consumo no atendimento".
 * Dados fictícios. Desliga o estoque no fim se estava desligado.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { carregarEnvLocal } from "../../scripts/lib/env-de-teste";
import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "estoque-baixa");

interface Creds {
  org_id: string;
  password: string;
  users: Record<string, { email: string; id?: string } | undefined>;
}
const creds = JSON.parse(fs.readFileSync(path.join(RAIZ, ".e2e-creds.json"), "utf8")) as Creds;

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(URL_SUPABASE)) {
  throw new Error(`Supabase não é local (${URL_SUPABASE}) — esta spec só roda no ambiente de teste.`);
}
const admin = createClient(URL_SUPABASE, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

async function opcao(page: Page, ligar: boolean): Promise<boolean> {
  await page.goto("/app/settings/tenant/profissionais");
  const bloco = page.getByRole("main").getByTestId("clinic-estoque");
  await expect(bloco).toBeVisible({ timeout: 20_000 });
  const estava = await bloco.getByText("Estoque ligado").isVisible();
  if (estava !== ligar) {
    await bloco.getByTestId("clinic-estoque-alternar").click();
    await expect(bloco.getByText(ligar ? "Estoque ligado" : "Estoque desligado")).toBeVisible({ timeout: 20_000 });
  }
  return estava;
}

async function drena(page: Page): Promise<void> {
  const secret = carregarEnvLocal().INTERNAL_SECRET?.trim();
  if (!secret) throw new Error("INTERNAL_SECRET não encontrado no ambiente");
  const r = await page.request.post("/api/v1/cron/event-log-drain", {
    headers: { authorization: `Bearer ${secret}` },
  });
  expect(r.status(), "o dreno tem que responder 200").toBe(200);
  const resumo = ((await r.json()) as { data: { failed: number; dead: number } }).data;
  expect(resumo.failed + resumo.dead, "nenhum handler pode ter falhado no dreno").toBe(0);
}

test("estoque: insumo do prontuário sem saldo vira pendência e é baixado pela tela", async ({ page }) => {
  test.setTimeout(300_000);
  const orgId = creds.org_id;
  await loginComoAdmin(page, creds as unknown as CredsE2E);
  const estava = await opcao(page, true);
  const sufixo = Date.now().toString().slice(-6);
  const nome = `Fio E2E ${sufixo}`;

  try {
    // ── produto do estoque, ainda sem saldo ─────────────────────────────────
    const criado = await page.request.post("/api/v1/products", {
      data: { codigo: `FIO-E2E-${sufixo}`, nome, preco_cents: 0 },
    });
    expect(criado.status(), await criado.text()).toBe(201);
    const productId = ((await criado.json()) as { data: { id: string } }).data.id;
    const cfg = await page.request.put(`/api/v1/clinic/estoque/produtos/${productId}`, {
      data: {
        unidade_estoque: "un",
        unidade_aplicacao: "un",
        fator_conversao: 1,
        fracionavel: false,
        rastreado: false,
        controlado: false,
        conselhos_permitidos: [],
        estoque_minimo: 0,
        gerenciado: true,
      },
    });
    expect(cfg.status(), await cfg.text()).toBe(200);

    // ── 1. procedimento finalizado com o insumo (service role) ─────────────
    const { data: contato, error: e1 } = await admin
      .from("contacts")
      .insert({ organization_id: orgId, name: `Paciente fictício ${sufixo}`, phone_number: `+55119${sufixo}000` } as never)
      .select("id")
      .single();
    expect(e1?.message ?? null).toBeNull();
    const { data: at, error: e2 } = await admin
      .from("clinic_atendimentos")
      .insert({
        organization_id: orgId,
        contact_id: (contato as { id: string }).id,
        status: "finalizado",
        finished_at: new Date().toISOString(),
      } as never)
      .select("id")
      .single();
    expect(e2?.message ?? null).toBeNull();
    const atId = (at as { id: string }).id;
    const { data: proc, error: e3 } = await admin
      .from("clinic_procedimentos_realizados")
      .insert({ organization_id: orgId, atendimento_id: atId, descricao: "Procedimento fictício", status: "finalizado" } as never)
      .select("id")
      .single();
    expect(e3?.message ?? null).toBeNull();
    const procId = (proc as { id: string }).id;
    const { data: insumo, error: e4 } = await admin
      .from("clinic_procedimento_insumos")
      .insert({
        organization_id: orgId,
        procedimento_id: procId,
        product_id: productId,
        descricao: "Fio",
        quantidade: 2,
        unidade: "un",
      } as never)
      .select("id")
      .single();
    expect(e4?.message ?? null).toBeNull();
    const insumoId = (insumo as { id: string }).id;
    const { error: e5 } = await admin.from("event_log").insert({
      organization_id: orgId,
      event_type: "clinic.procedimento_confirmado",
      entity_kind: "clinic_procedimento_realizado",
      entity_id: procId,
      payload: {
        atendimento_id: atId,
        procedure_id: null,
        event_type_id: null,
        insumos: [
          { insumo_id: insumoId, product_id: productId, quantidade: 2, unidade: "un", lote: null, validade: null },
        ],
      },
    } as never);
    expect(e5?.message ?? null).toBeNull();

    // ── 2. o dreno abre a pendência ─────────────────────────────────────────
    await drena(page);
    await page.goto("/app/estoque");
    const m = page.getByRole("main");
    await expect(m.getByTestId("painel-do-estoque")).toBeVisible({ timeout: 20_000 });
    await m.getByTestId("estoque-aba-pendencias").click();
    const pend = m.getByTestId("estoque-pendencia").filter({ hasText: nome });
    await expect(pend).toContainText("Sem saldo no local", { timeout: 20_000 });
    await foto(page, "1-pendencia");

    // ── 3. entrada e "Baixar agora" ─────────────────────────────────────────
    const { data: local } = await admin
      .from("clinic_estoque_locais")
      .select("id")
      .eq("organization_id", orgId)
      .eq("padrao", true)
      .single();
    const ent = await page.request.post("/api/v1/clinic/estoque/movimentos", {
      data: { acao: "entrada", product_id: productId, local_id: (local as { id: string }).id, quantidade: 5 },
    });
    expect(ent.status(), await ent.text()).toBe(200);
    await page.reload();
    await m.getByTestId("estoque-aba-pendencias").click();
    await pend.getByTestId("estoque-pendencia-baixar").click();
    await pend.getByTestId("estoque-pendencia-lote").selectOption({ index: 1 });
    await pend.getByTestId("estoque-pendencia-confirmar").click();
    await expect(pend).toHaveCount(0, { timeout: 20_000 });

    await m.getByTestId("estoque-aba-posicao").click();
    await m.getByPlaceholder("Buscar produto por nome ou código").fill(nome);
    await expect(m.getByTestId("estoque-produto").filter({ hasText: nome }).getByTestId("estoque-saldo")).toContainText("3", {
      timeout: 20_000,
    });
    await m.getByTestId("estoque-aba-movimentacoes").click();
    await expect(m.getByTestId("estoque-operacao").filter({ hasText: "Consumo no atendimento" }).first()).toContainText(nome, {
      timeout: 20_000,
    });
    await foto(page, "2-baixado");
    const { data: ligado } = await admin.from("clinic_procedimento_insumos").select("movimento_estoque_id").eq("id", insumoId).single();
    expect((ligado as { movimento_estoque_id: string | null }).movimento_estoque_id).not.toBeNull();
  } finally {
    if (!estava) await opcao(page, false);
  }
});
