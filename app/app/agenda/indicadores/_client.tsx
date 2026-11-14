"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { usePessoasDaAgenda } from "@/hooks/agenda/usePessoasDaAgenda";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { Indicadores } from "@/lib/clinic/agenda/indicadores";

const PERIODOS = [7, 30, 90] as const;

function Cartao({ titulo, valor, detalhe, testid }: { titulo: string; valor: string; detalhe?: string; testid: string }) {
  return (
    <div className="rounded-xl border p-4" data-testid={testid}>
      <p className="text-sm text-text-muted">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold" data-testid={`${testid}-valor`}>
        {valor}
      </p>
      {detalhe ? <p className="mt-1 text-xs text-text-muted">{detalhe}</p> : null}
    </div>
  );
}

export function IndicadoresDaAgenda() {
  const t = useT();
  const tag = useTagDeIdioma();
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(30);
  const { data: pessoas = [] } = usePessoasDaAgenda();
  const consulta = useQuery({
    queryKey: ["clinic", "indicadores", dias],
    queryFn: async () => (await apiClient.get<{ data: Indicadores }>(`/api/v1/clinic/indicadores?dias=${dias}`)).data,
  });

  const pct = (v: number | null) => (v === null ? "—" : new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits: 0 }).format(v));
  const min = (v: number | null) => (v === null ? "—" : `${v} min`);
  const nome = (id: string) => pessoas.find((p) => p.id === id)?.nome ?? t("Profissional");

  return (
    <div className="space-y-4" data-testid="indicadores-da-agenda">
      <div className="flex gap-2" role="group" aria-label={t("Período")}>
        {PERIODOS.map((p) => (
          <button
            key={p}
            type="button"
            data-testid={`periodo-${p}`}
            aria-pressed={dias === p}
            className={`rounded-full border px-3 py-1 text-sm ${dias === p ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            onClick={() => setDias(p)}
          >
            {t("Últimos")} {p} {t("dias")}
          </button>
        ))}
      </div>

      {consulta.isLoading ? (
        <p className="text-sm text-text-muted">{t("Carregando…")}</p>
      ) : consulta.isError || !consulta.data ? (
        <p className="text-sm text-destructive">{t("Não foi possível carregar os indicadores.")}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Cartao
              testid="indicador-faltas"
              titulo={t("Taxa de faltas")}
              valor={pct(consulta.data.taxa_de_faltas)}
              detalhe={`${t("Faltas")}: ${consulta.data.faltas} · ${t("Realizados")}: ${consulta.data.realizados}`}
            />
            <Cartao
              testid="indicador-sem-registro"
              titulo={t("Sem registro")}
              valor={String(consulta.data.sem_registro)}
              detalhe={t("Compromissos passados sem \"Compareceu\" nem \"Faltou\".")}
            />
            <Cartao
              testid="indicador-espera"
              titulo={t("Espera média na recepção")}
              valor={min(consulta.data.espera_media_min)}
              detalhe={`${t("Atendimento médio")}: ${min(consulta.data.atendimento_medio_min)}`}
            />
            <Cartao
              testid="indicador-confirmacao"
              titulo={t("Confirmaram pelo WhatsApp")}
              valor={
                consulta.data.confirmacao.pedidos === 0
                  ? "—"
                  : pct(consulta.data.confirmacao.confirmados / consulta.data.confirmacao.pedidos)
              }
              detalhe={`${consulta.data.confirmacao.recusados} ${t("pediram para remarcar")} · ${consulta.data.confirmacao.sem_resposta} ${t("sem resposta")}`}
            />
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm" data-testid="indicadores-por-profissional">
              <thead className="bg-muted text-left text-xs text-text-muted">
                <tr>
                  <th className="p-2">{t("Profissional")}</th>
                  <th className="p-2">{t("Agendados")}</th>
                  <th className="p-2">{t("Realizados")}</th>
                  <th className="p-2">{t("Faltas")}</th>
                  <th className="p-2">{t("Cancelados")}</th>
                  <th className="p-2">{t("Taxa de faltas")}</th>
                  <th className="p-2">{t("Ocupação")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {consulta.data.por_profissional.map((p) => (
                  <tr key={p.profissional_id} data-testid="indicadores-do-profissional" data-profissional={p.profissional_id}>
                    <td className="p-2 font-medium">{nome(p.profissional_id)}</td>
                    <td className="p-2">{p.agendados}</td>
                    <td className="p-2">{p.realizados}</td>
                    <td className="p-2">{p.faltas}</td>
                    <td className="p-2">{p.cancelados}</td>
                    <td className="p-2">{pct(p.taxa_de_faltas)}</td>
                    <td className="p-2" data-testid="ocupacao">
                      {pct(p.ocupacao)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-text-muted">
            {t("Ocupação = tempo marcado ÷ jornada publicada no período. Bloqueios e exceções não descontam da jornada.")}
          </p>
        </>
      )}
    </div>
  );
}
