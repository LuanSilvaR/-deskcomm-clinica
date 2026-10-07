"use client";

/**
 * FORK clinic (financeiro FN2) — as regras do financeiro da clínica: sobre que
 * valor a comissão é calculada (líquido da taxa, padrão, ou bruto) e a margem
 * mínima que dispara o alerta no fechamento da comanda.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { ConfigFinanceiro } from "@/lib/clinic/financeiro/servidor";

const SELECT = "h-11 rounded-md border bg-surface px-2 text-sm md:h-9";
const CHAVE = ["clinic", "financeiro", "config"] as const;

export function RegrasDoFinanceiro({ podeConfigurar }: { podeConfigurar: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: [...CHAVE],
    queryFn: async () => (await apiClient.get<{ data: ConfigFinanceiro }>("/api/v1/clinic/financeiro/config")).data,
  });
  if (!q.data) return null;
  return <Formulario inicial={q.data} podeConfigurar={podeConfigurar} aoSalvar={() => void qc.invalidateQueries({ queryKey: [...CHAVE] })} t={t} />;
}

function Formulario({
  inicial,
  podeConfigurar,
  aoSalvar,
  t,
}: {
  inicial: ConfigFinanceiro;
  podeConfigurar: boolean;
  aoSalvar: () => void;
  t: (s: string) => string;
}) {
  const [base, setBase] = useState(inicial.comissao_base);
  const [margem, setMargem] = useState(String(inicial.margem_minima_pct));
  const salvar = useMutation({
    mutationFn: () =>
      apiClient.patch("/api/v1/clinic/financeiro/config", {
        comissao_base: base,
        margem_minima_pct: Number(margem.replace(",", ".")),
      }),
    onSuccess: aoSalvar,
    onError: showApiError,
  });
  const editar = podeConfigurar && inicial.ligado;
  return (
    <section className="space-y-3" aria-labelledby="fin-regras-titulo" data-testid="fin-regras">
      <h2 id="fin-regras-titulo" className="text-lg font-semibold">
        {t("Regras do financeiro")}
      </h2>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          salvar.mutate();
        }}
      >
        <label className="space-y-1 text-xs">
          <span className="block font-medium">{t("Comissão calculada sobre")}</span>
          <select className={SELECT} value={base} disabled={!editar} onChange={(e) => setBase(e.target.value as typeof base)} data-testid="fin-comissao-base">
            <option value="liquido">{t("o valor líquido (depois da taxa da maquininha)")}</option>
            <option value="bruto">{t("o valor cobrado (bruto)")}</option>
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="block font-medium">{t("Margem mínima para alerta (%)")}</span>
          <Input value={margem} disabled={!editar} onChange={(e) => setMargem(e.target.value)} className="h-11 w-24 md:h-9" />
        </label>
        {editar ? (
          <Button type="submit" size="sm" disabled={salvar.isPending}>
            {t("Salvar")}
          </Button>
        ) : null}
      </form>
    </section>
  );
}
