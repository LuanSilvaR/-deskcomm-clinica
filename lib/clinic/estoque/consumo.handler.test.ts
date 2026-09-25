import { describe, expect, it } from "vitest";

import { clinicEstoqueConsumoHandler } from "./consumo.handler";

const linha = (payload: Record<string, unknown>) => ({
  id: "00000000-0000-4000-8000-000000000001",
  organization_id: "00000000-0000-4000-8000-0000000000aa",
  event_type: "clinic.procedimento_confirmado",
  entity_kind: "clinic_procedimento_realizado",
  entity_id: null,
  payload,
  metadata: {},
  consumed_by: [],
  attempts: 0,
});

describe("consumidor de estoque do prontuário", () => {
  it("sem módulo de estoque: marca como lido, sem erro e sem retentativa", async () => {
    const r = await clinicEstoqueConsumoHandler.handle(
      linha({
        atendimento_id: "00000000-0000-4000-8000-000000000002",
        procedure_id: null,
        event_type_id: null,
        insumos: [
          {
            insumo_id: "00000000-0000-4000-8000-000000000003",
            product_id: null,
            quantidade: "0.200",
            unidade: "fr",
            lote: "L1",
            validade: "2027-12-31",
          },
        ],
      }),
    );
    expect(r).toMatchObject({ status: "skipped", detail: "sem_estoque" });
  });

  it("payload fora do formato: pula, não quebra o dreno", async () => {
    expect((await clinicEstoqueConsumoHandler.handle(linha({ x: 1 }))).status).toBe("skipped");
  });
});
