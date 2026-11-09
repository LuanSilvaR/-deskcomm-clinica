/**
 * FORK clinic — cerca do papel timbrado único.
 *
 * 1. Só o motor (`lib/documentos/`) desenha PDF com o react-pdf. Qualquer outro
 *    arquivo que importe `@react-pdf/renderer` para gerar documento reprova —
 *    o caminho é entregar conteúdo ao `renderizarDocumento`.
 * 2. Dentro do motor, cor (hex) só em `paleta.ts`, e fonte só em `tema.ts`/`fontes.ts`.
 *
 * `A_MIGRAR` é a lista dos geradores antigos que ainda não passaram pelo motor
 * (fases D3/D4 de `docs/padrao-documentos.md`). Ela só encolhe: arquivo que
 * sai do react-pdf PRECISA sair daqui (o teste reprova a entrada velha).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(__dirname, "../..");

/** Lê o PDF (não gera): extrai texto para a base de conhecimento da IA. */
const LEITORES = ["lib/ai/rag/extractors/pdf.ts"];

const A_MIGRAR = [
  "lib/clinic/orcamentos/pdf.tsx", // D3 — contrato do orçamento
  "lib/clinic/prontuario/pdf.tsx", // D4 — prontuário
  "lib/lgpd/pdf-renderer.tsx", // D4 — exportação LGPD (núcleo)
];

function arquivosQueImportamReactPdf(): string[] {
  const saida = execFileSync("git", ["grep", "-l", "@react-pdf/renderer", "--", "app", "lib", "components"], {
    cwd: RAIZ,
    encoding: "utf8",
  });
  return saida
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

describe("papel timbrado: um motor só", () => {
  it("fora de lib/documentos, ninguém gera PDF com o react-pdf (exceto a lista que está migrando)", () => {
    const fora = arquivosQueImportamReactPdf().filter((f) => !f.startsWith("lib/documentos/") && !LEITORES.includes(f));
    expect(fora.sort()).toEqual(fora.filter((f) => A_MIGRAR.includes(f)).sort());
  });

  it("a lista A_MIGRAR só tem quem ainda usa o react-pdf (migrou? tire daqui)", () => {
    const usam = new Set(arquivosQueImportamReactPdf());
    for (const f of A_MIGRAR) expect(usam.has(f), `${f} já não usa o react-pdf: remova de A_MIGRAR`).toBe(true);
  });

  it("dentro do motor, cor hex só na paleta e família de fonte só no tema/fontes", () => {
    const pasta = path.join(RAIZ, "lib/documentos");
    for (const nome of fs.readdirSync(pasta).filter((n) => /\.(ts|tsx)$/.test(n))) {
      const fonte = fs.readFileSync(path.join(pasta, nome), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      if (nome !== "paleta.ts") expect(fonte, `${nome} tem cor hex`).not.toMatch(/["'`]#[0-9a-fA-F]{3,8}["'`]/);
      if (!["tema.ts", "fontes.ts"].includes(nome)) {
        expect(fonte, `${nome} escreve família de fonte`).not.toMatch(/fontFamily:\s*["'`]/);
      }
    }
  });
});
