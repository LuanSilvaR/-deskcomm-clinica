// #83: lembrete_falha só aparece quando a clínica ligou a chave.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

const ORG = "22222222-2222-4222-8222-222222222222";
const AG = "33333333-3333-4333-8333-333333333333";

vi.mock("@/lib/clinic/acesso/require-permission", () => ({
  requirePermission: vi.fn(async () => ({
    ok: true,
    user: { id: "11111111-1111-4111-8111-111111111111", idioma: "pt-BR" },
    org: { orgId: ORG, name: "Clínica", role: "admin" },
    permissoes: new Set(["agenda.ver_outros"]),
  })),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/clinic/agenda/faltas", () => ({ contarFaltas: vi.fn(async () => new Map()) }));
vi.mock("@/lib/clinic/agenda/primeira-vez", () => ({
  compromissosDePrimeiraVez: vi.fn(async () => new Set()),
  compromissosRemarcados: vi.fn(async () => new Set()),
}));

let settings: unknown = {};

/** Builder encadeável e "await-ável" que devolve as linhas da tabela pedida. */
function tabela(nome: string) {
  const linhas: Record<string, unknown[]> = {
    calendar_appointments: [{ id: AG, contact_id: null, starts_at: "2026-11-11T12:00:00Z", reminder_falha: "sem_caminho", reminder_tentativas: { "1440": 2 } }],
    organizations: [{ settings }],
  };
  const dados = linhas[nome] ?? [];
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "lt", "gt", "in", "not", "order", "limit"]) b[m] = () => b;
  b.maybeSingle = async () => ({ data: dados[0] ?? null, error: null });
  b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: dados, error: null }).then(ok);
  return b;
}

beforeEach(() => {
  settings = {};
  vi.mocked(createClient).mockResolvedValue({ from: tabela } as never);
});

const pedir = async () => {
  const { GET } = await import("./route");
  const url = "https://crm.exemplo/api/v1/clinic/agenda-info?de=2026-11-11T00:00:00Z&ate=2026-11-12T00:00:00Z";
  const corpo = (await (await GET(new NextRequest(url))).json()) as { data: { compromissos: Record<string, Record<string, unknown>> } };
  return corpo.data.compromissos[AG]!;
};

describe("/api/v1/clinic/agenda-info — lembrete_falha", () => {
  it("agenda-info não devolve lembrete_falha com a chave desligada", async () => {
    const c = await pedir();
    expect(c).toBeDefined();
    expect("lembrete_falha" in c).toBe(false);
    expect("lembrete_tentativas" in c).toBe(false);
  });

  it("devolve lembrete_falha com a chave ligada", async () => {
    settings = { clinic: { lembrete_com_reserva: true } };
    const c = await pedir();
    expect(c.lembrete_falha).toBe("sem_caminho");
    expect(c.lembrete_tentativas).toBe(2);
  });
});
