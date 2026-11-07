/**
 * FORK clinic — a formatação dos dados da empresa no papel timbrado.
 *
 * Regra de ouro: CAMPO VAZIO NUNCA APARECE. Cada função devolve `null` quando
 * não há o que mostrar, e quem monta a linha descarta `null` — sem rótulo
 * órfão, sem separador sobrando, sem "[placeholder]".
 */
import { formatarCep, formatarTelefone } from "@/lib/clinic/organizacao/formato";

const limpo = (v: string | null | undefined): string | null => {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  return t.length > 0 ? t : null;
};

/** Dígitos verificadores do CNPJ (módulo 11). */
export function cnpjValido(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((s, n, i) => s + Number(n) * pesos[i]!, 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, ...p1];
  const d1 = dv(d.slice(0, 12), p1);
  const d2 = dv(d.slice(0, 12) + d1, p2);
  return d.endsWith(`${d1}${d2}`);
}

/** "00.000.000/0000-00" — só se os dígitos verificam; senão `null` (e quem chama avisa). */
export function formatarCnpj(cnpj: string | null | undefined): string | null {
  const d = (cnpj ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (!cnpjValido(d)) return null;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Site para EXIBIR (sem protocolo nem "www.") e o link completo. */
export function formatarSite(site: string | null | undefined): { exibir: string; url: string } | null {
  const s = limpo(site);
  if (!s) return null;
  const url = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  const exibir = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
  return exibir ? { exibir, url } : null;
}

export function telefone(numero: string | null | undefined): string | null {
  const d = (numero ?? "").replace(/\D/g, "");
  return d ? formatarTelefone(d) : null;
}

/**
 * As linhas de contato do cabeçalho: telefone e WhatsApp. Iguais viram UMA
 * linha com os dois rótulos; diferentes, duas linhas.
 */
export function linhasDeContato(fone: string | null | undefined, whatsapp: string | null | undefined): string[] {
  const f = telefone(fone);
  const w = telefone(whatsapp);
  if (f && w && f === w) return [`Telefone / WhatsApp ${f}`];
  return [f, w ? `WhatsApp ${w}` : null].filter((x): x is string => Boolean(x));
}

export interface Endereco {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}

/** "Logradouro, número, complemento, bairro" — só as partes que existem. */
export function linhaDoEndereco(e: Endereco): string | null {
  const rua = [limpo(e.logradouro), limpo(e.numero)].filter(Boolean).join(", ");
  const partes = [rua || null, limpo(e.complemento), limpo(e.bairro)].filter(Boolean);
  return partes.length ? partes.join(", ") : null;
}

/** "Cidade – UF". */
export function cidadeUf(e: Endereco): string | null {
  const partes = [limpo(e.cidade), limpo(e.uf)?.toUpperCase() ?? null].filter(Boolean);
  return partes.length ? partes.join(" – ") : null;
}

/** "Cidade – UF · CEP 00000-000". */
export function cidadeUfCep(e: Endereco): string | null {
  const cep = limpo(e.cep) ? formatarCep((e.cep ?? "").replace(/\D/g, "")) : null;
  const partes = [cidadeUf(e), cep ? `CEP ${cep}` : null].filter(Boolean);
  return partes.length ? partes.join(" · ") : null;
}

/** "Nome · Registro" do responsável técnico — sem nome, nada. */
export function linhaDoResponsavel(nome: string | null | undefined, registro: string | null | undefined): string | null {
  const n = limpo(nome);
  if (!n) return null;
  const r = limpo(registro);
  return `Responsável técnica(o): ${r ? `${n} · ${r}` : n}`;
}

export { limpo as textoLimpo };
