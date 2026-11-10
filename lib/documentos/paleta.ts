/**
 * FORK clinic — os 7 PAPÉIS de cor do papel timbrado. O layout nunca usa hex
 * direto: lê `ink`, `muted`, `primary`, `surface`, `border`, `accent`, `paper`.
 *
 * A semente é a "cor do papel timbrado" (`settings.clinic.cor_filetes`, nome
 * histórico da coluna) quando preenchida — ela manda no documento INTEIRO
 * (issue #126: o dono quer o PDF todo na cor escolhida). Vazia, vale a cor da
 * Marca (`settings.branding.accent_hex`). Os papéis
 * saem da MESMA rampa que pinta o produto (`rampaDeSemente`), para o documento
 * e a tela contarem a mesma cor:
 *   primary = a própria semente (grau 600), escurecida até 4,5:1 se preciso;
 *   surface = grau 100 · border = grau 200 · ink = grau 950 (≥ 12:1);
 *   muted   = ink clareado até ≈ 6:1;
 *   accent  = o grau 300 da mesma rampa (filetes).
 * Sem semente: os padrões do Design System v2.0.
 *
 * Validação WCAG: ink e muted ≥ 4,5:1 sobre paper e surface; primary ≥ 4,5:1
 * sobre paper. Quem falha tem a LUMINOSIDADE ajustada (o matiz nunca muda); se
 * ainda falhar, cai no padrão do papel — e o motivo vai para `avisos`.
 * `accent` é decorativo (filetes) e nunca vira texto.
 */
import { razaoDeContraste } from "@/lib/branding/contraste";
import { ehHexValido, hexParaOklch, normalizarHex, oklchParaHex, rampaDeSemente } from "@/lib/branding/rampa";

export interface Papeis {
  ink: string;
  muted: string;
  primary: string;
  surface: string;
  border: string;
  accent: string;
  paper: string;
}

/** Design System v2.0 — o fallback de cada papel. */
export const PAPEIS_PADRAO: Readonly<Papeis> = {
  ink: "#2E2420",
  muted: "#6B5850",
  primary: "#8F5A4A",
  surface: "#F3E6DC",
  border: "#E0CEC1",
  accent: "#D4AF7C",
  paper: "#FFFFFF",
};

export const PISO_DE_TEXTO = 4.5;
const PISO_DO_INK = 12;
const ALVO_DO_MUTED = 6;

/** Move só o L (OKLCH) até `aceita` responder sim; `null` se não chega. */
function ajustarLuminosidade(hex: string, direcao: -1 | 1, aceita: (h: string) => boolean): string | null {
  const { L, C, h } = hexParaOklch(hex);
  for (let passo = 0; passo <= 100; passo++) {
    const l = L + direcao * passo * 0.01;
    if (l < 0 || l > 1) break;
    const candidato = oklchParaHex({ L: l, C, h });
    if (aceita(candidato)) return candidato;
  }
  return null;
}

export interface PaletaResolvida {
  papeis: Papeis;
  avisos: string[];
}

export function resolverPaleta(entrada: { semente?: string | null; corDosFiletes?: string | null }): PaletaResolvida {
  const avisos: string[] = [];
  const paper = PAPEIS_PADRAO.paper;
  const daMarca = entrada.semente && ehHexValido(entrada.semente) ? normalizarHex(entrada.semente) : null;
  const doPapel = entrada.corDosFiletes && ehHexValido(entrada.corDosFiletes) ? normalizarHex(entrada.corDosFiletes) : null;
  const semente = doPapel ?? daMarca;

  if (!semente) return { papeis: { ...PAPEIS_PADRAO }, avisos };

  const rampa = rampaDeSemente(semente);
  const surface = rampa[1];
  const border = rampa[2];

  const texto = (fundos: string[]) => (h: string) => fundos.every((f) => razaoDeContraste(h, f) >= PISO_DE_TEXTO);

  let primary = semente;
  if (!texto([paper])(primary)) {
    const ajustada = ajustarLuminosidade(primary, -1, texto([paper]));
    if (ajustada) {
      avisos.push("A cor da marca foi escurecida no documento para o texto ter contraste suficiente.");
      primary = ajustada;
    } else {
      avisos.push("A cor da marca não alcança contraste para texto; o documento usa a cor padrão.");
      primary = PAPEIS_PADRAO.primary;
    }
  }

  let ink = rampa[10];
  if (razaoDeContraste(ink, paper) < PISO_DO_INK) {
    ink = ajustarLuminosidade(ink, -1, (h) => razaoDeContraste(h, paper) >= PISO_DO_INK) ?? PAPEIS_PADRAO.ink;
  }
  if (!texto([paper, surface])(ink)) ink = PAPEIS_PADRAO.ink;

  // muted: o ink clareado até perto de 6:1, sem nunca passar abaixo do piso de texto.
  let muted = ajustarLuminosidade(ink, 1, (h) => razaoDeContraste(h, paper) <= ALVO_DO_MUTED) ?? PAPEIS_PADRAO.muted;
  if (!texto([paper, surface])(muted)) {
    muted = ajustarLuminosidade(muted, -1, texto([paper, surface])) ?? PAPEIS_PADRAO.muted;
  }

  return {
    papeis: { ink, muted, primary, surface, border, accent: rampa[3], paper },
    avisos,
  };
}

/**
 * Ícones de ESTADO das caixas de aviso (5.10). As cores fixas abaixo ficaram
 * só como referência histórica: desde a issue #126 a caixa usa a PALETA do
 * papel timbrado (`coresDoAviso`) — o dono quer o rótulo "VERSÃO … — RASCUNHO"
 * na cor do documento. O estado continua distinguível pelo ícone e pelo texto.
 */
export const ESTADOS = {
  info: { fundo: "#EEF4FB", borda: "#9DB8DA", texto: "#1F3A5F", icone: "i" },
  atencao: { fundo: "#FDF5E6", borda: "#E2B866", texto: "#5C3D00", icone: "!" },
  perigo: { fundo: "#FCEDEC", borda: "#E0A39E", texto: "#7A1D16", icone: "!" },
  sucesso: { fundo: "#EDF7EF", borda: "#9CCBA5", texto: "#1E4D2B", icone: "OK" },
} as const;
export type Estado = keyof typeof ESTADOS;

/** Cores da caixa de aviso tiradas da paleta: fundo surface, borda primary, texto com ≥ 4,5:1. */
export function coresDoAviso(estado: Estado, p: Papeis): { fundo: string; borda: string; texto: string; icone: string } {
  const texto = razaoDeContraste(p.primary, p.surface) >= PISO_DE_TEXTO ? p.primary : p.ink;
  return { fundo: p.surface, borda: p.primary, texto, icone: ESTADOS[estado].icone };
}

/** Versão monocromática para impressão em P&B: `ink` no lugar de `primary`. */
export function paraPretoEBranco(p: Papeis): Papeis {
  return { ...p, primary: p.ink, accent: p.muted, surface: "#F2F2F2", border: "#D9D9D9" };
}
