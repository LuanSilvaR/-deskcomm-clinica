/**
 * FORK clinic (#86): a ficha cadastral do paciente entra no pedido de acesso (LGPD).
 *
 * A anonimização apaga `clinic_patient_profiles` (migration 9002); o que se apaga
 * a pedido do titular é o que se entrega a pedido dele. Sem dado de terceiro
 * cifrado (CPF do responsável) e sem ficha de outro paciente ou outra empresa.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mock.admin }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));
import { collectExportData } from "@/lib/lgpd/export-collector";
import { linhasDaFicha } from "@/lib/lgpd/pdf-renderer";

type Row = Record<string, unknown>;
const ORG = "tenant-a",
  OTHER_ORG = "tenant-b",
  CONTACT = "contact-a",
  OTHER_CONTACT = "contact-b";
const request = { organizationId: ORG, requestId: "export-1", contactId: CONTACT, externalCustomerId: null };
let rows: Record<string, Row[]>;
const reads: { table: string; columns: string; range: [number, number] }[] = [];

/** Executa filtros e projeção do coletor sobre linhas de donos misturados. */
class ReadQuery {
  columns = "";
  filters: [string, unknown][] = [];
  page: [number, number] = [0, 1000];
  constructor(readonly table: string) {}
  select(columns: string) {
    this.columns = columns;
    return this;
  }
  eq(key: string, value: unknown) {
    this.filters.push([key, value]);
    return this;
  }
  order() {
    return this;
  }
  limit(limit: number) {
    this.page = [0, limit - 1];
    return this;
  }
  range(from: number, to: number) {
    this.page = [from, to];
    return this;
  }
  or() {
    return this;
  }
  async maybeSingle() {
    const result = await this.execute();
    return { ...result, data: result.data?.[0] ?? null };
  }
  then(resolve: (result: unknown) => unknown, reject?: (error: unknown) => unknown) {
    return this.execute().then(resolve, reject);
  }
  async execute() {
    reads.push({ table: this.table, columns: this.columns, range: this.page });
    const data = (rows[this.table] ?? [])
      .filter((row) => this.filters.every(([key, value]) => row[key] === value))
      .slice(this.page[0], this.page[1] + 1)
      .map((row) =>
        Object.fromEntries(
          this.columns
            .split(",")
            .map((column) => column.trim())
            .map((column) => [column, row[column]]),
        ),
      );
    return { data, error: null };
  }
}


function ficha(organization_id: string, contact_id: string, over: Row = {}): Row {
  return {
    organization_id,
    contact_id,
    social_name: null,
    sex: "feminino",
    rg: "1234567",
    rg_issuer: "SSP",
    rg_uf: "SP",
    profession: "Designer",
    marital_status: "solteiro",
    referral_source: "Indicação",
    cep: "01001000",
    street: "Rua de Teste",
    number: "100",
    complement: "Sala 2",
    district: "Centro",
    city: "São Paulo",
    uf: "SP",
    emergency_name: "Contato de emergência de teste",
    emergency_relationship: "irmã",
    emergency_phone: "+5511900000000",
    guardian_name: null,
    guardian_relationship: null,
    guardian_cpf_encrypted: "CIFRADO-DE-TERCEIRO",
    completed_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-02T00:00:00Z",
    ...over,
  };
}

beforeEach(() => {
  reads.length = 0;
  rows = {
    organizations: [{ id: ORG, legal_name: "Empresa Teste", display_name: "Teste", dpo_email: null }],
    contacts: [{ id: CONTACT, organization_id: ORG, name: "Paciente de teste", created_at: "2026-09-15T00:00:00Z" }],
    clinic_patient_profiles: [
      ficha(ORG, CONTACT),
      ficha(ORG, OTHER_CONTACT, { street: "Rua do Vizinho" }),
      ficha(OTHER_ORG, CONTACT, { street: "Rua da Outra Empresa" }),
    ],
  };
  mock.admin.mockReturnValue({ from: (table: string) => new ReadQuery(table) });
});

describe("LGPD: a ficha do paciente no pedido de acesso (#86)", () => {
  it("⭐ entrega a ficha do titular, nesta empresa, com o endereço", async () => {
    const payload = await collectExportData(request);
    expect(payload.ficha_clinica).toEqual(
      expect.objectContaining({ street: "Rua de Teste", cep: "01001000", city: "São Paulo", emergency_phone: "+5511900000000" }),
    );
  });

  it("não lê o CPF cifrado do responsável (dado de terceiro)", async () => {
    await collectExportData(request);
    const leitura = reads.find((r) => r.table === "clinic_patient_profiles");
    expect(leitura?.columns).toBeTruthy();
    expect(leitura!.columns).not.toContain("guardian_cpf");
  });

  it("sem ficha, o campo vem nulo e o resto do relatório segue", async () => {
    rows.clinic_patient_profiles = [];
    const payload = await collectExportData(request);
    expect(payload.ficha_clinica).toBeNull();
    expect(payload.contact).not.toBeNull();
  });

  it("o PDF lista só o que foi preenchido, com o RG mascarado", () => {
    const linhas = Object.fromEntries(linhasDaFicha(ficha(ORG, CONTACT) as never));
    expect(linhas["Endereço"]).toBe("Rua de Teste, 100, Sala 2, Centro, São Paulo, SP, 01001000");
    expect(linhas["RG"]).toBe("***567 (SSP/SP)");
    expect(linhas["Nome social"]).toBeUndefined();
    expect(linhas["Responsável"]).toBeUndefined();
  });
});
