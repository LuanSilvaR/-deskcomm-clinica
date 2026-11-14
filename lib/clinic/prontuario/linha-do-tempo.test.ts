import { describe, expect, it } from "vitest";

import { proximoDia } from "./linha-do-tempo";

describe("proximoDia", () => {
  it("vira o mês e o ano", () => {
    expect(proximoDia("2026-01-31")).toBe("2026-02-01T00:00:00.000Z");
    expect(proximoDia("2026-12-31")).toBe("2027-01-01T00:00:00.000Z");
  });
});
