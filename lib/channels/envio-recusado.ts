/**
 * Conhecimento de TRANSPORTE: o que cada canal grava quando recusa um envio e
 * o que isso prova. Mora aqui porque feature nenhuma pode nomear provider.
 *
 * Pergunta única: "esta mensagem que falhou JAMAIS foi aceita pela plataforma?"
 * `true` = garantido que não saiu (seguro tentar outro caminho). `false` =
 * ambíguo: pode ter saído (timeout depois de enviar), não repita.
 */
import { CHANNEL_PROVIDER_META, CHANNEL_PROVIDER_WAHA } from "./capabilities";

/**
 * Códigos de `messages.error_code` gravados pelo handler de envio ANTES de
 * qualquer adaptador ser chamado: valem para todo canal. Nada que possa
 * significar "estourou o tempo depois de enviar": o código genérico que o
 * handler grava para qualquer throw do adaptador fica de fora.
 */
const RECUSAS_ANTES_DO_ENVIO = [
  "channel_archived", // canal excluído: nunca sai por ele
  "missing_phone_number", // contato sem telefone: nada foi chamado
  "pre_go_live", // modo de teste do canal bloqueou antes do adaptador
  "pre_go_live_indisponivel", // checagem do modo de teste falhou: bloqueia por segurança
  "storage_sign_failed", // falha do nosso Storage antes de tocar o adaptador
] as const;

/** Códigos do canal oficial que provam recusa (status `failed` do webhook). */
const CODIGOS_DO_CANAL_OFICIAL = [
  "131026", // mensagem não entregável (número sem WhatsApp, versão antiga, etc.)
  "131049", // limite de marketing por usuário, a plataforma decidiu não entregar
  "131047", // janela de 24h expirada, texto livre recusado
  "132001", // modelo não existe neste idioma/nome
  "132015", // modelo pausado por baixa qualidade
  "132016", // modelo desativado
] as const;

const CODIGOS_QUE_GARANTEM_NAO_ENTREGA: Record<string, readonly string[]> = {
  [CHANNEL_PROVIDER_META]: [...RECUSAS_ANTES_DO_ENVIO, ...CODIGOS_DO_CANAL_OFICIAL],
  // O adaptador do canal por QR só grava um código genérico (ambíguo).
  [CHANNEL_PROVIDER_WAHA]: [...RECUSAS_ANTES_DO_ENVIO],
};

/**
 * Recusa síncrona do canal oficial: o adaptador lança `meta_<code>: ...` SÓ
 * quando a API respondeu (!res.ok ou body.error), ou seja, recusou e nunca
 * aceitou a mensagem. Erro de rede/timeout lança outra coisa ("fetch failed").
 * O handler guarda isso em `error_message`. Padrão exclusivo do canal oficial.
 */
const RECUSA_SINCRONA = /^meta_(\d+):/;

/** Números de `meta_<n>:` que NÃO provam recusa: problema do lado da plataforma, a mensagem pode ter sido aceita. */
const NUMEROS_QUE_FICAM_AMBIGUOS = {
  codigosDaGraph: [
    1, // API Unknown, falha desconhecida do servidor
    2, // API Service, indisponibilidade temporária
    408, // HTTP 408: request timeout, a plataforma pode ter aceitado
    131000, // "Something went wrong", falha genérica do lado da plataforma
    131016, // serviço indisponível
    133004, // servidor temporariamente indisponível
  ],
  httpMin: 500, // HTTP 5xx (500-599): erro de servidor, não prova que não foi aceita
  httpMax: 599,
} as const;

function recusaSincrona(erro: string | null | undefined): boolean {
  const achou = RECUSA_SINCRONA.exec(erro ?? "");
  if (!achou) return false;
  const n = Number(achou[1]);
  const x = NUMEROS_QUE_FICAM_AMBIGUOS;
  if ((x.codigosDaGraph as readonly number[]).includes(n)) return false;
  return !(n >= x.httpMin && n <= x.httpMax);
}

export function envioRecusadoComCerteza(
  provider: string,
  m: { error_code: string | null; error_message?: string | null },
): boolean {
  if (m.error_code && (CODIGOS_QUE_GARANTEM_NAO_ENTREGA[provider] ?? RECUSAS_ANTES_DO_ENVIO).includes(m.error_code)) {
    return true;
  }
  return provider === CHANNEL_PROVIDER_META && recusaSincrona(m.error_message);
}
