/**
 * #85 — a busca da recepção/agenda acha o paciente pelo telefone EXTRA.
 */
import { describe, expect, it, vi } from "vitest";

import { filtrarContatosPelaBusca, idsPorTelefoneExtra } from "./busca-no-banco";

function consultaFalsa() {
  const chamadas: Array<[string, ...unknown[]]> = [];
  const q = {
    eq: (...a: unknown[]) => (chamadas.push(["eq", ...a]), q),
    or: (...a: unknown[]) => (chamadas.push(["or", ...a]), q),
    ilike: (...a: unknown[]) => (chamadas.push(["ilike", ...a]), q),
  };
  return { q, chamadas };
}

describe("filtrarContatosPelaBusca com telefone extra", () => {
  it("sem extra: busca de telefone segue só no principal (como antes)", () => {
    const { q, chamadas } = consultaFalsa();
    filtrarContatosPelaBusca(q, "(11) 98888-7777");
    expect(chamadas).toEqual([["ilike", "phone_number", "%11988887777%"]]);
  });

  it("⭐ com extra: o principal OU a ficha dona do extra", () => {
    const { q, chamadas } = consultaFalsa();
    filtrarContatosPelaBusca(q, "(11) 98888-7777", ["c-1", "c-2"]);
    expect(chamadas).toEqual([["or", "phone_number.ilike.%11988887777%,id.in.(c-1,c-2)"]]);
  });

  it("busca por nome ignora os extras", () => {
    const { q, chamadas } = consultaFalsa();
    filtrarContatosPelaBusca(q, "Joana", ["c-1"]);
    expect(chamadas[0]?.[1]).not.toContain("id.in");
  });
});

describe("idsPorTelefoneExtra", () => {
  function db(linhas: Array<{ contact_id: string }>) {
    const filtros: unknown[][] = [];
    const cadeia = {
      select: () => cadeia,
      eq: (...a: unknown[]) => (filtros.push(["eq", ...a]), cadeia),
      ilike: (...a: unknown[]) => (filtros.push(["ilike", ...a]), cadeia),
      limit: async () => ({ data: linhas, error: null }),
    };
    const from = vi.fn(() => cadeia);
    return { cliente: { from } as never, from, filtros };
  }

  it("⭐ lê contact_phones da organização pelos dígitos, sem repetir a ficha", async () => {
    const { cliente, from, filtros } = db([{ contact_id: "c-1" }, { contact_id: "c-1" }]);
    expect(await idsPorTelefoneExtra(cliente, "org-1", "11 98888-7777")).toEqual(["c-1"]);
    expect(from).toHaveBeenCalledWith("contact_phones");
    expect(filtros).toContainEqual(["eq", "organization_id", "org-1"]);
    expect(filtros).toContainEqual(["ilike", "phone_number", "%11988887777%"]);
  });

  it("busca por nome não consulta o banco", async () => {
    const { cliente, from } = db([]);
    expect(await idsPorTelefoneExtra(cliente, "org-1", "Joana")).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });
});
