/**
 * FORK clinic (prontuário F9) — o link `wa.me` para mandar o link de aceite ao
 * paciente pelo WhatsApp do próprio aparelho de quem atende. A mensagem é
 * genérica de propósito: nome do termo e conteúdo clínico não vão no texto.
 */
export function linkDoWhatsApp(
  telefone: string | null | undefined,
  mensagem: string,
): string | null {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  if (digitos.length < 10 || digitos.length > 15) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensagem)}`;
}
