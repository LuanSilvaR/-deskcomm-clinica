# Gates de qualidade

Gate obrigatório que falhou = impedimento registrado no handoff e entrega **não** declarada aprovada.
Os gates são proporcionais: a coluna LOW mostra o mínimo para mudança trivial.

| Gate | Verifica | Quem / evidência | LOW | MEDIUM | HIGH |
|---|---|---|---|---|---|
| **1 Requirements** | critérios de aceite numerados e testáveis na issue; regras de negócio com origem | `product-owner` (`historia.md`), `business-analyst` (`requisitos.md`) | critério de 1 linha na resposta | critérios na issue | Given/When/Then + ok do dono |
| **2 Architecture** | aderência ao ARCHITECTURE.md; `clinic_*`; tripla de migration; flag; core registrado | `architect` (`plano.md`), `tech-lead` | — | plano.md curto | plano.md + ok do dono; ADR se estrutural |
| **3 Implementation** | só o escopo; reuso; contratos preservados; sem `console.log` | `code-reviewer`, `git diff --stat` | diff conferido | revisão | revisão + tech-lead se houve conflito |
| **4 Testing** | Verify do CLAUDE.md com **exit codes reais**; sem regressão vs. origin/develop | `regression-guardian`, `/factory-test` | lint + typecheck + unit | + testes novos dos critérios | + `test:db` se banco, + Playwright se UI, + isolamento 2 orgs |
| **5 Security** | auth, RLS, Zod, segredos, LGPD, dado de paciente | `security-lgpd`, `health-compliance` | triagem de 1 linha | se tocou API/auth/dado pessoal | sempre |
| **6 Release** | CI verde (`gh pr checks`, inclusive `verify-parte (3)`), docs, checklist, reversão | `release-manager`, `/factory-release` | — | PR com saída do Verify | + checklist e plano de reversão |

## O que conta como evidência

- **Teste executado** = comando + exit code (+ resumo filtrado). "Deve passar" não é evidência.
- **Revisão realizada** = saída do revisor com APROVADO ou a lista de ajustes.
- **Aprovação obtida** = palavra do dono nesta conversa ou na issue. Revisor aprovar não é aprovação do dono.
- **Tocou UI** = spec Playwright contra a 3001; imagem em `evidence/` só vale se citada num `.md`.
- `pnpm cercas` não seleciona arquivo no Windows: a prova é o job `verify-parte (3)` do CI.
