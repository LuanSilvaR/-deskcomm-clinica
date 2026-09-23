import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/wrappers";
import { rotuloDoContato } from "@/lib/contacts/rotulo-do-contato";
import { hashCpf } from "@/lib/contacts/cpf";
import { detalheDoPaciente, interpretarBusca } from "@/lib/clinic/pacientes/busca";
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
    const busca = interpretarBusca(input.data.q);
    if (busca?.tipo === "nascimento") contacts = contacts.eq("birthdate", busca.data);
    else if (busca?.tipo === "cpf_ou_telefone")
      contacts = contacts.or(`cpf_hash.eq.${hashCpf(busca.digitos)},phone_number.ilike.%${busca.digitos}%`);
    else if (busca?.tipo === "telefone") contacts = contacts.ilike("phone_number", `%${busca.digitos}%`);
    else if (busca?.tipo === "nome")
      contacts = contacts.or(`display_name.ilike.%${busca.termo}%,name.ilike.%${busca.termo}%`);
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
  return ok(
    {
      contacts: result.data.map((contato) => {
        // `detalhe` (fim do telefone e nascimento) distingue homônimos; sem o que
        // mostrar ele não vai, e o contrato continua `{ id, name }`.
        const detalhe = detalheDoPaciente(contato.phone_number, contato.birthdate);
        return { id: contato.id, name: rotuloDoContato(contato), ...(detalhe ? { detalhe } : {}) };
      }),
      conversations: conversations.data,
    },
    { requestId },
  );
}
