"use client";

/**
 * FORK clinic (agenda S7 #70) — produtividade na tela da Agenda:
 *   - `useFavoritosDaAgenda`: ★ por usuário e empresa (navegador);
 *   - `usePreferenciasDaAgenda`: visão padrão e fins de semana (navegador);
 *   - `useAtalhosDaAgenda`: teclas N, T, D, S, M, [, ], ? (nunca em campo de texto);
 *   - `JanelaDeAtalhos`: a lista de atalhos ("?") com as preferências.
 * Storage bloqueado (aba privada, política) = padrão; nada quebra.
 */
import * as React from "react";

import type { VisaoDaAgenda } from "@/components/agenda/tipos";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import {
  ATALHOS_DA_AGENDA,
  PREFERENCIAS_PADRAO,
  acaoDoAtalho,
  alternarFavorito,
  chaveDaAgenda,
  lerFavoritos,
  lerPreferencias,
  type AcaoDeAtalho,
  type PreferenciasDaAgenda,
} from "@/lib/clinic/agenda/produtividade";

function ler(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}
function gravar(chave: string, valor: unknown) {
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* storage bloqueado: fica só nesta visita */
  }
}

export function useFavoritosDaAgenda(orgId: string, usuarioId: string) {
  const chave = chaveDaAgenda("favoritos", orgId, usuarioId);
  const [favoritos, setFavoritos] = React.useState<string[]>([]);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o navegador só existe no cliente (hidratação)
    setFavoritos(lerFavoritos(ler(chave)));
  }, [chave]);
  const alternar = React.useCallback(
    (id: string) =>
      setFavoritos((atual) => {
        const novo = alternarFavorito(atual, id);
        gravar(chave, novo);
        return novo;
      }),
    [chave],
  );
  return { favoritos, alternar };
}

export function usePreferenciasDaAgenda(orgId: string, usuarioId: string) {
  const chave = chaveDaAgenda("preferencias", orgId, usuarioId);
  const [prefs, setPrefs] = React.useState<PreferenciasDaAgenda>(PREFERENCIAS_PADRAO);
  const [lidas, setLidas] = React.useState(false);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o navegador só existe no cliente (hidratação)
    setPrefs(lerPreferencias(ler(chave)));
    setLidas(true);
  }, [chave]);
  const mudar = React.useCallback(
    (m: Partial<PreferenciasDaAgenda>) =>
      setPrefs((atual) => {
        const novo = { ...atual, ...m };
        gravar(chave, novo);
        return novo;
      }),
    [chave],
  );
  return { prefs, lidas, mudar };
}

export function useAtalhosDaAgenda(aoAgir: (acao: AcaoDeAtalho) => void) {
  const ref = React.useRef(aoAgir);
  React.useEffect(() => {
    ref.current = aoAgir;
  });
  React.useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      // Diálogo aberto (painel, confirmação): o teclado é dele.
      if (document.querySelector("[role='dialog']")) return;
      const acao = acaoDoAtalho({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, alvo: e.target as HTMLElement | null });
      if (!acao) return;
      e.preventDefault();
      ref.current(acao);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);
}

export function JanelaDeAtalhos({
  aberta,
  onFechar,
  prefs,
  onMudarPrefs,
}: {
  aberta: boolean;
  onFechar: () => void;
  prefs: PreferenciasDaAgenda;
  onMudarPrefs: (m: Partial<PreferenciasDaAgenda>) => void;
}) {
  const t = useT();
  const visoes: Array<[VisaoDaAgenda | "", string]> = [
    ["", t("Automática (semana; dia no celular)")],
    ["dia", t("Dia")],
    ["semana", t("Semana")],
    ["mes", t("Mês")],
  ];
  return (
    <Dialog open={aberta} onOpenChange={(a) => (!a ? onFechar() : undefined)}>
      <DialogContent data-testid="janela-de-atalhos">
        <DialogHeader>
          <DialogTitle>{t("Atalhos e preferências da agenda")}</DialogTitle>
          <DialogDescription>{t("Os atalhos não funcionam enquanto você digita num campo.")}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {ATALHOS_DA_AGENDA.map((a) => (
            <React.Fragment key={a.tecla}>
              <dt>
                <kbd className="rounded border bg-muted px-1.5 font-mono text-xs">{a.tecla}</kbd>
              </dt>
              <dd>{t(a.rotulo)}</dd>
            </React.Fragment>
          ))}
          <dt>
            <kbd className="rounded border bg-muted px-1.5 font-mono text-xs">/</kbd>
          </dt>
          <dd>{t("Buscar paciente")}</dd>
        </dl>
        <fieldset className="mt-2 space-y-2 border-t pt-3">
          <legend className="text-sm font-medium">{t("Preferências (só para você, neste navegador)")}</legend>
          <label className="flex items-center justify-between gap-2 text-sm">
            {t("Visão ao abrir a agenda")}
            <select
              data-testid="pref-visao"
              className="h-8 rounded-md border bg-transparent px-2 text-sm"
              value={prefs.visao ?? ""}
              onChange={(e) => onMudarPrefs({ visao: (e.target.value || null) as VisaoDaAgenda | null })}
            >
              {visoes.map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              data-testid="pref-fds"
              checked={prefs.mostrarFimDeSemana}
              onChange={(e) => onMudarPrefs({ mostrarFimDeSemana: e.target.checked })}
            />
            {t("Mostrar fins de semana ao abrir a agenda")}
          </label>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
}
