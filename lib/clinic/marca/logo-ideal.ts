/**
 * FORK clinic — o tamanho ideal do logo, medido no lugar onde ele aparece.
 *
 * A barra lateral (`components/shell/Sidebar.tsx`) desenha o logo com
 * `h-7 w-auto max-w-[10rem]`: 28 px de altura e no máximo 160 px de largura.
 * O arquivo ideal é 4× isso (nítido em tela de alta definição e com folga para
 * zoom): **640 × 112 px**, horizontal, PNG com fundo transparente.
 *
 * `avaliarLogo` olha as dimensões REAIS do arquivo (lidas pelo navegador na
 * prévia) e devolve o que a pessoa precisa saber, em português — nunca bloqueia:
 * o upload já passou pelas regras do servidor; isto é orientação.
 */
export const ALTURA_NO_MENU = 28;
export const LARGURA_MAXIMA_NO_MENU = 160;
export const LOGO_IDEAL = { largura: 640, altura: 112 } as const;
/** Abaixo de 2× a altura do menu, o logo fica borrado em tela de alta definição. */
const ALTURA_MINIMA_NITIDA = ALTURA_NO_MENU * 2;

export type AvaliacaoDoLogo = {
  /** Tamanho em que o logo de fato aparece no menu (px CSS). */
  noMenu: { largura: number; altura: number };
  avisos: string[];
};

export function avaliarLogo(largura: number, altura: number): AvaliacaoDoLogo {
  const avisos: string[] = [];
  if (largura <= 0 || altura <= 0) return { noMenu: { largura: 0, altura: 0 }, avisos };

  // O menu fixa a altura em 28 px; se a largura resultante passar de 160, a
  // largura trava em 160 e a altura encolhe junto (object-contain).
  let alturaNoMenu = ALTURA_NO_MENU;
  let larguraNoMenu = (largura / altura) * ALTURA_NO_MENU;
  if (larguraNoMenu > LARGURA_MAXIMA_NO_MENU) {
    larguraNoMenu = LARGURA_MAXIMA_NO_MENU;
    alturaNoMenu = (altura / largura) * LARGURA_MAXIMA_NO_MENU;
  }
  const noMenu = { largura: Math.round(larguraNoMenu), altura: Math.round(alturaNoMenu) };

  if (altura < ALTURA_MINIMA_NITIDA) {
    avisos.push(
      `A imagem tem só ${altura} px de altura e pode ficar borrada. Use pelo menos ${ALTURA_MINIMA_NITIDA} px — o ideal é ${LOGO_IDEAL.altura} px.`,
    );
  }
  if (noMenu.altura < ALTURA_NO_MENU - 4) {
    avisos.push(
      `O logo é muito largo para a altura: no menu ele vai aparecer com só ${noMenu.altura} px de altura. Corte as sobras ou use uma versão mais compacta.`,
    );
  }
  if (largura / altura < 1.5) {
    avisos.push(
      "Logo quadrado ou vertical fica pequeno no menu. Se tiver, use a versão horizontal (símbolo + nome lado a lado). Para o ícone da aba, use o campo Favicon.",
    );
  }
  return { noMenu, avisos };
}
