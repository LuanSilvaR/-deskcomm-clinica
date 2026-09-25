/**
 * FORK clinic (prontuário F10) — identificação do profissional no prontuário.
 *
 * CFM 1.638/2002: cada registro identifica quem o fez, com o número no
 * conselho. "CRM 12345/SP"; sem conselho cadastrado, nada (a tela de
 * Profissionais é onde se completa).
 */
export interface ConselhoDoProfissional {
  council: string | null;
  council_number: string | null;
  council_uf: string | null;
}

export function registroNoConselho(p: ConselhoDoProfissional | null | undefined): string | null {
  if (!p?.council) return null;
  const numero = p.council_number?.trim();
  const uf = p.council_uf?.trim();
  return [p.council, numero ? `${numero}${uf ? `/${uf}` : ""}` : uf ?? null].filter(Boolean).join(" ");
}

/** "Nome — CRM 12345/SP", ou só o nome, ou null. */
export function comConselho(nome: string | null | undefined, conselho: string | null | undefined): string | null {
  if (!nome) return conselho ?? null;
  return conselho ? `${nome} — ${conselho}` : nome;
}
