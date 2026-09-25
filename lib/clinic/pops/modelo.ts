/**
 * FORK clinic (9015) — o MODELO inicial do POP: só texto de partida.
 *
 * Os 21 títulos não viram campos nem colunas; depois de carregados no editor,
 * quem escreve apaga, reordena, acrescenta ou troca tudo. O "Controle de
 * revisões" daqui é texto do documento — o histórico oficial é o das versões.
 */
import type { Documento, NoDoDocumento } from "./documento";

const SECOES: readonly [string, string][] = [
  ["1. IDENTIFICAÇÃO", "Nome do procedimento, setor e a quem este POP se aplica."],
  ["2. OBJETIVO", "Para que serve este procedimento e o resultado esperado."],
  ["3. ABRANGÊNCIA", "Onde e quando este POP se aplica."],
  ["4. RESPONSABILIDADES", "Quem executa, quem supervisiona e quem aprova."],
  ["5. PROFISSIONAIS ENVOLVIDOS", "Especializações e profissionais habilitados."],
  ["6. DEFINIÇÕES", "Termos e siglas usados neste documento."],
  ["7. MATERIAIS E INSUMOS", "Lista do que é usado, com quantidades quando fizer sentido."],
  ["8. EQUIPAMENTOS", "Aparelhos necessários e a checagem antes do uso."],
  ["9. EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL — EPI", "EPIs obrigatórios para o profissional e para o paciente."],
  ["10. PREPARAÇÃO DO AMBIENTE", "Como a sala deve estar antes de começar."],
  ["11. PREPARAÇÃO DO PACIENTE", "Orientações prévias, conferências e consentimento."],
  ["12. DESCRIÇÃO DO PROCEDIMENTO", "Visão geral do que será feito."],
  ["13. ETAPAS OPERACIONAIS", "Passo a passo, na ordem de execução."],
  ["14. CUIDADOS DE BIOSSEGURANÇA", "Medidas para evitar contaminação e acidentes."],
  ["15. LIMPEZA / DESINFECÇÃO / PROCESSAMENTO", "Quando aplicável."],
  ["16. GERENCIAMENTO DE RESÍDUOS", "Quando aplicável."],
  ["17. ORIENTAÇÕES AO PACIENTE", "O que o paciente deve fazer e evitar depois."],
  ["18. CONDUTAS EM INTERCORRÊNCIAS", "O que fazer se algo sair do esperado."],
  ["19. REGISTROS NECESSÁRIOS", "O que precisa ficar registrado e onde."],
  ["20. REFERÊNCIAS TÉCNICAS / NORMATIVAS", "Normas, manuais e referências usadas."],
  ["21. CONTROLE DE REVISÕES", "Resumo das mudanças de cada versão (texto livre)."],
];

const paragrafo = (texto: string): NoDoDocumento => ({ type: "paragraph", content: [{ type: "text", text: texto, marks: [{ type: "italic" }] }] });

export const MODELO_PADRAO: Documento = {
  type: "doc",
  content: SECOES.flatMap(([titulo, guia]) => [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: titulo }] },
    paragrafo(guia),
  ]),
};

export const TITULOS_DO_MODELO: readonly string[] = SECOES.map(([t]) => t);
