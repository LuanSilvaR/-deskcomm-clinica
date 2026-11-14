/**
 * FORK clinic (agenda S5) — a experiência do profissional: a casa e o menu que
 * as permissões desenham, o recorte de pacientes, o papel de sistema e o
 * conflito de bloqueio. Regras puras; o banco é provado em tests/invariants.
 */
import { describe, expect, it } from "vitest";

import { dependenciasFaltando, ehPermissao, PAPEL_PROFISSIONAL } from "@/lib/clinic/acesso/catalogo";
import { ehExperienciaDoProfissional, mostraEmBreve, rotuloDaAgenda } from "@/lib/clinic/acesso/experiencia";
import { conflitosDoBloqueio } from "@/lib/clinic/agenda/conflito-do-bloqueio";
import { recorteDePacientes } from "@/lib/clinic/pacientes/escopo-de-pacientes";

describe("casa por capacidade (sem `if` de perfil)", () => {
  it("quem atende e não opera a recepção cai no Meu dia", () => {
    expect(ehExperienciaDoProfissional(new Set(PAPEL_PROFISSIONAL.chaves))).toBe(true);
  });
  it("quem atende E recepciona segue no Início", () => {
    expect(ehExperienciaDoProfissional(["atendimento.iniciar", "recepcao.mudar_status_visita"])).toBe(false);
  });
  it("a recepção (sem atender) segue no Início", () => {
    expect(ehExperienciaDoProfissional(["recepcao.mudar_status_visita", "agenda.ver"])).toBe(false);
  });
  it("sem permissões lidas, não desvia", () => {
    expect(ehExperienciaDoProfissional(null)).toBe(false);
  });
});

describe("rótulo da Agenda e o Em breve", () => {
  it("sem ver a agenda dos outros, é Minha agenda", () => {
    expect(rotuloDaAgenda(["agenda.ver"], "Agenda")).toBe("Minha agenda");
    expect(rotuloDaAgenda(["agenda.ver", "agenda.ver_outros"], "Agenda")).toBe("Agenda");
    expect(rotuloDaAgenda(undefined, "Agenda")).toBe("Agenda");
  });
  it("Em breve só para quem configura (ou a plataforma)", () => {
    expect(mostraEmBreve([...PAPEL_PROFISSIONAL.chaves], false)).toBe(false);
    expect(mostraEmBreve(["configuracoes.ver"], false)).toBe(true);
    expect(mostraEmBreve([], true)).toBe(true);
    expect(mostraEmBreve(undefined, false)).toBe(true);
  });
});

describe("papel de sistema Profissional de saúde", () => {
  const chaves = new Set<string>(PAPEL_PROFISSIONAL.chaves);
  it("todas as chaves existem no catálogo e as dependências fecham", () => {
    for (const k of chaves) expect(ehPermissao(k), k).toBe(true);
    expect(dependenciasFaltando([...chaves])).toEqual([]);
  });
  it("nasce restrito: sem ver os outros, sem financeiro, conversas, CRM, estoque ou configurações", () => {
    for (const k of ["agenda.ver_outros", "pacientes.ver_todos", "prontuario.ver_outros", "recepcao.mudar_status_visita"]) {
      expect(chaves.has(k), k).toBe(false);
    }
    for (const prefixo of ["financeiro.", "conversas.", "crm.", "estoque.", "configuracoes.", "equipe."]) {
      expect([...chaves].filter((k) => k.startsWith(prefixo)), prefixo).toEqual([]);
    }
  });
  it("tem o fluxo clínico: atender, prontuário, adendo, bloquear a própria agenda", () => {
    for (const k of ["atendimento.iniciar", "atendimento.finalizar", "prontuario.ver", "prontuario.adendo", "agenda.bloquear_horario"]) {
      expect(chaves.has(k), k).toBe(true);
    }
  });
});

describe("recorte de pacientes", () => {
  it("com pacientes.ver_todos não há recorte", () => {
    expect(recorteDePacientes(new Set(["pacientes.ver", "pacientes.ver_todos"]), ["a"])).toBeNull();
  });
  it("sem ela, só os da própria agenda (sem repetição)", () => {
    expect(recorteDePacientes(new Set(["pacientes.ver"]), ["a", "b", "a"])).toEqual(["a", "b"]);
  });
  it("sem agenda própria, nenhum (lista vazia, não null)", () => {
    expect(recorteDePacientes(new Set(), [])).toEqual([]);
  });
});

describe("conflito do bloqueio (fuso da clínica)", () => {
  const fuso = "America/Sao_Paulo"; // UTC-3
  const bloqueio = {
    user_id: "u1",
    starts_on: "2026-10-12",
    ends_on: "2026-10-12",
    start_minute: 12 * 60,
    end_minute: 13 * 60,
    weekdays: null,
  };
  const ag = (id: string, ini: string, fim: string) => ({ id, starts_at: ini, ends_at: fim });

  it("paciente das 12:30 às 13:00 (local) colide com o almoço das 12 às 13", () => {
    const r = conflitosDoBloqueio(bloqueio, "u1", [ag("x", "2026-10-12T15:30:00Z", "2026-10-12T16:00:00Z")], fuso);
    expect(r.map((a) => a.id)).toEqual(["x"]);
  });
  it("encostar na borda não colide (11:00–12:00 e 13:00–14:00)", () => {
    const r = conflitosDoBloqueio(
      bloqueio,
      "u1",
      [ag("antes", "2026-10-12T14:00:00Z", "2026-10-12T15:00:00Z"), ag("depois", "2026-10-12T16:00:00Z", "2026-10-12T17:00:00Z")],
      fuso,
    );
    expect(r).toEqual([]);
  });
  it("o dia é o do fuso: 12:30 UTC é 09:30 local, fora da faixa", () => {
    expect(conflitosDoBloqueio(bloqueio, "u1", [ag("utc", "2026-10-12T12:30:00Z", "2026-10-12T13:00:00Z")], fuso)).toEqual([]);
  });
  it("recorrência semanal: só nos dias marcados", () => {
    const semanal = { ...bloqueio, starts_on: "2026-10-12", ends_on: "2026-10-18", weekdays: [3] }; // quarta
    const seg = ag("seg", "2026-10-12T15:30:00Z", "2026-10-12T16:00:00Z");
    const qua = ag("qua", "2026-10-14T15:30:00Z", "2026-10-14T16:00:00Z");
    expect(conflitosDoBloqueio(semanal, "u1", [seg, qua], fuso).map((a) => a.id)).toEqual(["qua"]);
  });
});
