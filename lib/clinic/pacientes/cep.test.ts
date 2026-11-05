/**
 * #86 — o endereço a partir do CEP: as duas fontes, a ordem entre elas e o que
 * vira "não encontrado" ou "indisponível". O serviço externo é simulado.
 */
import { describe, expect, it, vi } from "vitest";

import { consultarCep, normalizarCep } from "./cep";

function resposta(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
}

const VIACEP_OK = {
  cep: "01310-100",
  logradouro: "Avenida Paulista",
  bairro: "Bela Vista",
  localidade: "São Paulo",
  uf: "SP",
  ibge: "3550308",
};

describe("normalizarCep", () => {
  it("aceita com ou sem traço e recusa o que não tem 8 números", () => {
    expect(normalizarCep("01310-100")).toBe("01310100");
    expect(normalizarCep("01310100")).toBe("01310100");
    expect(normalizarCep("0131010")).toBeNull();
    expect(normalizarCep("")).toBeNull();
    expect(normalizarCep(null)).toBeNull();
  });
});

describe("consultarCep", () => {
  it("devolve o endereço do ViaCEP, com o código IBGE", async () => {
    const buscar = vi.fn(async () => resposta(200, VIACEP_OK));
    const r = await consultarCep("01310100", buscar as unknown as typeof fetch);
    expect(r).toEqual({
      tipo: "encontrado",
      endereco: {
        cep: "01310100",
        logradouro: "Avenida Paulista",
        bairro: "Bela Vista",
        cidade: "São Paulo",
        uf: "SP",
        codigo_ibge: "3550308",
      },
    });
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(String((buscar.mock.calls[0] as unknown[])[0])).toBe("https://viacep.com.br/ws/01310100/json/");
  });

  it("CEP inexistente no ViaCEP é resposta: não pergunta à segunda fonte", async () => {
    const buscar = vi.fn(async () => resposta(200, { erro: true }));
    expect(await consultarCep("99999999", buscar as unknown as typeof fetch)).toEqual({ tipo: "nao_encontrado" });
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("ViaCEP fora do ar cai para a BrasilAPI", async () => {
    const buscar = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(
        resposta(200, { street: "Avenida Paulista", neighborhood: "Bela Vista", city: "São Paulo", state: "SP" }),
      );
    const r = await consultarCep("01310100", buscar as unknown as typeof fetch);
    expect(r).toMatchObject({ tipo: "encontrado", endereco: { logradouro: "Avenida Paulista", uf: "SP", codigo_ibge: "" } });
    expect(String(buscar.mock.calls[1]![0])).toBe("https://brasilapi.com.br/api/cep/v1/01310100");
  });

  it("404 da BrasilAPI é não encontrado; as duas fora do ar é indisponível — nunca lança", async () => {
    const naoAchou = vi.fn().mockResolvedValueOnce(resposta(500, {})).mockResolvedValueOnce(resposta(404, {}));
    expect(await consultarCep("01310100", naoAchou as unknown as typeof fetch)).toEqual({ tipo: "nao_encontrado" });

    const foraDoAr = vi.fn().mockRejectedValue(new Error("rede"));
    expect(await consultarCep("01310100", foraDoAr as unknown as typeof fetch)).toEqual({ tipo: "indisponivel" });
  });
});
