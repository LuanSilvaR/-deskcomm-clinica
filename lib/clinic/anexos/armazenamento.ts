/**
 * FORK clinic (prontuário F7) — a PORTA de armazenamento dos arquivos clínicos.
 *
 * Hoje: o Supabase Storage que a instalação já tem (bucket privado
 * `clinical-files`, sem policy — só o service role, por aqui). Trocar para um
 * S3 barato (Cloudflare R2, Backblaze B2) no futuro é escrever outra
 * implementação desta interface, sem mexer em tela nem em banco.
 */
import { createAdminClient } from "@/lib/supabase/admin";

export const BUCKET_CLINICO = "clinical-files";
/** Vida da URL assinada: curta de propósito — vazou, expira sozinha. */
export const VALIDADE_DA_URL_SEGUNDOS = 60;

export interface ArmazenamentoClinico {
  salvar(caminho: string, bytes: Uint8Array, tipo: string): Promise<void>;
  urlTemporaria(caminho: string): Promise<string | null>;
  apagar(caminhos: string[]): Promise<void>;
}

export function armazenamentoClinico(): ArmazenamentoClinico {
  const bucket = () => createAdminClient().storage.from(BUCKET_CLINICO);
  return {
    async salvar(caminho, bytes, tipo) {
      const { error } = await bucket().upload(caminho, Buffer.from(bytes), { contentType: tipo, upsert: false });
      if (error) throw new Error(error.message);
    },
    async urlTemporaria(caminho) {
      const { data, error } = await bucket().createSignedUrl(caminho, VALIDADE_DA_URL_SEGUNDOS);
      return error || !data?.signedUrl ? null : data.signedUrl;
    },
    async apagar(caminhos) {
      // Só para desfazer um upload cujo registro no banco falhou (nada clínico
      // registrado é apagado).
      if (caminhos.length) await bucket().remove(caminhos);
    },
  };
}
