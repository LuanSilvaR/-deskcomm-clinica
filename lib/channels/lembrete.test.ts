import { describe, expect, it } from "vitest";

import { CHANNEL_PROVIDER_META, CHANNEL_PROVIDER_WAHA } from "./capabilities";
import {
  PROVIDERS_DE_RESERVA_DO_LEMBRETE,
  PROVIDERS_DO_LEMBRETE,
  PROVIDERS_PREFERIDOS_DO_LEMBRETE,
  PROVIDER_PREFERIDO_DO_LEMBRETE,
} from "./lembrete";

describe("canais do lembrete com reserva", () => {
  it("o conjunto é exatamente o canal oficial e o canal por QR, nessa ordem", () => {
    expect(PROVIDERS_PREFERIDOS_DO_LEMBRETE).toEqual([CHANNEL_PROVIDER_META]);
    expect(PROVIDERS_DE_RESERVA_DO_LEMBRETE).toEqual([CHANNEL_PROVIDER_WAHA]);
    expect(PROVIDERS_DO_LEMBRETE).toEqual([CHANNEL_PROVIDER_META, CHANNEL_PROVIDER_WAHA]);
    expect(PROVIDER_PREFERIDO_DO_LEMBRETE).toBe(CHANNEL_PROVIDER_META);
  });
});
