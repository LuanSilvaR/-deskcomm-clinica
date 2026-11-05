# upstream-agenda-fechar-horas — handoff (#79, upstream #3888)

| Critério | Como ficou | Prova |
|---|---|---|
| 1 | "Fechar só algumas horas" (Das/Até) em Dias fora da rotina; o resto do dia segue a jornada | `app/api/v1/agenda/excecoes/route.test.ts`, `components/agenda/DiasBloqueados.test.tsx` |
| 2 | A grade mostra a faixa fechada hachurada, com "Fechado", o profissional e o motivo | tela abaixo; `components/agenda/GradeDaAgenda.fechamentos.test.tsx` |
| 3/4 | Os horários da faixa deixam de ser oferecidos (camada de marcação e horários livres) | tela abaixo (14h–16h sem bloco livre, 13h e 16h–19h livres); `lib/agenda/horarios-livres.ts` |

Medido na 3001 (2026-11-05, semana de 8 a 14/11, Dr. Bruno — terça 13h–19h na jornada). A faixa foi criada pela API e apagada no fim da prova:

```
criar faixa fechada 14:00–16:00 → 201 ok
faixa na grade: 1 texto: Fechado · Dr. Bruno Vasconcelos · Treinamento · 14:00–16:00
apagar faixa (limpeza) → 200
```

### Evidências de tela

- Terça: 14h–16h fechadas e hachuradas, o resto da tarde livre — `evidence/upstream-lote2/79-1-faixa-fechada-na-grade.png`
