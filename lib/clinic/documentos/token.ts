/**
 * FORK clinic (prontuário F6) — o token do link de aceite.
 *
 * 32 bytes aleatórios em base64url vão no link (e só no link); o banco guarda
 * o sha256 em hexadecimal (migration 9023). Quem lê o banco não consegue abrir
 * o termo, e o link morre no primeiro uso ou no prazo.
 */
import { createHash, randomBytes } from "node:crypto";

export const FORMATO_DO_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function gerarToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashDoToken(token) };
}
