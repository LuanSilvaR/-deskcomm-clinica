"use client";

/**
 * FORK clinic (prontuário F3) — requisitos para finalizar um atendimento.
 *
 * Cada linha: "exigir <seção> em <tipo de atendimento | todos> para
 * <especialidade | todas>". A evolução é sempre exigida e aparece fixa, sem
 * poder tirar. Salvar troca a lista inteira.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { CHAVE_OPCOES, type OpcoesDaClinica } from "@/components/clinic/modelos/ListaDeModelos";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { ROTULO_DA_SECAO, type SecaoExigivel } from "@/lib/clinic/atendimento/requisitos";

interface Regra {
  secao: SecaoExigivel;
  event_type_id: string | null;
  specialty_id: string | null;
}
interface Dados extends OpcoesDaClinica {
  regras: Regra[];
  secoes: SecaoExigivel[];
}

const SELECT = "h-11 w-full rounded-md border bg-surface px-2 text-sm md:h-9";

export function EditorDeRequisitos() {
  const t = useT();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: CHAVE_OPCOES,
    queryFn: async () => (await apiClient.get<{ data: Dados }>("/api/v1/clinic/requisitos")).data,
  });
  // Rascunho local só depois da primeira edição; antes disso, o que veio do servidor.
  const [rascunho, setRascunho] = useState<Regra[] | null>(null);
  const regras =
    rascunho ?? q.data?.regras.map((r) => ({ secao: r.secao, event_type_id: r.event_type_id, specialty_id: r.specialty_id })) ?? null;
  const setRegras = (f: (rs: Regra[]) => Regra[]) => setRascunho(f(regras ?? []));

  const salvar = useMutation({
    mutationFn: () => apiClient.put("/api/v1/clinic/requisitos", { regras }),
    onSuccess: () => {
      setRascunho(null);
      void qc.invalidateQueries({ queryKey: CHAVE_OPCOES });
    },
    onError: showApiError,
  });

  if (q.isLoading || !regras) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (q.isError || !q.data) return <p className="text-sm text-destructive">{t("Não foi possível carregar os requisitos.")}</p>;
  const d = q.data;
  const mudar = (i: number, parcial: Partial<Regra>) => setRegras((rs) => rs.map((r, j) => (j === i ? { ...r, ...parcial } : r)));

  return (
    <div className="space-y-4" data-testid="editor-de-requisitos">
      <p className="text-sm text-text-muted">
        {t("O que precisa estar preenchido para o profissional finalizar o atendimento. A evolução é sempre obrigatória.")}
      </p>
      <ul className="space-y-2">
        <li className="rounded-lg border bg-muted/40 p-3 text-sm">
          {t("Evolução")} · {t("todos os atendimentos")} <span className="text-xs text-text-muted">({t("sempre")})</span>
        </li>
        {regras.map((r, i) => (
          <li key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]" data-testid="regra">
            <label className="block text-sm">
              <span className="block text-xs text-text-muted">{t("Exigir")}</span>
              <select className={`mt-1 ${SELECT}`} value={r.secao} onChange={(e) => mudar(i, { secao: e.target.value as SecaoExigivel })}>
                {d.secoes.map((s) => (
                  <option key={s} value={s}>
                    {t(ROTULO_DA_SECAO[s] ?? s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="block text-xs text-text-muted">{t("Tipo de atendimento")}</span>
              <select
                className={`mt-1 ${SELECT}`}
                value={r.event_type_id ?? ""}
                onChange={(e) => mudar(i, { event_type_id: e.target.value || null })}
              >
                <option value="">{t("Todos")}</option>
                {d.tipos.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="block text-xs text-text-muted">{t("Especialidade")}</span>
              <select
                className={`mt-1 ${SELECT}`}
                value={r.specialty_id ?? ""}
                onChange={(e) => mudar(i, { specialty_id: e.target.value || null })}
              >
                <option value="">{t("Todas")}</option>
                {d.especialidades.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="ghost" className="self-end" onClick={() => setRegras((rs) => rs.filter((_, j) => j !== i))}>
              {t("Remover")}
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => setRegras((rs) => [...rs, { secao: d.secoes[0]!, event_type_id: null, specialty_id: null }])}
          data-testid="regra-nova"
        >
          {t("Adicionar regra")}
        </Button>
        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending} data-testid="regras-salvar">
          {salvar.isPending ? t("Salvando…") : t("Salvar requisitos")}
        </Button>
      </div>
    </div>
  );
}
