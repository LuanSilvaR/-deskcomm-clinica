/**
 * FORK clinic (prontuário F3) — seções que uma regra de finalização pode exigir.
 *
 * O banco (9020) já aceita as seções das fases seguintes; esta lista diz quais
 * a tela e a rota oferecem HOJE. Cada fase que liga uma seção nova na checagem
 * (`fn_clinic_requisitos_faltando`) acrescenta o valor aqui.
 */
export const SECOES_EXIGIVEIS = ["anamnese", "avaliacao"] as const;
export type SecaoExigivel = (typeof SECOES_EXIGIVEIS)[number];

export const ROTULO_DA_SECAO: Record<string, string> = {
  anamnese: "Anamnese",
  avaliacao: "Avaliação",
  evolucao: "Evolução",
  conduta: "Conduta",
  procedimento: "Procedimentos",
  documento: "Documentos",
};
