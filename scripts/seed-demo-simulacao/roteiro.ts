/**
 * Roteiro da SIMULAÇÃO da clínica de demonstração: 30 dias de uso passado e a
 * agenda dos próximos 30 dias, com pacientes fictícios de nome realista.
 *
 * Mesma regra do `seed-demo-clinica/roteiro.ts`: o que tem regra de negócio
 * (atendimento, prontuário, documento, estoque, comanda) passa pelas MESMAS
 * funções da tela, com a permissão de quem faria aquilo na clínica. Se a regra
 * recusar, a simulação falha — ela também serve de teste de ponta a ponta.
 *
 * Passado: as funções carimbam `now()`. Cada passo leva um `alvo` (o instante
 * simulado) e, ao final, o executor desloca os carimbos gerados naquele passo
 * para o alvo (ver `RECARIMBAR_SQL`). Assim a chegada, o início, o fim do
 * atendimento e a comanda ficam no dia e na hora em que "aconteceram".
 */

import { ORG_DEMO, PESSOAS_DEMO, type IdsDasPessoas } from "../seed-demo-clinica/roteiro";
import { gerarPacientes, sorteador, type PacienteFicticio, type Sorteador } from "./pessoas";

export interface PassoDaSimulacao {
  titulo: string;
  /** "superuser" | "service_role" | uuid do usuário */
  ator: string;
  sql: string;
  /** instante simulado em que o passo "aconteceu" (só para o passado) */
  alvo?: Date;
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const j = (o: unknown) => `${q(JSON.stringify(o))}::jsonb`;
const ts = (d: Date) => `${q(d.toISOString())}::timestamptz`;
const id = (grupo: number, n: number) =>
  `de000000-${String(grupo).padStart(4, "0")}-4000-8000-${String(n).padStart(12, "0")}`;
const O = q(ORG_DEMO);
const MIN = 60_000;

// ---------------------------------------------------------------------------
// Cadastro da clínica
// ---------------------------------------------------------------------------

/** Nomes realistas da equipe (os e-mails e senhas de teste não mudam). */
export const NOMES_EQUIPE: Record<string, string> = {
  dono: "Rafael Albuquerque",
  ana: "Dra. Ana Carolina Mendes",
  bruno: "Dr. Bruno Vasconcelos",
  carla: "Carla Fernandes Rocha",
  diego: "Diego Martins Souza",
  recepcao: "Beatriz Nogueira",
  compras: "Marcos Teixeira",
};

const ESP = { derma: id(10, 1), hof: id(10, 2), facial: id(10, 3), enf: id(10, 4) };
const SALA = {
  ana: id(11, 1),
  bruno: id(11, 2),
  carla: id(11, 3),
  diego: id(11, 4),
  dermapen: id(11, 5),
  autoclave: id(11, 6),
};

type ChaveServico =
  | "avaliacao"
  | "retorno"
  | "toxina"
  | "labial"
  | "mandibula"
  | "bioestimulador"
  | "peeling"
  | "limpeza"
  | "microagulhamento";

interface Servico {
  tipo: string;
  proc: string | null;
  nome: string;
  categoria: "consulta" | "retorno" | "procedimento";
  minutos: number;
  precoCents: number;
  descricaoProc?: string;
}

const SERVICOS: Record<ChaveServico, Servico> = {
  avaliacao: { tipo: id(12, 1), proc: null, nome: "Consulta de avaliação", categoria: "consulta", minutos: 30, precoCents: 25000 },
  retorno: { tipo: id(12, 2), proc: null, nome: "Retorno", categoria: "retorno", minutos: 20, precoCents: 0 },
  toxina: {
    tipo: id(12, 3), proc: id(13, 1), nome: "Toxina botulínica", categoria: "procedimento", minutos: 45, precoCents: 120000,
    descricaoProc: "Aplicação de toxina botulínica tipo A para rugas de expressão e bruxismo.",
  },
  labial: {
    tipo: id(12, 4), proc: id(13, 2), nome: "Preenchimento labial", categoria: "procedimento", minutos: 60, precoCents: 180000,
    descricaoProc: "Preenchimento e contorno labial com ácido hialurônico.",
  },
  mandibula: {
    tipo: id(12, 5), proc: id(13, 3), nome: "Preenchimento de mandíbula", categoria: "procedimento", minutos: 60, precoCents: 220000,
    descricaoProc: "Contorno de mandíbula e mento com ácido hialurônico.",
  },
  bioestimulador: {
    tipo: id(12, 6), proc: id(13, 4), nome: "Bioestimulador de colágeno", categoria: "procedimento", minutos: 60, precoCents: 250000,
    descricaoProc: "Aplicação de bioestimulador para flacidez e qualidade da pele.",
  },
  peeling: {
    tipo: id(12, 7), proc: id(13, 5), nome: "Peeling químico", categoria: "procedimento", minutos: 45, precoCents: 45000,
    descricaoProc: "Peeling químico superficial para manchas, textura e acne.",
  },
  limpeza: {
    tipo: id(12, 8), proc: id(13, 6), nome: "Limpeza de pele profunda", categoria: "procedimento", minutos: 60, precoCents: 28000,
    descricaoProc: "Higienização, esfoliação, extração e máscara calmante.",
  },
  microagulhamento: {
    tipo: id(12, 9), proc: id(13, 7), nome: "Microagulhamento", categoria: "procedimento", minutos: 60, precoCents: 65000,
    descricaoProc: "Indução percutânea de colágeno com drug delivery.",
  },
};

const PROD = {
  toxina: id(14, 1),
  acido: id(14, 2),
  bio: id(14, 3),
  peeling: id(14, 4),
  anestesico: id(14, 5),
  agulha: id(14, 6),
  canula: id(14, 7),
  luva: id(14, 8),
  gaze: id(14, 9),
  mascara: id(14, 10),
  ponteira: id(14, 11),
  clorex: id(14, 12),
};

/** Lotes principais (os insumos rastreados citam lote e validade). */
const LOTE = {
  toxina: { codigo: "TX-25B07", validade: "2027-08-31" },
  toxina2: { codigo: "TX-25C11", validade: "2027-11-30" },
  acido: { codigo: "AH-24117", validade: "2027-10-31" },
  bio: { codigo: "BIO-3308", validade: "2027-05-31" },
  anestesico: { codigo: "AN-8812", validade: "2027-03-31" },
};

interface Profissional {
  chave: "ana" | "bruno" | "carla" | "diego";
  sala: string;
  esp: string;
  /** dias da semana em que atende (0 = domingo) */
  dias: number[];
  /** mix de serviços com peso */
  mix: [ChaveServico, number][];
  comissao: number;
}

const PROFISSIONAIS: Profissional[] = [
  {
    chave: "ana", sala: SALA.ana, esp: ESP.derma, dias: [1, 2, 3, 4, 5], comissao: 50,
    mix: [["avaliacao", 22], ["toxina", 30], ["bioestimulador", 14], ["peeling", 8], ["labial", 10], ["retorno", 16]],
  },
  {
    chave: "bruno", sala: SALA.bruno, esp: ESP.hof, dias: [2, 4, 6], comissao: 40,
    mix: [["avaliacao", 18], ["toxina", 30], ["labial", 26], ["mandibula", 14], ["retorno", 12]],
  },
  {
    chave: "carla", sala: SALA.carla, esp: ESP.facial, dias: [1, 2, 3, 4, 5, 6], comissao: 35,
    mix: [["limpeza", 40], ["microagulhamento", 26], ["peeling", 20], ["retorno", 14]],
  },
  {
    chave: "diego", sala: SALA.diego, esp: ESP.enf, dias: [1, 3, 5], comissao: 30,
    mix: [["limpeza", 48], ["microagulhamento", 30], ["peeling", 12], ["retorno", 10]],
  },
];

// ---------------------------------------------------------------------------
// Relógio: "hoje" no fuso da clínica (São Paulo, UTC-3 sem horário de verão)
// ---------------------------------------------------------------------------

const FUSO_H = 3;
function diaLocal(base: Date, deslocDias: number) {
  const local = new Date(base.getTime() - FUSO_H * 60 * MIN);
  const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + deslocDias));
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth(), dia: d.getUTCDate(), semana: d.getUTCDay() };
}
const instante = (d: { ano: number; mes: number; dia: number }, minutoDoDia: number) =>
  new Date(Date.UTC(d.ano, d.mes, d.dia, FUSO_H, 0) + minutoDoDia * MIN);
const dataISO = (d: Date) => new Date(d.getTime() - FUSO_H * 60 * MIN).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Textos clínicos (variações para o prontuário não ficar repetido)
// ---------------------------------------------------------------------------

const REGIOES: Partial<Record<ChaveServico, string[]>> = {
  toxina: ["Testa e glabela", "Região periorbital (pés de galinha)", "Terço superior completo", "Masseter (bruxismo)", "Glabela"],
  labial: ["Lábios — contorno e volume", "Lábios — hidratação e projeção sutil"],
  mandibula: ["Ângulo de mandíbula bilateral", "Mento e linha mandibular"],
  bioestimulador: ["Face — terço médio e inferior", "Face e pescoço", "Região submentual"],
  peeling: ["Face completa", "Face e colo"],
  limpeza: ["Face completa", "Face e costas"],
  microagulhamento: ["Face completa — cicatrizes de acne", "Face — poros e textura", "Face — melasma (drug delivery)"],
};
const EVOLUCOES: Record<ChaveServico, string[]> = {
  avaliacao: [
    "Avaliação facial completa. Discutidas expectativas e opções de tratamento; orçamento entregue.",
    "Paciente com queixa de flacidez leve e linhas de expressão. Proposto plano combinado.",
    "Avaliação de manchas e textura. Indicado protocolo de peeling e fotoproteção rigorosa.",
    "Primeira consulta. Pele com fotoenvelhecimento leve; sugerido bioestimulador e toxina.",
  ],
  retorno: [
    "Retorno de 15 dias: resultado simétrico, paciente satisfeita.",
    "Retorno: sem intercorrências; orientado manter cuidados domiciliares.",
    "Retorno: pequena assimetria corrigida com retoque discreto.",
    "Retorno pós-procedimento: boa evolução, sem edema residual.",
  ],
  toxina: [
    "Aplicação sem intercorrências. Pontos marcados conforme dinâmica muscular.",
    "Aplicação bem tolerada; leve eritema nos pontos, resolvido ao fim da sessão.",
    "Procedimento realizado conforme planejamento; paciente orientada sobre o tempo de efeito.",
  ],
  labial: [
    "Boa resposta imediata; edema leve esperado nas primeiras 48 h.",
    "Contorno definido com técnica retrógrada; paciente satisfeita com o resultado.",
  ],
  mandibula: [
    "Aplicação com cânula, bem tolerada. Contorno mandibular mais definido.",
    "Procedimento sem intercorrências; leve edema esperado.",
  ],
  bioestimulador: [
    "Aplicação em leque com cânula; massagem orientada por 5 dias (regra 5x5x5).",
    "Sessão realizada conforme protocolo; próxima sessão em 30 dias.",
  ],
  peeling: [
    "Peeling aplicado em duas camadas; frost leve e uniforme.",
    "Boa tolerância; ardência leve controlada com ventilação.",
  ],
  limpeza: [
    "Pele higienizada; extração de comedões em zona T. Leve eritema ao final.",
    "Limpeza realizada com esfoliação enzimática e máscara calmante.",
  ],
  microagulhamento: [
    "Microagulhamento com 1,5 mm; sangramento puntiforme esperado. Drug delivery com fatores de crescimento.",
    "Sessão sem intercorrências; eritema compatível com o procedimento.",
  ],
};
const ORIENTACOES: Partial<Record<ChaveServico, string>> = {
  toxina: "Não deitar por 4 h, evitar atividade física e massagem na região por 24 h.",
  labial: "Compressa fria nas primeiras horas; evitar calor intenso e beijo por 24 h.",
  mandibula: "Evitar pressão na região e calor intenso por 48 h.",
  bioestimulador: "Massagear 5 minutos, 5 vezes ao dia, por 5 dias.",
  peeling: "Não remover a descamação; fotoprotetor a cada 3 h; hidratação intensa.",
  limpeza: "Evitar maquiagem por 12 h e exposição solar direta.",
  microagulhamento: "Não lavar o rosto por 6 h; fotoproteção rigorosa por 7 dias.",
};
const QUEIXAS = [
  "Linhas de expressão na testa e entre as sobrancelhas",
  "Manchas no rosto que pioraram depois do verão",
  "Flacidez e perda de contorno do rosto",
  "Lábios finos e ressecados",
  "Poros dilatados e oleosidade",
  "Cicatrizes de acne na bochecha",
  "Pele sem viço e cansada",
  "Bruxismo e rosto quadrado",
];
const ALERGIAS = ["Dipirona", "Lidocaína (relata reação local)", "Látex", "Penicilina", "Iodo"];
const MOTIVOS_CANCELAMENTO = [
  "Paciente pediu para remarcar (compromisso de trabalho)",
  "Paciente doente (gripe)",
  "Imprevisto familiar",
  "Viagem",
  "Paciente desistiu do procedimento",
];

// ---------------------------------------------------------------------------
// Insumos por serviço (quantidade na unidade de aplicação)
// ---------------------------------------------------------------------------

function insumosDo(servico: ChaveServico, r: Sorteador) {
  const luva = { descricao: "Luva nitrílica", quantidade: 2, unidade: "un", product_id: PROD.luva };
  const gaze = (n: number) => ({ descricao: "Gaze estéril", quantidade: n, unidade: "un", product_id: PROD.gaze });
  const clorex = { descricao: "Clorexidina alcoólica 0,5%", quantidade: 10, unidade: "mL", product_id: PROD.clorex };
  const agulha = (n: number) => ({ descricao: "Agulha 30G", quantidade: n, unidade: "un", product_id: PROD.agulha });
  const anest = (g: number) => ({
    descricao: "Anestésico tópico lidocaína 4%", quantidade: g, unidade: "g", product_id: PROD.anestesico,
    lote: LOTE.anestesico.codigo, validade: LOTE.anestesico.validade,
  });
  switch (servico) {
    case "toxina": {
      const lote = r.chance(0.7) ? LOTE.toxina : LOTE.toxina2;
      return [
        { descricao: "Toxina botulínica tipo A", quantidade: r.um([20, 24, 30, 40, 50]), unidade: "U", product_id: PROD.toxina, lote: lote.codigo, validade: lote.validade },
        agulha(2), luva, gaze(2), clorex,
      ];
    }
    case "labial":
      return [
        { descricao: "Ácido hialurônico 1 mL", quantidade: 1, unidade: "un", product_id: PROD.acido, lote: LOTE.acido.codigo, validade: LOTE.acido.validade },
        anest(2), agulha(1), luva, gaze(2),
      ];
    case "mandibula":
      return [
        { descricao: "Ácido hialurônico 1 mL", quantidade: r.um([2, 2, 3]), unidade: "un", product_id: PROD.acido, lote: LOTE.acido.codigo, validade: LOTE.acido.validade },
        { descricao: "Cânula 22G", quantidade: 1, unidade: "un", product_id: PROD.canula },
        anest(2), luva, gaze(2), clorex,
      ];
    case "bioestimulador":
      return [
        { descricao: "Bioestimulador de colágeno", quantidade: 1, unidade: "un", product_id: PROD.bio, lote: LOTE.bio.codigo, validade: LOTE.bio.validade },
        { descricao: "Cânula 22G", quantidade: 1, unidade: "un", product_id: PROD.canula },
        anest(3), luva, gaze(3), clorex,
      ];
    case "peeling":
      return [
        { descricao: "Ácido tricloroacético 20%", quantidade: 2, unidade: "mL", product_id: PROD.peeling },
        luva, gaze(4),
      ];
    case "limpeza":
      return [
        luva, gaze(6),
        { descricao: "Máscara facial calmante", quantidade: 1, unidade: "un", product_id: PROD.mascara },
      ];
    case "microagulhamento":
      return [
        { descricao: "Ponteira de microagulhamento", quantidade: 1, unidade: "un", product_id: PROD.ponteira },
        anest(3), luva, gaze(4), clorex,
      ];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Geração da agenda
// ---------------------------------------------------------------------------

interface Agendamento {
  id: string;
  prof: Profissional;
  servico: ChaveServico;
  paciente: number;
  inicio: Date;
  fim: Date;
  destino: "realizado" | "falta" | "cancelado" | "em_atendimento" | "na_recepcao" | "confirmado" | "pendente";
  semComanda?: boolean;
}

export interface Simulacao {
  passos: PassoDaSimulacao[];
  resumo: Record<string, number>;
}

export function montarSimulacao(p: IdsDasPessoas, agora: Date): Simulacao {
  const r = sorteador(20261006);
  const pacientes = gerarPacientes(r, 180, 0);
  const prospects = gerarPacientes(sorteador(777), 30, 300000);
  const PAC = pacientes.map((_, i) => id(15, i + 1));
  const PROSP = prospects.map((_, i) => id(17, i + 1));
  const user = (k: string) => p[k]!;

  // pacientes "fiéis" voltam mais: pesos decrescentes
  const pesoPaciente = pacientes.map((_, i) => (i < 40 ? 4 : i < 110 ? 2 : 1));
  const somaPesos = pesoPaciente.reduce((a, b) => a + b, 0);
  const sortearPaciente = () => {
    let x = r.numero() * somaPesos;
    for (let i = 0; i < pesoPaciente.length; i++) {
      x -= pesoPaciente[i]!;
      if (x <= 0) return i;
    }
    return pesoPaciente.length - 1;
  };
  const sortearServico = (mix: [ChaveServico, number][]) => {
    const total = mix.reduce((a, [, w]) => a + w, 0);
    let x = r.numero() * total;
    for (const [s, w] of mix) {
      x -= w;
      if (x <= 0) return s;
    }
    return mix[0]![0];
  };

  // Dra. Ana em congresso num dia útil daqui a ~18 dias (bloqueio na agenda)
  let diaDoCongresso = 18;
  while (![1, 2, 3, 4, 5].includes(diaLocal(agora, diaDoCongresso).semana)) diaDoCongresso++;
  const congresso = diaLocal(agora, diaDoCongresso);

  const agenda: Agendamento[] = [];
  const ocupadoPaciente = new Set<string>();
  let nAg = 0;
  for (let d = -30; d <= 30; d++) {
    const dia = diaLocal(agora, d);
    if (dia.semana === 0) continue;
    for (const prof of PROFISSIONAIS) {
      if (!prof.dias.includes(dia.semana)) continue;
      if (prof.chave === "ana" && d === diaDoCongresso) continue;
      const sabado = dia.semana === 6;
      const abre = sabado ? 8 * 60 : prof.chave === "bruno" ? 10 * 60 : 9 * 60;
      const fecha = sabado ? 13 * 60 : prof.chave === "diego" ? 17 * 60 : 19 * 60;
      // passado ~ cheio; futuro vai esvaziando conforme se afasta de hoje
      const ocupacao = d <= 0 ? 0.62 : d <= 3 ? 0.58 : d <= 10 ? 0.45 : d <= 20 ? 0.32 : 0.2;
      let t = abre;
      while (t < fecha) {
        if (t >= 12 * 60 && t < 13 * 60) {
          t = 13 * 60;
          continue;
        }
        if (!r.chance(ocupacao)) {
          t += 30;
          continue;
        }
        const servico = sortearServico(prof.mix);
        const dur = SERVICOS[servico].minutos;
        if (t + dur > fecha) break;
        let pac = sortearPaciente();
        const chaveDia = `${dia.ano}-${dia.mes}-${dia.dia}`;
        for (let tent = 0; tent < 5 && ocupadoPaciente.has(`${pac}|${chaveDia}`); tent++) pac = sortearPaciente();
        if (ocupadoPaciente.has(`${pac}|${chaveDia}`)) {
          t += dur;
          continue;
        }
        ocupadoPaciente.add(`${pac}|${chaveDia}`);
        const inicio = instante(dia, t);
        const fim = new Date(inicio.getTime() + dur * MIN);
        let destino: Agendamento["destino"];
        if (fim.getTime() <= agora.getTime()) {
          const x = r.numero();
          destino = x < 0.84 ? "realizado" : x < 0.91 ? "falta" : "cancelado";
        } else if (inicio.getTime() <= agora.getTime()) {
          destino = "em_atendimento";
        } else if (inicio.getTime() - agora.getTime() <= 50 * MIN) {
          destino = "na_recepcao";
        } else {
          const x = r.numero();
          destino = x < 0.05 ? "cancelado" : d <= 2 ? (x < 0.75 ? "confirmado" : "pendente") : x < 0.3 ? "confirmado" : "pendente";
        }
        agenda.push({ id: id(16, ++nAg), prof, servico, paciente: pac, inicio, fim, destino });
        t += dur + (r.chance(0.3) ? 15 : 0);
      }
    }
  }
  // os 3 últimos realizados ficam sem comanda: aparecem em "pendentes de faturamento"
  agenda
    .filter((a) => a.destino === "realizado" && SERVICOS[a.servico].precoCents > 0)
    .slice(-3)
    .forEach((a) => (a.semComanda = true));

  const passos: PassoDaSimulacao[] = [];
  const primeiraData = agenda[0]!.inicio;
  const inicioDaClinica = new Date(primeiraData.getTime() - 40 * 24 * 60 * MIN);

  // -------------------------------------------------------------------------
  // 1. Empresa, equipe, salas, serviços, produtos, pacientes
  // -------------------------------------------------------------------------
  const profsDaClinica = PESSOAS_DEMO.filter((x) => x.conselho);
  const espDe: Record<string, string> = { ana: ESP.derma, bruno: ESP.hof, carla: ESP.facial, diego: ESP.enf };

  const criadoEmPaciente = (i: number) => {
    // pacientes antigos (fiéis) entraram há meses; os demais, perto da 1ª consulta
    const primeira = agenda.find((a) => a.paciente === i)?.inicio ?? agora;
    const diasAntes = i < 40 ? r.inteiro(120, 700) : r.inteiro(2, 60);
    return new Date(primeira.getTime() - diasAntes * 24 * 60 * MIN);
  };

  passos.push({
    titulo: "empresa, equipe, salas, serviços e pacientes",
    ator: "superuser",
    sql: `
      insert into public.organizations (id, slug, legal_name, display_name, timezone, locale, onboarded_at, settings, created_at)
      values (${O}, 'clinica-demo', 'Clínica Mendes Estética Avançada LTDA', 'Clínica Mendes Estética',
              'America/Sao_Paulo', 'pt-BR', ${ts(inicioDaClinica)},
              ${j({ llm: { provider: "anthropic", default_model: "claude-sonnet-5" }, clinic: { prontuario: true, recursos: true, menu_clinica: true, procedimentos: true, profissionais: true, trava_sobreposicao: true, financeiro_avancado: true } })},
              ${ts(inicioDaClinica)});

      insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ${PESSOAS_DEMO.map((x) => `(${q(user(x.chave))}, ${O}, ${q(x.papel)}, ${ts(inicioDaClinica)})`).join(",\n      ")}
      on conflict do nothing;

      update auth.users u
         set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', n.nome, 'name', n.nome)
        from (values ${Object.entries(NOMES_EQUIPE).map(([k, n]) => `(${q(user(k))}::uuid, ${q(n)})`).join(", ")}) as n(uid, nome)
       where u.id = n.uid;

      insert into public.clinic_specialties (id, organization_id, name) values
        (${q(ESP.derma)}, ${O}, 'Dermatologia estética'), (${q(ESP.hof)}, ${O}, 'Harmonização orofacial'),
        (${q(ESP.facial)}, ${O}, 'Estética facial'), (${q(ESP.enf)}, ${O}, 'Enfermagem estética');

      insert into public.clinic_professionals (organization_id, user_id, display_name, council, council_number, council_uf) values
      ${profsDaClinica
        .map((x) => {
          const num = { ana: "148392", bruno: "102847", carla: "37105", diego: "512384" }[x.chave]!;
          return `(${O}, ${q(user(x.chave))}, ${q(NOMES_EQUIPE[x.chave]!)}, ${q(x.conselho!.sigla)}, ${q(num)}, 'SP')`;
        })
        .join(",\n      ")};

      insert into public.clinic_professional_specialties (organization_id, professional_id, specialty_id)
      select cp.organization_id, cp.id, e.esp::uuid
        from public.clinic_professionals cp
        join (values ${Object.entries(espDe).map(([k, e]) => `(${q(user(k))}, ${q(e)})`).join(", ")}) as e(u, esp)
          on cp.user_id = e.u::uuid
       where cp.organization_id = ${O};

      insert into public.clinic_resources (id, organization_id, name, category) values
        (${q(SALA.ana)}, ${O}, 'Consultório 1 — Dermatologia', 'Sala'),
        (${q(SALA.bruno)}, ${O}, 'Consultório 2 — Harmonização', 'Sala'),
        (${q(SALA.carla)}, ${O}, 'Sala de estética 1', 'Sala'),
        (${q(SALA.diego)}, ${O}, 'Sala de estética 2', 'Sala'),
        (${q(SALA.dermapen)}, ${O}, 'Dermapen 4', 'Equipamento'),
        (${q(SALA.autoclave)}, ${O}, 'Autoclave Cristófoli 21 L', 'Equipamento');

      insert into public.calendar_event_types (id, organization_id, name, slug, category, duration_minutes, default_price_cents, location_kind) values
      ${Object.entries(SERVICOS)
        .map(([k, s]) => `(${q(s.tipo)}, ${O}, ${q(s.nome)}, ${q(`clinica-${k}`)}, ${q(s.categoria)}, ${s.minutos}, ${s.precoCents}, 'in_person')`)
        .join(",\n      ")};

      -- os tipos genéricos que toda empresa nova ganha (sem responsável) não servem à clínica
      update public.calendar_event_types set is_active = false
       where organization_id = ${O} and slug in ('consulta', 'reuniao', 'atendimento');

      -- Quem faz o quê: cada tipo exige as especialidades de quem o oferece no
      -- mix (retorno fica livre). É o que limita os tipos na agenda de cada um.
      insert into public.clinic_event_type_specialties (organization_id, event_type_id, specialty_id) values
      ${(Object.keys(SERVICOS) as ChaveServico[])
        .filter((k) => k !== "retorno")
        .flatMap((k) =>
          PROFISSIONAIS.filter((x) => x.mix.some(([s]) => s === k)).map(
            (x) => `(${O}, ${q(SERVICOS[k].tipo)}, ${q(x.esp)})`,
          ),
        )
        .join(",\n      ")}
      on conflict do nothing;

      insert into public.clinic_procedures (id, organization_id, name, short_description, duration_minutes) values
      ${Object.values(SERVICOS)
        .filter((s) => s.proc)
        .map((s) => `(${q(s.proc!)}, ${O}, ${q(s.nome)}, ${q(s.descricaoProc!)}, ${s.minutos})`)
        .join(",\n      ")};

      insert into public.catalog_products (id, organization_id, codigo, nome, preco_cents) values
        (${q(PROD.toxina)}, ${O}, 'TOX-A100', 'Toxina botulínica tipo A 100U', 0),
        (${q(PROD.acido)}, ${O}, 'AH-1ML', 'Ácido hialurônico 1 mL', 0),
        (${q(PROD.bio)}, ${O}, 'BIO-PLLA', 'Bioestimulador de colágeno (ácido poli-L-láctico)', 0),
        (${q(PROD.peeling)}, ${O}, 'TCA-20', 'Ácido tricloroacético 20% (30 mL)', 0),
        (${q(PROD.anestesico)}, ${O}, 'ANEST-LIDO4', 'Anestésico tópico lidocaína 4% (30 g)', 0),
        (${q(PROD.agulha)}, ${O}, 'AG-30G', 'Agulha 30G 13 mm', 0),
        (${q(PROD.canula)}, ${O}, 'CAN-22G', 'Cânula 22G 50 mm', 0),
        (${q(PROD.luva)}, ${O}, 'LUVA-NIT-M', 'Luva nitrílica M', 0),
        (${q(PROD.gaze)}, ${O}, 'GAZE-EST', 'Gaze estéril 7,5 x 7,5', 0),
        (${q(PROD.mascara)}, ${O}, 'MASC-CALM', 'Máscara facial calmante', 0),
        (${q(PROD.ponteira)}, ${O}, 'PONT-36', 'Ponteira de microagulhamento 36 agulhas', 0),
        (${q(PROD.clorex)}, ${O}, 'CLOREX-05', 'Clorexidina alcoólica 0,5% (1 L)', 0);

      insert into public.contacts (id, organization_id, name, phone_number, email, birthdate, source, created_at) values
      ${pacientes
        .map((x, i) => `(${q(PAC[i]!)}, ${O}, ${q(x.nome)}, ${q(x.telefone)}, ${x.email ? q(x.email) : "null"}, ${q(x.nascimento)}, 'manual', ${ts(criadoEmPaciente(i))})`)
        .join(",\n      ")};

      insert into public.clinic_patient_profiles (organization_id, contact_id, sex, profession, marital_status, referral_source,
        cep, street, number, district, city, uf, emergency_name, emergency_relationship, emergency_phone, completed_at, created_at) values
      ${pacientes
        .map((x: PacienteFicticio, i) => {
          const completo = i % 7 !== 3;
          return `(${O}, ${q(PAC[i]!)}, ${q(x.sexo)}, ${q(x.profissao)}, ${q(x.estadoCivil)}, ${q(x.origem)},
          ${q(x.endereco.cep)}, ${q(x.endereco.rua)}, ${q(x.endereco.numero)}, ${q(x.endereco.bairro)}, 'São Paulo', 'SP',
          ${q(x.emergencia.nome)}, ${q(x.emergencia.parentesco)}, ${q(x.emergencia.telefone)}, ${completo ? ts(criadoEmPaciente(i)) : "null"}, ${ts(criadoEmPaciente(i))})`;
        })
        .join(",\n      ")};

      insert into public.contacts (id, organization_id, name, phone_number, email, source, created_at) values
      ${prospects
        .map((x, i) => `(${q(PROSP[i]!)}, ${O}, ${q(x.nome)}, ${q(x.telefone)}, ${x.email ? q(x.email) : "null"}, 'manual', ${ts(new Date(agora.getTime() - r.inteiro(1, 40) * 24 * 60 * MIN))})`)
        .join(",\n      ")};

      -- A JORNADA publicada de cada profissional — os mesmos dias e horários
      -- com que a agenda simulada foi gerada (almoço 12h–13h fora).
      insert into public.attendant_availability (organization_id, user_id, is_available, capacity, schedule) values
      ${PROFISSIONAIS.map((x) => {
        const janelas = x.dias.flatMap((dow) => {
          if (dow === 6) return [{ dow, start: "08:00", end: "13:00" }];
          const abre = x.chave === "bruno" ? "10:00" : "09:00";
          const fecha = x.chave === "diego" ? "17:00" : "19:00";
          return [{ dow, start: abre, end: "12:00" }, { dow, start: "13:00", end: fecha }];
        });
        return `(${O}, ${q(user(x.chave))}, true, 1, ${j({ timezone: "America/Sao_Paulo", windows: janelas })})`;
      }).join(",\n      ")}
      on conflict (organization_id, user_id) do update set schedule = excluded.schedule, is_available = true;

      insert into public.clinic_agenda_blocks (organization_id, user_id, starts_on, ends_on, reason, created_by) values
        (${O}, ${q(user("ana"))}, ${q(`${congresso.ano}-${String(congresso.mes + 1).padStart(2, "0")}-${String(congresso.dia).padStart(2, "0")}`)},
         ${q(`${congresso.ano}-${String(congresso.mes + 1).padStart(2, "0")}-${String(congresso.dia).padStart(2, "0")}`)},
         'Congresso Brasileiro de Dermatologia', ${q(user("dono"))});
    `,
  });

  // -------------------------------------------------------------------------
  // 1b. Papéis de acesso: o modo por permissões ligado, com papéis clínicos.
  //     Bruno, Carla e Diego têm o papel "Profissional de saúde" (9044): só a
  //     própria agenda, pacientes e prontuários — a prova da experiência do
  //     profissional. Os papéis de sistema não
  //     trazem chave clínica (prontuário), então quem atende ganha um papel que
  //     soma o do sistema com as chaves clínicas.
  // -------------------------------------------------------------------------
  const PAPEL = { coordenacao: id(22, 1), equipe: id(22, 2), soAPropria: id(22, 3) };
  passos.push({
    titulo: "ligar o modo de acesso por papéis",
    ator: user("dono"),
    sql: `select public.fn_clinic_definir_acesso_por_permissoes(${O}, true);`,
  });
  passos.push({
    titulo: "papéis clínicos e o atendente que só vê a própria agenda",
    ator: "superuser",
    sql: `
      insert into public.clinic_roles (id, organization_id, nome, descricao, is_system, ativo) values
        (${q(PAPEL.coordenacao)}, ${O}, 'Coordenação clínica', 'Gerente + prontuário completo, reabertura e rastreio de lote', false, true),
        (${q(PAPEL.equipe)}, ${O}, 'Equipe clínica', 'Atendente + atender e registrar prontuário', false, true),
        (${q(PAPEL.soAPropria)}, ${O}, 'Atendente clínico — só a própria agenda', 'Equipe clínica sem ver a agenda dos colegas', false, true);

      -- base: as chaves do papel de sistema correspondente
      insert into public.clinic_role_permissions (organization_id, role_id, permission_key)
      select ${O}, x.papel::uuid, rp.permission_key
        from (values (${q(PAPEL.coordenacao)}, 'gerente'), (${q(PAPEL.equipe)}, 'atendente'), (${q(PAPEL.soAPropria)}, 'atendente')) as x(papel, sistema)
        join public.clinic_roles r on r.organization_id = ${O} and r.system_key = x.sistema
        join public.clinic_role_permissions rp on rp.role_id = r.id
      on conflict do nothing;
      -- clínicas: tudo para a coordenação; o essencial de atender para a equipe
      insert into public.clinic_role_permissions (organization_id, role_id, permission_key)
      select ${O}, x.papel::uuid, c.key
        from public.clinic_permissions c
        cross join (values (${q(PAPEL.coordenacao)}), (${q(PAPEL.equipe)}), (${q(PAPEL.soAPropria)})) as x(papel)
       where c.clinica
         and (x.papel = ${q(PAPEL.coordenacao)} or c.key not in ('atendimento.reabrir', 'estoque.rastreio_lote', 'prontuario.exportar'))
      on conflict do nothing;
      delete from public.clinic_role_permissions where role_id = ${q(PAPEL.soAPropria)} and permission_key = 'agenda.ver_outros';

      -- quem tem qual papel (os de sistema dos três profissionais saem)
      delete from public.clinic_member_roles
       where organization_id = ${O} and user_id in (${[user("ana"), user("bruno"), user("carla"), user("diego")].map(q).join(", ")});
      insert into public.clinic_member_roles (organization_id, user_id, role_id, granted_by) values
        (${O}, ${q(user("ana"))}, ${q(PAPEL.coordenacao)}, ${q(user("dono"))});
      -- agenda S5 (9044): os três profissionais com o papel de sistema
      -- "Profissional de saúde" — Meu dia, só a própria agenda, só os próprios
      -- pacientes e prontuários. Ana (coordenação) vê tudo.
      insert into public.clinic_member_roles (organization_id, user_id, role_id, granted_by)
      select ${O}, u.id::uuid, r.id, ${q(user("dono"))}
        from public.clinic_roles r
        cross join (values (${q(user("bruno"))}), (${q(user("carla"))}), (${q(user("diego"))})) as u(id)
       where r.organization_id = ${O} and r.system_key = 'profissional'
      on conflict do nothing;
    `,
  });

  // -------------------------------------------------------------------------
  // 2. Financeiro: contas, formas de pagamento, plano de contas, comissões
  // -------------------------------------------------------------------------
  const CONTA = { banco: id(19, 1), caixa: id(19, 2) };
  const FORMA = { pix: id(20, 1), credito: id(20, 2), debito: id(20, 3), dinheiro: id(20, 4) };
  const PLANO = {
    procedimentos: id(21, 1), consultas: id(21, 2),
    aluguel: id(21, 10), folha: id(21, 11), insumos: id(21, 12), marketing: id(21, 13), utilidades: id(21, 14),
    sistemas: id(21, 15), impostos: id(21, 16), servicos: id(21, 17), comissoes: id(21, 18), miudas: id(21, 19),
  };
  passos.push({
    titulo: "financeiro: contas, formas de pagamento, plano de contas e regras de comissão",
    ator: "superuser",
    sql: `
      insert into public.financial_accounts (id, organization_id, name, kind, opening_balance_cents, created_at) values
        (${q(CONTA.banco)}, ${O}, 'Conta PJ — Banco', 'bank', 4250000, ${ts(inicioDaClinica)}),
        (${q(CONTA.caixa)}, ${O}, 'Caixa da recepção', 'cash', 50000, ${ts(inicioDaClinica)});
      insert into public.payment_methods (id, organization_id, name, account_id, created_at) values
        (${q(FORMA.pix)}, ${O}, 'Pix', ${q(CONTA.banco)}, ${ts(inicioDaClinica)}),
        (${q(FORMA.credito)}, ${O}, 'Cartão de crédito', ${q(CONTA.banco)}, ${ts(inicioDaClinica)}),
        (${q(FORMA.debito)}, ${O}, 'Cartão de débito', ${q(CONTA.banco)}, ${ts(inicioDaClinica)}),
        (${q(FORMA.dinheiro)}, ${O}, 'Dinheiro', ${q(CONTA.caixa)}, ${ts(inicioDaClinica)});
      insert into public.account_plans (id, organization_id, name, direction, created_at) values
        (${q(PLANO.procedimentos)}, ${O}, 'Receita de procedimentos e consultas', 'in', ${ts(inicioDaClinica)}),
        (${q(PLANO.consultas)}, ${O}, 'Outras receitas', 'in', ${ts(new Date(inicioDaClinica.getTime() + MIN))}),
        (${q(PLANO.aluguel)}, ${O}, 'Aluguel e condomínio', 'out', ${ts(inicioDaClinica)}),
        (${q(PLANO.folha)}, ${O}, 'Folha de pagamento', 'out', ${ts(inicioDaClinica)}),
        (${q(PLANO.insumos)}, ${O}, 'Insumos e materiais', 'out', ${ts(inicioDaClinica)}),
        (${q(PLANO.marketing)}, ${O}, 'Marketing', 'out', ${ts(inicioDaClinica)}),
        (${q(PLANO.utilidades)}, ${O}, 'Energia, água e internet', 'out', ${ts(inicioDaClinica)}),
        (${q(PLANO.sistemas)}, ${O}, 'Software e sistemas', 'out', ${ts(inicioDaClinica)}),
        (${q(PLANO.impostos)}, ${O}, 'Impostos', 'out', ${ts(inicioDaClinica)}),
        (${q(PLANO.servicos)}, ${O}, 'Serviços de terceiros', 'out', ${ts(inicioDaClinica)}),
        (${q(PLANO.comissoes)}, ${O}, 'Repasse de comissões', 'out', ${ts(inicioDaClinica)}),
        (${q(PLANO.miudas)}, ${O}, 'Despesas miúdas (caixa pequeno)', 'out', ${ts(inicioDaClinica)});
      insert into public.commission_rules (organization_id, attendant_user_id, percent, name, created_at) values
      ${PROFISSIONAIS.map((x) => `(${O}, ${q(user(x.chave))}, ${x.comissao}, ${q(`Repasse ${NOMES_EQUIPE[x.chave]}`)}, ${ts(inicioDaClinica)})`).join(",\n      ")};
    `,
  });

  // maquininha (FN1): taxas por modalidade e parcelas; Pix cai direto na conta, sem taxa
  passos.push({
    titulo: "financeiro: maquininha, tabela de taxas e tipo de cada forma de pagamento",
    ator: user("dono"),
    alvo: inicioDaClinica,
    sql: `
      do $sim$
      declare v_adq uuid;
      begin
        v_adq := (public.fn_clinic_fin_adquirente_salvar(${O}, null, ${j({
          nome: "Maquininha Cielo", modelo: "cielo_smart", prazo_pix_dias: 0, prazo_debito_dias: 1, prazo_credito_dias: 30,
          tarifa_fixa_cents: 0, antecipacao_pct: 1.99, antecipacao_modo: "por_mes",
        })}) ->> 'id')::uuid;
        perform public.fn_clinic_fin_tabela_publicar(${O}, v_adq, ${q(dataISO(inicioDaClinica))}, ${j([
          { modalidade: "debito", parcelas_de: 1, parcelas_ate: 1, mdr_pct: 1.37 },
          { modalidade: "credito", parcelas_de: 1, parcelas_ate: 1, mdr_pct: 3.15 },
          { modalidade: "credito", parcelas_de: 2, parcelas_ate: 6, mdr_pct: 4.39 },
          { modalidade: "credito", parcelas_de: 7, parcelas_ate: 12, mdr_pct: 5.12 },
          { modalidade: "credito", bandeira: "amex", parcelas_de: 1, parcelas_ate: 12, mdr_pct: 5.49 },
        ])});
        perform public.fn_clinic_fin_forma_salvar(${O}, ${q(FORMA.pix)}, 'pix', null);
        perform public.fn_clinic_fin_forma_salvar(${O}, ${q(FORMA.credito)}, 'credito', v_adq);
        perform public.fn_clinic_fin_forma_salvar(${O}, ${q(FORMA.debito)}, 'debito', v_adq);
        perform public.fn_clinic_fin_forma_salvar(${O}, ${q(FORMA.dinheiro)}, 'dinheiro', null);
      end
      $sim$;
    `,
  });

  // -------------------------------------------------------------------------
  // 3. Estoque: ligar, configurar produtos, fornecedores, entradas e kits
  // -------------------------------------------------------------------------
  const diaEntrada = new Date(primeiraData.getTime() - 5 * 24 * 60 * MIN);
  passos.push({ titulo: "ligar o estoque", ator: user("dono"), sql: `select public.fn_clinic_definir_estoque(${O}, true);`, alvo: diaEntrada });
  passos.push({
    titulo: "fornecedores",
    ator: "superuser",
    sql: `
      insert into public.clinic_estoque_fornecedores (organization_id, cnpj, nome, created_at) values
        (${O}, '11222333000181', 'Dermo Distribuidora de Produtos Médicos Ltda', ${ts(inicioDaClinica)}),
        (${O}, '22333444000172', 'MedSupply Materiais Hospitalares Ltda', ${ts(inicioDaClinica)}),
        (${O}, '33444555000163', 'Estética Pro Comércio de Cosméticos Ltda', ${ts(inicioDaClinica)});
    `,
  });
  const cfg = (prod: string, dados: Record<string, unknown>) =>
    `perform public.fn_clinic_estoque_produto_salvar(${O}, ${q(prod)}, ${j({ gerenciado: true, ...dados })}, null);`;
  const entrada = (prod: string, qtd: number, custo: number, lote?: { codigo: string; validade: string }) =>
    `perform public.fn_clinic_estoque_entrada(${O}, jsonb_build_object('product_id', ${q(prod)}, 'local_id', v_central,
       'quantidade', ${qtd}, 'em_unidade_estoque', true, 'custo_unitario_cents', ${custo}${lote ? `, 'lote', ${q(lote.codigo)}, 'validade', ${q(lote.validade)}` : ""}));`;
  const validadeProxima = dataISO(new Date(agora.getTime() + 21 * 24 * 60 * MIN));
  passos.push({
    titulo: "produtos do estoque e entradas da compra inicial",
    ator: user("compras"),
    alvo: diaEntrada,
    sql: `
      do $sim$
      declare v_central uuid;
      begin
        select l.id into v_central from public.clinic_estoque_locais l where l.organization_id = ${O} and l.padrao;
        ${cfg(PROD.toxina, { unidade_estoque: "frasco", unidade_aplicacao: "U", fator_conversao: 100, fracionavel: true, validade_pos_abertura_horas: 72, rastreado: true, controlado: true, conselhos_permitidos: ["CRM", "CRO"], estoque_minimo: 300, ponto_pedido: 600, registro_anvisa: "1.2214.0005.001-1" })}
        ${cfg(PROD.acido, { unidade_estoque: "seringa", unidade_aplicacao: "un", fator_conversao: 1, rastreado: true, estoque_minimo: 4, ponto_pedido: 8, registro_anvisa: "8.0154.6000.012-3" })}
        ${cfg(PROD.bio, { unidade_estoque: "frasco", unidade_aplicacao: "un", fator_conversao: 1, rastreado: true, estoque_minimo: 2, ponto_pedido: 4 })}
        ${cfg(PROD.peeling, { unidade_estoque: "frasco", unidade_aplicacao: "mL", fator_conversao: 30, estoque_minimo: 30 })}
        ${cfg(PROD.anestesico, { unidade_estoque: "bisnaga", unidade_aplicacao: "g", fator_conversao: 30, rastreado: true, estoque_minimo: 60 })}
        ${cfg(PROD.agulha, { unidade_estoque: "cx", unidade_aplicacao: "un", fator_conversao: 100, estoque_minimo: 100 })}
        ${cfg(PROD.canula, { unidade_estoque: "cx", unidade_aplicacao: "un", fator_conversao: 20, estoque_minimo: 10 })}
        ${cfg(PROD.luva, { unidade_estoque: "cx", unidade_aplicacao: "un", fator_conversao: 100, estoque_minimo: 200, ponto_pedido: 400 })}
        ${cfg(PROD.gaze, { unidade_estoque: "pct", unidade_aplicacao: "un", fator_conversao: 10, estoque_minimo: 200 })}
        ${cfg(PROD.mascara, { unidade_estoque: "un", unidade_aplicacao: "un", fator_conversao: 1, estoque_minimo: 20, ponto_pedido: 30 })}
        ${cfg(PROD.ponteira, { unidade_estoque: "un", unidade_aplicacao: "un", fator_conversao: 1, estoque_minimo: 15, ponto_pedido: 25 })}
        ${cfg(PROD.clorex, { unidade_estoque: "frasco", unidade_aplicacao: "mL", fator_conversao: 1000, estoque_minimo: 1000 })}

        ${entrada(PROD.toxina, 16, 98000, LOTE.toxina)}
        ${entrada(PROD.toxina, 10, 102000, LOTE.toxina2)}
        ${entrada(PROD.acido, 40, 52000, LOTE.acido)}
        ${entrada(PROD.acido, 3, 48000, { codigo: "AH-23988", validade: validadeProxima })}
        ${entrada(PROD.bio, 18, 145000, LOTE.bio)}
        ${entrada(PROD.peeling, 6, 18500)}
        ${entrada(PROD.anestesico, 14, 6800, LOTE.anestesico)}
        ${entrada(PROD.agulha, 5, 4200)}
        ${entrada(PROD.canula, 4, 21000)}
        ${entrada(PROD.luva, 9, 4800)}
        ${entrada(PROD.gaze, 90, 650)}
        ${entrada(PROD.mascara, 80, 1450)}
        ${entrada(PROD.ponteira, 45, 3900)}
        ${entrada(PROD.clorex, 5, 2900)}
      end
      $sim$;
    `,
  });
  const kit = (servico: ChaveServico, itens: [string, number][]) =>
    `select public.fn_clinic_estoque_kit_salvar(${O}, ${q(SERVICOS[servico].proc!)}, ${j(itens.map(([product_id, quantidade]) => ({ product_id, quantidade })))});`;
  passos.push({
    titulo: "kits dos procedimentos",
    ator: user("dono"),
    alvo: diaEntrada,
    sql: [
      kit("toxina", [[PROD.toxina, 30], [PROD.agulha, 2], [PROD.luva, 2], [PROD.gaze, 2], [PROD.clorex, 10]]),
      kit("labial", [[PROD.acido, 1], [PROD.anestesico, 2], [PROD.agulha, 1], [PROD.luva, 2], [PROD.gaze, 2]]),
      kit("mandibula", [[PROD.acido, 2], [PROD.canula, 1], [PROD.anestesico, 2], [PROD.luva, 2], [PROD.gaze, 2]]),
      kit("bioestimulador", [[PROD.bio, 1], [PROD.canula, 1], [PROD.anestesico, 3], [PROD.luva, 2], [PROD.gaze, 3]]),
      kit("peeling", [[PROD.peeling, 2], [PROD.luva, 2], [PROD.gaze, 4]]),
      kit("limpeza", [[PROD.luva, 2], [PROD.gaze, 6], [PROD.mascara, 1]]),
      kit("microagulhamento", [[PROD.ponteira, 1], [PROD.anestesico, 3], [PROD.luva, 2], [PROD.gaze, 4], [PROD.clorex, 10]]),
    ].join("\n"),
  });

  // -------------------------------------------------------------------------
  // 4. Agenda inteira (passado e futuro) — cadastro, sem regra clínica
  // -------------------------------------------------------------------------
  const statusInicial = (a: Agendamento) =>
    a.destino === "falta" ? "no_show" : a.destino === "cancelado" ? "cancelled" : a.destino === "pendente" ? "pending" : "confirmed";
  const linhasAgenda = agenda.map((a) => {
    const s = SERVICOS[a.servico];
    const criado = new Date(a.inicio.getTime() - r.inteiro(1, 21) * 24 * 60 * MIN);
    const cancelado = a.destino === "cancelado" ? new Date(a.inicio.getTime() - r.inteiro(3, 48) * 60 * MIN) : null;
    return `(${q(a.id)}, ${O}, ${q(s.tipo)}, ${q(s.nome)}, ${ts(a.inicio)}, ${ts(a.fim)}, 'America/Sao_Paulo', ${q(statusInicial(a))},
      ${q(user(a.prof.chave))}, ${q(PAC[a.paciente]!)}, 'in_person', 'user', ${q(user("recepcao"))}, 'ui',
      ${cancelado ? ts(cancelado) : "null"}, ${cancelado ? q(r.um(MOTIVOS_CANCELAMENTO)) : "null"}, ${ts(criado)})`;
  });
  for (let i = 0; i < linhasAgenda.length; i += 200) {
    passos.push({
      titulo: `agenda (${i + 1}–${Math.min(i + 200, linhasAgenda.length)} de ${linhasAgenda.length})`,
      ator: "superuser",
      sql: `
        insert into public.calendar_appointments (id, organization_id, event_type_id, title, starts_at, ends_at, time_zone, status,
          owner_user_id, contact_id, location_kind, created_by_kind, created_by_user_id, source, cancelled_at, cancellation_reason, created_at) values
        ${linhasAgenda.slice(i, i + 200).join(",\n        ")};
      `,
    });
  }
  passos.push({
    titulo: "salas dos agendamentos",
    ator: "superuser",
    sql: `
      insert into public.clinic_appointment_resources (organization_id, appointment_id, resource_id, starts_at, ends_at)
      select a.organization_id, a.id, s.sala::uuid, a.starts_at, a.ends_at
        from public.calendar_appointments a
        join (values ${PROFISSIONAIS.map((x) => `(${q(user(x.chave))}::uuid, ${q(x.sala)})`).join(", ")}) as s(u, sala) on s.u = a.owner_user_id
       where a.organization_id = ${O} and a.status <> 'cancelled'
         and not exists (select 1 from public.clinic_appointment_resources r where r.appointment_id = a.id and r.resource_id = s.sala::uuid);
    `,
  });

  // -------------------------------------------------------------------------
  // 5. O dia a dia: cada atendimento realizado, na ordem em que aconteceu
  // -------------------------------------------------------------------------
  const bandeiras = ["visa", "visa", "mastercard", "mastercard", "elo", "amex"] as const;
  const parcelasPara = (valor: number) =>
    valor >= 150000 ? r.um([1, 2, 3, 3, 4, 5, 6, 10]) : valor >= 60000 ? r.um([1, 1, 2, 3]) : 1;
  /** como o paciente pagou: Pix, débito, crédito (à vista ou parcelado), dinheiro, ou dividido */
  const sortearPagamentos = (total: number) => {
    const um = (forma: string, valor: number) =>
      forma === FORMA.credito
        ? { payment_method_id: forma, valor_cents: valor, parcelas: parcelasPara(valor), bandeira: r.um(bandeiras) }
        : forma === FORMA.debito
          ? { payment_method_id: forma, valor_cents: valor, parcelas: 1, bandeira: r.um(bandeiras.slice(0, 5)) }
          : { payment_method_id: forma, valor_cents: valor, parcelas: 1 };
    if (total >= 60000 && r.chance(0.12)) {
      // entrada no Pix (ou dinheiro) e o resto no cartão
      const entrada = Math.round((total * r.um([0.3, 0.4, 0.5])) / 1000) * 1000;
      return [um(r.chance(0.8) ? FORMA.pix : FORMA.dinheiro, entrada), um(FORMA.credito, total - entrada)];
    }
    const x = r.numero();
    const forma = x < 0.38 ? FORMA.pix : x < 0.78 ? FORMA.credito : x < 0.92 ? FORMA.debito : FORMA.dinheiro;
    return [um(forma, total)];
  };
  const jaVeio = new Set<number>();
  const jaAssinou = new Set<string>();
  const comAlergia = new Set<number>();
  let planos = 0;
  const contagem = { realizados: 0, comandas: 0, faltas: 0, cancelados: 0, futuros: 0, hoje_em_andamento: 0 };

  // reposição do estoque na metade do período (pedido da 2ª quinzena)
  const diaReposicao = new Date(agora.getTime() - 15 * 24 * 60 * MIN);
  let reposto = false;
  const reposicao: PassoDaSimulacao = {
    titulo: "reposição do estoque (pedido da 2ª quinzena)",
    ator: user("compras"),
    alvo: diaReposicao,
    sql: `
      do $sim$
      declare v_central uuid;
      begin
        select l.id into v_central from public.clinic_estoque_locais l where l.organization_id = ${O} and l.padrao;
        ${entrada(PROD.toxina, 6, 98000, LOTE.toxina)}
        ${entrada(PROD.toxina, 2, 102000, LOTE.toxina2)}
        ${entrada(PROD.acido, 15, 52000, LOTE.acido)}
        ${entrada(PROD.bio, 8, 145000, LOTE.bio)}
        ${entrada(PROD.gaze, 60, 650)}
        ${entrada(PROD.ponteira, 30, 3900)}
        ${entrada(PROD.mascara, 30, 1450)}
      end
      $sim$;
    `,
  };

  const emOrdem = [...agenda].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  for (const a of emOrdem) {
    if (!reposto && a.inicio.getTime() >= diaReposicao.getTime()) {
      passos.push(reposicao);
      reposto = true;
    }
    const s = SERVICOS[a.servico];
    const prof = user(a.prof.chave);
    const pac = PAC[a.paciente]!;
    const AG = q(a.id);
    if (a.destino === "falta") contagem.faltas++;
    if (a.destino === "cancelado") contagem.cancelados++;
    if (a.destino === "confirmado" || a.destino === "pendente") contagem.futuros++;
    if (!["realizado", "em_atendimento", "na_recepcao"].includes(a.destino)) continue;

    const chegada = new Date(a.inicio.getTime() - r.inteiro(3, 20) * MIN);
    passos.push({
      titulo: `chegada ${a.id.slice(-5)}`,
      ator: user("recepcao"),
      alvo: chegada,
      sql: `select public.fn_clinic_mudar_status_visita(${O}, ${AG}, 'na_recepcao', null);`,
    });
    // a recepção confere os dados e libera: "Pronto para atendimento" (9043:
    // começar o atendimento é do profissional, a recepção leva só até aqui)
    if (a.destino !== "na_recepcao" || r.chance(0.5)) {
      passos.push({
        titulo: `pronto ${a.id.slice(-5)}`,
        ator: user("recepcao"),
        alvo: new Date(chegada.getTime() + 2 * MIN),
        sql: `select public.fn_clinic_mudar_status_visita(${O}, ${AG}, 'pronto', null);`,
      });
    }
    if (a.destino === "na_recepcao") continue;

    // termo de consentimento: emitido e assinado na recepção antes do 1º procedimento de cada tipo
    const precisaTermo = ["toxina", "labial", "mandibula", "bioestimulador", "peeling", "microagulhamento"].includes(a.servico);
    const chaveTermo = `${a.paciente}|${a.servico}`;
    if (precisaTermo && !jaAssinou.has(chaveTermo)) {
      jaAssinou.add(chaveTermo);
      passos.push({
        titulo: `termo ${a.id.slice(-5)}`,
        ator: user("recepcao"),
        alvo: new Date(chegada.getTime() + 2 * MIN),
        sql: `
          do $sim$
          declare v_versao uuid; v_conteudo text; v_doc uuid;
          begin
            select v.id, v.conteudo into v_versao, v_conteudo
              from public.clinic_modelos_documento m
              join public.clinic_modelos_documento_versoes v on v.modelo_id = m.id
             where m.organization_id = ${O} and m.tipo = 'consentimento'
             order by v.numero desc limit 1;
            v_doc := (public.fn_clinic_documento_emitir(${O}, ${q(pac)}, v_versao,
              ${q(`Termo de consentimento — ${s.nome}`)}, v_conteudo, null, null, null) ->> 'id')::uuid;
            perform public.fn_clinic_documento_aceitar(${O}, v_doc, ${q(pacientes[a.paciente]!.nome)}, '{}'::jsonb, 'Tablet da recepção');
          end
          $sim$;
        `,
      });
    }

    const primeiraVez = !jaVeio.has(a.paciente);
    jaVeio.add(a.paciente);
    const inicioReal = new Date(a.inicio.getTime() + r.inteiro(0, 10) * MIN);
    const evolucao = r.um(EVOLUCOES[a.servico]);
    const queixa = r.um(QUEIXAS);
    const alergia = primeiraVez && r.chance(0.12) ? r.um(ALERGIAS) : null;
    if (alergia) comAlergia.add(a.paciente);
    const insumos = insumosDo(a.servico, r);
    const proximo =
      a.servico === "retorno" ? "Alta do ciclo; reavaliar em 4 meses." : a.servico === "avaliacao" ? "Agendar procedimento conforme orçamento." : "Retorno em 15 dias.";

    passos.push({
      titulo: `atendimento ${a.id.slice(-5)} (${s.nome})`,
      ator: prof,
      alvo: inicioReal,
      sql: `
        do $sim$
        declare v_at uuid; v_form uuid;
        begin
          perform public.fn_clinic_mudar_status_visita(${O}, ${AG}, 'em_atendimento', null);
          v_at := (public.fn_clinic_iniciar_atendimento(${O}, ${AG}, ${q(a.prof.esp)}) ->> 'id')::uuid;
          ${
            primeiraVez
              ? `select v.id into v_form from public.clinic_modelos_formulario m
                   join public.clinic_modelos_formulario_versoes v on v.modelo_id = m.id
                  where m.organization_id = ${O} and m.nome = 'Anamnese estética'
                  order by v.created_at desc limit 1;
                 perform public.fn_clinic_salvar_formulario(${O}, v_at, 'anamnese', v_form,
                   ${j({ queixa_principal: queixa, objetivo: "Melhorar a aparência com resultado natural.", usa_acidos: r.chance(0.3), exposicao_solar: r.um(["baixa", "moderada", "alta"]) })}, 0);`
              : ""
          }
          ${alergia ? `perform public.fn_clinic_cabecalho_salvar(${O}, ${q(pac)}, ${q(alergia)}, null, 0);` : ""}
          ${
            s.proc
              ? `perform public.fn_clinic_procedimento_salvar(${O}, v_at, null,
                   ${j({ procedure_id: s.proc, descricao: s.nome, regiao: r.um(REGIOES[a.servico] ?? ["Face"]) })}, ${j(insumos)}, 0);`
              : ""
          }
          perform public.fn_clinic_salvar_evolucao(${O}, v_at, ${q(evolucao)}, null, null,
            ${q(ORIENTACOES[a.servico] ?? "Manter cuidados domiciliares e fotoproteção.")}, ${q(proximo)}, 0);
        end
        $sim$;
      `,
    });
    if (a.destino === "em_atendimento") {
      contagem.hoje_em_andamento++;
      continue;
    }

    const fimReal = new Date(Math.min(a.fim.getTime() + r.inteiro(-5, 10) * MIN, agora.getTime() - MIN));
    passos.push({
      titulo: `finalizar ${a.id.slice(-5)}`,
      ator: prof,
      alvo: fimReal,
      sql: `
        select public.fn_clinic_finalizar_atendimento(${O}, a.id)
          from public.clinic_atendimentos a
         where a.organization_id = ${O} and a.appointment_id = ${AG} and a.status = 'em_andamento';
        select public.fn_clinic_mudar_status_visita(${O}, ${AG}, 'finalizado', null);
      `,
    });
    if (s.proc) {
      passos.push({
        titulo: `baixa do estoque ${a.id.slice(-5)}`,
        ator: "service_role",
        alvo: new Date(fimReal.getTime() + MIN),
        sql: `
          select public.fn_clinic_estoque_baixar_procedimento(${O}, pr.id)
            from public.clinic_procedimentos_realizados pr
            join public.clinic_atendimentos a on a.id = pr.atendimento_id
           where a.organization_id = ${O} and a.appointment_id = ${AG} and pr.status = 'finalizado';
        `,
      });
    }
    contagem.realizados++;

    // plano de tratamento para quem começa microagulhamento ou bioestimulador
    if (planos < 12 && (a.servico === "microagulhamento" || a.servico === "bioestimulador") && primeiraVez === false && r.chance(0.5)) {
      planos++;
      const primeira = dataISO(new Date(a.inicio.getTime() + 30 * 24 * 60 * MIN));
      passos.push({
        titulo: `plano de tratamento ${a.id.slice(-5)}`,
        ator: prof,
        alvo: new Date(fimReal.getTime() + 2 * MIN),
        sql: `
          do $sim$
          declare v_plano uuid; v_at uuid;
          begin
            select id into v_at from public.clinic_atendimentos where organization_id = ${O} and appointment_id = ${AG} and status = 'finalizado';
            v_plano := (public.fn_clinic_plano_salvar(${O}, null, ${q(pac)}, ${q(`Protocolo de ${s.nome.toLowerCase()}`)},
              ${q(a.servico === "bioestimulador" ? "Melhorar firmeza e qualidade da pele." : "Uniformizar textura e atenuar cicatrizes.")},
              'Sessões mensais; fotoproteção diária.', ${q(dataISO(a.inicio))}, ${q(dataISO(new Date(a.inicio.getTime() + 100 * 24 * 60 * MIN)))},
              ${q(a.prof.esp)}, v_at, 'ativo', null) ->> 'id')::uuid;
            perform public.fn_clinic_plano_adicionar_sessoes(${O}, v_plano, ${q(`Sessão de ${s.nome.toLowerCase()}`)},
              ${q(s.tipo)}, ${q(s.proc!)}, 3, ${q(primeira)}, 30);
          end
          $sim$;
        `,
      });
    }

    if (s.precoCents === 0) {
      passos.push({
        titulo: `retorno concluído ${a.id.slice(-5)}`,
        // na clínica, "realizado" é do profissional do agendamento (agenda S4)
        ator: prof,
        alvo: new Date(fimReal.getTime() + MIN),
        sql: `update public.calendar_appointments set status = 'completed', outcome_recorded_at = now()
               where id = ${AG} and status = 'confirmed';`,
      });
      continue;
    }
    if (a.semComanda) continue;
    const desconto = r.chance(0.15) ? Math.round(s.precoCents * r.um([0.05, 0.1])) : 0;
    const extra = a.servico === "toxina" && r.chance(0.3) ? 30000 : 0;
    contagem.comandas++;
    passos.push({
      titulo: `comanda ${a.id.slice(-5)}`,
      ator: user("recepcao"),
      alvo: new Date(fimReal.getTime() + r.inteiro(3, 12) * MIN),
      sql: `
        do $sim$
        declare v_sale uuid; v_num bigint;
        begin
          v_num := public.fn_proximo_numero_de_comanda(${O});
          insert into public.sales (organization_id, number, contact_id, appointment_id, attendant_user_id, created_by_user_id, discount_cents)
          values (${O}, v_num, ${q(pac)}, ${AG}, ${q(user("recepcao"))}, ${q(user("recepcao"))}, ${desconto})
          returning id into v_sale;
          insert into public.sale_items (organization_id, sale_id, event_type_id, description, attendant_user_id, quantity,
                                         unit_price_cents, total_cents, commission_percent)
          values (${O}, v_sale, ${q(s.tipo)}, ${q(extra ? `${s.nome} — região adicional` : s.nome)}, ${q(prof)}, 1,
                  ${s.precoCents + extra}, ${s.precoCents + extra}, ${a.prof.comissao});
          perform public.fn_clinic_fin_finalizar(${O}, v_sale, ${j(sortearPagamentos(s.precoCents + extra - desconto))}, 0);
        end
        $sim$;
      `,
    });
  }

  // -------------------------------------------------------------------------
  // 5b. Caixa da recepção (FN3): abre de manhã com fundo de troco, sangria à
  //     tarde quando junta dinheiro, caixa pequeno, fecha à noite com a
  //     contagem por cédula; diferença = conferência do dono. Hoje fica aberto.
  // -------------------------------------------------------------------------
  const CONTAGEM_SQL = `
    v_resto := v_contado; v_contagem := '{}'::jsonb;
    foreach v_nota in array array[20000,10000,5000,2000,1000,500,200,100,50,25,10,5] loop
      if v_resto >= v_nota then
        v_contagem := v_contagem || jsonb_build_object(v_nota::text, v_resto / v_nota);
        v_resto := v_resto % v_nota;
      end if;
    end loop;`;
  const MIUDAS = ["Café, açúcar e água para a recepção", "Material de limpeza", "Correios — envio de documentos", "Estacionamento do motoboy", "Lanche da equipe"];
  let diasDeCaixa = 0;
  let conferencias = 0;
  for (let d = -30; d <= 0; d++) {
    const dia = diaLocal(agora, d);
    if (dia.semana === 0) continue;
    const sabado = dia.semana === 6;
    const abre = instante(dia, 7 * 60 + 50);
    if (abre.getTime() > agora.getTime()) continue;
    diasDeCaixa++;
    const CX = `(select c.id from public.clinic_fin_caixas c where c.organization_id = ${O} and c.status = 'aberto' limit 1)`;
    passos.push({
      titulo: `caixa: abertura ${dataISO(abre)}`,
      ator: user("recepcao"),
      alvo: abre,
      sql: `select public.fn_clinic_fin_caixa_abrir(${O}, ${q(CONTA.caixa)}, 20000);`,
    });
    const miuda = instante(dia, 11 * 60 + r.inteiro(0, 90));
    if (r.chance(0.3) && miuda.getTime() < agora.getTime()) {
      passos.push({
        titulo: `caixa: despesa miúda ${dataISO(abre)}`,
        ator: user("recepcao"),
        alvo: miuda,
        sql: `select public.fn_clinic_fin_caixa_movimentar(${O}, ${CX}, 'caixa_pequeno', ${r.inteiro(9, 60) * 100 + r.um([0, 50, 90])},
                ${q(r.um(MIUDAS))}, ${q(PLANO.miudas)});`,
      });
    }
    const sangria = instante(dia, sabado ? 12 * 60 + 30 : 16 * 60);
    if (sangria.getTime() < agora.getTime()) {
      passos.push({
        titulo: `caixa: sangria ${dataISO(abre)}`,
        ator: user("recepcao"),
        alvo: sangria,
        sql: `
          do $sim$
          declare v_cx uuid := ${CX}; v_esp bigint;
          begin
            v_esp := public.fn_clinic_fin_caixa_esperado_agora(${O}, v_cx);
            if v_esp > 80000 then
              perform public.fn_clinic_fin_caixa_movimentar(${O}, v_cx, 'sangria', ((v_esp - 20000) / 1000) * 1000,
                'Depósito no banco', null);
            end if;
          end
          $sim$;
        `,
      });
    }
    const fecha = instante(dia, sabado ? 13 * 60 + 50 : 19 * 60 + 45);
    if (fecha.getTime() >= agora.getTime()) continue;
    const falta = r.chance(0.15) ? r.um([200, 500, 1000, 1500]) : 0;
    if (falta) conferencias++;
    passos.push({
      titulo: `caixa: fechamento ${dataISO(abre)}`,
      ator: user("recepcao"),
      alvo: fecha,
      sql: `
        do $sim$
        declare v_cx uuid := ${CX}; v_contado bigint; v_resto bigint; v_nota bigint; v_contagem jsonb;
        begin
          v_contado := greatest(public.fn_clinic_fin_caixa_esperado_agora(${O}, v_cx) - ${falta}, 0);
          ${CONTAGEM_SQL}
          perform public.fn_clinic_fin_caixa_fechar(${O}, v_cx, v_contagem,
            ${falta ? q("Contagem não bateu; conferido o recibo do dia, sem achar a diferença.") : "null"});
        end
        $sim$;
      `,
    });
    if (falta) {
      passos.push({
        titulo: `caixa: conferência ${dataISO(abre)}`,
        ator: user("dono"),
        alvo: new Date(fecha.getTime() + 15 * MIN),
        sql: `select public.fn_clinic_fin_caixa_conferir(${O}, c.id) from public.clinic_fin_caixas c
               where c.organization_id = ${O} and c.status = 'aguardando_conferencia';`,
      });
    }
  }

  // -------------------------------------------------------------------------
  // 6. Estoque no meio do mês: perda, inventário e varredura de alertas
  // -------------------------------------------------------------------------
  const meioDoMes = new Date(agora.getTime() - 12 * 24 * 60 * MIN);
  passos.push({
    titulo: "perda: frasco de toxina caiu e quebrou",
    ator: user("compras"),
    alvo: meioDoMes,
    sql: `
      do $sim$
      declare v_lote uuid; v_central uuid;
      begin
        select l.id into v_central from public.clinic_estoque_locais l where l.organization_id = ${O} and l.padrao;
        select id into v_lote from public.clinic_estoque_lotes where organization_id = ${O} and product_id = ${q(PROD.toxina)} and codigo = ${q(LOTE.toxina2.codigo)};
        perform public.fn_clinic_estoque_perda(${O}, jsonb_build_object('lote_id', v_lote, 'local_id', v_central,
          'quantidade', 100, 'categoria', 'quebra', 'motivo', 'Frasco caiu da bancada durante a organização do estoque.'));
      end
      $sim$;
    `,
  });
  passos.push({
    titulo: "inventário semanal do estoque central",
    ator: user("compras"),
    alvo: new Date(agora.getTime() - 5 * 24 * 60 * MIN),
    sql: `
      do $sim$
      declare v_central uuid; v_inv uuid; v_item record; v_contado numeric;
      begin
        select l.id into v_central from public.clinic_estoque_locais l where l.organization_id = ${O} and l.padrao;
        v_inv := (public.fn_clinic_estoque_inventario_abrir(${O}, v_central) ->> 'id')::uuid;
        for v_item in select * from public.clinic_estoque_inventario_itens where inventario_id = v_inv loop
          v_contado := v_item.quantidade_sistema;
          -- divergências pequenas e realistas em materiais de consumo
          if v_item.product_id = ${q(PROD.gaze)} then v_contado := greatest(v_item.quantidade_sistema - 8, 0); end if;
          if v_item.product_id = ${q(PROD.luva)} then v_contado := greatest(v_item.quantidade_sistema - 4, 0); end if;
          perform public.fn_clinic_estoque_inventario_contar(${O}, v_item.id, v_contado);
        end loop;
        perform public.fn_clinic_estoque_inventario_fechar(${O}, v_inv, 'Contagem semanal — diferenças em material de consumo.');
      end
      $sim$;
    `,
  });
  // Pacientes que pediram para remarcar: a recepção muda o horário de alguns
  // compromissos dos próximos dias (vira "Remarcado" até confirmarem de novo).
  // Horário em conflito é recusado pela trava (9005) e o passo segue sem ele.
  passos.push({
    titulo: "remarcações pedidas pelos pacientes",
    ator: user("recepcao"),
    sql: `
      do $sim$
      declare v record; n int := 0;
      begin
        for v in
          select a.id from public.calendar_appointments a
           where a.organization_id = ${O} and a.status in ('pending', 'confirmed') and a.contact_id is not null
             and a.starts_at > now() + interval '1 day' and a.starts_at < now() + interval '8 days'
           order by a.starts_at
        loop
          exit when n >= 6;
          begin
            update public.calendar_appointments
               set starts_at = starts_at + interval '1 day', ends_at = ends_at + interval '1 day'
             where id = v.id;
            n := n + 1;
          exception when others then
            null;
          end;
        end loop;
      end
      $sim$;
    `,
  });
  passos.push({
    titulo: "varredura de alertas do estoque",
    ator: "service_role",
    sql: `select public.fn_clinic_estoque_varrer_alertas();`,
  });

  // -------------------------------------------------------------------------
  // 7. Despesas do mês (pagas) e contas a pagar dos próximos 30 dias
  // -------------------------------------------------------------------------
  const despesas: { desc: string; plano: string; valor: number; dia: number; conta?: string }[] = [
    { desc: "Aluguel da sala comercial", plano: PLANO.aluguel, valor: 980000, dia: 5 },
    { desc: "Folha de pagamento — equipe fixa", plano: PLANO.folha, valor: 1450000, dia: 5 },
    { desc: "Condomínio", plano: PLANO.aluguel, valor: 165000, dia: 10 },
    { desc: "Energia elétrica", plano: PLANO.utilidades, valor: 118000, dia: 15 },
    { desc: "Água e esgoto", plano: PLANO.utilidades, valor: 29000, dia: 15 },
    { desc: "Internet e telefonia", plano: PLANO.utilidades, valor: 38900, dia: 12 },
    { desc: "Sistemas (CRM, agenda e emissor de NF)", plano: PLANO.sistemas, valor: 45900, dia: 8 },
    { desc: "Honorários contábeis", plano: PLANO.servicos, valor: 120000, dia: 10 },
    { desc: "Anúncios Instagram e Google", plano: PLANO.marketing, valor: 200000, dia: 1 },
    { desc: "Lavanderia (toalhas e lençóis)", plano: PLANO.servicos, valor: 48000, dia: 20 },
    { desc: "Simples Nacional", plano: PLANO.impostos, valor: 512000, dia: 20 },
    { desc: "Material de limpeza e copa", plano: PLANO.insumos, valor: 35000, dia: 18, conta: CONTA.caixa },
  ];
  const linhasDespesa: string[] = [];
  for (let d = -30; d <= 30; d++) {
    const dia = diaLocal(agora, d);
    for (const x of despesas) {
      if (dia.dia !== x.dia) continue;
      const quando = instante(dia, 10 * 60);
      const pago = quando.getTime() <= agora.getTime();
      linhasDespesa.push(
        `(${O}, ${q(x.conta ?? CONTA.banco)}, ${q(x.plano)}, 'out', ${x.valor + r.inteiro(-3, 3) * 100}, ${q(x.desc)}, ${q(dataISO(quando))},
          ${pago ? "'paid'" : "'pending'"}, ${pago ? ts(quando) : "null"}, 'manual', ${q(user("dono"))},
          ${ts(new Date(Math.min(quando.getTime() - 3 * 24 * 60 * MIN, agora.getTime() - 24 * 60 * MIN)))})`,
      );
    }
  }
  linhasDespesa.push(
    `(${O}, ${q(CONTA.banco)}, ${q(PLANO.insumos)}, 'out', 6874500, 'Compra de insumos — Dermo Distribuidora (NF 48213)', ${q(dataISO(diaEntrada))},
      'paid', ${ts(diaEntrada)}, 'manual', ${q(user("compras"))}, ${ts(diaEntrada)})`,
    `(${O}, ${q(CONTA.banco)}, ${q(PLANO.insumos)}, 'out', 2814000, 'Reposição de insumos — 2ª quinzena (NF 48877)', ${q(dataISO(diaReposicao))},
      'paid', ${ts(diaReposicao)}, 'manual', ${q(user("compras"))}, ${ts(diaReposicao)})`,
    `(${O}, ${q(CONTA.banco)}, ${q(PLANO.insumos)}, 'out', 1854000, 'Reposição de toxina e ácido hialurônico — Dermo Distribuidora', ${q(dataISO(new Date(agora.getTime() + 6 * 24 * 60 * MIN)))},
      'pending', null, 'manual', ${q(user("compras"))}, ${ts(new Date(agora.getTime() - 24 * 60 * MIN))})`,
  );
  passos.push({
    titulo: "despesas pagas e contas a pagar",
    ator: "superuser",
    sql: `
      insert into public.financial_entries (organization_id, account_id, account_plan_id, direction, amount_cents, description, entry_date,
        status, paid_at, origin, created_by_user_id, created_at) values
      ${linhasDespesa.join(",\n      ")};
    `,
  });

  // -------------------------------------------------------------------------
  // 8. CRM: funil da clínica, oportunidades e tarefas da equipe
  // -------------------------------------------------------------------------
  const FUNIL = id(18, 1);
  const ETAPAS = [
    { slug: "novo_contato", nome: "Novo contato", cor: "#64748b" },
    { slug: "avaliacao_agendada", nome: "Avaliação agendada", cor: "#0ea5e9" },
    { slug: "avaliacao_realizada", nome: "Avaliação realizada", cor: "#6366f1" },
    { slug: "orcamento_enviado", nome: "Orçamento enviado", cor: "#f59e0b" },
    { slug: "negociacao", nome: "Em negociação", cor: "#f97316" },
    { slug: "fechado", nome: "Fechado", cor: "#16a34a", ganho: true },
    { slug: "perdido", nome: "Perdido", cor: "#dc2626", perdido: true },
  ];
  const etapaId = (i: number) => id(18, 10 + i);
  const interesses = ["Toxina botulínica", "Preenchimento labial", "Bioestimulador de colágeno", "Protocolo de microagulhamento", "Harmonização facial completa", "Peeling para melasma"];
  const valores: Record<string, number> = {
    "Toxina botulínica": 120000, "Preenchimento labial": 180000, "Bioestimulador de colágeno": 750000,
    "Protocolo de microagulhamento": 240000, "Harmonização facial completa": 850000, "Peeling para melasma": 180000,
  };
  const motivosPerda = ["price", "price", "no_response", "requested_by_customer", "other"];
  const linhasLeads: string[] = [];
  const leadsBase = [
    ...prospects.map((_, i) => ({ contato: PROSP[i]!, nome: prospects[i]!.nome, novo: true })),
    ...pacientes.slice(0, 22).map((_, i) => ({ contato: PAC[i * 7 % 180]!, nome: pacientes[i * 7 % 180]!.nome, novo: false })),
  ];
  leadsBase.forEach((l, i) => {
    const etapa = l.novo ? r.um([0, 0, 1, 1, 2, 3, 3, 4, 5, 6]) : r.um([3, 3, 4, 5, 5, 6]);
    const e = ETAPAS[etapa]!;
    const interesse = r.um(interesses);
    const criado = new Date(agora.getTime() - r.inteiro(1, 35) * 24 * 60 * MIN);
    const status = e.ganho ? "won" : e.perdido ? "lost" : "open";
    const fechado = status === "open" ? null : new Date(criado.getTime() + r.inteiro(1, 10) * 24 * 60 * MIN);
    const dono = r.chance(0.7) ? user("recepcao") : user("ana");
    linhasLeads.push(
      `(${q(id(18, 100 + i))}, ${O}, ${q(FUNIL)}, ${q(etapaId(etapa))}, ${q(l.contato)}, ${q(`${l.nome.split(" ")[0]} — ${interesse}`)},
        ${q(status)}, ${status === "lost" ? q(r.um(motivosPerda)) : "null"}, ${i}, ${valores[interesse]!}, 'BRL', ${q(dono)}, 'user',
        ${q(l.novo ? r.um(["instagram", "google", "indicacao", "whatsapp"]) : "paciente")},
        ${fechado ? ts(fechado) : "null"}, ${status === "open" ? q(dataISO(new Date(agora.getTime() + r.inteiro(3, 30) * 24 * 60 * MIN))) : "null"},
        ${ts(criado)}, ${ts(new Date(Math.min((fechado ?? new Date(criado.getTime() + r.inteiro(0, 3) * 24 * 60 * MIN)).getTime(), agora.getTime() - 60 * MIN)))}, ${q(user("recepcao"))})`,
    );
  });

  const tarefas: { titulo: string; quem: string; prioridade: string; dias: number; contato?: string }[] = [
    { titulo: "Repor luvas nitrílicas M — estoque abaixo do ponto de pedido", quem: "compras", prioridade: "high", dias: 1 },
    { titulo: "Cotar toxina botulínica com dois fornecedores", quem: "compras", prioridade: "medium", dias: 4 },
    { titulo: "Conferir validade do lote AH-23988 e usar primeiro", quem: "compras", prioridade: "high", dias: 2 },
    { titulo: "Enviar orçamento de bioestimulador", quem: "recepcao", prioridade: "medium", dias: 1, contato: PAC[3] },
    { titulo: "Confirmar a agenda de amanhã por WhatsApp", quem: "recepcao", prioridade: "high", dias: 0 },
    { titulo: "Ligar para pacientes que faltaram na semana", quem: "recepcao", prioridade: "medium", dias: 2 },
    { titulo: "Revisar o termo de uso de imagem com o jurídico", quem: "dono", prioridade: "low", dias: 10 },
    { titulo: "Fechar a escala de dezembro", quem: "dono", prioridade: "medium", dias: 14 },
    { titulo: "Revisar protocolo de bioestimulador (POP)", quem: "ana", prioridade: "medium", dias: 7 },
    { titulo: "Remarcar pacientes do dia do congresso", quem: "recepcao", prioridade: "high", dias: 5 },
    { titulo: "Manutenção preventiva da autoclave", quem: "compras", prioridade: "medium", dias: 9 },
    { titulo: "Pós-venda: mensagem 7 dias após preenchimento", quem: "recepcao", prioridade: "low", dias: 3, contato: PAC[10] },
    { titulo: "Organizar fotos de antes e depois autorizadas", quem: "carla", prioridade: "low", dias: 12 },
    { titulo: "Treinamento da equipe sobre o novo menu do sistema", quem: "dono", prioridade: "low", dias: 6 },
    { titulo: "Retorno de 15 dias — agendar", quem: "recepcao", prioridade: "medium", dias: -3, contato: PAC[5] },
    { titulo: "Pagar boleto da lavanderia", quem: "dono", prioridade: "medium", dias: -6 },
    { titulo: "Inventário semanal do estoque central", quem: "compras", prioridade: "medium", dias: -5 },
    { titulo: "Responder avaliações do Google", quem: "recepcao", prioridade: "low", dias: -2 },
    { titulo: "Conferir comissões da 1ª quinzena", quem: "dono", prioridade: "high", dias: -9 },
    { titulo: "Atualizar preços da tabela de serviços", quem: "dono", prioridade: "medium", dias: -15 },
  ];
  const linhasTarefas = tarefas.map((t) => {
    const prazo = instante(diaLocal(agora, t.dias), 18 * 60);
    const passou = t.dias < 0;
    return `(${O}, ${q(t.titulo)}, ${ts(prazo)}, ${q(t.prioridade)}, ${q(passou ? (r.chance(0.85) ? "done" : "pending") : r.chance(0.2) ? "in_progress" : "pending")},
      ${t.contato ? q(t.contato) : "null"}, ${q(user(t.quem))}, ${q(user(t.quem === "compras" ? "dono" : "recepcao"))}, ${ts(new Date(prazo.getTime() - r.inteiro(2, 10) * 24 * 60 * MIN))})`;
  });

  passos.push({
    titulo: "CRM: funil da clínica, oportunidades e tarefas",
    ator: "superuser",
    sql: `
      update public.crm_pipelines set is_default = false where organization_id = ${O};
      insert into public.crm_pipelines (id, organization_id, name, slug, description, is_default, position, created_at)
      values (${q(FUNIL)}, ${O}, 'Jornada do paciente', 'jornada-paciente', 'Do primeiro contato ao procedimento fechado.', true, 0, ${ts(inicioDaClinica)});
      insert into public.crm_stages (id, organization_id, pipeline_id, name, slug, position, color, is_won, is_lost) values
      ${ETAPAS.map((e, i) => `(${q(etapaId(i))}, ${O}, ${q(FUNIL)}, ${q(e.nome)}, ${q(e.slug)}, ${(i + 1) * 1000}, ${q(e.cor)}, ${e.ganho ? "true" : "false"}, ${e.perdido ? "true" : "false"})`).join(",\n      ")};
      insert into public.crm_leads (id, organization_id, pipeline_id, stage_id, contact_id, title, status, lost_reason, position_in_stage,
        value_cents, currency, owner_user_id, owner_kind, source, closed_at, expected_close_date, created_at, updated_at, created_by_user_id) values
      ${linhasLeads.join(",\n      ")};
      insert into public.crm_tasks (organization_id, title, due_date, priority, status, contact_id, assigned_to, created_by, created_at) values
      ${linhasTarefas.join(",\n      ")};
    `,
  });

  const ultimoComAlvo = passos.map((x) => !!x.alvo).lastIndexOf(true);
  const ordenados = [
    ...passos.filter((x, i) => !x.alvo && i < ultimoComAlvo),
    ...passos.filter((x) => x.alvo).sort((a, b) => a.alvo!.getTime() - b.alvo!.getTime()),
    ...passos.filter((x, i) => !x.alvo && i > ultimoComAlvo),
  ];

  const resumo = {
    pacientes: pacientes.length,
    contatos_em_prospeccao: prospects.length,
    agendamentos: agenda.length,
    ...contagem,
    planos_de_tratamento: planos,
    pacientes_com_alergia: comAlergia.size,
    oportunidades: linhasLeads.length,
    tarefas: linhasTarefas.length,
    despesas: linhasDespesa.length,
    dias_de_caixa: diasDeCaixa,
    caixas_conferidos_com_diferenca: conferencias,
  };
  return { passos: ordenados, resumo };
}

/**
 * Desloca para o instante simulado os carimbos gerados durante a simulação.
 * `seed_sim.marcas` guarda, para cada passo, o `now()` da transação e o alvo;
 * todo carimbo entre o início de um passo e o início do seguinte foi gerado
 * por ele. Colunas de horário AGENDADO (início/fim, prazos, validades) ficam
 * como estão. Tabelas particionadas (logs) ficam de fora.
 */
export const RECARIMBAR_SQL = `
do $sim$
declare
  v_ini timestamptz;
  v_fim timestamptz;
  c record;
begin
  select min(tx_ts), max(prox_ts) into v_ini, v_fim from seed_sim.marcas;

  -- DATAS que o financeiro calcula a partir de "hoje" (venda, vencimento,
  -- competência): andam os mesmos dias que o passo, achado pelo created_at da
  -- linha (antes de ele próprio ser recarimbado, logo abaixo)
  for c in
    select * from (values
      ('financial_entries', 'entry_date'), ('financial_entries', 'competence_date'), ('financial_entries', 'due_date'),
      ('clinic_fin_pagamentos', 'data_venda'), ('clinic_fin_parcelas', 'vencimento')) as x(relname, attname)
  loop
    execute format(
      'update public.%I t set %I = t.%I + (((m.tx_ts + m.desloc) at time zone ''America/Sao_Paulo'')::date
                                          - (m.tx_ts at time zone ''America/Sao_Paulo'')::date)
         from seed_sim.marcas m
        where t.%I is not null and t.created_at >= $1 and t.created_at < $2
          and t.created_at >= m.tx_ts and t.created_at < m.prox_ts and m.desloc is not null',
      c.relname, c.attname, c.attname, c.attname)
    using v_ini, v_fim;
  end loop;

  for c in
    select n.nspname, k.relname, a.attname
      from pg_attribute a
      join pg_class k on k.oid = a.attrelid
      join pg_namespace n on n.oid = k.relnamespace
     where n.nspname = 'public' and k.relkind = 'r' and not k.relispartition
       and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
       and a.atttypid = 'timestamptz'::regtype
       and a.attname !~ '^(starts_at|ends_at)$|due|expected|validade|expira|expires|vence|prazo|inicio|fim_previsto|until|next_'
  loop
    execute format(
      'update %I.%I t set %I = t.%I + m.desloc
         from seed_sim.marcas m
        where t.%I >= $1 and t.%I < $2
          and t.%I >= m.tx_ts and t.%I < m.prox_ts and m.desloc is not null',
      c.nspname, c.relname, c.attname, c.attname, c.attname, c.attname, c.attname, c.attname)
    using v_ini, v_fim;
  end loop;

end
$sim$;
`;
