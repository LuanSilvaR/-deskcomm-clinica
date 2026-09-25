"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { AtendimentosPorEspecialidade } from "@/components/clinic/AtendimentosPorEspecialidade";
import { Bloqueios } from "@/components/clinic/Bloqueios";
import { Especialidades } from "@/components/clinic/Especialidades";
import { Profissionais } from "@/components/clinic/Profissionais";
import { SalasEEquipamentos } from "@/components/clinic/SalasEEquipamentos";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

interface Props {
  ligadoInicial: boolean;
  fichaObrigatoriaInicial: boolean;
  confirmacaoInicial: boolean;
  travaInicial: boolean;
  recursosInicial: boolean;
  procedimentosInicial: boolean;
  prazoInicial: number;
  podeLigar: boolean;
  ehGerencia: boolean;
  usuarioAtualId: string;
}

export function ProfissionaisClient({
  ligadoInicial,
  fichaObrigatoriaInicial,
  confirmacaoInicial,
  travaInicial,
  recursosInicial,
  procedimentosInicial,
  prazoInicial,
  podeLigar,
  ehGerencia,
  usuarioAtualId,
}: Props) {
  const t = useT();
  const [ligado, setLigado] = useState(ligadoInicial);
  const [fichaObrigatoria, setFichaObrigatoria] = useState(fichaObrigatoriaInicial);
  const [confirmacao, setConfirmacao] = useState(confirmacaoInicial);
  const [trava, setTrava] = useState(travaInicial);
  const [recursos, setRecursos] = useState(recursosInicial);
  const [procedimentos, setProcedimentos] = useState(procedimentosInicial);
  const [prazo, setPrazo] = useState(prazoInicial);
  const [prazoDigitado, setPrazoDigitado] = useState(String(prazoInicial));

  const salvarPrazo = useMutation({
    mutationFn: (horas: number) =>
      apiClient.patch<{ data: { prazo_paciente_horas: number } }>("/api/v1/clinic/config", { prazo_paciente_horas: horas }),
    onSuccess: (r) => {
      setPrazo(r.data.prazo_paciente_horas);
      setPrazoDigitado(String(r.data.prazo_paciente_horas));
    },
    onError: showApiError,
  });

  const alternarProcedimentos = useMutation({
    mutationFn: (valor: boolean) =>
      apiClient.patch<{ data: { procedimentos: boolean } }>("/api/v1/clinic/config", { procedimentos: valor }),
    onSuccess: (r) => setProcedimentos(r.data.procedimentos),
    onError: showApiError,
  });

  const alternarRecursos = useMutation({
    mutationFn: (valor: boolean) =>
      apiClient.patch<{ data: { recursos: boolean } }>("/api/v1/clinic/config", { recursos: valor }),
    onSuccess: (r) => setRecursos(r.data.recursos),
    onError: showApiError,
  });

  const alternarTrava = useMutation({
    mutationFn: (valor: boolean) =>
      apiClient.patch<{ data: { trava_sobreposicao: boolean } }>("/api/v1/clinic/config", { trava_sobreposicao: valor }),
    onSuccess: (r) => setTrava(r.data.trava_sobreposicao),
    onError: showApiError,
  });

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

      <section
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${trava ? "" : "bg-muted"}`}
        data-testid="clinic-trava"
      >
        <div>
          <p className="font-medium">
            {trava ? t("Trava de horário duplicado ligada") : t("Trava de horário duplicado desligada")}
          </p>
          <p className="text-sm text-text-muted">
            {trava
              ? t("O banco recusa dois atendimentos que se cruzam na agenda do mesmo profissional, mesmo marcados no mesmo instante pela recepção e pelo agente de IA.")
              : t("Ligue para o banco recusar atendimentos que se cruzam na agenda do mesmo profissional. O espelho do Google Agenda não é afetado.")}
          </p>
        </div>
        {podeLigar ? (
          <Button
            data-testid="clinic-trava-alternar"
            variant={trava ? "outline" : "default"}
            disabled={alternarTrava.isPending}
            onClick={() => alternarTrava.mutate(!trava)}
          >
            {trava ? t("Desligar") : t("Ligar")}
          </Button>
        ) : null}
      </section>

      <section
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${recursos ? "" : "bg-muted"}`}
        data-testid="clinic-recursos"
      >
        <div>
          <p className="font-medium">
            {recursos ? t("Salas e equipamentos ligados") : t("Salas e equipamentos desligados")}
          </p>
          <p className="text-sm text-text-muted">
            {recursos
              ? t("A agenda só oferece horário com a sala e o equipamento que o atendimento exige livres, e reserva os dois ao marcar.")
              : t("Ligue para a agenda considerar salas e equipamentos. Você pode cadastrá-los antes na aba Salas e equipamentos.")}
          </p>
        </div>
        {podeLigar ? (
          <Button
            data-testid="clinic-recursos-alternar"
            variant={recursos ? "outline" : "default"}
            disabled={alternarRecursos.isPending}
            onClick={() => alternarRecursos.mutate(!recursos)}
          >
            {recursos ? t("Desligar") : t("Ligar")}
          </Button>
        ) : null}
      </section>

      <section
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${procedimentos ? "" : "bg-muted"}`}
        data-testid="clinic-procedimentos"
      >
        <div>
          <p className="font-medium">{procedimentos ? t("Procedimentos e POP ligados") : t("Procedimentos e POP desligados")}</p>
          <p className="text-sm text-text-muted">
            {procedimentos
              ? t("A clínica cadastra os procedimentos, liga cada um às especialidades e profissionais, e mantém o POP versionado e imprimível.")
              : t("Ligue para cadastrar os procedimentos da clínica com o POP de cada um (versões, aprovação e impressão).")}
          </p>
        </div>
        {podeLigar ? (
          <Button
            data-testid="clinic-procedimentos-alternar"
            variant={procedimentos ? "outline" : "default"}
            disabled={alternarProcedimentos.isPending}
            onClick={() => alternarProcedimentos.mutate(!procedimentos)}
          >
            {procedimentos ? t("Desligar") : t("Ligar")}
          </Button>
        ) : null}
      </section>

      <section
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${prazo > 0 ? "" : "bg-muted"}`}
        data-testid="clinic-prazo"
      >
        <div>
          <p className="font-medium">
            {prazo > 0 ? `${t("Prazo para o paciente desmarcar pelo WhatsApp")}: ${prazo} h` : t("Sem prazo para o paciente desmarcar pelo WhatsApp")}
          </p>
          <p className="text-sm text-text-muted">
            {t("Dentro do prazo antes da consulta, o agente de IA não desmarca nem remarca: ele avisa que a recepção vai entrar em contato. A equipe continua podendo tudo. 0 = sem prazo.")}
          </p>
        </div>
        {podeLigar ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(prazoDigitado);
              if (Number.isInteger(n) && n >= 0 && n <= 168) salvarPrazo.mutate(n);
            }}
          >
            <input
              type="number"
              min={0}
              max={168}
              aria-label={t("Horas de antecedência")}
              data-testid="clinic-prazo-horas"
              className="w-20 rounded-md border bg-surface p-1.5"
              value={prazoDigitado}
              onChange={(e) => setPrazoDigitado(e.target.value)}
            />
            <Button type="submit" variant="outline" data-testid="clinic-prazo-salvar" disabled={salvarPrazo.isPending}>
              {t("Salvar")}
            </Button>
          </form>
        ) : null}
      </section>

      <Tabs defaultValue={ehGerencia ? "profissionais" : "bloqueios"}>
        <TabsList>
          {ehGerencia ? <TabsTrigger value="profissionais">{t("Profissionais")}</TabsTrigger> : null}
          {ehGerencia ? <TabsTrigger value="especialidades">{t("Especialidades")}</TabsTrigger> : null}
          {ehGerencia ? <TabsTrigger value="atendimentos">{t("Atendimentos")}</TabsTrigger> : null}
          {ehGerencia ? <TabsTrigger value="recursos">{t("Salas e equipamentos")}</TabsTrigger> : null}
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
            <TabsContent value="recursos">
              <SalasEEquipamentos podeEditar={ehGerencia} />
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
