/**
 * FORK clinic (orçamento O1) — erro do banco → resposta da API.
 *
 * As funções `fn_clinic_preco_*`/`fn_clinic_orcamentos_*` levantam um nome
 * curto; aqui ele vira status e mensagem. O resto (permissão, MFA) cai no mapa
 * do atendimento (`erroDoBanco`).
 */
import { ApiError } from "@/lib/api/types";
import { erroDoBanco } from "@/lib/clinic/atendimento/servidor";

const ERROS_DO_ORCAMENTO: Record<string, { status: number; code: string; mensagem: string }> = {
  orcamentos_desligado: {
    status: 409,
    code: "module_disabled",
    mensagem: "Os orçamentos estão desligados nesta clínica. Ligue em Configurações › Profissionais.",
  },
  preco_dados_invalidos: { status: 422, code: "validation_failed", mensagem: "Dados inválidos." },
  preco_item_invalido: {
    status: 422,
    code: "validation_failed",
    mensagem: "Procedimento ou tipo de serviço não encontrado nesta clínica.",
  },
  orcamento_dados_invalidos: { status: 422, code: "validation_failed", mensagem: "Dados inválidos." },
  orcamento_invalido: { status: 404, code: "not_found", mensagem: "Orçamento não encontrado." },
  orcamento_nao_editavel: {
    status: 409,
    code: "conflict",
    mensagem: "Este orçamento não pode mais ser alterado.",
  },
  orcamento_imutavel: { status: 409, code: "conflict", mensagem: "Orçamento não se apaga; cancele." },
  orcamento_paciente_invalido: { status: 422, code: "validation_failed", mensagem: "Paciente não encontrado." },
  orcamento_atendimento_invalido: {
    status: 422,
    code: "validation_failed",
    mensagem: "Atendimento inválido para este paciente.",
  },
  orcamento_preco_desatualizado: {
    status: 409,
    code: "conflict",
    mensagem: "A tabela de preços mudou. Recarregue e escolha os itens de novo.",
  },
  orcamento_desconto_invalido: {
    status: 422,
    code: "validation_failed",
    mensagem: "O desconto não pode passar do subtotal.",
  },
  orcamento_pagamento_invalido: {
    status: 422,
    code: "validation_failed",
    mensagem: "Condição de pagamento inválida.",
  },
  orcamento_sem_motivo: { status: 422, code: "validation_failed", mensagem: "Informe o motivo." },
  orcamento_desconto_pendente: {
    status: 409,
    code: "conflict",
    mensagem: "O desconto ainda espera a aprovação de um gerente.",
  },
  orcamento_vencido: {
    status: 422,
    code: "validation_failed",
    mensagem: "A validade do orçamento já passou. Ajuste a data antes de enviar.",
  },
  orcamento_modelo_invalido: {
    status: 422,
    code: "validation_failed",
    mensagem: "Escolha um modelo de contrato ativo em Configurações › Modelos clínicos.",
  },
  orcamento_versao_aberta: {
    status: 409,
    code: "conflict",
    mensagem: "Já existe uma versão em aberto deste orçamento.",
  },
  prontuario_desligado: {
    status: 409,
    code: "module_disabled",
    mensagem: "Para gerar o contrato, ligue o prontuário em Configurações › Profissionais.",
  },
  preco_imutavel: {
    status: 409,
    code: "conflict",
    mensagem: "Preço publicado não se altera; publique um preço novo.",
  },
};

export function erroDoOrcamento(
  error: { message: string; code?: string; details?: string | null },
  requestId: string,
): ApiError {
  const conhecido = Object.entries(ERROS_DO_ORCAMENTO).find(([chave]) => error.message.includes(chave));
  if (conhecido) {
    const [, e] = conhecido;
    return new ApiError(e.status, e.code, undefined, requestId, e.mensagem);
  }
  return erroDoBanco(error, requestId);
}
