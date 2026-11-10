# Handoff — papel timbrado único (D1: motor + POP)

Padrão completo: [`docs/padrao-documentos.md`](../../padrao-documentos.md). Especificação: "Papel timbrado padrão", layoutVersion 2.0.0.

## O que entrou (D1)
- **Motor único em `lib/documentos/`:** contexto da marca, formatação, paleta (7 papéis com WCAG), tema (tokens), fontes (Inter e Cormorant, OFL, em `public/fontes/documentos/`), imagens (recorte, peso, silhueta da marca d'água), blocos do corpo e o papel.
- **POP migrado:** `lib/clinic/pops/impressao.ts` entrega só conteúdo; a rota usa `resolverContextoDaMarca`. A versão não vigente leva aviso no bloco de abertura e numa linha acima do rodapé de TODAS as páginas.
- **`sharp` como dependência direta,** na mesma versão (registrado no UPSTREAM.md).
- **Modo modelo em branco** para gerar o modelo com `[placeholders]`.

## Testes
- `tests/unit/documentos-formatar-e-paleta.test.ts`: CNPJ, site, telefone/WhatsApp, endereço, responsável; contraste dos papéis com várias cores de marca.
- `tests/unit/documentos-timbrado-pdf.test.ts`: símbolo, logo opaco, recorte, CNPJ inválido; PDF A4, fontes embutidas, acentos, campo vazio some, determinismo.
- `tests/unit/clinic-pop-impressao.test.ts`: o POP no papel novo, incluindo o "NÃO VIGENTE" em todas as páginas.
- `tests/unit/documentos-sem-hardcode.test.ts`: só o motor gera PDF. A lista A_MIGRAR (contrato, prontuário e LGPD) só encolhe.

## Evidência (gerada pelo motor com os arquivos da Farias Rocha)
- `evidence/documentos-timbrado/timbrado-modelo-em-branco.pdf`: o modelo, para comparar com `Farias_Rocha_Papel_Timbrado_v2.pdf`. Aprovado pelo dono em 2026-11-08.
- `evidence/documentos-timbrado/timbrado-preenchido.pdf`: documento de 2 páginas (cabeçalho compacto, lista, tabela longa, aviso, assinatura).

## Defeitos achados e corrigidos no caminho
- **Fontes em `render`:** o react-pdf só pré-carrega as fontes que vê na árvore, e cabeçalho/rodapé nascem dentro de `render`. O wordmark caía na Helvetica-Bold. Correção: `carregarFontes()` antes de desenhar.
- **Texto aninhado em `render`:** perde a família da fonte. O negrito de "Página X de Y" leva a família explícita.
- **Rodapé absoluto com `lineHeight`:** sumia por inteiro. O rodapé usa margem no lugar de entrelinha.

## Próximo
D2 (campos novos), D3 (termos e contrato com snapshot) e D4 (prontuário e LGPD). Ver as fases no padrão.

## D3 — termos e contrato
- **Migration 8014:** `clinic_documentos_emitidos.marca_snapshot` e `layout_versao`. `fn_clinic_documento_fixar_marca` grava uma vez; `trg_clinic_documento_marca_fixa` recusa mudar.
- **`lib/clinic/documentos/timbrado.ts`** (puro): texto congelado em blocos; situação, validade, aceite e integridade nos metadados; aviso em todas as páginas quando o documento foi revogado ou cancelado.
- **`lib/clinic/documentos/pdf-servidor.ts`:** lê o documento (filtrado pela organização), fixa o snapshot na 1ª geração e gera o PDF com ele.
- **Rota `GET /api/v1/clinic/documentos/[id]/pdf`** (`documentos.ver` + escopo de paciente) e botão **Baixar PDF** na aba Documentos.
- **O contrato do orçamento** usa o mesmo gerador, com o número do orçamento. Saiu `lib/clinic/orcamentos/pdf.tsx`.
- **Limite:** se o logo ou o favicon forem trocados, o arquivo antigo é apagado pelas rotas de marca, e a reimpressão de um documento antigo sai com o wordmark em texto. Os textos continuam os do snapshot; as cores seguem as Configurações atuais (ver "Correções pós-teste").
- **Evidência:** `evidence/documentos-timbrado/contrato-orcamento-demo.pdf` (contrato real da demo, aceito).

## D4 — prontuário e LGPD
- **Prontuário:** `lib/clinic/prontuario/pdf.ts` só monta o conteúdo. O aviso de dados de saúde vai em todas as páginas e os alertas clínicos em caixa de perigo. A página `/imprimir/prontuario/:id` passou a só redirecionar para o PDF, que já faz o escopo de paciente (a página antiga não fazia), o limite e a auditoria. Saiu `components/clinic/prontuario/ProntuarioImpressao.tsx`.
- **LGPD:** `lgpdParaTimbrado` preserva as frases e a ordem das seções. A linha do CONTROLADOR (razão social) e o encarregado vão no corpo e fixos em todas as páginas. O worker passa o contexto da marca da organização do pedido.
- **Testes no Windows:** `lgpd-pdf-meet` e `lgpd-pdf-replies` falham neste Windows também na develop limpa (`Invalid factory url … standard_fonts`, caminho com barra invertida no pdfjs). Não é regressão; a prova é o CI (Linux).
- **Evidência:** `evidence/documentos-timbrado/prontuario-timbrado.pdf` e `lgpd-timbrado.pdf` (dados fictícios).

## Correções pós-teste (dono, 2026-11-09)
- **#124 — POP com tabela não salvava (PR #134).** O editor (TipTap 3.31) grava `align` em cada célula; a validação recusava atributos desconhecidos (`.strict()`) e o documento inteiro caía. O autosave falhava em silêncio e o **Aprovar** aprovava o último trecho salvo (por isso o PDF saía cortado).
  - `lib/clinic/pops/documento.ts`: atributo desconhecido é **descartado**; tipos de nó e marcas seguem estritos.
  - Limite do conteúdo **1 MB → 5 MB** (pedido do dono: POPs maiores), na aplicação e no CHECK do banco — **migration 8015** (`clinic_pop_versions_documento_check`).
  - Tela: falha ao salvar mostra o motivo (`pop-erro-ao-salvar`) e o **Aprovar** fica travado com texto não salvo.
  - O POP-002 v2.0 já aprovado continua cortado: criar nova versão e colar de novo.
- **#126 — cor do papel timbrado (PR #135).** A cor escolhida só ia para os filetes (0,7 mm), e o PDF parecia ter uma cor só. Decisão do dono: "tudo na cor escolhida".
  - `lib/documentos/paleta.ts`: a **Cor do papel timbrado** (`settings.clinic.cor_filetes`, nome histórico) é a **semente** da paleta inteira; vazia, vale a cor da Marca. WCAG mantido (cor clara escurece só a luminosidade).
  - Caixa de aviso / rótulo de versão ("VERSÃO … — RASCUNHO — NÃO APROVADO") e a linha fixa das páginas usam a **paleta** (`coresDoAviso`), não mais o amarelo fixo.
  - Termos e contratos já emitidos: o snapshot congela textos, nomes e logo; **as cores vêm das Configurações atuais** (`comCoresAtuais`).
  - Teste que lê os operadores de cor (`scn`) de dentro do PDF: a cor nova está, a antiga e o amarelo não.

## Massa de teste para validação (banco local)
`docs/tarefas/documentos-timbrado/massa-de-teste.sql` — dados fictícios na demo Farias Rocha, IDs `fee10000-…` (idempotente).
- **Paciente "Helena Teste Timbrado"** (`fee10000-0001-…-000000000001`): ficha → `?aba=prontuario` e `?aba=documentos`.
- **#124:** POP-003 Toxina botulínica com 3 tabelas e listas — 1.0 substituída, 2.0 aprovada, 2.1 rascunho.
- **#128:** um termo de cada tipo e estado — consentimento aceito, autorização emitida, uso de imagem aceito, ciência revogada, contrato cancelado (com motivo), contrato de pacote aceito. Sem snapshot: o 1º PDF fixa.
- **#130:** prontuário com alergias/alertas, 2 atendimentos finalizados com evolução e 1 adendo; pedido LGPD da Helena processado pelo `processLgpdExport`.
- **Defeito encontrado (núcleo, fora do escopo):** sem e-mail de entrega, o worker LGPD grava `status = 'pending_review'`, que o CHECK de `lgpd_requests` não aceita — o pedido fica em `processing`. Na massa, o pedido foi marcado `completed` à mão com o `pdf_path` gerado.

## Validação e estado (2026-11-09)
- Dono validou no ambiente de desenvolvimento (3001, com a `develop` + massa): POP com tabelas, cores do papel em POP, termos, contrato, prontuário e LGPD, e o rótulo de versão na paleta. Pediu o merge e a movimentação para **Em integração**.
- PRs mergeados: #125, #127, #129, #131 (D1–D4), #134 (#124), #135 (#126). CI verde em todos.
- Cards #123, #124, #126, #128, #130 → **Em integração**. Próximo passo: promoção develop → main → VPS.
