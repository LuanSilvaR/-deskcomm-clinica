"use client";

/**
 * FORK clinic (prontuário F2) — autosave de uma seção do atendimento.
 *
 * Espera `atraso` ms sem digitação (debounce) e grava pela `FilaDeGravacao`
 * (lib/clinic/atendimento/autosave.ts): uma gravação em voo, versão esperada,
 * conflito para tudo. Ao sair da tela com edição ainda não enviada, envia na
 * hora — texto clínico não se perde por trocar de seção.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api/types";
import { FilaDeGravacao, type EstadoDoAutosave, type Gravar } from "@/lib/clinic/atendimento/autosave";

const ehConflito = (e: unknown) => e instanceof ApiError && e.status === 409 && e.code === "conflict";

export function useAutosave<T>({
  valor,
  gravar,
  versaoInicial,
  habilitado,
  atraso = 1500,
}: {
  valor: T;
  gravar: Gravar<T>;
  versaoInicial: number;
  habilitado: boolean;
  atraso?: number;
}) {
  const [estado, setEstado] = useState<EstadoDoAutosave>({ tipo: "ocioso" });
  const gravarRef = useRef(gravar);
  useLayoutEffect(() => {
    gravarRef.current = gravar;
  }, [gravar]);
  // Criada na primeira gravação (nunca no render); a versão inicial é a da montagem.
  const versaoDaMontagem = useRef(versaoInicial);
  const filaRef = useRef<FilaDeGravacao<T> | null>(null);
  const fila = useCallback(() => {
    filaRef.current ??= new FilaDeGravacao<T>((v, versao) => gravarRef.current(v, versao), versaoDaMontagem.current, setEstado, ehConflito);
    return filaRef.current;
  }, []);
  const naoEnviado = useRef<{ valor: T } | null>(null);
  const primeiro = useRef(true);

  useEffect(() => {
    if (primeiro.current) {
      primeiro.current = false;
      return;
    }
    if (!habilitado) return;
    naoEnviado.current = { valor };
    const id = setTimeout(() => {
      naoEnviado.current = null;
      void fila().enviar(valor);
    }, atraso);
    return () => clearTimeout(id);
  }, [valor, habilitado, atraso, fila]);

  // Saiu da seção com edição pendente: grava já.
  useEffect(
    () => () => {
      const pendente = naoEnviado.current;
      if (pendente) void fila().enviar(pendente.valor);
    },
    [fila],
  );

  const tentarDeNovo = useCallback(() => void fila().tentarDeNovo(), [fila]);
  return { estado, tentarDeNovo };
}
