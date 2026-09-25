/**
 * O atendimento (fork clinic, prontuário F1): cabeçalho do paciente e ação de
 * finalizar. As seções clínicas (anamnese, avaliação, evolução...) chegam nas
 * próximas fases do plano (docs/tarefas/prontuario/plano.md).
 */
import { exigePermissaoNaPagina } from "@/lib/clinic/acesso/pagina";

import { AtendimentoDoDia } from "./_client";

export const dynamic = "force-dynamic";

export default async function AtendimentoPage({ params }: { params: Promise<{ id: string }> }) {
  const negado = await exigePermissaoNaPagina("prontuario.ver");
  if (negado) return negado;
  const { id } = await params;
  return <AtendimentoDoDia id={id} />;
}
