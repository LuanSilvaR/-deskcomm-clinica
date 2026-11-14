/** FORK clinic (ACL-006) — o corpo de criar/editar papel. `strict`: campo a mais é recusado (mass assignment). */
import { z } from "zod";

export const papelSchema = z
  .object({
    nome: z.string().trim().min(1).max(60),
    descricao: z.string().trim().max(300).nullish(),
    ativo: z.boolean().optional(),
    permissoes: z.array(z.string().min(3).max(80)).max(200),
  })
  .strict();
