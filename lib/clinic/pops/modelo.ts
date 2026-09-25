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

/** O mesmo modelo para quem usa o sistema em espanhol (a interface já é traduzida; o texto de partida também). */
const SECOES_ES: readonly [string, string][] = [
  ["1. IDENTIFICACIÓN", "Nombre del procedimiento, sector y a quién se aplica este POE."],
  ["2. OBJETIVO", "Para qué sirve este procedimiento y el resultado esperado."],
  ["3. ALCANCE", "Dónde y cuándo se aplica este POE."],
  ["4. RESPONSABILIDADES", "Quién ejecuta, quién supervisa y quién aprueba."],
  ["5. PROFESIONALES INVOLUCRADOS", "Especialidades y profesionales habilitados."],
  ["6. DEFINICIONES", "Términos y siglas usados en este documento."],
  ["7. MATERIALES E INSUMOS", "Lista de lo que se usa, con cantidades cuando corresponda."],
  ["8. EQUIPOS", "Aparatos necesarios y la verificación antes del uso."],
  ["9. EQUIPOS DE PROTECCIÓN PERSONAL — EPP", "EPP obligatorios para el profesional y para el paciente."],
  ["10. PREPARACIÓN DEL AMBIENTE", "Cómo debe estar la sala antes de empezar."],
  ["11. PREPARACIÓN DEL PACIENTE", "Orientaciones previas, verificaciones y consentimiento."],
  ["12. DESCRIPCIÓN DEL PROCEDIMIENTO", "Visión general de lo que se hará."],
  ["13. ETAPAS OPERATIVAS", "Paso a paso, en el orden de ejecución."],
  ["14. CUIDADOS DE BIOSEGURIDAD", "Medidas para evitar contaminación y accidentes."],
  ["15. LIMPIEZA / DESINFECCIÓN / PROCESAMIENTO", "Cuando corresponda."],
  ["16. GESTIÓN DE RESIDUOS", "Cuando corresponda."],
  ["17. ORIENTACIONES AL PACIENTE", "Qué debe hacer y evitar el paciente después."],
  ["18. CONDUCTAS ANTE INCIDENCIAS", "Qué hacer si algo sale de lo esperado."],
  ["19. REGISTROS NECESARIOS", "Qué debe quedar registrado y dónde."],
  ["20. REFERENCIAS TÉCNICAS / NORMATIVAS", "Normas, manuales y referencias utilizadas."],
  ["21. CONTROL DE REVISIONES", "Resumen de los cambios de cada versión (texto libre)."],
];

const paragrafo = (texto: string): NoDoDocumento => ({ type: "paragraph", content: [{ type: "text", text: texto, marks: [{ type: "italic" }] }] });

const montar = (secoes: readonly [string, string][]): Documento => ({
  type: "doc",
  content: secoes.flatMap(([titulo, guia]) => [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: titulo }] },
    paragrafo(guia),
  ]),
});

export const MODELO_PADRAO: Documento = montar(SECOES);
const MODELO_PADRAO_ES: Documento = montar(SECOES_ES);

/** O modelo no idioma de quem cria o POP (o documento é da clínica: depois disso, não muda de idioma). */
export function modeloPadrao(idioma: string | null | undefined): Documento {
  return idioma === "es" ? MODELO_PADRAO_ES : MODELO_PADRAO;
}

export const TITULOS_DO_MODELO: readonly string[] = SECOES.map(([t]) => t);
