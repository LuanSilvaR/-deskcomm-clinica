# agenda-s6 — impacto (issue #69)

Fonte: codebase-explorer + conferência na sessão principal (2026-11-04). Complementa `historia.md`.

## Rotas e guardas hoje
| Ação | Rota | Guarda atual | Core? |
|---|---|---|---|
| listar | `app/api/v1/agenda/agendamentos/route.ts:152` GET | `requireRole("viewer")` | CORE |
| marcar / remarcar (PATCH) / cancelar (DELETE) | `route.ts:317,324,350` → `_handler.ts` | `requireRole("agent")` — nenhuma chave `agenda.*` | CORE |
| detalhe | `app/api/v1/agenda/agendamentos/[id]/route.ts:15` | `requireRole("viewer")` | CORE |
| desfecho Realizado/Faltou | PATCH de status via `_handler.ts` (`alterarAgendamentoHandler`) | idem | CORE |
| visita (S4) | `app/api/v1/clinic/agendamentos/[id]/visita/route.ts:32,125` | `requirePermission("recepcao.ver_painel" / "agenda.ver")` + checagem de `recepcao.mudar_status_visita`/`atendimento.*` | fork |

Helper do fork para chave: `lib/clinic/acesso/require-permission.ts:33-69` (`requirePermission(chave)` → 403 auditado; no modo legado cai no nível base via `fn_member_permissions`, baseline l.37848-37897).

## IA / MCP
`lib/mcp/tools/agendamento.ts:532` `crm_book_appointment` → `marcarAgendamentoHandler` (`_handler.ts`) com `ctx.actor.type` ∈ user/ai_agent/api_token/webhook_source e `source='mcp'`. Recusa de encaixe por ator vai no handler/função definer (nunca pela UI).

## Tela
- `app/app/agenda/_client.tsx` recebe `permissoes` (l.100/143) e tem `can()` (l.240).
- Lista "Próximos": `<HistoricoDaAgenda>` em `_client.tsx` ~l.1236-1260 recebe `onRemarcar`/`onCancelar`/desfecho; o componente (CORE, `components/agenda/HistoricoDaAgenda.tsx`) desabilita o botão quando a prop falta (`disabled={!onRemarcar}`). **Esconder/inativar = passar a prop só com a chave**, sem tocar o componente core — conferir se "desabilitado" basta ou se é preciso esconder (critério C14 diz "não vê").
- Detalhe: `components/agenda/EntradaDaAgenda.tsx:14` usa `podeEditar = usePermission("inbox.reply")` (CORE) → `DetalheDoCompromisso.tsx:272,299-300,339` (Compareceu/Faltou/Remarcar). Precisa receber as chaves `agenda.*` do fork (prop opcional vinda de `_client.tsx:537`).
- Grade: `components/agenda/AgendaInterativa.tsx:148,290-311` (remarcar por arraste) — CORE; arraste também precisa de `agenda.remarcar`.
- "Dia por profissional": link em `_client.tsx:586` já usa `can("agenda.ver_outros")`; **página `app/app/agenda/profissionais/page.tsx` sem guarda** e item de menu da Agenda (submenu "Dia por profissional") a localizar no catálogo de navegação.

## Banco
- Trigger 9005 `fn_clinic_trava_sobreposicao()` baseline l.37220-37267 (trigger l.37271-37275): atrás de `settings.clinic.trava_sobreposicao`; `23P01`; ignora `google_sync`; advisory lock (org, profissional) l.37249. Ponto do GUC: depois da checagem da flag, antes do `raise` de sobreposição.
- Modelo de chave nova + concessão: 9042, baseline l.47440-47476.
- `clinic_agenda_historico` (9043): CHECK de `tipo` sem `encaixe` → ampliar em migration nova.
- Próxima migration do fork: **9045** (o upstream também usa 9045 — ver épico #78; o fork não sincroniza por merge, então não há colisão de arquivo, mas registrar).

## Testes afetados
- `tests/unit/desfecho-de-agenda-e-sobre-o-passado.test.ts:50` (ctx sem permissões).
- `tests/invariants/clinic-papeis-de-acesso.test.ts` (chaves esperadas por papel-modelo).
- `tests/e2e/clinic-experiencia-do-profissional.spec.ts`, `tests/e2e/clinic-papeis-de-acesso.spec.ts`.
- Modelo de 2 orgs: `tests/invariants/rls-isolation.test.ts`.

## Sobreposição com PR #55 (menu da clínica)
Mexe no menu/configurações; risco de conflito no catálogo de navegação (porta "Dia por profissional") e no lugar da flag em Configurações › Clínica. Coordenar no merge.

## Arquivos prováveis
CORE (registrar em UPSTREAM.md, aprovação do dono): `app/api/v1/agenda/agendamentos/route.ts`, `_handler.ts`, `components/agenda/EntradaDaAgenda.tsx` (prop opcional), talvez `AgendaInterativa.tsx`/`HistoricoDaAgenda.tsx`.
Fork: migration 9045 (+ MANIFEST + baseline), `lib/clinic/acesso/catalogo.ts`, `app/app/agenda/_client.tsx`, `app/app/agenda/profissionais/page.tsx`, menu, testes.

## Contratos
Aditivos: `motivo?`/`encaixe?` no input de marcar; CHECK do histórico ampliado; tabela nova. Mudança de comportamento: PATCH/DELETE passam a exigir a chave (quem tem nível agent no legado segue podendo — concedidas pelo nível base).
