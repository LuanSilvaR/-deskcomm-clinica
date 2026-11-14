-- ════════════════════════════════════════════════════════════════════════════
-- 9037 · clinic — catálogo da Groq (FORK, estoque E9)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/estoque/plano.md (E9). O dono pediu a Groq como provedor
-- de IA (além de DeepSeek e OpenRouter, que já existem). Mesmo molde da 0342:
-- OpenAI-compatível (fábrica `@ai-sdk/openai`, base `api.groq.com/openai/v1`),
-- linhas no catálogo curado (`ai_models`) E na contabilidade (`ai_pricing`) —
-- sem a segunda, o gasto some do orçamento.
--
-- Procedência dos ids e preços (dólares por 1M de tokens, tabela pública da
-- Groq, levantada em outubro/2026 por terceiros — o site da Groq não abre
-- deste ambiente; conferir no painel antes de confiar no orçamento):
--   llama-3.3-70b-versatile   entrada $0,59 · saída $0,79
--   llama-3.1-8b-instant      entrada $0,05 · saída $0,08
--   openai/gpt-oss-120b       entrada $0,15 · saída $0,60
-- Preço em CENTAVOS por MILHÃO (integer), a unidade do resto do catálogo.
-- Sem `is_default_for_provider` (mesma razão da 0342). Idempotente.

insert into public.ai_models
  (provider, model_id, display_name, description,
   input_price_per_million_cents, output_price_per_million_cents, supports_tools)
values
  ('groq', 'llama-3.3-70b-versatile', 'Llama 3.3 70B (Groq)',
   'Modelo aberto da Meta servido pela Groq, com resposta muito rápida. Bom equilíbrio entre qualidade e custo.',
   59, 79, true),
  ('groq', 'llama-3.1-8b-instant', 'Llama 3.1 8B Instant (Groq)',
   'O mais barato e rápido da Groq, para tarefas curtas e classificação.',
   5, 8, true),
  ('groq', 'openai/gpt-oss-120b', 'GPT-OSS 120B (Groq)',
   'Modelo aberto da OpenAI servido pela Groq, para tarefas que pedem mais raciocínio.',
   15, 60, true)
on conflict (provider, model_id) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  input_price_per_million_cents = excluded.input_price_per_million_cents,
  output_price_per_million_cents = excluded.output_price_per_million_cents,
  supports_tools = excluded.supports_tools;

insert into public.ai_pricing
  (model, prompt_cents_per_million_tokens, completion_cents_per_million_tokens, notes)
values
  ('llama-3.3-70b-versatile', 59, 79, 'catálogo 9037 (Groq)'),
  ('llama-3.1-8b-instant',     5,  8, 'catálogo 9037 (Groq)'),
  ('openai/gpt-oss-120b',     15, 60, 'catálogo 9037 (Groq)')
on conflict (model) do update set
  prompt_cents_per_million_tokens = excluded.prompt_cents_per_million_tokens,
  completion_cents_per_million_tokens = excluded.completion_cents_per_million_tokens,
  notes = excluded.notes,
  superseded_at = null;
