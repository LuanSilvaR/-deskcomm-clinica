/**
 * FORK clinic — o logo e o favicon prontos para o papel timbrado.
 *
 * Só o que a spec permite: recortar as margens TRANSPARENTES (`sharp.trim`),
 * medir, e decidir. Nunca redimensiona para "melhorar", nunca recolore, nunca
 * sombreia — o arquivo é o que a clínica cadastrou em Configurações › Marca.
 *
 * Logo com fundo OPACO (JPG, PNG sem canal alfa, ou PNG com os quatro cantos
 * opacos) não vai para o cabeçalho: lá ele desenharia um retângulo sobre o
 * papel. O documento usa o wordmark em texto, e `aviso` diz por quê.
 *
 * `sharp` é carregado SOB DEMANDA: o binário nativo pode faltar numa imagem
 * Docker, e o documento não pode cair por isso. Sem ele, o logo vai sem recorte
 * e a transparência é decidida pelo cabeçalho do PNG (tipo de cor com alfa).
 */
export interface ImagemDoDocumento {
  data: Buffer;
  format: "png" | "jpg";
  largura: number;
  altura: number;
}

export interface LogoTratado {
  imagem: ImagemDoDocumento | null;
  /** Largura em pixels do arquivo ORIGINAL (a régua da marca d'água usa esta). */
  larguraOriginal: number;
  transparente: boolean;
  aviso: string | null;
}

const AVISO_OPACO =
  "O logo tem fundo opaco: nos documentos aparece o nome da marca em texto. Suba uma versão PNG com fundo transparente em Configurações › Marca.";

const LARGURA_MAXIMA_NO_PDF = 1200;

const SEM_LOGO: LogoTratado = { imagem: null, larguraOriginal: 0, transparente: false, aviso: null };

/** IHDR: largura, altura e se o tipo de cor tem alfa (4 = cinza+alfa, 6 = RGBA). */
function cabecalhoPng(b: Buffer): { largura: number; altura: number; alfa: boolean } | null {
  if (b.length < 26 || b.readUInt32BE(0) !== 0x89504e47 || b.toString("ascii", 12, 16) !== "IHDR") return null;
  const tipo = b[25] ?? 0;
  return { largura: b.readUInt32BE(16), altura: b.readUInt32BE(20), alfa: tipo === 4 || tipo === 6 };
}

type Sharp = (typeof import("sharp"))["default"];
async function carregarSharp(): Promise<Sharp | null> {
  try {
    const m = (await import("sharp")) as unknown as { default?: Sharp };
    return m.default ?? (m as unknown as Sharp);
  } catch {
    return null;
  }
}

/** Recorta as margens transparentes e mede. Nunca lança: arquivo ruim vira "sem logo". */
export async function tratarLogo(bytes: Buffer | null): Promise<LogoTratado> {
  if (!bytes || bytes.length === 0) return SEM_LOGO;
  const png = cabecalhoPng(bytes);
  const sharp = await carregarSharp();

  if (!sharp) {
    if (!png) return { ...SEM_LOGO, aviso: AVISO_OPACO };
    if (!png.alfa) return { imagem: null, larguraOriginal: png.largura, transparente: false, aviso: AVISO_OPACO };
    return {
      imagem: { data: bytes, format: "png", largura: png.largura, altura: png.altura },
      larguraOriginal: png.largura,
      transparente: true,
      aviso: null,
    };
  }

  try {
    const original = sharp(bytes, { failOn: "none" });
    const meta = await original.metadata();
    const largura = meta.width ?? 0;
    const altura = meta.height ?? 0;
    if (!largura || !altura) return SEM_LOGO;

    let opaco = !meta.hasAlpha;
    if (!opaco) {
      const { data, info } = await original.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const alfa = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3] ?? 255;
      opaco = [alfa(0, 0), alfa(largura - 1, 0), alfa(0, altura - 1), alfa(largura - 1, altura - 1)].every((a) => a >= 250);
    }
    if (opaco) return { imagem: null, larguraOriginal: largura, transparente: false, aviso: AVISO_OPACO };

    // Recorta as margens transparentes e limita a 1200 px de largura: o PDF não
    // precisa de mais (19 mm a 300 dpi são ~225 px) e um logo de 2000 px pesa
    // centenas de KB em cada documento. Proporção e cor intactas.
    const recortado = await original
      .clone()
      .trim({ threshold: 1 })
      .resize({ width: LARGURA_MAXIMA_NO_PDF, withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer({ resolveWithObject: true });
    return {
      imagem: { data: recortado.data, format: "png", largura: recortado.info.width, altura: recortado.info.height },
      larguraOriginal: largura,
      transparente: true,
      aviso: null,
    };
  } catch {
    return SEM_LOGO;
  }
}

/** O favicon do cabeçalho compacto: só PNG, medido pelo cabeçalho do arquivo. */
export function tratarFavicon(bytes: Buffer | null): ImagemDoDocumento | null {
  if (!bytes || bytes.length === 0) return null;
  const png = cabecalhoPng(bytes);
  return png ? { data: bytes, format: "png", largura: png.largura, altura: png.altura } : null;
}
