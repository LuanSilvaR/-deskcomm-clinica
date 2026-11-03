"use client";

/**
 * FORK clinic (agenda S4) — "Confirmar dados", na recepção do paciente que JÁ
 * veio antes: telefone e e-mail, cada um com "Está correto" ou "Editar"; o
 * e-mail aceita também "Não possui" (é opcional). Só grava no contato o que foi
 * EDITADO — confirmar não escreve nada além do registro de que foi conferido.
 *
 * O de 1ª vez não passa por aqui: completa o cadastro na ficha.
 */
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useContact } from "@/hooks/contacts/useContact";
import { useUpdateContact } from "@/hooks/contacts/useUpdateContact";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { CheckCircle } from "@/lib/ui/icons";

type Situacao = "pendente" | "ok" | "editando" | "nao_possui";

function Campo({
  rotulo,
  valor,
  situacao,
  tipo,
  testid,
  permiteNaoPossui,
  salvando,
  onSituacao,
  onSalvar,
}: {
  rotulo: string;
  valor: string | null;
  situacao: Situacao;
  tipo: "tel" | "email";
  testid: string;
  permiteNaoPossui?: boolean;
  salvando: boolean;
  onSituacao: (s: Situacao) => void;
  onSalvar: (novo: string) => void;
}) {
  const t = useT();
  const [texto, setTexto] = React.useState(valor ?? "");
  return (
    <div className="space-y-1" data-testid={testid} data-situacao={situacao}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-text-muted">{rotulo}:</span>
        <span className="text-sm font-medium">{valor || t("não informado")}</span>
        {situacao === "ok" || situacao === "nao_possui" ? (
          <span className="inline-flex items-center gap-1 text-xs text-success-fg">
            <CheckCircle size={14} weight="bold" aria-hidden />
            {situacao === "ok" ? t("Conferido") : t("Não possui")}
          </span>
        ) : null}
      </div>
      {situacao === "pendente" ? (
        <div className="flex flex-wrap gap-2">
          {valor ? (
            <Button size="sm" variant="outline" data-testid={`${testid}-correto`} onClick={() => onSituacao("ok")}>
              {t("Está correto")}
            </Button>
          ) : null}
          <Button size="sm" variant="outline" data-testid={`${testid}-editar`} onClick={() => onSituacao("editando")}>
            {valor ? t("Editar") : t("Informar")}
          </Button>
          {permiteNaoPossui ? (
            <Button size="sm" variant="ghost" data-testid={`${testid}-nao-possui`} onClick={() => onSituacao("nao_possui")}>
              {t("Não possui")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {situacao === "editando" ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSalvar(texto.trim());
          }}
        >
          <Input
            type={tipo}
            inputMode={tipo === "tel" ? "tel" : "email"}
            aria-label={rotulo}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={tipo === "tel" ? "+5511999998888" : "paciente@email.com"}
            className="max-w-xs"
          />
          <Button size="sm" type="submit" disabled={salvando || texto.trim().length === 0}>
            {t("Salvar")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function ConfirmarDadosDoPaciente({
  contactId,
  appointmentId,
  onConfirmado,
}: {
  contactId: string;
  /** O agendamento em recepção — a conferência fica registrada nele (auditoria). */
  appointmentId: string;
  /** Telefone e e-mail resolvidos (conferidos, editados ou "não possui"). */
  onConfirmado?: () => void;
}) {
  const t = useT();
  const contato = useContact(contactId);
  const atualizar = useUpdateContact(contactId);
  const dados = contato.data?.data;
  const [telefone, setTelefone] = React.useState<Situacao>("pendente");
  const [email, setEmail] = React.useState<Situacao>("pendente");
  const editou = React.useRef({ telefone: false, email: false });
  const resolvido = (s: Situacao) => s === "ok" || s === "nao_possui";
  const pronto = resolvido(telefone) && resolvido(email);
  const avisou = React.useRef(false);
  React.useEffect(() => {
    if (pronto && !avisou.current) {
      avisou.current = true;
      void apiClient
        .post(`/api/v1/clinic/agendamentos/${appointmentId}/dados-confirmados`, {
          telefone: editou.current.telefone ? "editado" : "correto",
          email: email === "nao_possui" ? "nao_possui" : editou.current.email ? "editado" : "correto",
        })
        .catch(() => undefined);
      onConfirmado?.();
    }
  }, [pronto, onConfirmado, appointmentId, email]);

  if (contato.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (!dados) return null;

  return (
    <section className="space-y-2 rounded-md border border-border p-2" data-testid="confirmar-dados" data-pronto={pronto}>
      <p className="text-sm font-semibold">{t("Confirmar dados")}</p>
      <Campo
        rotulo={t("Telefone")}
        valor={dados.phone_number ?? null}
        situacao={telefone}
        tipo="tel"
        testid="confirmar-telefone"
        salvando={atualizar.isPending}
        onSituacao={setTelefone}
        onSalvar={(novo) =>
          atualizar.mutate(
            { phone_number: novo },
            {
              onSuccess: () => {
                editou.current.telefone = true;
                setTelefone("ok");
              },
            },
          )
        }
      />
      <Campo
        rotulo={t("E-mail")}
        valor={dados.email ?? null}
        situacao={email}
        tipo="email"
        testid="confirmar-email"
        permiteNaoPossui
        salvando={atualizar.isPending}
        onSituacao={setEmail}
        onSalvar={(novo) =>
          atualizar.mutate(
            { email: novo },
            {
              onSuccess: () => {
                editou.current.email = true;
                setEmail("ok");
              },
            },
          )
        }
      />
    </section>
  );
}
