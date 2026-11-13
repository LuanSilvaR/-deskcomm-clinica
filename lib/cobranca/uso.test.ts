import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { bancoFalso, filtros } from "@/tests/helpers/banco-falso-da-cobranca";

import { excedenteDoPlano, lerUsoDaOrganizacao } from "./uso";

// FORK (#160b): a constante mora local em lib/cobranca/uso.ts (canal pareado por QR).
const QR = "waha";

describe("excedenteDoPlano — quanto remover para caber (D-4)", () => {
  it.each([
    [{ assentos: 5, canais: 2 }, { max_assentos: 3, max_canais: 1 }, { assentos: 2, canais: 1 }],
    [{ assentos: 3, canais: 2 }, { max_assentos: 3, max_canais: 1 }, { canais: 1 }],
    [{ assentos: 9, canais: 9 }, { max_assentos: null, max_canais: null }, {}],
    [{ assentos: 0, canais: 0 }, { max_assentos: 1, max_canais: 1 }, {}],
  ])("uso %o no plano %o → %o", (uso, plano, esperado) => {
    expect(excedenteDoPlano(uso, plano)).toEqual(esperado);
  });
});

describe("lerUsoDaOrganizacao — a mesma contagem dos gatilhos de limite (spec §5)", () => {
  it("conta membro ativo não provisório e canal não arquivado que não é wacalls, só desta org", async () => {
    const b = bancoFalso((c) => ({ count: c.tabela === "user_organizations" ? 4 : 2 }));
    expect(await lerUsoDaOrganizacao(b.cliente as unknown as SupabaseClient, "org-1")).toEqual({ assentos: 4, canais: 2 });
    const membros = b.cadeias.find((c) => c.tabela === "user_organizations")!;
    expect(filtros(membros)).toEqual([
      ["eq", "organization_id", "org-1"],
      ["is", "revoked_at", null],
      ["eq", "provisional_until_handover", false],
    ]);
    const canais = b.cadeias.find((c) => c.tabela === "channel_sessions")!;
    expect(filtros(canais)).toEqual([
      ["eq", "organization_id", "org-1"],
      ["is", "archived_at", null],
      ["neq", "provider", "wacalls"],
      // #3416: a vaga é do NÚMERO. Um `.or` só, porque o PostgREST encadeia com
      // AND — "tem número" E "não está morta" não é a régua (o canal pareado e
      // caído continua ocupando a vaga, que é exatamente o controle da issue).
      // A isenção da linha morta sem número é só do canal pareado por QR: nos
      // outros provedores o número não identifica a conexão.
      ["or", `provider.neq.${QR},phone_number.not.is.null,status.not.in.(FAILED,STOPPED)`],
    ]);
  });

  it("leitura que falha devolve null: quem chama responde 500, nunca 'cabe'", async () => {
    const b = bancoFalso((c) => (c.tabela === "channel_sessions" ? { error: { message: "boom" } } : { count: 1 }));
    expect(await lerUsoDaOrganizacao(b.cliente as unknown as SupabaseClient, "org-1")).toBeNull();
  });
});

// FORK (#160b): o upstream confere aqui os predicados dos gatilhos de limite
// (`fn_trava_assentos_do_plano`, `fn_trava_canais_do_plano`, `fn_vaga_ao_reviver_canal`).
// Eles chegam com o card #162; o caso volta junto com eles.
