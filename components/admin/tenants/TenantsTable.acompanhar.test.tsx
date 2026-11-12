/**
 * Fork #155 — a lista de tenants do /admin tem o botão "Acompanhar" em cada
 * linha; organização que não está ativa fica com o botão desligado.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("@/hooks/i18n/useLocaleDeData", () => ({ useTagDeIdioma: () => "pt-BR" }));
vi.mock("@/components/shell/OrganizationTransitionProvider", () => ({
  useOrganizationTransition: () => ({ begin: vi.fn(), cancel: vi.fn() }),
}));
vi.mock("@/components/app/ImpersonateBanner", () => ({ notifySupportTransition: vi.fn() }));

import { TenantsTable } from "./TenantsTable";

const linha = (id: string, nome: string, status: string) => ({
  id, slug: id, display_name: nome, legal_name: null, cnpj: null, status,
  onboarded_at: "2026-11-01T00:00:00Z", suspended_at: null, created_at: "2026-11-01T00:00:00Z",
  user_count: [{ count: 1 }], conversations_count: [{ count: 0 }],
});

describe("lista de tenants: Acompanhar em cada linha (#155)", () => {
  it("ativa = botão ligado; suspensa = desligado com o motivo", () => {
    render(
      <TenantsTable
        data={[linha("a", "Clínica Ativa", "active"), linha("s", "Clínica Suspensa", "suspended")]}
        hasNextPage={false}
        isFetchingNextPage={false}
        onLoadMore={() => {}}
      />,
    );
    const ativa = screen.getByRole("button", { name: "Acompanhar Clínica Ativa" }) as HTMLButtonElement;
    expect(ativa.disabled).toBe(false);
    const suspensa = screen.getByRole("button", { name: "Só dá para acompanhar organização ativa" }) as HTMLButtonElement;
    expect(suspensa.disabled).toBe(true);
  });
});
