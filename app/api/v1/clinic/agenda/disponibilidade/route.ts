/**
 * GET /api/v1/clinic/agenda/disponibilidade?profissional=&de=AAAA-MM-DD&ate=AAAA-MM-DD
 * — FORK clinic (agenda por profissional, S1).
 *
 * Dia a dia, para UM profissional: a jornada publicada, o que fica fora dela
 * (a grade hachura) e os bloqueios — pessoais, da clínica toda e as
 * indisponibilidades do núcleo (a grade desenha como bloco "Bloqueado").
 * Monta com `disponibilidadeDoProfissional`, as mesmas regras do "Dia por
 * profissional".
 *
 * `agenda.ver`; o de um colega exige `agenda.ver_outros` (`escopoDaLeitura`).
 * Até 42 dias por pedido (a visão Mês com a borda).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import type { BloqueioComMotivo, Disponibilidade, ExcecaoDoNucleo } from "@/lib/clinic/agenda/dia-por-profissional";
import { diasEntre, disponibilidadeDoProfissional } from "@/lib/clinic/agenda/disponibilidade-do-profissional";
import { escopoDaLeitura } from "@/lib/clinic/agenda/escopo-da-agenda";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DATA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const consultaSchema = z
  .object({ profissional: z.string().uuid().optional(), de: DATA, ate: DATA })
  .refine((c) => c.de <= c.ate, { message: "de depois de ate" });

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("agenda.ver", { requestId, resource: "agenda" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const org = authz.org.orgId;

  const lido = consultaSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!lido.success) return fail("validation_failed", t("Consulta inválida."), 422, { requestId });

  const escopo = escopoDaLeitura({ permissoes: authz.permissoes, usuarioId: authz.user.id, pedido: lido.data.profissional });
  if (!escopo.ok) {
    return fail("forbidden_permission", t("Você só pode ver a sua própria agenda."), 403, {
      requestId,
      details: { permissao: "agenda.ver_outros" },
    });
  }
  const profissional = escopo.dono ?? authz.user.id;
  const dias = diasEntre(lido.data.de, lido.data.ate);
  const ultimo = dias[dias.length - 1] ?? lido.data.de;

  const supabase = await createClient();
  const [disp, exc, bloq] = await Promise.all([
    supabase.from("attendant_availability").select("user_id, schedule").eq("organization_id", org).eq("user_id", profissional).maybeSingle(),
    supabase
      .from("calendar_availability_exceptions")
      .select("user_id, exception_date, is_unavailable, start_minute, end_minute, reason")
      .eq("organization_id", org)
      .eq("user_id", profissional)
      .gte("exception_date", lido.data.de)
      .lte("exception_date", ultimo),
    supabase
      .from("clinic_agenda_blocks")
      .select("user_id, starts_on, ends_on, start_minute, end_minute, weekdays, reason, tipo")
      .eq("organization_id", org)
      .or(`user_id.is.null,user_id.eq.${profissional}`)
      .lte("starts_on", ultimo)
      .gte("ends_on", lido.data.de),
  ]);
  const erro = disp.error ?? exc.error ?? bloq.error;
  if (erro) return fail("internal_error", erro.message, 500, { requestId });

  const dados = disponibilidadeDoProfissional({
    profissionalId: profissional,
    dias,
    disponibilidade: (disp.data ?? undefined) as unknown as Disponibilidade | undefined,
    excecoes: (exc.data ?? []) as unknown as Array<ExcecaoDoNucleo & { exception_date: string }>,
    bloqueios: (bloq.data ?? []) as unknown as BloqueioComMotivo[],
  });
  return ok({ profissional, dias: dados }, { requestId });
}
