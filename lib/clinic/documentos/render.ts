/**
 * FORK clinic (prontuário F6) — o texto de um termo para UM paciente.
 *
 * O modelo tem marcadores ({{paciente.nome}}, {{clinica.nome}},
 * {{profissional.nome}}, {{procedimento}}, {{data}}). O servidor troca os
 * marcadores e o banco CONGELA o resultado com sha256 (migration 9023): o que o
 * paciente aceita é exatamente este texto, para sempre.
 *
 * Marcador conhecido sem valor vira uma linha em branco ("__________") — o
 * documento continua legível e a lacuna fica visível. Marcador desconhecido
 * fica como está, para quem edita o modelo perceber o erro na prévia.
 */
export const MARCADORES = ["paciente.nome", "clinica.nome", "profissional.nome", "procedimento", "data"] as const;
export type Marcador = (typeof MARCADORES)[number];
export type DadosDoTermo = Partial<Record<Marcador, string | null>>;

const LACUNA = "__________";

export function renderizarTermo(modelo: string, dados: DadosDoTermo): string {
  return modelo.replace(/\{\{\s*([a-z.]+)\s*\}\}/g, (inteiro, chave: string) => {
    if (!(MARCADORES as readonly string[]).includes(chave)) return inteiro;
    const valor = dados[chave as Marcador];
    return valor && valor.trim() ? valor.trim() : LACUNA;
  });
}

/** Marcadores usados no modelo que o sistema não conhece (para a prévia avisar). */
export function marcadoresDesconhecidos(modelo: string): string[] {
  const vistos = new Set<string>();
  for (const m of modelo.matchAll(/\{\{\s*([a-z.]+)\s*\}\}/g)) {
    if (!(MARCADORES as readonly string[]).includes(m[1]!)) vistos.add(m[1]!);
  }
  return [...vistos];
}
