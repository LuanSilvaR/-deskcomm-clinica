"use client";

/**
 * FORK clinic (prontuário F6) — Configurações › Modelos clínicos › Documentos e
 * termos. Lista os modelos e edita texto, opções e se está ativo. Salvar texto
 * ou opções diferentes publica versão nova; nada que já foi aceito muda.
 * Os textos padrão são modelos, não parecer jurídico — o aviso fica na tela.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { TextoDoTermo } from "@/components/clinic/documentos/FormularioDeAceite";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { chaveDoRotulo } from "@/lib/clinic/formularios/editor";
import { MARCADORES, marcadoresDesconhecidos, renderizarTermo } from "@/lib/clinic/documentos/render";
import {
  opcoesDoTermoSchema,
  ROTULO_DO_TIPO_DE_DOCUMENTO,
  TIPOS_DE_DOCUMENTO,
  type OpcaoDoTermo,
  type TipoDeDocumento,
} from "@/lib/clinic/documentos/tipos";

interface ModeloDoc {
  id: string;
  tipo: TipoDeDocumento;
  nome: string;
  ativo: boolean;
  padrao: boolean;
  versao_atual: number;
  conteudo: string;
  opcoes: OpcaoDoTermo[];
}

const CHAVE = ["clinic", "documentos", "modelos"] as const;
const SELECT = "h-11 w-full rounded-md border bg-surface px-2 text-sm md:h-9";
const EXEMPLO = {
  "paciente.nome": "Nome do paciente",
  "clinica.nome": "Nome da clínica",
  "profissional.nome": "Nome do profissional",
  procedimento: "Procedimento",
  data: "01/01/2027",
};

export function EditorDeTermos() {
  const t = useT();
  const [editando, setEditando] = useState<ModeloDoc | "novo" | null>(null);
  const q = useQuery({
    queryKey: CHAVE,
    queryFn: async () => (await apiClient.get<{ data: { modelos: ModeloDoc[] } }>("/api/v1/clinic/documentos/modelos")).data.modelos,
  });
  if (editando) return <Editor modelo={editando === "novo" ? null : editando} aoFechar={() => setEditando(null)} />;
  if (q.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (q.isError) return <p className="text-sm text-destructive">{t("Não foi possível carregar os modelos.")}</p>;
  return (
    <div className="space-y-4" data-testid="editor-de-termos">
      <p className="rounded-lg border bg-muted/40 p-3 text-xs text-text-muted">
        {t("Os textos que vêm prontos são modelos para adaptar. Revise-os com o advogado ou advogada da clínica antes de usar.")}
      </p>
      <div className="flex justify-end">
        <Button onClick={() => setEditando("novo")} data-testid="termo-novo">
          {t("Novo modelo")}
        </Button>
      </div>
      <ul className="divide-y rounded-xl border">
        {(q.data ?? []).map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3" data-testid="termo-item">
            <div>
              <p className="font-medium">
                {t(m.nome)}{" "}
                {!m.ativo ? (
                  <Badge variant="secondary" className="ml-1">
                    {t("Inativo")}
                  </Badge>
                ) : null}
              </p>
              <p className="text-xs text-text-muted">
                {t(ROTULO_DO_TIPO_DE_DOCUMENTO[m.tipo])} · {t("Versão")} {m.versao_atual}
                {m.opcoes.length ? ` · ${m.opcoes.length} ${t("opções")}` : ""}
              </p>
            </div>
            <Button size="sm" variant="outline" className="h-11 md:h-8" onClick={() => setEditando(m)}>
              {t("Editar")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Editor({ modelo, aoFechar }: { modelo: ModeloDoc | null; aoFechar: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<TipoDeDocumento>(modelo?.tipo ?? "consentimento");
  const [nome, setNome] = useState(modelo?.nome ?? "");
  const [conteudo, setConteudo] = useState(modelo?.conteudo ?? "");
  const [ativo, setAtivo] = useState(modelo?.ativo ?? true);
  const [opcoes, setOpcoes] = useState<OpcaoDoTermo[]>(modelo?.opcoes ?? []);
  const desconhecidos = marcadoresDesconhecidos(conteudo);
  const novaOpcao = () =>
    setOpcoes((l) => [...l, { chave: chaveDoRotulo(`opcao ${l.length + 1}`, new Set(l.map((x) => x.chave))), rotulo: "" }]);
  const opcoesValidas = opcoesDoTermoSchema.safeParse(opcoes).success && opcoes.every((o) => o.rotulo.trim());

  const salvar = useMutation({
    mutationFn: () =>
      modelo
        ? apiClient.patch(`/api/v1/clinic/documentos/modelos/${modelo.id}`, {
            nome: nome.trim(),
            conteudo,
            opcoes,
            ativo,
            versao_atual: modelo.versao_atual,
          })
        : apiClient.post("/api/v1/clinic/documentos/modelos", { tipo, nome: nome.trim(), conteudo, opcoes, ativo }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CHAVE });
      aoFechar();
    },
    onError: showApiError,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]" data-testid="editor-de-termo">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{modelo ? t("Editar modelo") : t("Novo modelo")}</h2>
          <Button variant="ghost" onClick={aoFechar}>
            {t("Voltar")}
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="block font-medium">{t("Nome")}</span>
            <Input className="mt-1 h-11 md:h-9" value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} data-testid="termo-nome" />
          </label>
          <label className="block text-sm">
            <span className="block font-medium">{t("Tipo")}</span>
            <select className={`mt-1 ${SELECT}`} value={tipo} disabled={!!modelo} onChange={(e) => setTipo(e.target.value as TipoDeDocumento)}>
              {TIPOS_DE_DOCUMENTO.map((x) => (
                <option key={x} value={x}>
                  {t(ROTULO_DO_TIPO_DE_DOCUMENTO[x])}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="block font-medium">{t("Texto")}</span>
          <Textarea className="mt-1 font-mono text-xs" rows={14} maxLength={50_000} value={conteudo} onChange={(e) => setConteudo(e.target.value)} data-testid="termo-texto" />
        </label>
        <p className="text-xs text-text-muted">
          {t("Marcadores disponíveis:")} {MARCADORES.map((m) => `{{${m}}}`).join(" ")}
        </p>
        {desconhecidos.length ? (
          <p role="alert" className="text-xs text-destructive">
            {t("Marcadores que o sistema não conhece:")} {desconhecidos.join(", ")}
          </p>
        ) : null}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("Opções que o paciente marca (sim ou não)")}</legend>
          {opcoes.map((o, i) => (
            <div key={o.chave} className="flex flex-wrap items-center gap-2">
              <Input
                aria-label={t("Opção")}
                className="h-11 min-w-0 flex-1 md:h-9"
                maxLength={500}
                value={o.rotulo}
                onChange={(e) => setOpcoes((l) => l.map((x, j) => (j === i ? { ...x, rotulo: e.target.value } : x)))}
              />
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={!!o.obrigatoria}
                  onChange={(e) =>
                    setOpcoes((l) => l.map((x, j) => (j === i ? { chave: x.chave, rotulo: x.rotulo, ...(e.target.checked ? { obrigatoria: true } : {}) } : x)))
                  }
                />
                {t("obrigatória")}
              </label>
              <Button variant="ghost" size="sm" onClick={() => setOpcoes((l) => l.filter((_, j) => j !== i))}>
                {t("Remover")}
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={novaOpcao} disabled={opcoes.length >= 20}>
            {t("Adicionar opção")}
          </Button>
        </fieldset>

        {modelo ? (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={ativo} onCheckedChange={setAtivo} aria-label={t("Modelo ativo")} />
            {t("Modelo ativo (aparece para emitir)")}
          </label>
        ) : null}
        <Button onClick={() => salvar.mutate()} disabled={!nome.trim() || !conteudo.trim() || !opcoesValidas || salvar.isPending} data-testid="termo-salvar">
          {salvar.isPending ? t("Salvando…") : t("Salvar")}
        </Button>
        {modelo ? <p className="text-xs text-text-muted">{t("Mudar o texto ou as opções publica uma versão nova. Quem já aceitou continua ligado à versão que aceitou.")}</p> : null}
      </div>
      <aside className="space-y-2 lg:sticky lg:top-4 lg:self-start" aria-label={t("Prévia")}>
        <h3 className="text-sm font-semibold">{t("Prévia")}</h3>
        <TextoDoTermo conteudo={renderizarTermo(conteudo || " ", EXEMPLO)} />
      </aside>
    </div>
  );
}
