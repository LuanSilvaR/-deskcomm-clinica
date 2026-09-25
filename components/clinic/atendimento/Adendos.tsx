"use client";

/**
 * FORK clinic (prontuário F2) — adendos de um registro finalizado: a lista (ao
 * lado do original, que nunca muda) e o formulário "Adicionar adendo" com texto
 * e motivo obrigatórios.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { AdendoLido } from "@/lib/clinic/prontuario/leitura";

export function ListaDeAdendos({ adendos }: { adendos: readonly AdendoLido[] }) {
  const t = useT();
  const tag = useTagDeIdioma();
  if (adendos.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2" aria-label={t("Adendos")}>
      {adendos.map((a) => (
        <li key={a.id} className="rounded-lg border-l-4 border-warning bg-muted/40 p-3 text-sm" data-testid="adendo">
          <p className="text-xs text-text-muted">
            {t("Adendo")} · {new Date(a.criado_em).toLocaleString(tag, { dateStyle: "short", timeStyle: "short" })}
            {a.autor ? ` · ${a.autor}` : ""}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{a.texto}</p>
          <p className="mt-1 text-xs text-text-muted">
            {t("Motivo")}: {a.motivo}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function NovoAdendo({
  atendimentoId,
  alvoTipo,
  alvoId,
  chaveParaRecarregar,
}: {
  atendimentoId: string;
  alvoTipo: "formulario" | "evolucao";
  alvoId: string;
  chaveParaRecarregar: readonly unknown[];
}) {
  const t = useT();
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [motivo, setMotivo] = useState("");
  const salvar = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/v1/clinic/atendimentos/${atendimentoId}/adendos`, { alvo_tipo: alvoTipo, alvo_id: alvoId, texto, motivo }),
    onSuccess: () => {
      setAberto(false);
      setTexto("");
      setMotivo("");
      void qc.invalidateQueries({ queryKey: chaveParaRecarregar });
    },
    onError: showApiError,
  });

  if (!aberto) {
    return (
      <Button size="sm" variant="outline" className="mt-3" onClick={() => setAberto(true)} data-testid="adendo-abrir">
        {t("Adicionar adendo")}
      </Button>
    );
  }
  const idTexto = `adendo-texto-${alvoId}`;
  const idMotivo = `adendo-motivo-${alvoId}`;
  return (
    <form
      className="mt-3 space-y-2 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
    >
      <p className="text-xs text-text-muted">{t("O registro original continua como está. O adendo fica ao lado dele, com o seu nome e a data.")}</p>
      <label htmlFor={idTexto} className="block text-sm font-medium">
        {t("Adendo")}
      </label>
      <Textarea id={idTexto} rows={3} maxLength={5000} value={texto} onChange={(e) => setTexto(e.target.value)} required />
      <label htmlFor={idMotivo} className="block text-sm font-medium">
        {t("Motivo")}
      </label>
      <Input id={idMotivo} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} required minLength={3} className="h-11 md:h-9" />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={salvar.isPending || !texto.trim() || motivo.trim().length < 3} data-testid="adendo-salvar">
          {t("Registrar adendo")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>
          {t("Cancelar")}
        </Button>
      </div>
    </form>
  );
}
