/**
 * FORK clinic (ACL-006) — as recusas das funções de acesso (9010/9012) viram
 * respostas que a tela sabe mostrar. A regra mora no BANCO; aqui só se traduz.
 */
import { fail } from "@/lib/api/wrappers";
import { traduzir } from "@/lib/i18n/dicionario";
import { IDIOMA_PADRAO, type Idioma } from "@/lib/i18n/idiomas";

interface ErroDoBanco {
  code?: string;
  message: string;
  details?: string | null;
}

const MAPA: Record<string, { status: number; code: string; mensagem: string }> = {
  acesso_proibido: { status: 403, code: "forbidden_permission", mensagem: "Você não tem permissão para esta ação." },
  acesso_mfa_exigido: {
    status: 403,
    code: "mfa_required",
    mensagem: "Confirme a verificação em duas etapas para mexer em papéis de acesso.",
  },
  acesso_concessao_acima_do_proprio: {
    status: 403,
    code: "acesso_concessao_acima_do_proprio",
    mensagem: "Você só pode dar permissões que você mesmo tem.",
  },
  acesso_dependencia_faltando: {
    status: 422,
    code: "acesso_dependencia_faltando",
    mensagem: "Faltam permissões necessárias (por exemplo, \"ver\" antes de \"editar\").",
  },
  acesso_permissao_desconhecida: { status: 422, code: "validation_failed", mensagem: "Permissão desconhecida." },
  acesso_papel_de_sistema: {
    status: 422,
    code: "acesso_papel_de_sistema",
    mensagem: "O papel Administrador não pode ser renomeado, desativado, excluído nem perder o controle dos papéis.",
  },
  acesso_papel_em_uso: {
    status: 409,
    code: "acesso_papel_em_uso",
    mensagem: "Este papel ainda está com membros. Tire os membros ou desative o papel.",
  },
  acesso_ultimo_administrador: {
    status: 409,
    code: "acesso_ultimo_administrador",
    mensagem: "A empresa precisa de pelo menos um membro com o papel Administrador.",
  },
  acesso_papel_nao_encontrado: { status: 404, code: "not_found", mensagem: "Papel não encontrado." },
  acesso_membro_nao_encontrado: { status: 404, code: "not_found", mensagem: "Membro não encontrado." },
};

export function falhaDeAcesso(erro: ErroDoBanco, requestId: string, idioma: Idioma | undefined) {
  const t = (s: string) => traduzir(s, idioma ?? IDIOMA_PADRAO);
  if (erro.code === "23505") {
    return fail("conflict", t("Já existe um papel com este nome."), 409, { requestId });
  }
  const chave = Object.keys(MAPA).find((k) => erro.message.includes(k));
  if (!chave) return fail("internal_error", erro.message, 500, { requestId });
  const m = MAPA[chave]!;
  const faltando = erro.details ? erro.details.split(",").filter(Boolean) : undefined;
  return fail(m.code, t(m.mensagem), m.status, { requestId, ...(faltando ? { details: { permissoes: faltando } } : {}) });
}
