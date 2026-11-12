/**
 * FORK clinic (#85) — os telefones EXTRAS da ficha do paciente (`contact_phones`, 8018).
 *
 * POST   — acrescenta um número à ficha (forma canônica; tipo, WhatsApp e rótulo).
 * DELETE — tira um número extra da ficha (`?telefone=+55…`). O principal não sai por aqui.
 *
 * Só com `settings.clinic.varios_telefones` ligado (8019): desligada, a ficha só
 * MOSTRA os extras que já existem (ex.: vindos da junção de fichas). Escrita a
 * partir de `agent` — o mesmo piso do PATCH de contato e da RLS da tabela. A
 * regra "um número, uma ficha" é do banco: número de outra ficha (ou o principal
 * desta) volta 23505 e sai como 409.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { canonicalPhoneBR } from "@/lib/channels/phone-variants";
import { falhaDoBanco } from "@/lib/clinic/api";
import { variosTelefonesLigadoNaConfig } from "@/lib/clinic/flags";
import { pacienteNoEscopo } from "@/lib/clinic/pacientes/escopo-de-pacientes";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ contactId: string }> };

const novoTelefone = z
  .object({
    phone_number: z.string().trim().min(8).max(30),
    type: z.enum(["fixo", "celular", "outro"]),
    whatsapp: z.enum(["sim", "nao", "nao_sei"]).default("nao_sei"),
    label: z.string().trim().min(1).max(60).nullish(),
  })
  .strict();

/**
 * A forma canônica do número digitado. Sem `+` e com 10 ou 11 dígitos é número
 * brasileiro com DDD (o que a recepção digita): ganha o 55 antes da regra do
 * nono dígito — a mesma leitura da busca de contatos.
 */
function numeroCanonico(bruto: string): string {
  const digitos = bruto.replace(/\D/g, "");
  const comPais = !bruto.trim().startsWith("+") && (digitos.length === 10 || digitos.length === 11) ? `55${digitos}` : digitos;
  return canonicalPhoneBR(comPais);
}

/** Só dígitos e `+`, de 10 a 15 dígitos: o mesmo alcance de um número com DDD/DDI. */
function numeroValido(canonico: string): boolean {
  const digitos = canonico.replace(/\D/g, "");
  return /^\+?\d+$/.test(canonico) && digitos.length >= 10 && digitos.length <= 15;
}

async function preparar(ctx: Ctx, requestId: string) {
  const authz = await requireRole("agent", { requestId, resource: "contacts" });
  if (!authz.ok) return { ok: false, resposta: authz.response as Response } as const;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { contactId } = await ctx.params;
  if (!z.string().uuid().safeParse(contactId).success) {
    return { ok: false, resposta: fail("validation_failed", t("id inválido"), 422, { requestId }) } as const;
  }
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data: organizacao } = await supabase.from("organizations").select("settings").eq("id", org).maybeSingle();
  if (!variosTelefonesLigadoNaConfig(organizacao?.settings)) {
    return {
      ok: false,
      resposta: fail("forbidden", t("A opção de vários telefones na ficha está desligada."), 403, { requestId }),
    } as const;
  }
  if (!(await pacienteNoEscopo(supabase, org, authz.user.id, contactId))) {
    return { ok: false, resposta: fail("not_found", t("Paciente não encontrado."), 404, { requestId }) } as const;
  }
  const { data: ficha } = await supabase
    .from("contacts")
    .select("id, phone_number")
    .eq("organization_id", org)
    .eq("id", contactId)
    .is("is_merged_into", null)
    .eq("is_anonymized", false)
    .maybeSingle();
  if (!ficha) return { ok: false, resposta: fail("not_found", t("Paciente não encontrado."), 404, { requestId }) } as const;
  return { ok: true, authz, t, org, supabase, contactId, ficha } as const;
}

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const p = await preparar(ctx, requestId);
  if (!p.ok) return p.resposta;
  const { authz, t, org, supabase, contactId, ficha } = p;

  const lido = novoTelefone.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return fail("validation_failed", t(lido.error.issues[0]?.message ?? "corpo inválido"), 422, { requestId });
  }
  const numero = numeroCanonico(lido.data.phone_number);
  if (!numeroValido(numero)) {
    return fail("validation_failed", t("Telefone inválido. Use DDD e número."), 422, { requestId });
  }
  if (ficha.phone_number && numeroCanonico(ficha.phone_number) === numero) {
    return fail("conflict", t("Este número já é o telefone principal da ficha."), 409, { requestId });
  }

  const { data, error } = await supabase
    .from("contact_phones")
    .insert({
      organization_id: org,
      contact_id: contactId,
      phone_number: numero,
      tipo: lido.data.type,
      whatsapp: lido.data.whatsapp,
      rotulo: lido.data.label ?? null,
      origem: "manual",
    })
    .select("phone_number, tipo, whatsapp, rotulo, origem, created_at")
    .single();
  if (error) {
    return falhaDoBanco(error, requestId, t, { conflito: "Este número já está em outra ficha." });
  }

  void audit({
    action: "clinic.paciente.telefone_extra",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "contact",
    resourceId: contactId,
    requestId,
    metadata: { operacao: "adicionar", tipo: data.tipo },
  });
  return ok(
    {
      phone_number: data.phone_number,
      type: data.tipo,
      whatsapp: data.whatsapp,
      label: data.rotulo,
      origin: data.origem,
      created_at: data.created_at,
    },
    { requestId, status: 201 },
  );
}

export async function DELETE(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const p = await preparar(ctx, requestId);
  if (!p.ok) return p.resposta;
  const { authz, t, org, supabase, contactId } = p;

  const bruto = new URL(req.url).searchParams.get("telefone") ?? "";
  const numero = numeroCanonico(bruto);
  if (!numeroValido(numero)) {
    return fail("validation_failed", t("Telefone inválido. Use DDD e número."), 422, { requestId });
  }
  const { data, error } = await supabase
    .from("contact_phones")
    .delete()
    .eq("organization_id", org)
    .eq("contact_id", contactId)
    .eq("phone_number", numero)
    .select("id");
  if (error) return falhaDoBanco(error, requestId, t);
  if (!data || data.length === 0) {
    return fail("not_found", t("Este número não está entre os telefones extras da ficha."), 404, { requestId });
  }

  void audit({
    action: "clinic.paciente.telefone_extra",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "contact",
    resourceId: contactId,
    requestId,
    metadata: { operacao: "remover" },
  });
  return ok({ removido: true }, { requestId });
}
