"use client";

/**
 * FORK clinic (prontuário F3) — o editor simples de um modelo clínico.
 *
 * Dados do modelo (nome, descrição, especialidades, ativo) salvam direto.
 * Os CAMPOS só mudam publicando uma versão nova — a anterior fica intacta para
 * quem já preencheu com ela. A prévia à direita usa o mesmo renderizador da
 * área do atendimento, então o que se vê aqui é o que o profissional verá.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { CHAVE_MODELOS } from "@/components/clinic/modelos/ListaDeModelos";
import { RenderizadorDeFormulario } from "@/components/clinic/formularios/RenderizadorDeFormulario";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { camposPublicaveisSchema, TIPOS_DE_CAMPO, type Campo, type Respostas, type TipoDeCampo } from "@/lib/clinic/formularios/campos";
import { camposMudaram, chaveDoRotulo, mover, opcoesDoTexto } from "@/lib/clinic/formularios/editor";

export interface ModeloEditavel {
  tipo: "anamnese" | "avaliacao";
  nome: string;
  descricao: string | null;
  especialidades: string[];
  campos: Campo[];
}

const ROTULO_DO_TIPO_DE_CAMPO: Record<TipoDeCampo, string> = {
  texto: "Texto curto",
  texto_longo: "Texto longo",
  numero: "Número",
  data: "Data",
  sim_nao: "Sim ou não",
  escolha: "Escolha única",
  multipla: "Múltipla escolha",
  escala: "Escala",
};
const COM_OPCOES = new Set<TipoDeCampo>(["escolha", "multipla"]);
const SELECT = "h-11 w-full rounded-md border bg-surface px-2 text-sm md:h-9";

export function EditorDeModelo({
  modelo,
  base,
  especialidades,
  aoFechar,
}: {
  modelo: (ModeloEditavel & { id: string; ativo: boolean; versao_atual: number }) | null;
  base?: ModeloEditavel;
  especialidades: Array<{ id: string; nome: string }>;
  aoFechar: () => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const inicial = modelo ?? base ?? { tipo: "anamnese" as const, nome: "", descricao: null, especialidades: [], campos: [] };
  const [tipo, setTipo] = useState(inicial.tipo);
  const [nome, setNome] = useState(inicial.nome);
  const [descricao, setDescricao] = useState(inicial.descricao ?? "");
  const [esps, setEsps] = useState<string[]>(inicial.especialidades);
  const [ativo, setAtivo] = useState(modelo?.ativo ?? true);
  const [campos, setCampos] = useState<Campo[]>(inicial.campos);
  const [textoDasOpcoes, setTextoDasOpcoes] = useState<Record<string, string>>(() =>
    Object.fromEntries(inicial.campos.map((c) => [c.chave, (c.opcoes ?? []).map((o) => o.rotulo).join("\n")])),
  );
  const [previa, setPrevia] = useState<Respostas>({});

  const validacao = camposPublicaveisSchema.safeParse(campos);
  const mudouCampos = !modelo || camposMudaram(modelo.campos, campos);
  const invalidar = () => void qc.invalidateQueries({ queryKey: CHAVE_MODELOS });

  const criar = useMutation({
    mutationFn: () =>
      apiClient.post("/api/v1/clinic/modelos", {
        tipo,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        especialidades: esps,
        campos,
      }),
    onSuccess: () => {
      invalidar();
      aoFechar();
    },
    onError: showApiError,
  });
  const salvarDados = useMutation({
    mutationFn: () =>
      apiClient.patch(`/api/v1/clinic/modelos/${modelo!.id}`, {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        especialidades: esps,
        ativo,
      }),
    onSuccess: invalidar,
    onError: showApiError,
  });
  const publicar = useMutation({
    mutationFn: () => apiClient.post(`/api/v1/clinic/modelos/${modelo!.id}/versoes`, { campos, versao_atual: modelo!.versao_atual }),
    onSuccess: () => {
      invalidar();
      aoFechar();
    },
    onError: showApiError,
  });

  const chaves = useMemo(() => new Set(campos.map((c) => c.chave)), [campos]);
  const mudarCampo = (i: number, parcial: Partial<Campo>) =>
    setCampos((cs) => cs.map((c, j) => (j === i ? limparCampo({ ...c, ...parcial }) : c)));
  const novoCampo = () => {
    const rotulo = t("Novo campo");
    const chave = chaveDoRotulo(`campo ${campos.length + 1}`, chaves);
    setCampos((cs) => [...cs, { chave, rotulo, tipo: "texto" }]);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]" data-testid="editor-de-modelo">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{modelo ? t("Editar modelo") : t("Novo modelo")}</h2>
          <Button variant="ghost" onClick={aoFechar}>
            {t("Voltar")}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="block font-medium">{t("Nome")}</span>
            <Input className="mt-1 h-11 md:h-9" value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} data-testid="modelo-nome" />
          </label>
          <label className="block text-sm">
            <span className="block font-medium">{t("Seção")}</span>
            <select className={`mt-1 ${SELECT}`} value={tipo} disabled={!!modelo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
              <option value="anamnese">{t("Anamnese")}</option>
              <option value="avaliacao">{t("Avaliação")}</option>
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="block font-medium">{t("Descrição")}</span>
            <Input className="mt-1 h-11 md:h-9" value={descricao} maxLength={300} onChange={(e) => setDescricao(e.target.value)} />
          </label>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("Especialidades")}</legend>
          <p className="text-xs text-text-muted">{t("Sem nenhuma marcada, o modelo aparece para todas.")}</p>
          <div className="flex flex-wrap gap-2">
            {especialidades.map((e) => {
              const marcada = esps.includes(e.id);
              return (
                <label key={e.id} className="flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm md:min-h-9">
                  <input
                    type="checkbox"
                    checked={marcada}
                    onChange={() => setEsps((l) => (marcada ? l.filter((x) => x !== e.id) : [...l, e.id]))}
                  />
                  {e.nome}
                </label>
              );
            })}
            {especialidades.length === 0 ? <p className="text-xs text-text-muted">{t("Nenhuma especialidade cadastrada.")}</p> : null}
          </div>
        </fieldset>

        {modelo ? (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={ativo} onCheckedChange={setAtivo} aria-label={t("Modelo ativo")} />
            {t("Modelo ativo (aparece para escolher no atendimento)")}
          </label>
        ) : null}

        {modelo ? (
          <Button variant="outline" onClick={() => salvarDados.mutate()} disabled={salvarDados.isPending || !nome.trim()}>
            {salvarDados.isPending ? t("Salvando…") : t("Salvar dados do modelo")}
          </Button>
        ) : null}

        <section className="space-y-3">
          <h3 className="text-base font-semibold">{t("Campos")}</h3>
          {modelo ? (
            <p className="text-xs text-text-muted">
              {t("Mudar os campos publica uma versão nova. Quem já preencheu continua vendo a versão que usou.")}
            </p>
          ) : null}
          <ol className="space-y-3">
            {campos.map((c, i) => (
              <li key={c.chave} className="space-y-2 rounded-lg border p-3" data-testid="campo-do-modelo">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  <label className="block text-sm">
                    <span className="block text-xs text-text-muted">{t("Pergunta")}</span>
                    <Input className="mt-1 h-11 md:h-9" value={c.rotulo} maxLength={160} onChange={(e) => mudarCampo(i, { rotulo: e.target.value })} />
                  </label>
                  <label className="block text-sm">
                    <span className="block text-xs text-text-muted">{t("Tipo de resposta")}</span>
                    <select className={`mt-1 ${SELECT}`} value={c.tipo} onChange={(e) => mudarCampo(i, { tipo: e.target.value as TipoDeCampo })}>
                      {TIPOS_DE_CAMPO.map((tp) => (
                        <option key={tp} value={tp}>
                          {t(ROTULO_DO_TIPO_DE_CAMPO[tp])}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {COM_OPCOES.has(c.tipo) ? (
                  <label className="block text-sm">
                    <span className="block text-xs text-text-muted">{t("Opções (uma por linha)")}</span>
                    <Textarea
                      className="mt-1"
                      rows={3}
                      value={textoDasOpcoes[c.chave] ?? ""}
                      onChange={(e) => {
                        setTextoDasOpcoes((m) => ({ ...m, [c.chave]: e.target.value }));
                        mudarCampo(i, { opcoes: opcoesDoTexto(e.target.value) });
                      }}
                    />
                  </label>
                ) : null}
                {c.tipo === "escala" || c.tipo === "numero" ? (
                  <div className="flex gap-2">
                    <label className="block text-sm">
                      <span className="block text-xs text-text-muted">{t("Mínimo")}</span>
                      <Input
                        type="number"
                        className="mt-1 h-11 w-28 md:h-9"
                        value={c.min ?? ""}
                        onChange={(e) => mudarCampo(i, { min: e.target.value === "" ? undefined : Number(e.target.value) })}
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="block text-xs text-text-muted">{t("Máximo")}</span>
                      <Input
                        type="number"
                        className="mt-1 h-11 w-28 md:h-9"
                        value={c.max ?? ""}
                        onChange={(e) => mudarCampo(i, { max: e.target.value === "" ? undefined : Number(e.target.value) })}
                      />
                    </label>
                  </div>
                ) : null}
                <label className="block text-sm">
                  <span className="block text-xs text-text-muted">{t("Ajuda (opcional)")}</span>
                  <Input className="mt-1 h-11 md:h-9" value={c.ajuda ?? ""} maxLength={300} onChange={(e) => mudarCampo(i, { ajuda: e.target.value })} />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!c.obrigatorio} onChange={(e) => mudarCampo(i, { obrigatorio: e.target.checked })} />
                    {t("Obrigatório para finalizar")}
                  </label>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" aria-label={t("Subir")} onClick={() => setCampos((cs) => mover(cs, i, -1))} disabled={i === 0}>
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t("Descer")}
                      onClick={() => setCampos((cs) => mover(cs, i, 1))}
                      disabled={i === campos.length - 1}
                    >
                      ↓
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setCampos((cs) => cs.filter((_, j) => j !== i))}>
                      {t("Remover")}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <Button variant="outline" onClick={novoCampo} disabled={campos.length >= 60} data-testid="campo-novo">
            {t("Adicionar campo")}
          </Button>
          {!validacao.success && campos.length > 0 ? (
            <p role="alert" className="text-sm text-destructive">
              {t(validacao.error.issues[0]?.message ?? "Campos inválidos.")}
            </p>
          ) : null}
        </section>

        <div className="flex flex-wrap gap-2 border-t pt-4">
          {modelo ? (
            <Button
              onClick={() => publicar.mutate()}
              disabled={!mudouCampos || !validacao.success || publicar.isPending}
              data-testid="modelo-publicar"
            >
              {publicar.isPending ? t("Publicando…") : t("Publicar nova versão")}
            </Button>
          ) : (
            <Button onClick={() => criar.mutate()} disabled={!validacao.success || !nome.trim() || criar.isPending} data-testid="modelo-criar">
              {criar.isPending ? t("Criando…") : t("Criar modelo")}
            </Button>
          )}
        </div>
      </div>

      <aside className="space-y-2 rounded-xl border p-4 lg:sticky lg:top-4 lg:self-start" aria-label={t("Prévia")}>
        <h3 className="text-sm font-semibold">{t("Prévia")}</h3>
        <p className="text-xs text-text-muted">{t("Assim o profissional verá o formulário. Nada aqui é salvo.")}</p>
        {validacao.success ? (
          <RenderizadorDeFormulario
            idBase="previa"
            campos={campos}
            respostas={previa}
            pendentes={new Set()}
            aoMudar={(chave, valor) => setPrevia((r) => ({ ...r, [chave]: valor }))}
          />
        ) : (
          <p className="text-sm text-text-muted">{t("Adicione campos para ver a prévia.")}</p>
        )}
      </aside>
    </div>
  );
}

/** Tira do campo o que não vale para o tipo (opções fora de escolha, etc.). */
function limparCampo(c: Campo): Campo {
  const out: Campo = { chave: c.chave, rotulo: c.rotulo, tipo: c.tipo };
  if (c.obrigatorio) out.obrigatorio = true;
  if (c.ajuda?.trim()) out.ajuda = c.ajuda;
  if (COM_OPCOES.has(c.tipo)) out.opcoes = c.opcoes ?? [];
  if (c.tipo === "escala" || c.tipo === "numero") {
    if (c.min !== undefined && Number.isFinite(c.min)) out.min = c.min;
    if (c.max !== undefined && Number.isFinite(c.max)) out.max = c.max;
  }
  return out;
}
