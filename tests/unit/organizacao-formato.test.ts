/** FORK clinic (8011) — exibição de telefone e CEP guardados só com dígitos. */
import { describe, expect, it } from "vitest";

import { formatarCep, formatarTelefone } from "@/lib/clinic/organizacao/formato";

describe("formato de telefone e CEP da organização", () => {
  it("CEP", () => {
    expect(formatarCep("01310100")).toBe("01310-100");
    expect(formatarCep(null)).toBeNull();
    expect(formatarCep("abc")).toBe("abc");
  });
  it("telefone fixo, celular e com DDI", () => {
    expect(formatarTelefone("1133334444")).toBe("(11) 3333-4444");
    expect(formatarTelefone("11999998888")).toBe("(11) 99999-8888");
    expect(formatarTelefone("5511999998888")).toBe("+55 (11) 99999-8888");
    expect(formatarTelefone(null)).toBeNull();
  });
});
