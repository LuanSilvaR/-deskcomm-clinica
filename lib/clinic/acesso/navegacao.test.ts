import { describe, expect, it } from "vitest";

import { NAV_CATALOG } from "@/lib/navigation/catalogo";
import { permitidos } from "@/lib/navigation/interface";

import { ehPermissao } from "./catalogo";

const hrefs = (xs: { href: string }[]) => xs.map((d) => d.href);

describe("menu por permissão (ACL-008)", () => {
  it("toda porta com `permissao` cita uma chave que existe no catálogo", () => {
    const invalidas = (NAV_CATALOG as readonly { href: string; permissao?: string }[])
      .filter((d) => d.permissao !== undefined && !ehPermissao(d.permissao))
      .map((d) => `${d.href} → ${d.permissao}`);
    expect(invalidas).toEqual([]);
  });

  it("modo desligado (sem permissões): o menu é o de sempre, pelo papel", () => {
    expect(hrefs(permitidos(false, "admin", undefined, undefined))).toEqual(hrefs(permitidos(false, "admin")));
  });

  it("modo ligado: Financeiro some para quem não tem financeiro.ver, mesmo sendo admin no papel legado", () => {
    const semFinanceiro = hrefs(permitidos(false, "admin", undefined, ["agenda.ver", "pacientes.ver", "papeis.ver"]));
    expect(semFinanceiro).not.toContain("/app/faturamento");
    expect(semFinanceiro).not.toContain("/app/comandas");
    expect(semFinanceiro).toContain("/app/agenda");
    expect(semFinanceiro).toContain("/app/settings/tenant/papeis");
  });

  it("porta sem `permissao` (perfil, hubs) continua pelo papel", () => {
    expect(hrefs(permitidos(false, "viewer", undefined, []))).toContain("/app/settings/profile");
  });

  it("plataforma não é filtrada por permissões de empresa", () => {
    expect(hrefs(permitidos(true, null, undefined, []))).toContain("/app/faturamento");
  });
});
