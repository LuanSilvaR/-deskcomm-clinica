"use client";

/**
 * FORK clinic (agenda S5) — as ações do atendimento, na ordem em que o
 * profissional precisa delas:
 *
 *   em andamento → faixa "ATENDIMENTO EM ANDAMENTO · iniciado às" e
 *                  "Finalizar atendimento" à vista, com confirmação;
 *   finalizado, mesmo dia, dono → "Complementar atendimento" (reabre para
 *                  ACRESCENTAR — o que já foi registrado continua imutável);
 *   finalizado, outro dia → somente leitura, com quem finalizou e quando.
 *
 * Reabrir (gerência) e anular pedem motivo num diálogo, não em `window.prompt`.
 * Quem pode o quê vem da rota (`pode_*`); o banco confere de novo (9043).
 */
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { Lock, Stethoscope } from "@/lib/ui/icons";

export interface EstadoDoAtendimento {
  status: "em_andamento" | "finalizado" | "anulado";
  inicio: string;
  pode_finalizar: boolean;
  pode_complementar?: boolean;
  pode_reabrir: boolean;
  finalizado?: { por: string | null; em: string; mesmo_dia: boolean } | null;
}

function DialogoDeMotivo({
  aberto,
  titulo,
  descricao,
  rotulo,
  confirmar,
  testid,
  ocupado,
  onFechar,
  onConfirmar,
}: {
  aberto: boolean;
  titulo: string;
  descricao: string;
  rotulo: string;
  confirmar: string;
  testid: string;
  ocupado: boolean;
  onFechar: () => void;
  onConfirmar: (motivo: string) => void;
}) {
  const t = useT();
  const [motivo, setMotivo] = React.useState("");
  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (!v) {
          setMotivo("");
          onFechar();
        }
      }}
    >
      <DialogContent data-testid={testid}>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <label className="block text-sm">
          {rotulo}
          <textarea
            className="mt-1 w-full rounded-md border bg-surface p-2 text-sm"
            rows={3}
            maxLength={300}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            data-testid={`${testid}-motivo`}
          />
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>
            {t("Voltar")}
          </Button>
          <Button
            disabled={ocupado || motivo.trim().length < 3}
            data-testid={`${testid}-confirmar`}
            onClick={() => onConfirmar(motivo.trim())}
          >
            {confirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AcoesDoAtendimento({
  a,
  finalizando,
  reabrindo,
  anulando,
  onFinalizar,
  onReabrir,
  onAnular,
}: {
  a: EstadoDoAtendimento;
  finalizando: boolean;
  reabrindo: boolean;
  anulando: boolean;
  onFinalizar: () => void;
  onReabrir: (motivo: string) => void;
  onAnular: (motivo: string) => void;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const [confirmando, setConfirmando] = React.useState(false);
  const [dialogo, setDialogo] = React.useState<"complementar" | "reabrir" | "anular" | null>(null);
  const hora = (iso: string) => new Date(iso).toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" });
  const dataHora = (iso: string) =>
    `${new Date(iso).toLocaleDateString(tag, { day: "2-digit", month: "2-digit", year: "numeric" })} ${t("às")} ${hora(iso)}`;

  return (
    <div className="space-y-2" data-testid="acoes-do-atendimento">
      {a.status === "em_andamento" ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent bg-accent-soft p-3"
          data-testid="atendimento-em-andamento"
        >
          <p className="flex items-center gap-2 text-sm">
            <Stethoscope size={18} weight="bold" aria-hidden className="text-accent" />
            <span className="font-semibold uppercase tracking-wide">{t("Atendimento em andamento")}</span>
            <span className="text-text-muted">· {t("iniciado às")} {hora(a.inicio)}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {a.pode_finalizar ? (
              <Button variant="ghost" className="h-11 text-xs md:h-9" data-testid="atendimento-anular" disabled={anulando} onClick={() => setDialogo("anular")}>
                {t("Anular atendimento")}
              </Button>
            ) : null}
            {a.pode_finalizar ? (
              <Button className="h-11 px-5 md:h-10" data-testid="atendimento-finalizar" disabled={finalizando} onClick={() => setConfirmando(true)}>
                {finalizando ? t("Finalizando…") : t("Finalizar atendimento")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {a.status === "finalizado" && a.finalizado ? (
        a.pode_complementar ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" data-testid="atendimento-complementavel">
            <p className="text-sm">
              {t("Atendimento finalizado às")} {hora(a.finalizado.em)}.{" "}
              <span className="text-text-muted">{t("Até o fim de hoje, só você pode complementar.")}</span>
            </p>
            <Button variant="outline" className="h-11 md:h-9" data-testid="atendimento-complementar" disabled={reabrindo} onClick={() => setDialogo("complementar")}>
              {t("Complementar atendimento")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-surface-elevated p-3 text-sm" data-testid="atendimento-somente-leitura">
            <Lock size={16} weight="bold" aria-hidden className="text-text-muted" />
            <span className="font-semibold">{t("Atendimento finalizado")}</span>
            <span className="text-text-muted">
              {a.finalizado.mesmo_dia ? "" : `· ${t("bloqueado para edição")} `}· {t("Finalizado por")} {a.finalizado.por ?? t("profissional")}{" "}
              {t("em")} {dataHora(a.finalizado.em)}
            </span>
          </div>
        )
      ) : null}

      {a.pode_reabrir ? (
        <Button variant="outline" className="h-11 md:h-9" data-testid="atendimento-reabrir" disabled={reabrindo} onClick={() => setDialogo("reabrir")}>
          {t("Reabrir atendimento")}
        </Button>
      ) : null}

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent data-testid="confirmar-finalizacao">
          <DialogHeader>
            <DialogTitle>{t("Finalizar atendimento?")}</DialogTitle>
            <DialogDescription>
              {t("Após a finalização, alterações poderão ser feitas somente por você até o fim do dia de hoje.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmando(false)}>
              {t("Voltar")}
            </Button>
            <Button
              data-testid="atendimento-finalizar-confirmar"
              disabled={finalizando}
              onClick={() => {
                setConfirmando(false);
                onFinalizar();
              }}
            >
              {t("Finalizar atendimento")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DialogoDeMotivo
        aberto={dialogo === "complementar"}
        titulo={t("Complementar atendimento")}
        descricao={t("O atendimento volta a ficar aberto para você acrescentar o que faltou. O que já foi registrado continua como está.")}
        rotulo={t("O que vai complementar?")}
        confirmar={t("Complementar")}
        testid="dialogo-complementar"
        ocupado={reabrindo}
        onFechar={() => setDialogo(null)}
        onConfirmar={(m) => {
          setDialogo(null);
          onReabrir(m);
        }}
      />
      <DialogoDeMotivo
        aberto={dialogo === "reabrir"}
        titulo={t("Reabrir atendimento")}
        descricao={t("Motivo para reabrir (o que já foi registrado continua como está)")}
        rotulo={t("Motivo")}
        confirmar={t("Reabrir atendimento")}
        testid="dialogo-reabrir"
        ocupado={reabrindo}
        onFechar={() => setDialogo(null)}
        onConfirmar={(m) => {
          setDialogo(null);
          onReabrir(m);
        }}
      />
      <DialogoDeMotivo
        aberto={dialogo === "anular"}
        titulo={t("Anular atendimento")}
        descricao={t("Motivo para anular (só vale para atendimento aberto por engano, ainda sem registros)")}
        rotulo={t("Motivo")}
        confirmar={t("Anular atendimento")}
        testid="dialogo-anular"
        ocupado={anulando}
        onFechar={() => setDialogo(null)}
        onConfirmar={(m) => {
          setDialogo(null);
          onAnular(m);
        }}
      />
    </div>
  );
}
