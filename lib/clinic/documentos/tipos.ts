/**
 * FORK clinic (prontuário F6) — tipos de documento e as OPÇÕES de um termo.
 *
 * Opção = uma finalidade que o paciente marca sim ou não (ex.: "divulgação sem
 * mostrar o rosto"). Nenhuma vem marcada; `obrigatoria` só serve para termos em
 * que concordar com aquele item é condição do próprio termo.
 */
import { z } from "zod";

export const TIPOS_DE_DOCUMENTO = ["contrato", "consentimento", "autorizacao", "uso_imagem", "ciencia"] as const;
export type TipoDeDocumento = (typeof TIPOS_DE_DOCUMENTO)[number];

export const ROTULO_DO_TIPO_DE_DOCUMENTO: Record<TipoDeDocumento, string> = {
  contrato: "Contrato",
  consentimento: "Termo de consentimento",
  autorizacao: "Autorização",
  uso_imagem: "Uso de imagem",
  ciencia: "Ciência de orientações",
};

export const opcaoDoTermoSchema = z
  .object({
    chave: z
      .string()
      .regex(/^[a-z][a-z0-9_]{0,39}$/),
    rotulo: z.string().trim().min(1).max(500),
    obrigatoria: z.boolean().optional(),
  })
  .strict();
export type OpcaoDoTermo = z.infer<typeof opcaoDoTermoSchema>;

export const opcoesDoTermoSchema = z
  .array(opcaoDoTermoSchema)
  .max(20)
  .refine((os) => new Set(os.map((o) => o.chave)).size === os.length, "Opção repetida.");

/** Escolhas do paciente: TODAS as opções respondidas; obrigatórias com sim. */
export function escolhasCompletas(opcoes: readonly OpcaoDoTermo[], escolhas: Record<string, boolean | undefined>): boolean {
  return (
    Object.keys(escolhas).length === opcoes.length &&
    opcoes.every((o) => typeof escolhas[o.chave] === "boolean" && (!o.obrigatoria || escolhas[o.chave] === true))
  );
}

export const escolhasSchema = z.record(z.string().regex(/^[a-z][a-z0-9_]{0,39}$/), z.boolean());
