"use client";

/**
 * FORK clinic — o CEP completo busca o endereço (#86), para qualquer formulário.
 *
 * Nasceu dentro da ficha do paciente e saiu dela quando a organização passou a
 * ter endereço (migration 8011): duas telas, uma regra só.
 *
 * - A consulta vai à rota do servidor `/api/v1/clinic/cep/:cep` (o serviço
 *   externo vê só o CEP; ver `lib/clinic/pacientes/cep.ts`).
 * - `ultimoCep` evita repetir a consulta do mesmo número e descarta a resposta
 *   de um CEP que já foi trocado.
 * - Quem chama decide o que substituir em `aoEncontrar` — a regra das duas
 *   telas é "só o que o serviço trouxe substitui": CEP de cidade única vem sem
 *   logradouro, e o que a pessoa já digitou fica.
 * - "Não encontrado" e "indisponível" viram aviso; o endereço segue à mão.
 */
import { useCallback, useRef, useState } from "react";

import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { normalizarCep, type EnderecoDoCep, type ResultadoDoCep } from "@/lib/clinic/pacientes/cep";

export interface EnderecoPeloCep {
  /** Chame a cada mudança do campo CEP, com o texto digitado. */
  consultar: (digitado: string) => void;
  buscando: boolean;
  aviso: string | null;
}

export function useEnderecoPeloCep(
  aoEncontrar: (endereco: EnderecoDoCep) => void,
  opcoes: { focarAoEncontrar?: string } = {},
): EnderecoPeloCep {
  const t = useT();
  const ultimoCep = useRef<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const { focarAoEncontrar } = opcoes;

  const consultar = useCallback(
    (digitado: string) => {
      const cep = normalizarCep(digitado);
      if (!cep) {
        ultimoCep.current = null;
        setAviso(null);
        return;
      }
      if (cep === ultimoCep.current) return;
      ultimoCep.current = cep;
      setBuscando(true);
      setAviso(null);
      const indisponivel = t("Não foi possível consultar o CEP agora. Preencha o endereço à mão.");
      apiClient
        .get<{ data: ResultadoDoCep }>(`/api/v1/clinic/cep/${cep}`)
        .then((r) => {
          if (ultimoCep.current !== cep) return;
          const resultado = r.data;
          if (resultado.tipo === "encontrado") {
            aoEncontrar(resultado.endereco);
            if (focarAoEncontrar) document.getElementById(focarAoEncontrar)?.focus();
          } else if (resultado.tipo === "nao_encontrado") {
            setAviso(t("CEP não encontrado. Confira o número ou preencha o endereço à mão."));
          } else {
            setAviso(indisponivel);
          }
        })
        .catch(() => {
          if (ultimoCep.current === cep) setAviso(indisponivel);
        })
        .finally(() => {
          if (ultimoCep.current === cep) setBuscando(false);
        });
    },
    [aoEncontrar, focarAoEncontrar, t],
  );

  return { consultar, buscando, aviso };
}
