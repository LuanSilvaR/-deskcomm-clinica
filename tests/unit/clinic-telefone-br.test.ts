import { describe, expect, it } from "vitest";

import { mascararTelefoneBR, telefoneParaE164 } from "@/lib/clinic/pacientes/telefone-br";

describe("telefone BR do cadastro rápido (#68)", () => {
  it("máscara: celular, fixo e digitação parcial", () => {
    expect(mascararTelefoneBR("61982103837")).toBe("(61) 98210-3837");
    expect(mascararTelefoneBR("6132103837")).toBe("(61) 3210-3837");
    expect(mascararTelefoneBR("619")).toBe("(61) 9");
    expect(mascararTelefoneBR("6")).toBe("(6");
    expect(mascararTelefoneBR("")).toBe("");
    expect(mascararTelefoneBR("(61) 98210-38371234")).toBe("(61) 98210-3837");
  });

  it("quem cola com +55 não é atrapalhado", () => {
    expect(mascararTelefoneBR("+55 61 98210-3837")).toBe("+55 61 98210-3837");
  });

  it("E.164: com e sem DDI; incompleto vira null", () => {
    expect(telefoneParaE164("(61) 98210-3837")).toBe("+5561982103837");
    expect(telefoneParaE164("(61) 3210-3837")).toBe("+556132103837");
    expect(telefoneParaE164("+55 61 98210-3837")).toBe("+5561982103837");
    expect(telefoneParaE164("5561982103837")).toBe("+5561982103837");
    expect(telefoneParaE164("(61) 9821")).toBeNull();
    expect(telefoneParaE164("   ")).toBeNull();
  });
});
