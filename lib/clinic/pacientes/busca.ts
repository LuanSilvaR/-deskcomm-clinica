/**
 * O que a recepção digitou para achar o paciente — nome, telefone, CPF ou
 * data de nascimento — num campo só (fork clinic, épico E1).
 *
 *   "10/05/1990" ou "10-05-1990"  → nascimento (data válida)
 *   11 dígitos que são CPF válido → CPF (por hash exato, nunca em claro) OU
 *                                   telefone — 11 dígitos também é celular com DDD
 *   4+ dígitos                    → telefone (trecho)
 *   o resto                       → nome
 *
 * Função pura: a rota traduz o resultado em filtro do PostgREST.
 */
import { isValidCpf } from "@/lib/legal/perfil-do-pais";

export type BuscaDePaciente =
  | { tipo: "nascimento"; data: string }
  | { tipo: "cpf_ou_telefone"; digitos: string }
  | { tipo: "telefone"; digitos: string }
  | { tipo: "nome"; termo: string };

export function interpretarBusca(bruto: string): BuscaDePaciente | null {
  const termo = bruto.trim();
  if (!termo) return null;

  const data = termo.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (data) {
    const [, d, m, a] = data;
    const iso = `${a}-${m}-${d}`;
    const valida = new Date(`${iso}T12:00:00Z`);
    if (!Number.isNaN(valida.getTime()) && valida.toISOString().slice(0, 10) === iso) {
      return { tipo: "nascimento", data: iso };
    }
  }

  const soDigitos = termo.replace(/[\s.()\-/+]/g, "");
  if (/^\d+$/.test(soDigitos)) {
    if (soDigitos.length === 11 && isValidCpf(soDigitos)) return { tipo: "cpf_ou_telefone", digitos: soDigitos };
    if (soDigitos.length >= 4) return { tipo: "telefone", digitos: soDigitos };
  }

  return { tipo: "nome", termo: termo.replace(/[%_\\]/g, "").replace(/[,()]/g, " ") };
}

/** "(…) •••••-1234 · 10/05/1990" — o bastante para distinguir homônimos. */
export function detalheDoPaciente(telefone: string | null, nascimento: string | null): string | null {
  const partes: string[] = [];
  const d = (telefone ?? "").replace(/\D/g, "");
  if (d.length >= 4) partes.push(`•••• ${d.slice(-4)}`);
  if (nascimento && /^\d{4}-\d{2}-\d{2}/.test(nascimento)) {
    const [a, m, dia] = nascimento.slice(0, 10).split("-");
    partes.push(`${dia}/${m}/${a}`);
  }
  return partes.length ? partes.join(" · ") : null;
}
