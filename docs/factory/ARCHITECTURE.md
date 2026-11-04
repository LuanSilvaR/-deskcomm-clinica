# Arquitetura — o que a fábrica precisa saber

A fonte é o [ARCHITECTURE.md da raiz](../../ARCHITECTURE.md) (1 página, mantido pelo upstream), com
profundidade em `docs/specs/`, `docs/architecture/` e decisões em [docs/adr/](../adr/). Este arquivo só
registra **como o fork se encaixa** e o que um agente não pode quebrar.

## Camadas (resumo)

```
Navegador ──▶ proxy.ts (borda) ──▶ app/ (Server Components + Route Handlers /api/v1)
                                        │
                                        ├─▶ lib/<domínio> (regras; lib/clinic = fork)
                                        │       └─▶ Supabase (Postgres + RLS por organization_id)
                                        │                 └─▶ event_log ──▶ workers/ (IA, mídia, LGPD, RAG)
                                        └─▶ integrações (WAHA, IA, Redis, Resend, Google)
```

## Invariantes arquiteturais (não negociáveis sem ADR + ok do dono)

1. **Multi-tenant por RLS**: toda tabela tenant-aware tem `organization_id` + política via `fn_user_org_ids()`;
   service role filtra `organization_id` resolvido de cookie/JWT/token, nunca do body.
2. **Fork isolado do core**: o que é clínico vive em `lib/clinic`, `components/clinic`, tabelas `clinic_*`.
   Tocar o core = aprovação + linha no UPSTREAM.md (o hook `.claude/hooks/proteger.sh` bloqueia as áreas sensíveis).
3. **Banco evolui só para a frente**: migration nova (faixa 9xxx) + MANIFEST + apêndice idempotente no baseline;
   nunca editar migration existente; expand/contract para renomear ou remover.
4. **Assíncrono por fila**: trigger escreve em `event_log`; worker faz o efeito externo.
5. **Feature por flag de organização**, desligada por padrão.
6. **Imutabilidade clínica**: prontuário assinado só recebe adendo; estoque = soma de movimentos.

## Quando chamar o software-architect (`architect`)

Schema novo, RLS, mudança no core, integração nova, nova fila/worker, troca de padrão entre módulos.
Ele escreve `docs/tarefas/<id>/plano.md` e, se a decisão for estrutural, um ADR em `docs/adr/`.
Migração tecnológica ou reorganização de pastas: só com justificativa escrita e autorização do dono.
