import "server-only";

/**
 * Dispositivo confiável da verificação em duas etapas (#89, porte do upstream #3200).
 *
 * Quem prova o código pode marcar "confiar neste dispositivo por 30 dias". O
 * servidor grava o HASH de um token aleatório (`mfa_trusted_devices`) e entrega o
 * token num cookie httpOnly. No próximo login com senha, se o cookie bate com uma
 * linha do mesmo usuário e do mesmo fator, dentro do prazo, a sessão nova é
 * "reconhecida": o `session_id` do JWT é gravado na linha, e o banco
 * (`fn_session_mfa_proven`) passa a tratá-la como provada.
 *
 * Regras do fork, todas pelo lado mais seguro:
 * - A permissão é POR EMPRESA (`settings.security.mfa_dispositivo_confiavel`),
 *   desligada por padrão. Quem participa de várias empresas só confia no
 *   dispositivo se TODAS permitirem.
 * - Admin da plataforma nunca usa dispositivo confiável (ver `mfaEmDivida`).
 * - Trocar a senha, sair de todos os lugares ou a empresa desligar a opção
 *   apagam os dispositivos.
 */
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { cookieSecure } from "@/lib/supabase/cookie-secure";

export const COOKIE_DISPOSITIVO_CONFIAVEL = "mfa_dispositivo_confiavel";
export const DIAS_DE_CONFIANCA = 30;
const UM_DIA_MS = 86_400_000;

function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** O `session_id` do JWT (o mesmo que `auth.jwt()->>'session_id'` lê no banco). */
export function sessionIdDoAccessToken(accessToken: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8"));
    return typeof payload?.session_id === "string" ? payload.session_id : null;
  } catch {
    return null;
  }
}

/** A empresa permite confiar no dispositivo? Só o booleano `true` liga. */
export function empresaPermiteDispositivoConfiavel(settings: unknown): boolean {
  const s = (settings as { security?: unknown } | null)?.security;
  return (s as { mfa_dispositivo_confiavel?: unknown } | null | undefined)?.mfa_dispositivo_confiavel === true;
}

/**
 * O usuário pode usar dispositivo confiável? Precisa ter ao menos uma empresa
 * ativa, e TODAS as empresas ativas dele precisam permitir. Admin da plataforma
 * nunca pode. Falha de leitura = não pode (falha fechado).
 */
export async function dispositivoConfiavelPermitido(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: pa, error: erroPa } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (erroPa || pa) return false;
  const { data, error } = await admin
    .from("user_organizations")
    .select("organizations(settings)")
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (error || !data || data.length === 0) return false;
  return (data as Array<{ organizations: { settings: unknown } | Array<{ settings: unknown }> | null }>).every(
    (linha) => {
      const org = Array.isArray(linha.organizations) ? linha.organizations[0] : linha.organizations;
      return org !== null && org !== undefined && empresaPermiteDispositivoConfiavel(org.settings);
    },
  );
}

/** Grava o dispositivo e entrega o cookie. Chamado só depois de um código provado. */
export async function confiarNesteDispositivo(
  userId: string,
  factorId: string,
  userAgent: string | null,
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const admin = createAdminClient();
  // Aproveita para limpar o que já venceu deste usuário.
  await admin.from("mfa_trusted_devices").delete().eq("user_id", userId).lt("expires_at", new Date().toISOString());
  const { error } = await admin.from("mfa_trusted_devices").insert({
    user_id: userId,
    factor_id: factorId,
    token_hash: hashDoToken(token),
    user_agent: userAgent?.slice(0, 300) ?? null,
    expires_at: new Date(Date.now() + DIAS_DE_CONFIANCA * UM_DIA_MS).toISOString(),
  });
  if (error) throw error;
  (await cookies()).set(COOKIE_DISPOSITIVO_CONFIAVEL, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    maxAge: DIAS_DE_CONFIANCA * 86_400,
    path: "/",
  });
}

/**
 * No login com senha: o cookie deste navegador corresponde a um dispositivo
 * confiável válido deste usuário e deste fator? Se sim, amarra a sessão nova a
 * ele e devolve `true` (o login não pede o código).
 */
export async function reconhecerDispositivoConfiavel(
  userId: string,
  factorId: string,
  accessToken: string,
): Promise<boolean> {
  const token = (await cookies()).get(COOKIE_DISPOSITIVO_CONFIAVEL)?.value;
  if (!token) return false;
  const sessionId = sessionIdDoAccessToken(accessToken);
  if (!sessionId) return false;
  if (!(await dispositivoConfiavelPermitido(userId))) return false;
  const { data, error } = await createAdminClient()
    .from("mfa_trusted_devices")
    .update({ session_id: sessionId, last_used_at: new Date().toISOString() })
    .eq("token_hash", hashDoToken(token))
    .eq("user_id", userId)
    .eq("factor_id", factorId)
    .gt("expires_at", new Date().toISOString())
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export interface DispositivoConfiavel {
  id: string;
  user_agent: string | null;
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
}

export async function listarDispositivosConfiaveis(userId: string): Promise<DispositivoConfiavel[]> {
  const { data, error } = await createAdminClient()
    .from("mfa_trusted_devices")
    .select("id, user_agent, created_at, last_used_at, expires_at")
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DispositivoConfiavel[];
}

/** Apaga TODOS os dispositivos confiáveis do usuário (as sessões reconhecidas perdem a prova). */
export async function esquecerDispositivosConfiaveis(userId: string): Promise<void> {
  const { error } = await createAdminClient().from("mfa_trusted_devices").delete().eq("user_id", userId);
  if (error) throw error;
}

/** Apaga os dispositivos de todos os membros de uma empresa (quando ela desliga a opção). */
export async function esquecerDispositivosDaEmpresa(orgId: string): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("user_organizations").select("user_id").eq("organization_id", orgId);
  if (error) throw error;
  const ids = [...new Set((data ?? []).map((l) => (l as { user_id: string }).user_id))];
  if (ids.length === 0) return;
  const { error: erroDelete } = await admin.from("mfa_trusted_devices").delete().in("user_id", ids);
  if (erroDelete) throw erroDelete;
}
