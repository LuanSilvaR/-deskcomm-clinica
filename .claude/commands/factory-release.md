---
description: Prepara checklist e notas de release a partir de develop (versão, riscos, reversão). Não publica nada. Uso: /factory-release [versão]
argument-hint: [versão]
disable-model-invocation: true
---
Versão: $ARGUMENTS. Use o subagente release-manager. Gate 6 de docs/factory/QUALITY_GATES.md.
Conferir antes: `gh pr checks` dos PRs da release (CI verde, inclusive verify-parte (3)), issues em Homologação
validadas na 3001, migrations novas com tripla completa e idempotentes, docs/DEPLOY-CHECKLIST.md.
Entregue: versão SemVer proposta e porquê, notas, checklist, riscos conhecidos, plano de reversão (o que
desfaz cada migration aditiva / flag a desligar). PROIBIDO: tag, push, merge na main, release no GitHub,
publish-image, deploy — tudo isso é do dono, por ordem explícita.
