"use client";

/**
 * FORK clinic (prontuário F6) — o termo na tela e o aceite: o texto inteiro,
 * cada opção com "Sim" / "Não" (nenhuma vem marcada) e o nome digitado por quem
 * aceita. Serve ao aceite presencial (tablet da clínica) e ao link.
 */
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/i18n/useT";
import { escolhasCompletas, type OpcaoDoTermo } from "@/lib/clinic/documentos/tipos";

export function TextoDoTermo({ conteudo }: { conteudo: string }) {
  return (
    <div className="max-h-[50vh] overflow-y-auto rounded-lg border bg-surface p-4 text-sm leading-relaxed whitespace-pre-wrap" tabIndex={0}>
      {conteudo.replace(/^# /gm, "")}
    </div>
  );
}

export function FormularioDeAceite({
  conteudo,
  opcoes,
  enviando,
  aoAceitar,
}: {
  conteudo: string;
  opcoes: readonly OpcaoDoTermo[];
  enviando: boolean;
  aoAceitar: (nome: string, escolhas: Record<string, boolean>) => void;
}) {
  const t = useT();
  const [nome, setNome] = useState("");
  const [escolhas, setEscolhas] = useState<Record<string, boolean>>({});
  const completo = escolhasCompletas(opcoes, escolhas) && nome.trim().length >= 3;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (completo) aoAceitar(nome.trim(), escolhas);
      }}
      data-testid="formulario-de-aceite"
    >
      <TextoDoTermo conteudo={conteudo} />
      {opcoes.length > 0 ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">{t("Responda cada item:")}</legend>
          {opcoes.map((o) => (
            <div key={o.chave} role="radiogroup" aria-label={o.rotulo} className="rounded-lg border p-3" data-testid="opcao-do-termo">
              <p className="text-sm">
                {o.rotulo}
                {o.obrigatoria ? <span className="text-destructive"> *</span> : null}
              </p>
              <div className="mt-2 flex gap-4">
                {[true, false].map((v) => (
                  <label key={String(v)} className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`opcao-${o.chave}`}
                      checked={escolhas[o.chave] === v}
                      onChange={() => setEscolhas((m) => ({ ...m, [o.chave]: v }))}
                      data-testid={`opcao-${o.chave}-${v ? "sim" : "nao"}`}
                    />
                    {v ? t("Sim, autorizo") : t("Não autorizo")}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
      ) : null}
      <label className="block text-sm">
        <span className="block font-medium">{t("Nome completo de quem aceita")}</span>
        <Input
          className="mt-1 h-11"
          value={nome}
          maxLength={160}
          autoComplete="name"
          onChange={(e) => setNome(e.target.value)}
          data-testid="aceite-nome"
        />
      </label>
      <p className="text-xs text-text-muted">
        {t("Ao confirmar, fica registrado que você leu e aceitou este texto, com data, hora e o dispositivo usado.")}
      </p>
      <Button type="submit" className="h-11 w-full sm:w-auto" disabled={!completo || enviando} data-testid="aceite-confirmar">
        {enviando ? t("Enviando…") : t("Li e aceito")}
      </Button>
    </form>
  );
}
