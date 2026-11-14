/**
 * A busca da recepção (`interpretarBusca`) traduzida em filtro do PostgREST
 * sobre `contacts` — nome, telefone, CPF (por hash exato, nunca em claro) ou
 * nascimento. Usada pela marcação (/api/v1/agenda/vinculos) e pela Agenda do
 * dia. Busca vazia devolve a consulta como veio.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { hashCpf } from "@/lib/contacts/cpf";

import { interpretarBusca } from "./busca";

interface Filtravel<T> {
  eq(coluna: string, valor: string): T;
  or(filtro: string): T;
  ilike(coluna: string, padrao: string): T;
}

// Genérico solto de propósito: amarrar T ao construtor do PostgREST estoura a
// profundidade de instanciação do TypeScript (TS2589).
export function filtrarContatosPelaBusca<T>(consulta: T, bruto: string, idsPorTelefoneExtra: readonly string[] = []): T {
  const q = consulta as unknown as Filtravel<T>;
  const busca = interpretarBusca(bruto);
  // #85: a ficha cujo telefone EXTRA casa os dígitos também entra (ids já lidos
  // por `idsPorTelefoneExtra`, filtrados por organização).
  const peloExtra = idsPorTelefoneExtra.length > 0 ? `,id.in.(${idsPorTelefoneExtra.join(",")})` : "";
  if (busca?.tipo === "nascimento") return q.eq("birthdate", busca.data);
  if (busca?.tipo === "cpf_ou_telefone") return q.or(`cpf_hash.eq.${hashCpf(busca.digitos)},phone_number.ilike.%${busca.digitos}%${peloExtra}`);
  if (busca?.tipo === "telefone") {
    return peloExtra ? q.or(`phone_number.ilike.%${busca.digitos}%${peloExtra}`) : q.ilike("phone_number", `%${busca.digitos}%`);
  }
  if (busca?.tipo === "nome") return q.or(`display_name.ilike.%${busca.termo}%,name.ilike.%${busca.termo}%`);
  return consulta;
}

/**
 * #85 — as fichas cujo telefone EXTRA (`contact_phones`) contém os dígitos da
 * busca. Só roda quando a busca é de telefone (ou CPF/telefone); nome e
 * nascimento não consultam nada. Filtra a organização explicitamente.
 */
export async function idsPorTelefoneExtra(db: SupabaseClient, org: string, bruto: string): Promise<string[]> {
  const busca = interpretarBusca(bruto);
  if (busca?.tipo !== "telefone" && busca?.tipo !== "cpf_ou_telefone") return [];
  const { data, error } = await db
    .from("contact_phones")
    .select("contact_id")
    .eq("organization_id", org)
    .ilike("phone_number", `%${busca.digitos}%`)
    .limit(50);
  if (error) return [];
  return [...new Set((data ?? []).map((r: { contact_id: string }) => r.contact_id))];
}
