import { describe, expect, it } from "vitest";

import {
  acaoDoAtalho,
  alternarFavorito,
  chaveDaAgenda,
  lerFavoritos,
  lerPreferencias,
  ordenarComFavoritos,
  PREFERENCIAS_PADRAO,
  vizinho,
} from "@/lib/clinic/agenda/produtividade";

const lista = [{ user_id: "a" }, { user_id: "b" }, { user_id: "c" }];

describe("S7 (#70): produtividade da Agenda", () => {
  it("favoritos primeiro, na ordem marcada; id que sumiu é ignorado", () => {
    expect(ordenarComFavoritos(lista, ["c", "x", "a"]).map((p) => p.user_id)).toEqual(["c", "a", "b"]);
    expect(alternarFavorito(["a"], "b")).toEqual(["a", "b"]);
    expect(alternarFavorito(["a", "b"], "a")).toEqual(["b"]);
  });

  it("← / → dão a volta; com um só não há vizinho", () => {
    expect(vizinho(lista, "a", 1)?.user_id).toBe("b");
    expect(vizinho(lista, "c", 1)?.user_id).toBe("a");
    expect(vizinho(lista, "a", -1)?.user_id).toBe("c");
    expect(vizinho([{ user_id: "a" }], "a", 1)).toBeNull();
    expect(vizinho(lista, "fora", 1)?.user_id).toBe("a");
  });

  it("atalhos: letras sem caixa; nunca em campo de texto nem com Ctrl", () => {
    expect(acaoDoAtalho({ key: "n" })).toBe("novo");
    expect(acaoDoAtalho({ key: "T" })).toBe("hoje");
    expect(acaoDoAtalho({ key: "]" })).toBe("seguinte");
    expect(acaoDoAtalho({ key: "?" })).toBe("ajuda");
    expect(acaoDoAtalho({ key: "n", alvo: { tagName: "input" } })).toBeNull();
    expect(acaoDoAtalho({ key: "n", alvo: { isContentEditable: true } })).toBeNull();
    expect(acaoDoAtalho({ key: "n", ctrlKey: true })).toBeNull();
    expect(acaoDoAtalho({ key: "x" })).toBeNull();
  });

  it("preferências e favoritos: lixo no storage vira padrão", () => {
    expect(lerPreferencias(null)).toEqual(PREFERENCIAS_PADRAO);
    expect(lerPreferencias("{quebrado")).toEqual(PREFERENCIAS_PADRAO);
    expect(lerPreferencias('{"visao":"dia","mostrarFimDeSemana":false}')).toEqual({ visao: "dia", mostrarFimDeSemana: false });
    expect(lerPreferencias('{"visao":"ano"}').visao).toBeNull();
    expect(lerFavoritos('["a",1,"b"]')).toEqual(["a", "b"]);
    expect(lerFavoritos("nada")).toEqual([]);
    expect(chaveDaAgenda("favoritos", "o1", "u1")).toBe("clinica.agenda.favoritos.o1.u1");
  });
});
