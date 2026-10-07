/**
 * FORK clinic (migration 9014) — o menu organizado por MÓDULOS DA CLÍNICA.
 *
 * É uma segunda PROJEÇÃO do mesmo catálogo (`lib/navigation/catalogo.ts`), não
 * uma segunda lista de telas: aqui só se diz em que módulo e em que seção cada
 * porta que já existe aparece. Quem decide se a porta aparece para alguém
 * continua sendo `destinosDaInterface` — `minRole`, `permissao`, `modulo` e a
 * interface escolhida pela organização. Nenhuma porta ganha ou perde acesso por
 * morar num módulo.
 *
 * `lib/clinic/navegacao/modulos.test.ts` reprova se uma porta do catálogo
 * ficar sem módulo, aparecer em dois, ou se um módulo citar porta que não existe.
 *
 * Ordem (organização pedida pela clínica em 2026-10, a partir de um painel de
 * referência): Início, Notificações, Agenda, Atendimento, Pacientes, Contratos e
 * termos (com a LGPD), Procedimentos, Estoque, Salas e equipamentos,
 * Profissionais, Ponto, Financeiro, Comissões, Notas fiscais e Tarefas; depois,
 * separados, Marketing e Agente de IA (captação e automação são ajuste do
 * gestor, não o dia da recepção); no rodapé, Perfil e acesso e Configurações.
 * Notificações, Ponto e Notas fiscais são "Em breve": aparecem só no Início.
 *
 * Os antigos "Canais" e "Análise" deixam de ser módulos: conexões são
 * configuração, e cada indicador mora no módulo do assunto dele (agenda na
 * Agenda, faturamento no Financeiro, desempenho no Atendimento).
 */
import type { NavDestinationId } from "@/lib/navigation/catalogo";

export type ModuloClinicaId =
  | "inicio"
  | "notificacoes"
  | "agenda"
  | "atendimento"
  | "pacientes"
  | "contratos"
  | "procedimentos"
  | "estoque"
  | "equipamentos"
  | "profissionais"
  | "ponto"
  | "financeiro"
  | "comissoes"
  | "notas-fiscais"
  | "tarefas"
  | "marketing"
  | "agente-de-ia"
  | "perfil-e-acesso"
  | "configuracoes";

/** Nome de um ícone de `lib/ui/icons.ts` — resolvido em `icones.ts`. */
export type IconeDoModulo =
  | "House"
  | "CalendarBlank"
  | "ChatsCircle"
  | "IdentificationCard"
  | "FileText"
  | "ShieldCheck"
  | "Sparkle"
  | "Wrench"
  | "Archive"
  | "UsersThree"
  | "CurrencyCircleDollar"
  | "Percent"
  | "Receipt"
  | "ListChecks"
  | "Megaphone"
  | "Robot"
  | "UserCircle"
  | "Gear"
  | "Bell"
  | "Clock";

/** Funcionalidade anunciada e ainda não construída. Não é rota: não abre nada. */
export interface EmBreve {
  label: string;
  description: string;
}

export interface PortaDoModulo {
  href: NavDestinationId;
  /** Agrupa as telas no painel do módulo. */
  secao: string;
}

export interface ModuloClinica {
  /** Também é o segmento da URL do painel do módulo: `/app/inicio/<id>`. */
  id: ModuloClinicaId;
  label: string;
  description: string;
  /**
   * Uma linha, para o cartão do Início (estoque/organização, 2026-10): o que a
   * pessoa encontra ali, em poucas palavras. A `description` continua no painel.
   */
  resumo: string;
  icon: IconeDoModulo;
  /**
   * Começa um bloco separado no menu (captação e automação, que são ajuste do
   * gestor e não o dia da clínica).
   */
  separarAntes?: boolean;
  /** Fica no rodapé fixo do menu, fora da área que rola. */
  rodape?: boolean;
  /** Telas existentes, na ordem em que aparecem. Vazio = módulo "Em breve". */
  portas: readonly PortaDoModulo[];
  emBreve?: readonly EmBreve[];
}

export const MODULOS_CLINICA: readonly ModuloClinica[] = [
  {
    id: "inicio",
    label: "Início",
    description: "Todos os módulos da clínica num lugar só, com o resumo do dia.",
    resumo: "Módulos e o resumo do dia.",
    icon: "House",
    portas: [{ href: "/app/inicio", secao: "Início" }],
  },
  {
    id: "notificacoes",
    label: "Notificações",
    description: "Avisos da agenda, do estoque, das pendências e do agente num lugar só.",
    resumo: "Todos os avisos num lugar só.",
    icon: "Bell",
    portas: [],
    emBreve: [{ label: "Central de notificações", description: "Avisos da clínica reunidos, com lido e não lido." }],
  },
  {
    id: "agenda",
    label: "Agenda",
    description: "Horários, chegada dos pacientes, faltas e a ocupação de cada profissional.",
    resumo: "Atendimentos e status do dia.",
    icon: "CalendarBlank",
    portas: [
      { href: "/app/agenda", secao: "O dia da agenda" },
      { href: "/app/recepcao", secao: "O dia da agenda" },
      { href: "/app/agenda/profissionais", secao: "O dia da agenda" },
      { href: "/app/agenda/faltas", secao: "O dia da agenda" },
      { href: "/app/agenda/indicadores", secao: "Indicadores" },
      { href: "/app/settings/tenant/agenda", secao: "Ajustes da agenda" },
    ],
  },
  {
    id: "atendimento",
    label: "Atendimento",
    description: "Conversas com pacientes pelo WhatsApp e telefone, com a IA ao lado.",
    resumo: "Conversas pelo WhatsApp e telefone.",
    icon: "ChatsCircle",
    portas: [
      { href: "/app/inbox", secao: "Conversas" },
      { href: "/app/radar", secao: "Conversas" },
      { href: "/app/templates", secao: "Conversas" },
      { href: "/app/calls", secao: "Conversas" },
      { href: "/app/metrics", secao: "Indicadores" },
    ],
  },
  {
    id: "pacientes",
    label: "Pacientes",
    description: "Cadastro, ficha e a jornada de cada paciente, do primeiro contato ao retorno.",
    resumo: "Cadastro, ficha e prontuário.",
    icon: "IdentificationCard",
    portas: [
      { href: "/app/contacts", secao: "Cadastro" },
      // Prontuário (9016–9027): a fila do profissional; o prontuário, as fotos e os
      // termos moram como abas no detalhe do paciente.
      { href: "/app/atendimentos", secao: "Prontuário" },
      { href: "/app/kanban", secao: "Jornada do paciente" },
      { href: "/app/settings/tenant/pipelines", secao: "Jornada do paciente" },
    ],
  },
  {
    // Contratos, termos e LGPD juntos (2026-10): o aceite do termo e o pedido do
    // titular são a mesma conversa com o paciente sobre os dados dele. O antigo
    // painel `/app/inicio/lgpd` continua abrindo (ver `ALIASES`).
    id: "contratos",
    label: "Contratos e termos",
    description: "Modelos de contrato e termo, aceites dos pacientes e os pedidos da LGPD.",
    resumo: "Termos, aceites e LGPD.",
    icon: "FileText",
    portas: [
      { href: "/app/settings/tenant/modelos-clinicos", secao: "Modelos de termo e de prontuário" },
      { href: "/app/lgpd/requests", secao: "LGPD" },
    ],
    emBreve: [
      { label: "Contratos de pacote", description: "Contrato de pacote de sessões com saldo por paciente." },
    ],
  },
  {
    id: "procedimentos",
    label: "Procedimentos",
    description: "O que a clínica realiza, quem pode realizar e o POP de cada procedimento.",
    resumo: "Catálogo, kit e POP.",
    icon: "Sparkle",
    portas: [{ href: "/app/procedimentos", secao: "Catálogo" }],
    emBreve: [
      { label: "Protocolos", description: "Sessões, intervalos e cuidados de cada tratamento." },
      { label: "Pacotes", description: "Sessões vendidas juntas, com saldo por paciente." },
    ],
  },
  {
    id: "estoque",
    label: "Estoque",
    description: "Produtos e insumos por lote, validade e local, com cada entrada e saída registrada.",
    resumo: "Lotes, validade e compras.",
    icon: "Archive",
    portas: [{ href: "/app/estoque", secao: "Posição do estoque" }],
    emBreve: [],
  },
  {
    id: "equipamentos",
    label: "Salas e equipamentos",
    description: "As salas e os aparelhos da clínica, e o que cada tipo de atendimento exige.",
    resumo: "Salas e aparelhos.",
    icon: "Wrench",
    portas: [{ href: "/app/equipamentos", secao: "Salas e equipamentos" }],
    emBreve: [{ label: "Manutenções", description: "Revisões e calibrações com aviso de vencimento." }],
  },
  {
    id: "profissionais",
    label: "Profissionais",
    description: "Quem atende, com especialidades, bloqueios e salas.",
    resumo: "Equipe, especialidades e bloqueios.",
    icon: "UsersThree",
    portas: [{ href: "/app/settings/tenant/profissionais", secao: "Equipe clínica" }],
    emBreve: [{ label: "Escalas", description: "Turnos e folgas de cada profissional." }],
  },
  {
    id: "ponto",
    label: "Ponto",
    description: "Entrada e saída da equipe, com as marcações do dia.",
    resumo: "Marcações do dia.",
    icon: "Clock",
    portas: [],
    emBreve: [{ label: "Registro de ponto", description: "Entrada, intervalo e saída de cada pessoa da equipe." }],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    description: "Comandas, recebimentos e o faturamento da clínica.",
    resumo: "Comandas e faturamento.",
    icon: "CurrencyCircleDollar",
    portas: [
      { href: "/app/comandas", secao: "O dia do caixa" },
      { href: "/app/products", secao: "Catálogo" },
      { href: "/app/faturamento", secao: "Indicadores" },
      { href: "/app/settings/tenant/financeiro", secao: "Ajustes do financeiro" },
      { href: "/app/settings/tenant/maquininhas", secao: "Ajustes do financeiro" },
    ],
    emBreve: [{ label: "Contas a pagar e a receber", description: "Vencimentos, baixas e fluxo de caixa." }],
  },
  {
    id: "comissoes",
    label: "Comissões",
    description: "Quanto cada profissional recebe por atendimento e venda.",
    resumo: "Regras e repasses.",
    icon: "Percent",
    portas: [{ href: "/app/comissoes", secao: "Comissões" }],
  },
  {
    id: "notas-fiscais",
    label: "Notas fiscais",
    description: "Emissão de nota de serviço a partir do atendimento pago.",
    resumo: "Emissão de nota de serviço.",
    icon: "Receipt",
    portas: [],
    emBreve: [{ label: "Emissão de NFS-e", description: "Nota de serviço emitida pela prefeitura, sem redigitar." }],
  },
  {
    id: "tarefas",
    label: "Tarefas",
    description: "O que precisa ser feito, por quem e até quando.",
    resumo: "O que fazer e até quando.",
    icon: "ListChecks",
    portas: [
      { href: "/app/tasks", secao: "Tarefas" },
      { href: "/app/activities", secao: "Histórico" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    description: "Campanhas, anúncios e a busca de novos pacientes.",
    resumo: "Campanhas e anúncios.",
    icon: "Megaphone",
    separarAntes: true,
    portas: [
      { href: "/app/campaigns", secao: "Campanhas" },
      { href: "/app/prospecting", secao: "Campanhas" },
      { href: "/app/ads/meta", secao: "Anúncios" },
      { href: "/app/settings/meta-ads", secao: "Anúncios" },
      { href: "/app/settings/conversoes", secao: "Anúncios" },
    ],
  },
  {
    id: "agente-de-ia",
    label: "Agente de IA",
    description: "O assistente que atende, agenda e faz follow-up pelos pacientes.",
    resumo: "O assistente que atende e agenda.",
    icon: "Robot",
    portas: [
      { href: "/app/ai/agents", secao: "Montar o agente" },
      { href: "/app/ai/followups", secao: "Montar o agente" },
      { href: "/app/ai/routers", secao: "Montar o agente" },
      { href: "/app/ai/credentials", secao: "Montar o agente" },
      { href: "/app/ai/providers", secao: "Montar o agente" },
      { href: "/app/ai/knowledge/sources", secao: "Ensinar o agente" },
      { href: "/app/ai/memory", secao: "Ensinar o agente" },
      { href: "/app/ai/skills", secao: "Ensinar o agente" },
      { href: "/app/ai/cases", secao: "Acompanhar o agente" },
      { href: "/app/ai/inbox", secao: "Acompanhar o agente" },
      { href: "/app/ai/cases/avisos", secao: "Acompanhar o agente" },
      { href: "/app/ai/proposals", secao: "Acompanhar o agente" },
      { href: "/app/ai/runs", secao: "Acompanhar o agente" },
      { href: "/app/ai/usage", secao: "Acompanhar o agente" },
      { href: "/app/ai/evolution", secao: "Acompanhar o agente" },
    ],
  },
  {
    id: "perfil-e-acesso",
    label: "Perfil e acesso",
    description: "Sua conta, a equipe, os papéis de acesso e o registro de quem fez o quê.",
    resumo: "Permissões e usuários.",
    icon: "UserCircle",
    rodape: true,
    portas: [
      { href: "/app/settings/profile", secao: "Sua conta" },
      { href: "/app/settings/security", secao: "Sua conta" },
      { href: "/app/settings/notifications", secao: "Sua conta" },
      { href: "/app/team", secao: "Equipe e acesso" },
      { href: "/app/settings/tenant/papeis", secao: "Equipe e acesso" },
      { href: "/app/audit", secao: "Equipe e acesso" },
    ],
  },
  {
    id: "configuracoes",
    label: "Configurações",
    description: "Dados da clínica, canais de atendimento, marca e integrações.",
    resumo: "Clínica, canais e marca.",
    icon: "Gear",
    rodape: true,
    portas: [
      { href: "/app/settings/tenant", secao: "Sua clínica" },
      { href: "/app/settings/atendimento", secao: "Sua clínica" },
      { href: "/app/settings/tags", secao: "Sua clínica" },
      { href: "/app/settings/marca", secao: "Sua clínica" },
      { href: "/app/settings/billing", secao: "Sua clínica" },
      { href: "/app/connections", secao: "Canais" },
      { href: "/app/webhooks", secao: "Canais" },
      { href: "/app/integrations/nuvemshop", secao: "Canais" },
      { href: "/app/settings/voip-trunk", secao: "Canais" },
      { href: "/app/settings/api-tokens", secao: "Dados e integrações" },
      { href: "/app/integracao-dados", secao: "Dados e integrações" },
      { href: "/app/extensions", secao: "Dados e integrações" },
    ],
  },
];

/**
 * Painéis antigos que foram juntados a outro módulo. O link salvo continua
 * abrindo — no módulo novo — em vez de virar 404 (expand/contract).
 */
const ALIASES: Readonly<Record<string, ModuloClinicaId>> = { lgpd: "contratos" };

/** Módulo sem nenhuma tela construída — aparece com o selo "Em breve". */
export function ehEmBreve(m: ModuloClinica): boolean {
  return m.portas.length === 0;
}

export function moduloPorId(id: string): ModuloClinica | undefined {
  const real = ALIASES[id] ?? id;
  return MODULOS_CLINICA.find((m) => m.id === real);
}

/**
 * Para onde o módulo leva quem clica nele (menu e cartões do Início): a
 * PRIMEIRA tela que a pessoa vê nele — as outras ficam nas abas do módulo, no
 * topo da tela. Sem tela visível, o painel do módulo.
 */
export function destinoDoModulo(m: { modulo: ModuloClinica; itens: ReadonlyArray<{ href: string }> }): string {
  return m.itens[0]?.href ?? hrefDoPainel(m.modulo);
}

const MODULO_DA_PORTA = new Map<string, ModuloClinica>(
  MODULOS_CLINICA.flatMap((m) => m.portas.map((p) => [p.href, m] as const)),
);

/** O módulo a que uma porta do catálogo pertence. */
export function moduloDaPorta(href: string): ModuloClinica | undefined {
  return MODULO_DA_PORTA.get(href);
}

/**
 * O módulo da tela aberta: a porta mais específica que casa com o caminho, ou o
 * painel do próprio módulo (`/app/inicio/<id>`).
 */
export function moduloDoCaminho(pathname: string): ModuloClinica | undefined {
  const painel = /^\/app\/inicio\/([^/]+)/.exec(pathname);
  if (painel) return moduloPorId(painel[1]!);
  let melhor: { href: string; modulo: ModuloClinica } | undefined;
  for (const [href, modulo] of MODULO_DA_PORTA) {
    if (pathname !== href && !pathname.startsWith(href + "/")) continue;
    if (!melhor || href.length > melhor.href.length) melhor = { href, modulo };
  }
  return melhor?.modulo;
}

export function hrefDoPainel(m: ModuloClinica): string {
  return `/app/inicio/${m.id}`;
}
