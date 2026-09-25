import { describe, expect, it } from "vitest";

import type { Role } from "@/lib/auth/types";
import { CHAVES_DE_PERMISSAO } from "@/lib/clinic/acesso/catalogo";
import { menuClinicaLigado } from "@/lib/clinic/flags";
import { DICIONARIO } from "@/lib/i18n/dicionario";
import { NAV_CATALOG } from "@/lib/navigation/catalogo";
import type { InterfaceSettings } from "@/lib/navigation/interface";
import { homeDaInterface } from "@/lib/navigation/interface";
import { searchable } from "@/lib/navigation/registry";

import { ICONES_DOS_MODULOS } from "./icones";
import { ehEmBreve, MODULOS_CLINICA, moduloDaPorta, moduloDoCaminho } from "./modulos";
import { modulosVisiveis } from "./projecao";

/**
 * FORK clinic (9014) — o menu da clínica é SÓ reorganização.
 *
 * O teste que importa é o de equivalência: para cada papel e cada conjunto de
 * permissões, o conjunto de telas alcançáveis pelo menu da clínica é
 * EXATAMENTE o do menu de sempre (`searchable`). Se alguém um dia filtrar ou
 * acrescentar algo em `modulosVisiveis`, este teste reprova.
 */

const HREFS_DO_CATALOGO = NAV_CATALOG.map((d) => d.href as string);

describe("cobertura do catálogo", () => {
  it("toda porta do catálogo mora em exatamente um módulo", () => {
    const contagem = new Map<string, number>();
    for (const m of MODULOS_CLINICA) for (const p of m.portas) contagem.set(p.href, (contagem.get(p.href) ?? 0) + 1);
    const semModulo = HREFS_DO_CATALOGO.filter((h) => !contagem.has(h));
    const repetidas = [...contagem].filter(([, n]) => n > 1).map(([h]) => h);
    expect(semModulo, "porta sem módulo — declare em lib/clinic/navegacao/modulos.ts").toEqual([]);
    expect(repetidas, "porta em dois módulos").toEqual([]);
  });

  it("nenhum módulo cita porta que não existe no catálogo", () => {
    const fantasmas = MODULOS_CLINICA.flatMap((m) => m.portas.map((p) => p.href as string)).filter(
      (h) => !HREFS_DO_CATALOGO.includes(h),
    );
    expect(fantasmas).toEqual([]);
  });

  it("os ids de módulo são únicos e servem de segmento de URL", () => {
    const ids = MODULOS_CLINICA.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z-]+$/);
  });

  it("todo ícone de módulo existe", () => {
    for (const m of MODULOS_CLINICA) expect(ICONES_DOS_MODULOS[m.icon], m.id).toBeTruthy();
  });

  it("os módulos pedidos pela clínica existem, na ordem pedida", () => {
    const pedidos = [
      "inicio",
      "agenda",
      "pacientes",
      "contratos",
      "lgpd",
      "procedimentos",
      "equipamentos",
      "profissionais",
      "financeiro",
      "comissoes",
      "notas-fiscais",
      "tarefas",
      "perfil-e-acesso",
      "configuracoes",
    ];
    const ordem = MODULOS_CLINICA.map((m) => m.id as string).filter((id) => pedidos.includes(id));
    expect(ordem).toEqual(pedidos);
  });

  it("Contratos, Equipamentos, Comissões e Notas fiscais nascem 'Em breve', com o que virá descrito", () => {
    const emBreve = MODULOS_CLINICA.filter(ehEmBreve);
    expect(emBreve.map((m) => m.id)).toEqual(["contratos", "equipamentos", "comissoes", "notas-fiscais"]);
    for (const m of emBreve) expect(m.emBreve?.length, m.id).toBeGreaterThan(0);
  });
});

const PAPEIS: Array<[string, boolean, Role | null]> = [
  ["platform", true, null],
  ["admin", false, "admin"],
  ["manager", false, "manager"],
  ["agent", false, "agent"],
  ["viewer", false, "viewer"],
  ["sem papel", false, null],
];

const PERMISSOES: Array<[string, readonly string[] | undefined]> = [
  ["modo por papel (sem permissões)", undefined],
  ["modo por permissões, nenhuma", []],
  ["modo por permissões, só agenda e pacientes", ["agenda.ver", "pacientes.ver"]],
  ["modo por permissões, todas", CHAVES_DE_PERMISSAO],
];

const INTERFACES: Array<[string, InterfaceSettings | undefined]> = [
  ["interface completa", undefined],
  ["interface simplificada", { preset: "simplificada" }],
];

describe("equivalência de acesso: o menu da clínica mostra EXATAMENTE as telas do menu de sempre", () => {
  for (const [nomePapel, platform, role] of PAPEIS) {
    for (const [nomePerm, permissoes] of PERMISSOES) {
      for (const [nomeInterface, settings] of INTERFACES) {
        it(`${nomePapel} · ${nomePerm} · ${nomeInterface}`, () => {
          const antes = searchable(platform, role, settings, [], permissoes)
            .map((d) => d.href as string)
            .sort();
          const depois = modulosVisiveis(platform, role, settings, [], permissoes)
            .flatMap((m) => m.itens.map((d) => d.href as string))
            .sort();
          expect(depois).toEqual(antes);
        });
      }
    }
  }

  it("módulo opcional desligado some nos dois menus (Dados externos)", () => {
    const hrefs = modulosVisiveis(false, "admin", undefined, []).flatMap((m) => m.itens.map((d) => d.href));
    expect(hrefs).not.toContain("/app/integracao-dados");
    const ligado = modulosVisiveis(false, "admin", undefined, ["banco_externo"]).flatMap((m) =>
      m.itens.map((d) => d.href),
    );
    expect(ligado).toContain("/app/integracao-dados");
  });
});

describe("projeção", () => {
  it("módulo que esvaziou para a pessoa some; 'Em breve' aparece para todos", () => {
    const ids = modulosVisiveis(false, "viewer", undefined, [], []).map((m) => m.modulo.id);
    expect(ids).not.toContain("financeiro");
    expect(ids).not.toContain("agente-de-ia");
    expect(ids).toEqual(expect.arrayContaining(["contratos", "equipamentos", "comissoes", "notas-fiscais"]));
  });

  it("financeiro some para quem não tem financeiro.ver, mesmo sendo admin no papel legado (ACL-008)", () => {
    const ids = modulosVisiveis(false, "admin", undefined, [], ["agenda.ver", "pacientes.ver"]).map(
      (m) => m.modulo.id,
    );
    expect(ids).not.toContain("financeiro");
    expect(ids).toContain("agenda");
    expect(ids).toContain("pacientes");
  });

  it("as telas saem na ordem do módulo, agrupadas por seção", () => {
    const agenda = modulosVisiveis(false, "admin", undefined, []).find((m) => m.modulo.id === "agenda")!;
    expect(agenda.itens[0]!.href).toBe("/app/agenda");
    expect(agenda.secoes.map((s) => s.secao)).toEqual(["O dia da agenda", "Indicadores", "Ajustes da agenda"]);
  });
});

describe("módulo da tela aberta", () => {
  it.each([
    ["/app/agenda", "agenda"],
    ["/app/agenda/faltas", "agenda"],
    ["/app/settings/tenant/agenda", "agenda"],
    ["/app/settings/tenant", "configuracoes"],
    ["/app/settings/tenant/financeiro", "financeiro"],
    ["/app/ai/cases/avisos", "agente-de-ia"],
    ["/app/contacts/123", "pacientes"],
    ["/app/inicio", "inicio"],
    ["/app/inicio/financeiro", "financeiro"],
  ])("%s → %s", (caminho, esperado) => {
    expect(moduloDoCaminho(caminho)?.id).toBe(esperado);
  });

  it("caminho fora do catálogo não tem módulo", () => {
    expect(moduloDoCaminho("/app/nao-existe")).toBeUndefined();
  });

  it("moduloDaPorta devolve o módulo de uma porta", () => {
    expect(moduloDaPorta("/app/comandas")?.id).toBe("financeiro");
  });
});

describe("flag e casa", () => {
  it.each([
    [{ clinic: { menu_clinica: true } }, true],
    [{ clinic: { menu_clinica: "true" } }, false],
    [{ clinic: { menu_clinica: false } }, false],
    [{ clinic: {} }, false],
    [{}, false],
    [null, false],
    [[], false],
  ])("menuClinicaLigado(%j) = %s", (settings, esperado) => {
    expect(menuClinicaLigado(settings)).toBe(esperado);
  });

  it("sem preferência a casa continua o Inbox; com o menu da clínica, o Início", () => {
    expect(homeDaInterface(undefined, false, "agent")).toBe("/app/inbox");
    expect(homeDaInterface(undefined, false, "agent", "/app/inicio")).toBe("/app/inicio");
  });

  it("interface que esconde o Início não é contornada pela preferência", () => {
    const so = { preset: "completa", destinos: ["/app/agenda"] };
    expect(homeDaInterface(so, false, "agent", "/app/inicio")).toBe("/app/agenda");
  });
});

describe("tradução", () => {
  it("todo texto dos módulos tem espanhol", () => {
    const textos = MODULOS_CLINICA.flatMap((m) => [
      m.label,
      m.description,
      ...m.portas.map((p) => p.secao),
      ...(m.emBreve ?? []).flatMap((e) => [e.label, e.description]),
    ]);
    const sem = [...new Set(textos)].filter((t) => !DICIONARIO[t]?.es);
    expect(sem).toEqual([]);
  });
});
