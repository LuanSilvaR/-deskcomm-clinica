/**
 * FORK clinic (prontuário F2/F9) — a resposta de um campo como texto legível.
 * Puro (sem React): serve à tela e ao PDF gerado no servidor.
 */
import type { Campo } from "@/lib/clinic/formularios/campos";

export function valorLegivel(campo: Campo, valor: unknown, t: (s: string) => string): string {
  if (
    valor === null ||
    valor === undefined ||
    valor === "" ||
    (Array.isArray(valor) && valor.length === 0)
  )
    return "—";
  const rotulo = (v: unknown) => campo.opcoes?.find((o) => o.valor === v)?.rotulo ?? String(v);
  switch (campo.tipo) {
    case "sim_nao":
      return valor === true ? t("Sim") : t("Não");
    case "escolha":
      return t(rotulo(valor));
    case "multipla":
      return (valor as unknown[]).map((v) => t(rotulo(v))).join(", ");
    case "data":
      return String(valor).split("-").reverse().join("/");
    default:
      return String(valor);
  }
}
