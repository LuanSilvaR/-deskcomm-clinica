import { describe, expect, it } from "vitest";

import { caminhoDoArquivo, farejarArquivoClinico, sha256DeBytes } from "./arquivo";

const bytes = (...xs: number[]) => new Uint8Array(xs);
const texto = (s: string) => new TextEncoder().encode(s);

describe("farejarArquivoClinico", () => {
  it("reconhece pelos bytes, não pelo nome", () => {
    expect(farejarArquivoClinico(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(farejarArquivoClinico(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(farejarArquivoClinico(texto("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))).toBe("image/webp");
    expect(farejarArquivoClinico(texto("%PDF-1.7"))).toBe("application/pdf");
  });
  it("recusa o que o navegador executaria", () => {
    expect(farejarArquivoClinico(texto("<svg xmlns"))).toBeNull();
    expect(farejarArquivoClinico(texto("<html>"))).toBeNull();
    expect(farejarArquivoClinico(bytes())).toBeNull();
  });
});

describe("caminho e hash", () => {
  it("caminho amarrado à empresa e ao paciente", () => {
    expect(caminhoDoArquivo("o", "p", "i", "image/webp")).toBe("o/p/i.webp");
  });
  it("sha256 em hexadecimal", () => {
    expect(sha256DeBytes(texto("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
