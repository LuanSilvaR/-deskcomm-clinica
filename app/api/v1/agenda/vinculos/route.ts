import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/wrappers";
import { rotuloDoContato } from "@/lib/contacts/rotulo-do-contato";
import { detalheDoPaciente } from "@/lib/clinic/pacientes/busca";
import { filtrarContatosPelaBusca } from "@/lib/clinic/pacientes/busca-no-banco";
import { contarFaltas } from "@/lib/clinic/agenda/faltas";
import { traduzir } from "@/lib/i18n/dicionario";
export async function GET(req: Request) {
  const requestId = randomUUID();
  const auth = await requireRole("agent", { requestId, resource: "agenda" });
  if (!auth.ok) return auth.response;
  const input = z
    .object({ contact_id: z.uuid().optional(), q: z.string().max(100).optional() })
    .safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!input.success) return fail("validation_failed", "Confira o contato.", 422, { requestId });
  const db = await createClient();
  let contacts = db
    .from("contacts")
    .select("id,name,display_name,phone_number,birthdate")
    .eq("organization_id", auth.org.orgId)
    .eq("is_anonymized", false)
    .order("display_name", { nullsFirst: false })
    .order("name")
    .limit(30);
  if (input.data.contact_id) contacts = contacts.eq("id", input.data.contact_id);
  else if (input.data.q) {
    // FORK clinic (E1): nome, telefone, CPF (hash exato, nunca em claro) ou data
    // de nascimento num campo só — ver lib/clinic/pacientes/busca.ts. Vírgulas e
    // parênteses delimitam o DSL do PostgREST; a função já os tira do nome.
    contacts = filtrarContatosPelaBusca(contacts, input.data.q);
  }
  const result = await contacts;
  if (result.error)
    return fail("internal_error", "Não foi possível carregar os contatos.", 500, { requestId });
  const conversations =
    input.data.contact_id && result.data.length
      ? await db
          .from("conversations")
          .select("id,created_at,status")
          .eq("organization_id", auth.org.orgId)
          .eq("contact_id", input.data.contact_id)
          .eq("is_group", false)
          .order("created_at", { ascending: false })
          .limit(30)
      : { data: [], error: null };
  if (conversations.error)
    return fail("internal_error", "Não foi possível carregar as conversas.", 500, { requestId });
  // FORK clinic (E5.1): quem faltou nos últimos 12 meses aparece com a contagem.
  const faltas = await contarFaltas(
    db,
    auth.org.orgId,
    (result.data ?? []).map((c) => c.id as string),
  );
  return ok(
    {
      contacts: result.data.map((contato) => {
        // `detalhe` (fim do telefone e nascimento) distingue homônimos; sem o que
        // mostrar ele não vai, e o contrato continua `{ id, name }`.
        const n = faltas.get(contato.id as string) ?? 0;
        const detalhe = [detalheDoPaciente(contato.phone_number, contato.birthdate), n > 0 ? `${traduzir("faltou", auth.user.idioma)} ${n}×` : null]
          .filter(Boolean)
          .join(" · ") || null;
        return { id: contato.id, name: rotuloDoContato(contato), ...(detalhe ? { detalhe } : {}) };
      }),
      conversations: conversations.data,
    },
    { requestId },
  );
}
