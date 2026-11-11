import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/documentos/contexto-da-marca", () => ({
  resolverContextoDaMarca: vi.fn(async () => ({ fake: "contexto" })),
}));
vi.mock("@/lib/documentos/renderizar", () => ({
  renderizarDocumento: vi.fn(async () => Buffer.from("%PDF-fake")),
}));

vi.mock("@/lib/lgpd/pades-signer", () => ({
  signPdfPades: vi.fn(async (b: Buffer) => ({ signed: b, sha256: "abc", signed_pades: false })),
}));

import type { SupabaseClient } from "@supabase/supabase-js";

import { renderizarDocumento } from "@/lib/documentos/renderizar";
import { signPdfPades } from "@/lib/lgpd/pades-signer";

import type { DadosDoAtestado } from "./atestado";
import { contarRetidos, emitirAtestado, montarDocumentoDoAtestado } from "./emitir-atestado";

const ORG = "11111111-1111-4111-8111-111111111111";
const CONTATO = "22222222-2222-4222-8222-222222222222";

interface Cenario {
  existente?: boolean;
  contato?: boolean;
  uploadErro?: string | null;
  insertErro?: { code?: string; message: string } | null;
  contagens?: Record<string, number>;
  contagemErro?: boolean;
  removeLanca?: boolean;
  /** O insert dá erro de rede, mas a linha chegou a entrar. */
  gravouMesmoAssim?: boolean;
}

function stub(c: Cenario = {}) {
  const chamadas = {
    filtros: [] as { tabela: string; filtros: Record<string, unknown> }[],
    inserts: [] as Record<string, unknown>[],
    uploads: [] as { path: string }[],
    removes: [] as string[][],
  };
  const linhaOrg = { legal_name: "", display_name: "Clínica Exemplo", cnpj: "00.000.000/0001-00", timezone: "America/Sao_Paulo" };
  const from = (tabela: string) => {
    const filtros: Record<string, unknown> = {};
    let contagem = false;
    const b: Record<string, unknown> = {};
    b.select = (_: string, o?: { head?: boolean }) => {
      contagem = Boolean(o?.head);
      return b;
    };
    b.eq = (k: string, v: unknown) => {
      filtros[k] = v;
      return b;
    };
    b.maybeSingle = async () => {
      chamadas.filtros.push({ tabela, filtros });
      if (tabela === "clinic_atestados_anonimizacao" && c.gravouMesmoAssim && filtros.id)
        return { data: { id: filtros.id, codigo_curto: "ABCD-1234", algoritmo: "hmac", emitido_em: "2026-11-11T12:00:00.000Z" }, error: null };
      if (tabela === "clinic_atestados_anonimizacao") return { data: c.existente ? { id: "x" } : null, error: null };
      if (tabela === "contacts") return { data: c.contato === false ? null : { id: CONTATO, name: "Paciente Fictício" }, error: null };
      if (tabela === "organizations") return { data: linhaOrg, error: null };
      return { data: null, error: null };
    };
    b.insert = async (row: Record<string, unknown>) => {
      chamadas.inserts.push(row);
      return { error: c.insertErro ?? null };
    };
    b.then = (res: (v: unknown) => void) => {
      if (contagem) chamadas.filtros.push({ tabela, filtros });
      res({ count: c.contagens?.[tabela] ?? 0, error: c.contagemErro ? { message: "falha na contagem" } : null });
    };
    return b;
  };
  const admin = {
    from,
    storage: {
      from: () => ({
        upload: async (path: string) => {
          chamadas.uploads.push({ path });
          return { error: c.uploadErro ? { message: c.uploadErro } : null };
        },
        remove: async (paths: string[]) => {
          chamadas.removes.push(paths);
          if (c.removeLanca) throw new Error("storage fora do ar");
          return { error: null };
        },
      }),
    },
  } as unknown as SupabaseClient;
  return { admin, chamadas };
}

const executor = { user_id: "u1", nome: "Ana Admin", email: "ana@exemplo.test", papel: "admin" };
const pedido = { orgId: ORG, contactId: CONTATO, anonimizadoEm: "2026-11-11T12:00:00.000Z", executor, ip: "203.0.113.5" };

beforeEach(() => vi.clearAllMocks());

describe("contarRetidos", () => {
  it("devolve só categorias com mais de zero e filtra por org e contato", async () => {
    const { admin, chamadas } = stub({ contagens: { clinic_prontuarios: 2, clinic_atendimentos: 1, clinic_anexos: 4 } });
    const r = await contarRetidos(admin, ORG, CONTATO);
    expect(r).toEqual({ prontuario: 3, anexos: 4 });
    const tabelas = chamadas.filtros.map((f) => f.tabela);
    expect(tabelas).toContain("clinic_planos_tratamento");
    for (const f of chamadas.filtros) expect(f.filtros).toEqual({ organization_id: ORG, contact_id: CONTATO });
  });
});

describe("emitirAtestado", () => {
  it("emite, sobe o PDF e grava a linha", async () => {
    const { admin, chamadas } = stub({ contagens: { clinic_anexos: 2 } });
    const r = await emitirAtestado(admin, pedido);
    expect(r.ok).toBe(true);
    expect(chamadas.inserts).toHaveLength(1);
    const linha = chamadas.inserts[0]!;
    expect(linha.codigo_curto).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
    expect(chamadas.uploads[0]!.path).toBe(`${ORG}/atestados/${linha.id}/atestado.pdf`);
    expect(linha.pdf_path).toBe(chamadas.uploads[0]!.path);
    expect(linha.retidos).toEqual({ anexos: 2 });
  });

  it("não emite de novo quando já existe", async () => {
    const { admin, chamadas } = stub({ existente: true });
    const r = await emitirAtestado(admin, pedido);
    expect(r).toEqual({ ok: false, erro: "ja_emitido", jaExistia: true });
    expect(chamadas.uploads).toHaveLength(0);
  });

  it("falha quando o contato não é da organização", async () => {
    const { admin, chamadas } = stub({ contato: false });
    const r = await emitirAtestado(admin, pedido);
    expect(r).toEqual({ ok: false, erro: "contato_nao_encontrado" });
    expect(chamadas.uploads).toHaveLength(0);
  });

  it("falha no upload sem gravar a linha", async () => {
    const { admin, chamadas } = stub({ uploadErro: "bucket cheio" });
    const r = await emitirAtestado(admin, pedido);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("bucket cheio");
    expect(chamadas.inserts).toHaveLength(0);
  });

  it("erro de gravação com a linha já gravada: devolve sucesso e mantém o arquivo", async () => {
    const { admin, chamadas } = stub({ insertErro: { message: "fetch failed" }, gravouMesmoAssim: true });
    const r = await emitirAtestado(admin, pedido);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.atestado.codigo_curto).toBe("ABCD-1234");
    expect(chamadas.removes).toHaveLength(0);
    expect(chamadas.filtros.some((f) => f.tabela === "clinic_atestados_anonimizacao" && f.filtros.organization_id === ORG && f.filtros.id)).toBe(true);
  });

  it("erro de gravação sem linha gravada: remove o arquivo e devolve erro", async () => {
    const { admin, chamadas } = stub({ insertErro: { message: "fetch failed" } });
    const r = await emitirAtestado(admin, pedido);
    expect(r.ok).toBe(false);
    expect(chamadas.removes).toHaveLength(1);
  });

  it("em conflito 23505 remove o arquivo e avisa que já existia", async () => {
    const { admin, chamadas } = stub({ insertErro: { code: "23505", message: "dup" } });
    const r = await emitirAtestado(admin, pedido);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.jaExistia).toBe(true);
    expect(chamadas.removes).toHaveLength(1);
  });
});

describe("emitirAtestado nunca lança", () => {
  it("devolve erro quando o render lança", async () => {
    vi.mocked(renderizarDocumento).mockRejectedValueOnce(new Error("render quebrou"));
    const r = await emitirAtestado(stub().admin, pedido);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("render quebrou");
  });

  it("devolve erro quando a assinatura lança", async () => {
    vi.mocked(signPdfPades).mockRejectedValueOnce(new Error("assinatura quebrou"));
    const r = await emitirAtestado(stub().admin, pedido);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("assinatura quebrou");
  });

  it("devolve erro quando a contagem falha", async () => {
    const { admin, chamadas } = stub({ contagemErro: true });
    const r = await emitirAtestado(admin, pedido);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("falha na contagem");
    expect(chamadas.uploads).toHaveLength(0);
  });

  it("mantém jaExistia mesmo se a limpeza do arquivo lançar", async () => {
    const { admin, chamadas } = stub({ insertErro: { code: "23505", message: "dup" }, removeLanca: true });
    const r = await emitirAtestado(admin, pedido);
    expect(chamadas.removes).toHaveLength(1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.jaExistia).toBe(true);
  });
});

describe("montarDocumentoDoAtestado", () => {
  const dados: DadosDoAtestado = {
    atestado_id: "33333333-3333-4333-8333-333333333333",
    organization_id: ORG,
    organization_name: "Clínica Exemplo",
    organization_document: null,
    executor,
    ip: null,
    anonimizado_em: "2026-11-11T12:00:00.000Z",
    emitido_em: "2026-11-11T12:01:00.000Z",
    retidos: { anexos: 2 },
    fuso: "America/Sao_Paulo",
  };

  it("usa o rótulo conforme o algoritmo", () => {
    const h = JSON.stringify(montarDocumentoDoAtestado(dados, { curto: "ABCD-EF01-2345-6789", algoritmo: "hmac-sha256" }));
    expect(h).toContain("Código de autenticidade");
    expect(h).toContain("ABCD-EF01-2345-6789");
    const s = JSON.stringify(montarDocumentoDoAtestado(dados, { curto: "ABCD-EF01-2345-6789", algoritmo: "sha256" }));
    expect(s).toContain("Código de integridade");
    expect(s).not.toContain("Código de autenticidade");
    expect(s).toContain("não registrado");
    expect(s).toContain("encarregado (DPO)");
    expect(s).not.toContain("Conferir código");
  });

  it("não carrega nome de paciente", () => {
    const d = { ...dados, contato: { name: "Paciente Fictício" } } as DadosDoAtestado;
    const doc = JSON.stringify(montarDocumentoDoAtestado(d, { curto: "ABCD-EF01-2345-6789", algoritmo: "sha256" }));
    expect(doc).not.toContain("Paciente Fictício");
  });
});
