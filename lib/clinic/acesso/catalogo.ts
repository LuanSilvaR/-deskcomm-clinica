/**
 * FORK clinic (ACL-001) — o CATÁLOGO de permissões. Fonte única.
 *
 * O cliente cria PAPÉIS; as PERMISSÕES são do software: só existe o que está
 * aqui (e no espelho `clinic_permissions`, semeado pela migration 9009 — um
 * invariante reprova divergência). Chave `modulo.acao`, em pt-BR.
 *
 * `nivelBase` é o nível LEGADO (viewer < agent < manager < admin) que as rotas
 * e a RLS do núcleo exigem hoje para essa capacidade — medido por método em
 * `app/api/v1/**` em 2026-09-24. O nível legado de um membro passa a ser o
 * maior `nivelBase` das permissões efetivas dele (migração em camadas: a RLS
 * grossa do upstream continua valendo; ver o plano ACL).
 *
 * `dependeDe`: sem elas a permissão não faz sentido (editar exige ver). A tela
 * marca as dependências junto e diz por quê; o banco recusa papel incoerente.
 *
 * `critica`: o papel de sistema Administrador não pode perdê-las (antitravamento).
 *
 * Não existem ainda (e por isso não estão aqui): estoque, procedimentos,
 * unidades. Entram quando os módulos existirem.
 */
import type { Role } from "@/lib/auth/types";

export type NivelBase = Exclude<Role, "ai_operator">;

export interface DefinicaoDePermissao {
  modulo: string;
  acao: string;
  nivelBase: NivelBase;
  dependeDe?: readonly string[];
  critica?: boolean;
  descricao: string;
}

/** Os módulos, na ordem em que a matriz os mostra, com o rótulo da tela. */
export const MODULOS_DE_PERMISSAO = {
  agenda: "Agenda",
  recepcao: "Recepção",
  pacientes: "Pacientes",
  conversas: "Conversas",
  crm: "Funis e negócios",
  tarefas: "Tarefas",
  campanhas: "Campanhas e automações",
  ia: "Agentes de IA",
  canais: "Canais (WhatsApp)",
  financeiro: "Financeiro",
  produtos: "Produtos",
  profissionais: "Profissionais, especialidades e salas",
  relatorios: "Relatórios e indicadores",
  equipe: "Equipe",
  papeis: "Papéis de acesso",
  configuracoes: "Configurações",
  lgpd: "LGPD",
  auditoria: "Auditoria",
  extensoes: "Extensões",
} as const;

export type ModuloDePermissao = keyof typeof MODULOS_DE_PERMISSAO;

const p = (
  modulo: ModuloDePermissao,
  acao: string,
  nivelBase: NivelBase,
  descricao: string,
  extra: { dependeDe?: string[]; critica?: boolean } = {},
): [string, DefinicaoDePermissao] => [`${modulo}.${acao}`, { modulo, acao, nivelBase, descricao, ...extra }];

const ver = (m: ModuloDePermissao) => [`${m}.ver`];

export const CATALOGO_DE_PERMISSOES = Object.fromEntries([
  p("agenda", "ver", "viewer", "Ver a agenda, os horários livres e os compromissos"),
  p("agenda", "marcar", "agent", "Marcar compromisso", { dependeDe: ver("agenda") }),
  p("agenda", "remarcar", "agent", "Remarcar compromisso", { dependeDe: ver("agenda") }),
  p("agenda", "cancelar", "agent", "Cancelar compromisso", { dependeDe: ver("agenda") }),
  p("agenda", "registrar_desfecho", "agent", "Registrar \"Compareceu\" ou \"Faltou\"", { dependeDe: ver("agenda") }),
  p("agenda", "bloquear_horario", "agent", "Bloquear horários e dias na agenda", { dependeDe: ver("agenda") }),
  p("agenda", "configurar", "manager", "Tipos de atendimento, lembretes e prazos da agenda", { dependeDe: ver("agenda") }),

  p("recepcao", "ver_painel", "viewer", "Ver o painel da recepção e o status das visitas"),
  p("recepcao", "mudar_status_visita", "agent", "Avançar o status da visita (chegou, pronto, em atendimento, finalizado)", {
    dependeDe: ["recepcao.ver_painel"],
  }),
  p("recepcao", "corrigir_status", "agent", "Voltar o status da visita (correção com motivo)", {
    dependeDe: ["recepcao.ver_painel", "recepcao.mudar_status_visita"],
  }),

  p("pacientes", "ver", "viewer", "Ver pacientes e o histórico"),
  p("pacientes", "criar", "agent", "Cadastrar paciente", { dependeDe: ver("pacientes") }),
  p("pacientes", "editar", "agent", "Editar paciente", { dependeDe: ver("pacientes") }),
  p("pacientes", "excluir", "agent", "Excluir paciente", { dependeDe: ver("pacientes") }),
  p("pacientes", "importar", "agent", "Importar pacientes de planilha", { dependeDe: ver("pacientes") }),
  p("pacientes", "mesclar", "manager", "Juntar cadastros duplicados", { dependeDe: ver("pacientes") }),
  p("pacientes", "ver_ficha", "viewer", "Ver a ficha cadastral (CPF, endereço, responsável)", { dependeDe: ver("pacientes") }),
  p("pacientes", "editar_ficha", "agent", "Preencher e alterar a ficha cadastral", { dependeDe: ["pacientes.ver", "pacientes.ver_ficha"] }),

  p("conversas", "ver", "viewer", "Ver as conversas"),
  p("conversas", "responder", "agent", "Responder e iniciar conversas", { dependeDe: ver("conversas") }),
  p("conversas", "transferir", "agent", "Assumir, transferir e liberar conversas", { dependeDe: ver("conversas") }),
  p("conversas", "encerrar", "agent", "Encerrar e adiar conversas", { dependeDe: ver("conversas") }),
  p("conversas", "notas", "agent", "Notas internas nas conversas", { dependeDe: ver("conversas") }),
  p("conversas", "respostas_rapidas", "agent", "Criar e editar respostas rápidas", { dependeDe: ver("conversas") }),

  p("crm", "ver", "viewer", "Ver funis e negócios"),
  p("crm", "criar", "agent", "Criar negócio", { dependeDe: ver("crm") }),
  p("crm", "editar", "agent", "Editar e mover negócio", { dependeDe: ver("crm") }),
  p("crm", "configurar_funis", "manager", "Criar e alterar funis e etapas", { dependeDe: ver("crm") }),

  p("tarefas", "ver", "viewer", "Ver tarefas"),
  p("tarefas", "gerenciar", "agent", "Criar, editar e concluir tarefas", { dependeDe: ver("tarefas") }),

  p("campanhas", "ver", "manager", "Ver campanhas e automações"),
  p("campanhas", "gerenciar", "manager", "Criar, enviar e pausar campanhas e automações", { dependeDe: ver("campanhas") }),

  p("ia", "ver", "agent", "Ver agentes de IA e o que fizeram"),
  p("ia", "configurar", "manager", "Configurar agentes, conhecimento e follow-ups", { dependeDe: ver("ia") }),
  p("ia", "administrar", "admin", "Credenciais, publicação e orçamento de IA", { dependeDe: ["ia.ver", "ia.configurar"] }),

  p("canais", "gerenciar", "admin", "Conectar e configurar o WhatsApp e outros canais"),

  p("financeiro", "ver", "viewer", "Ver lançamentos, comandas e fidelidade"),
  p("financeiro", "lancar", "agent", "Abrir comanda, lançar itens e finalizar", { dependeDe: ver("financeiro") }),
  p("financeiro", "estornar", "manager", "Estornar comanda e excluir lançamento", { dependeDe: ver("financeiro") }),
  p("financeiro", "configurar", "manager", "Catálogo financeiro e regras", { dependeDe: ver("financeiro") }),

  p("produtos", "ver", "viewer", "Ver produtos"),
  p("produtos", "gerenciar", "manager", "Cadastrar, importar e alterar produtos", { dependeDe: ver("produtos") }),

  p("profissionais", "ver", "viewer", "Ver profissionais, especialidades e salas"),
  p("profissionais", "gerenciar", "manager", "Cadastrar profissionais, especialidades, salas e exigências", {
    dependeDe: ver("profissionais"),
  }),

  p("relatorios", "ver", "agent", "Ver desempenho e faltas"),
  p("relatorios", "gerencial", "manager", "Ver indicadores gerenciais da agenda", { dependeDe: ver("relatorios") }),

  p("equipe", "ver", "manager", "Ver a equipe e os convites", { critica: true }),
  p("equipe", "convidar", "admin", "Convidar e reenviar convites", { dependeDe: ver("equipe") }),
  p("equipe", "revogar", "admin", "Revogar e reativar acesso de membros", { dependeDe: ver("equipe") }),
  p("equipe", "atribuir_papeis", "admin", "Dar e tirar papéis de acesso dos membros", {
    dependeDe: ["equipe.ver", "papeis.ver"],
    critica: true,
  }),

  p("papeis", "ver", "admin", "Ver os papéis de acesso e as permissões", { critica: true }),
  p("papeis", "gerenciar", "admin", "Criar, editar, duplicar, desativar e excluir papéis", { dependeDe: ["papeis.ver"], critica: true }),

  p("configuracoes", "ver", "manager", "Ver as configurações da empresa"),
  p("configuracoes", "gerenciar", "manager", "Alterar configurações da empresa (roteamento, campanhas, marca)", {
    dependeDe: ver("configuracoes"),
  }),
  p("configuracoes", "opcoes_da_clinica", "admin", "Ligar e desligar as opções da clínica", { dependeDe: ver("configuracoes") }),
  p("configuracoes", "tokens_e_integracoes", "admin", "Tokens de API, webhooks e integrações", { dependeDe: ver("configuracoes") }),

  p("lgpd", "ver", "admin", "Ver pedidos LGPD"),
  p("lgpd", "tratar", "admin", "Aprovar pedidos e anonimizar titulares", { dependeDe: ver("lgpd") }),

  p("auditoria", "ver", "manager", "Ver o registro de auditoria"),

  p("extensoes", "ver", "viewer", "Ver extensões disponíveis"),
  p("extensoes", "ativar", "admin", "Ativar, configurar e desativar extensões", { dependeDe: ver("extensoes") }),
]) as Readonly<Record<string, DefinicaoDePermissao>>;

export type ChaveDePermissao = keyof typeof CATALOGO_DE_PERMISSOES & string;

export const CHAVES_DE_PERMISSAO: readonly string[] = Object.keys(CATALOGO_DE_PERMISSOES);

export function ehPermissao(chave: unknown): chave is ChaveDePermissao {
  return typeof chave === "string" && Object.prototype.hasOwnProperty.call(CATALOGO_DE_PERMISSOES, chave);
}

const RANK: Record<NivelBase, number> = { viewer: 1, agent: 2, manager: 3, admin: 4 };

/** As chaves que o nível legado já dava (o conteúdo dos papéis-modelo). */
export function permissoesDoNivel(nivel: NivelBase): string[] {
  return CHAVES_DE_PERMISSAO.filter((k) => RANK[CATALOGO_DE_PERMISSOES[k]!.nivelBase] <= RANK[nivel]);
}

/** O nível legado derivado: o maior `nivelBase` entre as permissões (viewer se nenhuma). */
export function nivelDerivado(chaves: Iterable<string>): NivelBase {
  let nivel: NivelBase = "viewer";
  for (const k of chaves) {
    const d = CATALOGO_DE_PERMISSOES[k];
    if (d && RANK[d.nivelBase] > RANK[nivel]) nivel = d.nivelBase;
  }
  return nivel;
}

/** As dependências que faltam numa lista (a tela marca junto; o banco recusa). */
export function dependenciasFaltando(chaves: readonly string[]): string[] {
  const tem = new Set(chaves);
  const faltam = new Set<string>();
  for (const k of chaves) for (const d of CATALOGO_DE_PERMISSOES[k]?.dependeDe ?? []) if (!tem.has(d)) faltam.add(d);
  return [...faltam].sort();
}

/** Completa a lista com as dependências (transitivas). */
export function comDependencias(chaves: readonly string[]): string[] {
  const tem = new Set(chaves);
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const k of [...tem]) {
      for (const d of CATALOGO_DE_PERMISSOES[k]?.dependeDe ?? []) {
        if (!tem.has(d)) {
          tem.add(d);
          mudou = true;
        }
      }
    }
  }
  return [...tem].sort();
}

/** As permissões críticas que o papel Administrador nunca perde. */
export const PERMISSOES_CRITICAS: readonly string[] = CHAVES_DE_PERMISSAO.filter((k) => CATALOGO_DE_PERMISSOES[k]!.critica);

/** Os papéis-modelo provisionados em toda empresa (a migration 9011 usa a MESMA regra). */
export const PAPEIS_MODELO = [
  { systemKey: "administrador", nome: "Administrador", nivel: "admin", sistema: true },
  { systemKey: "gerente", nome: "Gerente", nivel: "manager", sistema: false },
  { systemKey: "atendente", nome: "Atendente", nivel: "agent", sistema: false },
  { systemKey: "visualizador", nome: "Visualizador", nivel: "viewer", sistema: false },
] as const satisfies readonly { systemKey: string; nome: string; nivel: NivelBase; sistema: boolean }[];
