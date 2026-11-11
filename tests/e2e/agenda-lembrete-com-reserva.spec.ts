/**
 * FORK clinic (#83) — lembrete pelo número oficial da Meta, com reserva pelo QR
 * code, PELA TELA:
 *
 *   1. com a chave desligada, o seletor de modelo NÃO aparece em Configurações ›
 *      Agendamentos (comportamento de antes);
 *   2. o admin liga a chave em Configurações › Profissionais; o seletor passa a
 *      aparecer, com "Nenhum" e a frase de onde criar o modelo;
 *   3. um compromisso cujo lembrete não saiu por falta de modelo
 *      (reminder_falha = 'meta_sem_modelo') mostra o selo com o motivo;
 *   4. a chave volta a ficar DESLIGADA e o que a spec criou é apagado.
 *
 * Nenhuma chamada à Meta, ao WAHA ou a IA: o compromisso é gravado como o cron
 * o deixaria (a regra do envio é provada nos testes unitários).
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, "evidence", "83-lembrete-com-reserva");

interface Creds extends CredsE2E {
  org_id: string;
  users: Record<string, { email: string; id?: string }>;
}

const creds = JSON.parse(fs.readFileSync(path.join(RAIZ, ".e2e-creds.json"), "utf8")) as Creds;

// A spec ESCREVE com a service role: só roda contra Supabase local.
const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(URL_SUPABASE)) {
  throw new Error(`Supabase não é local (${URL_SUPABASE}) — esta spec só roda no ambiente de teste.`);
}
const admin = createClient(URL_SUPABASE, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { autoRefreshToken: false, persistSession: false },
});

test.describe.configure({ timeout: 180_000 });

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

/** Grava a chave direto no banco (preserva o resto do settings). */
async function definirChave(valor: boolean): Promise<void> {
  const { data, error } = await admin.from("organizations").select("settings").eq("id", creds.org_id).single();
  if (error) throw new Error(`organização: ${error.message}`);
  const settings = ((data as { settings: Record<string, unknown> | null }).settings ?? {}) as Record<string, unknown>;
  const clinic = { ...((settings.clinic as Record<string, unknown> | undefined) ?? {}), lembrete_com_reserva: valor };
  const { error: e2 } = await admin.from("organizations").update({ settings: { ...settings, clinic } }).eq("id", creds.org_id);
  if (e2) throw new Error(`chave: ${e2.message}`);
}

let tipoId = "";
let contatoId = "";
let agendamentoId = "";
const sufixo = Date.now().toString().slice(-6);
const inicioDoCompromisso = new Date(Date.now() + 3 * 3_600_000);
const diaDoCompromisso = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(inicioDoCompromisso);

test.beforeAll(async () => {
  await definirChave(false);
  const { data: tipo, error: e1 } = await admin
    .from("calendar_event_types")
    .insert({
      organization_id: creds.org_id,
      name: `Consulta reserva ${sufixo}`,
      slug: `consulta-reserva-${sufixo}`,
      reminder_enabled: true,
      reminder_minutes_before: 1440,
    })
    .select("id")
    .single();
  if (e1) throw new Error(`tipo: ${e1.message}`);
  tipoId = (tipo as { id: string }).id;

  const { data: c, error: e2 } = await admin
    .from("contacts")
    .insert({ organization_id: creds.org_id, name: `Paciente Fictícia ${sufixo}`, phone_number: `+551193${sufixo}` })
    .select("id")
    .single();
  if (e2) throw new Error(`contato: ${e2.message}`);
  contatoId = (c as { id: string }).id;

  const inicio = inicioDoCompromisso;
  const { data: a, error: e3 } = await admin
    .from("calendar_appointments")
    .insert({
      organization_id: creds.org_id,
      event_type_id: tipoId,
      title: "Consulta de avaliação",
      starts_at: inicio.toISOString(),
      ends_at: new Date(inicio.getTime() + 30 * 60_000).toISOString(),
      owner_user_id: creds.users.agent!.id,
      contact_id: contatoId,
      status: "confirmed",
      reminder_falha: "meta_sem_modelo",
      reminder_falha_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (e3) throw new Error(`compromisso: ${e3.message}`);
  agendamentoId = (a as { id: string }).id;
});

test.afterAll(async () => {
  await definirChave(false);
  if (agendamentoId) await admin.from("calendar_appointments").delete().eq("id", agendamentoId);
  if (contatoId) await admin.from("contacts").delete().eq("id", contatoId);
  if (tipoId) await admin.from("calendar_event_types").delete().eq("id", tipoId);
});

test("chave desligada esconde o seletor; ligada mostra; o selo diz por que o lembrete não saiu", async ({ page }) => {
  await loginComoAdmin(page, creds);

  // ── 1. desligada: o seletor não existe ───────────────────────────────────
  await page.goto("/app/settings/tenant/agenda");
  await expect(page.getByTestId("tipos-de-agendamento-config")).toBeVisible({ timeout: 30_000 });
  let linha = page.getByTestId("lista-de-tipos").getByRole("listitem").filter({ hasText: `Consulta reserva ${sufixo}` });
  await expect(linha).toBeVisible({ timeout: 20_000 });
  await linha.getByRole("button", { name: "Editar" }).click();
  await expect(linha.getByTestId(/^editar-lembrete-[0-9a-f]/).first()).toBeVisible({ timeout: 15_000 });
  await expect(linha.getByTestId(/^editar-lembrete-modelo-/)).toHaveCount(0);
  await foto(page, "01-seletor-ausente-com-a-chave-desligada");

  // ── 2. liga a chave pela tela ────────────────────────────────────────────
  await page.goto("/app/settings/tenant/profissionais");
  const bloco = page.getByRole("main").getByTestId("clinic-lembrete-reserva");
  await expect(bloco).toBeVisible({ timeout: 30_000 });
  await expect(bloco.getByText("Lembrete pelo número oficial, com reserva pelo QR code")).toBeVisible();
  await foto(page, "02-chave-desligada-em-profissionais");
  await bloco.getByTestId("clinic-lembrete-reserva-alternar").click();
  await expect(bloco.getByTestId("clinic-lembrete-reserva-alternar")).toHaveText("Desligar", { timeout: 15_000 });
  await foto(page, "03-chave-ligada-em-profissionais");

  // ── 3. ligada: o seletor aparece com "Nenhum" e a frase de onde criar ────
  await page.goto("/app/settings/tenant/agenda");
  await expect(page.getByTestId("tipos-de-agendamento-config")).toBeVisible({ timeout: 30_000 });
  linha = page.getByTestId("lista-de-tipos").getByRole("listitem").filter({ hasText: `Consulta reserva ${sufixo}` });
  await linha.getByRole("button", { name: "Editar" }).click();
  const seletor = linha.getByTestId(/^editar-lembrete-modelo-(?!bloco)/).first();
  await expect(seletor).toBeVisible({ timeout: 15_000 });
  await expect(seletor.locator("option").first()).toHaveText("Nenhum");
  await expect(seletor).toHaveValue("");
  await expect(linha.getByText("Crie um em Conexões → Modelos")).toBeVisible();
  await foto(page, "04-seletor-de-modelo-com-a-chave-ligada");

  // ── 4. o selo no compromisso cujo lembrete não saiu (painel da Recepção) ──
  await page.goto(`/app/recepcao?dia=${diaDoCompromisso}`);
  const selo = page
    .getByTestId("cartao-da-recepcao")
    .filter({ hasText: `Paciente Fictícia ${sufixo}` })
    .getByTestId("selo-da-confirmacao");
  await expect(selo).toHaveAttribute("data-falha-do-lembrete", "meta_sem_modelo", { timeout: 30_000 });
  await expect(selo).toHaveText("Lembrete não saiu: janela fechada e sem modelo aprovado — ligar");
  await foto(page, "05-selo-lembrete-sem-modelo");

  // ── 5. devolve a chave ao estado de antes, pela tela ─────────────────────
  await page.goto("/app/settings/tenant/profissionais");
  const bloco2 = page.getByRole("main").getByTestId("clinic-lembrete-reserva");
  await expect(bloco2.getByTestId("clinic-lembrete-reserva-alternar")).toHaveText("Desligar", { timeout: 30_000 });
  await bloco2.getByTestId("clinic-lembrete-reserva-alternar").click();
  await expect(bloco2.getByTestId("clinic-lembrete-reserva-alternar")).toHaveText("Ligar", { timeout: 15_000 });
});
