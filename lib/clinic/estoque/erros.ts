/**
 * FORK clinic (estoque E0) — erro do banco → resposta da API.
 *
 * As funções `fn_clinic_estoque_*` levantam um nome curto; aqui ele vira o
 * status e a mensagem que a tela mostra. O que não for de estoque cai no mapa
 * do atendimento (`erroDoBanco`), que já sabe permissão, MFA e conflito.
 */
import { ApiError } from "@/lib/api/types";
import { erroDoBanco } from "@/lib/clinic/atendimento/servidor";

const ERROS_DO_ESTOQUE: Record<string, { status: number; code: string; mensagem: string }> = {
  estoque_desligado: {
    status: 409,
    code: "module_disabled",
    mensagem: "O estoque está desligado nesta clínica. Ligue em Configurações › Profissionais.",
  },
  estoque_insuficiente: {
    status: 409,
    code: "conflict",
    mensagem: "Saldo insuficiente nesse lote e local. Nada foi alterado.",
  },
  estoque_lote_vencido: {
    status: 422,
    code: "validation_failed",
    mensagem: "Lote vencido não entra no estoque.",
  },
  estoque_lote_obrigatorio: {
    status: 422,
    code: "validation_failed",
    mensagem: "Este produto é rastreado: informe o lote e a validade.",
  },
  estoque_lote_invalido: { status: 404, code: "not_found", mensagem: "Lote não encontrado." },
  estoque_local_invalido: {
    status: 422,
    code: "validation_failed",
    mensagem: "Local de estoque inválido ou inativo.",
  },
  estoque_produto_invalido: { status: 404, code: "not_found", mensagem: "Produto não encontrado." },
  estoque_quantidade_invalida: {
    status: 422,
    code: "validation_failed",
    mensagem: "Quantidade inválida.",
  },
  estoque_sem_motivo: { status: 422, code: "validation_failed", mensagem: "Informe o motivo." },
  estoque_dados_invalidos: { status: 422, code: "validation_failed", mensagem: "Dados inválidos." },
  estoque_operacao_invalida: {
    status: 404,
    code: "not_found",
    mensagem: "Movimentação não encontrada.",
  },
  estoque_ja_estornada: {
    status: 409,
    code: "conflict",
    mensagem: "Esta movimentação já foi estornada.",
  },
  estoque_estorno_de_estorno: {
    status: 422,
    code: "validation_failed",
    mensagem: "Um estorno não pode ser estornado. Faça uma nova movimentação.",
  },
  estoque_pendencia_invalida: {
    status: 404,
    code: "not_found",
    mensagem: "Pendência não encontrada.",
  },
  estoque_pendencia_fechada: {
    status: 409,
    code: "conflict",
    mensagem: "Esta pendência já foi resolvida.",
  },
  estoque_ja_baixado: {
    status: 409,
    code: "conflict",
    mensagem: "Este insumo já saiu do estoque.",
  },
  estoque_nao_fracionavel: {
    status: 422,
    code: "validation_failed",
    mensagem: "Este produto não é fracionável. Marque “Fracionável” na configuração do produto.",
  },
  estoque_frasco_invalido: { status: 404, code: "not_found", mensagem: "Frasco não encontrado." },
  estoque_frasco_encerrado: {
    status: 409,
    code: "conflict",
    mensagem: "Este frasco já foi encerrado.",
  },
  estoque_nfe_duplicada: {
    status: 409,
    code: "conflict",
    mensagem: "Esta NF-e já foi importada (mesma chave de acesso).",
  },
  estoque_nfe_invalida: { status: 404, code: "not_found", mensagem: "NF-e não encontrada." },
  estoque_nfe_fechada: {
    status: 409,
    code: "conflict",
    mensagem: "Esta NF-e já foi lançada ou cancelada.",
  },
  estoque_nfe_sem_conferencia: {
    status: 422,
    code: "validation_failed",
    mensagem: "Confira todos os itens antes de lançar.",
  },
  estoque_conta_invalida: {
    status: 422,
    code: "validation_failed",
    mensagem: "Conta financeira inválida.",
  },
  estoque_inventario_aberto: {
    status: 409,
    code: "conflict",
    mensagem: "Já existe um inventário aberto neste local. Feche ou cancele antes de abrir outro.",
  },
  estoque_inventario_invalido: { status: 404, code: "not_found", mensagem: "Inventário não encontrado." },
  estoque_inventario_fechado: {
    status: 409,
    code: "conflict",
    mensagem: "Este inventário já foi fechado ou cancelado.",
  },
  estoque_imutavel: {
    status: 409,
    code: "conflict",
    mensagem: "Movimentações não se alteram; use o estorno.",
  },
};

export function erroDoEstoque(
  error: { message: string; code?: string; details?: string | null },
  requestId: string,
): ApiError {
  const conhecido = Object.entries(ERROS_DO_ESTOQUE).find(([chave]) =>
    error.message.includes(chave),
  );
  if (conhecido) {
    const [, e] = conhecido;
    return new ApiError(e.status, e.code, undefined, requestId, e.mensagem);
  }
  if (error.code === "23505") {
    return new ApiError(409, "conflict", undefined, requestId, "Já existe um cadastro igual.");
  }
  return erroDoBanco(error, requestId);
}
