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
