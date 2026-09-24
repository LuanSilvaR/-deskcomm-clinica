/**
 * FORK clinic (migration 9007) — salas e equipamentos, PELA TELA:
 *
 *   1. o admin liga "Salas e equipamentos", cadastra uma sala única e faz o tipo
 *      de atendimento exigir "Uma de <categoria>" — tudo pela tela;
 *   2. dois profissionais com jornada no mesmo horário (o segundo recebe jornada
 *      só durante a spec). Antes: o horário é oferecido aos dois;
 *   3. marcado com o primeiro, o compromisso reserva a sala (o detalhe mostra) e
 *      o MESMO horário deixa de ser oferecido ao segundo;
 *   4. o encaixe do segundo naquele horário é recusado dizendo que falta sala;
 *   5. desfaz tudo (compromisso, exigência, sala, jornada e opção).
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "salas-e-equipamentos");

interface Creds {
  org_id: string;
  users: Record<string, { email: string; id?: string } | undefined>;
  agenda?: { tipo_nome: string };
}

const creds = JSON.parse(fs.readFileSync(path.join(RAIZ, ".e2e-creds.json"), "utf8")) as Creds;

// A spec escreve com a service role (jornada temporária): só no Supabase local.
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

async function opcao(page: Page, ligar: boolean): Promise<void> {
  await page.goto("/app/settings/tenant/profissionais");
  const bloco = page.getByRole("main").getByTestId("clinic-recursos");
  await expect(bloco).toBeVisible({ timeout: 20_000 });
  const ligado = await bloco.getByText("Salas e equipamentos ligados").isVisible();
  if (ligado !== ligar) {
    await page.getByRole("main").getByTestId("clinic-recursos-alternar").click();
    await expect(bloco.getByText(ligar ? "Salas e equipamentos ligados" : "Salas e equipamentos desligados")).toBeVisible();
  }
}

async function slotsDe(page: Page, tipoId: string, dono: string, de: string, ate: string): Promise<string[]> {
  const r = (await (
    await page.request.get(`/api/v1/agenda/horarios-livres?event_type_id=${tipoId}&owner_user_id=${dono}&de=${de}&ate=${ate}`)
  ).json()) as { data?: { slots: { inicio: string }[] } };
  return (r.data?.slots ?? []).map((s) => s.inicio);
}

test("salas e equipamentos: a sala reservada some da oferta do outro profissional — pela tela", async ({ page }) => {
  test.setTimeout(240_000);
  const agente = creds.users.agent?.id;
  const gerente = creds.users.manager?.id;
  if (!creds.agenda || !agente || !gerente) throw new Error(".e2e-creds.json sem agenda/agent/manager");
  await loginComoAdmin(page, creds as unknown as CredsE2E);
  const sufixo = Date.now().toString().slice(-6);
  const categoria = `Sala E2E${sufixo}`;
  const nomeDaSala = `Sala Única E2E${sufixo}`;

  const tipos = ((await (await page.request.get("/api/v1/agenda/tipos")).json()) as { data: { id: string; name: string }[] }).data;
  const tipoId = tipos.find((t) => t.name === creds.agenda!.tipo_nome)!.id;
  expect((await page.request.put(`/api/v1/clinic/tipos/${tipoId}/especialidades`, { data: { specialty_ids: [] } })).status()).toBe(200);

  // Jornada temporária do gerente = a do atendente (mesmos horários).
  const { data: jornadaDoAgente } = await admin
    .from("attendant_availability")
    .select("schedule")
    .eq("organization_id", creds.org_id)
    .eq("user_id", agente)
    .single();
  const { data: jornadaAntiga } = await admin
    .from("attendant_availability")
    .select("id, schedule, is_available, capacity")
    .eq("organization_id", creds.org_id)
    .eq("user_id", gerente)
    .maybeSingle();
  if (jornadaAntiga) {
    await admin.from("attendant_availability").update({ schedule: (jornadaDoAgente as { schedule: unknown }).schedule }).eq("id", (jornadaAntiga as { id: string }).id);
  } else {
    const { error } = await admin
      .from("attendant_availability")
      .insert({ organization_id: creds.org_id, user_id: gerente, schedule: (jornadaDoAgente as { schedule: unknown }).schedule });
    if (error) throw new Error(`jornada do gerente: ${error.message}`);
  }

  try {
    // ── 1. pela tela: liga, cadastra a sala e exige no tipo ─────────────────
    await opcao(page, true);
    await page.getByRole("tab", { name: "Salas e equipamentos" }).click();
    const aba = page.getByTestId("clinic-salas-e-equipamentos");
    await aba.getByTestId("recurso-nome").fill(nomeDaSala);
    await aba.getByTestId("recurso-categoria").fill(categoria);
    await aba.getByTestId("recurso-salvar").click();
    await expect(aba.getByTestId("recurso").filter({ hasText: nomeDaSala })).toBeVisible();
    const doTipo = aba.locator(`[data-testid="recursos-do-tipo"][data-tipo="${tipoId}"]`);
    await doTipo.getByTestId("recursos-do-tipo-nova").selectOption(`c:${categoria}`);
    const salvou = page.waitForResponse((r) => r.url().includes(`/api/v1/clinic/tipos/${tipoId}/recursos`) && r.request().method() === "PUT");
    await doTipo.getByTestId("recursos-do-tipo-adicionar").click();
    expect((await salvou).status()).toBe(200);
    await expect(doTipo).toContainText(`Uma de ${categoria}`);
    await foto(page, "01-sala-cadastrada-e-exigida");

    // ── 2. antes: o horário é oferecido aos dois ────────────────────────────
    const de = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const ate = new Date(Date.now() + 13 * 86_400_000).toISOString();
    const doAgente = await slotsDe(page, tipoId, agente, de, ate);
    const doGerente = await slotsDe(page, tipoId, gerente, de, ate);
    const comum = doAgente.find((s) => doGerente.includes(s));
    if (!comum) throw new Error("nenhum horário livre em comum para o teste");

    // ── 3. marca com o atendente: a sala é reservada ─────────────────────────
    const marcado = await page.request.post("/api/v1/agenda/agendamentos", {
      data: { event_type_id: tipoId, starts_at: comum, owner_user_id: agente },
    });
    expect(marcado.status(), await marcado.text()).toBe(201);
    const agendamentoId = ((await marcado.json()) as { data: { id: string } }).data.id;
    expect(await slotsDe(page, tipoId, gerente, de, ate)).not.toContain(comum);
    expect(await slotsDe(page, tipoId, agente, de, ate)).not.toContain(comum);

    // ── 4. o encaixe do gerente no mesmo horário é recusado (falta sala) ─────
    const encaixe = await page.request.post("/api/v1/agenda/agendamentos", {
      data: { event_type_id: tipoId, starts_at: comum, owner_user_id: gerente },
    });
    expect(encaixe.status()).toBe(422);
    const corpo = (await encaixe.json()) as { error: { code: string; message: string } };
    expect(corpo.error.code).toBe("agenda_horario_indisponivel");
    expect(corpo.error.message).toMatch(/sala ou equipamento/);

    // o detalhe do compromisso diz qual sala ficou reservada (o paciente é
    // opcional aqui; a sala aparece junto do status da visita quando há paciente)
    const detalhe = (await (await page.request.get(`/api/v1/clinic/agendamentos/${agendamentoId}/visita`)).json()) as {
      data: { recursos: string[] };
    };
    expect(detalhe.data.recursos).toEqual([nomeDaSala]);

    // ── 5. desfaz ────────────────────────────────────────────────────────────
    expect(
      (await page.request.delete("/api/v1/agenda/agendamentos", { data: { id: agendamentoId, reason: "limpeza do teste e2e" } })).status(),
    ).toBe(200);
    // cancelado libera a sala na hora
    expect(await slotsDe(page, tipoId, gerente, de, ate)).toContain(comum);
    await foto(page, "02-depois-de-cancelar");
  } finally {
    await page.request.put(`/api/v1/clinic/tipos/${tipoId}/recursos`, { data: { exigencias: [] } });
    const lista = (await (await page.request.get("/api/v1/clinic/recursos")).json()) as { data: { id: string; name: string }[] };
    const sala = lista.data.find((r) => r.name === nomeDaSala);
    if (sala) await page.request.patch("/api/v1/clinic/recursos", { data: { id: sala.id, is_active: false } });
    if (jornadaAntiga) {
      await admin.from("attendant_availability").update({ schedule: (jornadaAntiga as { schedule: unknown }).schedule }).eq("id", (jornadaAntiga as { id: string }).id);
    } else {
      await admin.from("attendant_availability").delete().eq("organization_id", creds.org_id).eq("user_id", gerente);
    }
    await opcao(page, false);
  }
});
