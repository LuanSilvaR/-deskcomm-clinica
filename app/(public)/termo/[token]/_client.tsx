"use client";

/**
 * FORK clinic (prontuário F6) — a página do termo para o paciente: lê pelo
 * token, mostra o texto e as opções, e envia o aceite. Link usado, vencido ou
 * inválido → mensagem clara, sem detalhe do documento.
 */
import { useEffect, useState } from "react";

import { FormularioDeAceite } from "@/components/clinic/documentos/FormularioDeAceite";
import { useT } from "@/hooks/i18n/useT";
import type { OpcaoDoTermo } from "@/lib/clinic/documentos/tipos";

interface Termo {
  titulo: string;
  conteudo: string;
  opcoes: OpcaoDoTermo[];
  clinica: string | null;
}

type Estado = { tipo: "carregando" } | { tipo: "erro"; mensagem: string } | { tipo: "pronto"; termo: Termo } | { tipo: "aceito" };

export function TermoPublico({ token }: { token: string }) {
  const t = useT();
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    void fetch(`/api/v1/publico/termos/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const corpo = (await r.json().catch(() => null)) as { data?: Termo } | null;
        if (!vivo) return;
        if (r.ok && corpo?.data) setEstado({ tipo: "pronto", termo: corpo.data });
        else setEstado({ tipo: "erro", mensagem: r.status === 429 ? "Muitas tentativas. Tente de novo em alguns minutos." : "Este link expirou ou já foi usado. Peça um novo à clínica." });
      })
      .catch(() => vivo && setEstado({ tipo: "erro", mensagem: "Não foi possível abrir o termo." }));
    return () => {
      vivo = false;
    };
  }, [token]);

  async function aceitar(nome: string, escolhas: Record<string, boolean>) {
    setEnviando(true);
    const r = await fetch(`/api/v1/publico/termos/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nome, escolhas }),
    }).catch(() => null);
    setEnviando(false);
    if (r?.ok) setEstado({ tipo: "aceito" });
    else setEstado({ tipo: "erro", mensagem: "Não foi possível registrar o aceite. O link pode ter expirado." });
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-8" data-testid="termo-publico">
      {estado.tipo === "carregando" ? <p className="text-sm text-text-muted">{t("Carregando…")}</p> : null}
      {estado.tipo === "erro" ? (
        <p role="alert" className="text-sm text-destructive">
          {t(estado.mensagem)}
        </p>
      ) : null}
      {estado.tipo === "aceito" ? (
        <p role="status" className="text-base font-medium" data-testid="termo-aceito">
          {t("Pronto! Seu aceite foi registrado. Você já pode fechar esta página.")}
        </p>
      ) : null}
      {estado.tipo === "pronto" ? (
        <>
          <header>
            <h1 className="text-xl font-semibold">{estado.termo.titulo}</h1>
            {estado.termo.clinica ? <p className="text-sm text-text-muted">{estado.termo.clinica}</p> : null}
          </header>
          <FormularioDeAceite conteudo={estado.termo.conteudo} opcoes={estado.termo.opcoes} enviando={enviando} aoAceitar={aceitar} />
        </>
      ) : null}
    </main>
  );
}
