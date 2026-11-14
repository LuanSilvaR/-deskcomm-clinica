/**
 * FORK clinic (8011) — a régua do telefone e do endereço da empresa no
 * `tenantSchema` é a mesma dos CHECKs da migration: o que a tela aceita, o
 * banco aceita. Dados fictícios.
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

describe("tenantSchema — contato e endereço", () => {
  it("normaliza telefone, CEP e UF", () => {
    const r = tenantSchema.parse({
      ...BASE,
      contact_phone: " (11) 3333-4444 ",
      address_cep: "01310-100",
      address_uf: "sp",
      address_city_ibge_code: "3550308",
    });
    expect(r.contact_phone).toBe("1133334444");
    expect(r.address_cep).toBe("01310100");
    expect(r.address_uf).toBe("SP");
    expect(r.address_city_ibge_code).toBe("3550308");
  });

  it("vazio vira null e ausente continua ausente", () => {
    const r = tenantSchema.parse({ ...BASE, contact_phone: "", address_street: "   " });
    expect(r.contact_phone).toBeNull();
    expect(r.address_street).toBeNull();
    expect(r.address_cep).toBeUndefined();
  });

  it("aceita celular com DDI", () => {
    expect(tenantSchema.parse({ ...BASE, contact_phone: "+55 11 99999-8888" }).contact_phone).toBe("5511999998888");
  });

  it.each([
    ["contact_phone", "3333-4444"],
    ["address_cep", "0131010"],
    ["address_uf", "S"],
    ["address_city_ibge_code", "355030"],
  ])("recusa %s = %s", (campo, valor) => {
    expect(tenantSchema.safeParse({ ...BASE, [campo]: valor }).success).toBe(false);
  });
});
