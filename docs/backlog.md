# Backlog — fluxo e estágios

Quadro: **[Backlog Clínica](https://github.com/users/LuanSilvaR/projects/3)** (GitHub Projects).
Fonte da verdade do estado: issues, labels e PRs do repositório `LuanSilvaR/-deskcomm-clinica`.
Especificação de cada item: `docs/tarefas/<id>/` (`historia.md`, `impacto.md`, `plano.md`, `handoff.md`).

## Estágios

| Coluna do quadro | Label | Entra quando | Quem move |
|---|---|---|---|
| Backlog | — | issue criada; critérios ainda a refinar | `/tarefa` (passo 0) |
| Pronto para iniciar | — | critérios de aceite numerados e aprovados; pode começar | dono do produto |
| Em andamento | `status: dev` | PR aberto para `develop` com a evidência do Verify | `/tarefa` ao abrir o PR |
| Teste | `status: test` | PR mergeado na `develop` e CI verde; rodar integração/E2E | Claude, após o merge |
| Em integração | `status: integracao` | validado na **3002** (homologação) com a palavra do dono; promoção develop → main → VPS iniciada | Claude, com o ok do dono |
| Concluído | `status: done` | validado na 3002 e publicado na **VPS (Hostinger KVM2)**; issue fechada | dono do produto |

A label `status: dev` mantém o nome antigo para não quebrar filtros e histórico;
a coluna do quadro é o nome que vale.

Regras:
- Nenhuma issue vai para Em integração sem os testes de integração/E2E executados e anexados na issue.
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

A coluna do quadro é o campo **Status** do projeto (opções Backlog · Pronto para iniciar · Em andamento ·
Teste · Em integração · Concluído); ao mudar a label, mude também o Status do item:

```bash
# campo Status = PVTSSF_lAHOAQVUq84BqE4NzhodlVc · projeto = PVT_kwHOAQVUq84BqE4N
# opções: Backlog be296c73 · Pronto para iniciar 8af5b3a4 · Em andamento 18dfe907
#         Teste 088877f5 · Em integração 49ae3d3a · Concluído 030416da
gh project item-edit --project-id PVT_kwHOAQVUq84BqE4N --id <item> \
  --field-id PVTSSF_lAHOAQVUq84BqE4NzhodlVc --single-select-option-id <opção>
```

Atenção: o `gh` deste clone aponta por padrão para o upstream — use sempre `-R $R`.

## Em andamento

- Épico [#63 Agenda por profissional](https://github.com/LuanSilvaR/-deskcomm-clinica/issues/63) —
  S1 #64, S4 #65, S5 #66 em Teste (PR #71 mergeado em 2026-11-04); S2 #67, S3 #68, S6 #69, S7 #70 no Backlog.
- [#77 Fábrica de agentes](https://github.com/LuanSilvaR/-deskcomm-clinica/issues/77) — Em andamento (PR #76).
- Épico [#115 Orçamento → Contrato](https://github.com/LuanSilvaR/-deskcomm-clinica/issues/115) —
  O1 #116, O2 #117, O3 #118, O4 #119, O5 #120 em Teste (PRs #106–#111 mergeados em 2026-11-08).
  Pendente do dono: cláusulas jurídicas no modelo de contrato (CNPJ e responsável técnico, cancelamento e
  reembolso, arrependimento de 7 dias, "sem juros" ou CET). Parcelas e taxa da maquininha entram com o #58.
- [#121 Organização: telefone e endereço com CEP](https://github.com/LuanSilvaR/-deskcomm-clinica/issues/121) —
  Teste (PRs #112 e #113 mergeados em 2026-11-08; migration 8011).
- [#122 Marca: tamanho ideal do logo e favicon](https://github.com/LuanSilvaR/-deskcomm-clinica/issues/122) —
  Teste (PR #114; migration 8012).

## Backlog (a refinar)

