/**
 * A busca da recepção (`interpretarBusca`) traduzida em filtro do PostgREST
 * sobre `contacts` — nome, telefone, CPF (por hash exato, nunca em claro) ou
 * nascimento. Usada pela marcação (/api/v1/agenda/vinculos) e pela Agenda do
 * dia. Busca vazia devolve a consulta como veio.
 */
import { hashCpf } from "@/lib/contacts/cpf";

import { interpretarBusca } from "./busca";

interface Filtravel<T> {
  eq(coluna: string, valor: string): T;
  or(filtro: string): T;
  ilike(coluna: string, padrao: string): T;
}

// Genérico solto de propósito: amarrar T ao construtor do PostgREST estoura a
// profundidade de instanciação do TypeScript (TS2589).
export function filtrarContatosPelaBusca<T>(consulta: T, bruto: string): T {
  const q = consulta as unknown as Filtravel<T>;
  const busca = interpretarBusca(bruto);
  if (busca?.tipo === "nascimento") return q.eq("birthdate", busca.data);
  if (busca?.tipo === "cpf_ou_telefone") return q.or(`cpf_hash.eq.${hashCpf(busca.digitos)},phone_number.ilike.%${busca.digitos}%`);
  if (busca?.tipo === "telefone") return q.ilike("phone_number", `%${busca.digitos}%`);
  if (busca?.tipo === "nome") return q.or(`display_name.ilike.%${busca.termo}%,name.ilike.%${busca.termo}%`);
  return consulta;
}
