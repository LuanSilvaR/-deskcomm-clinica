"use client";

/**
 * FORK clinic (9015) — a aba POP e a aba Histórico do procedimento.
 *
 *   • sem POP: "Usar modelo padrão" / "Documento em branco" (quem tem pops.editar);
 *   • com POP: cabeçalho documental (código, versão, status; criado, atualizado e
 *     aprovado — por quem e quando, vindos do BANCO, nunca digitados), o
 *     documento (rascunho editável; aprovada só leitura) e as ações por status e
 *     permissão: Salvar (e autosave), Aprovar, Nova versão, Descartar rascunho;
 *   • autosave: 2 s depois de parar de digitar; "Salvando… / Salvo às 22:14 /
 *     Erro ao salvar"; cópia local no navegador enquanto não salva; 409 de outra
 *     pessoa vira aviso com "Recarregar" (nunca sobrescreve);
 *   • Histórico: todas as versões; clicar abre em leitura.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";
import { usePermissoes } from "@/lib/clinic/acesso/use-permissoes";
import type { Documento } from "@/lib/clinic/pops/documento";
import type { VersaoDoPop } from "@/lib/clinic/pops/servidor";
import type { Procedimento } from "@/lib/clinic/procedimentos/servidor";

import { EditorDoPop } from "./EditorDoPop";

export const ROTULO_DO_STATUS_DO_POP: Record<VersaoDoPop["status"], string> = {
  draft: "Rascunho",
  approved: "Aprovado",
  superseded: "Substituído",
  archived: "Arquivado",
};
const VARIANTE: Record<VersaoDoPop["status"], "warning" | "success" | "neutral"> = {
  draft: "warning",
  approved: "success",
  superseded: "neutral",
  archived: "neutral",
};

interface DadosDoPop {
  pop: { id: string; procedure_id: string; code: string };
  versoes: VersaoDoPop[];
  nomes: Record<string, string>;
}

const rotulo = (v: { major: number; minor: number }) => `${v.major}.${v.minor}`;

/** Abre o PDF A4 da versão numa aba nova (a rota confere pops.imprimir). */
function BotaoImprimir({ versaoId, rotuloDaVersao }: { versaoId: string; rotuloDaVersao: string }) {
  const t = useT();
  return (
    <Button asChild variant="outline" size="sm">
      <a
        href={`/api/v1/clinic/pops/versoes/${versaoId}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="pop-imprimir"
        aria-label={`${t("Imprimir")} — ${t("versão")} ${rotuloDaVersao}`}
      >
        {t("Imprimir")}
      </a>
    </Button>
  );
}

/** Data e hora no idioma de quem lê (a camada de i18n dá a tag). */
function dataHora(iso: string | null, tag: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(tag, { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

function usePop(popId: string | null) {
  return useQuery({
    queryKey: ["clinic", "pop", popId],
    queryFn: async () => (await apiClient.get<{ data: DadosDoPop }>(`/api/v1/clinic/pops/${popId}`)).data,
    enabled: Boolean(popId),
  });
}

function useVersao(id: string | null) {
  return useQuery({
    queryKey: ["clinic", "pop-versao", id],
    queryFn: async () => (await apiClient.get<{ data: { versao: VersaoDoPop & { content: Documento }; nomes: Record<string, string> } }>(`/api/v1/clinic/pops/versoes/${id}`)).data,
    enabled: Boolean(id),
  });
}

export function CabecalhoDoPop({
  codigo,
  procedimento,
  versao,
  nomes,
}: {
  codigo: string;
  procedimento: string;
  versao: VersaoDoPop;
  nomes: Record<string, string>;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const nome = (id: string | null) => (id ? (nomes[id] ?? t("Usuário")) : "—");
  return (
    <section className="rounded-xl border bg-surface p-4 text-sm" aria-label={t("Dados do documento")} data-testid="pop-cabecalho" data-status={versao.status}>
      <p className="text-xs font-medium tracking-wider text-text-muted uppercase">{t("Procedimento operacional padrão — POP")}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-lg font-semibold">{procedimento}</span>
        <span data-testid="pop-codigo">{codigo}</span>
        <span data-testid="pop-versao">
          {t("Versão")} {rotulo(versao)}
        </span>
        <Badge variant={VARIANTE[versao.status]} data-testid="pop-status">
          {t(ROTULO_DO_STATUS_DO_POP[versao.status])}
        </Badge>
      </div>
      {versao.status === "superseded" ? (
        <p className="mt-2 rounded-md bg-warning-bg px-3 py-1.5 text-warning-fg" role="status" data-testid="pop-nao-vigente">
          {t("Versão substituída — não é a vigente.")}
        </p>
      ) : null}
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-text-muted">{t("Criado por")}</dt>
          <dd data-testid="pop-criado">
            {nome(versao.created_by)} · {dataHora(versao.created_at, tag)}
          </dd>
        </div>
        <div>
          <dt className="text-text-muted">{t("Última atualização")}</dt>
          <dd data-testid="pop-atualizado">
            {nome(versao.updated_by)} · {dataHora(versao.updated_at, tag)}
          </dd>
        </div>
        <div>
          <dt className="text-text-muted">{t("Aprovado por")}</dt>
          <dd data-testid="pop-aprovado">{versao.approved_at ? `${nome(versao.approved_by)} · ${dataHora(versao.approved_at, tag)}` : "—"}</dd>
        </div>
      </dl>
      {versao.revision_reason ? (
        <p className="mt-2 text-xs text-text-muted">
          {t("Motivo da revisão")}: {versao.revision_reason}
        </p>
      ) : null}
    </section>
  );
}

type EstadoDoSalvamento = { tipo: "ocioso" } | { tipo: "salvando" } | { tipo: "salvo"; as: string } | { tipo: "erro" } | { tipo: "conflito"; quem: string | null };

const chaveLocal = (id: string) => `pop-rascunho-${id}`;
function lerLocal(id: string): Documento | null {
  try {
    const s = window.localStorage.getItem(chaveLocal(id));
    return s ? (JSON.parse(s) as Documento) : null;
  } catch {
    return null;
  }
}
function gravarLocal(id: string, doc: Documento | null): void {
  try {
    if (doc) window.localStorage.setItem(chaveLocal(id), JSON.stringify(doc));
    else window.localStorage.removeItem(chaveLocal(id));
  } catch {
    // navegador sem armazenamento: o autosave continua valendo
  }
}

/** O rascunho aberto no editor, com autosave e trava otimista. */
function RascunhoEditavel({
  versao,
  conteudo,
  onSalvo,
  onConflito,
}: {
  versao: VersaoDoPop;
  conteudo: Documento;
  onSalvo: (v: VersaoDoPop) => void;
  onConflito: () => void;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const lock = React.useRef(versao.lock_version);
  const pendente = React.useRef<Documento | null>(null);
  const [estado, setEstado] = React.useState<EstadoDoSalvamento>({ tipo: "ocioso" });
  const [recuperavel, setRecuperavel] = React.useState<Documento | null>(null);
  const [inicial, setInicial] = React.useState(conteudo);
  const [chaveDoEditor, setChaveDoEditor] = React.useState(0);

  React.useEffect(() => {
    const local = lerLocal(versao.id);
    // O armazenamento do navegador só existe no cliente: ler no inicializador
    // quebraria a hidratação (cerca hidratacao-useState-nao-le-o-navegador).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (local && JSON.stringify(local) !== JSON.stringify(conteudo)) setRecuperavel(local);
  }, [versao.id, conteudo]);

  const salvar = React.useCallback(async () => {
    const doc = pendente.current;
    if (!doc) return;
    setEstado({ tipo: "salvando" });
    try {
      const r = await apiClient.patch<{ data: VersaoDoPop }>(`/api/v1/clinic/pops/versoes/${versao.id}`, { content: doc, lock_version: lock.current });
      lock.current = r.data.lock_version;
      if (pendente.current === doc) {
        pendente.current = null;
        gravarLocal(versao.id, null);
      }
      setEstado({ tipo: "salvo", as: new Intl.DateTimeFormat(tag, { timeStyle: "short" }).format(new Date()) });
      onSalvo(r.data);
    } catch (e) {
      if (e instanceof ApiError && e.code === "pop_editado_por_outra_pessoa") {
        setEstado({ tipo: "conflito", quem: ((e.details as { atualizado_por?: string } | undefined)?.atualizado_por as string | undefined) ?? null });
        onConflito();
        return;
      }
      setEstado({ tipo: "erro" });
    }
  }, [versao.id, onSalvo, onConflito, tag]);

  const temporizador = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const aoMudar = React.useCallback(
    (doc: Documento) => {
      pendente.current = doc;
      gravarLocal(versao.id, doc);
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => void salvar(), 2000);
    },
    [versao.id, salvar],
  );
  React.useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);

  return (
    <div className="space-y-2">
      {recuperavel ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning bg-warning-bg px-3 py-2 text-sm text-warning-fg" role="status">
          <span>{t("Há um texto deste rascunho que não chegou a ser salvo neste navegador.")}</span>
          <span className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setInicial(recuperavel);
                setChaveDoEditor((k) => k + 1);
                aoMudar(recuperavel);
                setRecuperavel(null);
              }}
            >
              {t("Recuperar")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                gravarLocal(versao.id, null);
                setRecuperavel(null);
              }}
            >
              {t("Descartar")}
            </Button>
          </span>
        </div>
      ) : null}
      {estado.tipo === "conflito" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-error bg-error-bg px-3 py-2 text-sm text-error-fg" role="alert" data-testid="pop-conflito">
          <span>
            {t("Outra pessoa alterou este rascunho")}
            {estado.quem ? ` (${estado.quem})` : ""}. {t("Seu texto está guardado neste navegador; recarregue para ver a versão atual.")}
          </span>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            {t("Recarregar")}
          </Button>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-muted" aria-live="polite" data-testid="pop-salvamento">
          {estado.tipo === "salvando"
            ? t("Salvando…")
            : estado.tipo === "salvo"
              ? `${t("Salvo às")} ${estado.as}`
              : estado.tipo === "erro"
                ? t("Erro ao salvar — tente de novo.")
                : t("As alterações são salvas sozinhas.")}
        </p>
        <Button size="sm" variant="outline" data-testid="pop-salvar" disabled={estado.tipo === "salvando" || estado.tipo === "conflito"} onClick={() => void salvar()}>
          {t("Salvar")}
        </Button>
      </div>
      <EditorDoPop key={chaveDoEditor} conteudo={inicial} editavel={estado.tipo !== "conflito"} onChange={aoMudar} rotulo={t("Conteúdo do POP")} />
    </div>
  );
}

export function AbaDoPop({ procedimento }: { procedimento: Procedimento }) {
  const t = useT();
  const qc = useQueryClient();
  const { can } = usePermissoes();
  const podeEditar = can("pops.editar");
  const podeAprovar = can("pops.aprovar");
  const popId = procedimento.pop?.id ?? null;
  const pop = usePop(popId);
  const versoes = pop.data?.versoes ?? [];
  const rascunho = versoes.find((v) => v.status === "draft") ?? null;
  const vigente = versoes.find((v) => v.status === "approved") ?? null;
  const aberta = rascunho ?? vigente;
  const doc = useVersao(aberta?.id ?? null);
  const [novaAberta, setNovaAberta] = React.useState(false);
  const [maior, setMaior] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [lockAtual, setLockAtual] = React.useState<number | null>(null);

  const recarregar = React.useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["clinic", "procedimentos"] });
    void qc.invalidateQueries({ queryKey: ["clinic", "pop"] });
    void qc.invalidateQueries({ queryKey: ["clinic", "pop-versao"] });
  }, [qc]);

  const criar = useMutation({
    mutationFn: (modelo: "padrao" | "branco") => apiClient.post(`/api/v1/clinic/procedimentos/${procedimento.id}/pop`, { modelo }),
    onSuccess: () => {
      toast.success(t("POP criado em rascunho (versão 1.0)."));
      recarregar();
    },
    onError: showApiError,
  });
  const aprovar = useMutation({
    mutationFn: (v: VersaoDoPop) => apiClient.post(`/api/v1/clinic/pops/versoes/${v.id}/aprovar`, { lock_version: lockAtual ?? v.lock_version }),
    onSuccess: () => {
      toast.success(t("Versão aprovada. Agora ela é a vigente."));
      recarregar();
    },
    onError: showApiError,
  });
  const novaVersao = useMutation({
    mutationFn: () => apiClient.post(`/api/v1/clinic/pops/${popId}/versoes`, { maior, motivo: motivo.trim() || null }),
    onSuccess: () => {
      toast.success(t("Nova versão criada em rascunho."));
      setNovaAberta(false);
      setMotivo("");
      setMaior(false);
      recarregar();
    },
    onError: showApiError,
  });
  const descartar = useMutation({
    mutationFn: (v: VersaoDoPop) => apiClient.delete(`/api/v1/clinic/pops/versoes/${v.id}`),
    onSuccess: () => {
      toast.success(t("Rascunho descartado."));
      recarregar();
    },
    onError: showApiError,
  });

  if (!popId) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-sm" data-testid="pop-sem">
        <p className="font-medium">{t("Este procedimento ainda não tem POP.")}</p>
        {podeEditar ? (
          <>
            <p className="mt-1 text-text-muted">{t("Comece pelo modelo com as seções usuais ou por um documento em branco. Depois, edite à vontade.")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button data-testid="pop-novo-modelo" disabled={criar.isPending} onClick={() => criar.mutate("padrao")}>
                {t("Usar modelo padrão")}
              </Button>
              <Button variant="outline" data-testid="pop-novo-branco" disabled={criar.isPending} onClick={() => criar.mutate("branco")}>
                {t("Documento em branco")}
              </Button>
            </div>
          </>
        ) : (
          <p className="mt-1 text-text-muted">{t("Quem tem permissão para editar POP pode criar.")}</p>
        )}
      </div>
    );
  }
  if (pop.isLoading || doc.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (!pop.data || !aberta || !doc.data) return <p className="text-sm text-destructive">{t("Não foi possível carregar o POP.")}</p>;

  const v = { ...aberta, ...doc.data.versao };
  const nomes = { ...pop.data.nomes, ...doc.data.nomes };
  const editavel = v.status === "draft" && podeEditar;

  return (
    <div className="space-y-3" data-testid="pop-aba">
      <CabecalhoDoPop codigo={pop.data.pop.code} procedimento={procedimento.name} versao={v} nomes={nomes} />

      <div className="flex flex-wrap gap-2">
        {v.status === "draft" && podeAprovar ? (
          <Button
            data-testid="pop-aprovar"
            disabled={aprovar.isPending}
            onClick={() => {
              if (window.confirm(t("Aprovar esta versão? Depois de aprovada, ela não pode mais ser editada — só por uma nova versão."))) aprovar.mutate(v);
            }}
          >
            {t("Aprovar")}
          </Button>
        ) : null}
        {v.status === "approved" && !rascunho && podeEditar ? (
          <Button variant="outline" data-testid="pop-nova-versao" onClick={() => setNovaAberta((x) => !x)} aria-expanded={novaAberta}>
            {t("Nova versão")}
          </Button>
        ) : null}
        {v.status === "draft" && vigente && podeEditar ? (
          <Button
            variant="ghost"
            data-testid="pop-descartar"
            disabled={descartar.isPending}
            onClick={() => {
              if (window.confirm(t("Descartar este rascunho? A versão vigente continua valendo."))) descartar.mutate(v);
            }}
          >
            {t("Descartar rascunho")}
          </Button>
        ) : null}
        {can("pops.imprimir") ? <BotaoImprimir versaoId={v.id} rotuloDaVersao={rotulo(v)} /> : null}
        {vigente && rascunho ? (
          <span className="self-center text-xs text-text-muted">
            {t("Vigente")}: {t("versão")} {rotulo(vigente)}
          </span>
        ) : null}
      </div>

      {novaAberta ? (
        <form
          className="space-y-2 rounded-xl border p-3"
          data-testid="pop-nova-versao-form"
          onSubmit={(e) => {
            e.preventDefault();
            novaVersao.mutate();
          }}
        >
          <label htmlFor="pop-motivo" className="block text-sm font-medium">
            {t("Motivo da revisão")}
          </label>
          <Input id="pop-motivo" data-testid="pop-motivo" maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t("Ex.: atualização dos EPIs")} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" data-testid="pop-maior" checked={maior} onChange={(e) => setMaior(e.target.checked)} />
            {t("Revisão maior")} ({vigente ? `${vigente.major + 1}.0` : ""} {t("em vez de")} {vigente ? `${vigente.major}.${vigente.minor + 1}` : ""})
          </label>
          <Button type="submit" size="sm" data-testid="pop-criar-versao" disabled={novaVersao.isPending}>
            {t("Criar rascunho da nova versão")}
          </Button>
        </form>
      ) : null}

      {editavel ? (
        <RascunhoEditavel
          key={v.id}
          versao={v}
          conteudo={doc.data.versao.content}
          onSalvo={(salvo) => {
            setLockAtual(salvo.lock_version);
            qc.setQueryData(["clinic", "pop", popId], (d: DadosDoPop | undefined) =>
              d ? { ...d, versoes: d.versoes.map((x) => (x.id === salvo.id ? { ...x, ...salvo } : x)) } : d,
            );
          }}
          onConflito={() => undefined}
        />
      ) : (
        <EditorDoPop key={v.id} conteudo={doc.data.versao.content} editavel={false} rotulo={t("Conteúdo do POP")} />
      )}
    </div>
  );
}

export function AbaDoHistorico({ procedimento }: { procedimento: Procedimento }) {
  const t = useT();
  const popId = procedimento.pop?.id ?? null;
  const pop = usePop(popId);
  const tag = useTagDeIdioma();
  const { can } = usePermissoes();
  const [aberta, setAberta] = React.useState<string | null>(null);
  const doc = useVersao(aberta);

  if (!popId) return <p className="text-sm text-text-muted">{t("Este procedimento ainda não tem POP.")}</p>;
  if (pop.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  const dados = pop.data;
  if (!dados) return <p className="text-sm text-destructive">{t("Não foi possível carregar o POP.")}</p>;
  const nome = (id: string | null) => (id ? (dados.nomes[id] ?? t("Usuário")) : "—");

  return (
    <div className="space-y-3" data-testid="pop-historico">
      <ul className="divide-y rounded-xl border bg-surface">
        {dados.versoes.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left text-sm hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              aria-expanded={aberta === v.id}
              data-testid="pop-historico-versao"
              data-versao={rotulo(v)}
              data-status={v.status}
              onClick={() => setAberta(aberta === v.id ? null : v.id)}
            >
              <span className="font-medium">
                {t("Versão")} {rotulo(v)}
              </span>
              <Badge variant={VARIANTE[v.status]}>{t(ROTULO_DO_STATUS_DO_POP[v.status])}</Badge>
              <span className="text-xs text-text-muted">
                {v.approved_at ? `${t("Aprovado por")} ${nome(v.approved_by)} · ${dataHora(v.approved_at, tag)}` : `${t("Criado por")} ${nome(v.created_by)} · ${dataHora(v.created_at, tag)}`}
              </span>
              {v.revision_reason ? <span className="text-xs text-text-muted">· {v.revision_reason}</span> : null}
            </button>
            {aberta === v.id ? (
              <div className="space-y-2 border-t p-3">
                {doc.isLoading || !doc.data ? (
                  <p className="text-sm text-text-muted">{t("Carregando…")}</p>
                ) : (
                  <>
                    {can("pops.imprimir") ? <BotaoImprimir versaoId={v.id} rotuloDaVersao={rotulo(v)} /> : null}
                    <CabecalhoDoPop codigo={dados.pop.code} procedimento={procedimento.name} versao={doc.data.versao} nomes={{ ...dados.nomes, ...doc.data.nomes }} />
                    <EditorDoPop key={v.id} conteudo={doc.data.versao.content} editavel={false} rotulo={`${t("Conteúdo do POP")} ${rotulo(v)}`} />
                  </>
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
