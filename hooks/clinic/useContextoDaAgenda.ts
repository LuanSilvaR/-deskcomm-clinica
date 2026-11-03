"use client";

/**
 * FORK clinic (agenda por profissional, S1) — o profissional em CONTEXTO na
 * Agenda: a lista que a API libera, quem está aberto agora, a troca (sem
 * recarregar a página) e a memória do último e dos recentes neste navegador.
 * As regras puras moram em `lib/clinic/agenda/contexto-da-agenda.ts`.
 */
import { useQuery } from "@tanstack/react-query";
import * as React from "react";

import { apiClient } from "@/lib/api/client";
import {
  chaveDasPreferencias,
  gravarPreferencias,
  lerPreferencias,
  registrarVisita,
  resolverProfissional,
  type PreferenciasDaAgenda,
  type ProfissionalDaAgenda,
} from "@/lib/clinic/agenda/contexto-da-agenda";
import type { DisponibilidadeDoDia } from "@/lib/clinic/agenda/disponibilidade-do-profissional";

function armazenamento(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function useProfissionaisDaAgenda(ligado = true) {
  return useQuery({
    queryKey: ["agenda", "clinic", "profissionais"],
    enabled: ligado,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { profissionais: ProfissionalDaAgenda[]; pode_ver_outros: boolean } }>(
          "/api/v1/clinic/agenda/profissionais",
        )
      ).data,
    staleTime: 60_000,
  });
}

export function useDisponibilidadeDaAgenda(filtro: { profissional: string; de: string; ate: string } | null) {
  return useQuery({
    queryKey: ["agenda", "clinic", "disponibilidade", filtro],
    enabled: filtro !== null,
    queryFn: async () => {
      const qs = new URLSearchParams({ profissional: filtro!.profissional, de: filtro!.de, ate: filtro!.ate });
      return (
        await apiClient.get<{ data: { profissional: string; dias: DisponibilidadeDoDia[] } }>(
          `/api/v1/clinic/agenda/disponibilidade?${qs}`,
        )
      ).data;
    },
    staleTime: 30_000,
  });
}

export function useContextoDaAgenda({
  orgId,
  usuarioId,
  daUrl,
}: {
  orgId: string;
  usuarioId: string;
  /** O `profissional` que a URL trouxe no primeiro carregamento. */
  daUrl: string | null;
}) {
  // Sem organização (a Agenda montada fora da clínica, como nos testes da tela
  // do núcleo) não há contexto: a grade segue como antes, sem esperar nada.
  const ligado = orgId !== "";
  const consulta = useProfissionaisDaAgenda(ligado);
  const lista = React.useMemo(() => consulta.data?.profissionais ?? [], [consulta.data]);
  const chave = chaveDasPreferencias(orgId, usuarioId);

  // A memória só existe no navegador: lida depois da montagem para o HTML do
  // servidor e o do cliente não discordarem.
  const [prefs, setPrefs] = React.useState<PreferenciasDaAgenda>({ ultimo: null, recentes: [] });
  const [prefsLidas, setPrefsLidas] = React.useState(false);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage só existe no cliente
    setPrefs(lerPreferencias(armazenamento(), chave));
    setPrefsLidas(true);
  }, [chave]);

  const [escolhido, setEscolhido] = React.useState<string | null>(null);
  const profissionalId = React.useMemo(
    () =>
      prefsLidas || daUrl
        ? resolverProfissional({ daUrl: escolhido ?? daUrl, ultimo: prefs.ultimo, lista })
        : null,
    [prefsLidas, escolhido, daUrl, prefs.ultimo, lista],
  );
  const profissional = lista.find((p) => p.user_id === profissionalId) ?? null;

  // Abriu (por escolha, URL ou memória): vira o último e sobe nos recentes.
  // O efeito só GRAVA no navegador; a tela lê a lista já atualizada abaixo.
  const atualizadas = React.useMemo(
    () => (profissionalId ? registrarVisita(prefs, profissionalId) : prefs),
    [prefs, profissionalId],
  );
  React.useEffect(() => {
    if (!profissionalId || !prefsLidas) return;
    gravarPreferencias(armazenamento(), chave, registrarVisita(lerPreferencias(armazenamento(), chave), profissionalId));
  }, [profissionalId, prefsLidas, chave]);

  const recentes = React.useMemo(
    () => atualizadas.recentes.map((id) => lista.find((p) => p.user_id === id)).filter((p): p is ProfissionalDaAgenda => !!p),
    [atualizadas.recentes, lista],
  );

  return {
    lista,
    recentes,
    profissional,
    profissionalId,
    podeVerOutros: consulta.data?.pode_ver_outros ?? false,
    carregando: ligado && (consulta.isLoading || (!prefsLidas && !daUrl)),
    erro: consulta.isError,
    trocar: setEscolhido,
  };
}
