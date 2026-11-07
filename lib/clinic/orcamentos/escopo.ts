/**
 * FORK clinic (orçamento O5, revisão security-lgpd) — o orçamento está no
 * escopo de pacientes de quem pede?
 *
 * Quem não tem `pacientes.ver_todos` só trabalha com os pacientes da própria
 * agenda (agenda S5) — vale para ler, criar, mexer e baixar o contrato de um
 * orçamento, igual às rotas de documentos e planos do paciente. O orçamento é
 * lido com a sessão (RLS decide a empresa e `orcamentos.ver`).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { pacienteNoEscopo } from "@/lib/clinic/pacientes/escopo-de-pacientes";

export async function orcamentoNoEscopo(
  supabase: SupabaseClient,
  organizationId: string,
  usuarioId: string,
  orcamentoId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("clinic_orcamentos")
    .select("contact_id")
    .eq("organization_id", organizationId)
    .eq("id", orcamentoId)
    .maybeSingle();
  const contactId = (data as { contact_id: string } | null)?.contact_id;
  if (!contactId) return false;
  return pacienteNoEscopo(supabase, organizationId, usuarioId, contactId);
}
