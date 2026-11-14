/**
 * FORK clinic (prontuário F10) — canais de divulgação de uma foto clínica.
 *
 * As chaves são as mesmas opções do termo de uso de imagem V1: marcar uma foto
 * para divulgação exige a finalidade E cada canal autorizados pelo paciente
 * (o banco confere em `fn_clinic_divulgacao_autorizada`).
 */
export const CANAIS_DE_DIVULGACAO = ["redes_sociais", "site", "material_impresso"] as const;
export type CanalDeDivulgacao = (typeof CANAIS_DE_DIVULGACAO)[number];

export const ROTULO_DO_CANAL: Record<CanalDeDivulgacao, string> = {
  redes_sociais: "Redes sociais",
  site: "Site",
  material_impresso: "Material impresso",
};
