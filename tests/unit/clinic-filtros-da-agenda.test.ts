import { describe, expect, it } from "vitest";

import { CHAVES_DOS_FILTROS, algumFiltroAtivo, filtrosExtrasAtivos, lerFiltros, passaNosFiltros, type InfoDaClinica } from "@/lib/clinic/agenda/filtros-da-agenda";

const f = (qs: string) => lerFiltros(new URLSearchParams(qs));
const ag = (id: string, hora: number, extra: Partial<{ situacao: string; responsavelId: string; origem: string }> = {}) => ({
  id,
  situacao: "confirmed",
  responsavelId: "p1",
  comeca: new Date(2030, 0, 10, hora, 0).toISOString(),
  ...extra,
});
const info: InfoDaClinica = {
  compromissos: {
    a1: { paciente_id: "c1", visita: "na_recepcao", desde: null, confirmacao: null, faltas: 0 },
    a2: { paciente_id: "c2", visita: null, desde: null, confirmacao: null, faltas: 1 },
  },
  profissionais: { p1: { nome: "Ana", conselho: null, especialidades: [{ id: "e1", nome: "Derma" }] } },
  pacientes_da_busca: null,
};

describe("filtros da Agenda", () => {
  it("sem nada na URL: nenhum filtro ativo, e o cancelado passa (o histórico tem a aba Cancelados)", () => {
    const x = f("");
    expect(algumFiltroAtivo(x)).toBe(false);
    expect(x.status).not.toContain("cancelado");
    expect(passaNosFiltros(ag("a1", 9), x, info)).toBe(true);
    expect(passaNosFiltros(ag("a3", 9, { situacao: "cancelled" }), x, info)).toBe(true);
  });

  it("mexeu no status: o cancelado só passa se estiver marcado", () => {
    expect(passaNosFiltros(ag("a3", 9, { situacao: "cancelled" }), f("status=agendado,na_recepcao"), info)).toBe(false);
    expect(passaNosFiltros(ag("a3", 9, { situacao: "cancelled" }), f("status=cancelado"), info)).toBe(true);
  });

  it("status: só os marcados passam (visita manda sobre a situação do núcleo)", () => {
    const x = f("status=na_recepcao");
    expect(x.statusMudou).toBe(true);
    expect(passaNosFiltros(ag("a1", 9), x, info)).toBe(true);
    expect(passaNosFiltros(ag("a2", 9), x, info)).toBe(false);
  });

  it("período: manhã deixa as 9h e barra as 14h", () => {
    const x = f("periodo=manha");
    expect(passaNosFiltros(ag("a1", 9), x, info)).toBe(true);
    expect(passaNosFiltros(ag("a1", 14), x, info)).toBe(false);
  });

  it("especialidade: pelo profissional do compromisso", () => {
    expect(passaNosFiltros(ag("a1", 9), f("esp=e1"), info)).toBe(true);
    expect(passaNosFiltros(ag("a1", 9), f("esp=outra"), info)).toBe(false);
  });

  it("busca de paciente: só os ids que o servidor devolveu", () => {
    const comBusca = { ...info, pacientes_da_busca: ["c2"] };
    expect(passaNosFiltros(ag("a1", 9), f("q=joao"), comBusca)).toBe(false);
    expect(passaNosFiltros(ag("a2", 9), f("q=joao"), comBusca)).toBe(true);
  });

  it("somente livres esconde todo compromisso", () => {
    expect(passaNosFiltros(ag("a1", 9), f("livres=1"), info)).toBe(false);
  });

  it("sem a informação da clínica (carregando), só período e livres valem — a grade não pisca vazia", () => {
    expect(passaNosFiltros(ag("a1", 9), f("status=faltou"), null)).toBe(true);
  });

  it("ocupação do Google some só quando o filtro de status foi mexido", () => {
    expect(passaNosFiltros(ag("g1", 9, { origem: "google_sync" }), f(""), info)).toBe(true);
    expect(passaNosFiltros(ag("g1", 9, { origem: "google_sync" }), f("status=agendado"), info)).toBe(false);
  });
});

describe("S2 (#67): sala e + Mais filtros", () => {
  const comSalas: InfoDaClinica = {
    ...info,
    compromissos: {
      a1: { ...info.compromissos.a1!, salas: ["s1"] },
      a2: { ...info.compromissos.a2!, salas: [] },
    },
    salas: [{ id: "s1", nome: "Sala 1" }],
  };

  it("sala: só passa quem reservou a sala; sem info ainda, não esconde (a grade não pisca vazia)", () => {
    const x = f("sala=s1");
    expect(x.sala).toBe("s1");
    expect(algumFiltroAtivo(x)).toBe(true);
    expect(passaNosFiltros(ag("a1", 9), x, comSalas)).toBe(true);
    expect(passaNosFiltros(ag("a2", 9), x, comSalas)).toBe(false);
    expect(passaNosFiltros(ag("a9", 9), x, comSalas)).toBe(false);
    expect(passaNosFiltros(ag("a2", 9), x, null)).toBe(true);
  });

  it("padrões: fins de semana e indisponíveis visíveis, cancelados fora da grade", () => {
    const x = f("");
    expect(x.cancelados).toBe(false);
    expect(x.semFimDeSemana).toBe(false);
    expect(x.semIndisponiveis).toBe(false);
    expect(filtrosExtrasAtivos(x)).toBe(0);
  });

  it("+ Mais filtros: cada opção liga pela URL, conta no botão e entra no Limpar filtros", () => {
    const x = f("cancelados=1&fds=0&indisp=0");
    expect(x.cancelados && x.semFimDeSemana && x.semIndisponiveis).toBe(true);
    expect(filtrosExtrasAtivos(x)).toBe(3);
    expect(algumFiltroAtivo(x)).toBe(true);
    for (const k of ["sala", "cancelados", "fds", "indisp"]) expect(CHAVES_DOS_FILTROS).toContain(k);
  });

  it("valores estranhos na URL não ligam nada", () => {
    const x = f("cancelados=sim&fds=1&indisp=talvez");
    expect(filtrosExtrasAtivos(x)).toBe(0);
  });
});

describe('S3 (#68): filtro de procedimento', () => {
  const comProcs: InfoDaClinica = {
    ...info,
    compromissos: { a1: { ...info.compromissos.a1!, procedimentos: ['p1', 'p2'] }, a2: { ...info.compromissos.a2!, procedimentos: [] } },
  };
  it('só passa quem tem o procedimento; vai para a URL e entra no Limpar filtros', () => {
    const x = f('proc=p2');
    expect(x.procedimento).toBe('p2');
    expect(algumFiltroAtivo(x)).toBe(true);
    expect(CHAVES_DOS_FILTROS).toContain('proc');
    expect(passaNosFiltros(ag('a1', 9), x, comProcs)).toBe(true);
    expect(passaNosFiltros(ag('a2', 9), x, comProcs)).toBe(false);
  });
});
