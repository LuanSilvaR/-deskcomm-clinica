"use client";

/**
 * FORK clinic (agenda S7 #70) — o menu ⋮ de um compromisso na lista do dia.
 *
 * Abrir (remarcar/cancelar/confirmar ficam no detalhe, com as chaves da S6a) ·
 * Ficha do paciente (`pacientes.ver`) · Conversar no WhatsApp (`conversas.responder`:
 * abre — ou cria — a conversa do paciente no Inbox; nenhum envio automático) ·
 * Copiar resumo. Item sem permissão não aparece.
 */
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { usePermissoes } from "@/lib/clinic/acesso/use-permissoes";
import { DotsThree } from "@/lib/ui/icons";

export function MenuDoCompromisso({
  id,
  pacienteId,
  resumo,
  onAbrir,
}: {
  id: string;
  pacienteId: string | null;
  /** O texto de "Copiar resumo" (paciente · dia/hora · profissional). */
  resumo: string;
  onAbrir: (id: string) => void;
}) {
  const t = useT();
  const router = useRouter();
  const { can } = usePermissoes();

  const conversar = async () => {
    if (!pacienteId) return;
    try {
      const r = await apiClient.post<{ data: { conversation_id: string } }>("/api/v1/conversations/open-with-contact", { contact_id: pacienteId });
      router.push(`/app/inbox?id=${r.data.conversation_id}`);
    } catch {
      toast.error(t("Não foi possível abrir a conversa."));
    }
  };
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(resumo);
      toast.success(t("Resumo copiado."));
    } catch {
      toast.error(t("Não consegui copiar agora."));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" data-testid={`menu-do-compromisso-${id}`} aria-label={t("Mais ações do agendamento")}>
          <DotsThree aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem data-testid="menu-abrir" onSelect={() => onAbrir(id)}>
          {t("Abrir (confirmar, remarcar ou cancelar)")}
        </DropdownMenuItem>
        {pacienteId && can("pacientes.ver") ? (
          <DropdownMenuItem data-testid="menu-ficha" onSelect={() => router.push(`/app/contacts/${pacienteId}`)}>
            {t("Ficha do paciente")}
          </DropdownMenuItem>
        ) : null}
        {pacienteId && can("conversas.responder") ? (
          <DropdownMenuItem data-testid="menu-whatsapp" onSelect={() => void conversar()}>
            {t("Conversar no WhatsApp")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem data-testid="menu-copiar" onSelect={() => void copiar()}>
          {t("Copiar resumo")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
