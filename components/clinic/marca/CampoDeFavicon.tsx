"use client";

/**
 * FORK clinic (8012) — o favicon da empresa: o ícone da aba do navegador em /app.
 *
 * Mesmo mecanismo do `CampoDeLogo`: o arquivo sobe NA HORA por rota própria
 * (`/api/v1/clinic/marca/favicon`, multipart), sem passar pelo "Salvar" da marca,
 * e a prévia passa a mostrar o que a rota devolveu sem depender do refresh.
 *
 * A prévia imita uma ABA de navegador, clara e escura, com o ícone em 16 px — o
 * tamanho em que ele de fato aparece — e uma versão grande ao lado, para a
 * pessoa ver o desenho. Sem favicon próprio, a aba mostra o ícone padrão do
 * sistema (`/icon`, desenhado em `app/icon.tsx`).
 */
import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/i18n/useT";
import {
  LADO_IDEAL_DO_FAVICON,
  LADO_MAXIMO_DO_FAVICON,
  LADO_MINIMO_DO_FAVICON,
  TAMANHO_MAXIMO_DO_FAVICON,
} from "@/lib/clinic/marca/favicon";

const ERRO_EM_PORTUGUES: Record<string, string> = {
  unauthenticated: "Sua sessão expirou. Entre de novo para trocar o favicon.",
  forbidden_role: "Só quem administra esta empresa pode trocar o favicon.",
  mfa_required: "Confirme o código do seu aplicativo de duas etapas e tente de novo.",
  rate_limited: "Muitas trocas seguidas. Tente de novo em alguns minutos.",
};

interface Props {
  /** O favicon gravado, já como URL pública. Objeto literal a cada render (ver CampoDeLogo). */
  readonly faviconDaEmpresa: { readonly url: string | null };
  /** O nome que aparece na aba simulada. */
  readonly nomeEmVigor: string;
}

function AbaSimulada({ icone, nome, escura }: { icone: string; nome: string; escura: boolean }) {
  return (
    <div
      className="flex h-12 items-end rounded-sm border border-border px-2 pt-2"
      style={{ backgroundColor: escura ? "#1f1f22" : "#dfe1e5" }}
    >
      <div
        className="flex h-9 w-full max-w-[14rem] items-center gap-2 rounded-t-md px-3"
        style={{ backgroundColor: escura ? "#35363a" : "#ffffff", color: escura ? "#e8eaed" : "#202124" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icone} alt="" aria-hidden className="h-4 w-4 shrink-0 object-contain" />
        <span className="truncate text-xs">{nome}</span>
      </div>
    </div>
  );
}

export function CampoDeFavicon({ faviconDaEmpresa, nomeEmVigor }: Props) {
  const t = useT();
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [, startTransition] = useTransition();
  const hidratado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // A prop do servidor manda quando ela traz novidade; o corpo da rota manda logo
  // depois do envio (mesmo padrão e mesma razão do CampoDeLogo).
  const [gravado, setGravado] = useState<string | null>(faviconDaEmpresa.url);
  const [ultimoDoServidor, setUltimoDoServidor] = useState(faviconDaEmpresa);
  if (faviconDaEmpresa !== ultimoDoServidor) {
    setUltimoDoServidor(faviconDaEmpresa);
    setGravado(faviconDaEmpresa.url);
  }
  const icone = gravado ?? "/icon";

  async function razaoDaFalha(resposta: Response): Promise<string> {
    const corpo = (await resposta.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    const codigo = corpo?.error?.code ?? "";
    return t(ERRO_EM_PORTUGUES[codigo] ?? corpo?.error?.message ?? "Não consegui trocar o favicon agora.");
  }

  async function urlDaResposta(resposta: Response): Promise<string | null | undefined> {
    const corpo = (await resposta.json().catch(() => null)) as { data?: { favicon_url?: string | null } } | null;
    return corpo?.data?.favicon_url;
  }

  async function enviar(arquivo: File) {
    setEnviando(true);
    try {
      const corpo = new FormData();
      corpo.set("file", arquivo);
      const resposta = await fetch("/api/v1/clinic/marca/favicon", { method: "POST", body: corpo });
      if (!resposta.ok) {
        toast.error(await razaoDaFalha(resposta));
        return;
      }
      toast.success(t("Favicon atualizado."));
      const url = await urlDaResposta(resposta);
      if (url !== undefined) setGravado(url);
      startTransition(() => router.refresh());
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function remover() {
    setEnviando(true);
    try {
      const resposta = await fetch("/api/v1/clinic/marca/favicon", { method: "DELETE" });
      if (!resposta.ok) {
        toast.error(await razaoDaFalha(resposta));
        return;
      }
      toast.success(t("Favicon removido."));
      const url = await urlDaResposta(resposta);
      if (url !== undefined) setGravado(url);
      startTransition(() => router.refresh());
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4" data-campo-de-favicon data-hidratado={hidratado ? "" : undefined}>
      <div className="space-y-2">
        <Label htmlFor="favicon-organizacao">{t("Favicon (ícone da aba do navegador)")}</Label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={entrada}
            id="favicon-organizacao"
            type="file"
            accept="image/png"
            disabled={enviando}
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) void enviar(arquivo);
            }}
            className="max-w-xs text-sm file:mr-3 file:cursor-pointer file:rounded-sm file:border file:border-border file:bg-surface-elevated file:px-3 file:py-1.5 file:text-sm"
          />
          {gravado ? (
            <Button type="button" variant="outline" onClick={() => void remover()} disabled={enviando}>
              {t("Remover")}
            </Button>
          ) : null}
        </div>
        <div className="space-y-1 rounded-sm border border-border bg-surface-elevated p-3 text-xs text-text-muted" data-favicon-tamanho-ideal>
          <p className="font-medium text-text">
            {t("Tamanho ideal:")} {LADO_IDEAL_DO_FAVICON} × {LADO_IDEAL_DO_FAVICON} px {t("(quadrado), PNG com fundo transparente.")}
          </p>
          <p>
            {t("Aceita de")} {LADO_MINIMO_DO_FAVICON} {t("a")} {LADO_MAXIMO_DO_FAVICON} px, {t("sempre quadrado, até")}{" "}
            {Math.round(TAMANHO_MAXIMO_DO_FAVICON / 1024)} KB.{" "}
            {t("O navegador desenha o ícone bem pequeno: use só o símbolo da marca, sem o nome escrito.")}
          </p>
          <p>{t("Aparece na aba do navegador em todas as telas do sistema da sua empresa.")}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-text-muted">
          {gravado
            ? t("Como o favicon aparece na aba do navegador:")
            : t("Sem favicon próprio, a aba mostra o ícone padrão do sistema:")}
        </p>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]" data-previa-do-favicon>
          <div className="space-y-1">
            <AbaSimulada icone={icone} nome={nomeEmVigor} escura={false} />
            <p className="text-xs text-text-muted">{t("Navegador claro")}</p>
          </div>
          <div className="space-y-1">
            <AbaSimulada icone={icone} nome={nomeEmVigor} escura />
            <p className="text-xs text-text-muted">{t("Navegador escuro")}</p>
          </div>
          <div className="space-y-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-sm border border-border bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={icone} alt={t("Favicon")} className="h-10 w-10 object-contain" />
            </div>
            <p className="text-xs text-text-muted">{t("Ampliado")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
