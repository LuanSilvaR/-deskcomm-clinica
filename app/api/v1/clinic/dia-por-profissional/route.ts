/**
 * GET /api/v1/clinic/dia-por-profissional?dia=AAAA-MM-DD — FORK clinic (E1.4).
 *
 * O dia da clínica em colunas, uma por profissional: jornada, bloqueios e
 * compromissos (ver lib/clinic/agenda/dia-por-profissional.ts). Só com as regras
 * de profissionais ligadas; desligadas, `ligado: false`. Leitura (viewer), pela
 * sessão — a RLS de quem pede vale. O dia é o do fuso da organização.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { diaLocalISO, instanteDe } from "@/lib/agenda/fuso";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import {
  montarColunas,
  type BloqueioComMotivo,
  type CompromissoDoDia,
  type Disponibilidade,
  type ExcecaoDoNucleo,
} from "@/lib/clinic/agenda/dia-por-profissional";
import { clinicProfissionaisLigado } from "@/lib/clinic/flags";
import { nomeDoContato } from "@/lib/contacts/rotulo-do-contato";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DIA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "agenda" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data: organizacao } = await supabase.from("organizations").select("settings, timezone").eq("id", org).maybeSingle();
  const fuso = (organizacao as { timezone?: string | null } | null)?.timezone || "America/Sao_Paulo";
  if (!clinicProfissionaisLigado((organizacao as { settings?: unknown } | null)?.settings)) {
    return ok({ ligado: false, dia: null, fuso, colunas: [] }, { requestId });
  }

  const pedido = new URL(req.url).searchParams.get("dia") ?? diaLocalISO(new Date(), fuso);
  if (!DIA.safeParse(pedido).success) return fail("validation_failed", t("Consulta inválida."), 422, { requestId });
  const [ano, mes, dia] = pedido.split("-").map(Number) as [number, number, number];
  const de = instanteDe({ ano, mes, dia }, fuso);
  const proximo = new Date(Date.UTC(ano, mes - 1, dia + 1));
  const ate = instanteDe({ ano: proximo.getUTCFullYear(), mes: proximo.getUTCMonth() + 1, dia: proximo.getUTCDate() }, fuso);

  const [disp, exc, bloq, ags] = await Promise.all([
    supabase.from("attendant_availability").select("user_id, schedule").eq("organization_id", org),
    supabase
      .from("calendar_availability_exceptions")
      .select("user_id, is_unavailable, start_minute, end_minute, reason")
      .eq("organization_id", org)
      .eq("exception_date", pedido),
    supabase
      .from("clinic_agenda_blocks")
      .select("user_id, starts_on, ends_on, start_minute, end_minute, weekdays, reason")
      .eq("organization_id", org)
      .lte("starts_on", pedido)
      .gte("ends_on", pedido),
    supabase
      .from("calendar_appointments")
      .select("id, owner_user_id, title, starts_at, ends_at, status, contact_id, contacts(name, display_name)")
      .eq("organization_id", org)
      .neq("status", "cancelled")
      .lt("starts_at", ate.toISOString())
      .gt("ends_at", de.toISOString())
      .order("starts_at", { ascending: true })
      .limit(500),
  ]);
  const erro = disp.error ?? exc.error ?? bloq.error ?? ags.error;
  if (erro) return fail("internal_error", erro.message, 500, { requestId });

  const compromissos: CompromissoDoDia[] = (ags.data ?? []).map((a) => {
    const c = a.contacts as { name?: string | null; display_name?: string | null } | null;
    return {
      id: a.id as string,
      owner_user_id: (a.owner_user_id as string | null) ?? null,
      titulo: a.title as string,
      inicio: a.starts_at as string,
      fim: a.ends_at as string,
      status: a.status as string,
      paciente: nomeDoContato(c),
      paciente_id: (a.contact_id as string | null) ?? null,
    };
  });

  const colunas = montarColunas({
    dia: pedido,
    disponibilidades: (disp.data ?? []) as unknown as Disponibilidade[],
    excecoes: (exc.data ?? []) as unknown as ExcecaoDoNucleo[],
    bloqueios: (bloq.data ?? []) as unknown as BloqueioComMotivo[],
    compromissos,
  });
  return ok({ ligado: true, dia: pedido, fuso, colunas }, { requestId });
}
