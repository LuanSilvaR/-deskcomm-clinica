/**
 * FORK clinic — o Início da RECEPÇÃO, PELA TELA:
 *
 *   1. saudação, ações rápidas (busca, cadastrar, novo agendamento, conversas),
 *      contadores do dia, pacientes de hoje, sala de espera, confirmar para
 *      amanhã e vagas; os módulos recolhidos em "Todos os módulos";
 *   2. busca de paciente: acha o paciente com "Ficha" e "Agendar" (que leva à
 *      Agenda com o paciente); nome que não existe oferece "Cadastrar";
 *   3. com um compromisso hoje: a linha aparece, o contador "A chegar" filtra, e
 *      "Paciente chegou" leva o paciente para a sala de espera.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, ".superpowers", "evidence", "inicio-da-recepcao");

interface Creds {
  users: Record<string, { email: string; id?: string } | undefined>;
  agenda?: { tipo_nome: string };
}
const creds = JSON.parse(fs.readFileSync(path.join(RAIZ, ".e2e-creds.json"), "utf8")) as Creds;

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

test("início da recepção: busca, contadores, pacientes de hoje e sala de espera — pela tela", async ({ page }) => {
  test.setTimeout(240_000);
  if (!creds.agenda || !creds.users.agent?.id) throw new Error(".e2e-creds.json sem agenda/agent");
  const agente = creds.users.agent.id;
  await loginComoAdmin(page, creds as unknown as CredsE2E);

  // ── dados: um paciente e, se houver vaga ainda hoje, um compromisso ─────
  const sufixo = Date.now().toString().slice(-8);
  const nomePaciente = `Lara Inicio${sufixo}`;
  const criado = await page.request.post("/api/v1/contacts", {
    data: { name: nomePaciente, phone_number: `+551194${sufixo}`, source: "whatsapp" },
  });
  expect(criado.status(), await criado.text()).toBe(201);
  const contatoId = ((await criado.json()) as { data: { contact: { id: string } } }).data.contact.id;
  const tipos = ((await (await page.request.get("/api/v1/agenda/tipos")).json()) as { data: { id: string; name: string }[] }).data;
  const tipoId = tipos.find((t) => t.name === creds.agenda!.tipo_nome)!.id;
  const agora = Date.now();
  const livres = (await (
    await page.request.get(
      `/api/v1/agenda/horarios-livres?event_type_id=${tipoId}&owner_user_id=${agente}` +
        `&de=${new Date(agora).toISOString()}&ate=${new Date(agora + 12 * 3_600_000).toISOString()}`,
    )
  ).json()) as { data?: { slots: { inicio: string }[] } };
  const hojeSP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const slot = (livres.data?.slots ?? []).find(
    (s) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(s.inicio)) === hojeSP,
  );
  let agendamentoId: string | null = null;
  if (slot) {
    const marcado = await page.request.post("/api/v1/agenda/agendamentos", {
      data: { event_type_id: tipoId, starts_at: slot.inicio, contact_id: contatoId, owner_user_id: agente },
    });
    expect(marcado.status(), await marcado.text()).toBe(201);
    agendamentoId = ((await marcado.json()) as { data: { id: string } }).data.id;
  }

  try {
    await page.goto("/app/inicio");
    const m = page.getByRole("main");

    // ── 1. a estrutura ─────────────────────────────────────────────────────
    await expect(m.getByTestId("painel-da-recepcao-no-inicio")).toBeVisible({ timeout: 30_000 });
    await expect(m.getByTestId("inicio-acoes-rapidas")).toBeVisible();
    for (const c of ["a_chegar", "sala", "em_atendimento", "finalizados", "faltas", "sem_confirmacao"]) {
      await expect(m.getByTestId(`inicio-contador-${c}`)).toBeVisible();
    }
    await expect(m.getByTestId("inicio-pacientes-de-hoje")).toBeVisible();
    await expect(m.getByTestId("inicio-sala-de-espera")).toBeVisible();
    await expect(m.getByTestId("inicio-confirmar-amanha")).toBeVisible();
    await expect(m.getByTestId("inicio-vagas")).toBeVisible();
    await expect(m.getByTestId("inicio-todos-os-modulos")).not.toHaveAttribute("open", "");
    await foto(page, "01-inicio-da-recepcao");

    // ── 2. busca de paciente ───────────────────────────────────────────────
    await m.getByTestId("inicio-busca").fill(nomePaciente);
    const item = m.getByTestId("inicio-busca-item").filter({ hasText: nomePaciente });
    await expect(item).toBeVisible({ timeout: 20_000 });
    await expect(item.getByTestId("inicio-busca-agendar")).toHaveAttribute("href", `/app/agenda?contato=${contatoId}`);
    await foto(page, "02-busca-de-paciente");
    await m.getByTestId("inicio-busca").fill(`Ninguem Assim ${sufixo}`);
    await expect(m.getByTestId("inicio-busca-cadastrar")).toBeVisible({ timeout: 20_000 });
    await m.getByTestId("inicio-busca").fill("");

    // ── 3. o compromisso de hoje: filtra e avança ──────────────────────────
    if (agendamentoId) {
      const linha = m.locator(`[data-testid="inicio-linha"][data-id="${agendamentoId}"]`);
      await expect(linha).toContainText(nomePaciente, { timeout: 20_000 });
      await m.getByTestId("inicio-contador-a_chegar").click();
      await expect(m.getByTestId("inicio-contador-a_chegar")).toHaveAttribute("aria-pressed", "true");
      await expect(linha).toBeVisible();
      await linha.getByTestId("inicio-avancar").click();
      const naSala = m.locator(`[data-testid="inicio-sala-linha"][data-id="${agendamentoId}"]`);
      await expect(naSala).toBeVisible({ timeout: 20_000 });
      await foto(page, "03-paciente-na-sala-de-espera");
    }
  } finally {
    if (agendamentoId) {
      await page.request.delete("/api/v1/agenda/agendamentos", { data: { id: agendamentoId, reason: "limpeza do teste e2e" } });
    }
  }
});
