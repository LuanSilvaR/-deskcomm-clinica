"use client";

/**
 * O que cada tipo de atendimento EXIGE (módulo clinic). Tipo sem nenhuma
 * especialidade marcada = qualquer profissional pode atender; com uma ou mais,
 * basta o profissional ter uma delas.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

import { useEspecialidades } from "./Especialidades";
import type { TipoDeAtendimento } from "./tipos";

function ExigenciasDoTipo({ tipo, podeEditar }: { tipo: TipoDeAtendimento; podeEditar: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const especialidades = useEspecialidades();
  const chave = ["clinic", "tipo", tipo.id, "especialidades"];
  const exigidas = useQuery({
    queryKey: chave,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { specialty_ids: string[] } }>(
          `/api/v1/clinic/tipos/${tipo.id}/especialidades`,
        )
      ).data.specialty_ids,
  });

  // ESTADO LOCAL, trocado NO MESMO EVENTO do clique. O checkbox é controlado:
  // se o valor novo só chegasse pelo cache do react-query (que avisa num tick
  // seguinte), o React devolveria o input ao valor velho logo após o evento e
  // ele piscaria desmarcado — medido no E2E como "Clicking the checkbox did not
  // change its state". `marcadas` volta a null quando o servidor responde.
  const [marcadas, setMarcadas] = useState<string[] | null>(null);
  const atuais = marcadas ?? exigidas.data ?? [];

  const salvar = useMutation({
    mutationFn: (ids: string[]) =>
      apiClient.put(`/api/v1/clinic/tipos/${tipo.id}/especialidades`, { specialty_ids: ids }),
    onSuccess: (_r, ids) => qc.setQueryData(chave, ids),
    onError: showApiError,
    onSettled: () => {
      setMarcadas(null);
      void qc.invalidateQueries({ queryKey: ["clinic"] });
    },
  });

  const alternar = (id: string, marcar: boolean) => {
    const ids = marcar ? [...atuais.filter((x) => x !== id), id] : atuais.filter((x) => x !== id);
    setMarcadas(ids);
    salvar.mutate(ids);
  };

  const ativas = (especialidades.data ?? []).filter((e) => e.is_active);

  return (
    <li className="space-y-1 p-3" data-testid="exigencias-do-tipo">
      <div className="font-medium">
        {tipo.name}
        {tipo.is_active ? null : <span className="ml-2 text-sm text-text-muted">({t("desativado")})</span>}
      </div>
      {exigidas.isLoading ? (
        <p className="text-sm text-text-muted">{t("Carregando…")}</p>
      ) : ativas.length === 0 ? (
        <p className="text-sm text-text-muted">{t("Cadastre especialidades na aba Especialidades.")}</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {ativas.map((esp) => (
            <label key={esp.id} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                disabled={!podeEditar || salvar.isPending}
                checked={atuais.includes(esp.id)}
                onChange={(e) => alternar(esp.id, e.target.checked)}
              />
              {esp.name}
            </label>
          ))}
        </div>
      )}
      <p className="text-xs text-text-muted">
        {atuais.length === 0 ? t("Qualquer profissional pode atender.") : t("Só quem tem uma das especialidades marcadas.")}
      </p>
    </li>
  );
}

export function AtendimentosPorEspecialidade({ podeEditar }: { podeEditar: boolean }) {
  const t = useT();
  const tipos = useQuery({
    queryKey: ["clinic", "tipos-de-atendimento"],
    queryFn: async () => (await apiClient.get<{ data: TipoDeAtendimento[] }>("/api/v1/agenda/tipos")).data,
  });

  return (
    <section className="space-y-3 rounded-xl border p-4" data-testid="clinic-atendimentos">
      <h2 className="font-semibold">{t("Quem pode fazer cada atendimento")}</h2>
      <p className="text-sm text-text-muted">
        {t("Marque as especialidades que cada tipo de atendimento exige. A agenda, a tela de marcar e o agente de IA passam a oferecer só profissionais habilitados.")}
      </p>
      {tipos.isLoading ? (
        <p className="text-sm text-text-muted">{t("Carregando…")}</p>
      ) : tipos.isError ? (
        <p className="text-sm text-destructive">{t("Não foi possível carregar os tipos de atendimento.")}</p>
      ) : (tipos.data ?? []).length === 0 ? (
        <p className="text-sm text-text-muted">{t("Nenhum tipo de atendimento cadastrado. Crie em Tipos de agendamento.")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {(tipos.data ?? []).map((tipo) => (
            <ExigenciasDoTipo key={tipo.id} tipo={tipo} podeEditar={podeEditar} />
          ))}
        </ul>
      )}
    </section>
  );
}
