# #140 — Papel timbrado: cabeçalho usa o favicon no lugar da logo horizontal

Issue: https://github.com/LuanSilvaR/-deskcomm-clinica/issues/140 · épico #123.

## Sintoma
PDF do POP-001 (Bioestimulador de colágeno) saía com o favicon "FR" + o nome em texto no cabeçalho,
enquanto Configurações › Marca tinha a logo horizontal (figura + FARIAS ROCHA + ESTÉTICA AVANÇADA, 3:1).

## Causa raiz
`montarContextoDaMarca` só aceitava a logo como símbolo até 1,6:1; acima disso, o favicon tomava o lugar
e o cabeçalho escrevia o nome. A logo horizontal nunca chegava ao papel.

## Correção
- `ContextoDaMarca.logoDoCabecalho`: a logo quando é horizontal; `null` quando é compacta ou ausente.
- `CabecalhoCompleto`: com `logoDoCabecalho`, desenha a logo no espaço símbolo + wordmark (100,8 × 19 mm), sem o nome em texto.
- `CabecalhoCompacto`: mesma logo, 10 mm de altura (até 45 mm de largura). Na altura do favicon (6 mm) ficava ilegível.
- Marca d'água e logo compacta: sem mudança. `VERSAO_DO_LAYOUT` 2.0.0 → 2.1.0.
- Todos os documentos passam por `renderizarDocumento`: POP, prontuário, termos/contratos, LGPD, modelo em branco.

Documento **já emitido** (termos/contratos) continua com a logo do dia da emissão (`marca_snapshot`, regra da D3) —
o que muda é o desenho: se a logo do snapshot for horizontal, ela agora aparece inteira.

## Evidência
- antes, página 1 — `evidence/140-pop-antes-p1.png`
- depois, página 1 — `evidence/140-pop-depois-p1.png`
- depois, cabeçalho compacto da página 2 — `evidence/140-pop-depois-p2-topo.png`

Testes novos em `tests/unit/documentos-timbrado-pdf.test.ts` (falharam antes da correção, passam depois).
