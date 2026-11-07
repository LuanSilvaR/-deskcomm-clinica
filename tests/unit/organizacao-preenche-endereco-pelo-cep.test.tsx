/**
 * FORK clinic (8011) — em Configurações › Organização, o CEP completo preenche
 * o endereço da empresa sozinho (mesmo hook da ficha do paciente, #86), e o
 * Salvar manda telefone e CEP normalizados. A API é simulada; dados fictícios.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TenantForm } from "@/app/app/settings/tenant/_form";
import type { TenantInput } from "@/lib/schemas/settings";

const get = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: { get: (...a: unknown[]) => get(...a) },
}));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
const updateTenant = vi.fn();
vi.mock("@/app/actions/settings/updateTenant", () => ({
  updateTenant: (...a: unknown[]) => updateTenant(...a),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const INICIAL: TenantInput = {
  display_name: "Clinica Ficticia",
  legal_name: "Clinica Ficticia Ltda",
  cnpj: null,
  country: "BR",
  timezone: "America/Sao_Paulo",
  locale: "pt-BR",
  currency: "BRL",
  media_retention_days: 365,
  dpo_email: null,
  privacy_policy_url: null,
  contact_phone: null,
  address_cep: null,
  address_street: null,
  address_number: null,
  address_complement: null,
  address_district: null,
  address_city: null,
  address_uf: null,
  address_city_ibge_code: null,
};

let respostaDoCep: unknown;

beforeEach(() => {
  get.mockReset();
  updateTenant.mockReset().mockResolvedValue({ ok: true });
  toast.error.mockReset();
  respostaDoCep = {
    tipo: "encontrado",
    endereco: {
      cep: "01310100",
      logradouro: "Avenida Paulista",
      bairro: "Bela Vista",
      cidade: "São Paulo",
      uf: "SP",
      codigo_ibge: "3550308",
    },
  };
  get.mockImplementation(async () => ({ data: respostaDoCep }));
});

const valor = (rotulo: string) => (screen.getByLabelText(rotulo) as HTMLInputElement).value;

describe("Configurações › Organização — contato e endereço", () => {
  it("CEP completo preenche o endereço sem clique e mantém o número digitado", async () => {
    render(<TenantForm initial={INICIAL} />);
    fireEvent.change(screen.getByLabelText("Número"), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01310-10" } });
    expect(get).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01310-100" } });

    await waitFor(() => expect(valor("Logradouro")).toBe("Avenida Paulista"));
    expect(get).toHaveBeenCalledWith("/api/v1/clinic/cep/01310100");
    expect(valor("Bairro")).toBe("Bela Vista");
    expect(valor("Cidade")).toBe("São Paulo");
    expect(valor("UF")).toBe("SP");
    expect(valor("Número")).toBe("1000");
  });

  it("CEP não encontrado vira aviso e o endereço segue à mão", async () => {
    respostaDoCep = { tipo: "nao_encontrado" };
    render(<TenantForm initial={INICIAL} />);
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "99999999" } });
    await waitFor(() => expect(screen.getByTestId("org-cep-aviso").textContent).toContain("CEP não encontrado"));
    fireEvent.change(screen.getByLabelText("Logradouro"), { target: { value: "Rua Ficticia" } });
    expect(valor("Logradouro")).toBe("Rua Ficticia");
  });

  it("Salvar manda telefone e CEP só com dígitos, e o IBGE que veio do CEP", async () => {
    render(<TenantForm initial={INICIAL} />);
    fireEvent.change(screen.getByLabelText("Telefone de contato"), { target: { value: "(11) 3333-4444" } });
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01310-100" } });
    await waitFor(() => expect(valor("Logradouro")).toBe("Avenida Paulista"));
    fireEvent.change(screen.getByLabelText("Número"), { target: { value: "1000" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(updateTenant).toHaveBeenCalledTimes(1));
    expect(updateTenant.mock.calls[0]?.[0]).toMatchObject({
      contact_phone: "1133334444",
      address_cep: "01310100",
      address_street: "Avenida Paulista",
      address_number: "1000",
      address_uf: "SP",
      address_city_ibge_code: "3550308",
    });
  });

  it("telefone sem DDD não salva e diz o motivo", async () => {
    render(<TenantForm initial={INICIAL} />);
    fireEvent.change(screen.getByLabelText("Telefone de contato"), { target: { value: "3333-4444" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Telefone com DDD."));
    expect(updateTenant).not.toHaveBeenCalled();
  });
});
