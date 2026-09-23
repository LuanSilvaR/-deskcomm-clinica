"use client";

/**
 * Ficha cadastral do paciente (módulo clinic, migration 9002).
 *
 * No primeiro contato (WhatsApp) o paciente tem só nome e telefone; na chegada à
 * clínica a recepção completa esta ficha — base da nota fiscal e do prontuário.
 * O que falta vem do servidor (`situacao.faltando`), a mesma regra que trava a
 * chegada: a tela nunca decide sozinha se a ficha está completa.
 *
 * O CPF nunca volta em claro: com CPF gravado a tela mostra "cadastrado" e só
 * pede o número de novo para TROCAR.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { idadeEm } from "@/lib/clinic/pacientes/ficha";
import { hojeNaClinica } from "@/lib/clinic/pacientes/servidor";

export interface SituacaoDaFicha {
  completa: boolean;
  faltando: string[];
  menorDeIdade: boolean;
}

interface FichaDoServidor {
  contato: {
    id: string;
    name: string | null;
    display_name: string | null;
    phone_number: string | null;
    email: string | null;
    birthdate: string | null;
    tem_cpf: boolean;
  };
  perfil: Record<string, string | null | boolean> | null;
  situacao: SituacaoDaFicha;
}

type Campos = Record<string, string>;

const SEXOS: [string, string][] = [
  ["", "Selecione"],
  ["feminino", "Feminino"],
  ["masculino", "Masculino"],
  ["intersexo", "Intersexo"],
  ["nao_informado", "Prefere não informar"],
];

const ESTADOS_CIVIS: [string, string][] = [
  ["", "Selecione"],
  ["solteiro", "Solteiro(a)"],
  ["casado", "Casado(a)"],
  ["uniao_estavel", "União estável"],
  ["separado", "Separado(a)"],
  ["divorciado", "Divorciado(a)"],
  ["viuvo", "Viúvo(a)"],
  ["nao_informado", "Prefere não informar"],
];

function camposDe(f: FichaDoServidor): Campos {
  const p = f.perfil ?? {};
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    nome: s(f.contato.name) || s(f.contato.display_name),
    cpf: "",
    nascimento: s(f.contato.birthdate),
    email: s(f.contato.email),
    sexo: s(p.sex),
    nome_social: s(p.social_name),
    rg: s(p.rg),
    rg_orgao: s(p.rg_issuer),
    rg_uf: s(p.rg_uf),
    profissao: s(p.profession),
    estado_civil: s(p.marital_status),
    origem: s(p.referral_source),
    cep: s(p.cep),
    logradouro: s(p.street),
    numero: s(p.number),
    complemento: s(p.complement),
    bairro: s(p.district),
    cidade: s(p.city),
    uf: s(p.uf),
    codigo_ibge: s(p.city_ibge_code),
    emergencia_nome: s(p.emergency_name),
    emergencia_parentesco: s(p.emergency_relationship),
    emergencia_telefone: s(p.emergency_phone),
    responsavel_nome: s(p.guardian_name),
    responsavel_cpf: "",
    responsavel_parentesco: s(p.guardian_relationship),
  };
}

export function chaveDaFicha(contactId: string) {
  return ["clinic", "ficha", contactId] as const;
}

export function SeloDaFicha({ situacao }: { situacao: { completa: boolean; faltando: number } | undefined }) {
  const t = useT();
  if (!situacao) return null;
  return situacao.completa ? (
    <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success" data-testid="selo-ficha-completa">
      {t("Ficha completa")}
    </span>
  ) : (
    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning" data-testid="selo-ficha-incompleta">
      {t("Ficha incompleta")}
    </span>
  );
}

export function FichaDoPaciente({
  contactId,
  podeEditar,
  onSalva,
}: {
  contactId: string;
  podeEditar: boolean;
  onSalva?: (situacao: SituacaoDaFicha) => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: chaveDaFicha(contactId),
    queryFn: async () =>
      (await apiClient.get<{ data: FichaDoServidor }>(`/api/v1/clinic/pacientes/${contactId}/ficha`)).data,
  });
  // O que a pessoa editou; sem edição, os campos saem do servidor (sem efeito
  // copiando estado — o que vem do banco é derivado a cada render).
  const [editados, setCampos] = useState<Campos | null>(null);
  const campos = editados ?? (query.data ? camposDe(query.data) : null);

  const salvar = useMutation({
    mutationFn: (c: Campos) => {
      const corpo: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(c)) corpo[k] = v.trim() === "" ? null : v.trim();
      corpo.nome = (c.nome ?? "").trim();
      return apiClient.put<{ data: FichaDoServidor }>(`/api/v1/clinic/pacientes/${contactId}/ficha`, corpo);
    },
    onSuccess: (r) => {
      qc.setQueryData(chaveDaFicha(contactId), r.data);
      setCampos(null);
      void qc.invalidateQueries({ queryKey: ["clinic", "situacao"] });
      void qc.invalidateQueries({ queryKey: ["contacts"] });
      onSalva?.(r.data.situacao);
    },
    onError: showApiError,
  });

  if (query.isLoading || !campos) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (query.isError || !query.data) {
    return <p className="text-sm text-destructive">{t("Não foi possível carregar a ficha do paciente.")}</p>;
  }

  const ficha = query.data;
  // A idade sai do que está DIGITADO, não do que foi salvo: a seção do
  // responsável aparece na hora em que a recepção põe uma data de menor.
  const menor = /^\d{4}-\d{2}-\d{2}$/.test(campos.nascimento ?? "")
    ? idadeEm(campos.nascimento!, hojeNaClinica()) < 18
    : ficha.situacao.menorDeIdade;
  const muda = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setCampos({ ...campos, [k]: e.target.value });

  const campo = (k: string, rotulo: string, extra: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}) => (
    <label className="block">
      <span className="block text-sm">{rotulo}</span>
      <input
        aria-label={rotulo}
        className="mt-1 w-full rounded-md border bg-surface p-2"
        disabled={!podeEditar}
        value={campos[k] ?? ""}
        onChange={muda(k)}
        {...extra}
      />
    </label>
  );

  const escolha = (k: string, rotulo: string, opcoes: [string, string][]) => (
    <label className="block">
      <span className="block text-sm">{rotulo}</span>
      <select
        aria-label={rotulo}
        className="mt-1 w-full rounded-md border bg-surface p-2"
        disabled={!podeEditar}
        value={campos[k] ?? ""}
        onChange={muda(k)}
      >
        {opcoes.map(([v, r]) => (
          <option key={v} value={v}>
            {t(r)}
          </option>
        ))}
      </select>
    </label>
  );

  const secao = (titulo: string, filhos: React.ReactNode) => (
    <fieldset className="space-y-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-semibold">{titulo}</legend>
      <div className="grid gap-2 sm:grid-cols-2">{filhos}</div>
    </fieldset>
  );

  return (
    <form
      className="space-y-4"
      data-testid="ficha-do-paciente-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (podeEditar) salvar.mutate(campos);
      }}
    >
      <div
        className={`rounded-lg border p-3 text-sm ${ficha.situacao.completa ? "border-success/40" : "border-warning/40"}`}
        data-testid="ficha-situacao"
      >
        {ficha.situacao.completa ? (
          <p className="font-medium text-success">{t("Ficha completa. O paciente pode ser atendido.")}</p>
        ) : (
          <>
            <p className="font-medium text-warning">
              {t("Ficha incompleta — falta preencher")}: {ficha.situacao.faltando.length}
            </p>
            <p className="mt-1 text-text-muted" data-testid="ficha-faltando">
              {ficha.situacao.faltando.map((f) => t(f)).join(", ")}
            </p>
          </>
        )}
      </div>

      {secao(
        t("Identificação"),
        <>
          {campo("nome", t("Nome completo"))}
          {campo("nome_social", t("Nome social (opcional)"))}
          <label className="block">
            <span className="block text-sm">{t("CPF")}</span>
            <input
              aria-label={t("CPF")}
              className="mt-1 w-full rounded-md border bg-surface p-2"
              disabled={!podeEditar}
              inputMode="numeric"
              placeholder={ficha.contato.tem_cpf ? t("CPF cadastrado — digite só para trocar") : "000.000.000-00"}
              value={campos.cpf ?? ""}
              onChange={muda("cpf")}
            />
          </label>
          {campo("nascimento", t("Data de nascimento"), { type: "date" })}
          {escolha("sexo", t("Sexo"), SEXOS)}
          {campo("email", t("E-mail (opcional)"), { type: "email" })}
          <p className="text-sm text-text-muted sm:col-span-2">
            {t("Telefone")}: {ficha.contato.phone_number ?? t("não informado")}
          </p>
          {campo("rg", t("RG (opcional)"))}
          {campo("rg_orgao", t("Órgão emissor (opcional)"))}
          {campo("rg_uf", t("UF do RG (opcional)"), { maxLength: 2 })}
        </>,
      )}

      {secao(
        t("Endereço"),
        <>
          {campo("cep", t("CEP"), { inputMode: "numeric", placeholder: "00000-000" })}
          {campo("logradouro", t("Logradouro"))}
          {campo("numero", t("Número"))}
          {campo("complemento", t("Complemento (opcional)"))}
          {campo("bairro", t("Bairro"))}
          {campo("cidade", t("Cidade"))}
          {campo("uf", t("UF"), { maxLength: 2 })}
          {campo("codigo_ibge", t("Código IBGE do município (opcional)"), { inputMode: "numeric" })}
        </>,
      )}

      {secao(
        t("Contato de emergência"),
        <>
          {campo("emergencia_nome", t("Nome"))}
          {campo("emergencia_parentesco", t("Parentesco"))}
          {campo("emergencia_telefone", t("Telefone"), { inputMode: "tel", placeholder: "(11) 99999-9999" })}
        </>,
      )}

      {menor
        ? secao(
            t("Responsável legal (paciente menor de idade)"),
            <>
              {campo("responsavel_nome", t("Nome do responsável"))}
              <label className="block">
                <span className="block text-sm">{t("CPF do responsável")}</span>
                <input
                  aria-label={t("CPF do responsável")}
                  className="mt-1 w-full rounded-md border bg-surface p-2"
                  disabled={!podeEditar}
                  inputMode="numeric"
                  placeholder={
                    ficha.perfil?.tem_cpf_do_responsavel ? t("CPF cadastrado — digite só para trocar") : "000.000.000-00"
                  }
                  value={campos.responsavel_cpf ?? ""}
                  onChange={muda("responsavel_cpf")}
                />
              </label>
              {campo("responsavel_parentesco", t("Parentesco do responsável"))}
            </>,
          )
        : null}

      {secao(
        t("Perfil (opcional)"),
        <>
          {campo("profissao", t("Profissão"))}
          {escolha("estado_civil", t("Estado civil"), ESTADOS_CIVIS)}
          {campo("origem", t("Como conheceu a clínica"))}
        </>,
      )}

      {podeEditar ? (
        <Button type="submit" data-testid="ficha-salvar" disabled={salvar.isPending}>
          {salvar.isPending ? t("Salvando…") : t("Salvar ficha")}
        </Button>
      ) : null}
    </form>
  );
}
