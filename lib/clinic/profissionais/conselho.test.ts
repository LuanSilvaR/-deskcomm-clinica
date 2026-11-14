import { describe, expect, it } from "vitest";

import { comConselho, registroNoConselho } from "./conselho";

describe("registroNoConselho", () => {
  it("monta conselho, número e UF", () => {
    expect(registroNoConselho({ council: "CRM", council_number: "12345", council_uf: "SP" })).toBe("CRM 12345/SP");
    expect(registroNoConselho({ council: "CRBM", council_number: "999", council_uf: null })).toBe("CRBM 999");
    expect(registroNoConselho({ council: "CRO", council_number: null, council_uf: "RJ" })).toBe("CRO RJ");
  });

  it("sem conselho, nada", () => {
    expect(registroNoConselho({ council: null, council_number: "1", council_uf: "SP" })).toBeNull();
    expect(registroNoConselho(null)).toBeNull();
  });
});

describe("comConselho", () => {
  it("junta nome e registro quando há os dois", () => {
    expect(comConselho("Profissional Teste", "CRM 1/SP")).toBe("Profissional Teste — CRM 1/SP");
    expect(comConselho("Profissional Teste", null)).toBe("Profissional Teste");
    expect(comConselho(null, null)).toBeNull();
  });
});
