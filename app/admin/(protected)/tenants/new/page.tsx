import { moduloLigado } from "@/lib/instalacao/modulos";
import { createAdminClient } from "@/lib/supabase/admin";

import { NewTenantForm, type PlanoParaCadastro } from "./_form";

export const metadata = { title: "Novo Tenant — Admin Plataforma" };
export const dynamic = "force-dynamic";

export default async function NewTenantPage() {
  // FORK (card #159): com a cobrança ligada, o formulário oferece os planos não
  // arquivados (o do cadastro pré-selecionado). Desligada, `null`: nada muda.
  // O layout de /admin já exigiu admin de plataforma.
  const admin = createAdminClient();
  let planos: PlanoParaCadastro[] | null = null;
  if (await moduloLigado(admin, "cobranca")) {
    const { data } = await admin
      .from("cobranca_planos")
      .select("id, nome, preco_cents, intervalo, trial_dias, padrao_no_cadastro")
      .is("arquivado_em", null)
      .order("preco_cents", { ascending: true });
    planos = (data ?? []) as PlanoParaCadastro[];
  }
  return <NewTenantForm planosDeCobranca={planos} />;
}
