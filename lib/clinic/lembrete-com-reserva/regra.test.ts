import { describe, expect, it } from "vitest";
import {
  classificarEnvio,
  decidirPasso,
  lembreteComReservaLigado,
  ordenarCaminhos,
  tentativasGastasDoLembrete,
  type CanalCandidato,
} from "./regra";
import { PROVIDER_PREFERIDO_DO_LEMBRETE as OFICIAL, PROVIDER_DE_RESERVA_DO_LEMBRETE as QR } from "@/lib/channels/lembrete";
import { PROVIDERS_FORA_DO_LEMBRETE } from "@/lib/channels/lembrete";

function canal(id: string, provider: string | null, created_at: string, extra: Partial<CanalCandidato> = {}): CanalCandidato {
  return { id, provider, status: "WORKING", archived_at: null, metadata: null, created_at, ...extra };
}

describe("ordenarCaminhos", () => {
  it("põe o canal oficial antes do QR e respeita created_at", () => {
    const r = ordenarCaminhos([
      canal("w2", QR, "2026-01-02"),
      canal("m", OFICIAL, "2026-01-03"),
      canal("w1", QR, "2026-01-01"),
    ]);
    expect(r.map((c) => c.id)).toEqual(["m", "w1", "w2"]);
  });

  it("tira arquivado, desligado, não WORKING e provider fora da lista", () => {
    const r = ordenarCaminhos([
      canal("ok", QR, "2026-01-01"),
      canal("arq", QR, "2026-01-01", { archived_at: "2026-02-01" }),
      canal("off", OFICIAL, "2026-01-01", { metadata: { disabled: true } }),
      canal("stop", QR, "2026-01-01", { status: "STOPPED" }),
      ...PROVIDERS_FORA_DO_LEMBRETE.map((p, i) => canal(`fora-${i}`, p, "2026-01-01")),
      canal("nulo", null, "2026-01-01"),
    ]);
    expect(r.map((c) => c.id)).toEqual(["ok"]);
  });
});

describe("decidirPasso", () => {
  const base = { foraDoHorario: false, janelaAberta: false, modeloDoCanalId: null };
  it("fora do horário pula", () => {
    expect(decidirPasso({ ...base, provider: QR, foraDoHorario: true })).toEqual({ tipo: "pular", motivo: "fora_do_horario" });
  });
  it("o canal que manda texto livre manda texto", () => {
    expect(decidirPasso({ ...base, provider: QR })).toEqual({ tipo: "texto" });
  });
  it("meta com janela aberta manda texto", () => {
    expect(decidirPasso({ ...base, provider: OFICIAL, janelaAberta: true })).toEqual({ tipo: "texto" });
  });
  it("meta fechada com modelo manda modelo", () => {
    expect(decidirPasso({ ...base, provider: OFICIAL, modeloDoCanalId: "m1" })).toEqual({ tipo: "modelo", modeloId: "m1" });
  });
  it("meta fechada sem modelo pula", () => {
    expect(decidirPasso({ ...base, provider: OFICIAL })).toEqual({ tipo: "pular", motivo: "meta_sem_modelo" });
  });
});

describe("classificarEnvio", () => {
  it("sent, delivered e read são enviado", () => {
    for (const status of ["sent", "delivered", "read"]) {
      expect(classificarEnvio(OFICIAL, { status, error_code: null })).toBe("enviado");
    }
  });
  it("failed com 131026 no canal oficial é nao_saiu", () => {
    expect(classificarEnvio(OFICIAL, { status: "failed", error_code: "131026" })).toBe("nao_saiu");
  });
  it("failed com 131026 no canal por QR é ambiguo", () => {
    expect(classificarEnvio(QR, { status: "failed", error_code: "131026" })).toBe("ambiguo");
  });
  it("failed com recusa síncrona conhecida é nao_saiu", () => {
    expect(classificarEnvio(QR, { status: "failed", error_code: "missing_phone_number" })).toBe("nao_saiu");
  });
  it("erro genérico do adaptador é ambiguo (pode ter saído)", () => {
    expect(classificarEnvio(OFICIAL, { status: "failed", error_code: "meta_error" })).toBe("ambiguo");
    expect(classificarEnvio(QR, { status: "failed", error_code: `${QR}_error` })).toBe("ambiguo");
  });
  it("canal oficial failed com error_message meta_131047 é nao_saiu", () => {
    expect(classificarEnvio(OFICIAL, { status: "failed", error_code: "meta_error", error_message: "meta_131047: fora da janela" })).toBe("nao_saiu");
  });
  it("canal oficial failed com error_message fetch failed é ambiguo", () => {
    expect(classificarEnvio(OFICIAL, { status: "failed", error_code: "meta_error", error_message: "fetch failed" })).toBe("ambiguo");
  });
  it("canal por QR failed com error_message meta_131026 é ambiguo", () => {
    expect(classificarEnvio(QR, { status: "failed", error_code: `${QR}_error`, error_message: "meta_131026: x" })).toBe("ambiguo");
  });
  it("meta_503 (servidor) é ambiguo", () => {
    expect(classificarEnvio(OFICIAL, { status: "failed", error_code: "meta_error", error_message: "meta_503: x" })).toBe("ambiguo");
  });
  it("meta_408 (timeout HTTP) é ambiguo", () => {
    expect(classificarEnvio(OFICIAL, { status: "failed", error_code: "meta_error", error_message: "meta_408: x" })).toBe("ambiguo");
  });
  it("meta_131016 (serviço indisponível) é ambiguo", () => {
    expect(classificarEnvio(OFICIAL, { status: "failed", error_code: "meta_error", error_message: "meta_131016: x" })).toBe("ambiguo");
  });
  it("meta_2 (serviço temporário) é ambiguo", () => {
    expect(classificarEnvio(OFICIAL, { status: "failed", error_code: "meta_error", error_message: "meta_2: x" })).toBe("ambiguo");
  });
  it("meta_100 é nao_saiu", () => {
    expect(classificarEnvio(OFICIAL, { status: "failed", error_code: "meta_error", error_message: "meta_100: x" })).toBe("nao_saiu");
  });
  it("queued e sending são ambiguo", () => {
    expect(classificarEnvio(QR, { status: "queued", error_code: null })).toBe("ambiguo");
    expect(classificarEnvio(QR, { status: "sending", error_code: null })).toBe("ambiguo");
  });
  it("failed sem código é ambiguo", () => {
    expect(classificarEnvio(OFICIAL, { status: "failed", error_code: null })).toBe("ambiguo");
  });
  it("exceção é ambiguo", () => {
    expect(classificarEnvio(OFICIAL, { excecao: true })).toBe("ambiguo");
  });
});

describe("lembreteComReservaLigado", () => {
  it("true só com a chave true", () => {
    expect(lembreteComReservaLigado({ clinic: { lembrete_com_reserva: true } })).toBe(true);
  });
  it("false nos demais casos", () => {
    expect(lembreteComReservaLigado({})).toBe(false);
    expect(lembreteComReservaLigado(null)).toBe(false);
    expect(lembreteComReservaLigado("x")).toBe(false);
    expect(lembreteComReservaLigado({ clinic: { lembrete_com_reserva: "true" } })).toBe(false);
  });
});

describe("tentativasGastasDoLembrete", () => {
  it("é o maior contador do jsonb; vazio ou inválido vale 0", () => {
    expect(tentativasGastasDoLembrete({ "1440": 1, "180": 2 })).toBe(2);
    expect(tentativasGastasDoLembrete(null)).toBe(0);
    expect(tentativasGastasDoLembrete({ "1440": "x" })).toBe(0);
  });
});
