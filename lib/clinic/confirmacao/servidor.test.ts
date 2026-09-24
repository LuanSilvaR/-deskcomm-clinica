import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  aplicarResposta,
  marcarLembretesQueFalharam,
  marcarLembretesQueNaoSairam,
  registrarPedido,
  tipoPedeConfirmacao,
  confirmacaoAutomaticaLigada,
  degrauPedeConfirmacao,
  deveAnexarPedido,
  marcarSemResposta,
} from "./servidor";

/**
 * Cliente falso: cada `from(tabela)` devolve um construtor encadeável que
 * registra a operação e os filtros, e resolve com o que o teste pôs em
 * `respostas[tabela][operacao]`.
 */
interface Chamada {
  tabela: string;
  op: "select" | "insert" | "update" | "upsert";
  valores?: unknown;
  filtros: [string, string, unknown][];
}

function falso(respostas: Record<string, Partial<Record<Chamada["op"], { data: unknown; error?: unknown }>>>) {
  const chamadas: Chamada[] = [];
  const cliente = {
    from(tabela: string) {
      const chamada: Chamada = { tabela, op: "select", filtros: [] };
      let registrada = false;
      const registrar = () => {
        if (!registrada) chamadas.push(chamada);
        registrada = true;
      };
      const resultado = () => {
        registrar();
        const r = respostas[tabela]?.[chamada.op] ?? { data: null };
        return { data: r.data, error: r.error ?? null };
      };
      const b: Record<string, unknown> = {
        select: () => b,
        insert: (v: unknown) => ((chamada.op = "insert"), (chamada.valores = v), b),
        update: (v: unknown) => ((chamada.op = "update"), (chamada.valores = v), b),
        upsert: (v: unknown) => ((chamada.op = "upsert"), (chamada.valores = v), b),
        eq: (c: string, v: unknown) => (chamada.filtros.push(["eq", c, v]), b),
        in: (c: string, v: unknown) => (chamada.filtros.push(["in", c, v]), b),
        gt: (c: string, v: unknown) => (chamada.filtros.push(["gt", c, v]), b),
        lte: (c: string, v: unknown) => (chamada.filtros.push(["lte", c, v]), b),
        lt: (c: string, v: unknown) => (chamada.filtros.push(["lt", c, v]), b),
        not: (c: string, op: string, v: unknown) => (chamada.filtros.push(["not", `${c}.${op}`, v]), b),
        order: () => b,
        limit: () => b,
        single: async () => resultado(),
        maybeSingle: async () => resultado(),
        then: (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) => Promise.resolve(resultado()).then(ok, erro),
      };
      return b;
    },
  };
  return { cliente: cliente as unknown as SupabaseClient, chamadas };
}

const ORG = "org-1";
const pedido = (extra: Record<string, unknown> = {}) => ({
  id: "req-1",
  appointment_id: "ag-1",
  task_id: null,
  status: "aguardando",
  calendar_appointments: { starts_at: "2026-10-01T13:00:00Z", status: "confirmed", title: "Consulta", owner_user_id: "u1", contact_id: "c1" },
  ...extra,
});

describe("opção e degrau", () => {
  it("confirmação nasce desligada e só liga com true", () => {
    expect(confirmacaoAutomaticaLigada(undefined)).toBe(false);
    expect(confirmacaoAutomaticaLigada({ clinic: { confirmacao_automatica: "true" } })).toBe(false);
    expect(confirmacaoAutomaticaLigada({ clinic: { confirmacao_automatica: true } })).toBe(true);
  });

  it("só o degrau de 12 h ou mais pede confirmação", () => {
    expect(degrauPedeConfirmacao([120])).toBe(false);
    expect(degrauPedeConfirmacao([1440])).toBe(true);
    expect(degrauPedeConfirmacao([720, 30])).toBe(true);
  });

  it("não pede de novo a quem já respondeu", async () => {
    const { cliente } = falso({ clinic_confirmation_requests: { select: { data: { status: "confirmado" } } } });
    expect(
      await deveAnexarPedido(cliente, { organizationId: ORG, appointmentId: "ag-1", settings: { clinic: { confirmacao_automatica: true } }, degraus: [1440] }),
    ).toBe(false);
  });

  it("opção desligada não consulta o banco", async () => {
    const { cliente, chamadas } = falso({});
    expect(await deveAnexarPedido(cliente, { organizationId: ORG, appointmentId: "ag-1", settings: {}, degraus: [1440] })).toBe(false);
    expect(chamadas).toHaveLength(0);
  });
});

describe("aplicarResposta", () => {
  const args = { organizationId: ORG, contactId: "c1", messageId: "m1", recebidoEm: new Date("2026-09-30T12:00:00Z") };

  it("sem pedido aberto: nada acontece", async () => {
    const { cliente, chamadas } = falso({ clinic_confirmation_requests: { select: { data: [] } } });
    expect((await aplicarResposta(cliente, args)).efeito).toBe("sem_pedido");
    expect(chamadas.filter((c) => c.op !== "select")).toHaveLength(0);
  });

  it("texto que não é SIM/NÃO é conversa: o pedido segue aberto", async () => {
    const { cliente, chamadas } = falso({
      clinic_confirmation_requests: { select: { data: [pedido()] } },
      messages: { select: { data: { body: "Qual o endereço?" } } },
    });
    expect((await aplicarResposta(cliente, args)).efeito).toBe("conversa");
    expect(chamadas.filter((c) => c.op !== "select")).toHaveLength(0);
  });

  it("SIM: confirma o pedido e fecha a tarefa de ligação", async () => {
    const { cliente, chamadas } = falso({
      clinic_confirmation_requests: { select: { data: [pedido({ status: "sem_resposta", task_id: "t-ligar" })] } },
      messages: { select: { data: { body: "Sim!" } } },
    });
    expect((await aplicarResposta(cliente, args)).efeito).toBe("confirmado");
    const tarefa = chamadas.find((c) => c.tabela === "crm_tasks" && c.op === "update");
    expect(tarefa?.valores).toEqual({ status: "done" });
    expect(tarefa?.filtros).toContainEqual(["eq", "organization_id", ORG]);
    const req = chamadas.find((c) => c.tabela === "clinic_confirmation_requests" && c.op === "update");
    expect(req?.valores).toMatchObject({ status: "confirmado", answer_message_id: "m1" });
    // só muda se ainda estiver no status lido — duas respostas seguidas não brigam
    expect(req?.filtros).toContainEqual(["eq", "status", "sem_resposta"]);
  });

  it("NÃO: abre a tarefa de remarcar na organização do evento", async () => {
    const { cliente, chamadas } = falso({
      clinic_confirmation_requests: { select: { data: [pedido()] } },
      messages: { select: { data: { body: "não posso" } } },
      crm_tasks: { insert: { data: { id: "t-remarcar" } } },
    });
    expect((await aplicarResposta(cliente, args)).efeito).toBe("recusado");
    const nova = chamadas.find((c) => c.tabela === "crm_tasks" && c.op === "insert");
    expect(nova?.valores).toMatchObject({ organization_id: ORG, title: "Paciente pediu para remarcar", contact_id: "c1", priority: "high" });
    const req = chamadas.find((c) => c.tabela === "clinic_confirmation_requests" && c.op === "update");
    expect(req?.valores).toMatchObject({ status: "recusado", task_id: "t-remarcar" });
  });

  it("a busca do pedido filtra organização e contato", async () => {
    const { cliente, chamadas } = falso({ clinic_confirmation_requests: { select: { data: [] } } });
    await aplicarResposta(cliente, args);
    expect(chamadas[0]?.filtros).toEqual(
      expect.arrayContaining([
        ["eq", "organization_id", ORG],
        ["eq", "contact_id", "c1"],
      ]),
    );
  });
});

describe("marcarSemResposta", () => {
  it("abre a tarefa de ligar na organização da linha e marca sem_resposta", async () => {
    const { cliente, chamadas } = falso({
      clinic_confirmation_requests: { select: { data: [{ ...pedido(), organization_id: "org-2", contact_id: "c9" }] } },
      crm_tasks: { insert: { data: { id: "t-ligar" } } },
    });
    expect(await marcarSemResposta(cliente, new Date("2026-10-01T10:00:00Z"))).toEqual({ marcados: 1, falhas: 0 });
    const nova = chamadas.find((c) => c.tabela === "crm_tasks" && c.op === "insert");
    expect(nova?.valores).toMatchObject({
      organization_id: "org-2",
      title: "Ligar para confirmar a consulta",
      contact_id: "c9",
      due_date: "2026-10-01T13:00:00Z",
    });
    const req = chamadas.find((c) => c.tabela === "clinic_confirmation_requests" && c.op === "update");
    expect(req?.valores).toEqual({ status: "sem_resposta", task_id: "t-ligar" });
    expect(req?.filtros).toContainEqual(["eq", "status", "aguardando"]);
  });

  it("a janela é de 4 h a partir de agora", async () => {
    const { cliente, chamadas } = falso({ clinic_confirmation_requests: { select: { data: [] } } });
    await marcarSemResposta(cliente, new Date("2026-10-01T10:00:00Z"));
    expect(chamadas[0]?.filtros).toContainEqual(["lte", "calendar_appointments.starts_at", "2026-10-01T14:00:00.000Z"]);
  });
});

describe("FORK clinic (9006): o lembrete que falhou", () => {
  it("o pedido guarda a mensagem do lembrete (o cron confere o status dela)", async () => {
    const { cliente, chamadas } = falso({});
    await registrarPedido(cliente, { organizationId: ORG, appointmentId: "ag-1", contactId: "c1", conversationId: "cv1", reminderMessageId: "msg-1" });
    expect(chamadas[0]?.valores).toMatchObject({ reminder_message_id: "msg-1", falha: null, status: "aguardando" });
  });

  it("tipo pede confirmação só com lembrete ligado e degrau de 12 h ou mais", () => {
    expect(tipoPedeConfirmacao({ reminder_enabled: true, reminder_minutes_before: 1440, reminder_extra_offsets_minutes: null })).toBe(true);
    expect(tipoPedeConfirmacao({ reminder_enabled: true, reminder_minutes_before: 60, reminder_extra_offsets_minutes: [720] })).toBe(true);
    expect(tipoPedeConfirmacao({ reminder_enabled: true, reminder_minutes_before: 60, reminder_extra_offsets_minutes: [30] })).toBe(false);
    expect(tipoPedeConfirmacao({ reminder_enabled: false, reminder_minutes_before: 1440, reminder_extra_offsets_minutes: null })).toBe(false);
  });

  it("envio falhou: tarefa na hora, pedido vira sem_resposta com falha envio_falhou", async () => {
    const { cliente, chamadas } = falso({
      clinic_confirmation_requests: { select: { data: [{ ...pedido(), organization_id: "org-3", contact_id: "c3" }] } },
      crm_tasks: { insert: { data: { id: "t-falhou" } } },
    });
    expect(await marcarLembretesQueFalharam(cliente, new Date("2026-09-30T12:00:00Z"))).toEqual({ marcados: 1, falhas: 0 });
    // só a mensagem que terminou `failed` conta
    expect(chamadas[0]?.filtros).toContainEqual(["eq", "mensagem.status", "failed"]);
    const nova = chamadas.find((c) => c.tabela === "crm_tasks" && c.op === "insert");
    expect(nova?.valores).toMatchObject({ organization_id: "org-3", title: "O lembrete não chegou — ligar para confirmar", contact_id: "c3" });
    const req = chamadas.find((c) => c.tabela === "clinic_confirmation_requests" && c.op === "update");
    expect(req?.valores).toEqual({ status: "sem_resposta", falha: "envio_falhou", task_id: "t-falhou" });
  });

  it("lembrete que não saiu: cria o pedido em sem_resposta com a tarefa, na organização dele", async () => {
    const { cliente, chamadas } = falso({
      organizations: { select: { data: [{ id: "org-4" }] } },
      calendar_appointments: {
        select: {
          data: [
            {
              id: "ag-sem",
              title: "Consulta",
              starts_at: "2026-10-01T13:00:00Z",
              contact_id: "c4",
              calendar_event_types: { reminder_enabled: true, reminder_minutes_before: 1440, reminder_extra_offsets_minutes: null },
            },
            {
              id: "ag-com",
              title: "Consulta",
              starts_at: "2026-10-01T13:30:00Z",
              contact_id: "c5",
              calendar_event_types: { reminder_enabled: true, reminder_minutes_before: 1440, reminder_extra_offsets_minutes: null },
            },
            {
              id: "ag-curto",
              title: "Retorno",
              starts_at: "2026-10-01T13:45:00Z",
              contact_id: "c6",
              calendar_event_types: { reminder_enabled: true, reminder_minutes_before: 60, reminder_extra_offsets_minutes: null },
            },
          ],
        },
      },
      // `ag-com` já tem pedido: o lembrete saiu e ele segue o caminho normal
      clinic_confirmation_requests: { select: { data: [{ appointment_id: "ag-com" }] } },
      crm_tasks: { insert: { data: { id: "t-nao-saiu" } } },
    });
    expect(await marcarLembretesQueNaoSairam(cliente, new Date("2026-10-01T10:00:00Z"))).toEqual({ marcados: 1, falhas: 0 });
    const orgs = chamadas.find((c) => c.tabela === "organizations");
    expect(orgs?.filtros).toContainEqual(["eq", "settings->clinic->>confirmacao_automatica", "true"]);
    const ags = chamadas.find((c) => c.tabela === "calendar_appointments");
    expect(ags?.filtros).toEqual(
      expect.arrayContaining([
        ["eq", "organization_id", "org-4"],
        ["eq", "status", "confirmed"],
        // compromisso recém-marcado ainda pode receber o lembrete: 30 min de folga
        ["lt", "created_at", "2026-10-01T09:30:00.000Z"],
      ]),
    );
    const inserido = chamadas.find((c) => c.tabela === "clinic_confirmation_requests" && c.op === "insert");
    expect(inserido?.valores).toEqual({
      organization_id: "org-4",
      appointment_id: "ag-sem",
      contact_id: "c4",
      status: "sem_resposta",
      falha: "nao_enviado",
      task_id: "t-nao-saiu",
    });
    const tarefas = chamadas.filter((c) => c.tabela === "crm_tasks" && c.op === "insert");
    expect(tarefas).toHaveLength(1);
    expect(tarefas[0]?.valores).toMatchObject({ title: "O lembrete não saiu — ligar para confirmar", contact_id: "c4" });
  });
});
