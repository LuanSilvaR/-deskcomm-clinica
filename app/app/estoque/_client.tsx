"use client";

/**
 * FORK clinic (estoque E0) — o painel do estoque: Posição (produtos → lotes →
 * locais, com as ações), Movimentações (histórico com estorno), Pendências da
 * baixa pelo prontuário (E2) e Locais.
 */
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { LocaisDeEstoque } from "@/components/clinic/estoque/LocaisDeEstoque";
import { AlertasDoEstoque, useAlertasDoEstoque } from "@/components/clinic/estoque/AlertasDoEstoque";
import { ComprasNfe } from "@/components/clinic/estoque/ComprasNfe";
import { Inventarios } from "@/components/clinic/estoque/Inventarios";
import { Movimentacoes } from "@/components/clinic/estoque/Movimentacoes";
import { Pendencias } from "@/components/clinic/estoque/Pendencias";
import { RelatoriosDoEstoque } from "@/components/clinic/estoque/RelatoriosDoEstoque";
import { PosicaoDoEstoque } from "@/components/clinic/estoque/PosicaoDoEstoque";
import { CHAVE_DO_ESTOQUE, type DadosDoEstoque } from "@/components/clinic/estoque/tipos";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type Aba = "posicao" | "alertas" | "movimentacoes" | "pendencias" | "compras" | "inventario" | "relatorios" | "locais";

export function PainelDoEstoque() {
  const t = useT();
  const [aba, setAba] = useState<Aba>("posicao");
  const q = useQuery({
    queryKey: [...CHAVE_DO_ESTOQUE],
    queryFn: async () =>
      (await apiClient.get<{ data: DadosDoEstoque }>("/api/v1/clinic/estoque/posicao")).data,
  });
  const alertas = useAlertasDoEstoque(Boolean(q.data?.ligado));
  const nAlertas = alertas.data?.alertas.length ?? 0;

  if (q.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (q.isError || !q.data)
    return <p className="text-sm text-destructive">{t("Não foi possível ler o estoque.")}</p>;
  const d = q.data;
  if (!d.ligado) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm" data-testid="estoque-desligado">
        <p>{t("O estoque está desligado nesta clínica.")}</p>
        <Link href="/app/settings/tenant/profissionais" className="mt-1 inline-block underline">
          {t("Ligar em Configurações › Profissionais")}
        </Link>
      </div>
    );
  }

  const abas: Array<{ id: Aba; rotulo: string }> = [
    { id: "posicao", rotulo: "Posição" },
    { id: "alertas", rotulo: "Alertas" },
    { id: "movimentacoes", rotulo: "Movimentações" },
    { id: "pendencias", rotulo: "Pendências" },
    { id: "compras", rotulo: "Compras (NF-e)" },
    { id: "inventario", rotulo: "Inventário" },
    { id: "relatorios", rotulo: "Relatórios" },
    { id: "locais", rotulo: "Locais" },
  ].filter((a) => a.id !== "compras" || Boolean(d.pode.compras)) as Array<{ id: Aba; rotulo: string }>;
  return (
    <div className="space-y-4" data-testid="painel-do-estoque">
      <nav aria-label={t("Seções do estoque")} className="flex gap-1 border-b">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            aria-current={aba === a.id ? "page" : undefined}
            data-testid={`estoque-aba-${a.id}`}
            className={cn(
              "min-h-11 border-b-2 px-3 text-sm md:min-h-9",
              aba === a.id ? "border-primary font-medium" : "border-transparent text-text-muted",
            )}
          >
            {t(a.rotulo)}
            {a.id === "alertas" && nAlertas > 0 ? (
              <span className="ml-1 rounded-full bg-destructive px-1.5 text-xs text-white" data-testid="estoque-alertas-contador">
                {nAlertas}
              </span>
            ) : null}
          </button>
        ))}
      </nav>
      {aba === "posicao" ? <PosicaoDoEstoque dados={d} /> : null}
      {aba === "alertas" ? <AlertasDoEstoque /> : null}
      {aba === "movimentacoes" ? <Movimentacoes podeEstornar={d.pode.estornar} /> : null}
      {aba === "pendencias" ? <Pendencias dados={d} /> : null}
      {aba === "compras" ? <ComprasNfe podeComprar={Boolean(d.pode.compras)} /> : null}
      {aba === "inventario" ? <Inventarios locais={d.locais} /> : null}
      {aba === "relatorios" ? <RelatoriosDoEstoque /> : null}
      {aba === "locais" ? (
        <LocaisDeEstoque locais={d.locais} podeConfigurar={d.pode.configurar} />
      ) : null}
    </div>
  );
}
