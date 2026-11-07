/**
 * FORK clinic — registro das fontes do papel timbrado no react-pdf.
 *
 * Inter (400/700) e Cormorant Garamond (500/600), subconjunto latino (cobre
 * ç, ã, é…), licença SIL OFL 1.1 — os textos das licenças estão ao lado dos
 * arquivos. Moram em `public/` porque é a pasta que o Dockerfile copia inteira
 * para a imagem (o `.next/standalone` não leva arquivo lido por caminho).
 *
 * Sem itálico registrado: texto em itálico no editor sai no peso normal (o
 * react-pdf lançaria com estilo não registrado). Hifenização desligada: o
 * padrão do react-pdf parte palavras em português de forma errada.
 */
import path from "node:path";

import { Font } from "@react-pdf/renderer";

import { FAMILIA } from "./tema";

let registradas = false;

export function registrarFontes(): void {
  if (registradas) return;
  const pasta = path.join(process.cwd(), "public", "fontes", "documentos");
  Font.register({
    family: FAMILIA.texto,
    fonts: [
      { src: path.join(pasta, "inter-400.woff"), fontWeight: 400 },
      { src: path.join(pasta, "inter-700.woff"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: FAMILIA.titulo,
    fonts: [
      { src: path.join(pasta, "cormorant-garamond-500.woff"), fontWeight: 500 },
      { src: path.join(pasta, "cormorant-garamond-600.woff"), fontWeight: 600 },
    ],
  });
  Font.registerHyphenationCallback((palavra) => [palavra]);
  registradas = true;
}
