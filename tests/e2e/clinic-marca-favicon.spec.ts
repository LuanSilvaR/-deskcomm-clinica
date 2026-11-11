/**
 * FORK clinic (8012) — Configurações › Marca, PELA TELA:
 *
 *   1. a caixa do tamanho ideal do logo aparece (640 × 112);
 *   2. subir um favicon PNG quadrado: toast, prévia da aba com a imagem nova;
 *   3. o `<head>` de /app passa a apontar para o favicon da empresa;
 *   4. PNG retangular é recusado dizendo o motivo;
 *   5. remover volta ao ícone padrão (`/icon`).
 * As imagens são geradas aqui (PNG válido, cor sólida). Dados fictícios.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

import { expect, test, type Page } from "@playwright/test";

import { loginComoAdmin, type CredsE2E } from "./helpers/login-admin";

const RAIZ = path.resolve(__dirname, "../..");
const EVIDENCIA = path.join(RAIZ, "evidence", "marca-favicon");
const creds = JSON.parse(fs.readFileSync(path.join(RAIZ, ".e2e-creds.json"), "utf8")) as CredsE2E;

async function foto(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = TABELA_CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function bloco(tipo: string, dados: Buffer): Buffer {
  const tam = Buffer.alloc(4);
  tam.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tam, corpo, crc]);
}
/** PNG RGB de cor sólida, largura × altura. */
function png(largura: number, altura: number, rgb: [number, number, number]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // profundidade
  ihdr[9] = 2; // RGB
  const linha = Buffer.concat([Buffer.from([0]), Buffer.from(new Array(largura).fill(rgb).flat())]);
  const cru = Buffer.concat(new Array(altura).fill(linha));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco("IHDR", ihdr),
    bloco("IDAT", zlib.deflateSync(cru)),
    bloco("IEND", Buffer.alloc(0)),
  ]);
}

test("marca: tamanho ideal do logo e favicon da empresa na aba", async ({ page }) => {
  test.setTimeout(180_000);
  await loginComoAdmin(page, creds);
  await page.goto("/app/settings/marca");

  // ── 1. orientação do logo ──────────────────────────────────────────────
  await expect(page.locator("[data-logo-tamanho-ideal]")).toContainText("640 × 112 px", { timeout: 30_000 });

  const campo = page.locator("[data-campo-de-favicon][data-hidratado]");
  await expect(campo).toBeVisible({ timeout: 30_000 });
  const entrada = campo.locator("input[type=file]");

  try {
    // ── 2. favicon quadrado ──────────────────────────────────────────────
    await entrada.setInputFiles({ name: "favicon.png", mimeType: "image/png", buffer: png(64, 64, [122, 92, 214]) });
    await expect(page.getByText("Favicon atualizado.")).toBeVisible({ timeout: 30_000 });
    const previa = campo.locator("[data-previa-do-favicon] img").first();
    await expect(previa).toHaveAttribute("src", /brand-logos\/.+\.png$/);
    await foto(page, "1-favicon-na-aba-simulada");

    // ── 3. o <head> de /app aponta para o favicon da empresa ─────────────
    await page.goto("/app/settings/marca");
    await expect(page.locator('head link[rel="icon"]').first()).toHaveAttribute("href", /brand-logos\/.+\.png/, {
      timeout: 30_000,
    });

    // ── 4. retangular é recusado com o motivo ────────────────────────────
    const campoDeNovo = page.locator("[data-campo-de-favicon][data-hidratado]");
    await expect(campoDeNovo).toBeVisible({ timeout: 30_000 });
    await campoDeNovo
      .locator("input[type=file]")
      .setInputFiles({ name: "largo.png", mimeType: "image/png", buffer: png(128, 32, [0, 0, 0]) });
    await expect(page.getByText(/precisa ser quadrado/)).toBeVisible({ timeout: 30_000 });
    await foto(page, "2-favicon-retangular-recusado");
  } finally {
    // ── 5. remover volta ao ícone padrão ─────────────────────────────────
    const c = page.locator("[data-campo-de-favicon][data-hidratado]");
    const remover = c.getByRole("button", { name: "Remover" });
    if (await remover.isVisible().catch(() => false)) {
      await remover.click();
      await expect(page.getByText("Favicon removido.")).toBeVisible({ timeout: 30_000 });
      await expect(c.locator("[data-previa-do-favicon] img").first()).toHaveAttribute("src", "/icon");
    }
  }
});
