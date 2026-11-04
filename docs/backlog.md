# Backlog — fluxo e estágios

Quadro: **[Backlog Clínica](https://github.com/users/LuanSilvaR/projects/3)** (GitHub Projects).
Fonte da verdade do estado: issues, labels e PRs do repositório `LuanSilvaR/-deskcomm-clinica`.
Especificação de cada item: `docs/tarefas/<id>/` (`historia.md`, `impacto.md`, `plano.md`, `handoff.md`).

## Estágios

| Coluna do quadro | Label | Entra quando | Quem move |
|---|---|---|---|
| Backlog | — | issue criada; critérios ainda a refinar | `/tarefa` (passo 0) |
| Dev | `status: dev` | PR aberto para `develop` com a evidência do Verify | `/tarefa` ao abrir o PR |
| Teste | `status: test` | PR mergeado na `develop` e CI verde; rodar integração/E2E | Claude, após o merge |
| Homologação | `status: staging` | testes de integração/E2E verdes; validação na **3001** | Claude, só com o E2E rodado |
| Concluído | `status: done` | validado na 3001 e publicado na **VPS (Hostinger KVM2)**; issue fechada | dono do produto |

Regras:
- Nenhuma issue vai para Homologação sem os testes de integração/E2E executados e anexados na issue.
- Concluído exige a palavra do dono — Claude não fecha issue sozinho.
- Feature G = issue épico + sub-issues (relação pai-filho real, API `sub_issues`), uma por sprint/história.
- PR usa `Refs #N` (não `Closes`): o merge na `develop` não encerra a issue, só a leva para Teste.

## Comandos úteis

```bash
R=LuanSilvaR/-deskcomm-clinica
gh issue create -R $R --title "..." --body "..."                     # nova issue
gh api -X POST repos/$R/issues/<pai>/sub_issues -F sub_issue_id=$(gh api repos/$R/issues/<filho> --jq .id)
gh issue edit <n> -R $R --remove-label "status: dev" --add-label "status: test"
gh project item-add 3 --owner LuanSilvaR --url https://github.com/$R/issues/<n>
```

A coluna do quadro é o campo **Status** do projeto (opções Backlog · Dev · Teste · Homologação · Concluído);
ao mudar a label, mude também o Status do item (`gh project item-edit`).

## Em andamento

- Épico [#63 Agenda por profissional](https://github.com/LuanSilvaR/-deskcomm-clinica/issues/63) —
  S1 #64, S4 #65, S5 #66 em Dev (PR #71); S2 #67, S3 #68, S6 #69, S7 #70 no Backlog.
