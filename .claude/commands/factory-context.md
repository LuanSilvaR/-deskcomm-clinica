---
description: Recupera o MÍNIMO de contexto para uma demanda — arquivos, símbolos e docs relevantes — sem ler o repositório. Uso: /factory-context <assunto>
argument-hint: <assunto>
disable-model-invocation: true
---
Assunto: $ARGUMENTS
Política: docs/factory/EFFICIENCY.md §Contexto. Contexto já obtido nesta conversa e ainda válido (arquivo não
mudou desde a leitura) é reutilizado — não releia.
1. Sem subagente se 1–3 buscas bastam: Grep pelo termo de domínio em lib/clinic, app/app, app/api/v1, supabase/baseline.sql
   (só `-n` com contexto curto; no baseline, vale a ÚLTIMA definição da função).
2. Subagente codebase-explorer só se a busca abrir mais de ~5 frentes ou precisar de isolamento do contexto principal.
3. Docs: docs/factory/PROJECT_CONTEXT.md (mapa) e, se o assunto tiver, docs/tarefas/<id>/ e docs/business-rules/.
Entregue até 12 linhas: arquivos:linha que importam (com 1 frase cada), regra/padrão existente a reusar,
docs relevantes, e o que NÃO foi olhado. Não abra arquivo inteiro sem necessidade.
