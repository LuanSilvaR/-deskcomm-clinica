import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A varredura da reserva (#83): a Meta aceitou o envio e só depois avisou que
 * falhou. Aqui o Supabase é um dublê (o que se prova é a decisão) e o envio de
 * verdade é mockado: nenhum teste chama rede.
 */
const h = vi.hoisted(() => ({ enviar: vi.fn() }));
vi.mock("./enviar", () => ({ enviarLembreteComReserva: h.enviar }));

import { reenviarLembretesQueAMetaRecusou } from "./reserva-depois";

const AGORA = new Date("2026-10-01T12:00:00Z");
const FUTURO = "2026-10-01T18:00:00Z";
const PASSADO = "2026-10-01T11:00:00Z";

type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

interface Op {
  tabela: string;
  op: "select" | "update";
  valores?: Linha;
  filtros: [string, string, unknown][];
}

interface Cenario {
  orgs?: { id: string }[];
  mensagens?: Linha[];
  compromisso?: Linha | null;
  bloqueado?: boolean;
  reivindica?: boolean;
}

const msg = (extra: Linha = {}, lembrete: Linha = {}): Linha => ({
  id: "m-1",
  contact_id: "ct-1",
  channel_session_id: "meta-1",
  body: "Oi, Maria! Sua consulta é amanhã.",
  status: "failed",
  error_code: "131026",
  error_message: "meta_131026: Message undeliverable",
  metadata: { lembrete: { appointment_id: "ap-1", degraus: [1440], tentativa: 1, reserva: null, ...lembrete } },
  ...extra,
});

const compromisso = (extra: Linha = {}): Linha => ({
  id: "ap-1",
  starts_at: FUTURO,
  status: "confirmed",
  reminder_sent_offsets_minutes: [1440],
  reminder_tentativas: { "1440": 1 },
  ...extra,
});

function montar(c: Cenario) {
  const ops: Op[] = [];
  const dados: Record<string, unknown> = {
    organizations: c.orgs ?? [{ id: "org-1" }],
    channel_sessions: [{ id: "meta-1" }, { id: "meta-2" }],
    messages: c.mensagens ?? [msg()],
    calendar_appointments: c.compromisso === undefined ? compromisso() : c.compromisso,
    contacts: { id: "ct-1", is_blocked: c.bloqueado ?? false },
  };
  const admin = {
    from(tabela: string) {
      const o: Op = { tabela, op: "select", filtros: [] };
      ops.push(o);
      const q: Record<string, unknown> = {};
      const reg = (t: string) => (col: string, v: unknown) => (o.filtros.push([t, col, v]), q);
      for (const m of ["eq", "in", "gt", "lte", "is", "not", "order"]) q[m] = reg(m);
      q.select = () => q;
      q.limit = () => q;
      q.update = (v: Linha) => ((o.op = "update"), (o.valores = v), q);
      const resultado = () => {
        if (o.op === "update") {
          const reivindicacao = o.tabela === "messages" && o.filtros.some(([t]) => t === "is");
          return { data: reivindicacao ? (c.reivindica === false ? [] : [{ id: "m-1" }]) : null, error: null };
        }
        return { data: dados[tabela] ?? null, error: null };
      };
      q.maybeSingle = async () => resultado();
      q.then = (res: (v: unknown) => unknown) => res(resultado());
      return q;
    },
  };
  return { admin: admin as unknown as SupabaseClient, ops };
}

const marcasNaMensagem = (ops: Op[]) =>
  ops.filter((o) => o.tabela === "messages" && o.op === "update").map((o) => o.valores?.metadata?.lembrete?.reserva);

describe("reenviarLembretesQueAMetaRecusou", () => {
  beforeEach(() => h.enviar.mockReset());

  it("Meta 131026 depois: reenvia pelo waha e marca feita", async () => {
    h.enviar.mockResolvedValue({ desfecho: "enviado", canalId: "waha-1", provider: "waha", mensagemId: "m-novo", via: "texto" });
    const { admin, ops } = montar({});
    const r = await reenviarLembretesQueAMetaRecusou(admin, AGORA);
    expect(r).toEqual({ reenviados: 1, semReserva: 0, ignorados: 0 });
    const entrada = h.enviar.mock.calls[0]![1];
    expect(entrada).toMatchObject({
      org: "org-1",
      appointmentId: "ap-1",
      contatoId: "ct-1",
      degraus: [1440],
      textoLivre: "Oi, Maria! Sua consulta é amanhã.",
      pecasDoModelo: {},
      modeloDoTipoId: null,
      excluirCanalIds: ["meta-1", "meta-2"],
      tentativa: 2,
    });
    expect(marcasNaMensagem(ops)).toEqual(["em_andamento", "feita"]);
    // enviado limpa a falha do compromisso
    const ap = ops.find((o) => o.tabela === "calendar_appointments" && o.op === "update");
    expect(ap?.valores).toMatchObject({ reminder_falha: null, reminder_falha_at: null });
    expect(ap?.filtros).toContainEqual(["eq", "organization_id", "org-1"]);
  });

  it("a marca na mensagem original filtra organization_id e id e preserva o resto do metadata", async () => {
    h.enviar.mockResolvedValue({ desfecho: "enviado", canalId: "w", provider: "waha", mensagemId: "m-novo", via: "texto" });
    const { admin, ops } = montar({
      mensagens: [msg({ metadata: { lembrete: { appointment_id: "ap-1", degraus: [1440], tentativa: 1, reserva: null }, outro: 1 } })],
    });
    await reenviarLembretesQueAMetaRecusou(admin, AGORA);
    const finais = ops.filter((o) => o.tabela === "messages" && o.op === "update");
    expect(finais).toHaveLength(2);
    for (const f of finais) {
      expect(f.filtros).toContainEqual(["eq", "organization_id", "org-1"]);
      expect(f.filtros).toContainEqual(["eq", "id", "m-1"]);
      expect(f.valores?.metadata?.outro).toBe(1);
    }
  });

  it("consulta já começou: não reenvia, marca consulta_passou", async () => {
    const { admin, ops } = montar({ compromisso: compromisso({ starts_at: PASSADO }) });
    const r = await reenviarLembretesQueAMetaRecusou(admin, AGORA);
    expect(h.enviar).not.toHaveBeenCalled();
    expect(r).toEqual({ reenviados: 0, semReserva: 0, ignorados: 1 });
    expect(marcasNaMensagem(ops).at(-1)).toBe("consulta_passou");
  });

  it("compromisso cancelado: marca consulta_passou", async () => {
    const { admin, ops } = montar({ compromisso: compromisso({ status: "cancelled" }) });
    await reenviarLembretesQueAMetaRecusou(admin, AGORA);
    expect(h.enviar).not.toHaveBeenCalled();
    expect(marcasNaMensagem(ops).at(-1)).toBe("consulta_passou");
  });

  it("código desconhecido: não reenvia, marca ambiguo", async () => {
    const { admin, ops } = montar({ mensagens: [msg({ error_code: "999999", error_message: "algo estranho" })] });
    const r = await reenviarLembretesQueAMetaRecusou(admin, AGORA);
    expect(h.enviar).not.toHaveBeenCalled();
    expect(r.ignorados).toBe(1);
    expect(marcasNaMensagem(ops).at(-1)).toBe("ambiguo");
  });

  it("sem waha: marca sem_reserva", async () => {
    h.enviar.mockResolvedValue({ desfecho: "nao_saiu", motivo: "sem_caminho" });
    const { admin, ops } = montar({});
    const r = await reenviarLembretesQueAMetaRecusou(admin, AGORA);
    expect(r).toEqual({ reenviados: 0, semReserva: 1, ignorados: 0 });
    expect(marcasNaMensagem(ops).at(-1)).toBe("sem_reserva");
  });

  it("tentativa 3: marca esgotado e não reenvia", async () => {
    const { admin, ops } = montar({ mensagens: [msg({}, { tentativa: 3 })] });
    const r = await reenviarLembretesQueAMetaRecusou(admin, AGORA);
    expect(h.enviar).not.toHaveBeenCalled();
    expect(r.ignorados).toBe(1);
    expect(marcasNaMensagem(ops).at(-1)).toBe("esgotado");
  });

  it("org com a chave desligada: não lê nada", async () => {
    const { admin, ops } = montar({ orgs: [] });
    const r = await reenviarLembretesQueAMetaRecusou(admin, AGORA);
    expect(r).toEqual({ reenviados: 0, semReserva: 0, ignorados: 0 });
    expect(ops.map((o) => o.tabela)).toEqual(["organizations"]);
    expect(ops[0]!.filtros).toContainEqual(["eq", "settings->clinic->>lembrete_com_reserva", "true"]);
  });

  it("lê só falhas recentes, meta_cloud, do lembrete e ainda sem reserva, na organização", async () => {
    h.enviar.mockResolvedValue({ desfecho: "nao_saiu", motivo: "sem_caminho" });
    const { admin, ops } = montar({});
    await reenviarLembretesQueAMetaRecusou(admin, AGORA);
    const leitura = ops.find((o) => o.tabela === "messages" && o.op === "select")!;
    expect(leitura.filtros).toContainEqual(["eq", "organization_id", "org-1"]);
    expect(leitura.filtros).toContainEqual(["eq", "status", "failed"]);
    expect(leitura.filtros).toContainEqual(["in", "channel_session_id", ["meta-1", "meta-2"]]);
    expect(leitura.filtros).toContainEqual(["not", "metadata->lembrete", "is"]);
    expect(leitura.filtros).toContainEqual(["is", "metadata->lembrete->>reserva", null]);
    expect(leitura.filtros).toContainEqual(["gt", "created_at", "2026-09-29T12:00:00.000Z"]);
  });

  it("reenvio atualiza reminder_message_id do pedido aberto", async () => {
    h.enviar.mockResolvedValue({ desfecho: "enviado", canalId: "w", provider: "waha", mensagemId: "m-novo", via: "texto" });
    const { admin, ops } = montar({});
    await reenviarLembretesQueAMetaRecusou(admin, AGORA);
    const up = ops.find((o) => o.tabela === "clinic_confirmation_requests" && o.op === "update");
    expect(up?.valores).toEqual({ reminder_message_id: "m-novo" });
    expect(up?.filtros).toContainEqual(["eq", "organization_id", "org-1"]);
    expect(up?.filtros).toContainEqual(["eq", "appointment_id", "ap-1"]);
    expect(up?.filtros).toContainEqual(["eq", "reminder_message_id", "m-1"]);
    expect(up?.filtros).toContainEqual(["eq", "status", "aguardando"]);
  });

  it("nunca duas vezes: se a reivindicação não afeta nenhuma linha, nada é enviado", async () => {
    const { admin, ops } = montar({ reivindica: false });
    const r = await reenviarLembretesQueAMetaRecusou(admin, AGORA);
    expect(h.enviar).not.toHaveBeenCalled();
    expect(r).toEqual({ reenviados: 0, semReserva: 0, ignorados: 1 });
    expect(ops.some((o) => o.tabela === "calendar_appointments")).toBe(false);
  });

  it("contato bloqueado: não tenta reserva", async () => {
    const { admin, ops } = montar({ bloqueado: true });
    await reenviarLembretesQueAMetaRecusou(admin, AGORA);
    expect(h.enviar).not.toHaveBeenCalled();
    expect(marcasNaMensagem(ops).at(-1)).toBe("bloqueado");
  });

  it("envio ambíguo na reserva: marca feita e grava envio_nao_confirmado", async () => {
    h.enviar.mockResolvedValue({ desfecho: "ambiguo", canalId: "w", mensagemId: null });
    const { admin, ops } = montar({});
    const r = await reenviarLembretesQueAMetaRecusou(admin, AGORA);
    expect(r.reenviados).toBe(0);
    expect(marcasNaMensagem(ops).at(-1)).toBe("feita");
    const ap = ops.find((o) => o.tabela === "calendar_appointments" && o.op === "update");
    expect(ap?.valores).toMatchObject({ reminder_falha: "envio_nao_confirmado" });
  });
});
