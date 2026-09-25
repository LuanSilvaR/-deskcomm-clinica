import { describe, expect, it } from "vitest";

import { progressoDoPlano } from "./leitura";

describe("progressoDoPlano", () => {
  it("canceladas não contam; cada estado no seu balde", () => {
    expect(
      progressoDoPlano([
        { status: "realizada" },
        { status: "agendada" },
        { status: "planejada" },
        { status: "planejada" },
        { status: "cancelada" },
      ]),
    ).toEqual({ total: 4, realizadas: 1, agendadas: 1, planejadas: 2 });
  });
});
