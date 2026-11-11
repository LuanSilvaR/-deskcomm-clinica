/**
 * #83 (Ruling 19): o seletor do modelo aprovado só entra no PATCH se a pessoa
 * MUDOU o valor. Um modelo salvo que saiu da lista (ficou inutilizável, ou a
 * leitura falhou) aparece como "Nenhum"; reenviar esse "Nenhum" apagaria o
 * modelo em silêncio num salvamento que não tinha nada a ver com ele.
 */

/** O valor com que o seletor nasce: o salvo, se ainda é oferecido; senão "" (Nenhum). */
export function valorInicialDoSeletor(salvo: string | null | undefined, ofertados: string[]): string {
  return salvo && ofertados.includes(salvo) ? salvo : "";
}

/** O pedaço do PATCH: chave ausente = não mexer; null = limpar; id = trocar. */
export function parteDoModeloNoPatch(opts: {
  chaveLigada: boolean;
  lembreteLigado: boolean;
  inicial: string;
  atual: string;
}): { reminder_meta_template_id?: string | null } {
  if (!opts.chaveLigada || !opts.lembreteLigado) return {};
  if (opts.atual === opts.inicial) return {};
  return { reminder_meta_template_id: opts.atual === "" ? null : opts.atual };
}
