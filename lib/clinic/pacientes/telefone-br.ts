/**
 * FORK clinic (agenda S3 #68) — telefone brasileiro no cadastro rápido.
 *
 * `mascararTelefoneBR`: o que a pessoa digita vira "(61) 98210-3837" (ou
 * "(61) 3210-3837" no fixo), sem travar quem cola o número com +55.
 * `telefoneParaE164`: o que vai para a API (`+5561982103837`). Quem já digitou
 * no formato internacional (+…) passa como está. Puro e testado.
 */
const soDigitos = (v: string) => v.replace(/\D/g, "");

export function mascararTelefoneBR(valor: string): string {
  if (valor.trim().startsWith("+")) return valor;
  const d = soDigitos(valor).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const corte = resto.length === 9 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

export function telefoneParaE164(valor: string): string | null {
  const limpo = valor.trim();
  if (!limpo) return null;
  if (limpo.startsWith("+")) return `+${soDigitos(limpo)}`;
  const d = soDigitos(limpo);
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return `+${d}`;
  return null;
}
