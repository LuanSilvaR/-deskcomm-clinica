---
description: Revisão independente somente leitura (modo REVIEW) do diff atual, de uma branch ou de um caminho. Uso: /factory-review [alvo]
argument-hint: [alvo — vazio = diff contra develop]
disable-model-invocation: true
---
Alvo: $ARGUMENTS (vazio = `git diff develop...HEAD` + mudanças locais).
Modo REVIEW: NÃO edite, não formate, não commite. Se achar o conserto, descreva-o.
1. `git diff --stat` do alvo para escolher revisores pelo que mudou (não convoque todos):
   sempre code-reviewer; supabase/ ou RLS/auth/api → security-lgpd; prontuário/consentimento/fotos/insumos →
   health-compliance; app/ ou components/ → ux-accessibility; decisão estrutural → tech-lead.
2. Passe a cada revisor só o diff e os critérios (historia.md se houver). Não repita revisão de código
   que não mudou desde a última.
3. Consolide achados por severidade (bloqueia / deve corrigir / sugestão), cada um com arquivo:linha e o cenário
   que quebra. Sem achado verificado, diga "nenhum" — não invente. Até 15 linhas.
