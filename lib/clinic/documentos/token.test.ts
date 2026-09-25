import { describe, expect, it } from "vitest";

import { FORMATO_DO_TOKEN, gerarToken, hashDoToken } from "./token";

describe("token do link de aceite", () => {
  it("token forte no formato esperado; banco só vê o hash", () => {
    const { token, hash } = gerarToken();
    expect(token).toMatch(FORMATO_DO_TOKEN);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDoToken(token)).toBe(hash);
    expect(gerarToken().token).not.toBe(token);
  });
});
