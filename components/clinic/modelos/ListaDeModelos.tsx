"use client";

/**
 * FORK clinic (prontuário F3) — a lista de modelos clínicos da empresa, por
 * tipo, com "Novo modelo", "Editar" e "Duplicar". O editor abre no lugar da
 * lista (tablet-first: nada de modal apertado para uma tela de campos).
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { EditorDeModelo, type ModeloEditavel } from "@/components/clinic/modelos/EditorDeModelo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

export interface ModeloDaLista extends ModeloEditavel {
  id: string;
  ativo: boolean;
  padrao: boolean;
  versao_atual: number;
  publicada_em: string | null;
}

export interface OpcoesDaClinica {
  tipos: Array<{ id: string; nome: string }>;
  especialidades: Array<{ id: string; nome: string }>;
}

export const CHAVE_MODELOS = ["clinic", "modelos", "gerenciar"] as const;
export const CHAVE_OPCOES = ["clinic", "requisitos"] as const;

const TITULO_DO_TIPO = { anamnese: "Anamnese", avaliacao: "Avaliação" } as const;

export function ListaDeModelos() {
  const t = useT();
  const [editando, setEditando] = useState<{ modelo: ModeloDaLista | null; base?: ModeloEditavel } | null>(null);
  const modelos = useQuery({
    queryKey: CHAVE_MODELOS,
    queryFn: async () => (await apiClient.get<{ data: { modelos: ModeloDaLista[] } }>("/api/v1/clinic/modelos")).data.modelos,
  });
  const opcoes = useQuery({
    queryKey: CHAVE_OPCOES,
    queryFn: async () => (await apiClient.get<{ data: OpcoesDaClinica & { regras: unknown[] } }>("/api/v1/clinic/requisitos")).data,
  });
  const nomeDaEspecialidade = new Map((opcoes.data?.especialidades ?? []).map((e) => [e.id, e.nome]));

  if (editando) {
    return (
      <EditorDeModelo
        modelo={editando.modelo}
        base={editando.base}
        especialidades={opcoes.data?.especialidades ?? []}
        aoFechar={() => setEditando(null)}
      />
    );
  }
  if (modelos.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (modelos.isError) return <p className="text-sm text-destructive">{t("Não foi possível carregar os modelos.")}</p>;

  return (
    <div className="space-y-6" data-testid="lista-de-modelos">
      <div className="flex justify-end">
        <Button onClick={() => setEditando({ modelo: null })} data-testid="modelo-novo">
          {t("Novo modelo")}
        </Button>
      </div>
      {(["anamnese", "avaliacao"] as const).map((tipo) => {
        const lista = (modelos.data ?? []).filter((m) => m.tipo === tipo);
        return (
          <section key={tipo} className="space-y-2">
            <h2 className="text-lg font-semibold">{t(TITULO_DO_TIPO[tipo])}</h2>
            {lista.length === 0 ? (
              <p className="text-sm text-text-muted">{t("Nenhum modelo.")}</p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {lista.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-3" data-testid="modelo-item">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {t(m.nome)}{" "}
                        {!m.ativo ? (
                          <Badge variant="secondary" className="ml-1">
                            {t("Inativo")}
                          </Badge>
                        ) : null}
                      </p>
                      <p className="text-xs text-text-muted">
                        {t("Versão")} {m.versao_atual} · {m.campos.length} {t("campos")}
                        {m.especialidades.length > 0
                          ? ` · ${m.especialidades.map((e) => nomeDaEspecialidade.get(e) ?? "—").join(", ")}`
                          : ` · ${t("Todas as especialidades")}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-11 md:h-8" onClick={() => setEditando({ modelo: m })}>
                        {t("Editar")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-11 md:h-8"
                        onClick={() =>
                          setEditando({
                            modelo: null,
                            base: { ...m, nome: `${t("Cópia de")} ${t(m.nome)}`.slice(0, 80) },
                          })
                        }
                      >
                        {t("Duplicar")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
