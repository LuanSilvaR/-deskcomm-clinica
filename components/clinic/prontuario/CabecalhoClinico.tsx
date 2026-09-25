"use client";

/**
 * FORK clinic (prontuário F9) — o cabeçalho clínico do paciente: alergias e
 * alertas fixos (editáveis por quem registra atendimento, com a versão que a
 * tela conhecia — 409 nunca sobrescreve), plano ativo, último atendimento e
 * próximo agendamento. Aparece no topo do atendimento e do prontuário.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";

export interface Cabecalho {
  alergias: string | null;
  alertas: string | null;
  versao: number;
  atualizado_em: string | null;
  historico: Array<{
    campo: "alergias" | "alertas";
    valor_anterior: string | null;
    valor_novo: string | null;
    created_at: string;
  }>;
  plano_ativo: {
    id: string;
    titulo: string;
    total: number;
    realizadas: number;
    agendadas: number;
    planejadas: number;
  } | null;
  ultimo_atendimento: { inicio: string; servico: string | null } | null;
  proximo_agendamento: { inicio: string; titulo: string | null } | null;
  filtros: {
    profissionais: Array<{ id: string; nome: string }>;
    planos: Array<{ id: string; titulo: string }>;
  };
  pode_editar: boolean;
}

export const chaveDoCabecalho = (contactId: string) => ["clinic", "cabecalho", contactId];

export function useCabecalhoClinico(contactId: string) {
  return useQuery({
    queryKey: chaveDoCabecalho(contactId),
    queryFn: async () =>
      (await apiClient.get<{ data: Cabecalho }>(`/api/v1/clinic/pacientes/${contactId}/cabecalho`))
        .data,
  });
}

export function CabecalhoClinico({ contactId }: { contactId: string }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const qc = useQueryClient();
  const q = useCabecalhoClinico(contactId);
  const [editando, setEditando] = useState<{
    alergias: string;
    alertas: string;
    versao: number;
  } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const salvar = useMutation({
    mutationFn: (d: { alergias: string; alertas: string; versao: number }) =>
      apiClient.put(`/api/v1/clinic/pacientes/${contactId}/cabecalho`, {
        alergias: d.alergias.trim() || null,
        alertas: d.alertas.trim() || null,
        versao: d.versao,
      }),
    onSuccess: () => {
      setEditando(null);
      setAviso(null);
      void qc.invalidateQueries({ queryKey: chaveDoCabecalho(contactId) });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setAviso(t("Outra pessoa alterou este registro. Recarregue para ver a versão atual."));
        return;
      }
      showApiError(err);
    },
  });

  if (q.isLoading) return <p className="text-xs text-text-muted">{t("Carregando…")}</p>;
  if (q.isError || !q.data) return null;
  const c = q.data;
  const dia = (iso: string) => new Date(iso).toLocaleDateString(tag, { dateStyle: "medium" });
  const diaHora = (iso: string) =>
    new Date(iso).toLocaleString(tag, { dateStyle: "short", timeStyle: "short" });

  return (
    <section
      aria-label={t("Cabeçalho clínico")}
      className="space-y-3 rounded-xl border p-3 text-sm"
      data-testid="cabecalho-clinico"
    >
      {editando ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            salvar.mutate(editando);
          }}
        >
          <label className="block space-y-1">
            <span className="text-xs font-medium">{t("Alergias informadas")}</span>
            <Textarea
              value={editando.alergias}
              maxLength={2000}
              onChange={(e) => setEditando({ ...editando, alergias: e.target.value })}
              data-testid="cabecalho-alergias"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium">{t("Alertas")}</span>
            <Textarea
              value={editando.alertas}
              maxLength={2000}
              onChange={(e) => setEditando({ ...editando, alertas: e.target.value })}
              data-testid="cabecalho-alertas"
            />
          </label>
          {aviso ? (
            <p role="alert" className="text-xs text-destructive">
              {aviso}{" "}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setEditando(null);
                  setAviso(null);
                  void q.refetch();
                }}
              >
                {t("Recarregar")}
              </button>
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={salvar.isPending}
              data-testid="cabecalho-salvar"
            >
              {salvar.isPending ? t("Salvando…") : t("Salvar")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditando(null)}>
              {t("Cancelar")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-text-muted">{t("Alergias informadas")}</p>
            <p
              className={
                c.alergias ? "font-medium whitespace-pre-wrap text-destructive" : "text-text-muted"
              }
              data-testid="cabecalho-alergias-lidas"
            >
              {c.alergias ?? t("Nenhuma informada")}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-text-muted">{t("Alertas")}</p>
            <p className={c.alertas ? "font-medium whitespace-pre-wrap" : "text-text-muted"}>
              {c.alertas ?? t("Nenhum")}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
        {c.plano_ativo ? (
          <span>
            {t("Plano ativo")}: {c.plano_ativo.titulo} · {c.plano_ativo.realizadas}/
            {c.plano_ativo.total} {t("sessões realizadas")}
          </span>
        ) : null}
        <span>
          {t("Último atendimento")}:{" "}
          {c.ultimo_atendimento
            ? `${dia(c.ultimo_atendimento.inicio)}${c.ultimo_atendimento.servico ? ` · ${c.ultimo_atendimento.servico}` : ""}`
            : "—"}
        </span>
        <span>
          {t("Próximo agendamento")}:{" "}
          {c.proximo_agendamento ? diaHora(c.proximo_agendamento.inicio) : "—"}
        </span>
      </div>

      {!editando && (c.pode_editar || c.historico.length > 0) ? (
        <div className="flex flex-wrap items-start gap-3">
          {c.pode_editar ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setEditando({
                  alergias: c.alergias ?? "",
                  alertas: c.alertas ?? "",
                  versao: c.versao,
                })
              }
              data-testid="cabecalho-editar"
            >
              {t("Editar alergias e alertas")}
            </Button>
          ) : null}
          {c.historico.length > 0 ? (
            <details className="text-xs">
              <summary className="cursor-pointer text-text-muted">
                {t("Histórico de alterações")}
              </summary>
              <ul className="mt-1 space-y-1">
                {c.historico.map((h) => (
                  <li key={`${h.campo}-${h.created_at}`}>
                    {diaHora(h.created_at)} ·{" "}
                    {t(h.campo === "alergias" ? "Alergias informadas" : "Alertas")}:{" "}
                    {h.valor_anterior ?? "—"} → {h.valor_novo ?? "—"}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
