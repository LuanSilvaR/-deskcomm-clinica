/**
 * #86 — na ficha do paciente, o CEP completo preenche o endereço sozinho, sem
 * clique; CEP não encontrado ou serviço fora do ar viram aviso e o endereço
 * continua editável à mão. A API é simulada; dados fictícios.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FichaDoPaciente } from "@/components/clinic/FichaDoPaciente";

const get = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: { get: (...a: unknown[]) => get(...a), put: vi.fn() },
}));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("@/components/feedback/ApiErrorToast", () => ({ showApiError: vi.fn() }));

const FICHA = {
  contato: {
    id: "c-1",
    name: "Paciente Ficticio",
    display_name: null,
    phone_number: "+5500000000000",
    email: null,
    birthdate: "1990-01-01",
    tem_cpf: false,
  },
  perfil: null,
  situacao: { completa: false, faltando: ["CEP"], menorDeIdade: false },
};

let respostaDoCep: unknown;

beforeEach(() => {
  get.mockReset();
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
  get.mockImplementation(async (url: string) => {
    if (url.startsWith("/api/v1/clinic/cep/")) return { data: respostaDoCep };
    return { data: FICHA };
  });
});

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <FichaDoPaciente contactId="c-1" podeEditar />
    </QueryClientProvider>,
  );
}

const valor = (rotulo: string) => (screen.getByLabelText(rotulo) as HTMLInputElement).value;

describe("ficha do paciente — endereço pelo CEP", () => {
  it("CEP completo preenche logradouro, bairro, cidade, UF e IBGE, sem clique, e mantém o número", async () => {
    montar();
    await screen.findByLabelText("CEP");
    fireEvent.change(screen.getByLabelText("Número"), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01310-10" } });
    expect(get).not.toHaveBeenCalledWith("/api/v1/clinic/cep/0131010");
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01310-100" } });

    await waitFor(() => expect(valor("Logradouro")).toBe("Avenida Paulista"));
    expect(get).toHaveBeenCalledWith("/api/v1/clinic/cep/01310100");
    expect(valor("Bairro")).toBe("Bela Vista");
    expect(valor("Cidade")).toBe("São Paulo");
    expect(valor("UF")).toBe("SP");
    expect(valor("Código IBGE do município (opcional)")).toBe("3550308");
    expect(valor("Número")).toBe("1000");
    expect(screen.getByTestId("ficha-cep-aviso").textContent).toBe("");
  });

  it("CEP não encontrado mostra o aviso e deixa o endereço para preencher à mão", async () => {
    respostaDoCep = { tipo: "nao_encontrado" };
    montar();
    await screen.findByLabelText("CEP");
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "99999999" } });

    await waitFor(() =>
      expect(screen.getByTestId("ficha-cep-aviso").textContent).toContain("CEP não encontrado"),
    );
    fireEvent.change(screen.getByLabelText("Logradouro"), { target: { value: "Rua Ficticia" } });
    expect(valor("Logradouro")).toBe("Rua Ficticia");
  });

  it("serviço fora do ar vira aviso, não erro", async () => {
    respostaDoCep = { tipo: "indisponivel" };
    montar();
    await screen.findByLabelText("CEP");
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01310100" } });

    await waitFor(() =>
      expect(screen.getByTestId("ficha-cep-aviso").textContent).toContain("Não foi possível consultar o CEP"),
    );
  });
});
