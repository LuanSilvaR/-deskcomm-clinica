"use client";

/**
 * FORK clinic (estoque E2) — pendências da baixa pelo prontuário.
 *
 * Finalizar o atendimento nunca trava por estoque: o que não deu para tirar
 * (sem saldo, lote desconhecido, sem local) aparece aqui para baixar escolhendo
 * lote e local, ou descartar com motivo. Controlado usado por profissional fora
 * dos conselhos permitidos já saiu do estoque e fica aqui para revisão.
 * Nada do paciente aparece nesta tela.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { ResolucaoDePendencia } from "@/lib/clinic/estoque/schemas";

import { CHAVE_DO_ESTOQUE, quantidade, type DadosDoEstoque } from "./tipos";

interface Pendencia {
  id: string;
  product_id: string;
  produto_nome: string;
  quantidade: number;
  lote_informado: string | null;
  motivo: string;
  status: string;
  created_at: string;
}

export const CHAVE_DAS_PENDENCIAS = ["clinic", "estoque", "pendencias"] as const;

const ROTULO_DO_MOTIVO: Record<string, string> = {
  sem_saldo: "Sem saldo no local",
  lote_desconhecido: "Lote informado não existe no estoque",
  sem_local: "Nenhum local de estoque ativo",
  profissional_nao_habilitado: "Controlado usado por conselho não permitido",
};

export function Pendencias({ dados }: { dados: DadosDoEstoque }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const qc = useQueryClient();
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [escolha, setEscolha] = useState("");
  const q = useQuery({
    queryKey: [...CHAVE_DAS_PENDENCIAS],
    queryFn: async () =>
      (
        await apiClient.get<{ data: { pendencias: Pendencia[]; pode_resolver: boolean } }>(
          "/api/v1/clinic/estoque/pendencias",
        )
      ).data,
  });
  const resolver = useMutation({
    mutationFn: ({ id, corpo }: { id: string; corpo: ResolucaoDePendencia }) =>
      apiClient.post(`/api/v1/clinic/estoque/pendencias/${id}`, corpo),
    onSuccess: () => {
      setAbrindo(null);
      setEscolha("");
      void qc.invalidateQueries({ queryKey: [...CHAVE_DAS_PENDENCIAS] });
      void qc.invalidateQueries({ queryKey: [...CHAVE_DO_ESTOQUE] });
      void qc.invalidateQueries({ queryKey: ["clinic", "estoque", "movimentos"] });
    },
    onError: showApiError,
  });

  if (q.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (q.isError || !q.data)
    return <p className="text-sm text-destructive">{t("Não foi possível ler as pendências.")}</p>;
  const { pendencias, pode_resolver } = q.data;
  if (pendencias.length === 0)
    return (
      <p className="text-sm text-text-muted" data-testid="estoque-sem-pendencias">
        {t("Nenhuma pendência: tudo o que foi usado nos atendimentos saiu do estoque.")}
      </p>
    );

  const nomeDoLocal = new Map(dados.locais.map((l) => [l.id, l.nome]));
  const opcoes = (p: Pendencia) => {
    const produto = dados.produtos.find((x) => x.product_id === p.product_id);
    return (produto?.lotes ?? []).flatMap((l) =>
      l.por_local
        .filter((pl) => pl.saldo >= p.quantidade)
        .map((pl) => ({
          valor: `${l.lote_id}|${pl.local_id}`,
          rotulo: `${t("lote")} ${l.codigo ?? t("sem lote")}${l.validade ? ` · ${l.validade}` : ""} · ${
            nomeDoLocal.get(pl.local_id) ?? "—"
          } · ${quantidade(pl.saldo, tag)}`,
        })),
    );
  };
  const comMotivo = (p: Pendencia, acao: "descartar" | "ciente", pergunta: string) => {
    const motivo = window.prompt(pergunta);
    if (motivo && motivo.trim().length >= 3)
      resolver.mutate({ id: p.id, corpo: { acao, motivo: motivo.trim() } });
  };

  return (
    <ul className="divide-y rounded-xl border" data-testid="estoque-pendencias">
      {pendencias.map((p) => {
        const revisao = p.motivo === "profissional_nao_habilitado";
        const lista = abrindo === p.id ? opcoes(p) : [];
        return (
          <li key={p.id} className="space-y-2 p-3 text-sm" data-testid="estoque-pendencia">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{p.produto_nome || "—"}</span>
                <span>{quantidade(p.quantidade, tag)}</span>
                <Badge variant={revisao ? "secondary" : "destructive"}>
                  {t(ROTULO_DO_MOTIVO[p.motivo] ?? p.motivo)}
                </Badge>
                <span className="text-xs text-text-muted">
                  {new Date(p.created_at).toLocaleString(tag, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </span>
              {pode_resolver ? (
                <span className="flex flex-wrap gap-1">
                  {revisao ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={resolver.isPending}
                      onClick={() =>
                        comMotivo(p, "ciente", t("O que foi verificado? (fica registrado)"))
                      }
                      data-testid="estoque-pendencia-ciente"
                    >
                      {t("Ciente")}
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAbrindo(abrindo === p.id ? null : p.id)}
                        data-testid="estoque-pendencia-baixar"
                      >
                        {t("Baixar agora")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={resolver.isPending}
                        onClick={() =>
                          comMotivo(
                            p,
                            "descartar",
                            t("Por que este insumo não sai do estoque? (fica registrado)"),
                          )
                        }
                        data-testid="estoque-pendencia-descartar"
                      >
                        {t("Descartar")}
                      </Button>
                    </>
                  )}
                </span>
              ) : null}
            </div>
            {p.lote_informado ? (
              <p className="text-xs text-text-muted">
                {t("Lote informado no atendimento:")} {p.lote_informado}
              </p>
            ) : null}
            {abrindo === p.id ? (
              lista.length === 0 ? (
                <p className="text-xs text-text-muted">
                  {t("Nenhum lote com saldo suficiente. Dê entrada no estoque e volte aqui.")}
                </p>
              ) : (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const [lote_id, local_id] = escolha.split("|");
                    if (lote_id && local_id)
                      resolver.mutate({ id: p.id, corpo: { acao: "baixar", lote_id, local_id } });
                  }}
                >
                  <label className="grid gap-1 text-xs">
                    {t("De qual lote e local sai")}
                    <select
                      className="min-h-11 rounded-md border bg-background px-2 text-sm md:min-h-9"
                      value={escolha}
                      onChange={(e) => setEscolha(e.target.value)}
                      data-testid="estoque-pendencia-lote"
                    >
                      <option value="">{t("Escolha…")}</option>
                      {lista.map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.rotulo}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!escolha || resolver.isPending}
                    data-testid="estoque-pendencia-confirmar"
                  >
                    {t("Confirmar baixa")}
                  </Button>
                </form>
              )
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
