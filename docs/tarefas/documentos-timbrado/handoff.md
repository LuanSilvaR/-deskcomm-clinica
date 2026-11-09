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
- **Limite:** se o logo ou o favicon forem trocados, o arquivo antigo é apagado pelas rotas de marca, e a reimpressão de um documento antigo sai com o wordmark em texto. Os textos e as cores continuam os do snapshot.
- **Evidência:** `evidence/documentos-timbrado/contrato-orcamento-demo.pdf` (contrato real da demo, aceito).

## D4 — prontuário e LGPD
- **Prontuário:** `lib/clinic/prontuario/pdf.ts` só monta o conteúdo. O aviso de dados de saúde vai em todas as páginas e os alertas clínicos em caixa de perigo. A página `/imprimir/prontuario/:id` passou a só redirecionar para o PDF, que já faz o escopo de paciente (a página antiga não fazia), o limite e a auditoria. Saiu `components/clinic/prontuario/ProntuarioImpressao.tsx`.
- **LGPD:** `lgpdParaTimbrado` preserva as frases e a ordem das seções. A linha do CONTROLADOR (razão social) e o encarregado vão no corpo e fixos em todas as páginas. O worker passa o contexto da marca da organização do pedido.
- **Testes no Windows:** `lgpd-pdf-meet` e `lgpd-pdf-replies` falham neste Windows também na develop limpa (`Invalid factory url … standard_fonts`, caminho com barra invertida no pdfjs). Não é regressão; a prova é o CI (Linux).
- **Evidência:** `evidence/documentos-timbrado/prontuario-timbrado.pdf` e `lgpd-timbrado.pdf` (dados fictícios).
