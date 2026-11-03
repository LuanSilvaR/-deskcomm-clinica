import { describe, expect, it } from "vitest";

import {
  buscarProfissionais,
  chaveDasPreferencias,
  iniciais,
  lerContextoDaUrl,
  lerPreferencias,
  registrarVisita,
  resolverProfissional,
  tiposDoProfissional,
  type ProfissionalDaAgenda,
} from "@/lib/clinic/agenda/contexto-da-agenda";
import { complementoNoDia, diasEntre, disponibilidadeDoProfissional } from "@/lib/clinic/agenda/disponibilidade-do-profissional";
import { escopoDaLeitura } from "@/lib/clinic/agenda/escopo-da-agenda";

/**
 * Agenda por profissional (S1): a agenda mostra UM profissional por vez, e as
 * regras que decidem qual, quem pode ver o de quem e o que a grade pinta como
 * indisponível são puras — testadas aqui; a tela e as rotas só as aplicam.
 */

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const prof = (n: number, extra: Partial<ProfissionalDaAgenda> = {}): ProfissionalDaAgenda => ({
  user_id: U(n),
  nome: `Profissional ${n}`,
  especialidades: [],
  ativo: true,
  eu: false,
  tipos_restritos: [],
  ...extra,
});

describe("resolverProfissional — URL › último › a própria › o primeiro (CA04, CA16)", () => {
  const lista = [prof(1), prof(2, { eu: true }), prof(3)];

  it("a URL vence quando o profissional está na lista", () => {
    expect(resolverProfissional({ daUrl: U(3), ultimo: U(1), lista })).toBe(U(3));
  });
  it("sem URL, restaura o último visto", () => {
    expect(resolverProfissional({ daUrl: null, ultimo: U(1), lista })).toBe(U(1));
  });
  it("sem URL nem último, abre a agenda de quem está logado", () => {
    expect(resolverProfissional({ daUrl: null, ultimo: null, lista })).toBe(U(2));
  });
  it("quem não atende cai no primeiro da lista", () => {
    expect(resolverProfissional({ daUrl: null, ultimo: null, lista: [prof(1), prof(3)] })).toBe(U(1));
  });
  it("pedido de alguém fora da lista (sem permissão ou de outra empresa) não vira tela vazia", () => {
    expect(resolverProfissional({ daUrl: U(99), ultimo: U(98), lista })).toBe(U(2));
  });
  it("profissional inativo não é aberto", () => {
    expect(resolverProfissional({ daUrl: U(1), ultimo: null, lista: [prof(1, { ativo: false }), prof(3)] })).toBe(U(3));
  });
  it("lista vazia → ninguém", () => {
    expect(resolverProfissional({ daUrl: U(1), ultimo: U(1), lista: [] })).toBeNull();
  });
});

describe("buscarProfissionais — parte do nome, sem acento e sem caixa (CA02)", () => {
  const lista = [
    prof(1, { nome: "Dra. Ana Carolina Mendes", especialidades: ["Dermatologia estética"] }),
    prof(2, { nome: "Diego Martins Souza", especialidades: ["Enfermagem estética"] }),
    prof(3, { nome: "Carla Fernandes Rocha" }),
  ];
  it("acha por pedaço do nome", () => {
    expect(buscarProfissionais(lista, "ana").map((p) => p.user_id)).toEqual([U(1)]);
  });
  it("ignora acento e caixa", () => {
    expect(buscarProfissionais(lista, "ESTETICA").map((p) => p.user_id)).toEqual([U(1), U(2)]);
  });
  it("todos os termos precisam bater", () => {
    expect(buscarProfissionais(lista, "carla rocha").map((p) => p.user_id)).toEqual([U(3)]);
    expect(buscarProfissionais(lista, "carla mendes")).toEqual([]);
  });
  it("busca vazia devolve a lista", () => {
    expect(buscarProfissionais(lista, "  ")).toHaveLength(3);
  });
});

describe("tiposDoProfissional — só oferece o que ele atende (CA05)", () => {
  const tipos = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("tira os tipos cuja especialidade ele não tem", () => {
    expect(tiposDoProfissional(tipos, { tipos_restritos: ["b"] })).toEqual([{ id: "a" }, { id: "c" }]);
  });
  it("sem profissional em contexto, todos", () => {
    expect(tiposDoProfissional(tipos, null)).toHaveLength(3);
  });
});

describe("lerContextoDaUrl", () => {
  it("lê profissional, data e visão bem-formados", () => {
    expect(lerContextoDaUrl(new URLSearchParams(`profissional=${U(1)}&data=2026-10-07&visao=dia`))).toEqual({
      profissional: U(1),
      data: "2026-10-07",
      visao: "dia",
    });
  });
  it("descarta lixo em vez de quebrar a tela", () => {
    expect(lerContextoDaUrl(new URLSearchParams("profissional=x&data=07/10&visao=ano"))).toEqual({
      profissional: null,
      data: null,
      visao: null,
    });
  });
});

describe("preferências no navegador — por usuário e empresa, tolerantes", () => {
  it("a chave separa usuário e empresa", () => {
    expect(chaveDasPreferencias("org", "eu")).toBe("agenda:org:eu");
  });
  it("storage ausente, vazio, com lixo ou que lança = sem preferência", () => {
    const vazio = { ultimo: null, recentes: [] };
    expect(lerPreferencias(null, "k")).toEqual(vazio);
    expect(lerPreferencias({ getItem: () => null }, "k")).toEqual(vazio);
    expect(lerPreferencias({ getItem: () => "{nao é json" }, "k")).toEqual(vazio);
    expect(
      lerPreferencias({ getItem: () => { throw new Error("SecurityError"); } }, "k"),
    ).toEqual(vazio);
  });
  it("registrar visita: vira o último, sobe nos recentes sem repetir, no máximo 5", () => {
    let p = { ultimo: null as string | null, recentes: [] as string[] };
    for (const id of ["a", "b", "c", "d", "e", "f", "b"]) p = registrarVisita(p, id);
    expect(p.ultimo).toBe("b");
    expect(p.recentes).toEqual(["b", "f", "e", "d", "c"]);
  });
});

describe("escopoDaLeitura — agenda.ver_outros (CA15)", () => {
  const com = new Set(["agenda.ver", "agenda.ver_outros"]);
  const sem = new Set(["agenda.ver"]);
  it("com a permissão, quem pede escolhe o dono", () => {
    expect(escopoDaLeitura({ permissoes: com, usuarioId: "eu", pedido: "colega" })).toEqual({ ok: true, dono: "colega", restrito: false });
    expect(escopoDaLeitura({ permissoes: com, usuarioId: "eu", pedido: null })).toEqual({ ok: true, dono: null, restrito: false });
  });
  it("sem ela, pedir a agenda de um colega é recusado", () => {
    expect(escopoDaLeitura({ permissoes: sem, usuarioId: "eu", pedido: "colega" })).toEqual({ ok: false });
  });
  it("sem ela, não pedir nada vira a própria agenda (nunca a equipe toda)", () => {
    expect(escopoDaLeitura({ permissoes: sem, usuarioId: "eu", pedido: undefined })).toEqual({ ok: true, dono: "eu", restrito: true });
    expect(escopoDaLeitura({ permissoes: sem, usuarioId: "eu", pedido: "eu" })).toEqual({ ok: true, dono: "eu", restrito: true });
  });
});

describe("disponibilidadeDoProfissional — o que a grade pinta (CA13, CA14)", () => {
  it("o complemento da jornada é o que fica hachurado", () => {
    expect(complementoNoDia([{ inicio_minuto: 540, fim_minuto: 720 }, { inicio_minuto: 780, fim_minuto: 1140 }])).toEqual([
      { inicio_minuto: 0, fim_minuto: 540 },
      { inicio_minuto: 720, fim_minuto: 780 },
      { inicio_minuto: 1140, fim_minuto: 1440 },
    ]);
    expect(complementoNoDia([])).toEqual([{ inicio_minuto: 0, fim_minuto: 1440 }]);
  });

  it("dias entre duas datas, com teto", () => {
    expect(diasEntre("2026-10-04", "2026-10-06")).toEqual(["2026-10-04", "2026-10-05", "2026-10-06"]);
    expect(diasEntre("2026-01-01", "2026-12-31")).toHaveLength(42);
  });

  it("jornada do dia da semana, bloqueio pessoal, da clínica e indisponibilidade do núcleo — cada um no seu dia", () => {
    const dias = disponibilidadeDoProfissional({
      profissionalId: "p1",
      dias: ["2026-10-05", "2026-10-06"], // segunda e terça
      disponibilidade: {
        user_id: "p1",
        schedule: { windows: [{ dow: 1, start: "09:00", end: "18:00" }] },
      },
      excecoes: [
        { user_id: "p1", exception_date: "2026-10-06", is_unavailable: true, start_minute: null, end_minute: null, reason: "Médico" },
      ],
      bloqueios: [
        { user_id: "p1", starts_on: "2026-10-05", ends_on: "2026-10-05", start_minute: 720, end_minute: 780, weekdays: null, reason: "Almoço" },
        { user_id: null, starts_on: "2026-10-01", ends_on: "2026-10-31", start_minute: 1020, end_minute: 1080, weekdays: [1], reason: "Reunião" },
        { user_id: "outra", starts_on: "2026-10-05", ends_on: "2026-10-05", start_minute: 600, end_minute: 660, weekdays: null, reason: "Não é dela" },
      ],
    });
    const [seg, ter] = dias;
    expect(seg!.jornada).toEqual([{ inicio_minuto: 540, fim_minuto: 1080 }]);
    expect(seg!.fora_da_jornada).toEqual([
      { inicio_minuto: 0, fim_minuto: 540 },
      { inicio_minuto: 1080, fim_minuto: 1440 },
    ]);
    expect(seg!.bloqueios.map((b) => [b.motivo, b.origem])).toEqual([
      ["Almoço", "pessoa"],
      ["Reunião", "clinica"],
    ]);
    expect(ter!.jornada).toEqual([]);
    expect(ter!.bloqueios).toEqual([{ inicio_minuto: 0, fim_minuto: 1440, motivo: "Médico", origem: "indisponivel" }]);
  });
});

describe("iniciais", () => {
  it("ignora o título e pega primeiro e último nome", () => {
    expect(iniciais("Dra. Ana Carolina Mendes")).toBe("AM");
    expect(iniciais("Dr. Bruno Vasconcelos")).toBe("BV");
    expect(iniciais("Carla")).toBe("C");
  });
});
