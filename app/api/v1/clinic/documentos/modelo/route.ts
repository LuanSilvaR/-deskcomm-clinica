/**
 * GET /api/v1/clinic/documentos/modelo — o MODELO EM BRANCO do papel timbrado
 * da organização ativa (FORK clinic, docs/padrao-documentos.md).
 *
 * É o laço de retorno das Configurações: a pessoa muda o telefone, a cor ou o
 * logo e baixa aqui o papel como ele vai sair em todo documento — campos vazios
 * aparecem como [placeholder], para ela ver o que falta preencher.
 *
 * Quem administra a empresa (as duas telas que alimentam o papel são de admin).
 * A organização vem da sessão; a leitura é pelo client de sessão (RLS).
 */
import { randomUUID } from "node:crypto";

import { fail } from "@/lib/api/wrappers";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { roleAtLeast } from "@/lib/auth/types";
import { lerEntradaDoContexto, montarContextoDaMarca, resolverContextoDaMarca } from "@/lib/documentos/contexto-da-marca";
import { renderizarDocumento } from "@/lib/documentos/renderizar";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const p = (texto: string) => ({ type: "paragraph", content: [{ type: "text", text: texto }] });

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const user = await loadAuthUser();
  if (!user) return fail("unauthenticated", "Faça login.", 401, { requestId });
  const org = await resolveActiveOrg(user);
  if (!org) return fail("forbidden_tenant", "Sem organização ativa.", 403, { requestId });
  if (!user.is_platform_admin && !roleAtLeast(org.role, "admin")) {
    return fail("forbidden_role", "Só quem administra a empresa vê o modelo do papel timbrado.", 403, { requestId });
  }

  const supabase = await createClient();
  const [entrada, completo] = await Promise.all([lerEntradaDoContexto(supabase, org.orgId), resolverContextoDaMarca(supabase, org.orgId)]);
  if (!entrada || !completo) return fail("not_found", "Organização não encontrada.", 404, { requestId });
  // Mesmos arquivos já baixados; só liga os placeholders dos campos vazios.
  const contexto = await montarContextoDaMarca({
    ...entrada,
    logo: completo.logo?.data ?? null,
    favicon: completo.favicon?.data ?? null,
    modeloEmBranco: true,
  });

  const buf = await renderizarDocumento(
    {
      tipo: "[Tipo de documento]",
      numero: `[000/${new Date().getFullYear()}]`,
      titulo: "[Título do documento]",
      metadados: [
        ["Data", "[DD/MM/AAAA]"],
        ["Destinatário(a)", "[Nome / setor / paciente, quando aplicável]"],
        ["Assunto", "[Assunto do documento]"],
      ],
      corpo: {
        type: "doc",
        content: [
          p(
            "[Escreva aqui o conteúdo do documento. Utilize linguagem clara, institucional e acolhedora. Substitua os campos entre colchetes pelos dados reais. Para documentos clínicos, use apenas as informações necessárias e respeite a privacidade do paciente.]",
          ),
          p("[Os campos entre colchetes no cabeçalho e no rodapé são os que ainda faltam em Configurações › Organização e › Marca.]"),
        ],
      },
      assinatura: { nome: "[Nome do(a) profissional responsável]", cargo: "[Cargo / função]", registro: "[Registro profissional, se aplicável]" },
      emitidoEm: new Date(),
    },
    contexto,
  );

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="modelo-papel-timbrado.pdf"',
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
    },
  });
}
