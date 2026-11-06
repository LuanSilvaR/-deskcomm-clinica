"use client";

/**
 * "Meus dados" (#97): o profissional sem `profissionais.gerenciar` vê SÓ o
 * próprio cartão. Edita o registro no conselho (`/api/v1/clinic/profissionais/eu`)
 * e o próprio horário de atendimento (a rota da jornada já aceita o próprio).
 * Especialidades e "ativo" aparecem só para leitura: quem muda é a gerência.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ScheduleDialog, type Attendant } from "@/app/app/team/_components/AttendantsClient";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { useAttendants, useUpdateAvailability } from "@/hooks/team/useAttendants";
import { apiClient } from "@/lib/api/client";

import { CONSELHOS, DIAS_DA_SEMANA } from "./tipos";

interface MinhaFicha {
  id: string;
  council: string | null;
  council_number: string | null;
  council_uf: string | null;
  is_active: boolean;
  especialidades: string[];
}

interface Registro {
  council: string;
  council_number: string;
  council_uf: string;
}

const CHAVE_MINHA_FICHA = ["clinic", "profissionais", "eu"] as const;

export function MeusDados({ usuarioAtualId }: { usuarioAtualId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const membros = useAttendants();
  const atualizarJornada = useUpdateAvailability();
  const ficha = useQuery({
    queryKey: CHAVE_MINHA_FICHA,
    queryFn: async () =>
      (await apiClient.get<{ data: { ficha: MinhaFicha | null } }>("/api/v1/clinic/profissionais/eu")).data.ficha,
  });
  const [editando, setEditando] = useState<Registro | null>(null);
  const [jornadaDe, setJornadaDe] = useState<Attendant | null>(null);

  const salvar = useMutation({
    mutationFn: (r: Registro) =>
      apiClient.patch("/api/v1/clinic/profissionais/eu", {
        council: r.council || null,
        council_number: r.council_number.trim() || null,
        council_uf: r.council_uf.trim() || null,
      }),
    onSuccess: () => {
      setEditando(null);
      void qc.invalidateQueries({ queryKey: ["clinic"] });
    },
    onError: showApiError,
  });

  if (membros.isLoading || ficha.isLoading) {
    return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  }
  if (membros.isError || ficha.isError) {
    return <p className="text-sm text-destructive">{t("Não foi possível carregar os seus dados.")}</p>;
  }

  const eu = (membros.data?.data ?? []).find((m) => m.user_id === usuarioAtualId);
  const minha = ficha.data ?? null;
  const nome = eu?.name ?? eu?.email ?? t("Você");
  const janelas = eu?.schedule?.windows ?? [];

  return (
    <section className="space-y-3 rounded-xl border p-4" data-testid="clinic-meus-dados">
      <h2 className="font-semibold">{t("Meus dados")}</h2>
      <p className="text-sm text-text-muted">
        {t("Aqui você cuida só dos seus dados. Especialidades e situação na agenda são definidas pela gerência da clínica.")}
      </p>

      <div className="space-y-1 rounded-md border p-3" data-testid="meu-cartao">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-medium">{nome}</span>
            <span className="ml-2 text-sm text-text-muted">
              {minha
                ? [minha.council, minha.council_number, minha.council_uf].filter(Boolean).join(" ") ||
                  t("sem registro no conselho")
                : t("sem ficha")}
              {minha && !minha.is_active ? ` · ${t("inativo")}` : ""}
            </span>
          </div>
          <div className="flex gap-2">
            {minha ? (
              <Button
                size="sm"
                variant="outline"
                data-testid="meus-dados-editar"
                onClick={() =>
                  setEditando({
                    council: minha.council ?? "",
                    council_number: minha.council_number ?? "",
                    council_uf: minha.council_uf ?? "",
                  })
                }
              >
                {t("Editar meu registro")}
              </Button>
            ) : null}
            {eu ? (
              <Button
                size="sm"
                variant="outline"
                data-testid="meus-dados-jornada"
                onClick={() => setJornadaDe({ userId: eu.user_id, name: nome, email: eu.email, availability: eu })}
              >
                {t("Horário de atendimento")}
              </Button>
            ) : null}
          </div>
        </div>
        <p className="text-sm text-text-muted">
          {t("Especialidades")}: {minha && minha.especialidades.length > 0 ? minha.especialidades.join(", ") : t("nenhuma")}
          {" · "}
          {t("Horário")}:{" "}
          {janelas.length > 0
            ? janelas.map((w) => `${t(DIAS_DA_SEMANA[w.dow] ?? "")} ${w.start}–${w.end}`).join(", ")
            : t("não publicado")}
        </p>
        {!minha ? (
          <p className="text-sm text-text-muted" data-testid="meus-dados-sem-ficha">
            {t("Sua ficha ainda não foi criada. Peça à gerência da clínica.")}
          </p>
        ) : null}

        {editando ? (
          <form
            className="mt-2 space-y-2 rounded-md border p-3"
            data-testid="meu-registro"
            onSubmit={(e) => {
              e.preventDefault();
              salvar.mutate(editando);
            }}
          >
            <div className="flex flex-wrap gap-2">
              <label className="block">
                <span className="block text-sm">{t("Conselho")}</span>
                <select
                  aria-label={t("Conselho")}
                  className="mt-1 rounded-md border p-2"
                  value={editando.council}
                  onChange={(e) => setEditando({ ...editando, council: e.target.value })}
                >
                  <option value="">{t("Nenhum")}</option>
                  {CONSELHOS.map((c) => (
                    <option key={c} value={c}>
                      {c === "outro" ? t("Outro") : c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-sm">{t("Número do registro")}</span>
                <input
                  aria-label={t("Número do registro")}
                  className="mt-1 rounded-md border p-2"
                  maxLength={30}
                  value={editando.council_number}
                  onChange={(e) => setEditando({ ...editando, council_number: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="block text-sm">{t("UF")}</span>
                <input
                  aria-label={t("UF")}
                  className="mt-1 w-16 rounded-md border p-2 uppercase"
                  maxLength={2}
                  value={editando.council_uf}
                  onChange={(e) => setEditando({ ...editando, council_uf: e.target.value.toUpperCase() })}
                />
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={salvar.isPending}>
                {t("Salvar")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditando(null)}>
                {t("Cancelar")}
              </Button>
            </div>
          </form>
        ) : null}
      </div>

      {jornadaDe ? (
        <ScheduleDialog
          attendant={jornadaDe}
          open={!!jornadaDe}
          onOpenChange={(o) => !o && setJornadaDe(null)}
          isPending={atualizarJornada.isPending}
          onSave={async (windows, timezone) => {
            const resposta = await atualizarJornada.mutateAsync({
              userId: jornadaDe.userId,
              patch: { schedule: { timezone, windows } },
            });
            return resposta?.data?.schedule?.windows ?? [];
          }}
        />
      ) : null}
    </section>
  );
}
