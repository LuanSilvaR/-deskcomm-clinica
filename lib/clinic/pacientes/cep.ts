/**
 * FORK clinic (#86) — o endereço a partir do CEP, para a ficha do paciente.
 *
 * A consulta roda no SERVIDOR (rota `/api/v1/clinic/cep/:cep`), nunca no
 * navegador: assim o serviço externo vê só o CEP, sem o IP de quem atende e
 * sem nada do paciente, e a CSP da aplicação não precisa abrir um host novo.
 *
 * Duas fontes públicas, na ordem: ViaCEP (traz o código IBGE do município, que
 * a nota fiscal usa) e, se ela falhar ou demorar, BrasilAPI. "CEP não existe"
 * da primeira é resposta, não falha: não pergunta à segunda.
 */
import { z } from "zod";

export type EnderecoDoCep = {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  codigo_ibge: string;
};

export type ResultadoDoCep =
  | { tipo: "encontrado"; endereco: EnderecoDoCep }
  | { tipo: "nao_encontrado" }
  | { tipo: "indisponivel" };

/** Só os dígitos; devolve null se não forem exatamente 8. */
export function normalizarCep(entrada: string | null | undefined): string | null {
  const digitos = (entrada ?? "").replace(/\D/g, "");
  return /^\d{8}$/.test(digitos) ? digitos : null;
}

const TEMPO_LIMITE_MS = 4000;

const viaCepSchema = z.object({
  erro: z.union([z.boolean(), z.string()]).optional(),
  logradouro: z.string().optional(),
  bairro: z.string().optional(),
  localidade: z.string().optional(),
  uf: z.string().optional(),
  ibge: z.string().optional(),
});

const brasilApiSchema = z.object({
  street: z.string().nullish(),
  neighborhood: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
});

type Busca = typeof fetch;

async function viaCep(cep: string, buscar: Busca): Promise<ResultadoDoCep> {
  const r = await buscar(`https://viacep.com.br/ws/${cep}/json/`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  if (!r.ok) return { tipo: "indisponivel" };
  const lido = viaCepSchema.safeParse(await r.json());
  if (!lido.success) return { tipo: "indisponivel" };
  const d = lido.data;
  if (d.erro === true || d.erro === "true") return { tipo: "nao_encontrado" };
  return {
    tipo: "encontrado",
    endereco: {
      cep,
      logradouro: d.logradouro ?? "",
      bairro: d.bairro ?? "",
      cidade: d.localidade ?? "",
      uf: (d.uf ?? "").toUpperCase(),
      codigo_ibge: /^\d{7}$/.test(d.ibge ?? "") ? d.ibge! : "",
    },
  };
}

async function brasilApi(cep: string, buscar: Busca): Promise<ResultadoDoCep> {
  const r = await buscar(`https://brasilapi.com.br/api/cep/v1/${cep}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  if (r.status === 404) return { tipo: "nao_encontrado" };
  if (!r.ok) return { tipo: "indisponivel" };
  const lido = brasilApiSchema.safeParse(await r.json());
  if (!lido.success) return { tipo: "indisponivel" };
  const d = lido.data;
  return {
    tipo: "encontrado",
    endereco: {
      cep,
      logradouro: d.street ?? "",
      bairro: d.neighborhood ?? "",
      cidade: d.city ?? "",
      uf: (d.state ?? "").toUpperCase(),
      codigo_ibge: "",
    },
  };
}

/** Consulta o CEP (já normalizado). Nunca lança: falha de rede vira `indisponivel`. */
export async function consultarCep(cep: string, buscar: Busca = fetch): Promise<ResultadoDoCep> {
  try {
    const primeira = await viaCep(cep, buscar);
    if (primeira.tipo !== "indisponivel") return primeira;
  } catch {
    // cai para a segunda fonte
  }
  try {
    return await brasilApi(cep, buscar);
  } catch {
    return { tipo: "indisponivel" };
  }
}
