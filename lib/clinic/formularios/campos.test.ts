import { describe, expect, it } from "vitest";

import { camposSchema, pendencias, validarRespostas, type Campo } from "./campos";

const campos: Campo[] = [
  { chave: "queixa", rotulo: "Queixa", tipo: "texto_longo", obrigatorio: true },
  { chave: "peso", rotulo: "Peso", tipo: "numero", min: 0, max: 400 },
  { chave: "dor", rotulo: "Dor", tipo: "escala" },
  { chave: "fuma", rotulo: "Fuma?", tipo: "sim_nao" },
  { chave: "pele", rotulo: "Pele", tipo: "escolha", opcoes: [{ valor: "seca", rotulo: "Seca" }, { valor: "oleosa", rotulo: "Oleosa" }] },
  { chave: "regioes", rotulo: "Regiões", tipo: "multipla", opcoes: [{ valor: "abdomen", rotulo: "Abdômen" }] },
  { chave: "desde", rotulo: "Desde", tipo: "data" },
];

describe("campos do modelo", () => {
  it("aceita os modelos com chaves únicas e recusa chave repetida ou tipo desconhecido", () => {
    expect(camposSchema.safeParse(campos).success).toBe(true);
    expect(camposSchema.safeParse([...campos, campos[0]]).success).toBe(false);
    expect(camposSchema.safeParse([{ chave: "x", rotulo: "X", tipo: "foto" }]).success).toBe(false);
  });
});

describe("validarRespostas (autosave)", () => {
  it("rascunho pela metade é válido e vazio some da gravação", () => {
    const r = validarRespostas(campos, { queixa: "", peso: 70, fuma: false, regioes: [] });
    expect(r).toEqual({ ok: true, respostas: { peso: 70, fuma: false } });
  });

  it("recusa chave que não existe no modelo (sem campo escondido no JSON)", () => {
    const r = validarRespostas(campos, { queixa: "ok", paciente_id: "outro" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.erros)).toEqual(["paciente_id"]);
  });

  it("recusa tipo errado, fora da faixa e opção inexistente", () => {
    const r = validarRespostas(campos, { peso: "70", dor: 11, pele: "mista", regioes: ["pes"], desde: "01/02/2020", fuma: "sim" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.erros).sort()).toEqual(["desde", "dor", "fuma", "pele", "peso", "regioes"]);
  });

  it("recusa respostas que não são objeto", () => {
    expect(validarRespostas(campos, []).ok).toBe(false);
    expect(validarRespostas(campos, null).ok).toBe(false);
  });
});

describe("pendencias", () => {
  it("lista só os obrigatórios vazios", () => {
    expect(pendencias(campos, {}).map((c) => c.chave)).toEqual(["queixa"]);
    expect(pendencias(campos, { queixa: "Manchas" })).toEqual([]);
  });
});
