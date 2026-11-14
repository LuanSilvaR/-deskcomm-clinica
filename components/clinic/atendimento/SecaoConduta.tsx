"use client";

/**
 * FORK clinic (prontuário F4) — a conduta do atendimento: o que foi decidido,
 * protocolo e recomendações. Mesmo desenho da evolução: autosave com versão
 * enquanto o atendimento está aberto; depois, leitura + adendos.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { ListaDeAdendos, NovoAdendo } from "@/components/clinic/atendimento/Adendos";
import { IndicadorDeSalvamento } from "@/components/clinic/formularios/IndicadorDeSalvamento";
import { Textarea } from "@/components/ui/textarea";
import { useAutosave } from "@/hooks/clinic/useAutosave";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { AdendoLido, CondutaLida } from "@/lib/clinic/prontuario/leitura";

export const CAMPOS_DA_CONDUTA = [
  { chave: "descricao", rotulo: "Conduta definida" },
  { chave: "protocolo", rotulo: "Protocolo" },
  { chave: "recomendacoes", rotulo: "Recomendações" },
] as const;
type ChaveDaConduta = (typeof CAMPOS_DA_CONDUTA)[number]["chave"];
type TextosDaConduta = Record<ChaveDaConduta, string>;

function textos(e: CondutaLida | null): TextosDaConduta {
  return { descricao: e?.descricao ?? "", protocolo: e?.protocolo ?? "", recomendacoes: e?.recomendacoes ?? "" };
}

export function CondutaLidaView({ conduta }: { conduta: CondutaLida }) {
  const t = useT();
  const preenchidos = CAMPOS_DA_CONDUTA.filter((c) => (conduta[c.chave] ?? "").trim());
  if (preenchidos.length === 0) return <p className="text-sm text-text-muted">{t("Nada registrado.")}</p>;
  return (
    <dl className="space-y-3 text-sm">
      {preenchidos.map((c) => (
        <div key={c.chave}>
          <dt className="text-xs text-text-muted">{t(c.rotulo)}</dt>
          <dd className="whitespace-pre-wrap">{conduta[c.chave]}</dd>
        </div>
      ))}
    </dl>
  );
}

function Editor({
  atendimentoId,
  inicial,
  chaveParaRecarregar,
  obrigatoria,
}: {
  atendimentoId: string;
  inicial: CondutaLida | null;
  chaveParaRecarregar: readonly unknown[];
  obrigatoria: boolean;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [valor, setValor] = useState<TextosDaConduta>(() => textos(inicial));
  const gravar = useCallback(
    async (v: TextosDaConduta, versao: number) =>
      (await apiClient.put<{ data: { versao: number } }>(`/api/v1/clinic/atendimentos/${atendimentoId}/conduta`, { ...v, versao })).data,
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
      {vazia && obrigatoria ? <p className="text-xs text-destructive">{t("A conduta é obrigatória para finalizar este atendimento.")}</p> : null}
      {CAMPOS_DA_CONDUTA.map((c) => {
        const id = `conduta-${c.chave}-${atendimentoId}`;
        return (
          <div key={c.chave} className="space-y-1">
            <label htmlFor={id} className="block text-sm font-medium">
              {t(c.rotulo)}
            </label>
            <Textarea
              id={id}
              rows={c.chave === "descricao" ? 4 : 2}
              maxLength={5000}
              value={valor[c.chave]}
              onChange={(e) => setValor((v) => ({ ...v, [c.chave]: e.target.value }))}
              data-testid={`conduta-${c.chave}`}
            />
          </div>
        );
      })}
    </div>
  );
}

export function SecaoConduta({
  atendimentoId,
  conduta,
  adendos,
  podeRegistrar,
  podeAdendo,
  chaveParaRecarregar,
  obrigatoria,
}: {
  atendimentoId: string;
  conduta: CondutaLida | null;
  obrigatoria: boolean;
  adendos: readonly AdendoLido[];
  podeRegistrar: boolean;
  podeAdendo: boolean;
  chaveParaRecarregar: readonly unknown[];
}) {
  const t = useT();
  const aberta = podeRegistrar && conduta?.status !== "finalizado";
  return (
    <section className="space-y-3" data-testid="secao-conduta">
      <h2 className="text-lg font-semibold">{t("Conduta")}</h2>
      {aberta ? (
        <Editor
          key="editor-conduta"
          atendimentoId={atendimentoId}
          inicial={conduta}
          chaveParaRecarregar={chaveParaRecarregar}
          obrigatoria={obrigatoria}
        />
      ) : conduta ? (
        <>
          <CondutaLidaView conduta={conduta} />
          <ListaDeAdendos adendos={adendos.filter((a) => a.alvo_id === conduta.id)} />
          {podeAdendo ? (
            <NovoAdendo atendimentoId={atendimentoId} alvoTipo="conduta" alvoId={conduta.id} chaveParaRecarregar={chaveParaRecarregar} />
          ) : null}
        </>
      ) : (
        <p className="text-sm text-text-muted">{t("Nada registrado.")}</p>
      )}
    </section>
  );
}
