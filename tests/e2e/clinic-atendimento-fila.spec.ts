/**
 * FORK clinic (prontuário F1, migration 9017) — a fila "Meus atendimentos", PELA TELA:
 *
 *   1. o admin liga a opção "prontuario" (config da clínica) e o atendente vira
 *      profissional ativo (service role, só no Supabase local);
 *   2. um paciente com horário agora na agenda do atendente chega (recepção);
 *   3. o atendente vê o paciente em "Aguardando" na fila dele e clica
 *      "Iniciar atendimento" — cai na área do atendimento;
 *   4. finaliza: o status vira "Finalizado";
 *   5. a recepção não vê "Iniciar/Finalizar" (aponta para a fila);
 *   6. desfaz: opção desligada e cadastro de profissional removido.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { lerCreds, loginComoAdmin } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "atendimento-fila");

interface Creds {
  org_id: string;
  users: Record<string, { email: string; id?: string } | undefined>;
}
const extra = JSON.parse(fs.readFileSync(path.join(RAIZ, ".e2e-creds.json"), "utf8")) as Creds;
let creds = lerCreds();

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

async function loginAtendente(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(creds.users.agent!.email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/app\//);
}

async function opcaoProntuario(page: Page, ligar: boolean): Promise<void> {
  const r = await page.request.patch("/api/v1/clinic/config", { data: { prontuario: ligar } });
  expect(r.status(), await r.text()).toBe(200);
}

test.describe.configure({ mode: "serial", timeout: 240_000 });

test("fila do profissional: chega → aguardando → iniciar → finalizar — pela tela", async ({ browser }) => {
  const agente = extra.users.agent?.id;
  if (!agente) throw new Error(".e2e-creds.json sem o id do atendente");
  const orgId = extra.org_id;
  const sufixo = Date.now().toString().slice(-6);

  // 1. opção ligada (admin, com MFA) e atendente como profissional ativo.
  const pAdmin = await browser.newPage();
  creds = await loginComoAdmin(pAdmin, creds);
  await opcaoProntuario(pAdmin, true);
  const { error: eProf } = await admin
    .from("clinic_professionals")
    .upsert({ organization_id: orgId, user_id: agente, display_name: "Profissional E2E", is_active: true } as never, {
      onConflict: "organization_id,user_id",
    });
  expect(eProf?.message ?? null).toBeNull();

  // 2. paciente com horário agora, na agenda do atendente.
  const { data: contato, error: eCont } = await admin
    .from("contacts")
    .insert({ organization_id: orgId, name: `Paciente Fila E2E ${sufixo}`, phone_number: `+55119${sufixo}0077` } as never)
    .select("id")
    .single();
  expect(eCont?.message ?? null).toBeNull();
  const inicio = new Date(Date.now() - 10 * 60_000);
  const { data: ag, error: eAg } = await admin
    .from("calendar_appointments")
    .insert({
      organization_id: orgId,
      title: `Avaliação E2E ${sufixo}`,
      starts_at: inicio.toISOString(),
      ends_at: new Date(inicio.getTime() + 30 * 60_000).toISOString(),
      owner_user_id: agente,
      contact_id: (contato as { id: string }).id,
      status: "confirmed",
    } as never)
    .select("id")
    .single();
  expect(eAg?.message ?? null).toBeNull();
  const agId = (ag as { id: string }).id;

  try {
    const pAt = await browser.newPage();
    await loginAtendente(pAt);
    const chegou = await pAt.request.post(`/api/v1/clinic/agendamentos/${agId}/visita`, { data: { status: "na_recepcao" } });
    expect(chegou.status(), await chegou.text()).toBe(200);

    // 3. fila: o paciente está em Aguardando, com o botão de iniciar.
    await pAt.goto("/app/atendimentos");
    const aguardando = pAt.getByTestId("fila-aguardando");
    await expect(aguardando.getByText(`Paciente Fila E2E ${sufixo}`)).toBeVisible({ timeout: 20_000 });
    await foto(pAt, "1-aguardando");
    await aguardando.getByTestId("item-da-fila").filter({ hasText: `Paciente Fila E2E ${sufixo}` }).getByTestId("fila-iniciar").click();
    await pAt.waitForURL(/\/app\/atendimentos\/[0-9a-f-]{36}$/);
    await expect(pAt.getByTestId("atendimento-status")).toHaveText("Em atendimento");
    await expect(pAt.getByRole("heading", { level: 1 })).toHaveText(`Paciente Fila E2E ${sufixo}`);
    await foto(pAt, "2-em-atendimento");

    // 5. a recepção não inicia nem finaliza: aponta para a fila.
    await pAt.goto("/app/recepcao");
    await expect(pAt.getByTestId("recepcao-ver-fila").first()).toBeVisible({ timeout: 20_000 });
    await pAt.goBack();

    // 4. finalizar.
    await pAt.getByTestId("atendimento-finalizar").click();
    await expect(pAt.getByTestId("atendimento-status")).toHaveText("Finalizado", { timeout: 20_000 });
    await foto(pAt, "3-finalizado");
    const { data: visita } = await admin.from("clinic_appointment_visits").select("status").eq("appointment_id", agId).single();
    expect((visita as { status: string }).status).toBe("finalizado");
    await pAt.close();
  } finally {
    // 6. desfaz o que a spec ligou.
    await opcaoProntuario(pAdmin, false);
    await admin.from("clinic_professionals").delete().eq("organization_id", orgId).eq("user_id", agente);
    await pAdmin.close();
  }
});
