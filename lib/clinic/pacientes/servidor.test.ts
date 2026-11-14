import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { fichaObrigatoriaLigada, fichaPermiteAtendimento } from "./servidor";

const ORG = "22222222-2222-4222-8222-222222222222";
const CONTATO = "44444444-4444-4444-8444-444444444444";

/** Cliente falso: responde por tabela e registra o que foi lido. */
function falso(respostas: Record<string, unknown>) {
  const lidas: string[] = [];
  const cliente = {
    from(tabela: string) {
      lidas.push(tabela);
      const cadeia: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in"]) cadeia[m] = () => cadeia;
      cadeia.maybeSingle = async () => ({ data: respostas[tabela] ?? null, error: null });
      return cadeia;
    },
  };
  return { cliente: cliente as unknown as SupabaseClient, lidas };
}

const WHATSAPP = { id: CONTATO, name: "Maria", display_name: "Maria", phone_number: "+5511999990000", email: null, birthdate: null, cpf_hash: null };
const COMPLETO = { ...WHATSAPP, name: "Maria da Silva", birthdate: "1990-05-10", cpf_hash: "h" };
const PERFIL_COMPLETO = {
  sex: "feminino",
  cep: "01310100",
  street: "Av. Paulista",
  number: "1000",
  district: "Bela Vista",
  city: "São Paulo",
  uf: "SP",
  emergency_name: "João",
  emergency_relationship: "Irmão",
  emergency_phone: "+5511988887777",
  guardian_name: null,
  guardian_cpf_hash: null,
  guardian_relationship: null,
};

describe("fichaPermiteAtendimento — a trava da chegada e do Compareceu", () => {
  it("regra desligada: permite e nem lê a ficha", async () => {
    const { cliente, lidas } = falso({ organizations: { settings: {} } });
    expect(await fichaPermiteAtendimento(cliente, ORG, CONTATO)).toEqual({ ok: true });
    expect(lidas).not.toContain("clinic_patient_profiles");
  });

  it("regra ligada e ficha do primeiro contato (só nome e telefone): recusa com o que falta", async () => {
    const { cliente } = falso({
      organizations: { settings: { clinic: { ficha_obrigatoria: true } } },
      contacts: WHATSAPP,
    });
    const r = await fichaPermiteAtendimento(cliente, ORG, CONTATO);
    expect(r.ok).toBe(false);
    expect("faltando" in r && r.faltando).toContain("CPF");
  });

  it("regra ligada e ficha completa: permite", async () => {
    const { cliente } = falso({
      organizations: { settings: { clinic: { ficha_obrigatoria: true } } },
      contacts: COMPLETO,
      clinic_patient_profiles: PERFIL_COMPLETO,
    });
    expect(await fichaPermiteAtendimento(cliente, ORG, CONTATO)).toEqual({ ok: true });
  });

  it("compromisso sem paciente: permite (não há ficha a exigir)", async () => {
    const { cliente, lidas } = falso({});
    expect(await fichaPermiteAtendimento(cliente, ORG, null)).toEqual({ ok: true });
    expect(lidas).toEqual([]);
  });
});

describe("fichaObrigatoriaLigada", () => {
  it("só o booleano true liga", () => {
    expect(fichaObrigatoriaLigada({ clinic: { ficha_obrigatoria: true } })).toBe(true);
    expect(fichaObrigatoriaLigada({ clinic: { ficha_obrigatoria: "true" } })).toBe(false);
    expect(fichaObrigatoriaLigada({})).toBe(false);
    expect(fichaObrigatoriaLigada(null)).toBe(false);
  });
});
