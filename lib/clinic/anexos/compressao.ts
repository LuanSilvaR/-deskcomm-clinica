/**
 * FORK clinic (prontuário F7) — a foto sai do NAVEGADOR já pequena.
 *
 * Redesenhar no canvas e exportar como WebP (qualidade 0,8, no máximo 1600 px no
 * maior lado) leva uma foto de celular de 3–8 MB para 150–300 KB, e a miniatura
 * de 320 px fica em ~20 KB. Redesenhar também DESCARTA os metadados EXIF (GPS,
 * aparelho) — privacidade de graça. É o que mantém o custo de armazenamento
 * perto de zero (plano, "Custo de armazenamento das imagens").
 */
export const LADO_MAXIMO = 1600;
export const LADO_MINIATURA = 320;

/** Dimensões finais mantendo a proporção; nunca amplia. */
export function dimensoesAlvo(largura: number, altura: number, maximo: number): { largura: number; altura: number } {
  const maior = Math.max(largura, altura);
  if (maior <= maximo || maior === 0) return { largura, altura };
  const f = maximo / maior;
  return { largura: Math.max(1, Math.round(largura * f)), altura: Math.max(1, Math.round(altura * f)) };
}

async function redesenhar(imagem: ImageBitmap, maximo: number, qualidade: number): Promise<Blob> {
  const { largura, altura } = dimensoesAlvo(imagem.width, imagem.height, maximo);
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");
  ctx.drawImage(imagem, 0, 0, largura, altura);
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/webp", qualidade));
  if (!blob || blob.type !== "image/webp") throw new Error("webp indisponível");
  return blob;
}

export interface FotoComprimida {
  arquivo: Blob;
  miniatura: Blob;
  largura: number;
  altura: number;
}

export async function comprimirFoto(original: File): Promise<FotoComprimida> {
  // `imageOrientation: "from-image"` respeita a rotação do celular antes de perder o EXIF.
  const imagem = await createImageBitmap(original, { imageOrientation: "from-image" });
  try {
    const arquivo = await redesenhar(imagem, LADO_MAXIMO, 0.8);
    const miniatura = await redesenhar(imagem, LADO_MINIATURA, 0.7);
    return { arquivo, miniatura, ...dimensoesAlvo(imagem.width, imagem.height, LADO_MAXIMO) };
  } finally {
    imagem.close();
  }
}
