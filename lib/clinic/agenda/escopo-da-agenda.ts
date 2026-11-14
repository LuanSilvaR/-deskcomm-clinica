/**
 * FORK clinic (agenda por profissional, S1) — DE QUEM a agenda pode ser lida.
 *
 * Com `agenda.ver_outros`, quem pede escolhe o dono (ou nenhum = todos). Sem
 * ela, a leitura é sempre a da própria agenda: pedir a de outro responde 403,
 * não pedir nada vira "a minha". As rotas da agenda chamam isto ANTES de
 * consultar — a tela esconder o seletor é cortesia; quem decide é aqui.
 */
export const PERMISSAO_VER_OUTROS = "agenda.ver_outros";

export type EscopoDaLeitura =
  | { ok: true; /** null = todos (só com a permissão) */ dono: string | null; restrito: boolean }
  | { ok: false };

export function escopoDaLeitura(args: {
  permissoes: ReadonlySet<string>;
  usuarioId: string;
  pedido: string | null | undefined;
}): EscopoDaLeitura {
  const pedido = args.pedido || null;
  if (args.permissoes.has(PERMISSAO_VER_OUTROS)) return { ok: true, dono: pedido, restrito: false };
  if (pedido && pedido !== args.usuarioId) return { ok: false };
  return { ok: true, dono: args.usuarioId, restrito: true };
}
