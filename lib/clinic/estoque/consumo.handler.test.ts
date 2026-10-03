import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));

import { clinicEstoqueConsumoHandler } from "./consumo.handler";
import { SemEstoque } from "./porta";

const PROC = "00000000-0000-4000-8000-00000000000f";
const linha = (payload: Record<string, unknown>, entity_id: string | null = PROC) => ({
  id: "00000000-0000-4000-8000-000000000001",
  organization_id: "00000000-0000-4000-8000-0000000000aa",
  event_type: "clinic.procedimento_confirmado",
  entity_kind: "clinic_procedimento_realizado",
  entity_id,
  payload,
  metadata: {},
  consumed_by: [],
  attempts: 0,
});
const payload = {
  atendimento_id: "00000000-0000-4000-8000-000000000002",
  procedure_id: null,
  event_type_id: null,
  insumos: [
    {
      insumo_id: "00000000-0000-4000-8000-000000000003",
      product_id: "00000000-0000-4000-8000-000000000004",
      quantidade: "0.200",
      unidade: "fr",
      lote: "L1",
      validade: "2027-12-31",
    },
  ],
};

beforeEach(() => mocks.rpc.mockReset());

describe("consumidor de estoque do prontuário", () => {
  it("SemEstoque continua dizendo que não mexeu", async () => {
    expect(await SemEstoque.registrarConsumo("org", payload as never)).toEqual({ movimentos: [], motivo: "sem_estoque" });
  });

  it("baixa pelo procedimento do EVENTO e pela organização do evento (nunca do payload)", async () => {
    mocks.rpc.mockResolvedValue({ data: { ligado: true, baixados: 1, pendencias: 0, livres: 0 }, error: null });
    const r = await clinicEstoqueConsumoHandler.handle(linha(payload));
    expect(mocks.rpc).toHaveBeenCalledWith("fn_clinic_estoque_baixar_procedimento", {
      p_org: "00000000-0000-4000-8000-0000000000aa",
      p_procedimento: PROC,
    });
    expect(r).toMatchObject({ status: "ok", detail: "1 baixa(s), 0 pendência(s)" });
  });

  it("opção desligada: marca como lido, sem erro e sem retentativa", async () => {
    mocks.rpc.mockResolvedValue({ data: { ligado: false }, error: null });
    expect(await clinicEstoqueConsumoHandler.handle(linha(payload))).toMatchObject({
      status: "skipped",
      detail: "estoque_desligado",
    });
  });

  it("só consumo livre (produto fora do estoque): pula", async () => {
    mocks.rpc.mockResolvedValue({ data: { ligado: true, baixados: 0, pendencias: 0, livres: 1 }, error: null });
    expect((await clinicEstoqueConsumoHandler.handle(linha(payload))).detail).toBe("consumo_livre");
  });

  it("erro do banco vira erro (o dreno tenta de novo)", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "timeout" } });
    expect(await clinicEstoqueConsumoHandler.handle(linha(payload))).toMatchObject({ status: "error", detail: "timeout" });
  });

  it("evento sem procedimento: pula sem chamar o banco", async () => {
    expect((await clinicEstoqueConsumoHandler.handle(linha(payload, null))).status).toBe("skipped");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("payload fora do formato: pula, não quebra o dreno", async () => {
    expect((await clinicEstoqueConsumoHandler.handle(linha({ x: 1 }))).status).toBe("skipped");
  });
});
