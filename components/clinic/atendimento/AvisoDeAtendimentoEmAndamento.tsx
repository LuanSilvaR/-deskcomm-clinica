"use client";

/**
 * FORK clinic (agenda S5, PF10) — "Atendimento em andamento", em qualquer tela,
 * para o profissional que tem um atendimento aberto: quem saiu do prontuário
 * para olhar outra coisa volta com um clique (e não esquece de finalizar).
 *
 * Lê a mesma fila do "Meu dia" (só a própria agenda). Some na tela do próprio
 * atendimento e no "Meu dia", que já mostram o cartão.
 */
import { QueryClientContext, useQuery } from "@tanstack/react-query";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useT } from "@/hooks/i18n/useT";
import { useUsuarioIdOpcional } from "@/hooks/auth/AuthProvider";
import { apiClient } from "@/lib/api/client";
import { usePermissoes } from "@/lib/clinic/acesso/use-permissoes";
import { CASA_DO_PROFISSIONAL } from "@/lib/clinic/acesso/experiencia";
import type { ItemNaFila, SecaoDaFila } from "@/lib/clinic/atendimento/fila";
import { Stethoscope } from "@/lib/ui/icons";

interface RespostaDaFila {
  fila: Record<SecaoDaFila, ItemNaFila[]>;
}

export function AvisoDeAtendimentoEmAndamento() {
  // Casca montada sem QueryClient (testes da casca, telas fora do provedor): nada a avisar.
  if (!React.useContext(QueryClientContext)) return null;
  return <Aviso />;
}

function Aviso() {
  const t = useT();
  const pathname = usePathname();
  const usuarioId = useUsuarioIdOpcional();
  const { can } = usePermissoes();
  const ativo = can("atendimento.iniciar") && !!usuarioId;

  const consulta = useQuery({
    queryKey: ["clinic", "atendimentos", "fila", "meus"],
    queryFn: async () => (await apiClient.get<{ data: RespostaDaFila }>("/api/v1/clinic/atendimentos/fila")).data,
    enabled: ativo,
    refetchInterval: 60_000,
  });
  if (!ativo || !consulta.data) return null;

  const meu = consulta.data.fila.em_atendimento.find(
    (i) => i.atendimento_id && (!i.profissional_id || i.profissional_id === usuarioId),
  );
  if (!meu?.atendimento_id) return null;
  const destino = `/app/atendimentos/${meu.atendimento_id}`;
  if (pathname === destino || pathname === CASA_DO_PROFISSIONAL) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 border-b border-accent bg-accent-soft px-6 py-2 text-sm"
      data-testid="aviso-atendimento-em-andamento"
    >
      <span className="flex items-center gap-2">
        <Stethoscope size={16} weight="bold" aria-hidden className="text-accent" />
        <strong>{t("Atendimento em andamento")}</strong>
        <span className="text-text-muted">{meu.paciente ?? t("Paciente")}</span>
      </span>
      <Link href={destino} className="font-medium underline underline-offset-2" data-testid="aviso-atendimento-continuar">
        {t("Continuar atendimento")}
      </Link>
    </div>
  );
}
