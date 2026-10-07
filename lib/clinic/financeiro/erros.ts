/**
 * FORK clinic (financeiro FN1) — erro do banco → resposta da API.
 *
 * As funções `fn_clinic_fin_*` levantam um nome curto; aqui ele vira status e
 * mensagem. O resto (permissão, MFA, conflito) cai no mapa do atendimento.
 */
import { ApiError } from "@/lib/api/types";
import { erroDoBanco } from "@/lib/clinic/atendimento/servidor";

const ERROS_DO_FINANCEIRO: Record<string, { status: number; code: string; mensagem: string }> = {
  financeiro_avancado_desligado: {
    status: 409,
    code: "module_disabled",
    mensagem: "O financeiro da clínica está desligado. Ligue em Configurações › Profissionais.",
  },
  fin_dados_invalidos: { status: 422, code: "validation_failed", mensagem: "Dados inválidos." },
  fin_adquirente_invalida: { status: 404, code: "not_found", mensagem: "Maquininha não encontrada." },
  fin_forma_invalida: { status: 404, code: "not_found", mensagem: "Forma de pagamento não encontrada." },
  fin_vigencia_no_passado: {
    status: 422,
    code: "validation_failed",
    mensagem: "Taxas novas valem de hoje em diante: o que já foi vendido continua com a taxa da época.",
  },
  fin_vigencia_existente: {
    status: 409,
    code: "conflict",
    mensagem: "Já existe uma tabela valendo nesta data. Publique a mudança a partir de amanhã.",
  },
  fin_taxa_imutavel: {
    status: 409,
    code: "conflict",
    mensagem: "Tabelas de taxa não se alteram; publique uma vigência nova.",
  },
  fin_taxa_ausente: {
    status: 422,
    code: "validation_failed",
    mensagem: "Esta maquininha não tem taxa para essa forma e número de parcelas. Complete a tabela.",
  },
  fin_parcelas_invalidas: {
    status: 422,
    code: "validation_failed",
    mensagem: "Número de parcelas inválido (débito e Pix são sempre 1x).",
  },
  fin_taxa_maior_que_valor: {
    status: 422,
    code: "validation_failed",
    mensagem: "A taxa ficaria maior que o valor cobrado.",
  },
  fin_valor_invalido: { status: 422, code: "validation_failed", mensagem: "Informe um valor maior que zero." },
  clinic_fin_taxas_parcelas: {
    status: 422,
    code: "validation_failed",
    mensagem: "Faixa de parcelas inválida (de 1 a 24; débito e Pix só 1x).",
  },
  clinic_fin_taxas_mdr: { status: 422, code: "validation_failed", mensagem: "A taxa deve ficar entre 0% e 100%." },
  clinic_fin_taxas_linha_unica: {
    status: 422,
    code: "validation_failed",
    mensagem: "Há duas linhas iguais na tabela (mesma bandeira, forma e parcelas).",
  },
  clinic_fin_adquirentes_nome_unico: { status: 409, code: "conflict", mensagem: "Já existe uma maquininha com esse nome." },
};

export function erroDoFinanceiro(
  error: { message: string; code?: string; details?: string | null },
  requestId: string,
): ApiError {
  const conhecido = Object.entries(ERROS_DO_FINANCEIRO).find(([chave]) => error.message.includes(chave));
  if (conhecido) {
    const [, e] = conhecido;
    return new ApiError(e.status, e.code, undefined, requestId, e.mensagem);
  }
  if (error.code === "23514") {
    return new ApiError(422, "validation_failed", undefined, requestId, "Dados inválidos.");
  }
  if (error.code === "23505") {
    return new ApiError(409, "conflict", undefined, requestId, "Já existe um cadastro igual.");
  }
  return erroDoBanco(error, requestId);
}
