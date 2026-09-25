"use client";

/**
 * FORK clinic (prontuário F2) — a seção Anamnese ou Avaliação do atendimento.
 *
 * Sem registro ainda: escolha do modelo (os que servem à especialidade do
 * atendimento). Com registro aberto: formulário com autosave e versão.
 * Finalizado: respostas em leitura + adendos.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { ListaDeAdendos, NovoAdendo } from "@/components/clinic/atendimento/Adendos";
import { IndicadorDeSalvamento } from "@/components/clinic/formularios/IndicadorDeSalvamento";
import { RenderizadorDeFormulario, RespostasLidas } from "@/components/clinic/formularios/RenderizadorDeFormulario";
import { useAutosave } from "@/hooks/clinic/useAutosave";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { pendencias, type Campo, type Respostas } from "@/lib/clinic/formularios/campos";
import type { AdendoLido, FormularioLido, TipoDeFormulario } from "@/lib/clinic/prontuario/leitura";

interface Modelo {
  id: string;
  nome: string;
  descricao: string | null;
  versao_id: string;
  campos: Campo[];
}

function Editor({
  atendimentoId,
  tipo,
  modeloVersaoId,
  campos,
  respostasIniciais,
  versaoInicial,
  chaveParaRecarregar,
}: {
  atendimentoId: string;
  tipo: TipoDeFormulario;
  modeloVersaoId: string;
  campos: Campo[];
  respostasIniciais: Respostas;
  versaoInicial: number;
  chaveParaRecarregar: readonly unknown[];
}) {
  const qc = useQueryClient();
  const [respostas, setRespostas] = useState<Respostas>(respostasIniciais);
  const gravar = useCallback(
    async (valor: Respostas, versao: number) =>
      (
        await apiClient.put<{ data: { versao: number } }>(`/api/v1/clinic/atendimentos/${atendimentoId}/formularios/${tipo}`, {
          modelo_versao_id: modeloVersaoId,
          respostas: valor,
          versao,
        })
      ).data,
    [atendimentoId, tipo, modeloVersaoId],
  );
  const { estado, tentarDeNovo } = useAutosave({ valor: respostas, gravar, versaoInicial, habilitado: true });
  const faltam = useMemo(() => new Set(pendencias(campos, respostas).map((c) => c.chave)), [campos, respostas]);

  return (
    <div className="space-y-3">
      <IndicadorDeSalvamento
        estado={estado}
        aoTentarDeNovo={tentarDeNovo}
        aoRecarregar={() => void qc.invalidateQueries({ queryKey: chaveParaRecarregar })}
      />
      <RenderizadorDeFormulario
        idBase={`${tipo}-${atendimentoId}`}
        campos={campos}
        respostas={respostas}
        pendentes={faltam}
        aoMudar={(chave, valor) => setRespostas((r) => ({ ...r, [chave]: valor }))}
      />
    </div>
  );
}

export function SecaoFormulario({
  atendimentoId,
  tipo,
  titulo,
  registro,
  adendos,
  especialidadeId,
  podeRegistrar,
  podeAdendo,
  chaveParaRecarregar,
}: {
  atendimentoId: string;
  tipo: TipoDeFormulario;
  titulo: string;
  registro: FormularioLido | undefined;
  adendos: readonly AdendoLido[];
  especialidadeId: string | null;
  podeRegistrar: boolean;
  podeAdendo: boolean;
  chaveParaRecarregar: readonly unknown[];
}) {
  const t = useT();
  const [escolhido, setEscolhido] = useState<Modelo | null>(null);
  const modelos = useQuery({
    queryKey: ["clinic", "modelos", tipo, especialidadeId],
    enabled: podeRegistrar && !registro,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { modelos: Modelo[] } }>(
          `/api/v1/clinic/modelos/formularios?tipo=${tipo}${especialidadeId ? `&especialidade=${especialidadeId}` : ""}`,
        )
      ).data.modelos,
  });

  const cabecalho = (
    <header className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-lg font-semibold">{t(titulo)}</h2>
      {registro?.modelo_nome ? <span className="text-xs text-text-muted">{t(registro.modelo_nome)}</span> : null}
    </header>
  );

  if (registro && (registro.status === "finalizado" || !podeRegistrar)) {
    return (
      <section className="space-y-3" data-testid={`secao-${tipo}`}>
        {cabecalho}
        <RespostasLidas campos={registro.campos} respostas={registro.respostas} />
        <ListaDeAdendos adendos={adendos.filter((a) => a.alvo_id === registro.id)} />
        {podeAdendo ? (
          <NovoAdendo atendimentoId={atendimentoId} alvoTipo="formulario" alvoId={registro.id} chaveParaRecarregar={chaveParaRecarregar} />
        ) : null}
      </section>
    );
  }

  // Registro aberto — ou modelo recém-escolhido. MESMA chave nos dois casos: o
  // editor não remonta quando a primeira gravação cria o registro, então nem a
  // digitação em curso nem a versão que ele já conhece se perdem.
  const emEdicao = registro
    ? { modeloVersaoId: registro.modelo_versao_id, campos: registro.campos, respostas: registro.respostas, versao: registro.versao }
    : escolhido
      ? { modeloVersaoId: escolhido.versao_id, campos: escolhido.campos, respostas: {}, versao: 0 }
      : null;
  if (emEdicao && podeRegistrar) {
    return (
      <section className="space-y-3" data-testid={`secao-${tipo}`}>
        {cabecalho}
        <Editor
          key={`editor-${tipo}`}
          atendimentoId={atendimentoId}
          tipo={tipo}
          modeloVersaoId={emEdicao.modeloVersaoId}
          campos={emEdicao.campos}
          respostasIniciais={emEdicao.respostas}
          versaoInicial={emEdicao.versao}
          chaveParaRecarregar={chaveParaRecarregar}
        />
      </section>
    );
  }

  if (!podeRegistrar) {
    return (
      <section className="space-y-3" data-testid={`secao-${tipo}`}>
        {cabecalho}
        <p className="text-sm text-text-muted">{t("Nada registrado.")}</p>
      </section>
    );
  }

  return (
    <section className="space-y-3" data-testid={`secao-${tipo}`}>
      {cabecalho}
      {modelos.isLoading ? (
        <p className="text-sm text-text-muted">{t("Carregando…")}</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-text-muted">{t("Escolha o modelo para começar.")}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {(modelos.data ?? []).map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="min-h-11 w-full rounded-lg border p-3 text-left text-sm hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                  onClick={() => setEscolhido(m)}
                  data-testid={`modelo-${tipo}`}
                >
                  <span className="font-medium">{t(m.nome)}</span>
                  {m.descricao ? <span className="block text-xs text-text-muted">{t(m.descricao)}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
