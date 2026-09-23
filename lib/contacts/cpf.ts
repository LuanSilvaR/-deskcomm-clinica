/**
 * CPF: normalização, hash e cifragem em repouso.
 *
 * `cpf_hash` é sha256(hex) dos 11 dígitos — busca exata e dedupe sem expor o
 * número. `cpf_encrypted` é o CPF cifrado com pgcrypto pelas funções
 * `encrypt_cpf` / `decrypt_cpf` (migration 9002 do fork).
 *
 * ⚠️ As duas colunas andam JUNTAS: o CHECK `contacts_cpf_consistency` exige
 * `(cpf_encrypted IS NULL) = (cpf_hash IS NULL)`. Até a 9002 as funções não
 * existiam, este módulo devolvia null na cifra e os chamadores gravavam só o
 * hash — e todo CPF gravado falhava no CHECK. Por isso `cifrarCpf` devolve o
 * PAR ou nada: quem chama nunca mais grava metade.
 *
 * A chave é `CPF_ENCRYPTION_KEY`, lida na hora do uso (não no import, para não
 * derrubar quem só importa o módulo num teste sem ambiente) e passada ao banco
 * como parâmetro — ela nunca é gravada no banco.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";

export function normalizeCpf(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** sha256 hex dos 11 dígitos, para busca exata via `cpf_hash`. */
export function hashCpf(raw: string): string {
  return createHash("sha256").update(normalizeCpf(raw)).digest("hex");
}

function chaveDoCpf(): string | null {
  const k = process.env.CPF_ENCRYPTION_KEY;
  return k && k.length >= 16 ? k : null;
}

/**
 * O par que vai para o banco — `cpf_hash` e `cpf_encrypted` — ou `null` quando
 * não foi possível cifrar (chave ausente, função indisponível). Nunca metade.
 */
export async function cifrarCpf(
  supabase: SupabaseClient,
  plaintext: string,
): Promise<{ cpf_hash: string; cpf_encrypted: string } | null> {
  const chave = chaveDoCpf();
  if (!chave) {
    logger.warn("[contacts.cpf] CPF_ENCRYPTION_KEY ausente ou curta — CPF não gravado");
    return null;
  }
  const { data, error } = await supabase.rpc("encrypt_cpf", {
    // Já normalizado pelo país (lib/legal/perfil-do-pais.ts): pode ter letras fora do Brasil.
    p_plaintext: plaintext.trim(),
    p_key: chave,
  });
  if (error || !data) {
    logger.warn("[contacts.cpf] encrypt_cpf falhou — CPF não gravado", { erro: error?.message ?? "sem retorno" });
    return null;
  }
  return { cpf_hash: hashCpf(plaintext), cpf_encrypted: data as string };
}

/** O CPF em claro, ou `null` quando não há cifra ou não foi possível decifrar. */
export async function decifrarCpf(
  supabase: SupabaseClient,
  cifra: unknown,
): Promise<string | null> {
  const chave = chaveDoCpf();
  if (!chave || cifra === null || cifra === undefined) return null;
  const { data, error } = await supabase.rpc("decrypt_cpf", { p_ciphertext: cifra, p_key: chave });
  if (error) {
    logger.warn("[contacts.cpf] decrypt_cpf falhou", { erro: error.message });
    return null;
  }
  return typeof data === "string" ? data : null;
}
