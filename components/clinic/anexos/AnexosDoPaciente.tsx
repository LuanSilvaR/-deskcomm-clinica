"use client";

/**
 * FORK clinic (prontuário F7) — fotos e documentos do paciente.
 *
 * Enviar foto (a câmera do tablet abre direto): comprimida AQUI, no navegador
 * (WebP 1600 px + miniatura, sem GPS) antes de subir. Enviar PDF. Grade de
 * miniaturas, abrir inteira (URL de 60 s), comparar antes/depois lado a lado,
 * anular com motivo e marcar para divulgação — só nas finalidades que o
 * paciente autorizou no termo de uso de imagem. Barra de uso da cota da clínica.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";
import { comprimirFoto } from "@/lib/clinic/anexos/compressao";

interface Anexo {
  id: string;
  tipo: "foto" | "documento";
  mime: string;
  bytes: number;
  nome_original: string | null;
  descricao: string | null;
  regiao: string | null;
  momento: "antes" | "durante" | "depois" | "acompanhamento" | null;
  capturada_em: string | null;
  divulgacao_opcao: string | null;
  status: "ativo" | "anulado";
  anulado_motivo: string | null;
  atendimento_id: string | null;
  tem_miniatura: boolean;
  created_at: string;
}
interface Dados {
  anexos: Anexo[];
  uso: { usados: number; cota: number } | null;
  divulgacao_autorizada: string[];
  pode_enviar_foto: boolean;
  pode_enviar_anexo: boolean;
}

const ROTULO_DO_MOMENTO: Record<NonNullable<Anexo["momento"]>, string> = {
  antes: "Antes",
  durante: "Durante",
  depois: "Depois",
  acompanhamento: "Acompanhamento",
};
const ROTULO_DA_DIVULGACAO: Record<string, string> = {
  ensino_sem_identificacao: "Ensino, sem identificação",
  divulgacao_sem_rosto: "Divulgação sem mostrar o rosto",
  divulgacao_com_identificacao: "Divulgação com identificação",
};
const SELECT = "h-11 w-full rounded-md border bg-surface px-2 text-sm md:h-9";
const mb = (b: number) => (b / 1048576).toLocaleString(undefined, { maximumFractionDigits: 1 });

async function enviar(contactId: string, form: FormData): Promise<void> {
  const r = await fetch(`/api/v1/clinic/pacientes/${contactId}/anexos`, { method: "POST", body: form, credentials: "same-origin" });
  if (!r.ok) {
    const corpo = (await r.json().catch(() => null)) as { error?: { code?: string; message?: string; request_id?: string } } | null;
    throw new ApiError(r.status, corpo?.error?.code ?? "internal_error", undefined, corpo?.error?.request_id ?? "", corpo?.error?.message ?? "");
  }
}

export function AnexosDoPaciente({ contactId, atendimentoId }: { contactId: string; atendimentoId?: string }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const qc = useQueryClient();
  const chave = ["clinic", "anexos", contactId];
  const [filtro, setFiltro] = useState<"todos" | "foto" | "documento">("todos");
  const [comparar, setComparar] = useState<string[]>([]);
  const q = useQuery({
    queryKey: chave,
    queryFn: async () => (await apiClient.get<{ data: Dados }>(`/api/v1/clinic/pacientes/${contactId}/anexos`)).data,
  });
  const recarregar = () => void qc.invalidateQueries({ queryKey: chave });
  const mudar = useMutation({
    mutationFn: ({ id, corpo }: { id: string; corpo: Record<string, unknown> }) => apiClient.patch(`/api/v1/clinic/anexos/${id}`, corpo),
    onSuccess: recarregar,
    onError: showApiError,
  });

  if (q.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (q.isError || !q.data) return <p className="text-sm text-destructive">{t("Não foi possível carregar os arquivos.")}</p>;
  const d = q.data;
  const lista = d.anexos.filter((a) => (filtro === "todos" || a.tipo === filtro) && (!atendimentoId || a.atendimento_id === atendimentoId));
  const fotosComparadas = comparar.map((id) => d.anexos.find((a) => a.id === id)).filter((a): a is Anexo => !!a);

  return (
    <div className="space-y-4" data-testid="anexos-do-paciente">
      {d.uso ? (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={d.uso.cota} aria-valuenow={d.uso.usados} aria-label={t("Espaço usado pela clínica")}>
            <div
              className={d.uso.usados / d.uso.cota >= 0.8 ? "h-full bg-destructive" : "h-full bg-primary"}
              style={{ width: `${Math.min(100, (d.uso.usados / Math.max(1, d.uso.cota)) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-text-muted">
            {t("Espaço da clínica:")} {mb(d.uso.usados)} MB {t("de")} {mb(d.uso.cota)} MB
            {d.uso.usados / d.uso.cota >= 0.8 ? ` · ${t("quase cheio")}` : ""}
          </p>
        </div>
      ) : null}

      {d.pode_enviar_foto || d.pode_enviar_anexo ? (
        <Envio contactId={contactId} atendimentoId={atendimentoId} dados={d} aoEnviar={recarregar} />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <select aria-label={t("Filtrar")} className={`${SELECT} w-auto`} value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
          <option value="todos">{t("Todos")}</option>
          <option value="foto">{t("Fotos")}</option>
          <option value="documento">{t("Documentos")}</option>
        </select>
        {comparar.length > 0 ? (
          <Button size="sm" variant="ghost" onClick={() => setComparar([])}>
            {t("Limpar comparação")}
          </Button>
        ) : null}
      </div>

      {fotosComparadas.length === 2 ? (
        <section aria-label={t("Comparar fotos")} className="grid grid-cols-2 gap-2" data-testid="comparacao">
          {fotosComparadas.map((a) => (
            <figure key={a.id} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada de 60 s, fora do otimizador */}
              <img src={`/api/v1/clinic/anexos/${a.id}`} alt={a.descricao ?? t("Foto clínica")} className="w-full rounded-lg border object-contain" />
              <figcaption className="text-xs text-text-muted">
                {a.momento ? t(ROTULO_DO_MOMENTO[a.momento]) : ""} · {new Date(a.capturada_em ?? a.created_at).toLocaleDateString(tag)}
                {a.regiao ? ` · ${a.regiao}` : ""}
              </figcaption>
            </figure>
          ))}
        </section>
      ) : null}

      {lista.length === 0 ? <p className="text-sm text-text-muted">{t("Nenhum arquivo.")}</p> : null}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {lista.map((a) => (
          <li key={a.id} className={`space-y-1 rounded-lg border p-2 text-xs ${a.status === "anulado" ? "opacity-60" : ""}`} data-testid="anexo">
            {a.tipo === "foto" ? (
              <a href={`/api/v1/clinic/anexos/${a.id}`} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura por URL assinada */}
                <img
                  src={`/api/v1/clinic/anexos/${a.id}?miniatura=1`}
                  alt={a.descricao ?? t("Foto clínica")}
                  loading="lazy"
                  className="aspect-square w-full rounded-md object-cover"
                />
              </a>
            ) : (
              <a
                href={`/api/v1/clinic/anexos/${a.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex aspect-square items-center justify-center rounded-md bg-muted text-sm font-medium underline-offset-4 hover:underline"
              >
                PDF
              </a>
            )}
            <p className="truncate" title={a.descricao ?? a.nome_original ?? ""}>
              {a.descricao ?? a.nome_original ?? (a.tipo === "foto" ? t("Foto") : t("Documento"))}
            </p>
            <p className="text-text-muted">
              {new Date(a.capturada_em ?? a.created_at).toLocaleDateString(tag)}
              {a.momento ? ` · ${t(ROTULO_DO_MOMENTO[a.momento])}` : ""}
              {a.regiao ? ` · ${a.regiao}` : ""}
            </p>
            {a.status === "anulado" ? (
              <Badge variant="secondary">
                {t("Anulado")}: {a.anulado_motivo}
              </Badge>
            ) : null}
            {a.divulgacao_opcao ? <Badge>{t(ROTULO_DA_DIVULGACAO[a.divulgacao_opcao] ?? a.divulgacao_opcao)}</Badge> : null}
            {a.status === "ativo" ? (
              <div className="flex flex-wrap gap-1">
                {a.tipo === "foto" ? (
                  <Button
                    size="sm"
                    variant={comparar.includes(a.id) ? "default" : "ghost"}
                    onClick={() => setComparar((l) => (l.includes(a.id) ? l.filter((x) => x !== a.id) : [...l, a.id].slice(-2)))}
                    data-testid="anexo-comparar"
                  >
                    {t("Comparar")}
                  </Button>
                ) : null}
                {(a.tipo === "foto" ? d.pode_enviar_foto : d.pode_enviar_anexo) ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const motivo = window.prompt(t("Motivo para anular este arquivo"));
                      if (motivo && motivo.trim().length >= 3) mudar.mutate({ id: a.id, corpo: { acao: "anular", motivo: motivo.trim() } });
                    }}
                  >
                    {t("Anular")}
                  </Button>
                ) : null}
                {a.tipo === "foto" && d.pode_enviar_foto && (d.divulgacao_autorizada.length > 0 || a.divulgacao_opcao) ? (
                  <select
                    aria-label={t("Uso da imagem")}
                    className="h-9 w-full rounded-md border bg-surface px-1 text-xs"
                    value={a.divulgacao_opcao ?? ""}
                    onChange={(e) => mudar.mutate({ id: a.id, corpo: { acao: "divulgacao", opcao: e.target.value || null } })}
                  >
                    <option value="">{t("Só uso clínico")}</option>
                    {d.divulgacao_autorizada.map((o) => (
                      <option key={o} value={o}>
                        {t(ROTULO_DA_DIVULGACAO[o] ?? o)}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {d.divulgacao_autorizada.length === 0 ? (
        <p className="text-xs text-text-muted">
          {t("Fotos são de uso clínico. Para usar em divulgação ou ensino, o paciente precisa aceitar a autorização de uso de imagem (aba Documentos).")}
        </p>
      ) : null}
    </div>
  );
}

function Envio({
  contactId,
  atendimentoId,
  dados,
  aoEnviar,
}: {
  contactId: string;
  atendimentoId?: string;
  dados: Dados;
  aoEnviar: () => void;
}) {
  const t = useT();
  const entrada = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState<"foto" | "documento">(dados.pode_enviar_foto ? "foto" : "documento");
  const [momento, setMomento] = useState<"" | NonNullable<Anexo["momento"]>>("");
  const [regiao, setRegiao] = useState("");
  const [descricao, setDescricao] = useState("");
  const [estado, setEstado] = useState<string | null>(null);
  const subir = useMutation({
    mutationFn: async (arquivos: File[]) => {
      for (const [i, original] of arquivos.entries()) {
        setEstado(`${t("Enviando")} ${i + 1}/${arquivos.length}…`);
        const form = new FormData();
        const base = {
          tipo,
          descricao: descricao.trim() || null,
          regiao: regiao.trim() || null,
          momento: momento || null,
          atendimento_id: atendimentoId ?? null,
          capturada_em: new Date(original.lastModified || Date.now()).toISOString(),
        };
        if (tipo === "foto") {
          const f = await comprimirFoto(original);
          form.append("arquivo", f.arquivo, "foto.webp");
          form.append("miniatura", f.miniatura, "miniatura.webp");
          form.append("dados", JSON.stringify({ ...base, largura: f.largura, altura: f.altura }));
        } else {
          form.append("arquivo", original, original.name);
          form.append("dados", JSON.stringify(base));
        }
        await enviar(contactId, form);
      }
    },
    onSuccess: () => {
      setEstado(null);
      setDescricao("");
      if (entrada.current) entrada.current.value = "";
      aoEnviar();
    },
    onError: (e) => {
      setEstado(null);
      showApiError(e);
    },
  });
  return (
    <div className="grid gap-2 rounded-xl border p-3 sm:grid-cols-4" data-testid="anexo-envio">
      <label className="block text-sm">
        <span className="block text-xs text-text-muted">{t("Tipo")}</span>
        <select className={`mt-1 ${SELECT}`} value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
          {dados.pode_enviar_foto ? <option value="foto">{t("Foto")}</option> : null}
          {dados.pode_enviar_anexo ? <option value="documento">{t("Documento (PDF)")}</option> : null}
        </select>
      </label>
      {tipo === "foto" ? (
        <>
          <label className="block text-sm">
            <span className="block text-xs text-text-muted">{t("Momento")}</span>
            <select className={`mt-1 ${SELECT}`} value={momento} onChange={(e) => setMomento(e.target.value as typeof momento)}>
              <option value="">—</option>
              {(Object.keys(ROTULO_DO_MOMENTO) as Array<keyof typeof ROTULO_DO_MOMENTO>).map((m) => (
                <option key={m} value={m}>
                  {t(ROTULO_DO_MOMENTO[m])}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="block text-xs text-text-muted">{t("Região")}</span>
            <Input className="mt-1 h-11 md:h-9" maxLength={120} value={regiao} onChange={(e) => setRegiao(e.target.value)} />
          </label>
        </>
      ) : null}
      <label className="block text-sm">
        <span className="block text-xs text-text-muted">{t("Descrição")}</span>
        <Input className="mt-1 h-11 md:h-9" maxLength={500} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </label>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-4">
        <input
          ref={entrada}
          type="file"
          aria-label={t("Escolher arquivos")}
          accept={tipo === "foto" ? "image/jpeg,image/png,image/webp" : "application/pdf"}
          capture={tipo === "foto" ? "environment" : undefined}
          multiple
          className="text-sm"
          data-testid="anexo-arquivo"
          onChange={(e) => {
            const arquivos = Array.from(e.target.files ?? []);
            if (arquivos.length) subir.mutate(arquivos);
          }}
        />
        {estado ? <span className="text-xs text-text-muted" role="status">{estado}</span> : null}
      </div>
      <p className="text-xs text-text-muted sm:col-span-4">
        {tipo === "foto"
          ? t("A foto é reduzida e convertida no próprio aparelho antes de enviar; localização e dados da câmera são descartados.")
          : t("PDF de até 10 MB.")}
      </p>
    </div>
  );
}
