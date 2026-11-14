/**
 * FORK clinic (prontuário F7) — o que um arquivo clínico É, pelos bytes.
 *
 * O `Content-Type` é escolhido por quem sobe; quem decide aqui são os primeiros
 * bytes (mesma régua de lib/branding/logo-arquivo.ts). Aceitos: WebP, JPEG e
 * PNG (fotos) e PDF (documentos). SVG, HTML e o resto ficam de fora — nada que
 * o navegador execute sai do bucket clínico.
 */
import { createHash } from "node:crypto";

export type TipoDeArquivoClinico = "image/webp" | "image/jpeg" | "image/png" | "application/pdf";

export const TAMANHO_MAXIMO = 10 * 1024 * 1024;
export const TAMANHO_MAXIMO_MINIATURA = 512 * 1024;

const comeca = (b: Uint8Array, assinatura: readonly number[], deslocamento = 0) =>
  b.length >= deslocamento + assinatura.length && assinatura.every((x, i) => b[deslocamento + i] === x);

export function farejarArquivoClinico(b: Uint8Array): TipoDeArquivoClinico | null {
  if (comeca(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (comeca(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // RIFF....WEBP
  if (comeca(b, [0x52, 0x49, 0x46, 0x46]) && comeca(b, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (comeca(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return null;
}

export function extensaoDoArquivo(tipo: TipoDeArquivoClinico): "webp" | "jpg" | "png" | "pdf" {
  return tipo === "image/webp" ? "webp" : tipo === "image/jpeg" ? "jpg" : tipo === "image/png" ? "png" : "pdf";
}

export function sha256DeBytes(b: Uint8Array): string {
  return createHash("sha256").update(b).digest("hex");
}

/** Caminho não enumerável e amarrado à empresa e ao paciente (o banco confere o prefixo). */
export function caminhoDoArquivo(org: string, paciente: string, id: string, tipo: TipoDeArquivoClinico): string {
  return `${org}/${paciente}/${id}.${extensaoDoArquivo(tipo)}`;
}
