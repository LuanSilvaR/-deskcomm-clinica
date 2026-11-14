/**
 * FORK clinic (prontuário F2) — os CAMPOS de um modelo de formulário clínico e a
 * validação das respostas.
 *
 * Um modelo é uma lista de campos em JSON (migration 9018). Nada aqui conhece
 * especialidade: estética, fisioterapia ou dermatologia são só modelos
 * diferentes com os mesmos tipos de campo. Tipo novo = um caso a mais em
 * `TIPOS_DE_CAMPO`, `validarValor` e no renderizador.
 *
 * `validarRespostas` roda no AUTOSAVE: recusa chave que não existe no modelo e
 * valor do tipo errado, mas NÃO exige obrigatórios — rascunho pode estar pela
 * metade. Obrigatórios são cobrados na finalização (banco, 9019) e mostrados
 * como pendência na tela (`pendencias`).
 */
import { z } from "zod";

export const TIPOS_DE_CAMPO = ["texto", "texto_longo", "numero", "data", "sim_nao", "escolha", "multipla", "escala"] as const;
export type TipoDeCampo = (typeof TIPOS_DE_CAMPO)[number];

const opcao = z.object({ valor: z.string().min(1).max(60), rotulo: z.string().min(1).max(120) }).strict();

export const campoSchema = z
  .object({
    chave: z
      .string()
      .min(1)
      .max(40)
      .regex(/^[a-z][a-z0-9_]*$/),
    rotulo: z.string().min(1).max(160),
    tipo: z.enum(TIPOS_DE_CAMPO),
    obrigatorio: z.boolean().optional(),
    opcoes: z.array(opcao).max(50).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    ajuda: z.string().max(300).optional(),
  })
  .strict();
export type Campo = z.infer<typeof campoSchema>;

export const camposSchema = z
  .array(campoSchema)
  .max(80)
  .refine((cs) => new Set(cs.map((c) => c.chave)).size === cs.length, "Chave de campo repetida.");

/**
 * FORK clinic (prontuário F3): o que o EDITOR pode publicar. Mais estrito que
 * `camposSchema` (que também lê versões antigas): 1 a 60 campos (o banco
 * confere o mesmo em `fn_clinic_campos_validos`), escolha/múltipla com opções,
 * escala com mínimo menor que o máximo.
 */
export const camposPublicaveisSchema = camposSchema
  .refine((cs) => cs.length >= 1 && cs.length <= 60, "Um modelo tem de 1 a 60 campos.")
  .refine(
    (cs) => cs.every((c) => (c.tipo !== "escolha" && c.tipo !== "multipla") || (c.opcoes?.length ?? 0) >= 1),
    "Escolha e múltipla escolha precisam de opções.",
  )
  .refine(
    (cs) => cs.every((c) => c.tipo !== "escala" || (c.min ?? 0) < (c.max ?? 10)),
    "Na escala, o mínimo precisa ser menor que o máximo.",
  )
  .refine(
    (cs) => cs.every((c) => new Set((c.opcoes ?? []).map((o) => o.valor)).size === (c.opcoes ?? []).length),
    "Opção repetida.",
  );

export type Respostas = Record<string, unknown>;

const TEXTO_MAX = 5000;

function vazio(v: unknown): boolean {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

/** Erro do valor, ou null se válido (vazio é válido: rascunho). */
export function validarValor(campo: Campo, valor: unknown): string | null {
  if (vazio(valor)) return null;
  const valores = new Set((campo.opcoes ?? []).map((o) => o.valor));
  switch (campo.tipo) {
    case "texto":
      return typeof valor === "string" && valor.length <= 500 ? null : "Texto inválido.";
    case "texto_longo":
      return typeof valor === "string" && valor.length <= TEXTO_MAX ? null : "Texto inválido.";
    case "numero":
    case "escala": {
      if (typeof valor !== "number" || !Number.isFinite(valor)) return "Número inválido.";
      const min = campo.min ?? (campo.tipo === "escala" ? 0 : undefined);
      const max = campo.max ?? (campo.tipo === "escala" ? 10 : undefined);
      if (min !== undefined && valor < min) return "Valor abaixo do mínimo.";
      if (max !== undefined && valor > max) return "Valor acima do máximo.";
      return null;
    }
    case "data":
      return typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? null : "Data inválida.";
    case "sim_nao":
      return typeof valor === "boolean" ? null : "Escolha sim ou não.";
    case "escolha":
      return typeof valor === "string" && valores.has(valor) ? null : "Opção inválida.";
    case "multipla":
      return Array.isArray(valor) && valor.every((v) => typeof v === "string" && valores.has(v)) ? null : "Opção inválida.";
  }
}

/** Valida as respostas do autosave contra os campos da versão do modelo. */
export function validarRespostas(
  campos: readonly Campo[],
  respostas: unknown,
): { ok: true; respostas: Respostas } | { ok: false; erros: Record<string, string> } {
  if (!respostas || typeof respostas !== "object" || Array.isArray(respostas)) {
    return { ok: false, erros: { _: "Respostas inválidas." } };
  }
  const porChave = new Map(campos.map((c) => [c.chave, c]));
  const erros: Record<string, string> = {};
  const limpas: Respostas = {};
  for (const [chave, valor] of Object.entries(respostas as Respostas)) {
    const campo = porChave.get(chave);
    if (!campo) {
      erros[chave] = "Campo que não existe neste modelo.";
      continue;
    }
    const e = validarValor(campo, valor);
    if (e) erros[chave] = e;
    else if (!vazio(valor)) limpas[chave] = valor;
  }
  return Object.keys(erros).length ? { ok: false, erros } : { ok: true, respostas: limpas };
}

/** Os obrigatórios ainda vazios — a mesma regra que o banco cobra ao finalizar. */
export function pendencias(campos: readonly Campo[], respostas: Respostas): Campo[] {
  return campos.filter((c) => c.obrigatorio && vazio(respostas[c.chave]));
}
