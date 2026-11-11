import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  canais: [] as unknown[],
  conversa: null as { last_inbound_at: string | null } | null,
  send: vi.fn(),
  ensure: vi.fn(),
  adiar: vi.fn(),
  espacar: vi.fn(),
  ler: vi.fn(),
  valores: vi.fn(),
  conversasLidas: 0,
}));

vi.mock("@/app/api/v1/messages/_handler", () => ({ sendMessageHandler: h.send }));
vi.mock("@/lib/automation/start-conversation", () => ({ ensureConversation: h.ensure }));
vi.mock("@/lib/automation/janela-do-canal", () => ({ adiarAteAJanelaAbrir: h.adiar }));
vi.mock("@/lib/automation/throttle", () => ({ espacarEnvio: h.espacar }));
vi.mock("@/lib/agenda/lembrete-por-modelo", () => ({
  lerModeloDoLembrete: h.ler,
  valoresDoModeloDoLembrete: h.valores,
}));

import { enviarLembreteComReserva, type EntradaDoLembrete } from "./enviar";

function admin() {
  return {
    from(tabela: string) {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit"]) q[m] = () => q;
      q.maybeSingle = async () => {
        if (tabela === "conversations") h.conversasLidas += 1;
        return { data: tabela === "conversations" ? h.conversa : null };
      };
      q.then = (ok: (v: unknown) => unknown) =>
        Promise.resolve({ data: tabela === "channel_sessions" ? h.canais : [] }).then(ok);
      return q;
    },
  } as never;
}

const canal = (id: string, provider: string, created_at = "2026-01-01") => ({
  id,
  provider,
  status: "WORKING",
  archived_at: null,
  metadata: null,
  created_at,
});

const entrada = (extra: Partial<EntradaDoLembrete> = {}): EntradaDoLembrete => ({
  org: "org1",
  appointmentId: "ap1",
  contatoId: "ct1",
  degraus: [1440],
  textoLivre: "Oi Ana, amanhã 10h",
  pecasDoModelo: { primeiro_nome: "Ana", quando: "amanhã 10h", titulo: "Limpeza", endereco: "Rua A" },
  modeloDoTipoId: null,
  tentativa: 1,
  ...extra,
});

const ok = { id: "m1", status: "sent", error_code: null, error_message: null };
const horasAtras = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  h.canais = [];
  h.conversa = null;
  h.conversasLidas = 0;
  h.adiar.mockResolvedValue(null);
  h.ensure.mockResolvedValue("conv1");
  h.send.mockResolvedValue(ok);
  h.ler.mockResolvedValue(null);
  h.valores.mockReturnValue(null);
});

describe("enviarLembreteComReserva", () => {
  it("só QR: manda texto pelo waha", async () => {
    h.canais = [canal("w1", "waha")];
    const r = await enviarLembreteComReserva(admin(), entrada());
    expect(r).toEqual({ desfecho: "enviado", canalId: "w1", provider: "waha", mensagemId: "m1", via: "texto" });
    expect(h.send.mock.calls[0]![2]).toMatchObject({ type: "text", body: "Oi Ana, amanhã 10h" });
    expect(h.conversasLidas).toBe(0);
  });

  it("Meta janela aberta: texto pela Meta, não toca no waha", async () => {
    h.canais = [canal("w1", "waha"), canal("mc", "meta_cloud")];
    h.conversa = { last_inbound_at: horasAtras(2) };
    const r = await enviarLembreteComReserva(admin(), entrada());
    expect(r).toMatchObject({ desfecho: "enviado", canalId: "mc", provider: "meta_cloud", via: "texto" });
    expect(h.send).toHaveBeenCalledTimes(1);
  });

  it("Meta janela fechada com modelo do número: manda modelo com {{1}}..{{4}} e body renderizado", async () => {
    h.canais = [canal("mc", "meta_cloud")];
    h.conversa = { last_inbound_at: horasAtras(48) };
    h.ler.mockResolvedValue({ id: "tpl", name: "lembrete", language: "pt_BR" });
    const valores = { "body.1": "Ana", "body.2": "amanhã", "body.3": "Limpeza", "body.4": "Rua A" };
    h.valores.mockReturnValue({ valores, texto: "Oi Ana, amanhã, Limpeza, Rua A" });
    const r = await enviarLembreteComReserva(admin(), entrada({ modeloDoTipoId: "tpl" }));
    expect(r).toMatchObject({ desfecho: "enviado", via: "modelo" });
    expect(h.ler).toHaveBeenCalledWith(expect.anything(), "org1", "tpl", "mc");
    expect(h.send.mock.calls[0]![2]).toMatchObject({
      type: "template",
      template_name: "lembrete",
      template_language: "pt_BR",
      template_values: valores,
      body: "Oi Ana, amanhã, Limpeza, Rua A",
    });
  });

  it("Meta janela fechada sem modelo: cai para o waha", async () => {
    h.canais = [canal("mc", "meta_cloud"), canal("w1", "waha")];
    const r = await enviarLembreteComReserva(admin(), entrada());
    expect(r).toMatchObject({ desfecho: "enviado", canalId: "w1", provider: "waha" });
    expect(h.send).toHaveBeenCalledTimes(1);
  });

  it("modelo de outro número da Meta: cai para o waha", async () => {
    h.canais = [canal("mc", "meta_cloud"), canal("w1", "waha")];
    h.ler.mockResolvedValue(null); // lerModeloDoLembrete só devolve modelo do MESMO canal
    const r = await enviarLembreteComReserva(admin(), entrada({ modeloDoTipoId: "tpl-de-outro" }));
    expect(h.ler).toHaveBeenCalledWith(expect.anything(), "org1", "tpl-de-outro", "mc");
    expect(r).toMatchObject({ desfecho: "enviado", canalId: "w1" });
  });

  it("peça do modelo vazia: pula a Meta e cai para o waha", async () => {
    h.canais = [canal("mc", "meta_cloud"), canal("w1", "waha")];
    h.ler.mockResolvedValue({ id: "tpl", name: "n", language: "pt_BR" });
    h.valores.mockReturnValue(null);
    const r = await enviarLembreteComReserva(admin(), entrada({ modeloDoTipoId: "tpl" }));
    expect(r).toMatchObject({ desfecho: "enviado", canalId: "w1" });
  });

  it("Meta failed 131026 síncrono: cai para o waha", async () => {
    h.canais = [canal("mc", "meta_cloud"), canal("w1", "waha")];
    h.conversa = { last_inbound_at: horasAtras(1) };
    h.send
      .mockResolvedValueOnce({ id: "x", status: "failed", error_code: "131026", error_message: null })
      .mockResolvedValueOnce({ id: "m2", status: "sent", error_code: null });
    const r = await enviarLembreteComReserva(admin(), entrada());
    expect(r).toMatchObject({ desfecho: "enviado", canalId: "w1", mensagemId: "m2" });
    expect(h.send).toHaveBeenCalledTimes(2);
  });

  it("recusa síncrona da Meta (meta_100:) cai para o waha", async () => {
    h.canais = [canal("mc", "meta_cloud"), canal("w1", "waha")];
    h.conversa = { last_inbound_at: horasAtras(1) };
    h.send
      .mockResolvedValueOnce({ id: "x", status: "failed", error_code: "meta_error", error_message: "meta_100: bad" })
      .mockResolvedValueOnce(ok);
    const r = await enviarLembreteComReserva(admin(), entrada());
    expect(r).toMatchObject({ desfecho: "enviado", canalId: "w1" });
  });

  it("Meta queued: para e devolve ambiguo, waha não é chamado", async () => {
    h.canais = [canal("mc", "meta_cloud"), canal("w1", "waha")];
    h.conversa = { last_inbound_at: horasAtras(1) };
    h.send.mockResolvedValue({ id: "q1", status: "queued", error_code: null });
    const r = await enviarLembreteComReserva(admin(), entrada());
    expect(r).toEqual({ desfecho: "ambiguo", canalId: "mc", mensagemId: "q1" });
    expect(h.send).toHaveBeenCalledTimes(1);
  });

  it("exceção do envio: ambiguo, não tenta o próximo caminho", async () => {
    h.canais = [canal("mc", "meta_cloud"), canal("w1", "waha")];
    h.conversa = { last_inbound_at: horasAtras(1) };
    h.send.mockRejectedValue(new Error("fetch failed"));
    const r = await enviarLembreteComReserva(admin(), entrada());
    expect(r).toEqual({ desfecho: "ambiguo", canalId: "mc", mensagemId: null });
    expect(h.send).toHaveBeenCalledTimes(1);
  });

  it("excluirCanalIds pula a Meta", async () => {
    h.canais = [canal("mc", "meta_cloud"), canal("w1", "waha")];
    h.conversa = { last_inbound_at: horasAtras(1) };
    const r = await enviarLembreteComReserva(admin(), entrada({ excluirCanalIds: ["mc"] }));
    expect(r).toMatchObject({ desfecho: "enviado", canalId: "w1" });
  });

  it("todos fora do horário: nao_saiu/fora_do_horario", async () => {
    h.canais = [canal("mc", "meta_cloud"), canal("w1", "waha")];
    h.adiar.mockResolvedValue("2026-01-02T08:00:00Z");
    const r = await enviarLembreteComReserva(admin(), entrada());
    expect(r).toEqual({ desfecho: "nao_saiu", motivo: "fora_do_horario" });
    expect(h.send).not.toHaveBeenCalled();
  });

  it("só Meta sem modelo: nao_saiu/meta_sem_modelo", async () => {
    h.canais = [canal("mc", "meta_cloud")];
    const r = await enviarLembreteComReserva(admin(), entrada());
    expect(r).toEqual({ desfecho: "nao_saiu", motivo: "meta_sem_modelo" });
  });

  it("todos recusam: nao_saiu/erro_apos_tentativas", async () => {
    h.canais = [canal("w1", "waha")];
    h.send.mockResolvedValue({ id: "x", status: "failed", error_code: "missing_phone_number", error_message: null });
    const r = await enviarLembreteComReserva(admin(), entrada());
    expect(r).toEqual({ desfecho: "nao_saiu", motivo: "erro_apos_tentativas" });
  });

  it("nenhum canal: nao_saiu/sem_caminho", async () => {
    const r = await enviarLembreteComReserva(admin(), entrada());
    expect(r).toEqual({ desfecho: "nao_saiu", motivo: "sem_caminho" });
  });

  it("metadata.lembrete leva appointment_id, degraus e tentativa", async () => {
    h.canais = [canal("w1", "waha")];
    await enviarLembreteComReserva(admin(), entrada({ degraus: [1440, 60], tentativa: 2 }));
    const [, ctx, input] = h.send.mock.calls[0]!;
    expect(input.metadata).toEqual({
      lembrete: { appointment_id: "ap1", degraus: [1440, 60], tentativa: 2, reserva: null },
    });
    expect(ctx).toMatchObject({
      organization_id: "org1",
      actor: { type: "webhook_source", id: "ap1" },
      requestId: "agenda-reminder:ap1:w1",
    });
  });
});
