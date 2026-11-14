/**
 * Fork #155 — o administrador da plataforma acompanha qualquer organização
 * ativa a partir do seletor de empresa, e vê com que cargo entra em cada uma.
 * Usuário comum não vê nada novo e não dispara a busca de tenants.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ user: {} as Record<string, unknown>, tenants: vi.fn() }));
vi.mock("@/hooks/auth/AuthProvider", () => ({
  useUser: () => h.user,
  useActiveOrg: () => ({ orgId: "a", name: "Farias" }),
}));
vi.mock("./OrganizationTransitionProvider", () => ({
  useOrganizationTransition: () => ({ begin: vi.fn(), cancel: vi.fn() }),
}));
vi.mock("@/components/app/ImpersonateBanner", () => ({ notifySupportTransition: vi.fn() }));
vi.mock("@/app/actions/shell/setActiveOrg", () => ({ setActiveOrg: vi.fn() }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("@/hooks/useAdminTenants", () => ({ useAdminTenants: h.tenants }));

import { TenantSwitcher } from "./TenantSwitcher";

const abrir = () => fireEvent.pointerDown(screen.getByTestId("tenant-switcher"), { button: 0, ctrlKey: false, pointerId: 1 });
const membros = [
  { organization_id: "a", organization_name: "Farias", role: "admin" },
  { organization_id: "b", organization_name: "Bella Vista", role: "manager" },
];

beforeEach(() => {
  vi.resetAllMocks();
  h.tenants.mockReturnValue({
    isLoading: false,
    data: { pages: [{ data: [
      { id: "b", display_name: "Bella Vista", status: "active" },
      { id: "c", display_name: "Clínica Sem Vínculo", status: "active" },
    ] }] },
  });
});

describe("seletor: acompanhar como administrador (#155)", () => {
  it("administrador da plataforma vê todas as organizações ativas, inclusive sem vínculo", async () => {
    h.user = { organizations: membros, is_platform_admin: true, support: null };
    render(<TenantSwitcher />);
    abrir();
    expect(await screen.findByText("Acompanhar como administrador (todos os menus)")).toBeTruthy();
    expect(screen.getByTestId("tenant-switcher-acompanhar-c").textContent).toContain("Clínica Sem Vínculo");
    expect(h.tenants).toHaveBeenCalledWith({ status: "active" });
  });

  it("mostra o cargo quando ele é membro com cargo menor que admin", async () => {
    h.user = { organizations: membros, is_platform_admin: true, support: null };
    render(<TenantSwitcher />);
    abrir();
    expect((await screen.findByTestId("tenant-switcher-cargo-b")).textContent).toBe("Gerente");
    expect(screen.queryByTestId("tenant-switcher-cargo-a")).toBeNull();
  });

  it("escolher uma organização abre a confirmação do acompanhamento", async () => {
    h.user = { organizations: membros, is_platform_admin: true, support: null };
    render(<TenantSwitcher />);
    abrir();
    fireEvent.click(await screen.findByTestId("tenant-switcher-acompanhar-c"));
    expect(await screen.findByText("Iniciar acompanhamento?")).toBeTruthy();
    expect(screen.getByText("Confirmar e entrar")).toBeTruthy();
  });

  it("usuário comum não vê a seção nem busca tenants", async () => {
    h.user = { organizations: membros, is_platform_admin: false, support: null };
    render(<TenantSwitcher />);
    abrir();
    await screen.findByTestId("tenant-switcher-item-b");
    expect(screen.queryByText("Acompanhar como administrador (todos os menus)")).toBeNull();
    expect(screen.queryByTestId("tenant-switcher-cargo-b")).toBeNull();
    expect(h.tenants).not.toHaveBeenCalled();
  });
});
