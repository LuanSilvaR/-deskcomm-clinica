/**
 * FORK clinic (prontuário F3) — utilidades puras do editor de modelos.
 *
 * A CHAVE de um campo é o que liga resposta e campo para sempre: nasce do
 * rótulo ao criar o campo e nunca muda depois (renomear o rótulo mantém a
 * chave; assim as respostas antigas continuam no lugar certo).
 */
import type { Campo } from "@/lib/clinic/formularios/campos";

/** "Queixa principal" → "queixa_principal"; única entre `existentes`. */
export function chaveDoRotulo(rotulo: string, existentes: ReadonlySet<string>): string {
  const base =
    rotulo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^(\d)/, "c_$1")
      .slice(0, 34) || "campo";
  if (!existentes.has(base)) return base;
  for (let i = 2; ; i++) {
    const c = `${base}_${i}`;
    if (!existentes.has(c)) return c;
  }
}

/** "Sim\nNão\n\nTalvez" → opções {valor, rotulo}, sem vazias nem repetidas. */
export function opcoesDoTexto(texto: string): NonNullable<Campo["opcoes"]> {
  const vistos = new Set<string>();
  const out: NonNullable<Campo["opcoes"]> = [];
  for (const linha of texto.split("\n")) {
    const rotulo = linha.trim().slice(0, 120);
    if (!rotulo) continue;
    const valor = chaveDoRotulo(rotulo, vistos).slice(0, 60);
    vistos.add(valor);
    out.push({ valor, rotulo });
  }
  return out;
}

/** Os campos mudaram de verdade? (Decide se "Publicar nova versão" aparece.) */
export function camposMudaram(a: readonly Campo[], b: readonly Campo[]): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

/** Move o item `i` uma posição (−1 sobe, +1 desce), sem sair da lista. */
export function mover<T>(lista: readonly T[], i: number, passo: -1 | 1): T[] {
  const j = i + passo;
  if (j < 0 || j >= lista.length) return [...lista];
  const out = [...lista];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}
