/**
 * FORK clinic (épico E5) — faltas e prazo do paciente, PELA TELA:
 *
 *   1. um paciente com 2 faltas nos últimos 12 meses e uma consulta marcada;
 *   2. a Recepção leva a "Faltas": ele aparece com 2 faltas e o próximo horário;
 *   3. o detalhe do compromisso avisa "Faltou 2× nos últimos 12 meses";
 *   4. ao marcar, a busca mostra "faltou 2×" junto do paciente;
 *   5. o admin grava o prazo de 24 h para o paciente desmarcar pelo WhatsApp e
 *      volta para 0 (a recusa do agente de IA dentro do prazo é provada no
 *      handler: tests/unit/pessoa-marca-fora-da-grade.test.ts).
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "faltas-e-prazo");

interface Creds {
  org_id: string;
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

test("faltas do paciente e prazo para desmarcar — pela tela", async ({ page }) => {
  test.setTimeout(180_000);
  const dono = creds.users.agent?.id;
  if (!dono) throw new Error(".e2e-creds.json sem agent");
  await loginComoAdmin(page, creds as unknown as CredsE2E);
  const sufixo = Date.now().toString().slice(-8);
  const nome = `Dora Faltosa${sufixo}`;

  // ── 1. paciente com 2 faltas e uma consulta marcada ──────────────────────
  const { data: c, error: e1 } = await admin
    .from("contacts")
    .insert({ organization_id: creds.org_id, name: nome, phone_number: `+551191${sufixo}` })
    .select("id")
    .single();
  if (e1) throw new Error(`contato: ${e1.message}`);
  const contatoId = (c as { id: string }).id;
  const linha = (diasAtras: number, status: string) => {
    const inicio = new Date(Date.now() - diasAtras * 86_400_000);
    return {
      organization_id: creds.org_id,
      title: "Consulta",
      starts_at: inicio.toISOString(),
      ends_at: new Date(inicio.getTime() + 30 * 60_000).toISOString(),
      owner_user_id: dono,
      contact_id: contatoId,
      status,
    };
  };
  const { error: e2 } = await admin.from("calendar_appointments").insert([linha(40, "no_show"), linha(100, "no_show"), linha(500, "no_show")]);
  if (e2) throw new Error(`faltas: ${e2.message}`);
  const { data: futuro, error: e3 } = await admin.from("calendar_appointments").insert(linha(-5, "confirmed")).select("id").single();
  if (e3) throw new Error(`futuro: ${e3.message}`);
  const futuroId = (futuro as { id: string }).id;

  // ── 2. Recepção → Faltas ──────────────────────────────────────────────────
  await page.goto("/app/recepcao");
  await page.getByTestId("recepcao-abrir-faltas").click();
  await expect(page).toHaveURL(/\/app\/agenda\/faltas/);
  const linhaDela = page.getByTestId("faltoso").filter({ hasText: nome });
  await expect(linhaDela).toBeVisible({ timeout: 20_000 });
  // a falta de 500 dias atrás fica fora da janela de 12 meses
  await expect(linhaDela.getByTestId("faltas-do-paciente")).toHaveText("2");
  await expect(linhaDela.locator(`a[href="/app/agenda?compromisso=${futuroId}"]`)).toBeVisible();
  await foto(page, "01-lista-de-faltas");

  // ── 3. o detalhe do compromisso avisa ────────────────────────────────────
  await page.goto(`/app/agenda?compromisso=${futuroId}`);
  await expect(page.getByTestId("visita-do-paciente").getByTestId("faltas-do-paciente")).toContainText("Faltou 2× nos últimos 12 meses", {
    timeout: 20_000,
  });
  await foto(page, "02-detalhe-com-faltas");

  // ── 4. a busca ao marcar mostra as faltas ────────────────────────────────
  const busca = (await (await page.request.get(`/api/v1/agenda/vinculos?q=${encodeURIComponent(nome)}`)).json()) as {
    data: { contacts: { id: string; detalhe?: string }[] };
  };
  expect(busca.data.contacts.find((x) => x.id === contatoId)?.detalhe).toContain("faltou 2×");
  await page.goto("/app/agenda");
  await page.getByRole("button", { name: /novo agendamento/i }).click();
  await page.getByTestId("quem-sera-atendido").fill(nome);
  await expect(page.getByRole("option", { name: new RegExp(nome) })).toContainText("faltou 2×", { timeout: 10_000 });
  await foto(page, "03-busca-mostra-faltas");

  // ── 5. o prazo pela tela ──────────────────────────────────────────────────
  await page.goto("/app/settings/tenant/profissionais");
  const prazo = page.getByRole("main").getByTestId("clinic-prazo");
  await prazo.getByTestId("clinic-prazo-horas").fill("24");
  await prazo.getByTestId("clinic-prazo-salvar").click();
  await expect(prazo).toContainText("Prazo para o paciente desmarcar pelo WhatsApp: 24 h");
  await foto(page, "04-prazo-24h");
  const cfg = (await (await page.request.get("/api/v1/clinic/config")).json()) as { data: { prazo_paciente_horas: number } };
  expect(cfg.data.prazo_paciente_horas).toBe(24);
  await prazo.getByTestId("clinic-prazo-horas").fill("0");
  await prazo.getByTestId("clinic-prazo-salvar").click();
  await expect(prazo).toContainText("Sem prazo para o paciente desmarcar pelo WhatsApp");
});
