import { notFound, redirect } from "next/navigation";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { variosTelefonesLigadoNaConfig } from "@/lib/clinic/flags";
import { pacienteNoEscopo } from "@/lib/clinic/pacientes/escopo-de-pacientes";
import { createClient } from "@/lib/supabase/server";
import { ContactDetailClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string | string[] }>;
}) {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  const { id } = await params;
  const supabase = await createClient();
  // Filtra a org ATIVA, não só a RLS: para quem é membro de duas organizações a
  // policy deixa passar as duas, e a tela abriria o contato da org que não está
  // selecionada — com o dossiê do cliente carregando vazio por baixo.
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, organization_id")
    .eq("organization_id", activeOrg.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!contact) notFound();
  // FORK clinic (agenda S5): sem `pacientes.ver_todos`, só os pacientes da própria agenda.
  if (!(await pacienteNoEscopo(supabase, activeOrg.orgId, user.id, id))) notFound();
  // FORK clinic (prontuário F2): `?aba=prontuario` abre direto na aba.
  const { aba } = await searchParams;
  // FORK clinic (#85): a opção dos vários telefones (8012) — editar só para quem escreve (agent+).
  const { data: org } = await supabase.from("organizations").select("settings").eq("id", activeOrg.orgId).maybeSingle();
  const variosTelefones = variosTelefonesLigadoNaConfig(org?.settings) && activeOrg.role !== "viewer";
  return (
    <ContactDetailClient
      contactId={id}
      abaInicial={typeof aba === "string" ? aba : undefined}
      variosTelefones={variosTelefones}
    />
  );
}
