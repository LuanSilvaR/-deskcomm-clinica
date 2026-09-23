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
  fichaObrigatoriaInicial: boolean;
  confirmacaoInicial: boolean;
  podeLigar: boolean;
  ehGerencia: boolean;
  usuarioAtualId: string;
}

export function ProfissionaisClient({
  ligadoInicial,
  fichaObrigatoriaInicial,
  confirmacaoInicial,
  podeLigar,
  ehGerencia,
  usuarioAtualId,
}: Props) {
  const t = useT();
  const [ligado, setLigado] = useState(ligadoInicial);
  const [fichaObrigatoria, setFichaObrigatoria] = useState(fichaObrigatoriaInicial);
  const [confirmacao, setConfirmacao] = useState(confirmacaoInicial);

  const alternarConfirmacao = useMutation({
    mutationFn: (valor: boolean) =>
      apiClient.patch<{ data: { confirmacao_automatica: boolean } }>("/api/v1/clinic/config", {
        confirmacao_automatica: valor,
      }),
    onSuccess: (r) => setConfirmacao(r.data.confirmacao_automatica),
    onError: showApiError,
  });

  const alternarFicha = useMutation({
    mutationFn: (valor: boolean) =>
      apiClient.patch<{ data: { ficha_obrigatoria: boolean } }>("/api/v1/clinic/config", { ficha_obrigatoria: valor }),
    onSuccess: (r) => setFichaObrigatoria(r.data.ficha_obrigatoria),
    onError: showApiError,
  });

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

      <section
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${fichaObrigatoria ? "" : "bg-muted"}`}
        data-testid="clinic-ficha-obrigatoria"
      >
        <div>
          <p className="font-medium">
            {fichaObrigatoria ? t("Ficha do paciente exigida na chegada") : t("Ficha do paciente não é exigida")}
          </p>
          <p className="text-sm text-text-muted">
            {fichaObrigatoria
              ? t("\"Paciente chegou\" e \"Compareceu\" só são registrados com a ficha cadastral completa.")
              : t("Ligue para exigir a ficha cadastral completa ao registrar a chegada e o comparecimento.")}
          </p>
        </div>
        {podeLigar ? (
          <Button
            data-testid="clinic-ficha-obrigatoria-alternar"
            variant={fichaObrigatoria ? "outline" : "default"}
            disabled={alternarFicha.isPending}
            onClick={() => alternarFicha.mutate(!fichaObrigatoria)}
          >
            {fichaObrigatoria ? t("Desligar") : t("Ligar")}
          </Button>
        ) : null}
      </section>

      <section
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${confirmacao ? "" : "bg-muted"}`}
        data-testid="clinic-confirmacao"
      >
        <div>
          <p className="font-medium">
            {confirmacao ? t("Confirmação automática ligada") : t("Confirmação automática desligada")}
          </p>
          <p className="text-sm text-text-muted">
            {confirmacao
              ? t("O lembrete de 12 h ou mais antes pede SIM ou NÃO. Sem resposta até 4 h antes, a recepção recebe a tarefa de ligar.")
              : t("Ligue para o lembrete da véspera pedir SIM ou NÃO ao paciente. Vale para os tipos de atendimento com lembrete ligado.")}
          </p>
        </div>
        {podeLigar ? (
          <Button
            data-testid="clinic-confirmacao-alternar"
            variant={confirmacao ? "outline" : "default"}
            disabled={alternarConfirmacao.isPending}
            onClick={() => alternarConfirmacao.mutate(!confirmacao)}
          >
            {confirmacao ? t("Desligar") : t("Ligar")}
          </Button>
        ) : null}
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
