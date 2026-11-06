"use client";

/**
 * FORK clinic (#85) — adicionar e remover telefones EXTRAS da ficha do paciente.
 *
 * Só aparece com `settings.clinic.varios_telefones` ligado (8012); a rota
 * `/api/v1/clinic/pacientes/{id}/telefones` cobra a mesma opção. O principal
 * continua sendo editado pelo "Editar contato". Número que já é de outra ficha
 * volta 409 com o recado — a regra "um número, uma ficha" é do banco.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

type Tipo = "fixo" | "celular" | "outro";
type Whatsapp = "sim" | "nao" | "nao_sei";

function rotaDosTelefones(contactId: string): string {
  return `/api/v1/clinic/pacientes/${contactId}/telefones`;
}

export function RemoverTelefoneExtra({ contactId, telefone }: { contactId: string; telefone: string }) {
  const t = useT();
  const qc = useQueryClient();
  const remover = useMutation({
    mutationFn: () => apiClient.delete(`${rotaDosTelefones(contactId)}?${new URLSearchParams({ telefone })}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["contact", contactId] }),
    onError: showApiError,
  });
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      data-testid="remover-telefone-extra"
      disabled={remover.isPending}
      onClick={() => remover.mutate()}
    >
      {t("Remover")}
    </Button>
  );
}

export function NovoTelefoneExtra({ contactId }: { contactId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [numero, setNumero] = useState("");
  const [tipo, setTipo] = useState<Tipo>("celular");
  const [whatsapp, setWhatsapp] = useState<Whatsapp>("nao_sei");
  const [rotulo, setRotulo] = useState("");

  const salvar = useMutation({
    mutationFn: () =>
      apiClient.post(rotaDosTelefones(contactId), {
        phone_number: numero,
        type: tipo,
        whatsapp,
        label: rotulo.trim() || null,
      }),
    onSuccess: () => {
      setAberto(false);
      setNumero("");
      setRotulo("");
      setTipo("celular");
      setWhatsapp("nao_sei");
      void qc.invalidateQueries({ queryKey: ["contact", contactId] });
    },
    onError: showApiError,
  });

  if (!aberto) {
    return (
      <Button type="button" size="sm" variant="outline" data-testid="adicionar-telefone-extra" onClick={() => setAberto(true)}>
        {t("Adicionar telefone")}
      </Button>
    );
  }

  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2 rounded-md border p-3"
      data-testid="novo-telefone-extra"
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
    >
      <label className="block text-sm">
        <span className="block">{t("Número com DDD")}</span>
        <input
          aria-label={t("Número com DDD")}
          className="mt-1 w-44 rounded-md border bg-surface p-2"
          inputMode="tel"
          maxLength={30}
          required
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="block">{t("Tipo")}</span>
        <select
          aria-label={t("Tipo")}
          className="mt-1 rounded-md border bg-surface p-2"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as Tipo)}
        >
          <option value="celular">{t("Celular")}</option>
          <option value="fixo">{t("Fixo")}</option>
          <option value="outro">{t("Outro")}</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="block">{t("WhatsApp")}</span>
        <select
          aria-label={t("WhatsApp")}
          className="mt-1 rounded-md border bg-surface p-2"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value as Whatsapp)}
        >
          <option value="nao_sei">{t("WhatsApp: não sabemos")}</option>
          <option value="sim">{t("Tem WhatsApp")}</option>
          <option value="nao">{t("Sem WhatsApp")}</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="block">
          {t("Rótulo")} <span className="opacity-70">({t("opcional")})</span>
        </span>
        <input
          aria-label={t("Rótulo")}
          className="mt-1 w-40 rounded-md border bg-surface p-2"
          maxLength={60}
          placeholder={t("Trabalho, mãe, recado…")}
          value={rotulo}
          onChange={(e) => setRotulo(e.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={salvar.isPending || numero.trim().length < 8}>
          {t("Salvar")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>
          {t("Cancelar")}
        </Button>
      </div>
    </form>
  );
}
