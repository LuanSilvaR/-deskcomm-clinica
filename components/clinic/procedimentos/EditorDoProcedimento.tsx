"use client";

/**
 * FORK clinic (9015) — o cadastro do procedimento: dados, especializações e
 * profissionais. As especializações e os profissionais são os JÁ cadastrados
 * (/api/v1/clinic/especialidades e /profissionais). O profissional que não tem
 * nenhuma das especializações escolhidas aparece desabilitado, com o motivo; o
 * banco cobra a mesma regra.
 *
 * `procedimento` ausente = novo (um POST com tudo); presente = edição (PATCH
 * dos dados e PUT dos vínculos).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { profissionalApto } from "@/lib/clinic/procedimentos/coerencia";
import type { Procedimento } from "@/lib/clinic/procedimentos/servidor";

interface Especialidade {
  id: string;
  name: string;
  is_active: boolean;
}
interface Profissional {
  id: string;
  user_id: string;
  display_name: string | null;
  is_active: boolean;
  specialty_ids: string[];
}

export function useCadastrosDaClinica() {
  const especialidades = useQuery({
    queryKey: ["clinic", "especialidades"],
    queryFn: async () => (await apiClient.get<{ data: Especialidade[] }>("/api/v1/clinic/especialidades")).data,
  });
  const profissionais = useQuery({
    queryKey: ["clinic", "profissionais"],
    queryFn: async () => (await apiClient.get<{ data: { profissionais: Profissional[] } }>("/api/v1/clinic/profissionais")).data.profissionais,
  });
  return { especialidades, profissionais };
}

export function EditorDoProcedimento({
  procedimento,
  podeGerenciar,
  nomeDaPessoa,
}: {
  procedimento?: Procedimento;
  podeGerenciar: boolean;
  nomeDaPessoa: (userId: string) => string | undefined;
}) {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const { especialidades, profissionais } = useCadastrosDaClinica();
  const novo = !procedimento;

  const [nome, setNome] = React.useState(procedimento?.name ?? "");
  const [codigo, setCodigo] = React.useState(procedimento?.code ?? "");
  const [breve, setBreve] = React.useState(procedimento?.short_description ?? "");
  const [descricao, setDescricao] = React.useState(procedimento?.description ?? "");
  const [duracao, setDuracao] = React.useState(procedimento?.duration_minutes ? String(procedimento.duration_minutes) : "");
  const [ativo, setAtivo] = React.useState(procedimento?.is_active ?? true);
  const [esp, setEsp] = React.useState<string[]>(procedimento?.specialty_ids ?? []);
  const [prof, setProf] = React.useState<string[]>(procedimento?.professional_ids ?? []);
  const [erro, setErro] = React.useState<string | null>(null);

  const listaDeProfissionais = (profissionais.data ?? []).filter((p) => p.is_active || prof.includes(p.id));
  // Nome do PROFISSIONAL (ficha da clínica ou, sem ela, o da equipe) — não é rótulo de contato.
  const nomeDo = (p: Profissional) => p.display_name?.trim() || nomeDaPessoa(p.user_id) || t("Profissional");
  const semEspecialidade = listaDeProfissionais.filter((p) => prof.includes(p.id) && !profissionalApto(esp, p)).map((p) => p.id);

  const dados = () => ({
    name: nome.trim(),
    code: codigo.trim() || null,
    short_description: breve.trim(),
    description: descricao.trim() || null,
    duration_minutes: duracao.trim() ? Number(duracao) : null,
    is_active: ativo,
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (novo) {
        return (
          await apiClient.post<{ data: Procedimento }>("/api/v1/clinic/procedimentos", {
            ...dados(),
            specialty_ids: esp,
            professional_ids: prof.filter((id) => !semEspecialidade.includes(id)),
          })
        ).data;
      }
      await apiClient.patch(`/api/v1/clinic/procedimentos/${procedimento.id}`, dados());
      return (
        await apiClient.put<{ data: Procedimento }>(`/api/v1/clinic/procedimentos/${procedimento.id}/vinculos`, {
          specialty_ids: esp,
          professional_ids: prof.filter((id) => !semEspecialidade.includes(id)),
        })
      ).data;
    },
    onSuccess: (salvo) => {
      void qc.invalidateQueries({ queryKey: ["clinic", "procedimentos"] });
      toast.success(novo ? t("Procedimento cadastrado.") : t("Procedimento salvo."));
      if (novo) router.push(`/app/procedimentos/${salvo.id}`);
    },
    onError: showApiError,
  });

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return setErro(t("Informe o nome."));
    if (!breve.trim()) return setErro(t("Informe a descrição breve."));
    if (duracao.trim() && (!Number.isInteger(Number(duracao)) || Number(duracao) < 5 || Number(duracao) > 600)) {
      return setErro(t("Duração entre 5 e 600 minutos."));
    }
    setErro(null);
    salvar.mutate();
  };

  const somenteLeitura = !podeGerenciar;
  return (
    <form className="space-y-6" onSubmit={enviar} data-testid="editor-do-procedimento" aria-describedby={erro ? "procedimento-erro" : undefined}>
      <fieldset className="grid gap-4 md:grid-cols-2" disabled={somenteLeitura || salvar.isPending}>
        <legend className="mb-2 text-sm font-semibold">{t("Dados gerais")}</legend>
        <div className="space-y-1 md:col-span-2">
          <label htmlFor="proc-nome" className="block text-sm font-medium">
            {t("Nome")} *
          </label>
          <Input id="proc-nome" data-testid="proc-nome" value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} aria-required />
        </div>
        <div className="space-y-1">
          <label htmlFor="proc-codigo" className="block text-sm font-medium">
            {t("Código interno")}
          </label>
          <Input id="proc-codigo" data-testid="proc-codigo" value={codigo} maxLength={30} onChange={(e) => setCodigo(e.target.value)} placeholder="TOX-01" />
        </div>
        <div className="space-y-1">
          <label htmlFor="proc-duracao" className="block text-sm font-medium">
            {t("Duração estimada (minutos)")}
          </label>
          <Input id="proc-duracao" data-testid="proc-duracao" type="number" min={5} max={600} value={duracao} onChange={(e) => setDuracao(e.target.value)} />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label htmlFor="proc-breve" className="block text-sm font-medium">
            {t("Descrição breve")} *
          </label>
          <Input id="proc-breve" data-testid="proc-breve" value={breve} maxLength={240} onChange={(e) => setBreve(e.target.value)} aria-required />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label htmlFor="proc-descricao" className="block text-sm font-medium">
            {t("Descrição detalhada")}
          </label>
          <Textarea id="proc-descricao" data-testid="proc-descricao" rows={4} maxLength={4000} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" data-testid="proc-ativo" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          {t("Ativo")}
        </label>
      </fieldset>

      <fieldset disabled={somenteLeitura || salvar.isPending}>
        <legend className="mb-1 text-sm font-semibold">{t("Especializações")}</legend>
        <p className="mb-2 text-xs text-text-muted">{t("Sem especialização marcada, qualquer profissional pode ser vinculado.")}</p>
        {especialidades.isLoading ? (
          <p className="text-sm text-text-muted">{t("Carregando…")}</p>
        ) : (especialidades.data ?? []).length === 0 ? (
          <p className="text-sm text-text-muted">{t("Nenhuma especialização cadastrada. Cadastre em Configurações › Profissionais.")}</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {(especialidades.data ?? [])
              .filter((e) => e.is_active || esp.includes(e.id))
              .map((e) => (
                <label key={e.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    data-testid={`proc-esp-${e.name}`}
                    checked={esp.includes(e.id)}
                    onChange={(ev) => setEsp((x) => (ev.target.checked ? [...x, e.id] : x.filter((y) => y !== e.id)))}
                  />
                  {e.name}
                </label>
              ))}
          </div>
        )}
      </fieldset>

      <fieldset disabled={somenteLeitura || salvar.isPending}>
        <legend className="mb-1 text-sm font-semibold">{t("Profissionais")}</legend>
        {profissionais.isLoading ? (
          <p className="text-sm text-text-muted">{t("Carregando…")}</p>
        ) : listaDeProfissionais.length === 0 ? (
          <p className="text-sm text-text-muted">{t("Nenhum profissional cadastrado. Cadastre em Configurações › Profissionais.")}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {listaDeProfissionais.map((p) => {
              const apto = profissionalApto(esp, p);
              return (
                <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm" data-testid="proc-profissional" data-id={p.id}>
                  <label className={`flex items-center gap-2 ${apto ? "" : "text-text-muted"}`}>
                    <input
                      type="checkbox"
                      data-testid={`proc-prof-${nomeDo(p)}`}
                      disabled={!apto && !prof.includes(p.id)}
                      checked={prof.includes(p.id)}
                      onChange={(ev) => setProf((x) => (ev.target.checked ? [...x, p.id] : x.filter((y) => y !== p.id)))}
                    />
                    {nomeDo(p)}
                  </label>
                  {apto ? (
                    <span className="text-xs text-success-fg">{t("Apto")}</span>
                  ) : (
                    <span className="text-xs text-text-muted" data-testid="proc-prof-inapto">
                      {t("Sem nenhuma das especializações do procedimento")}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {semEspecialidade.length > 0 ? (
          <p className="mt-2 text-xs text-warning-fg" role="status">
            {t("Profissionais sem a especialização serão retirados ao salvar.")}
          </p>
        ) : null}
      </fieldset>

      {erro ? (
        <p id="procedimento-erro" role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}
      {podeGerenciar ? (
        <Button type="submit" data-testid="proc-salvar" disabled={salvar.isPending}>
          {salvar.isPending ? t("Salvando…") : novo ? t("Cadastrar procedimento") : t("Salvar")}
        </Button>
      ) : null}
    </form>
  );
}
