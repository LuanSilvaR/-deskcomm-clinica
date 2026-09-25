import { describe, expect, it } from "vitest";

import { dimensoesAlvo } from "./compressao";

describe("dimensoesAlvo", () => {
  it("reduz pelo maior lado mantendo a proporção; nunca amplia", () => {
    expect(dimensoesAlvo(4000, 3000, 1600)).toEqual({ largura: 1600, altura: 1200 });
    expect(dimensoesAlvo(3000, 4000, 1600)).toEqual({ largura: 1200, altura: 1600 });
    expect(dimensoesAlvo(800, 600, 1600)).toEqual({ largura: 800, altura: 600 });
    expect(dimensoesAlvo(5000, 10, 320)).toEqual({ largura: 320, altura: 1 });
  });
});
