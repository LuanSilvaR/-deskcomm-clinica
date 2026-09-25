"use client";
/**
 * FORK clinic (9014) — liga/desliga o menu por módulos da clínica.
 *
 * Só aparece para quem administra; quem decide de verdade é
 * `PATCH /api/v1/clinic/config` → `fn_clinic_definir_menu_clinica` (admin,
 * suporte com escrita e MFA). Depois de salvar, `router.refresh()` refaz o
 * layout e o menu lateral troca na mesma tela.
 */
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

export function AlternarMenuDaClinica({ ligado }: { ligado: boolean }) {
  const t = useT();
  const router = useRouter();
  const alternar = useMutation({
    mutationFn: (valor: boolean) =>
      apiClient.patch<{ data: { menu_clinica: boolean } }>("/api/v1/clinic/config", { menu_clinica: valor }),
    onSuccess: () => router.refresh(),
    onError: showApiError,
  });

  return (
    <section
      data-testid="clinic-menu-da-clinica"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${ligado ? "" : "bg-muted"}`}
    >
      <div>
        <p className="font-medium">
          {ligado ? t("Menu organizado por módulos da clínica") : t("Experimente o menu da clínica")}
        </p>
        <p className="text-sm text-text-muted">
          {ligado
            ? t("Todas as telas continuam onde a equipe tem acesso. Desligue para voltar ao menu anterior.")
            : t("O menu lateral passa a mostrar Agenda, Pacientes, Financeiro e os demais módulos. Nenhum acesso muda.")}
        </p>
      </div>
      <Button
        data-testid="clinic-menu-da-clinica-alternar"
        variant={ligado ? "outline" : "default"}
        disabled={alternar.isPending}
        onClick={() => alternar.mutate(!ligado)}
      >
        {ligado ? t("Voltar ao menu anterior") : t("Ligar o menu da clínica")}
      </Button>
    </section>
  );
}
