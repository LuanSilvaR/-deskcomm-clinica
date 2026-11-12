"use client";
import Link from "next/link";
import { useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import { useOrganizationTransition } from "./OrganizationTransitionProvider";
import { CaretDown, Storefront } from "@/lib/ui/icons";
import { useUser, useActiveOrg } from "@/hooks/auth/AuthProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ImpersonateButton } from "@/components/admin/ImpersonateButton";
import { useAdminTenants } from "@/hooks/useAdminTenants";
import { roleAtLeast } from "@/lib/auth/types";

/** Fork #155: nome do cargo quando o administrador da plataforma é membro com cargo menor que admin. */
const CARGO: Record<string, string> = { viewer: "Visualizador", agent: "Atendente", manager: "Gerente" };
import { Button } from "@/components/ui/button";
import { setActiveOrg } from "@/app/actions/shell/setActiveOrg";

export function TenantSwitcher() {
  const t = useT();
  const user = useUser();
  const active = useActiveOrg();
  const transition = useOrganizationTransition();
  const [isPending, setPending] = useState(false);
  // Fork #155: o administrador da plataforma acompanha qualquer organização
  // ativa direto daqui. A lista só é buscada com o menu aberto (o conteúdo do
  // menu só monta aberto), e o acompanhamento passa pela mesma rota da ficha
  // (auditoria, MFA, 1 hora). O diálogo mora FORA do menu: o menu fecha ao
  // escolher e desmontaria a confirmação junto.
  const [alvo, setAlvo] = useState<{ id: string; nome: string } | null>(null);
  const podeAcompanhar = user.is_platform_admin && !user.support;
  const switchTo = async (orgId: string) => {
    if (orgId === active?.orgId) return;
    flushSync(() => { setPending(true); transition.begin(t("Carregando organização…")); });
    try {
      const result = await setActiveOrg(orgId);
      if (!result.ok) throw new Error(result.error);
      // Novo documento elimina QueryClient, subscriptions e respostas em voo.
      window.location.assign("/app/inbox");
    } catch {
      transition.cancel();
      setPending(false);
      toast.error(t("Não foi possível trocar de organização. Seu acesso pode ter mudado. Tente novamente."));
    }
  };

  if (user.organizations.length <= 1 && !user.is_platform_admin) return null;

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/*
          ⚠️ NO CELULAR ESTE BOTÃO É SÓ O ÍCONE, e isso não é economia de estilo:
          é o que faz o cabeçalho caber.

          Medido na tela, numa instalação real em 360px: com o nome escrito, o
          botão ocupava 153px e o cabeçalho tinha 14 sobreposições, a pior de
          96px — o nome da organização por baixo do campo de busca, e a busca por
          cima do sino. Hambúrguer + nome + busca + sino + avatar não cabem em
          360px, e o bloco do meio é `flex-1 justify-center` entre dois
          `shrink-0`: quando falta espaço ele transborda por cima dos vizinhos em
          vez de encolher.

          Só o ícone: 40px, e as sobreposições vão a zero. O nome completo
          continua a UM TOQUE, dentro do menu que este botão já abre — e
          continua no `aria-label`, para quem usa leitor de tela.

          `min-w-0` sozinho NÃO resolve (medido): ele deixa o flex comprimir o
          texto, mas a 18px visíveis o nome vira "M…", e as colisões de 13px com
          a busca continuam. O espaço é que não existe.
        */}
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending || !!user.support}
          className="gap-2"
          aria-label={`${t("Organização")}: ${active?.name ?? t("Selecionar org")}`}
          title={user.support ? "Saia do acompanhamento para trocar de organização" : undefined}
          data-testid="tenant-switcher"
        >
          <Storefront size={16} weight="duotone" aria-hidden />
          <span className="hidden max-w-[160px] truncate md:inline">
            {active?.name ?? "Selecionar org"}
          </span>
          <CaretDown size={12} aria-hidden className="hidden md:inline" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        {user.organizations.map((org) => (
          <DropdownMenuItem
            key={org.organization_id}
            data-testid={`tenant-switcher-item-${org.organization_id}`}
            onClick={() => { void switchTo(org.organization_id); }}
            className="flex items-center justify-between"
          >
            <span className="truncate">{org.organization_name}</span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              {user.is_platform_admin && !roleAtLeast(org.role, "admin") && (
                <span data-testid={`tenant-switcher-cargo-${org.organization_id}`}>{t(CARGO[org.role] ?? org.role)}</span>
              )}
              {active?.orgId === org.organization_id && <span>✓</span>}
            </span>
          </DropdownMenuItem>
        ))}
        {podeAcompanhar && <AcompanharComoAdministrador onEscolher={setAlvo} />}
        {user.is_platform_admin && <DropdownMenuItem asChild>
          <Link href="/admin/tenants">{t("Gerenciar organizações")}</Link>
        </DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
    {alvo && (
      <ImpersonateButton
        organizationId={alvo.id}
        displayName={alvo.nome}
        open
        onOpenChange={(v) => { if (!v) setAlvo(null); }}
      />
    )}
    </>
  );
}

/** Fork #155: só monta para administrador da plataforma e com o menu aberto. */
function AcompanharComoAdministrador({ onEscolher }: { onEscolher: (alvo: { id: string; nome: string }) => void }) {
  const t = useT();
  const tenants = useAdminTenants({ status: "active" });
  const ativas = (tenants.data?.pages.flatMap((p) => p.data ?? []) ?? []).filter((o) => o.status === "active");
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        {t("Acompanhar como administrador (todos os menus)")}
      </DropdownMenuLabel>
      {tenants.isLoading && <DropdownMenuItem disabled>{t("Carregando...")}</DropdownMenuItem>}
      {ativas.map((o) => (
        <DropdownMenuItem
          key={o.id}
          data-testid={`tenant-switcher-acompanhar-${o.id}`}
          onClick={() => onEscolher({ id: o.id, nome: o.display_name })}
        >
          <span className="truncate">{o.display_name}</span>
        </DropdownMenuItem>
      ))}
    </>
  );
}
