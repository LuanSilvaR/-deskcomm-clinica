/**
 * FORK clinic (estoque E9) — capacidade de ESTOQUE da clínica: consultar saldo,
 * validade e alertas de um produto. Só leitura, sem paciente e sem custo.
 */
import { declararTools } from "./tipos";

export const TOOLS_ESTOQUE = declararTools([
  {
    name: "crm_estoque_consultar",
    category: "read",
    rotulo: "Consultar o estoque da clínica",
    explicacao:
      "Mostra quanto há de um produto no estoque, quanto já está reservado para atendimentos, a próxima validade e os alertas abertos, para o assistente responder à equipe sem chutar quantidade.",
    oQueToca: "Estoque da clínica",
    risco: "seguro",
    pacotes: ["organizar"],
  },
]);
