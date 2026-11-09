# Padrão de documentos — papel timbrado único

**Todo documento que o sistema gera sai de um motor só** (`lib/documentos/`), com um layout travado: o "papel timbrado padrão" (especificação **layoutVersion 2.0.0**, baseada no Design System v2.0 da Farias Rocha). Só mudam:
- o conteúdo do corpo;
- os dados da organização;
- a identidade visual.

Os dois últimos vêm de **Configurações › Organização** e **Configurações › Marca**.

Baseline visual: `Farias_Rocha_Papel_Timbrado_v2.pdf`. As amostras geradas pelo motor ficam em `evidence/documentos-timbrado/`.

## Arquitetura

| Arquivo | Papel |
|---|---|
| `lib/documentos/contexto-da-marca.ts` | **Contrato único com as Configurações.** `resolverContextoDaMarca(leitor, orgId)` lê a organização e a marca, baixa o logo e o favicon do bucket `brand-logos` (só sob o prefixo da própria organização) e devolve o `ContextoDaMarca` já formatado. `montarContextoDaMarca` é a parte pura, testável. **Nenhum template lê o banco.** |
| `lib/documentos/formatar.ts` | CNPJ (máscara e dígito verificador), telefone, site (sem protocolo nem www), endereço em 2 linhas, "Cidade – UF", responsável técnico. **Campo vazio devolve `null` e some.** |
| `lib/documentos/paleta.ts` | Os 7 papéis de cor (`ink`, `muted`, `primary`, `surface`, `border`, `accent`, `paper`), derivados da cor da marca com contraste WCAG garantido. Também as cores de estado das caixas de aviso. **Único lugar com hex.** |
| `lib/documentos/tema.ts` | Todas as medidas, tamanhos e espaçamentos da especificação, e `VERSAO_DO_LAYOUT`. **Único lugar com medida.** |
| `lib/documentos/fontes.ts` | Registra e pré-carrega Inter (400/700) e Cormorant Garamond (500/600). Os arquivos ficam em `public/fontes/documentos/`, com as licenças OFL. |
| `lib/documentos/imagens.ts` | Logo: recorte das margens transparentes, redução de peso e detecção de fundo opaco. Favicon. Silhueta tingida da marca d'água. `sharp` é carregado sob demanda. |
| `lib/documentos/blocos.tsx` | O corpo semântico: parágrafo, H1–H3, lista, tabela (cabeçalho repetido), aviso, linha e quebra. |
| `lib/documentos/renderizar.tsx` | O papel: faixa, cabeçalho completo e compacto, abertura, assinatura, marca d'água e rodapé. `renderizarDocumento(doc, contexto)`. |

## Contrato do `ContextoDaMarca`

| Campo | Origem | Regra |
|---|---|---|
| `nomeDaMarca` | Marca › nome; senão o nome de exibição, a razão social ou "Documento" | Nunca vazio |
| `razaoSocial` | Organização › razão social; senão `nomeDaMarca` | Rodapé, em negrito |
| `descritor` | Organização › descritor (D2) | Some se vazio |
| `site` | Organização › site (D2) | Exibe sem `https://` nem `www.` |
| `contatos` | Organização › telefone (8011) e WhatsApp (D2) | Iguais viram "Telefone / WhatsApp (DD) …" |
| `enderecoLinha`, `cidadeUf`, `cidadeUfCep` | Organização › endereço (8011) | Só as partes que existem |
| `cnpj` | Organização › CNPJ | Só se os dígitos conferem; senão some e gera aviso |
| `responsavel` | Organização › responsável técnico e registro (D2) | "Responsável técnica: Nome · Registro" |
| `simbolo` | Marca › logo, se compacto (até 1,6:1); senão o favicon | Coluna do logo e marca d'água |
| `favicon` | Marca › favicon (8012) | Cabeçalho compacto |
| `marcaDagua` | Silhueta do símbolo tingida de `primary` | Só se o símbolo for transparente e tiver ≥ 600 px (logo) ou ≥ 512 px (favicon) |
| `cores` | Marca › cor (semente) e cor dos filetes (D2) | 7 papéis, com WCAG |
| `avisos` | O que não saiu como cadastrado | Para a tela e o log |

**Modo modelo em branco** (`modeloEmBranco: true`): campo vazio vira `[placeholder]`. Serve só para gerar o modelo. Documento emitido nunca usa.

## Como criar um tipo novo de documento

1. Monte um `DocumentoTimbrado` com:
   - `tipo` (eyebrow) e `numero`;
   - `titulo`;
   - `metadados`: linhas `[rótulo, valor]`, das quais as vazias somem; padrão DATA, DESTINATÁRIO(A), ASSUNTO;
   - `avisos`, se houver;
   - `corpo`: árvore de nós do editor (`lib/clinic/pops/documento.ts`) mais o nó `aviso`;
   - `assinatura`, se houver;
   - `emitidoEm`.
2. Na rota, use `resolverContextoDaMarca(supabase, orgId)` com o **orgId da sessão ou do token**, nunca do corpo da requisição.
3. Chame `renderizarDocumento(doc, contexto)` e devolva `application/pdf`.

Exemplo de referência: `lib/clinic/pops/impressao.ts` + `app/api/v1/clinic/pops/versoes/[id]/pdf/route.ts`.

## O que NÃO pode

- Template com cor, fonte, margem, `StyleSheet` ou dado da empresa. Reprova em `tests/unit/documentos-sem-hardcode.test.ts`.
- Estilo próprio por tipo de documento.
- `accent` (dourado) em texto.
- Redesenhar ou recolorir o logo. A marca d'água é a silhueta, por regra da especificação.
- Inventar dado faltante (CNPJ, registro, endereço): omita, e o `avisos` sinaliza.
- `new Date()` dentro do motor: as datas do PDF vêm de `emitidoEm`, para garantir determinismo.

## Divergências registradas em relação ao PDF de referência

- **Entrelinha do wordmark:** a especificação pede entrelinha exata de 15 pt para um corpo de 26 pt. No react-pdf, entrelinha menor que o corpo troca a fonte e sobrepõe o descritor, então o motor usa 1,0 com o descritor logo abaixo. O desenho fica o mesmo.
- **Entrelinha do rodapé:** sem `lineHeight` (o react-pdf descarta texto absoluto com `lineHeight`). O espaçamento vem de margem.
- **Itálico:** sem fonte itálica registrada. Texto em itálico do editor sai no peso normal.
- **Tabela que atravessa páginas:** o cabeçalho repete, mas o react-pdf deixa um vão de uma linha embaixo dele na página seguinte.
- **Logo horizontal:** quando o logo cadastrado já traz o nome escrito, o símbolo do cabeçalho e da marca d'água é o favicon.

## Fases da migração

| Fase | Escopo | Estado |
|---|---|---|
| D1 | Motor, fontes, testes; POP migrado | PR #125 |
| D2 | Campos novos: site, WhatsApp, descritor, responsável técnico e registro (Organização, migration 8013); cor dos filetes e "Baixar modelo do papel timbrado" (Marca) | PR do D2 |
| D3 | PDF dos termos emitidos (`GET /api/v1/clinic/documentos/[id]/pdf` + "Baixar PDF" na aba Documentos) e do contrato do orçamento; snapshot da marca fixado na 1ª geração (migration 8014) | PR do D3 |
| D4 | Prontuário e exportação LGPD no motor | a seguir |
