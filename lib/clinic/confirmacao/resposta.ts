/**
 * A resposta do paciente ao pedido de confirmação — SIM, NÃO ou nada.
 *
 * Mesma cautela da detecção de opt-out (lib/opt-out/deteccao.ts): só conta a
 * mensagem CURTA e inequívoca. "Sim, mas posso chegar 10 min atrasada?" é
 * conversa, não confirmação — cai para a equipe (ou para o agente de IA). Errar
 * para o lado do silêncio custa uma tarefa de ligação; errar para o lado do
 * "confirmado" faz a clínica esperar quem não vem.
 *
 * Função pura; quem chama decide o que fazer com o resultado.
 */
export type RespostaDeConfirmacao = "sim" | "nao" | null;

const SIM = new Set([
  "sim",
  "s",
  "ss",
  "sim sim",
  "confirmo",
  "confirmado",
  "confirmada",
  "confirmar",
  "sim confirmo",
  "sim confirmado",
  "sim confirmada",
  "ok",
  "okay",
  "ok confirmado",
  "estarei la",
  "vou sim",
  "pode confirmar",
  // espanhol (o pedido sai em espanhol quando a organização usa es)
  "si",
  "si confirmo",
  "confirmo si",
  "👍",
  "✅",
]);

const NAO = new Set([
  "nao",
  "n",
  "nao posso",
  "nao vou",
  "nao vou poder",
  "nao consigo",
  "cancelar",
  "cancela",
  "desmarcar",
  "desmarca",
  "remarcar",
  "quero remarcar",
  "preciso remarcar",
  "nao confirmo",
  "no",
  "no puedo",
  "reprogramar",
  "cancelar cita",
  "👎",
  "❌",
]);

/** Minúsculas, sem acento, sem pontuação, espaços únicos. Emojis ficam. */
export function normalizarResposta(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?;:"'()*_~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function interpretarResposta(texto: string | null | undefined): RespostaDeConfirmacao {
  if (!texto) return null;
  const n = normalizarResposta(texto);
  if (!n || n.length > 40) return null;
  if (SIM.has(n)) return "sim";
  if (NAO.has(n)) return "nao";
  return null;
}

/** O que o lembrete da véspera acrescenta quando pede confirmação. */
export const PEDIDO_DE_CONFIRMACAO = "Responda *SIM* para confirmar ou *NÃO* se precisar remarcar.";

/** O degrau da véspera: só lembrete com 12 h ou mais de antecedência pede confirmação. */
export const ANTECEDENCIA_MINIMA_DO_PEDIDO_MIN = 720;

/** Sem resposta até esta antecedência, a recepção recebe a tarefa de ligar. */
export const LIGAR_QUANDO_FALTAR_MIN = 240;
