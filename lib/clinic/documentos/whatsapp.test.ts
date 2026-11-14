import { describe, expect, it } from "vitest";

import { linkDoWhatsApp } from "./whatsapp";

describe("linkDoWhatsApp", () => {
  it("usa só os dígitos do telefone e codifica a mensagem", () => {
    expect(linkDoWhatsApp("+55 (11) 90000-0000", "Olá & link: https://x.test/termo/abc")).toBe(
      "https://wa.me/5511900000000?text=Ol%C3%A1%20%26%20link%3A%20https%3A%2F%2Fx.test%2Ftermo%2Fabc",
    );
  });

  it("sem telefone válido, não há link", () => {
    expect(linkDoWhatsApp(null, "x")).toBeNull();
    expect(linkDoWhatsApp("123", "x")).toBeNull();
    expect(linkDoWhatsApp("1".repeat(16), "x")).toBeNull();
  });
});
