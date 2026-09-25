/**
 * FORK clinic (9015) — a regra de coerência procedimento × profissional.
 *
 * Se o procedimento exige especializações, cada profissional vinculado precisa
 * ter PELO MENOS UMA delas. Sem especialização exigida, qualquer profissional
 * serve. O banco cobra a mesma regra (trigger da 9015); aqui ela existe para a
 * tela mostrar "apto" antes de salvar e para a rota dizer QUEM não serve.
 */
export interface ProfissionalComEspecialidades {
  id: string;
  specialty_ids: readonly string[];
}

export function profissionalApto(especialidadesDoProcedimento: readonly string[], p: ProfissionalComEspecialidades): boolean {
  if (especialidadesDoProcedimento.length === 0) return true;
  return p.specialty_ids.some((s) => especialidadesDoProcedimento.includes(s));
}

/** Os ids de `escolhidos` que não servem para o procedimento. */
export function profissionaisSemEspecialidade(
  especialidadesDoProcedimento: readonly string[],
  escolhidos: readonly string[],
  profissionais: readonly ProfissionalComEspecialidades[],
): string[] {
  const porId = new Map(profissionais.map((p) => [p.id, p]));
  return escolhidos.filter((id) => {
    const p = porId.get(id);
    return !p || !profissionalApto(especialidadesDoProcedimento, p);
  });
}
