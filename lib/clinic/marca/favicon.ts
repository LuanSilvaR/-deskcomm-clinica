/**
 * FORK clinic (8012) — o favicon da empresa: regras do arquivo e onde ele mora.
 *
 * Mesmo bucket e mesmas garantias do logo (`lib/branding/logo.ts`): caminho
 * `<org>/<uuid v4>.png`, só o service_role escreve, bytes farejados. O que muda
 * é a régua do arquivo:
 *
 * - **Só PNG.** O ícone da aba precisa de transparência e é desenhado pequeno;
 *   JPG não tem transparência e SVG pode executar código (ver `pareceSvg`).
 * - **Quadrado.** O navegador desenha o ícone num quadrado: uma imagem larga é
 *   espremida. Recusar aqui é melhor que a pessoa descobrir pela aba torta.
 * - **De 32 a 1024 px.** Abaixo de 32 fica borrado em tela de alta definição; o
 *   ideal recomendado é 512 × 512 (o navegador reduz bem).
 * - **Até 256 KB.** O ícone vai para o navegador em toda primeira visita.
 *
 * O tamanho vem do cabeçalho IHDR do PNG (bytes 16–23), sem decodificar a
 * imagem: nenhum parser de pixels sobre bytes de quem sobe.
 */
export const TAMANHO_MAXIMO_DO_FAVICON = 256 * 1024;
export const LADO_MINIMO_DO_FAVICON = 32;
export const LADO_MAXIMO_DO_FAVICON = 1024;
export const LADO_IDEAL_DO_FAVICON = 512;

const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/** Largura e altura do PNG, lidas do IHDR. `null` se não for um PNG bem formado. */
export function dimensoesDoPng(bytes: Uint8Array): { largura: number; altura: number } | null {
  if (bytes.length < 24) return null;
  if (!ASSINATURA_PNG.every((b, i) => bytes[i] === b)) return null;
  // O primeiro chunk de todo PNG é o IHDR: 4 bytes de tamanho + "IHDR".
  const tipo = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
  if (tipo !== "IHDR") return null;
  const ler = (i: number) => ((bytes[i]! << 24) | (bytes[i + 1]! << 16) | (bytes[i + 2]! << 8) | bytes[i + 3]!) >>> 0;
  const largura = ler(16);
  const altura = ler(20);
  if (largura === 0 || altura === 0) return null;
  return { largura, altura };
}

export type RecusaDoFavicon =
  | { codigo: "favicon_nao_png"; mensagem: string }
  | { codigo: "favicon_nao_quadrado"; mensagem: string }
  | { codigo: "favicon_pequeno"; mensagem: string }
  | { codigo: "favicon_grande"; mensagem: string };

/** A régua do arquivo. Devolve a recusa (com a frase para a tela) ou `null` se serve. */
export function conferirFavicon(bytes: Uint8Array): RecusaDoFavicon | null {
  const d = dimensoesDoPng(bytes);
  if (!d) {
    return { codigo: "favicon_nao_png", mensagem: "O favicon precisa ser um arquivo PNG." };
  }
  if (d.largura !== d.altura) {
    return {
      codigo: "favicon_nao_quadrado",
      mensagem: `O favicon precisa ser quadrado (a imagem enviada tem ${d.largura} × ${d.altura} px). O ideal é ${LADO_IDEAL_DO_FAVICON} × ${LADO_IDEAL_DO_FAVICON} px.`,
    };
  }
  if (d.largura < LADO_MINIMO_DO_FAVICON) {
    return {
      codigo: "favicon_pequeno",
      mensagem: `O favicon precisa ter pelo menos ${LADO_MINIMO_DO_FAVICON} × ${LADO_MINIMO_DO_FAVICON} px. O ideal é ${LADO_IDEAL_DO_FAVICON} × ${LADO_IDEAL_DO_FAVICON} px.`,
    };
  }
  if (d.largura > LADO_MAXIMO_DO_FAVICON) {
    return {
      codigo: "favicon_grande",
      mensagem: `O favicon pode ter no máximo ${LADO_MAXIMO_DO_FAVICON} × ${LADO_MAXIMO_DO_FAVICON} px. O ideal é ${LADO_IDEAL_DO_FAVICON} × ${LADO_IDEAL_DO_FAVICON} px.`,
    };
  }
  return null;
}

const FORMA_DO_CAMINHO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/;

/** `settings.clinic.favicon_path`, só se tiver a forma esperada (a mesma do banco). */
export function faviconDeSettings(settings: unknown): string | null {
  const clinic = (settings as { clinic?: { favicon_path?: unknown } } | null | undefined)?.clinic;
  const caminho = typeof clinic?.favicon_path === "string" ? clinic.favicon_path.trim() : "";
  return FORMA_DO_CAMINHO.test(caminho) ? caminho : null;
}
