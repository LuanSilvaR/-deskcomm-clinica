import { describe, expect, it } from "vitest";

import { profissionaisSemEspecialidade, profissionalApto } from "@/lib/clinic/procedimentos/coerencia";
import { codigoOuNulo, criarProcedimentoSchema } from "@/lib/clinic/procedimentos/schemas";

const luan = { id: "luan", specialty_ids: ["esteticista"] };
const maria = { id: "maria", specialty_ids: ["esteticista", "fisio"] };
const fulana = { id: "fulana", specialty_ids: ["fisio"] };

describe("coerência procedimento × profissional", () => {
  it("sem especialidade exigida, qualquer profissional serve", () => {
    expect(profissionalApto([], fulana)).toBe(true);
  });
  it("com especialidade exigida, basta ter UMA delas", () => {
    expect(profissionalApto(["esteticista"], luan)).toBe(true);
    expect(profissionalApto(["esteticista"], fulana)).toBe(false);
    expect(profissionalApto(["esteticista", "fisio"], fulana)).toBe(true);
  });
  it("aponta quem não serve (e id desconhecido também não serve)", () => {
    expect(profissionaisSemEspecialidade(["esteticista"], ["luan", "maria", "fulana", "fantasma"], [luan, maria, fulana])).toEqual([
      "fulana",
      "fantasma",
    ]);
  });
});

describe("esquema do procedimento", () => {
  it("exige nome e descrição breve; recusa campo desconhecido", () => {
    expect(criarProcedimentoSchema.safeParse({ name: "", short_description: "x" }).success).toBe(false);
    expect(criarProcedimentoSchema.safeParse({ name: "Toxina", short_description: "x", organization_id: "outra" }).success).toBe(false);
    expect(criarProcedimentoSchema.safeParse({ name: "Toxina", short_description: "Aplicação", duration_minutes: 40 }).success).toBe(true);
  });
  it("duração fora de 5–600 é recusada; código vazio vira null", () => {
    expect(criarProcedimentoSchema.safeParse({ name: "T", short_description: "x", duration_minutes: 2 }).success).toBe(false);
    expect(codigoOuNulo("  ")).toBeNull();
    expect(codigoOuNulo(" TOX-01 ")).toBe("TOX-01");
  });
});
