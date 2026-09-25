"use client";

/**
 * FORK clinic (prontuário F6) — contratos e termos do paciente.
 *
 * Emitir a partir de um modelo, colher o aceite no tablet da clínica ou gerar
 * o link para o paciente aceitar à distância, revogar (ex.: uso de imagem) ou
 * cancelar o que ainda não foi respondido. Cada documento mostra a versão
 * congelada (hash) e o histórico de aceite/revogação. Na seção Documentos do
 * atendimento, a emissão já vai ligada ao atendimento.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  FormularioDeAceite,
  TextoDoTermo,
} from "@/components/clinic/documentos/FormularioDeAceite";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import {
  opcoesDoTermoSchema,
  ROTULO_DO_STATUS_DO_DOCUMENTO,
  ROTULO_DO_TIPO_DE_DOCUMENTO,
  type OpcaoDoTermo,
  type TipoDeDocumento,
} from "@/lib/clinic/documentos/tipos";

interface Aceite {
  id: string;
  tipo: "aceite" | "revogacao";
  canal: "presencial" | "link";
  nome_digitado: string | null;
  opcoes_escolhidas: Record<string, boolean>;
  motivo: string | null;
  created_at: string;
}
interface Documento {
  id: string;
  tipo: TipoDeDocumento;
  titulo: string;
  conteudo: string;
  opcoes: unknown;
  sha256: string;
  status: "emitido" | "aceito" | "revogado" | "cancelado";
  motivo: string | null;
  validade_ate: string | null;
  atendimento_id: string | null;
  created_at: string;
  clinic_documento_aceites: Aceite[] | null;
}
interface Dados {
  documentos: Documento[];
  pode_emitir: boolean;
  pode_colher_aceite: boolean;
  pode_revogar: boolean;
}
interface ModeloDoc {
  id: string;
  tipo: TipoDeDocumento;
  nome: string;
  ativo: boolean;
  versao_id: string | null;
}

const SELECT = "h-11 w-full rounded-md border bg-surface px-2 text-sm md:h-9";
const opcoesDe = (d: Documento): OpcaoDoTermo[] => {
  const r = opcoesDoTermoSchema.safeParse(d.opcoes);
  return r.success ? r.data : [];
};

export function DocumentosDoPaciente({
  contactId,
  atendimentoId,
}: {
  contactId: string;
  atendimentoId?: string;
}) {
  const t = useT();
  const chave = ["clinic", "documentos", contactId];
  const q = useQuery({
    queryKey: chave,
    queryFn: async () =>
      (await apiClient.get<{ data: Dados }>(`/api/v1/clinic/pacientes/${contactId}/documentos`))
        .data,
  });
  if (q.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (q.isError || !q.data)
    return (
      <p className="text-sm text-destructive">{t("Não foi possível carregar os documentos.")}</p>
    );
  const d = q.data;
  const lista = atendimentoId
    ? d.documentos.filter((x) => x.atendimento_id === atendimentoId || x.status === "emitido")
    : d.documentos;
  return (
    <div className="space-y-4" data-testid="documentos-do-paciente">
      {d.pode_emitir ? (
        <EmitirDocumento contactId={contactId} atendimentoId={atendimentoId} chave={chave} />
      ) : null}
      {lista.length === 0 ? (
        <p className="text-sm text-text-muted">{t("Nenhum documento emitido.")}</p>
      ) : null}
      <ul className="space-y-3">
        {lista.map((doc) => (
          <CartaoDoDocumento key={doc.id} doc={doc} dados={d} chave={chave} />
        ))}
      </ul>
    </div>
  );
}

function EmitirDocumento({
  contactId,
  atendimentoId,
  chave,
}: {
  contactId: string;
  atendimentoId?: string;
  chave: readonly unknown[];
}) {
  const t = useT();
  const qc = useQueryClient();
  const [versao, setVersao] = useState("");
  const [procedimento, setProcedimento] = useState("");
  const [validade, setValidade] = useState("");
  const modelos = useQuery({
    queryKey: ["clinic", "documentos", "modelos"],
    queryFn: async () =>
      (await apiClient.get<{ data: { modelos: ModeloDoc[] } }>("/api/v1/clinic/documentos/modelos"))
        .data.modelos,
  });
  const escolhido = (modelos.data ?? []).find((m) => m.versao_id === versao);
  const emitir = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/v1/clinic/pacientes/${contactId}/documentos`, {
        modelo_versao_id: versao,
        procedimento: procedimento.trim() || null,
        atendimento_id: atendimentoId ?? null,
        validade_ate: validade || null,
      }),
    onSuccess: () => {
      setVersao("");
      setProcedimento("");
      setValidade("");
      void qc.invalidateQueries({ queryKey: chave });
    },
    onError: showApiError,
  });
  return (
    <form
      className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_auto_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        emitir.mutate();
      }}
    >
      <label className="block text-sm">
        <span className="block text-xs text-text-muted">{t("Documento")}</span>
        <select
          className={`mt-1 ${SELECT}`}
          value={versao}
          onChange={(e) => setVersao(e.target.value)}
          data-testid="documento-modelo"
        >
          <option value="">{t("Escolha o modelo")}</option>
          {(modelos.data ?? [])
            .filter((m) => m.ativo && m.versao_id)
            .map((m) => (
              <option key={m.id} value={m.versao_id!}>
                {t(m.nome)}
              </option>
            ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="block text-xs text-text-muted">
          {t("Procedimento (aparece no texto)")}
        </span>
        <Input
          className="mt-1 h-11 md:h-9"
          value={procedimento}
          maxLength={200}
          onChange={(e) => setProcedimento(e.target.value)}
        />
      </label>
      {escolhido?.tipo === "uso_imagem" ? (
        <label className="block text-sm">
          <span className="block text-xs text-text-muted">{t("Válido até")}</span>
          <Input
            type="date"
            className="mt-1 h-11 md:h-9"
            value={validade}
            onChange={(e) => setValidade(e.target.value)}
          />
        </label>
      ) : (
        <span />
      )}
      <Button
        type="submit"
        className="self-end"
        disabled={!versao || emitir.isPending}
        data-testid="documento-emitir"
      >
        {t("Emitir")}
      </Button>
    </form>
  );
}

function CartaoDoDocumento({
  doc,
  dados,
  chave,
}: {
  doc: Documento;
  dados: Dados;
  chave: readonly unknown[];
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [colhendo, setColhendo] = useState(false);
  const [link, setLink] = useState<{ url: string; expira_em: string } | null>(null);
  const recarregar = () => void qc.invalidateQueries({ queryKey: chave });
  const opcoes = opcoesDe(doc);
  const aceites = [...(doc.clinic_documento_aceites ?? [])].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  const quando = (iso: string) =>
    new Date(iso).toLocaleString(tag, { dateStyle: "short", timeStyle: "short" });

  const aceitar = useMutation({
    mutationFn: ({ nome, escolhas }: { nome: string; escolhas: Record<string, boolean> }) =>
      apiClient.post(`/api/v1/clinic/documentos/${doc.id}/aceite`, { nome, escolhas }),
    onSuccess: () => {
      setColhendo(false);
      recarregar();
    },
    onError: showApiError,
  });
  const gerarLink = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<{ data: { url: string; expira_em: string } }>(
          `/api/v1/clinic/documentos/${doc.id}/link`,
          { horas: 72 },
        )
      ).data,
    onSuccess: setLink,
    onError: showApiError,
  });
  const encerrar = useMutation({
    mutationFn: (corpo: { acao: "revogar" | "cancelar"; motivo: string }) =>
      apiClient.post(`/api/v1/clinic/documentos/${doc.id}/encerrar`, corpo),
    onSuccess: recarregar,
    onError: showApiError,
  });
  const pedirMotivo = (acao: "revogar" | "cancelar") => {
    const motivo = window.prompt(
      acao === "revogar" ? t("Motivo da revogação") : t("Motivo do cancelamento"),
    );
    if (motivo && motivo.trim().length >= 3) encerrar.mutate({ acao, motivo: motivo.trim() });
  };

  return (
    <li className="space-y-2 rounded-xl border p-3" data-testid="documento">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{t(doc.titulo)}</p>
          <p className="text-xs text-text-muted">
            {t(ROTULO_DO_TIPO_DE_DOCUMENTO[doc.tipo])} · {t("emitido em")} {quando(doc.created_at)}
            {doc.validade_ate
              ? ` · ${t("válido até")} ${new Date(`${doc.validade_ate}T12:00:00`).toLocaleDateString(tag)}`
              : ""}
          </p>
          <p className="font-mono text-[10px] text-text-subtle" title={doc.sha256}>
            sha256 {doc.sha256.slice(0, 16)}…
          </p>
        </div>
        <Badge
          variant={doc.status === "aceito" ? "default" : "secondary"}
          data-testid="documento-status"
        >
          {t(ROTULO_DO_STATUS_DO_DOCUMENTO[doc.status])}
        </Badge>
      </div>

      {aceites.length > 0 ? (
        <ul className="space-y-1 text-xs text-text-muted">
          {aceites.map((a) => (
            <li key={a.id}>
              {a.tipo === "aceite"
                ? `${t("Aceito por")} ${a.nome_digitado ?? ""} (${a.canal === "link" ? t("pelo link") : t("presencial")}) · ${quando(a.created_at)}`
                : `${t("Revogado")} · ${quando(a.created_at)}${a.motivo ? ` · ${a.motivo}` : ""}`}
              {a.tipo === "aceite" && opcoes.length > 0 ? (
                <span className="block">
                  {opcoes
                    .map(
                      (o) => `${o.rotulo}: ${a.opcoes_escolhidas[o.chave] ? t("sim") : t("não")}`,
                    )
                    .join(" · ")}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={() => setAberto((v) => !v)}>
          {aberto ? t("Ocultar texto") : t("Ver texto")}
        </Button>
        {doc.status === "emitido" && dados.pode_colher_aceite ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setColhendo((v) => !v)}
              data-testid="documento-colher"
            >
              {t("Colher aceite aqui")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => gerarLink.mutate()}
              disabled={gerarLink.isPending}
              data-testid="documento-link"
            >
              {t("Gerar link para o paciente")}
            </Button>
          </>
        ) : null}
        {doc.status === "emitido" && dados.pode_emitir ? (
          <Button size="sm" variant="ghost" onClick={() => pedirMotivo("cancelar")}>
            {t("Cancelar")}
          </Button>
        ) : null}
        {doc.status === "aceito" && dados.pode_revogar ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => pedirMotivo("revogar")}
            data-testid="documento-revogar"
          >
            {t("Revogar")}
          </Button>
        ) : null}
      </div>

      {link ? (
        <div
          className="space-y-1 rounded-lg border bg-muted/40 p-2 text-xs"
          data-testid="documento-link-gerado"
        >
          <p>
            {t("Envie este link ao paciente. Ele vale uma vez só, até")} {quando(link.expira_em)}.
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={link.url}
              className="h-9 font-mono text-xs"
              aria-label={t("Link de aceite")}
            />
            <Button
              size="sm"
              type="button"
              onClick={() => void navigator.clipboard?.writeText(link.url)}
            >
              {t("Copiar")}
            </Button>
          </div>
        </div>
      ) : null}
      {aberto && !colhendo ? <TextoDoTermo conteudo={doc.conteudo} /> : null}
      {colhendo ? (
        <FormularioDeAceite
          conteudo={doc.conteudo}
          opcoes={opcoes}
          enviando={aceitar.isPending}
          aoAceitar={(nome, escolhas) => aceitar.mutate({ nome, escolhas })}
        />
      ) : null}
    </li>
  );
}
