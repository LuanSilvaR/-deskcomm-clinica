"use client";

/**
 * FORK clinic (9015) — o procedimento em abas: Cadastro (dados, especializações
 * e profissionais), POP (o documento vigente ou o rascunho) e Histórico (versões).
 */
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { AbaDoHistorico, AbaDoPop } from "@/components/clinic/pops/PopDoProcedimento";
import { EditorDoProcedimento } from "@/components/clinic/procedimentos/EditorDoProcedimento";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePessoasDaAgenda } from "@/hooks/agenda/usePessoasDaAgenda";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { usePermissoes } from "@/lib/clinic/acesso/use-permissoes";
import type { Procedimento } from "@/lib/clinic/procedimentos/servidor";
import { CaretLeft } from "@/lib/ui/icons";

export function DetalheDoProcedimento({ id }: { id: string | null }) {
  const t = useT();
  const { can, carregando } = usePermissoes();
  const { data: pessoas = [] } = usePessoasDaAgenda();
  const nomeDaPessoa = (userId: string) => pessoas.find((p) => p.id === userId)?.nome;
  const consulta = useQuery({
    queryKey: ["clinic", "procedimentos", id],
    queryFn: async () => (await apiClient.get<{ data: Procedimento }>(`/api/v1/clinic/procedimentos/${id}`)).data,
    enabled: Boolean(id),
  });

  const voltar = (
    <Link href="/app/procedimentos" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text">
      <CaretLeft aria-hidden /> {t("Procedimentos")}
    </Link>
  );

  if (!id) {
    return (
      <div className="space-y-4">
        {voltar}
        <h1 className="text-2xl font-semibold tracking-tight">{t("Novo procedimento")}</h1>
        {carregando ? null : <EditorDoProcedimento podeGerenciar={can("procedimentos.gerenciar")} nomeDaPessoa={nomeDaPessoa} />}
      </div>
    );
  }
  if (consulta.isLoading || carregando) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (consulta.isError || !consulta.data) {
    return (
      <div className="space-y-2">
        {voltar}
        <p className="text-sm text-destructive">{t("Procedimento não encontrado.")}</p>
      </div>
    );
  }
  const p = consulta.data;
  return (
    <div className="space-y-4" data-testid="detalhe-do-procedimento">
      {voltar}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
        <p className="text-sm text-text-muted">
          {[p.code, p.duration_minutes ? `${p.duration_minutes} min` : null, p.is_active ? t("Ativo") : t("Inativo")].filter(Boolean).join(" · ")}
        </p>
      </header>
      <Tabs defaultValue="cadastro">
        <TabsList>
          <TabsTrigger value="cadastro" data-testid="proc-aba-cadastro">{t("Cadastro")}</TabsTrigger>
          {can("pops.ver") ? (
            <>
              <TabsTrigger value="pop" data-testid="proc-aba-pop">
                {t("POP")}
                {p.pop?.vigente ? ` · v${p.pop.vigente.versao}` : p.pop ? ` · ${t("rascunho")}` : ""}
              </TabsTrigger>
              <TabsTrigger value="historico" data-testid="proc-aba-historico">{t("Histórico")}</TabsTrigger>
            </>
          ) : null}
        </TabsList>
        <TabsContent value="cadastro" className="mt-4">
          <EditorDoProcedimento key={p.updated_at} procedimento={p} podeGerenciar={can("procedimentos.gerenciar")} nomeDaPessoa={nomeDaPessoa} />
        </TabsContent>
        {can("pops.ver") ? (
          <>
            <TabsContent value="pop" className="mt-4">
              <AbaDoPop procedimento={p} />
            </TabsContent>
            <TabsContent value="historico" className="mt-4">
              <AbaDoHistorico procedimento={p} />
            </TabsContent>
          </>
        ) : null}
      </Tabs>
    </div>
  );
}
