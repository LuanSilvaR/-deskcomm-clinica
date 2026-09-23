import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cifrarCpf, decifrarCpf, hashCpf } from "./cpf";

function cliente(resposta: { data?: unknown; error?: { message: string } | null }) {
  const rpc = vi.fn(async () => ({ data: resposta.data ?? null, error: resposta.error ?? null }));
  return { cli: { rpc } as unknown as SupabaseClient, rpc };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cifrarCpf — o par hash + cifra, ou nada", () => {
  it("com chave e RPC ok devolve os DOIS campos (o CHECK contacts_cpf_consistency recusa metade)", async () => {
    vi.stubEnv("CPF_ENCRYPTION_KEY", "chave-de-teste-com-mais-de-16");
    const { cli, rpc } = cliente({ data: "\\xabc" });
    expect(await cifrarCpf(cli, "52998224725")).toEqual({ cpf_hash: hashCpf("52998224725"), cpf_encrypted: "\\xabc" });
    expect(rpc).toHaveBeenCalledWith("encrypt_cpf", { p_plaintext: "52998224725", p_key: "chave-de-teste-com-mais-de-16" });
  });

  it("sem chave não chama o banco e devolve null", async () => {
    vi.stubEnv("CPF_ENCRYPTION_KEY", "");
    const { cli, rpc } = cliente({ data: "\\xabc" });
    expect(await cifrarCpf(cli, "52998224725")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("RPC com erro ou sem retorno devolve null — nunca só o hash", async () => {
    vi.stubEnv("CPF_ENCRYPTION_KEY", "chave-de-teste-com-mais-de-16");
    expect(await cifrarCpf(cliente({ error: { message: "function does not exist" } }).cli, "52998224725")).toBeNull();
    expect(await cifrarCpf(cliente({ data: null }).cli, "52998224725")).toBeNull();
  });

  it("documento de outro país vai como está (com letras)", async () => {
    vi.stubEnv("CPF_ENCRYPTION_KEY", "chave-de-teste-com-mais-de-16");
    const { cli, rpc } = cliente({ data: "\\xabc" });
    await cifrarCpf(cli, " 123456789XI000 ");
    expect(rpc).toHaveBeenCalledWith("encrypt_cpf", expect.objectContaining({ p_plaintext: "123456789XI000" }));
  });
});

describe("decifrarCpf", () => {
  it("devolve o texto em claro", async () => {
    vi.stubEnv("CPF_ENCRYPTION_KEY", "chave-de-teste-com-mais-de-16");
    expect(await decifrarCpf(cliente({ data: "52998224725" }).cli, "\\xabc")).toBe("52998224725");
  });

  it("sem cifra não chama o banco", async () => {
    vi.stubEnv("CPF_ENCRYPTION_KEY", "chave-de-teste-com-mais-de-16");
    const { cli, rpc } = cliente({ data: "x" });
    expect(await decifrarCpf(cli, null)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});
