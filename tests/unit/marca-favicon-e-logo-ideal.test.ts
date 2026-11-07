/**
 * FORK clinic (8012) — a régua do favicon (só PNG, quadrado, 32–1024 px), o
 * ponteiro em settings.clinic e a orientação do tamanho ideal do logo.
 * PNGs montados aqui mesmo (só assinatura + IHDR): nenhum arquivo real.
 */
import { describe, expect, it } from "vitest";

import { conferirFavicon, dimensoesDoPng, faviconDeSettings } from "@/lib/clinic/marca/favicon";
import { avaliarLogo, LOGO_IDEAL } from "@/lib/clinic/marca/logo-ideal";

function cabecalhoPng(largura: number, altura: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0, 0, 0, 13], 8);
  b.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  const dv = new DataView(b.buffer);
  dv.setUint32(16, largura);
  dv.setUint32(20, altura);
  return b;
}

const ORG = "11111111-2222-4333-8444-555555555555";
const ARQ = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("favicon — régua do arquivo", () => {
  it("lê largura e altura do IHDR", () => {
    expect(dimensoesDoPng(cabecalhoPng(512, 512))).toEqual({ largura: 512, altura: 512 });
  });

  it("aceita PNG quadrado entre 32 e 1024", () => {
    expect(conferirFavicon(cabecalhoPng(32, 32))).toBeNull();
    expect(conferirFavicon(cabecalhoPng(512, 512))).toBeNull();
    expect(conferirFavicon(cabecalhoPng(1024, 1024))).toBeNull();
  });

  it.each([
    ["não é PNG (JPEG)", new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(30).fill(0)]), "favicon_nao_png"],
    ["retangular", cabecalhoPng(640, 112), "favicon_nao_quadrado"],
    ["pequeno demais", cabecalhoPng(16, 16), "favicon_pequeno"],
    ["grande demais", cabecalhoPng(2048, 2048), "favicon_grande"],
  ])("recusa %s", (_nome, bytes, codigo) => {
    expect(conferirFavicon(bytes)?.codigo).toBe(codigo);
  });

  it("a recusa de não-quadrado diz o tamanho enviado e o ideal", () => {
    expect(conferirFavicon(cabecalhoPng(640, 112))?.mensagem).toMatch(/640 × 112 px.*512 × 512 px/);
  });
});

describe("favicon — ponteiro em settings.clinic", () => {
  it("lê o caminho com a forma esperada", () => {
    expect(faviconDeSettings({ clinic: { favicon_path: `${ORG}/${ARQ}.png` } })).toBe(`${ORG}/${ARQ}.png`);
  });
  it.each([
    ["ausente", {}],
    ["null", null],
    ["jpg", { clinic: { favicon_path: `${ORG}/${ARQ}.jpg` } }],
    ["fora da forma", { clinic: { favicon_path: `${ORG}/../platform/${ARQ}.png` } }],
  ])("ignora %s", (_n, settings) => {
    expect(faviconDeSettings(settings)).toBeNull();
  });
});

describe("logo — tamanho ideal no menu", () => {
  it("o ideal (640 × 112) cabe inteiro no menu, sem aviso", () => {
    const r = avaliarLogo(LOGO_IDEAL.largura, LOGO_IDEAL.altura);
    expect(r.noMenu).toEqual({ largura: 160, altura: 28 });
    expect(r.avisos).toEqual([]);
  });
  it("baixo demais avisa que fica borrado", () => {
    expect(avaliarLogo(200, 40).avisos.join(" ")).toMatch(/borrada/);
  });
  it("largo demais avisa que encolhe no menu", () => {
    const r = avaliarLogo(2000, 100);
    expect(r.noMenu.largura).toBe(160);
    expect(r.avisos.join(" ")).toMatch(/muito largo/);
  });
  it("quadrado sugere a versão horizontal e o favicon", () => {
    expect(avaliarLogo(512, 512).avisos.join(" ")).toMatch(/Favicon/);
  });
});
