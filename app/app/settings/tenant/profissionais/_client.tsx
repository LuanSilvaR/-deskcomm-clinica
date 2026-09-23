"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { AtendimentosPorEspecialidade } from "@/components/clinic/AtendimentosPorEspecialidade";
import { Bloqueios } from "@/components/clinic/Bloqueios";
import { Especialidades } from "@/components/clinic/Especialidades";
import { Profissionais } from "@/components/clinic/Profissionais";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

interface Props {
  ligadoInicial: boolean;
  podeLigar: boolean;
  ehGerencia: boolean;
  usuarioAtualId: string;
}

export function ProfissionaisClient({ ligadoInicial, podeLigar, ehGerencia, usuarioAtualId }: Props) {
  const t = useT();
  const [ligado, setLigado] = useState(ligadoInicial);

  const alternar = useMutation({
    mutationFn: (valor: boolean) =>
      apiClient.patch<{ data: { profissionais: boolean } }>("/api/v1/clinic/config", { profissionais: valor }),
    onSuccess: (r) => setLigado(r.data.profissionais),
    onError: showApiError,
  });

  return (
    <div className="space-y-4">
      <section
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${ligado ? "" : "bg-muted"}`}
        data-testid="clinic-modulo"
      >
        <div>
          <p className="font-medium">
            {ligado ? t("Regras de profissionais ligadas") : t("Regras de profissionais desligadas")}
          </p>
          <p className="text-sm text-text-muted">
            {ligado
              ? t("A agenda só oferece quem tem a especialidade exigida e respeita os bloqueios abaixo.")
              : t("Você pode cadastrar tudo agora. A agenda só passa a usar especialidades e bloqueios quando isto for ligado.")}
          </p>
        </div>
        {podeLigar ? (
          <Button
            data-testid="clinic-modulo-alternar"
            variant={ligado ? "outline" : "default"}
            disabled={alternar.isPending}
            onClick={() => alternar.mutate(!ligado)}
          >
            {ligado ? t("Desligar") : t("Ligar")}
          </Button>
        ) : (
          <span className="text-sm text-text-muted">{t("Só quem administra a empresa liga ou desliga.")}</span>
        )}
      </section>

      <Tabs defaultValue={ehGerencia ? "profissionais" : "bloqueios"}>
        <TabsList>
          {ehGerencia ? <TabsTrigger value="profissionais">{t("Profissionais")}</TabsTrigger> : null}
          {ehGerencia ? <TabsTrigger value="especialidades">{t("Especialidades")}</TabsTrigger> : null}
          {ehGerencia ? <TabsTrigger value="atendimentos">{t("Atendimentos")}</TabsTrigger> : null}
          <TabsTrigger value="bloqueios">{t("Bloqueios")}</TabsTrigger>
        </TabsList>
        {ehGerencia ? (
          <>
            <TabsContent value="profissionais">
              <Profissionais podeEditar={ehGerencia} />
            </TabsContent>
            <TabsContent value="especialidades">
              <Especialidades podeEditar={ehGerencia} />
            </TabsContent>
            <TabsContent value="atendimentos">
              <AtendimentosPorEspecialidade podeEditar={ehGerencia} />
            </TabsContent>
          </>
        ) : null}
        <TabsContent value="bloqueios">
          <Bloqueios usuarioAtualId={usuarioAtualId} ehGerencia={ehGerencia} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
