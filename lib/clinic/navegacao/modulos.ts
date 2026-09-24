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
 * `tests/unit/clinic-menu-modulos.test.ts` reprova se uma porta do catálogo
 * ficar sem módulo, aparecer em dois, ou se um módulo citar porta que não existe.
 *
 * Ordem = a lista pedida pela clínica (Início, Agenda, Pacientes, Contratos,
 * LGPD, Procedimentos, Equipamentos, Profissionais, Financeiro, Comissões, Notas
 * fiscais, Tarefas, Perfil e acesso, Configurações) mais três módulos que
 * acomodam o que não é de nenhum deles:
 *
 *  - Atendimento (Inbox, Radar, Respostas rápidas...) logo depois da Agenda: é
 *    onde a recepção passa o dia; escondê-lo dentro de Pacientes custaria um
 *    clique a cada conversa.
 *  - Marketing (Campanhas, Prospecção, Meta Ads) e Agente de IA depois de
 *    Tarefas: captação e automação são ajuste do gestor, não o dia da recepção.
 *
 * Os antigos "Canais" e "Análise" deixam de ser módulos: conexões são
 * configuração, e cada indicador mora no módulo do assunto dele (agenda na
 * Agenda, faturamento no Financeiro, desempenho no Atendimento).
 */
import type { NavDestinationId } from "@/lib/navigation/catalogo";

export type ModuloClinicaId =
  | "inicio"
  | "agenda"
  | "atendimento"
  | "pacientes"
  | "contratos"
  | "lgpd"
  | "procedimentos"
  | "equipamentos"
  | "profissionais"
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
  | "UsersThree"
  | "CurrencyCircleDollar"
  | "Percent"
  | "Receipt"
  | "ListChecks"
  | "Megaphone"
  | "Robot"
  | "UserCircle"
  | "Gear";

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
  icon: IconeDoModulo;
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
    icon: "House",
    portas: [{ href: "/app/inicio", secao: "Início" }],
  },
  {
    id: "agenda",
    label: "Agenda",
    description: "Horários, chegada dos pacientes, faltas e a ocupação de cada profissional.",
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
    icon: "IdentificationCard",
    portas: [
      { href: "/app/contacts", secao: "Cadastro" },
      { href: "/app/kanban", secao: "Jornada do paciente" },
      { href: "/app/settings/tenant/pipelines", secao: "Jornada do paciente" },
    ],
    emBreve: [
      { label: "Prontuário", description: "Anamnese, evolução e assinatura do atendimento." },
      { label: "Fotos antes e depois", description: "Registro fotográfico por sessão, com consentimento." },
    ],
  },
  {
    id: "contratos",
    label: "Contratos",
    description: "Contratos e termos dos tratamentos, assinados pelo paciente.",
    icon: "FileText",
    portas: [],
    emBreve: [
      { label: "Contratos e termos", description: "Modelos de contrato por procedimento e pacote." },
      { label: "Assinatura digital", description: "O paciente assina pelo celular, com validade jurídica." },
    ],
  },
  {
    id: "lgpd",
    label: "LGPD",
    description: "Pedidos dos titulares sobre os próprios dados, com prazo e histórico.",
    icon: "ShieldCheck",
    portas: [{ href: "/app/lgpd/requests", secao: "Pedidos dos titulares" }],
    emBreve: [
      { label: "Consentimentos", description: "Termos de uso de imagem e de dados aceitos por paciente." },
    ],
  },
  {
    id: "procedimentos",
    label: "Procedimentos",
    description: "O que a clínica oferece, com preço e duração.",
    icon: "Sparkle",
    portas: [{ href: "/app/products", secao: "Catálogo" }],
    emBreve: [
      { label: "Protocolos", description: "Sessões, intervalos e cuidados de cada tratamento." },
      { label: "Pacotes", description: "Sessões vendidas juntas, com saldo por paciente." },
    ],
  },
  {
    id: "equipamentos",
    label: "Equipamentos",
    description: "Aparelhos da clínica, uso por procedimento e manutenção.",
    icon: "Wrench",
    portas: [],
    emBreve: [
      { label: "Equipamentos", description: "Cadastro dos aparelhos e de onde cada um está." },
      { label: "Manutenções", description: "Revisões e calibrações com aviso de vencimento." },
    ],
  },
  {
    id: "profissionais",
    label: "Profissionais",
    description: "Quem atende, com especialidades, bloqueios e salas.",
    icon: "UsersThree",
    portas: [{ href: "/app/settings/tenant/profissionais", secao: "Equipe clínica" }],
    emBreve: [{ label: "Escalas", description: "Turnos e folgas de cada profissional." }],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    description: "Comandas, recebimentos e o faturamento da clínica.",
    icon: "CurrencyCircleDollar",
    portas: [
      { href: "/app/comandas", secao: "O dia do caixa" },
      { href: "/app/faturamento", secao: "Indicadores" },
      { href: "/app/settings/tenant/financeiro", secao: "Ajustes do financeiro" },
    ],
    emBreve: [{ label: "Contas a pagar e a receber", description: "Vencimentos, baixas e fluxo de caixa." }],
  },
  {
    id: "comissoes",
    label: "Comissões",
    description: "Quanto cada profissional recebe por atendimento e venda.",
    icon: "Percent",
    portas: [],
    emBreve: [
      { label: "Regras de comissão", description: "Percentual ou valor fixo por procedimento e profissional." },
      { label: "Extrato", description: "O que cada profissional tem a receber no período." },
    ],
  },
  {
    id: "notas-fiscais",
    label: "Notas fiscais",
    description: "Emissão de nota de serviço a partir do atendimento pago.",
    icon: "Receipt",
    portas: [],
    emBreve: [{ label: "Emissão de NFS-e", description: "Nota de serviço emitida pela prefeitura, sem redigitar." }],
  },
  {
    id: "tarefas",
    label: "Tarefas",
    description: "O que precisa ser feito, por quem e até quando.",
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
    icon: "Megaphone",
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

/** Módulo sem nenhuma tela construída — aparece com o selo "Em breve". */
export function ehEmBreve(m: ModuloClinica): boolean {
  return m.portas.length === 0;
}

export function moduloPorId(id: string): ModuloClinica | undefined {
  return MODULOS_CLINICA.find((m) => m.id === id);
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
