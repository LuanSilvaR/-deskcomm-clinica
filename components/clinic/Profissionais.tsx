"use client";

/**
 * Fichas dos profissionais (módulo clinic): cada membro da equipe pode ganhar
 * conselho, registro e especialidades. O horário de atendimento é o MESMO da
 * tela Equipe (attendant_availability.schedule, várias faixas por dia) — aqui
 * só há uma porta para ele, com o mesmo editor.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ScheduleDialog, type Attendant } from "@/app/app/team/_components/AttendantsClient";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { useAttendants, useUpdateAvailability } from "@/hooks/team/useAttendants";
import { apiClient } from "@/lib/api/client";

import { useEspecialidades } from "./Especialidades";
import { CONSELHOS, DIAS_DA_SEMANA, type Profissional } from "./tipos";

export const CHAVE_PROFISSIONAIS = ["clinic", "profissionais"] as const;

export function useProfissionais() {
  return useQuery({
    queryKey: CHAVE_PROFISSIONAIS,
    queryFn: async () =>
      (await apiClient.get<{ data: { profissionais: Profissional[] } }>("/api/v1/clinic/profissionais")).data
        .profissionais,
  });
}

interface Rascunho {
  user_id: string;
  council: string;
  council_number: string;
  council_uf: string;
  is_active: boolean;
  specialty_ids: string[];
}

function rascunhoDe(userId: string, p: Profissional | undefined): Rascunho {
  return {
    user_id: userId,
    council: p?.council ?? "",
    council_number: p?.council_number ?? "",
    council_uf: p?.council_uf ?? "",
    is_active: p?.is_active ?? true,
    specialty_ids: p?.specialty_ids ?? [],
  };
}

export function Profissionais({ podeEditar }: { podeEditar: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const membros = useAttendants();
  const fichas = useProfissionais();
  const especialidades = useEspecialidades();
  const atualizarJornada = useUpdateAvailability();
  const [editando, setEditando] = useState<Rascunho | null>(null);
  const [jornadaDe, setJornadaDe] = useState<Attendant | null>(null);

  const salvar = useMutation({
    mutationFn: (r: Rascunho) =>
      apiClient.post("/api/v1/clinic/profissionais", {
        user_id: r.user_id,
        council: r.council || null,
        council_number: r.council_number.trim() || null,
        council_uf: r.council_uf.trim() || null,
        is_active: r.is_active,
        specialty_ids: r.specialty_ids,
      }),
    onSuccess: () => {
      setEditando(null);
      void qc.invalidateQueries({ queryKey: ["clinic"] });
    },
    onError: showApiError,
  });

  if (membros.isLoading || fichas.isLoading) {
    return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  }
  if (membros.isError || fichas.isError) {
    return <p className="text-sm text-destructive">{t("Não foi possível carregar os profissionais.")}</p>;
  }

  const listaDeMembros = membros.data?.data ?? [];
  const porUsuario = new Map((fichas.data ?? []).map((p) => [p.user_id, p]));
  const ativas = (especialidades.data ?? []).filter((e) => e.is_active);
  const nomeDaEspecialidade = new Map((especialidades.data ?? []).map((e) => [e.id, e.name]));

  return (
    <section className="space-y-3 rounded-xl border p-4" data-testid="clinic-profissionais">
      <h2 className="font-semibold">{t("Profissionais")}</h2>
      <p className="text-sm text-text-muted">
        {t("Todo profissional é um membro da equipe. Quem ainda não tem acesso entra por convite em Equipe.")}
      </p>

      {listaDeMembros.length === 0 ? (
        <p className="text-sm text-text-muted">{t("Nenhum membro na equipe ainda.")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {listaDeMembros.map((m) => {
            const ficha = porUsuario.get(m.user_id);
            const nome = m.name ?? m.email ?? m.user_id.slice(0, 8);
            const janelas = m.schedule?.windows ?? [];
            return (
              <li key={m.user_id} className="space-y-1 p-3" data-testid="profissional">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">{nome}</span>
                    {ficha ? (
                      <span className="ml-2 text-sm text-text-muted">
                        {[ficha.council, ficha.council_number, ficha.council_uf].filter(Boolean).join(" ")}
                        {ficha.is_active ? "" : ` · ${t("inativo")}`}
                      </span>
                    ) : (
                      <span className="ml-2 text-sm text-text-muted">{t("sem ficha")}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {podeEditar ? (
                      <Button size="sm" variant="outline" onClick={() => setEditando(rascunhoDe(m.user_id, ficha))}>
                        {ficha ? t("Editar ficha") : t("Criar ficha")}
                      </Button>
                    ) : null}
                    {podeEditar ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setJornadaDe({ userId: m.user_id, name: nome, email: m.email, availability: m })
                        }
                      >
                        {t("Horário de atendimento")}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <p className="text-sm text-text-muted">
                  {t("Especialidades")}:{" "}
                  {ficha && ficha.specialty_ids.length > 0
                    ? ficha.specialty_ids.map((id) => nomeDaEspecialidade.get(id) ?? "?").join(", ")
                    : t("nenhuma")}
                  {" · "}
                  {t("Horário")}:{" "}
                  {janelas.length > 0
                    ? janelas.map((w) => `${t(DIAS_DA_SEMANA[w.dow] ?? "")} ${w.start}–${w.end}`).join(", ")
                    : t("não publicado")}
                </p>

                {editando?.user_id === m.user_id ? (
                  <form
                    className="mt-2 space-y-2 rounded-md border p-3"
                    data-testid="ficha-do-profissional"
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

                    <fieldset>
                      <legend className="text-sm">{t("Especialidades")}</legend>
                      {ativas.length === 0 ? (
                        <p className="text-sm text-text-muted">{t("Cadastre especialidades na aba Especialidades.")}</p>
                      ) : (
                        <div className="mt-1 flex flex-wrap gap-3">
                          {ativas.map((esp) => (
                            <label key={esp.id} className="flex items-center gap-1 text-sm">
                              <input
                                type="checkbox"
                                checked={editando.specialty_ids.includes(esp.id)}
                                onChange={(e) =>
                                  setEditando({
                                    ...editando,
                                    specialty_ids: e.target.checked
                                      ? [...editando.specialty_ids, esp.id]
                                      : editando.specialty_ids.filter((id) => id !== esp.id),
                                  })
                                }
                              />
                              {esp.name}
                            </label>
                          ))}
                        </div>
                      )}
                    </fieldset>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editando.is_active}
                        onChange={(e) => setEditando({ ...editando, is_active: e.target.checked })}
                      />
                      {t("Atende pela agenda")}
                    </label>

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
              </li>
            );
          })}
        </ul>
      )}

      {jornadaDe ? (
        <ScheduleDialog
          attendant={jornadaDe}
          open={!!jornadaDe}
          onOpenChange={(o) => !o && setJornadaDe(null)}
          isPending={atualizarJornada.isPending}
          onSave={(windows, timezone) =>
            atualizarJornada.mutate(
              { userId: jornadaDe.userId, patch: { schedule: { timezone, windows } } },
              { onSuccess: () => setJornadaDe(null) },
            )
          }
        />
      ) : null}
    </section>
  );
}
