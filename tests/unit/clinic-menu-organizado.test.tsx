/**
 * FORK clinic (organização do menu, 2026-10) — a superfície do menu da clínica:
 *
 *  - uma linha por módulo, cada uma um LINK (sem acordeão), na ordem pedida;
 *  - "Em breve" não ocupa o menu (Ponto, Notificações, Notas fiscais);
 *  - o módulo da tela aberta tem `aria-current="page"`;
 *  - as abas do módulo aparecem no topo com a tela ativa marcada, e somem com
 *    o menu da clínica desligado.
 * A regra de quem vê o quê é de `modulosVisiveis` (lib/clinic/navegacao/modulos.test.ts).
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AbasDoModulo } from "@/components/clinic/navegacao/AbasDoModulo";
import { NavDaClinica } from "@/components/clinic/navegacao/MenuDaClinica";

const estado: { pathname: string; menu: boolean } = { pathname: "/app/agenda/faltas", menu: true };

vi.mock("@/hooks/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { is_platform_admin: false, support: null },
    activeOrg: { orgId: "org-1", name: "Org", role: "admin", menu_clinica: estado.menu },
  }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => estado.pathname }));

afterEach(cleanup);

describe("menu da clínica organizado", () => {
  it("uma linha por módulo, todas links, sem 'Em breve', na ordem pedida", () => {
    estado.pathname = "/app/agenda/faltas";
    render(<NavDaClinica collapsed={false} />);
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(within(nav).queryAllByRole("button")).toHaveLength(0);
    const nomes = within(nav)
      .getAllByRole("link")
      .map((l) => l.textContent?.trim());
    expect(nomes).toEqual([
      "Início",
      "Agenda",
      "Atendimento",
      "Pacientes",
      "Contratos e termos",
      "Procedimentos",
      "Estoque",
      "Salas e equipamentos",
      "Profissionais",
      "Financeiro",
      "Comissões",
      "Tarefas",
      "Marketing",
      "Agente de IA",
    ]);
    expect(within(nav).queryByText("Em breve")).toBeNull();
  });

  it("o módulo da tela aberta fica marcado e leva à primeira tela do módulo", () => {
    estado.pathname = "/app/agenda/faltas";
    render(<NavDaClinica collapsed={false} />);
    const agenda = screen.getByRole("link", { name: "Agenda" });
    expect(agenda).toHaveAttribute("aria-current", "page");
    expect(agenda).toHaveAttribute("href", "/app/agenda");
    expect(screen.getByRole("link", { name: "Pacientes" })).not.toHaveAttribute("aria-current");
  });

  it("abas do módulo: as telas da Agenda, com Faltas ativa, e a visão geral", () => {
    estado.pathname = "/app/agenda/faltas";
    estado.menu = true;
    render(<AbasDoModulo />);
    const abas = screen.getByTestId("abas-do-modulo");
    expect(within(abas).getByRole("link", { name: "Faltas" })).toHaveAttribute("aria-current", "page");
    expect(within(abas).getByRole("link", { name: "Visão geral" })).toHaveAttribute("href", "/app/inicio/agenda");
  });

  it("sem o menu da clínica, nenhuma aba", () => {
    estado.pathname = "/app/agenda/faltas";
    estado.menu = false;
    render(<AbasDoModulo />);
    expect(screen.queryByTestId("abas-do-modulo")).toBeNull();
    estado.menu = true;
  });
});
