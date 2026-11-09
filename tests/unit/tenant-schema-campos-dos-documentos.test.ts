/**
 * FORK clinic (8013) — os campos do papel timbrado no `tenantSchema`, com a
 * mesma régua dos CHECKs da migration. Dados fictícios.
 */
import { describe, expect, it } from "vitest";

import { tenantSchema } from "@/lib/schemas/settings";

const BASE = {
  display_name: "Clinica Ficticia",
  legal_name: "Clinica Ficticia Ltda",
  timezone: "America/Sao_Paulo",
  locale: "pt-BR",
  currency: "BRL",
  media_retention_days: 365,
};

describe("tenantSchema — campos dos documentos", () => {
  it("site sem protocolo ganha https; WhatsApp só dígitos", () => {
    const r = tenantSchema.parse({ ...BASE, website: "clinica-ficticia.com.br", whatsapp_phone: "(61) 99999-8888" });
    expect(r.website).toBe("https://clinica-ficticia.com.br");
    expect(r.whatsapp_phone).toBe("61999998888");
  });

  it("vazio vira null", () => {
    const r = tenantSchema.parse({ ...BASE, website: " ", descriptor: "", technical_lead_name: "" });
    expect(r.website).toBeNull();
    expect(r.descriptor).toBeNull();
    expect(r.technical_lead_name).toBeNull();
  });

  it.each([
    ["whatsapp_phone", "9999-8888"],
    ["descriptor", "x".repeat(61)],
    ["website", "não é site"],
  ])("recusa %s = %s", (campo, valor) => {
    expect(tenantSchema.safeParse({ ...BASE, [campo]: valor }).success).toBe(false);
  });
});
