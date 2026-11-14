/**
 * Gerador de pacientes FICTÍCIOS com cara de gente de verdade, para a
 * simulação da clínica de demonstração.
 *
 * Nenhum dado aqui é de pessoa real: o nome é a combinação sorteada de nomes e
 * sobrenomes comuns no Brasil; o telefone fica na faixa reservada de teste
 * (+55 11 90000-xxxx), que nenhum envio automático alcança; o e-mail usa o
 * domínio reservado `.test`; CPF não é gerado.
 *
 * O sorteio é determinístico (semente fixa): rodar de novo produz as mesmas
 * pessoas, e um defeito encontrado na tela pode ser reproduzido.
 */

/** PRNG mulberry32 — pequeno, determinístico e suficiente para dado de teste. */
export function sorteador(semente: number) {
  let s = semente >>> 0;
  const proximo = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    numero: proximo,
    inteiro: (min: number, max: number) => min + Math.floor(proximo() * (max - min + 1)),
    um: <T>(lista: readonly T[]): T => lista[Math.floor(proximo() * lista.length)]!,
    chance: (p: number) => proximo() < p,
  };
}
export type Sorteador = ReturnType<typeof sorteador>;

const NOMES_F = [
  "Ana", "Beatriz", "Camila", "Daniela", "Eduarda", "Fernanda", "Gabriela", "Helena", "Isabela", "Juliana",
  "Larissa", "Mariana", "Natália", "Patrícia", "Renata", "Sabrina", "Tatiane", "Vanessa", "Aline", "Bianca",
  "Carolina", "Débora", "Elaine", "Flávia", "Giovana", "Ingrid", "Jéssica", "Karina", "Letícia", "Luana",
  "Marcela", "Priscila", "Raquel", "Simone", "Thaís", "Vitória", "Adriana", "Bruna", "Cristiane", "Denise",
  "Fabiana", "Gisele", "Heloísa", "Jaqueline", "Lívia", "Manuela", "Nathália", "Paula", "Rafaela", "Sônia",
  "Valéria", "Yasmin", "Alessandra", "Cíntia", "Luciana", "Mônica", "Roberta", "Sandra", "Tânia", "Viviane",
] as const;
const NOMES_M = [
  "André", "Bruno", "Carlos", "Diego", "Eduardo", "Felipe", "Gustavo", "Henrique", "Igor", "João",
  "Leonardo", "Marcelo", "Pedro", "Rafael", "Rodrigo", "Thiago", "Vinícius", "Lucas", "Matheus", "Ricardo",
  "Fábio", "Gabriel", "Paulo", "Renato", "Sérgio",
] as const;
const SEGUNDOS_F = ["Cristina", "Luiza", "Paula", "Carolina", "Fernanda", "Beatriz", "Helena", "Clara", "Vitória", "Eduarda"] as const;
const SEGUNDOS_M = ["Henrique", "Augusto", "Eduardo", "Felipe", "Gabriel", "Luís", "Antônio", "Vinícius"] as const;
const SOBRENOMES = [
  "Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes",
  "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes", "Soares", "Fernandes", "Vieira", "Barbosa",
  "Rocha", "Dias", "Nascimento", "Andrade", "Moreira", "Nunes", "Marques", "Machado", "Mendes", "Freitas",
  "Cardoso", "Ramos", "Gonçalves", "Santana", "Teixeira", "Araújo", "Correia", "Pinto", "Moura", "Cavalcanti",
  "Campos", "Monteiro", "Batista", "Duarte", "Farias", "Castro", "Rezende", "Pires", "Siqueira", "Prado",
  "Toledo", "Queiroz", "Brandão", "Figueiredo", "Bittencourt", "Nogueira", "Sampaio", "Vasconcelos", "Leite", "Xavier",
] as const;

const PROFISSOES = [
  "Advogada", "Arquiteta", "Analista de sistemas", "Professora", "Enfermeira", "Empresária", "Administradora",
  "Contadora", "Designer", "Jornalista", "Engenheira civil", "Psicóloga", "Fisioterapeuta", "Nutricionista",
  "Gerente comercial", "Servidora pública", "Publicitária", "Farmacêutica", "Corretora de imóveis", "Estudante",
  "Dentista", "Médica veterinária", "Bancária", "Consultora de vendas", "Aposentada",
] as const;
const PROFISSOES_M = [
  "Advogado", "Engenheiro", "Empresário", "Analista financeiro", "Médico", "Professor", "Administrador",
  "Gerente de projetos", "Corretor de imóveis", "Servidor público",
] as const;

/** Bairros de São Paulo com um CEP de logradouro do próprio bairro (endereço público, não pessoal). */
const BAIRROS = [
  { bairro: "Moema", cep: "04077020", rua: "Avenida Ibirapuera" },
  { bairro: "Vila Mariana", cep: "04101300", rua: "Rua Domingos de Morais" },
  { bairro: "Pinheiros", cep: "05422010", rua: "Rua dos Pinheiros" },
  { bairro: "Itaim Bibi", cep: "04530001", rua: "Rua Joaquim Floriano" },
  { bairro: "Perdizes", cep: "05015000", rua: "Rua Cardoso de Almeida" },
  { bairro: "Tatuapé", cep: "03307000", rua: "Rua Tuiuti" },
  { bairro: "Santana", cep: "02012000", rua: "Rua Voluntários da Pátria" },
  { bairro: "Brooklin", cep: "04571010", rua: "Rua Joaquim Nabuco" },
  { bairro: "Vila Olímpia", cep: "04547004", rua: "Rua Funchal" },
  { bairro: "Saúde", cep: "04143010", rua: "Avenida Jabaquara" },
  { bairro: "Jardim Paulista", cep: "01419001", rua: "Alameda Santos" },
  { bairro: "Mooca", cep: "03104000", rua: "Rua da Mooca" },
] as const;

const ORIGENS = ["Instagram", "Indicação de amiga", "Google", "Indicação de paciente", "Passou na frente", "Facebook", "TikTok"] as const;
const PARENTESCOS = ["Mãe", "Marido", "Esposa", "Irmã", "Filha", "Pai", "Companheiro"] as const;

export interface PacienteFicticio {
  nome: string;
  sexo: "feminino" | "masculino";
  telefone: string;
  email: string | null;
  nascimento: string;
  profissao: string;
  estadoCivil: "solteiro" | "casado" | "uniao_estavel" | "divorciado";
  origem: string;
  endereco: (typeof BAIRROS)[number] & { numero: string };
  emergencia: { nome: string; parentesco: string; telefone: string };
}

/** e-mails já usados nesta execução (pacientes e contatos em prospecção não podem repetir) */
const emailsUsados = new Set<string>();
function emailUnico(local: string, r: Sorteador): string {
  let email = `${local}${r.chance(0.4) ? r.inteiro(1, 99) : ""}@email.test`;
  while (emailsUsados.has(email)) email = `${local}${r.inteiro(100, 999)}@email.test`;
  emailsUsados.add(email);
  return email;
}

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * `quantos` pacientes com nomes únicos. `faixaTelefone` separa os blocos de
 * telefone (pacientes x leads) para não colidirem.
 */
export function gerarPacientes(r: Sorteador, quantos: number, faixaTelefone: number): PacienteFicticio[] {
  const vistos = new Set<string>();
  const lista: PacienteFicticio[] = [];
  while (lista.length < quantos) {
    const mulher = r.chance(0.82);
    const primeiro = mulher ? r.um(NOMES_F) : r.um(NOMES_M);
    const segundo = r.chance(0.3) ? ` ${mulher ? r.um(SEGUNDOS_F) : r.um(SEGUNDOS_M)}` : "";
    let sob1 = r.um(SOBRENOMES);
    let sob2 = r.um(SOBRENOMES);
    while (sob2 === sob1) sob2 = r.um(SOBRENOMES);
    const nome = r.chance(0.65) ? `${primeiro}${segundo} ${sob1} ${sob2}` : `${primeiro}${segundo} ${sob2}`;
    if (vistos.has(nome) || segundo.trim() === primeiro) continue;
    vistos.add(nome);
    if (r.chance(0.5)) [sob1, sob2] = [sob2, sob1];

    const n = faixaTelefone + lista.length + 1;
    const idade = r.chance(0.75) ? r.inteiro(24, 52) : r.inteiro(18, 70);
    const ano = 2026 - idade;
    const mes = String(r.inteiro(1, 12)).padStart(2, "0");
    const dia = String(r.inteiro(1, 28)).padStart(2, "0");
    const local = semAcento(`${primeiro}.${nome.split(" ").at(-1)}`).replace(/[^a-z.]/g, "");
    const bairro = r.um(BAIRROS);
    const emergNome = `${r.chance(0.6) ? r.um(NOMES_F) : r.um(NOMES_M)} ${r.um(SOBRENOMES)}`;

    lista.push({
      nome,
      sexo: mulher ? "feminino" : "masculino",
      telefone: `+5511900${String(n).padStart(6, "0")}`,
      email: r.chance(0.85) ? emailUnico(local, r) : null,
      nascimento: `${ano}-${mes}-${dia}`,
      profissao: mulher ? r.um(PROFISSOES) : r.um(PROFISSOES_M),
      estadoCivil: r.um(["solteiro", "casado", "casado", "uniao_estavel", "divorciado"] as const),
      origem: r.um(ORIGENS),
      endereco: { ...bairro, numero: String(r.inteiro(10, 2400)) },
      emergencia: {
        nome: emergNome,
        parentesco: r.um(PARENTESCOS),
        telefone: `+5511900${String(500000 + n).padStart(6, "0")}`,
      },
    });
  }
  return lista;
}
