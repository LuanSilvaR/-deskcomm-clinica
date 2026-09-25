/**
 * FORK clinic (9015) — a recusa dos vínculos, com a mensagem que a tela mostra.
 */
import { fail } from "@/lib/api/wrappers";
import { falhaDoBanco } from "@/lib/clinic/api";
import type { FalhaDosVinculos } from "@/lib/clinic/procedimentos/servidor";

export function falhaDosVinculos(r: Exclude<FalhaDosVinculos, { ok: true }>, requestId: string, t: (s: string) => string): Response {
  if (r.motivo === "ids_de_outra_empresa") {
    return fail("validation_failed", t("Especialidade ou profissional não encontrado."), 422, { requestId });
  }
  if (r.motivo === "sem_especialidade") {
    return fail(
      "procedimento_profissional_sem_especialidade",
      t("Há profissional sem nenhuma das especialidades do procedimento."),
      422,
      { requestId, details: { profissionais: r.profissionais } },
    );
  }
  if (r.erro.message.includes("procedimento_profissional_sem_especialidade")) {
    return fail("procedimento_profissional_sem_especialidade", t("Há profissional sem nenhuma das especialidades do procedimento."), 422, {
      requestId,
    });
  }
  return falhaDoBanco(r.erro, requestId, t);
}
