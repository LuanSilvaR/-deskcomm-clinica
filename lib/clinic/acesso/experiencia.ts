/**
 * FORK clinic (agenda S5) — a experiência que as PERMISSÕES desenham, sem
 * `if (role === …)`: quem pode atender e não opera a recepção é o
 * profissional, e a casa dele é o "Meu dia". Quem tem as duas (o profissional
 * que também recepciona) segue com o Início da recepção, que mostra tudo.
 */
export const CASA_DO_PROFISSIONAL = "/app/meu-dia";

export function ehExperienciaDoProfissional(permissoes: ReadonlySet<string> | readonly string[] | null | undefined): boolean {
  if (!permissoes) return false;
  const tem = (k: string) => (Array.isArray(permissoes) ? permissoes.includes(k) : (permissoes as ReadonlySet<string>).has(k));
  return tem("atendimento.iniciar") && !tem("recepcao.mudar_status_visita");
}

/** O rótulo da Agenda para quem só vê a própria. */
export function rotuloDaAgenda(permissoes: readonly string[] | undefined, rotulo: string): string {
  return permissoes && !permissoes.includes("agenda.ver_outros") ? "Minha agenda" : rotulo;
}

/** "Em breve" é novidade do produto para quem configura a clínica, não para quem atende. */
export function mostraEmBreve(permissoes: readonly string[] | undefined, isPlatformAdmin: boolean): boolean {
  return isPlatformAdmin || !permissoes || permissoes.includes("configuracoes.ver");
}
