import { describe, expect, it } from "vitest";

import { executorDoPedido, ipDoPedido } from "./executor";
import { papelEmPortugues } from "./papel";

const ORG = "11111111-1111-4111-8111-111111111111";
const base = { id: "u1", email: "ana@exemplo.test", full_name: "Ana Teste" };

describe("papelEmPortugues", () => {
  it.each([
    ["owner", "proprietário"],
    ["admin", "administrador"],
    ["manager", "gerente"],
    ["agent", "atendente"],
    ["viewer", "somente leitura"],
  ])("%s vira %s", (papel, rotulo) => {
    expect(papelEmPortugues(papel)).toBe(rotulo);
  });
});

describe("executorDoPedido", () => {
  it("membro da clínica: usa o papel dele", () => {
    const e = executorDoPedido({
      user: { ...base, is_platform_admin: false, organizations: [{ organization_id: ORG }] },
      org: { role: "admin", orgId: ORG },
    });
    expect(e.papel).toBe("administrador");
  });

  it("admin da plataforma que não é membro: suporte da plataforma, nunca viewer", () => {
    const e = executorDoPedido({
      user: { ...base, is_platform_admin: true, organizations: [] },
      org: { role: "viewer", orgId: ORG },
    });
    expect(e.papel).toBe("suporte da plataforma");
  });

  it("admin da plataforma que também é membro: papel real", () => {
    const e = executorDoPedido({
      user: { ...base, is_platform_admin: true, organizations: [{ organization_id: ORG }] },
      org: { role: "admin", orgId: ORG },
    });
    expect(e.papel).toBe("administrador");
  });
});

describe("ipDoPedido", () => {
  it("usa o primeiro salto validado", () => {
    expect(ipDoPedido({ headers: new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }) })).toBe("203.0.113.9");
  });
  it("cabeçalho malformado vira null", () => {
    expect(ipDoPedido({ headers: new Headers({ "x-forwarded-for": "lixo" }) })).toBeNull();
  });
});
