/**
 * /api/v1/clinic/pacientes/:contactId/ficha — a ficha cadastral do paciente.
 *
 * GET (viewer): a ficha e a situação `{ completa, faltando }`. O CPF nunca volta
 * em claro por aqui — só "tem CPF" (o detalhe do contato decifra para gerência,
 * com finalidade, como já fazia).
 * PUT (agent+): a recepção grava. Nome, nascimento, e-mail e CPF vão para o
 * `contacts` (núcleo); o resto para `clinic_patient_profiles`. CPF só é gravado
 * como o PAR hash + cifra (`cifrarCpf`).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { falhaDoBanco } from "@/lib/clinic/api";
import { lerFicha } from "@/lib/clinic/pacientes/servidor";
import { cifrarCpf } from "@/lib/contacts/cpf";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { isValidCpf } from "@/lib/legal/perfil-do-pais";
import { createClient } from "@/lib/supabase/server";
import { normalizePhoneBR } from "@/lib/webhooks/inbound";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ contactId: string }> };

function formaDaResposta(f: NonNullable<Extract<Awaited<ReturnType<typeof lerFicha>>, { ok: true }>["ficha"]>) {
  const { cpf_hash, ...contato } = f.contato;
  const perfil = f.perfil ? (({ guardian_cpf_hash, ...resto }) => ({ ...resto, tem_cpf_do_responsavel: !!guardian_cpf_hash }))(f.perfil) : null;
  return { contato: { ...contato, tem_cpf: !!cpf_hash }, perfil, situacao: f.situacao };
}

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "clinic_patient_profiles" });
  if (!authz.ok) return authz.response;
  const { contactId } = await ctx.params;
  if (!z.string().uuid().safeParse(contactId).success) return fail("validation_failed", "id inválido", 422, { requestId });

  const supabase = await createClient();
  const r = await lerFicha(supabase, authz.org.orgId, contactId);
  if (!r.ok) return fail("internal_error", r.erro, 500, { requestId });
  if (!r.ficha) return fail("not_found", traduzir("Paciente não encontrado.", authz.user.idioma), 404, { requestId });
  return ok(formaDaResposta(r.ficha), { requestId });
}

const texto = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v ? v : null));
const soDigitos = (v: string | null | undefined) => (v ? v.replace(/\D/g, "") : null);

const putSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").max(200),
  cpf: z
    .string()
    .trim()
    .nullish()
    .refine((v) => !v || isValidCpf(v), "CPF inválido."),
  nascimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de nascimento inválida.")
    .nullish(),
  email: z.string().trim().email("E-mail inválido.").max(320).nullish().or(z.literal("")),
  sexo: z.enum(["feminino", "masculino", "intersexo", "nao_informado"]).nullish(),
  nome_social: texto(120),
  rg: texto(30),
  rg_orgao: texto(30),
  rg_uf: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "UF do RG com duas letras").nullish().or(z.literal("")),
  profissao: texto(120),
  estado_civil: z
    .enum(["solteiro", "casado", "uniao_estavel", "separado", "divorciado", "viuvo", "nao_informado"])
    .nullish(),
  origem: texto(120),
  cep: z
    .string()
    .nullish()
    .transform(soDigitos)
    .refine((v) => !v || /^\d{8}$/.test(v), "CEP com 8 números."),
  logradouro: texto(200),
  numero: texto(20),
  complemento: texto(120),
  bairro: texto(120),
  cidade: texto(120),
  uf: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "UF com duas letras").nullish().or(z.literal("")),
  codigo_ibge: z
    .string()
    .nullish()
    .transform(soDigitos)
    .refine((v) => !v || /^\d{7}$/.test(v), "Código IBGE com 7 números."),
  emergencia_nome: texto(120),
  emergencia_parentesco: texto(60),
  emergencia_telefone: z.string().trim().max(30).nullish(),
  responsavel_nome: texto(120),
  responsavel_cpf: z
    .string()
    .trim()
    .nullish()
    .refine((v) => !v || isValidCpf(v), "CPF do responsável inválido."),
  responsavel_parentesco: texto(60),
});

export async function PUT(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "clinic_patient_profiles" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { contactId } = await ctx.params;
  if (!z.string().uuid().safeParse(contactId).success) return fail("validation_failed", "id inválido", 422, { requestId });

  const lido = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return fail("validation_failed", t(lido.error.issues[0]?.message ?? "corpo inválido"), 422, { requestId });
  }
  const d = lido.data;
  const org = authz.org.orgId;
  const supabase = await createClient();

  const atual = await lerFicha(supabase, org, contactId);
  if (!atual.ok) return fail("internal_error", atual.erro, 500, { requestId });
  if (!atual.ficha) return fail("not_found", t("Paciente não encontrado."), 404, { requestId });

  let telEmergencia: string | null = null;
  if (d.emergencia_telefone) {
    telEmergencia = normalizePhoneBR(d.emergencia_telefone);
    if (!telEmergencia) return fail("validation_failed", t("Telefone do contato de emergência inválido."), 422, { requestId });
  }

  // ── núcleo: contacts ──────────────────────────────────────────────────────
  const patchDoContato: Record<string, unknown> = {
    name: d.nome,
    birthdate: d.nascimento ?? null,
    email: d.email ? d.email : null,
  };
  if (d.cpf) {
    const par = await cifrarCpf(supabase, d.cpf.replace(/\D/g, ""));
    if (!par) return fail("internal_error", t("Não foi possível proteger o CPF agora."), 500, { requestId });
    Object.assign(patchDoContato, par);
  }
  const { error: erroContato } = await supabase
    .from("contacts")
    .update(patchDoContato)
    .eq("organization_id", org)
    .eq("id", contactId);
  if (erroContato) {
    return falhaDoBanco(erroContato, requestId, t, { conflito: "Já existe outro paciente com este CPF." });
  }

  // ── módulo: clinic_patient_profiles ───────────────────────────────────────
  const perfil: Record<string, unknown> = {
    organization_id: org,
    contact_id: contactId,
    social_name: d.nome_social,
    sex: d.sexo ?? null,
    rg: d.rg,
    rg_issuer: d.rg_orgao,
    rg_uf: d.rg_uf ? d.rg_uf : null,
    profession: d.profissao,
    marital_status: d.estado_civil ?? null,
    referral_source: d.origem,
    cep: d.cep,
    street: d.logradouro,
    number: d.numero,
    complement: d.complemento,
    district: d.bairro,
    city: d.cidade,
    uf: d.uf ? d.uf : null,
    city_ibge_code: d.codigo_ibge,
    emergency_name: d.emergencia_nome,
    emergency_relationship: d.emergencia_parentesco,
    emergency_phone: telEmergencia,
    guardian_name: d.responsavel_nome,
    guardian_relationship: d.responsavel_parentesco,
  };
  if (d.responsavel_cpf) {
    const par = await cifrarCpf(supabase, d.responsavel_cpf.replace(/\D/g, ""));
    if (!par) return fail("internal_error", t("Não foi possível proteger o CPF agora."), 500, { requestId });
    perfil.guardian_cpf_hash = par.cpf_hash;
    perfil.guardian_cpf_encrypted = par.cpf_encrypted;
  }
  const { error: erroPerfil } = await supabase
    .from("clinic_patient_profiles")
    .upsert(perfil, { onConflict: "organization_id,contact_id" });
  if (erroPerfil) return falhaDoBanco(erroPerfil, requestId, t);

  // ── a situação vale DEPOIS de gravar; completed_at acompanha ───────────────
  const depois = await lerFicha(supabase, org, contactId);
  if (!depois.ok || !depois.ficha) return fail("internal_error", depois.ok ? "ficha sumiu" : depois.erro, 500, { requestId });
  const completa = depois.ficha.situacao.completa;
  const jaEstava = !!depois.ficha.perfil?.completed_at;
  if (completa !== jaEstava) {
    await supabase
      .from("clinic_patient_profiles")
      .update(completa ? { completed_at: new Date().toISOString(), completed_by: authz.user.id } : { completed_at: null, completed_by: null })
      .eq("organization_id", org)
      .eq("contact_id", contactId);
  }

  void audit({
    action: "clinic.ficha_salva",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "contact",
    resourceId: contactId,
    requestId,
    metadata: {
      completa,
      faltando: depois.ficha.situacao.faltando.length,
      cpf_alterado: !!d.cpf,
      menor_de_idade: depois.ficha.situacao.menorDeIdade,
    },
  });
  const final = await lerFicha(supabase, org, contactId);
  if (!final.ok || !final.ficha) return fail("internal_error", "ficha sumiu", 500, { requestId });
  return ok(formaDaResposta(final.ficha), { requestId });
}
