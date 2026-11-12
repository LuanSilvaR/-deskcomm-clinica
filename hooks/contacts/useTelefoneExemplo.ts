"use client";
/**
 * O TELEFONE DE EXEMPLO dos campos de telefone (#84, recorte do upstream).
 *
 * No upstream o exemplo vem do perfil do país da organização. O fork atende
 * clínicas no Brasil e ainda não tem esse perfil, então o exemplo é brasileiro.
 * A assinatura é a mesma do upstream: quando o perfil do país chegar, só o
 * corpo muda.
 */
export function useTelefoneExemplo(): string {
  return "+55 61 99999-8888";
}
