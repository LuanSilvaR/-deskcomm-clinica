/**
 * A FICHA CADASTRAL DO PACIENTE — quando ela está completa.
 *
 * Uma regra só, pura, usada pela rota (que devolve `faltando`), pela tela (que
 * mostra o selo e destaca os campos) e pelo bloqueio da chegada / do
 * "Compareceu". Três cópias da mesma lista divergiriam na primeira mudança.
 *
 * Obrigatórios (base para NFS-e e prontuário): nome completo, CPF, data de
 * nascimento, sexo, telefone, endereço (CEP, logradouro, número, bairro,
 * cidade, UF) e contato de emergência. Menor de 18 anos exige responsável
 * legal (nome, CPF e parentesco).
 *
 * `temCpf` e `temCpfDoResponsavel` são booleanos de propósito: a regra nunca
 * vê o CPF em claro — quem chama sabe se há CPF gravado (`cpf_hash`) ou se um
 * CPF válido está chegando no pedido.
 */

export interface DadosDaFicha {
  nome: string | null;
  temCpf: boolean;
  nascimento: string | null; // YYYY-MM-DD
  sexo: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  emergenciaNome: string | null;
  emergenciaParentesco: string | null;
  emergenciaTelefone: string | null;
  responsavelNome: string | null;
  temCpfDoResponsavel: boolean;
  responsavelParentesco: string | null;
}

export interface SituacaoDaFicha {
  completa: boolean;
  /** Rótulos em pt-BR do que falta, na ordem da ficha. */
  faltando: string[];
  menorDeIdade: boolean;
}

const preenchido = (v: string | null | undefined): boolean => typeof v === "string" && v.trim().length > 0;

/** Idade em anos completos na data `hoje` (YYYY-MM-DD), sem passar por fuso. */
export function idadeEm(nascimento: string, hoje: string): number {
  const [an, mn, dn] = nascimento.slice(0, 10).split("-").map(Number);
  const [ah, mh, dh] = hoje.slice(0, 10).split("-").map(Number);
  let idade = (ah ?? 0) - (an ?? 0);
  if ((mh ?? 0) < (mn ?? 0) || ((mh ?? 0) === (mn ?? 0) && (dh ?? 0) < (dn ?? 0))) idade -= 1;
  return idade;
}

export function situacaoDaFicha(d: DadosDaFicha, hoje: string): SituacaoDaFicha {
  const faltando: string[] = [];
  const exige = (ok: boolean, rotulo: string) => {
    if (!ok) faltando.push(rotulo);
  };

  exige(preenchido(d.nome) && d.nome!.trim().split(/\s+/).length >= 2, "Nome completo");
  exige(d.temCpf, "CPF");
  exige(preenchido(d.nascimento), "Data de nascimento");
  exige(preenchido(d.sexo), "Sexo");
  exige(preenchido(d.telefone), "Telefone");
  exige(preenchido(d.cep), "CEP");
  exige(preenchido(d.logradouro), "Logradouro");
  exige(preenchido(d.numero), "Número");
  exige(preenchido(d.bairro), "Bairro");
  exige(preenchido(d.cidade), "Cidade");
  exige(preenchido(d.uf), "UF");
  exige(preenchido(d.emergenciaNome), "Contato de emergência");
  exige(preenchido(d.emergenciaParentesco), "Parentesco do contato de emergência");
  exige(preenchido(d.emergenciaTelefone), "Telefone do contato de emergência");

  const menorDeIdade = preenchido(d.nascimento) && idadeEm(d.nascimento!, hoje) < 18;
  if (menorDeIdade) {
    exige(preenchido(d.responsavelNome), "Nome do responsável");
    exige(d.temCpfDoResponsavel, "CPF do responsável");
    exige(preenchido(d.responsavelParentesco), "Parentesco do responsável");
  }

  return { completa: faltando.length === 0, faltando, menorDeIdade };
}
