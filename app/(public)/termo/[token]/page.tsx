/**
 * FORK clinic (prontuário F6) — o termo aberto pelo link de aceite, sem login.
 * A rota pública (app/api/v1/publico/termos/[token]) confere o token.
 */
import { TermoPublico } from "./_client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Termo", robots: { index: false, follow: false } };

export default async function TermoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <TermoPublico token={token} />;
}
