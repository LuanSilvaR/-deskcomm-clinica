"use client";

/**
 * FORK clinic (prontuário F2) — a linha do tempo clínica do paciente.
 *
 * Do atendimento mais novo para o mais antigo, 20 por vez ("Carregar mais"):
 * data, profissional, serviço, e o que foi registrado — anamnese, avaliação,
 * evolução —, com os adendos logo abaixo do registro que corrigem. Só aparece
 * para quem tem `prontuario.ver` (a rota e a RLS conferem de novo).
 */
import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";

import { ListaDeAdendos } from "@/components/clinic/atendimento/Adendos";
import { CondutaLidaView } from "@/components/clinic/atendimento/SecaoConduta";
import { EvolucaoLidaView } from "@/components/clinic/atendimento/SecaoEvolucao";
import { ProcedimentoLidoView } from "@/components/clinic/atendimento/SecaoProcedimentos";
import { RespostasLidas } from "@/components/clinic/formularios/RenderizadorDeFormulario";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { RegistrosDoAtendimento } from "@/lib/clinic/prontuario/leitura";

interface AtendimentoNaLinhaDoTempo extends RegistrosDoAtendimento {
  id: string;
  status: string;
  inicio: string;
  fim: string | null;
  profissional: string | null;
  servico: string | null;
  especialidade: string | null;
}

interface Pagina {
  atendimentos: AtendimentoNaLinhaDoTempo[];
  proximo: string | null;
}

export function ProntuarioDoPaciente({ contactId }: { contactId: string }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const q = useInfiniteQuery({
    queryKey: ["clinic", "prontuario", contactId],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      (
        await apiClient.get<{ data: Pagina }>(
          `/api/v1/clinic/pacientes/${contactId}/prontuario${pageParam ? `?antes=${encodeURIComponent(pageParam)}` : ""}`,
        )
      ).data,
    getNextPageParam: (ultima) => ultima.proximo,
  });

  if (q.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (q.isError) return <p className="text-sm text-destructive">{t("Não foi possível abrir o prontuário.")}</p>;
  const atendimentos = (q.data?.pages ?? []).flatMap((p) => p.atendimentos);
  if (atendimentos.length === 0) {
    return <p className="text-sm text-text-muted">{t("Nenhum atendimento registrado para este paciente.")}</p>;
  }

  return (
    <div className="space-y-4" data-testid="prontuario-do-paciente">
      <ol className="space-y-4 border-l pl-4">
        {atendimentos.map((a) => {
          const adendosDe = (alvoId: string) => a.adendos.filter((x) => x.alvo_id === alvoId);
          return (
            <li key={a.id} className="relative space-y-3" data-testid="prontuario-atendimento">
              <span aria-hidden className="absolute top-1.5 -left-[1.4rem] h-2.5 w-2.5 rounded-full bg-primary" />
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {new Date(a.inicio).toLocaleDateString(tag, { dateStyle: "long" })}
                    {a.servico ? ` · ${a.servico}` : ""}
                  </p>
                  <p className="text-xs text-text-muted">
                    {[a.profissional, a.especialidade].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={a.status === "finalizado" ? "secondary" : "default"}>
                    {a.status === "finalizado" ? t("Finalizado") : t("Em atendimento")}
                  </Badge>
                  <Link href={`/app/atendimentos/${a.id}`} className="text-xs underline-offset-4 hover:underline">
                    {t("Abrir atendimento")}
                  </Link>
                </div>
              </header>
              {(["anamnese", "avaliacao"] as const).map((tipo) => {
                const f = a.formularios[tipo];
                if (!f) return null;
                return (
                  <section key={tipo} aria-label={t(tipo === "anamnese" ? "Anamnese" : "Avaliação")} className="rounded-lg border p-3">
                    <h3 className="mb-2 text-sm font-semibold">
                      {t(tipo === "anamnese" ? "Anamnese" : "Avaliação")}
                      {f.modelo_nome ? <span className="ml-2 text-xs font-normal text-text-muted">{t(f.modelo_nome)}</span> : null}
                    </h3>
                    <RespostasLidas campos={f.campos} respostas={f.respostas} />
                    <ListaDeAdendos adendos={adendosDe(f.id)} />
                  </section>
                );
              })}
              {a.conduta ? (
                <section aria-label={t("Conduta")} className="rounded-lg border p-3">
                  <h3 className="mb-2 text-sm font-semibold">{t("Conduta")}</h3>
                  <CondutaLidaView conduta={a.conduta} />
                  <ListaDeAdendos adendos={adendosDe(a.conduta.id)} />
                </section>
              ) : null}
              {a.procedimentos
                .filter((p) => p.status !== "anulado")
                .map((p) => (
                  <section key={p.id} aria-label={t("Procedimento")} className="rounded-lg border p-3">
                    <h3 className="mb-2 text-sm font-semibold">{t("Procedimento")}</h3>
                    <ProcedimentoLidoView p={p} />
                    <ListaDeAdendos adendos={adendosDe(p.id)} />
                  </section>
                ))}
              {a.evolucao ? (
                <section aria-label={t("Evolução")} className="rounded-lg border p-3">
                  <h3 className="mb-2 text-sm font-semibold">{t("Evolução")}</h3>
                  <EvolucaoLidaView evolucao={a.evolucao} />
                  <ListaDeAdendos adendos={adendosDe(a.evolucao.id)} />
                </section>
              ) : null}
            </li>
          );
        })}
      </ol>
      {q.hasNextPage ? (
        <Button variant="outline" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
          {q.isFetchingNextPage ? t("Carregando…") : t("Carregar mais")}
        </Button>
      ) : null}
    </div>
  );
}
