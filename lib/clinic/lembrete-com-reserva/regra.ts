/**
 * Regra pura dos caminhos do lembrete com reserva (#83). Sem banco, sem rede.
 * Os módulos de envio importam daqui o que decidir, e só executam.
 */

export const MAX_TENTATIVAS_DO_LEMBRETE = 3;

export const PROVIDERS_DO_LEMBRETE = ["meta_cloud", "waha"] as const;
export type ProviderDoLembrete = (typeof PROVIDERS_DO_LEMBRETE)[number];

export interface CanalCandidato {
  id: string;
  provider: string | null;
  status: string;
  archived_at: string | null;
  metadata: { disabled?: boolean } | null;
  created_at: string;
}

/** Mesmo vocabulário do CHECK de `calendar_appointments.reminder_falha`. */
export type FalhaDoLembreteComReserva =
  | "sem_caminho"
  | "fora_do_horario"
  | "meta_sem_modelo"
  | "erro_apos_tentativas"
  | "envio_nao_confirmado";

export type Passo =
  | { tipo: "texto" }
  | { tipo: "modelo"; modeloId: string }
  | { tipo: "pular"; motivo: "fora_do_horario" | "meta_sem_modelo" };

export type DesfechoDoEnvio = "enviado" | "nao_saiu" | "ambiguo";

/**
 * Códigos de `messages.error_code` que GARANTEM que a plataforma nunca aceitou
 * a mensagem (por isso é seguro tentar o próximo caminho). Nada que possa
 * significar "estourou o tempo depois de enviar": `meta_error` / `waha_error`
 * (o handler grava isso para qualquer throw do adaptador, inclusive timeout)
 * ficam de fora e viram ambíguo.
 *
 * Fontes: app/api/v1/messages/_handler.ts (gravações síncronas) e
 * lib/channels/meta/status-update.ts (status `failed` do webhook da Meta).
 */
const RECUSAS_ANTES_DO_ENVIO = [
  "channel_archived", // canal excluído: nunca sai por ele (_handler.ts, ramo archived)
  "missing_phone_number", // contato sem telefone: nada foi chamado (_handler.ts, ramo !chatId)
  "pre_go_live", // modo de teste do canal bloqueou antes do adaptador (_handler.ts)
  "pre_go_live_indisponivel", // checagem do modo de teste falhou: bloqueia por segurança (_handler.ts)
  "storage_sign_failed", // falha do nosso Storage antes de tocar o adaptador (_handler.ts)
] as const;

export const CODIGOS_QUE_GARANTEM_NAO_ENTREGA: Record<ProviderDoLembrete, readonly string[]> = {
  meta_cloud: [
    ...RECUSAS_ANTES_DO_ENVIO,
    "131026", // Meta: mensagem não entregável (número sem WhatsApp, versão antiga, etc.)
    "131049", // Meta: limite de marketing por usuário, a Meta decidiu não entregar
    "131047", // Meta: janela de 24h expirada, texto livre recusado
    "132001", // Meta: modelo não existe neste idioma/nome
    "132015", // Meta: modelo pausado por baixa qualidade
    "132016", // Meta: modelo desativado
  ],
  // O adaptador WAHA só grava `waha_error` (ambíguo). Só valem as recusas do handler.
  waha: [...RECUSAS_ANTES_DO_ENVIO],
};

/** Meta primeiro, depois waha; dentro do provider, `created_at` crescente. */
export function ordenarCaminhos(canais: CanalCandidato[]): (CanalCandidato & { provider: ProviderDoLembrete })[] {
  const ranque = (p: ProviderDoLembrete) => PROVIDERS_DO_LEMBRETE.indexOf(p);
  const elegiveis = canais.filter(
    (c): c is CanalCandidato & { provider: ProviderDoLembrete } =>
      (PROVIDERS_DO_LEMBRETE as readonly (string | null)[]).includes(c.provider) &&
      c.status === "WORKING" &&
      c.archived_at === null &&
      c.metadata?.disabled !== true,
  );
  return [...elegiveis].sort(
    (a, b) => ranque(a.provider) - ranque(b.provider) || a.created_at.localeCompare(b.created_at),
  );
}

export function decidirPasso(i: {
  provider: ProviderDoLembrete;
  foraDoHorario: boolean;
  janelaAberta: boolean;
  modeloDoCanalId: string | null;
}): Passo {
  if (i.foraDoHorario) return { tipo: "pular", motivo: "fora_do_horario" };
  if (i.provider === "waha") return { tipo: "texto" };
  if (i.janelaAberta) return { tipo: "texto" };
  if (i.modeloDoCanalId) return { tipo: "modelo", modeloId: i.modeloDoCanalId };
  return { tipo: "pular", motivo: "meta_sem_modelo" };
}

/**
 * Recusa síncrona da Meta: o adaptador lança `meta_<code>: ...` SÓ quando a Graph
 * API respondeu (!res.ok ou body.error), ou seja, a Meta recusou e nunca aceitou
 * a mensagem (lib/channels/adapters/meta-cloud.ts:317-321). Erro de rede/timeout
 * lança outra coisa ("fetch failed"). O handler guarda isso em `error_message`.
 * Padrão exclusivo da Meta.
 */
const RECUSA_SINCRONA_DA_META = /^meta_(\d+):/;

/** Números de `meta_<n>:` que NÃO provam recusa: problema do lado da Meta, a mensagem pode ter sido aceita. */
const NUMEROS_DA_META_QUE_FICAM_AMBIGUOS = {
  codigosDaGraph: [
    1, // Graph: API Unknown, falha desconhecida do servidor
    2, // Graph: API Service, indisponibilidade temporária
    408, // HTTP 408: request timeout, a Meta pode ter aceitado
    131000, // Graph: "Something went wrong", falha genérica do lado da Meta
    131016, // Graph: serviço indisponível
    133004, // Graph: servidor temporariamente indisponível
  ],
  httpMin: 500, // HTTP 5xx (500-599): erro de servidor, não prova que não foi aceita
  httpMax: 599,
} as const;

function recusaSincronaDaMeta(erro: string | null | undefined): boolean {
  const achou = RECUSA_SINCRONA_DA_META.exec(erro ?? "");
  if (!achou) return false;
  const n = Number(achou[1]);
  const x = NUMEROS_DA_META_QUE_FICAM_AMBIGUOS;
  if ((x.codigosDaGraph as readonly number[]).includes(n)) return false;
  return !(n >= x.httpMin && n <= x.httpMax);
}

export function classificarEnvio(
  provider: ProviderDoLembrete,
  m: { status: string; error_code: string | null; error_message?: string | null } | { excecao: true },
): DesfechoDoEnvio {
  if ("excecao" in m) return "ambiguo";
  if (m.status === "sent" || m.status === "delivered" || m.status === "read") return "enviado";
  if (m.status === "failed" && m.error_code && CODIGOS_QUE_GARANTEM_NAO_ENTREGA[provider].includes(m.error_code)) {
    return "nao_saiu";
  }
  if (m.status === "failed" && provider === "meta_cloud" && recusaSincronaDaMeta(m.error_message)) {
    return "nao_saiu";
  }
  return "ambiguo";
}

/** `organizations.settings.clinic.lembrete_com_reserva === true`. Nasce desligada. */
export function lembreteComReservaLigado(settings: unknown): boolean {
  if (!settings || typeof settings !== "object") return false;
  const clinic = (settings as Record<string, unknown>).clinic;
  if (!clinic || typeof clinic !== "object") return false;
  return (clinic as Record<string, unknown>).lembrete_com_reserva === true;
}
