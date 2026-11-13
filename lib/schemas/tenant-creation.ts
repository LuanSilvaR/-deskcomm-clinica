import { z } from "zod";
import { interfaceSettingsSchema, interfaceTemDestino } from "@/lib/navigation/interface";

/** Mesmo vocabulário no formulário e no limite HTTP. */
export const tenantCreationFields = {
  display_name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens"),
  legal_name: z.string().max(255).optional(),
  cnpj: z.string().max(18).optional(),
  plan: z.enum(["standard", "pro", "enterprise"]),
  owner_interface_settings: interfaceSettingsSchema.optional(),
  owner_email: z.string().trim().email(),
  // FORK (card #159): o plano de cobrança em que a clínica nasce em teste grátis.
  // Só vale com o módulo `cobranca` ligado; desligado, o banco recusa
  // (`cobranca_desligada`). Ausente = a clínica nasce sem assinatura (isenta).
  plano_id: z.string().uuid().optional(),
};
export const createTenantSchema = z
  .object({ ...tenantCreationFields, plan: tenantCreationFields.plan.default("standard") })
  .refine(
    (v) => !v.owner_interface_settings || interfaceTemDestino(v.owner_interface_settings, "admin"),
    { message: "Selecione ao menos uma área de trabalho.", path: ["owner_interface_settings"] },
  );
