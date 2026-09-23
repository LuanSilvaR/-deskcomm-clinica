/**
 * Leitura e gravação da ficha do paciente — a fronteira com o banco.
 *
 * A ficha junta DUAS fontes: o que o núcleo já guarda no `contacts` (nome,
 * telefone, e-mail, nascimento e CPF) e o que o módulo clinic acrescenta em
 * `clinic_patient_profiles`. Toda consulta filtra `organization_id`
 * explicitamente — estas funções também rodam com service role.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { situacaoDaFicha, type SituacaoDaFicha } from "./ficha";

export const COLUNAS_DO_PERFIL =
  "social_name, sex, rg, rg_issuer, rg_uf, profession, marital_status, referral_source, cep, street, number, complement, district, city, uf, city_ibge_code, emergency_name, emergency_relationship, emergency_phone, guardian_name, guardian_cpf_hash, guardian_relationship, completed_at, updated_at";

export interface PerfilDoPaciente {
  social_name: string | null;
  sex: string | null;
  rg: string | null;
  rg_issuer: string | null;
  rg_uf: string | null;
  profession: string | null;
  marital_status: string | null;
  referral_source: string | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  uf: string | null;
  city_ibge_code: string | null;
  emergency_name: string | null;
  emergency_relationship: string | null;
  emergency_phone: string | null;
  guardian_name: string | null;
  guardian_cpf_hash: string | null;
  guardian_relationship: string | null;
  completed_at: string | null;
  updated_at: string | null;
}

export interface ContatoDaFicha {
  id: string;
  name: string | null;
  display_name: string | null;
  phone_number: string | null;
  email: string | null;
  birthdate: string | null;
  cpf_hash: string | null;
}

export interface FichaLida {
  contato: ContatoDaFicha;
  perfil: PerfilDoPaciente | null;
  situacao: SituacaoDaFicha;
}

/** Hoje em São Paulo, `YYYY-MM-DD` — a régua da idade do paciente. */
export function hojeNaClinica(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

export function situacaoDe(contato: ContatoDaFicha, perfil: PerfilDoPaciente | null, hoje: string): SituacaoDaFicha {
  return situacaoDaFicha(
    {
      nome: contato.name,
      temCpf: !!contato.cpf_hash,
      nascimento: contato.birthdate,
      sexo: perfil?.sex ?? null,
      telefone: contato.phone_number,
      cep: perfil?.cep ?? null,
      logradouro: perfil?.street ?? null,
      numero: perfil?.number ?? null,
      bairro: perfil?.district ?? null,
      cidade: perfil?.city ?? null,
      uf: perfil?.uf ?? null,
      emergenciaNome: perfil?.emergency_name ?? null,
      emergenciaParentesco: perfil?.emergency_relationship ?? null,
      emergenciaTelefone: perfil?.emergency_phone ?? null,
      responsavelNome: perfil?.guardian_name ?? null,
      temCpfDoResponsavel: !!perfil?.guardian_cpf_hash,
      responsavelParentesco: perfil?.guardian_relationship ?? null,
    },
    hoje,
  );
}

/** A ficha de um contato da organização, ou `null` se o contato não existe nela. */
export async function lerFicha(
  supabase: SupabaseClient,
  organizationId: string,
  contactId: string,
): Promise<{ ok: true; ficha: FichaLida | null } | { ok: false; erro: string }> {
  const [{ data: contato, error: e1 }, { data: perfil, error: e2 }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, display_name, phone_number, email, birthdate, cpf_hash")
      .eq("organization_id", organizationId)
      .eq("id", contactId)
      .maybeSingle(),
    supabase
      .from("clinic_patient_profiles")
      .select(COLUNAS_DO_PERFIL)
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .maybeSingle(),
  ]);
  if (e1 || e2) return { ok: false, erro: (e1 ?? e2)!.message };
  if (!contato) return { ok: true, ficha: null };
  const c = contato as ContatoDaFicha;
  const p = (perfil as PerfilDoPaciente | null) ?? null;
  return { ok: true, ficha: { contato: c, perfil: p, situacao: situacaoDe(c, p, hojeNaClinica()) } };
}

/** `organizations.settings.clinic.ficha_obrigatoria` — só o booleano `true` liga. */
export function fichaObrigatoriaLigada(settings: unknown): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return false;
  const clinic = (settings as Record<string, unknown>).clinic;
  if (!clinic || typeof clinic !== "object" || Array.isArray(clinic)) return false;
  return (clinic as Record<string, unknown>).ficha_obrigatoria === true;
}

export async function fichaObrigatoriaDaOrg(supabase: SupabaseClient, organizationId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("organizations").select("settings").eq("id", organizationId).maybeSingle();
    if (error || !data) return false;
    return fichaObrigatoriaLigada((data as { settings?: unknown }).settings);
  } catch {
    return false;
  }
}

/**
 * A chegada / o "Compareceu" pode acontecer? Com a regra desligada, sempre.
 * Ligada, só com a ficha completa — e devolve o que falta para a tela mostrar.
 */
export async function fichaPermiteAtendimento(
  supabase: SupabaseClient,
  organizationId: string,
  contactId: string | null,
): Promise<{ ok: true } | { ok: false; faltando: string[] } | { ok: false; erro: string }> {
  if (!contactId) return { ok: true };
  if (!(await fichaObrigatoriaDaOrg(supabase, organizationId))) return { ok: true };
  const lida = await lerFicha(supabase, organizationId, contactId);
  if (!lida.ok) return { ok: false, erro: lida.erro };
  if (!lida.ficha) return { ok: true };
  return lida.ficha.situacao.completa ? { ok: true } : { ok: false, faltando: lida.ficha.situacao.faltando };
}
