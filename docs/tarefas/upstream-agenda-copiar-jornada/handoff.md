# upstream-agenda-copiar-jornada — handoff (#82, upstream #2460)

| Critério | Como ficou | Prova |
|---|---|---|
| 1 | "Copiar estes horários para os outros dias úteis" replica as faixas do dia-modelo (seg → ter–sex) | tela abaixo; `tests/unit/editor-da-jornada-copia-e-resumo.test.tsx` |
| 2 | Depois de salvar, o diálogo mostra o resumo do que o servidor gravou e só fecha quando a pessoa pede | `tests/unit/editor-da-jornada-copia-e-resumo.test.tsx` |
| 3 | Copiar mexe só no rascunho; nada é gravado sem "Salvar" | tela (a prova fechou sem salvar) |

Medido na 3001 (2026-11-05, Configurações › Profissionais › Horário de atendimento, sem salvar):

```
ABERTO dias com faixa: []                → botão de copiar desligado (sem janela não há o que copiar)
ANTES (segunda 08-18, sem salvar): ["1"]
botão copiar habilitado: true
DEPOIS dias com faixa: ["1","2","3","4","5"]
```

### Evidências de tela

- Diálogo com a faixa da segunda — `evidence/upstream-lote2/82-1-jornada-antes.png`
- Depois de "Copiar…": segunda a sexta com a mesma faixa — `evidence/upstream-lote2/82-2-jornada-copiada.png`
