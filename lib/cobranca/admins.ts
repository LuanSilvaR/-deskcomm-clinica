/**
 * FORK (card #160b; recorte do upstream `lib/cobranca/emails.ts`): quem são os
 * admins da empresa e qual e-mail vai para o cliente no provedor. Os e-mails da
 * cobrança (avisos da régua) chegam no 160c, no mesmo módulo do upstream.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `estrito`: o auth-js devolve falha de rede/5xx como `{ user: null, error }` sem
 * lançar. No melhor esforço (avisos) isso tira só aquele destinatário; em quem
 * DECIDE um dado (o e-mail gravado no provedor) tem de lançar, senão a falha
 * vira "esse admin não existe" e o próximo da fila ocupa o lugar dele.
 */
export async function emailsDe(admin: SupabaseClient, ids: readonly string[], estrito = false): Promise<string[]> {
  const lidos = await Promise.all(
    ids.map(async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error && estrito) throw new Error(`e-mail de admin ilegível (${error.code ?? error.status ?? "sem_codigo"})`);
      return data.user?.email ?? null;
    }),
  );
  return [...new Set(lidos.filter((e): e is string => typeof e === "string" && e.includes("@")))];
}

/**
 * Admins ativos da empresa, o mais antigo primeiro. LANÇA se a leitura dos
 * vínculos falhar; a de cada e-mail só lança com `estrito`.
 * `semProvisorio` tira o vínculo que o dono ganha ao criar a empresa para outra
 * pessoa (`provisional_until_handover`, até o convite ser aceito): sem isso, o
 * "admin mais antigo" de uma empresa recém-criada é o próprio dono. `exceto`
 * tira esses usuários antes de ler o e-mail deles.
 */
export async function emailsDosAdmins(
  admin: SupabaseClient,
  orgId: string,
  {
    semProvisorio = false,
    exceto = [],
    estrito = false,
  }: { semProvisorio?: boolean; exceto?: readonly string[]; estrito?: boolean } = {},
): Promise<string[]> {
  let consulta = admin
    .from("user_organizations")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("role", "admin")
    .is("revoked_at", null);
  if (semProvisorio) consulta = consulta.eq("provisional_until_handover", false);
  const { data, error } = await consulta.order("created_at");
  if (error) throw new Error(`admins ilegíveis (${error.code ?? "sem_codigo"})`);
  const ids = ((data ?? []) as Array<{ user_id: string }>).map((l) => l.user_id);
  return emailsDe(admin, ids.filter((id) => !exceto.includes(id)), estrito);
}

/**
 * O e-mail do cliente da empresa no provedor quando quem gera o link é o dono
 * (D-15): fica gravado no cliente para sempre, então nunca o de um dono da
 * instalação. O filtro de provisório não basta: o vínculo de quem criou a
 * empresa antes da migration 0237 ficou `provisional_until_handover = false`
 * (sem expurgo retroativo) e sobrevive ao aceite do convite, ativo e mais antigo
 * que o do cliente. Os avisos (`enviarAvisoAosAdmins`) seguem chegando a ele.
 */
export async function emailDoAdminDaEmpresa(admin: SupabaseClient, orgId: string): Promise<string | null> {
  const { data, error } = await admin.from("platform_admins").select("user_id").is("revoked_at", null);
  if (error) throw new Error(`donos ilegíveis (${error.code ?? "sem_codigo"})`);
  const donos = ((data ?? []) as Array<{ user_id: string }>).map((l) => l.user_id);
  return (await emailsDosAdmins(admin, orgId, { semProvisorio: true, exceto: donos, estrito: true }))[0] ?? null;
}
