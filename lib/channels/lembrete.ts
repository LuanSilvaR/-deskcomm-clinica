/**
 * Quais canais o lembrete com reserva (#83) sabe operar, decididos por
 * CAPACIDADE (invariante 1 de `docs/doctrine/restricao-de-canal.md`).
 *
 *   - caminho preferido: canal cuja plataforma exige modelo aprovado
 *     (`requiresTemplates`) — é o canal oficial, tentado primeiro;
 *   - caminho de reserva: canal que manda texto livre fora da janela de 24h
 *     (`freeformOutsideWindow`) — é o canal por QR code.
 *
 * `CANDIDATOS` é a lista de canais que o fluxo já foi desenhado e provado para
 * operar. Ela existe porque a capability sozinha NÃO basta: outros dois canais
 * também exigem modelo aprovado, mas o fluxo (leitura do modelo por número,
 * classificação de recusa) nunca foi provado neles. Provider novo NÃO entra no
 * lembrete sem alguém decidir aqui — o teste de `lembrete.test.ts` trava o
 * conjunto.
 */
import { CHANNEL_PROVIDER_META, CHANNEL_PROVIDER_WAHA, PROVIDERS_DE_MENSAGEM, capabilitiesOf } from "./capabilities";
import type { ChannelProvider } from "./types";

const CANDIDATOS: readonly ChannelProvider[] = [CHANNEL_PROVIDER_META, CHANNEL_PROVIDER_WAHA];

/** Preferidos: exigem modelo aprovado fora da janela. Tentados primeiro. */
export const PROVIDERS_PREFERIDOS_DO_LEMBRETE: readonly ChannelProvider[] = CANDIDATOS.filter(
  (p) => capabilitiesOf(p).requiresTemplates,
);

/** Reserva: mandam texto livre a qualquer hora. */
export const PROVIDERS_DE_RESERVA_DO_LEMBRETE: readonly ChannelProvider[] = CANDIDATOS.filter(
  (p) => capabilitiesOf(p).freeformOutsideWindow && !capabilitiesOf(p).requiresTemplates,
);

/** Ordem de tentativa: preferidos, depois reserva. */
export const PROVIDERS_DO_LEMBRETE: readonly ChannelProvider[] = [
  ...PROVIDERS_PREFERIDOS_DO_LEMBRETE,
  ...PROVIDERS_DE_RESERVA_DO_LEMBRETE,
];

/** O canal preferido (para filtrar no banco). */
export const PROVIDER_PREFERIDO_DO_LEMBRETE: ChannelProvider = PROVIDERS_PREFERIDOS_DO_LEMBRETE[0]!;

/** O canal de reserva (QR code), para filtrar no banco ou montar fixture. */
export const PROVIDER_DE_RESERVA_DO_LEMBRETE: ChannelProvider = PROVIDERS_DE_RESERVA_DO_LEMBRETE[0]!;

export function ehPreferidoDoLembrete(provider: string | null | undefined): boolean {
  return (PROVIDERS_PREFERIDOS_DO_LEMBRETE as readonly (string | null | undefined)[]).includes(provider);
}

/** Canais de mensagem que o lembrete NÃO usa (úteis para provar que ficam de fora). */
export const PROVIDERS_FORA_DO_LEMBRETE: readonly ChannelProvider[] = PROVIDERS_DE_MENSAGEM.filter(
  (p) => !PROVIDERS_DO_LEMBRETE.includes(p),
);
