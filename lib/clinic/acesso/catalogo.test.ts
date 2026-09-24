import { describe, expect, it } from "vitest";

import {
  CATALOGO_DE_PERMISSOES,
  CHAVES_DE_PERMISSAO,
  MODULOS_DE_PERMISSAO,
  PAPEIS_MODELO,
  PERMISSOES_CRITICAS,
  comDependencias,
  dependenciasFaltando,
  ehPermissao,
  nivelDerivado,
  permissoesDoNivel,
} from "./catalogo";

const RANK = { viewer: 1, agent: 2, manager: 3, admin: 4 } as const;

describe("catálogo de permissões", () => {
  it("chave = modulo.acao, módulo conhecido, formato estável", () => {
    for (const k of CHAVES_DE_PERMISSAO) {
      const d = CATALOGO_DE_PERMISSOES[k]!;
      expect(k).toBe(`${d.modulo}.${d.acao}`);
      expect(k).toMatch(/^[a-z]+(_[a-z]+)*\.[a-z]+(_[a-z]+)*$/);
      expect(Object.keys(MODULOS_DE_PERMISSAO)).toContain(d.modulo);
    }
  });

  it("toda dependência existe e não pede nível MAIOR que a própria permissão (senão o papel não fecharia)", () => {
    for (const k of CHAVES_DE_PERMISSAO) {
      for (const dep of CATALOGO_DE_PERMISSOES[k]!.dependeDe ?? []) {
        expect(ehPermissao(dep), `${k} depende de ${dep}, que não existe`).toBe(true);
        expect(RANK[CATALOGO_DE_PERMISSOES[dep]!.nivelBase]).toBeLessThanOrEqual(RANK[CATALOGO_DE_PERMISSOES[k]!.nivelBase]);
      }
    }
  });

  it("o nível legado de cada papel-modelo é exatamente o nível de origem (a migração não muda acesso)", () => {
    for (const m of PAPEIS_MODELO) expect(nivelDerivado(permissoesDoNivel(m.nivel))).toBe(m.nivel);
  });

  it("os papéis-modelo já nascem com as dependências completas", () => {
    for (const m of PAPEIS_MODELO) expect(dependenciasFaltando(permissoesDoNivel(m.nivel))).toEqual([]);
  });

  it("críticas: gerenciar papéis e atribuí-los estão protegidas", () => {
    expect(PERMISSOES_CRITICAS).toEqual(expect.arrayContaining(["papeis.gerenciar", "equipe.atribuir_papeis", "papeis.ver", "equipe.ver"]));
  });

  it("dependências: detecta a que falta e completa transitivamente", () => {
    expect(dependenciasFaltando(["recepcao.corrigir_status"])).toEqual(["recepcao.mudar_status_visita", "recepcao.ver_painel"]);
    expect(comDependencias(["ia.administrar"])).toEqual(["ia.administrar", "ia.configurar", "ia.ver"]);
  });

  it("nivelDerivado: nada = viewer; chave desconhecida não sobe nível", () => {
    expect(nivelDerivado([])).toBe("viewer");
    expect(nivelDerivado(["sistema.superpoder"])).toBe("viewer");
    expect(nivelDerivado(["agenda.ver", "financeiro.estornar"])).toBe("manager");
  });
});
