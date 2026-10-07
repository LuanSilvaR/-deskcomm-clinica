/**
 * FORK clinic (financeiro FN1) — aritmética de centavos do financeiro.
 *
 * Uma régua só, igual no TS e no SQL (`fn_clinic_fin_calcular`, migration
 * 9039), para a simulação na tela bater centavo a centavo com o que o banco
 * grava:
 *
 *   • dinheiro em CENTAVOS inteiros; percentual com até 4 casas;
 *   • arredondamento MEIO PARA CIMA (valores positivos), feito em inteiros
 *     (BigInt) — nunca em ponto flutuante;
 *   • rateio em parcelas: parte inteira para todas, o RESTO NA 1ª PARCELA.
 */

/** Percentual com até 4 casas → pontos-base inteiros (11,30% → 113000). */
export function percentualEmMilionesimos(percentual: number): bigint {
  if (!Number.isFinite(percentual) || percentual < 0) throw new RangeError("percentual_invalido");
  return BigInt(Math.round(percentual * 10_000));
}

/** a ÷ b com arredondamento meio para cima; a ≥ 0, b > 0. */
export function dividirArredondando(a: bigint, b: bigint): bigint {
  if (b <= 0n || a < 0n) throw new RangeError("divisao_invalida");
  return (2n * a + b) / (2n * b);
}

/** centavos × percentual (até 4 casas), meio para cima. */
export function aplicarPercentual(centavos: number, percentual: number): number {
  if (!Number.isInteger(centavos) || centavos < 0) throw new RangeError("centavos_invalidos");
  // percentual em milionésimos: 11,30% = 113000 / 1_000_000
  return Number(dividirArredondando(BigInt(centavos) * percentualEmMilionesimos(percentual), 1_000_000n));
}

/** Rateia `total` em `n` partes inteiras; o resto vai para a 1ª. */
export function ratear(total: number, n: number): number[] {
  if (!Number.isInteger(total) || total < 0) throw new RangeError("centavos_invalidos");
  if (!Number.isInteger(n) || n < 1) throw new RangeError("parcelas_invalidas");
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + total - base * n : base));
}
