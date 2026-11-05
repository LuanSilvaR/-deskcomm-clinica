# upstream-agenda-titulo-livre — handoff (#81, upstream #3775)

Decisão do dono (2026-11-04): entra **com flag** — `settings.clinic.titulo_livre`, nasce desligada (migration 8003).

| Critério | Como ficou | Prova |
|---|---|---|
| 1 | "Título do compromisso (opcional)" na marcação; em branco grava o nome do tipo | `tests/unit/agenda-titulo-livre.test.tsx` (corpo do POST com/sem `title`) + tela |
| 2 | O título aparece na grade/lista | `tests/unit/agenda-titulo-livre.test.tsx` ("o texto gravado em `title` aparece na tela") |
| 3 | Só aparece com a opção da clínica ligada; desligada, a tela não oferece o campo | tela abaixo; teste "o campo nasce desligado por clínica" |
| 5 | A opção nasce desligada; só administrador liga (admin + MFA) | `tests/invariants/clinic-titulo-livre-opcao.test.ts` |

Medido na 3001 (2026-11-05; 8003 aplicada no banco local, opção ligada e depois desligada pelo banco):

```
LIGADA:    GET /clinic/config titulo_livre: true  · "Título livre ligado" · campo de título visível: 1
DESLIGADA: GET /clinic/config titulo_livre: false · "Título livre desligado" · campo de título visível: 0
```

Nota LGPD: o título vai para o paciente no lembrete e no convite (texto de ajuda do campo diz isso); por padrão nada muda.

### Evidências de tela

- A opção em Configurações › Profissionais — `evidence/upstream-lote2/81-1-opcao-titulo-livre.png`
- Novo agendamento com o campo preenchido — `evidence/upstream-lote2/81-2-campo-titulo.png`
- Opção desligada: o painel de marcar sem o campo — `evidence/upstream-lote2/81-4-sem-campo.png`
