"use client";

/**
 * FORK clinic (prontuário F8) — o prontuário em formato de documento: cabeçalho
 * (clínica, paciente, data de emissão, quem gerou), cada atendimento em ordem
 * cronológica com todos os registros e adendos, e a lista de termos com o hash
 * de cada um. "Imprimir / salvar PDF" usa o diálogo do próprio navegador.
 */
import { CondutaLidaView } from "@/components/clinic/atendimento/SecaoConduta";
import { EvolucaoLidaView } from "@/components/clinic/atendimento/SecaoEvolucao";
import { ListaDeAdendos } from "@/components/clinic/atendimento/Adendos";
import { ProcedimentoLidoView } from "@/components/clinic/atendimento/SecaoProcedimentos";
import { RespostasLidas } from "@/components/clinic/formularios/RenderizadorDeFormulario";
import { Button } from "@/components/ui/button";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import {
  ROTULO_DO_STATUS_DO_DOCUMENTO,
  type StatusDoDocumento,
} from "@/lib/clinic/documentos/tipos";
import type { AtendimentoNaLinhaDoTempo } from "@/lib/clinic/prontuario/linha-do-tempo";

export function ProntuarioImpressao({
  clinica,
  paciente,
  nascimento,
  atendimentos,
  documentos,
  geradoPor,
}: {
  clinica: string | null;
  paciente: string | null;
  nascimento: string | null;
  atendimentos: AtendimentoNaLinhaDoTempo[];
  documentos: Array<{
    titulo: string;
    status: StatusDoDocumento;
    sha256: string;
    created_at: string;
  }>;
  geradoPor: string | null;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const data = (iso: string) =>
    new Date(iso).toLocaleString(tag, { dateStyle: "short", timeStyle: "short" });
  const cronologico = [...atendimentos].reverse();
  return (
    <main
      className="mx-auto max-w-3xl space-y-6 bg-white p-6 text-black print:p-0"
      data-testid="prontuario-impressao"
    >
      <div className="flex justify-end print:hidden">
        <Button onClick={() => window.print()} data-testid="imprimir">
          {t("Imprimir / salvar PDF")}
        </Button>
      </div>
      <header className="space-y-1 border-b pb-3">
        <p className="text-xs tracking-wide uppercase">{clinica ?? ""}</p>
        <h1 className="text-2xl font-semibold">{t("Prontuário")}</h1>
        <p className="text-sm">
          {t("Paciente")}: <strong>{paciente ?? t("Paciente")}</strong>
          {nascimento
            ? ` · ${t("nascimento")} ${new Date(`${nascimento}T12:00:00`).toLocaleDateString(tag)}`
            : ""}
        </p>
        <p className="text-xs">
          {t("Emitido em")} {data(new Date().toISOString())}
          {geradoPor ? ` · ${t("por")} ${geradoPor}` : ""} · {atendimentos.length}{" "}
          {t("atendimentos")}
        </p>
        <p className="text-xs">
          {t(
            "Documento com dados de saúde. Guarde e compartilhe só com quem tem direito de acesso.",
          )}
        </p>
      </header>

      {cronologico.map((a) => {
        const adendosDe = (id: string) => a.adendos.filter((x) => x.alvo_id === id);
        return (
          <section key={a.id} className="break-inside-avoid-page space-y-3 border-b pb-4">
            <h2 className="text-base font-semibold">
              {data(a.inicio)}
              {a.servico ? ` · ${a.servico}` : ""}
            </h2>
            <p className="text-xs">
              {[a.profissional, a.especialidade].filter(Boolean).join(" · ")}
              {a.fim ? ` · ${t("finalizado em")} ${data(a.fim)}` : ` · ${t("em andamento")}`}
            </p>
            {(["anamnese", "avaliacao"] as const).map((tipo) => {
              const f = a.formularios[tipo];
              if (!f) return null;
              return (
                <div key={tipo}>
                  <h3 className="text-sm font-semibold">
                    {t(tipo === "anamnese" ? "Anamnese" : "Avaliação")}
                    {f.modelo_nome ? ` — ${t(f.modelo_nome)}` : ""}
                  </h3>
                  <RespostasLidas campos={f.campos} respostas={f.respostas} />
                  <ListaDeAdendos adendos={adendosDe(f.id)} />
                </div>
              );
            })}
            {a.conduta ? (
              <div>
                <h3 className="text-sm font-semibold">{t("Conduta")}</h3>
                <CondutaLidaView conduta={a.conduta} />
                <ListaDeAdendos adendos={adendosDe(a.conduta.id)} />
              </div>
            ) : null}
            {a.procedimentos
              .filter((p) => p.status !== "anulado")
              .map((p) => (
                <div key={p.id}>
                  <h3 className="text-sm font-semibold">{t("Procedimento")}</h3>
                  <ProcedimentoLidoView p={p} />
                  <ListaDeAdendos adendos={adendosDe(p.id)} />
                </div>
              ))}
            {a.evolucao ? (
              <div>
                <h3 className="text-sm font-semibold">{t("Evolução")}</h3>
                <EvolucaoLidaView evolucao={a.evolucao} />
                <ListaDeAdendos adendos={adendosDe(a.evolucao.id)} />
              </div>
            ) : null}
          </section>
        );
      })}

      {documentos.length ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">{t("Documentos e termos")}</h2>
          <ul className="space-y-1 text-xs">
            {documentos.map((d) => (
              <li key={d.sha256 + d.created_at}>
                {data(d.created_at)} · {t(d.titulo)} · {t(ROTULO_DO_STATUS_DO_DOCUMENTO[d.status])}{" "}
                · sha256 {d.sha256}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
