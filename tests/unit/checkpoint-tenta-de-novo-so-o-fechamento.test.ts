// @vitest-environment node
/**
 * #142 — o fechamento do turno pede o checkpoint em JSON livre. Quando o modelo
 * erra o formato, quem tenta de novo é SÓ a chamada de fechamento (pequena),
 * não o turno inteiro (que re-roda o LLM principal e custa o turno duas vezes).
 * Só depois de esgotar as tentativas o erro sobe, como antes, para a fila.
 */
import { describe, expect, it, vi } from "vitest";

import { fecharTurnoComCheckpoint } from "@/lib/agent-engine/agent/inbound-turn";

const VALIDO = '{"commitments": [], "objections": [], "next_action": null, "rolling_summary": "Paciente perguntou sobre botox."}';

describe("fecharTurnoComCheckpoint", () => {
  it("JSON válido na 1ª tentativa: uma chamada só", async () => {
    const gerar = vi.fn().mockResolvedValue(VALIDO);
    const r = await fecharTurnoComCheckpoint(gerar);
    expect(r.rolling_summary).toBe("Paciente perguntou sobre botox.");
    expect(gerar).toHaveBeenCalledTimes(1);
  });

  it("JSON inválido na 1ª, válido na 2ª: repete só o fechamento e avisa", async () => {
    const gerar = vi.fn().mockResolvedValueOnce('{"commitments": [,]}').mockResolvedValueOnce(VALIDO);
    const aoFalhar = vi.fn();
    const r = await fecharTurnoComCheckpoint(gerar, { aoFalhar });
    expect(r.rolling_summary).toBe("Paciente perguntou sobre botox.");
    expect(gerar).toHaveBeenCalledTimes(2);
    expect(aoFalhar).toHaveBeenCalledTimes(1);
    expect(aoFalhar.mock.calls[0]?.[0]).toBe(1);
  });

  it("sem JSON nenhum também é repetido", async () => {
    const gerar = vi.fn().mockResolvedValueOnce("Fechado.").mockResolvedValueOnce(VALIDO);
    await expect(fecharTurnoComCheckpoint(gerar)).resolves.toMatchObject({ next_action: null });
    expect(gerar).toHaveBeenCalledTimes(2);
  });

  it("esgotou as tentativas: o erro de antes sobe para a fila (sem o texto do modelo)", async () => {
    const gerar = vi.fn().mockResolvedValue('{"commitments": [,], "dado": "Maria 11 99999-0000"}');
    await expect(fecharTurnoComCheckpoint(gerar, { tentativas: 2 })).rejects.toThrow(/run re-tentado pela fila/);
    await expect(fecharTurnoComCheckpoint(gerar, { tentativas: 2 })).rejects.not.toThrow(/Maria/);
  });
});
