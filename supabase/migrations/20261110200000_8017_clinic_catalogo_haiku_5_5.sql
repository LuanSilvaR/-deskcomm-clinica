-- 8017 · clinic (FORK) — Claude Haiku 5.5 no catálogo "Anthropic direto" e na contabilidade (issue #142).
--
-- O Haiku 5.5 custa US$ 0,10 / 0,50 por milhão de tokens (10× abaixo do Haiku 4.5)
-- e a chave da Anthropic já dá acesso a ele, mas o catálogo só o trazia pela
-- OpenRouter (`anthropic/claude-haiku-5.5`, outra chave). Sem a linha
-- `anthropic` o seletor de modelo do agente não o oferece; sem `ai_pricing` o
-- gasto não entra na conta. O preço do motor mora em
-- `lib/agent-engine/edge/llm/pricing.ts` (mesma tarifa).
--
-- Só insere; não muda linha existente nem o padrão do provedor. Idempotente.

insert into public.ai_models
  (provider, model_id, display_name, description, context_window,
   input_price_per_million_cents, output_price_per_million_cents,
   supports_tools, is_default_for_provider, supports_vision, source)
values
  ('anthropic', 'claude-haiku-5-5', 'Claude Haiku 5.5',
   'Rápido e econômico — atendimento e vendas pelo WhatsApp. US$ 0,10 / 0,50 por milhão de tokens (prompts até 100 mil tokens).',
   1000000, 10, 50, true, false, true, 'manual')
on conflict (provider, model_id) do nothing;

insert into public.ai_pricing
  (model, prompt_cents_per_million_tokens, completion_cents_per_million_tokens, notes)
values
  ('claude-haiku-5-5', 10, 50, 'fork 8017 — prompts até 100K tokens (acima: 50/250)')
on conflict (model) do nothing;
