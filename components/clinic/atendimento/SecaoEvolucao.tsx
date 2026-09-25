"use client";

/**
 * FORK clinic (prontuário F2) — a evolução do atendimento: resposta apresentada,
 * observações, intercorrências, orientações e próxima conduta. Autosave com
 * versão enquanto o atendimento está aberto; depois, leitura + adendos.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { ListaDeAdendos, NovoAdendo } from "@/components/clinic/atendimento/Adendos";
import { IndicadorDeSalvamento } from "@/components/clinic/formularios/IndicadorDeSalvamento";
import { Textarea } from "@/components/ui/textarea";
import { useAutosave } from "@/hooks/clinic/useAutosave";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { AdendoLido, EvolucaoLida } from "@/lib/clinic/prontuario/leitura";

export const CAMPOS_DA_EVOLUCAO = [
  { chave: "resposta", rotulo: "Resposta apresentada" },
  { chave: "observacoes", rotulo: "Observações" },
  { chave: "intercorrencias", rotulo: "Intercorrências" },
  { chave: "orientacoes", rotulo: "Orientações" },
  { chave: "proxima_conduta", rotulo: "Próxima conduta" },
] as const;
type ChaveDaEvolucao = (typeof CAMPOS_DA_EVOLUCAO)[number]["chave"];
type TextosDaEvolucao = Record<ChaveDaEvolucao, string>;

function textos(e: EvolucaoLida | null): TextosDaEvolucao {
  return {
    resposta: e?.resposta ?? "",
    observacoes: e?.observacoes ?? "",
    intercorrencias: e?.intercorrencias ?? "",
    orientacoes: e?.orientacoes ?? "",
    proxima_conduta: e?.proxima_conduta ?? "",
  };
}

export function EvolucaoLidaView({ evolucao }: { evolucao: EvolucaoLida }) {
  const t = useT();
  const preenchidos = CAMPOS_DA_EVOLUCAO.filter((c) => (evolucao[c.chave] ?? "").trim());
  if (preenchidos.length === 0) return <p className="text-sm text-text-muted">{t("Nada registrado.")}</p>;
  return (
    <dl className="space-y-3 text-sm">
      {preenchidos.map((c) => (
        <div key={c.chave}>
          <dt className="text-xs text-text-muted">{t(c.rotulo)}</dt>
          <dd className="whitespace-pre-wrap">{evolucao[c.chave]}</dd>
        </div>
      ))}
    </dl>
  );
}

function Editor({
  atendimentoId,
  inicial,
  chaveParaRecarregar,
}: {
  atendimentoId: string;
  inicial: EvolucaoLida | null;
  chaveParaRecarregar: readonly unknown[];
}) {
  const t = useT();
  const qc = useQueryClient();
  const [valor, setValor] = useState<TextosDaEvolucao>(() => textos(inicial));
  const gravar = useCallback(
    async (v: TextosDaEvolucao, versao: number) =>
      (await apiClient.put<{ data: { versao: number } }>(`/api/v1/clinic/atendimentos/${atendimentoId}/evolucao`, { ...v, versao })).data,
    [atendimentoId],
  );
  const { estado, tentarDeNovo } = useAutosave({ valor, gravar, versaoInicial: inicial?.versao ?? 0, habilitado: true });
  const vazia = !Object.values(valor).some((x) => x.trim());
  return (
    <div className="space-y-3">
      <IndicadorDeSalvamento
        estado={estado}
        aoTentarDeNovo={tentarDeNovo}
        aoRecarregar={() => void qc.invalidateQueries({ queryKey: chaveParaRecarregar })}
      />
      {vazia ? <p className="text-xs text-destructive">{t("A evolução é obrigatória para finalizar.")}</p> : null}
      {CAMPOS_DA_EVOLUCAO.map((c) => {
        const id = `evolucao-${c.chave}-${atendimentoId}`;
        return (
          <div key={c.chave} className="space-y-1">
            <label htmlFor={id} className="text-sm font-medium">
              {t(c.rotulo)}
            </label>
            <Textarea
              id={id}
              rows={c.chave === "resposta" ? 4 : 2}
              maxLength={5000}
              value={valor[c.chave]}
              onChange={(e) => setValor((v) => ({ ...v, [c.chave]: e.target.value }))}
              data-testid={`evolucao-${c.chave}`}
            />
          </div>
        );
      })}
    </div>
  );
}

export function SecaoEvolucao({
  atendimentoId,
  evolucao,
  adendos,
  podeRegistrar,
  podeAdendo,
  chaveParaRecarregar,
}: {
  atendimentoId: string;
  evolucao: EvolucaoLida | null;
  adendos: readonly AdendoLido[];
  podeRegistrar: boolean;
  podeAdendo: boolean;
  chaveParaRecarregar: readonly unknown[];
}) {
  const t = useT();
  const aberta = podeRegistrar && evolucao?.status !== "finalizado";
  return (
    <section className="space-y-3" data-testid="secao-evolucao">
      <h2 className="text-lg font-semibold">{t("Evolução")}</h2>
      {aberta ? (
        <Editor key="editor-evolucao" atendimentoId={atendimentoId} inicial={evolucao} chaveParaRecarregar={chaveParaRecarregar} />
      ) : evolucao ? (
        <>
          <EvolucaoLidaView evolucao={evolucao} />
          <ListaDeAdendos adendos={adendos.filter((a) => a.alvo_id === evolucao.id)} />
          {podeAdendo ? (
            <NovoAdendo atendimentoId={atendimentoId} alvoTipo="evolucao" alvoId={evolucao.id} chaveParaRecarregar={chaveParaRecarregar} />
          ) : null}
        </>
      ) : (
        <p className="text-sm text-text-muted">{t("Nada registrado.")}</p>
      )}
    </section>
  );
}
