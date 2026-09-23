/**
 * Rotas da ficha do paciente e da chegada (fork clinic, migration 9002): as
 * recusas e a forma do que é gravado. RLS e cifragem são provadas no Postgres
 * real em tests/invariants/clinic-ficha-do-paciente.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/audit", () => ({
  audit: vi.fn(async () => undefined),
  isServiceRoleConfigured: vi.fn(() => true),
}));
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/impersonate/support", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/impersonate/support")>()),
  requireSupportWrite: vi.fn(async () => null),
}));

const ORG = "22222222-2222-4222-8222-222222222222";
const EU = "11111111-1111-4111-8111-111111111111";
const CONTATO = "44444444-4444-4444-8444-444444444444";
const AGENDAMENTO = "55555555-5555-4555-8555-555555555555";

type Chamada = { tabela: string; op: string; valor?: unknown };
let chamadas: Chamada[] = [];
let rpcs: { nome: string; args: unknown }[] = [];
/** Respostas por `tabela:op` — uma fila; a última se repete. */
let respostas: Record<string, { data: unknown; error: unknown }[]> = {};

function responder(chave: string, ...r: { data: unknown; error?: unknown }[]) {
  respostas[chave] = r.map((x) => ({ data: x.data, error: x.error ?? null }));
}

function falsoSupabase() {
  return {
    from(tabela: string) {
      const c: Chamada = { tabela, op: "select" };
      chamadas.push(c);
      const cadeia: Record<string, unknown> = {};
      const passa = (nome: string) => (...args: unknown[]) => {
        if (["insert", "upsert", "update", "delete"].includes(nome)) {
          c.op = nome;
          c.valor = args[0];
        }
        return cadeia;
      };
      for (const m of ["select", "insert", "upsert", "update", "delete", "eq", "in", "is", "not", "order", "limit"]) {
        cadeia[m] = passa(m);
      }
      const resolver = () => {
        const fila = respostas[`${tabela}:${c.op}`];
        if (!fila || fila.length === 0) return { data: null, error: null };
        return fila.length > 1 ? fila.shift()! : fila[0]!;
      };
      cadeia.single = async () => resolver();
      cadeia.maybeSingle = async () => resolver();
      cadeia.then = (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => Promise.resolve(resolver()).then(ok, erro);
      return cadeia;
    },
    rpc: vi.fn(async (nome: string, args: unknown) => {
      rpcs.push({ nome, args });
      return nome === "encrypt_cpf" ? { data: "\\xcifra", error: null } : { data: null, error: null };
    }),
  };
}

function autorizado(role: "viewer" | "agent" | "manager" | "admin") {
  vi.mocked(requireRole).mockImplementation(async (min) => {
    const ordem = ["viewer", "agent", "manager", "admin"];
    if (ordem.indexOf(role) < ordem.indexOf(min)) {
      return { ok: false, response: new Response(null, { status: 403 }) } as never;
    }
    return { ok: true, user: { id: EU, idioma: "pt-BR" }, org: { orgId: ORG, name: "Clínica", role } } as never;
  });
}

function pedido(url: string, metodo: string, corpo?: unknown): NextRequest {
  return new NextRequest(`https://crm.exemplo${url}`, {
    method: metodo,
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  });
}

const CONTATO_SO_WHATSAPP = {
  id: CONTATO,
  name: "Maria",
  display_name: "Maria",
  phone_number: "+5511999990000",
  email: null,
  birthdate: null,
  cpf_hash: null,
};

beforeEach(() => {
  chamadas = [];
  rpcs = [];
  respostas = {};
  vi.mocked(audit).mockClear();
  vi.stubEnv("CPF_ENCRYPTION_KEY", "chave-de-teste-com-mais-de-16");
  vi.mocked(createClient).mockResolvedValue(falsoSupabase() as never);
});

describe("POST /api/v1/clinic/agendamentos/:id/chegada", () => {
  const rota = () => import("@/app/api/v1/clinic/agendamentos/[id]/chegada/route");
  const ctx = { params: Promise.resolve({ id: AGENDAMENTO }) };
  const chegar = async () => (await rota()).POST(pedido(`/api/v1/clinic/agendamentos/${AGENDAMENTO}/chegada`, "POST"), ctx);

  it("com a ficha obrigatória e a ficha incompleta: 422 ficha_incompleta com o que falta, nada gravado", async () => {
    autorizado("agent");
    responder("calendar_appointments:select", { data: { id: AGENDAMENTO, contact_id: CONTATO, status: "confirmed" } });
    responder("organizations:select", { data: { settings: { clinic: { ficha_obrigatoria: true } } } });
    responder("contacts:select", { data: CONTATO_SO_WHATSAPP });
    const res = await chegar();
    expect(res.status).toBe(422);
    const corpo = (await res.json()) as { error: { code: string; details: { faltando: string[] } } };
    expect(corpo.error.code).toBe("ficha_incompleta");
    expect(corpo.error.details.faltando).toContain("CPF");
    expect(corpo.error.details.faltando).toContain("Nome completo");
    expect(chamadas.some((c) => c.op === "insert")).toBe(false);
  });

  it("com a regra desligada registra a chegada mesmo com ficha incompleta", async () => {
    autorizado("agent");
    responder("calendar_appointments:select", { data: { id: AGENDAMENTO, contact_id: CONTATO, status: "confirmed" } });
    responder("organizations:select", { data: { settings: {} } });
    responder("clinic_appointment_arrivals:insert", { data: { id: "chegada", arrived_at: "2026-09-23T12:00:00Z" } });
    const res = await chegar();
    expect(res.status).toBe(201);
    const insert = chamadas.find((c) => c.op === "insert");
    expect(insert?.valor).toMatchObject({ organization_id: ORG, appointment_id: AGENDAMENTO, contact_id: CONTATO, registered_by: EU });
    expect(vi.mocked(audit)).toHaveBeenCalledWith(expect.objectContaining({ action: "clinic.chegada_registrada" }));
  });

  it("segunda chegada do mesmo agendamento devolve a primeira (idempotente)", async () => {
    autorizado("agent");
    responder("calendar_appointments:select", { data: { id: AGENDAMENTO, contact_id: CONTATO, status: "confirmed" } });
    responder("clinic_appointment_arrivals:select", { data: { id: "chegada", arrived_at: "2026-09-23T12:00:00Z" } });
    const res = await chegar();
    expect(res.status).toBe(200);
    expect(((await res.json()) as { data: { ja_registrada: boolean } }).data.ja_registrada).toBe(true);
  });

  it("agendamento sem paciente: 422", async () => {
    autorizado("agent");
    responder("calendar_appointments:select", { data: { id: AGENDAMENTO, contact_id: null, status: "confirmed" } });
    expect((await chegar()).status).toBe(422);
  });

  it("visualizador não registra chegada", async () => {
    autorizado("viewer");
    expect((await chegar()).status).toBe(403);
  });
});

describe("PUT /api/v1/clinic/pacientes/:contactId/ficha", () => {
  const rota = () => import("@/app/api/v1/clinic/pacientes/[contactId]/ficha/route");
  const ctx = { params: Promise.resolve({ contactId: CONTATO }) };
  const salvar = async (corpo: unknown) => (await rota()).PUT(pedido(`/api/v1/clinic/pacientes/${CONTATO}/ficha`, "PUT", corpo), ctx);

  it("CPF inválido é recusado antes de tocar no banco", async () => {
    autorizado("agent");
    const res = await salvar({ nome: "Maria da Silva", cpf: "111.111.111-11" });
    expect(res.status).toBe(422);
    expect(chamadas.length).toBe(0);
  });

  it("atendente grava: CPF vai como PAR hash + cifra no contato, o resto no perfil", async () => {
    autorizado("agent");
    responder("contacts:select", { data: CONTATO_SO_WHATSAPP });
    const res = await salvar({
      nome: "Maria da Silva",
      cpf: "529.982.247-25",
      nascimento: "1990-05-10",
      sexo: "feminino",
      cep: "01310-100",
      logradouro: "Avenida Paulista",
      numero: "1000",
      bairro: "Bela Vista",
      cidade: "São Paulo",
      uf: "sp",
      emergencia_nome: "João",
      emergencia_parentesco: "Irmão",
      emergencia_telefone: "(11) 98888-7777",
    });
    expect(res.status).toBe(200);
    expect(rpcs).toContainEqual({ nome: "encrypt_cpf", args: { p_plaintext: "52998224725", p_key: "chave-de-teste-com-mais-de-16" } });
    const contato = chamadas.find((c) => c.tabela === "contacts" && c.op === "update");
    expect(contato?.valor).toMatchObject({ name: "Maria da Silva", birthdate: "1990-05-10", cpf_encrypted: "\\xcifra" });
    expect((contato?.valor as { cpf_hash?: string }).cpf_hash).toMatch(/^[0-9a-f]{64}$/);
    const perfil = chamadas.find((c) => c.tabela === "clinic_patient_profiles" && c.op === "upsert");
    expect(perfil?.valor).toMatchObject({
      organization_id: ORG,
      contact_id: CONTATO,
      cep: "01310100",
      uf: "SP",
      emergency_phone: "+5511988887777",
    });
    expect(vi.mocked(audit)).toHaveBeenCalledWith(expect.objectContaining({ action: "clinic.ficha_salva" }));
  });

  it("telefone de emergência que não é telefone: 422", async () => {
    autorizado("agent");
    responder("contacts:select", { data: CONTATO_SO_WHATSAPP });
    expect((await salvar({ nome: "Maria da Silva", emergencia_telefone: "abc" })).status).toBe(422);
  });

  it("visualizador não grava a ficha", async () => {
    autorizado("viewer");
    expect((await salvar({ nome: "Maria da Silva" })).status).toBe(403);
  });
});
