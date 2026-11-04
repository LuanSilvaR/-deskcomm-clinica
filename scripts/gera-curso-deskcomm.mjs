// Gera docs/curso-deskcomm/*.md a partir do JSON embutido em https://www.deskcomm.com.br/curso.
// Uso: node scripts/gera-curso-deskcomm.mjs <dados.json> docs/curso-deskcomm
// <dados.json> = conteúdo do <script id="dados" type="application/json"> da página do curso.
import fs from "node:fs";
import path from "node:path";
const [, , entrada, saida] = process.argv;
const j = JSON.parse(fs.readFileSync(entrada, "utf8"));
const URL_CURSO = "https://www.deskcomm.com.br/curso";

const PAPEL = { admin: "Administrador", manager: "Gerente", agent: "Atendente" };
const slug = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const limpa = (s) => String(s ?? "").replace(/\r?\n+/g, " ").replace(/\|/g, "\\|").trim();

const modPorId = new Map(j.modulos.map((m) => [m.id, m]));
const arquivoDoGrupo = new Map();
const grupoDoModulo = new Map();
for (const g of j.menu) {
  arquivoDoGrupo.set(g.grupo, slug(g.grupo) + ".md");
  for (const i of g.itens) grupoDoModulo.set(i.modulo, g.grupo);
}
const linkModulo = (id, de = "") => {
  const m = modPorId.get(id);
  const g = grupoDoModulo.get(id);
  if (!m || !g) return id;
  const arq = arquivoDoGrupo.get(g);
  return `[${m.titulo}](${de === arq ? "" : arq}#m-${id})`;
};
const linkLicao = (mid, lid, de = "") => {
  const m = modPorId.get(mid);
  const l = m?.licoes.find((x) => x.id === lid);
  const g = grupoDoModulo.get(mid);
  if (!m || !l || !g) return `${mid} › ${lid}`;
  const arq = arquivoDoGrupo.get(g);
  return `[${m.titulo} › ${l.titulo}](${de === arq ? "" : arq}#l-${mid}--${lid})`;
};

const cabecalho = (titulo) =>
  `# ${titulo}\n\n> Gerado a partir do [curso oficial do DeskComm](${URL_CURSO}) — versão ${j.versao}, ` +
  `gerado em ${j.gerado}. Conteúdo do **núcleo do DeskcommCRM (upstream)**; o que o fork de clínicas ` +
  `acrescenta está em [\`docs/funcionalidades.md\`](../funcionalidades.md). As capturas de tela de cada passo ` +
  `ficam no curso online.\n\n`;

fs.mkdirSync(saida, { recursive: true });

// Um arquivo por grupo do menu.
for (const g of j.menu) {
  const arq = arquivoDoGrupo.get(g.grupo);
  let md = cabecalho(`Curso DeskComm — ${g.grupo}`);
  md += `[← Índice do curso](README.md)\n\n## Módulos deste grupo\n\n| Módulo | Tela | Lições | Para que serve |\n|---|---|---|---|\n`;
  for (const i of g.itens) {
    const m = modPorId.get(i.modulo);
    if (!m) continue;
    md += `| ${linkModulo(m.id, arq)} | ${m.tela ? "`" + m.tela + "`" : "—"} | ${m.licoes.length} | ${limpa(i.descricao || m.resumo)} |\n`;
  }
  for (const i of g.itens) {
    const m = modPorId.get(i.modulo);
    if (!m) continue;
    md += `\n---\n\n<a id="m-${m.id}"></a>\n\n## ${m.titulo}\n\n`;
    if (m.tela) md += `**Tela:** \`${m.tela}\`  \n`;
    md += `**Resumo:** ${limpa(m.resumo)}\n\n`;
    md += `**Lições:** ${m.licoes.map((l) => `[${l.titulo}](#l-${m.id}--${l.id})`).join(" · ")}\n`;
    for (const l of m.licoes) {
      md += `\n<a id="l-${m.id}--${l.id}"></a>\n\n### ${l.titulo}\n\n`;
      md += `- **Objetivo:** ${limpa(l.objetivo)}\n`;
      md += `- **Papel mínimo:** ${PAPEL[l.papel] || l.papel || "—"}\n`;
      if (l.busca?.length) md += `- **Busca no curso:** ${l.busca.map(limpa).join("; ")}\n`;
      md += `\n`;
      l.passos.forEach((p, k) => {
        md += `${k + 1}. **${limpa(p.titulo)}**${p.rota ? ` — \`${p.rota}\`` : ""}  \n   ${limpa(p.texto)}\n`;
        if (p.dica) md += `   > 💡 ${limpa(p.dica)}\n`;
      });
    }
  }
  fs.writeFileSync(path.join(saida, arq), md);
}

// Nichos e jornadas.
{
  let md = cabecalho("Curso DeskComm — Nichos e jornadas");
  md += `[← Índice do curso](README.md)\n\nRoteiros demonstrativos por segmento, com empresas, pessoas e mensagens fictícias. ` +
    `Cada jornada diz o que precisa estar configurado (dependências), quais lições montam o cenário e as cenas do atendimento.\n\n`;
  md += `| Nicho | Resumo | Jornadas |\n|---|---|---|\n`;
  for (const n of j.nichos) md += `| [${n.titulo}](#n-${n.id}) | ${limpa(n.resumo)} | ${n.jornadas.length} |\n`;
  for (const n of j.nichos) {
    md += `\n---\n\n<a id="n-${n.id}"></a>\n\n## ${n.titulo}\n\n${limpa(n.resumo)}\n`;
    for (const jo of n.jornadas) {
      md += `\n### ${limpa(jo.titulo)}\n\n`;
      md += `- **Empresa (fictícia):** ${limpa(jo.empresa)}\n- **Contexto:** ${limpa(jo.contexto)}\n- **Resultado:** ${limpa(jo.resultado)}\n`;
      md += `- **Dependências:** ${limpa(jo.dependencias)}\n- **Nota:** ${limpa(jo.nota)}\n`;
      if (jo.montagem?.length) {
        md += `\n**Como montar (lições do curso):**\n\n`;
        for (const x of jo.montagem) md += `- ${linkLicao(x.modulo, x.licao, "nichos.md")} — ${limpa(x.porque)}\n`;
      }
      if (jo.cenas?.length) {
        md += `\n**Cenas:**\n\n| Cena | Cliente | Operação | Valor |\n|---|---|---|---|\n`;
        for (const c of jo.cenas) md += `| ${limpa(c.titulo)} | ${limpa(c.cliente)} | ${limpa(c.operacao)} | ${limpa(c.valor)} |\n`;
      }
    }
  }
  fs.writeFileSync(path.join(saida, "nichos.md"), md);
}

// Índice.
{
  const L = j.modulos.reduce((a, m) => a + m.licoes.length, 0);
  const P = j.modulos.reduce((a, m) => a + m.licoes.reduce((b, l) => b + l.passos.length, 0), 0);
  let md = cabecalho("Curso DeskComm — índice");
  md += `**${j.modulos.length} módulos · ${L} lições · ${P} passos · ${j.nichos.length} nichos com ` +
    `${j.nichos.reduce((a, n) => a + n.jornadas.length, 0)} jornadas.** O curso também existe em inglês e espanhol no site.\n\n`;
  md += `Papel mínimo de cada lição: **Administrador** (admin), **Gerente** (manager) ou **Atendente** (agent).\n\n`;
  md += `## Mapa do menu\n\n`;
  for (const g of j.menu) {
    const arq = arquivoDoGrupo.get(g.grupo);
    const nl = g.itens.reduce((a, i) => a + (modPorId.get(i.modulo)?.licoes.length || 0), 0);
    md += `### [${g.grupo}](${arq}) — ${g.itens.length} módulos, ${nl} lições\n\n| Item do menu | Rota | Para que serve |\n|---|---|---|\n`;
    for (const i of g.itens) md += `| ${linkModulo(i.modulo)} | \`${i.href}\` | ${limpa(i.descricao)} |\n`;
    md += `\n`;
  }
  md += `## Diferenças no fork de clínicas\n\nO curso descreve o **núcleo**. Com as opções da clínica ligadas, algumas telas mudam: ` +
    `a Agenda abre **um profissional por vez** e o profissional vê só a própria agenda e os próprios pacientes; ` +
    `a Recepção conduz a visita até "pronto"; prontuário, procedimentos/POP, estoque e papéis de acesso são do fork. ` +
    `Ver [\`docs/funcionalidades.md\`](../funcionalidades.md) antes de seguir um passo do curso nessas áreas.\n\n`;
  md += `## [Nichos e jornadas](nichos.md)\n\n`;
  for (const n of j.nichos) md += `- [${n.titulo}](nichos.md#n-${n.id}) — ${limpa(n.resumo)}\n`;
  md += `\n## Como atualizar\n\nO curso é gerado pelo upstream a cada versão. Para regerar esta pasta: baixar ${URL_CURSO}, ` +
    `extrair o JSON do \`<script id="dados">\` e rodar \`node scripts/gera-curso-deskcomm.mjs <dados.json> docs/curso-deskcomm\` ` +
    `(mesmo formato: \`modulos[].licoes[].passos[]\`, \`menu\`, \`nichos\`).\n`;
  fs.writeFileSync(path.join(saida, "README.md"), md);
}
console.info("ok:", fs.readdirSync(saida).join(", "));
