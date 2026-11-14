# agenda-s6 — plano (issue #69, HIGH) · fonte: historia.md (C1–C18 aprovados) + impacto.md
Duas fatias, dois PRs. **S6a (ACL + tela, sem migration) vai sozinha** e já fecha C13–C15, C17. **S6b (encaixe, 9045)** fecha C1–C12, C16.

## Decisões (ADR: docs/adr/0004-encaixe-por-funcao-definer-e-guc.md)
D1. GUC por **função `security definer`** que faz `set_config(...,true)` E o INSERT na MESMA chamada. `set_config` no
    handler é inviável: a rota usa supabase-js com client de SESSÃO, cada `rpc`/`insert` é uma requisição PostgREST =
    transação própria; o GUC morreria antes do INSERT. A função recebe a linha já montada pelo handler (`p_row jsonb` →
    `jsonb_populate_record(null::calendar_appointments, …)`), então o core não duplica a montagem do compromisso.
    O ator é `auth.uid()` (sessão): token/IA/MCP chegam sem `auth.uid()` de pessoa → recusa por construção (C11).
    O GUC carrega o id da linha de `clinic_agenda_encaixes` criada na própria transação (`txid` gravado); o trigger só
    aceita se a linha existe com `txid = txid_current()` — GUC forjado ou velho não vale.
D2. Conflito: com `settings.clinic.encaixe` DESLIGADA nada muda (422 `agenda_horario_indisponivel`, contrato do core e
    da IA). LIGADA + ator pessoa: 409 `agenda_horario_ocupado`, `details:{agendamentos:[{id,paciente,inicio,fim,status}],
    pode_encaixar}` — mesmo molde de `bloqueio_com_agendamento` (app/api/v1/clinic/bloqueios/route.ts:134). IA segue 422.
D3. Guarda ACL = helper fork `lib/clinic/agenda/guarda-da-agenda.ts` (`exigeChaveDaAgenda(verbo, input, ctx)` →
    `Response|null`, usa `permissoesEfetivas` + mesmo 403 auditado de `requirePermission`). Chamado UMA vez em
    `despachar()` (route.ts:350) DEPOIS do `requireRole("agent")` (o piso não baixa). Mapa: POST→marcar; DELETE→cancelar;
    PATCH com starts_at/owner_user_id→remarcar; status completed|no_show→registrar_desfecho; demais campos→marcar.
    Só rota HTTP: MCP não passa por `despachar` (tem permissão por ferramenta).
D4. Tela ESCONDE por props OPCIONAIS no core, com default = comportamento atual do upstream:
    `HistoricoDaAgenda.ocultarAcoesAusentes?` (não renderiza botão cuja prop falta), `AgendaInterativa.podeRemarcar?`
    (default true; false = sem arraste), `EntradaDaAgenda.acoes?:{remarcar,cancelar,desfecho}` (se vier, substitui
    `usePermission("inbox.reply")`). O Dr. Bruno mantém: ver agenda/detalhe, bloquear horário, visita S4, seu dia.

## S6a — passos (cada um verificável; reverter = reverter o commit)
1. `guarda-da-agenda.ts` + unit do mapa verbo→chave (tests/unit/clinic-guarda-da-agenda.test.ts). ✔ test:unit
2. route.ts `despachar`: +3 linhas chamando a guarda (CORE). Unit de rota: 403 `forbidden_permission` +
   `details.permissao` para cada chave (C13); ajustar `desfecho-de-agenda-e-sobre-o-passado.test.ts:50` (ctx sem permissões).
3. Props opcionais D4 nos 3 componentes CORE; `_client.tsx` passa handlers só com `can("agenda.remarcar")` etc. (l.537,
   1237, 1374) e `ocultarAcoesAusentes` / `podeRemarcar`. ✔ typecheck + unit dos componentes (default inalterado).
4. Porta "Dia por profissional": `lib/navigation/catalogo.ts:196` `agenda.ver` → `agenda.ver_outros` (CORE, 1 token);
   `app/app/agenda/profissionais/page.tsx` (fork) checa `permissoesEfetivas` no servidor → `redirect("/app/agenda")`;
   rota `dia-por-profissional` → `requirePermission("agenda.ver_outros")` (C15).
5. e2e `tests/e2e/clinic-agenda-acl.spec.ts` (3001): Dr. Bruno não vê Remarcar/Cancelar/Compareceu/Faltou nem arrasta, não
   vê o menu, `/app/agenda/profissionais` redireciona, PATCH direto = 403; gerente demo vê tudo (C14, C15, C17).
   Ajustar `clinic-experiencia-do-profissional.spec.ts` e `clinic-papeis-de-acesso.spec.ts` se dependiam do botão cinza.

## S6b — passos
6. Migration TRIPLA `supabase/migrations/<ts>_9045_clinic_agenda_encaixe.sql` + linha MANIFEST.md + apêndice idempotente
   no fim do baseline.sql: (a) chave `agenda.encaixe` (nivel_base `manager`, depende `agenda.marcar`, critica false) e
   concessão a `administrador`,`gerente` e papéis com `agenda.marcar` E nível manager+ (molde 9042, `on conflict do nothing`);
   (b) `clinic_agenda_encaixes` (id, organization_id not null fk cascade, appointment_id, sobrepostos uuid[], motivo check
   5–500, ator, txid bigint, created_at) + RLS `tenant_isolation_clinic_agenda_encaixes_all` via `fn_user_org_ids()`,
   sem update/delete; (c) CHECK de `clinic_agenda_historico.tipo` + `encaixe` (drop if exists/add, aditivo);
   (d) `create or replace fn_clinic_trava_sobreposicao` (9005 intacta): com GUC válido (D1) deixa passar SÓ se todo
   sobreposto é pending/confirmed (completed → recusa, C6); `google_sync` segue ignorado (C12); advisory lock mantido (C10);
   (e) `fn_clinic_agenda_encaixar(p_row jsonb, p_motivo text)` definer, `search_path` fixo: confere org ∈
   `fn_user_org_ids()`, `agenda.encaixe` em `fn_member_permissions`, flag, motivo, `source='ui'`; insere encaixe → GUC →
   appointment → histórico `encaixe`; `revoke execute … from public, anon`; grant só `authenticated`. Sem HTTP.
7. Catálogo `lib/clinic/acesso/catalogo.ts`: `agenda.encaixe` + modelos gerente/admin; `PAPEL_PROFISSIONAL` sem ela.
8. Fork `lib/clinic/agenda/encaixe.ts`: `conflitosDoHorario()` (para D2) e `exigeEncaixePossivel()` (flag, chave, ator
   user, sobrepostos só pending/confirmed, sem Google, DENTRO da jornada e fora de bloqueio/folga — dúvida 2).
9. CORE: route.ts `marcarSchema` + `encaixe?:{motivo: z.string().trim().min(5).max(500)}`; `_handler.ts`
   `marcarAgendamentoHandler`: se `input.encaixe` troca `exigeHorarioLivre` por `exigeEncaixePossivel` e o sink do INSERT
   por `rpc("fn_clinic_agenda_encaixar")`, resposta `encaixe:true`; no 422 de horário (l.874-882/929) com flag ligada →
   409 D2. Audit `clinic.agenda.encaixe` (audit log). Erro do banco → `fail()`; nada gravado nos 4xx (C1, C3, C4).
10. Fork GET `/api/v1/clinic/agenda/encaixes?de&ate` (marcas) e `/api/v1/clinic/agendamentos/[id]/encaixe` (motivo,
    autor) com `requirePermission("agenda.ver")` + dono ou `agenda.ver_outros` (C9). `ok()/fail()`, Zod nas queries.
11. Tela: no 409 o painel de marcar lista quem ocupa e, com `can("agenda.encaixe")` e `pode_encaixar`, mostra
    "Encaixar" + motivo obrigatório; etiqueta "Encaixe" na grade/lista (prop opcional `etiquetas?` nos componentes) e
    motivo/autor no detalhe (C8). Toggle `settings.clinic.encaixe` em Configurações › Clínica (nasce desligado, C1).
12. Testes db: `tests/invariants/clinic-agenda-encaixe.test.ts` — isolamento 2 orgs (molde rls-isolation), GUC forjado
    via `set_config` sem linha → recusa, completed → recusa, google_sync ignorado, anon/public sem execute, chamada sem
    chave/flag → erro e zero linhas, superconjunto de `agenda.*` por papel antes/depois + rodar 2x (C16);
    atualizar `clinic-papeis-de-acesso.test.ts`. Unit do handler (C1–C5, C11 com ator ai_agent/api_token).
    e2e: gerente demo encaixa com motivo, vê etiqueta; Dr. Bruno não vê "Encaixar" (C2, C8). Fixtures sintéticas (C18).

## Verify (cada PR)
`pnpm lint` · `pnpm typecheck` · `pnpm test:unit` · `pnpm test:db` (S6b; Docker) · Playwright 3001 · `gh pr checks`
(`verify-parte (3)`). Exit codes no corpo do PR; falha de unit só é baseline se falhar igual em origin/develop limpo.

## CORE tocado (UPSTREAM.md + aprovação)
S6a: `app/api/v1/agenda/agendamentos/route.ts` (despachar), `components/agenda/HistoricoDaAgenda.tsx`,
`AgendaInterativa.tsx`, `EntradaDaAgenda.tsx` (+ `DetalheDoCompromisso.tsx` se a prop tiver de descer), `lib/navigation/catalogo.ts:196`.
S6b: `route.ts` (marcarSchema), `_handler.ts` (ramo encaixe + 409), os mesmos componentes (`etiquetas?`).

## Riscos
R1 ACL só na rota: `fn_appointment_change`/INSERT direto via PostgREST com sessão ainda contornam (dívida; S6c no banco).
R2 Contrato: PATCH/DELETE podem dar 403 a papel personalizado sem a chave (legado/sistema não perdem: nivel_base agent).
R3 `jsonb_populate_record` acopla a função às colunas do core; sync do upstream que mude a tabela exige revisão (ADR).
R4 Conflito com PR #55 (catálogo de navegação, Configurações › Clínica); 9045 também usada no upstream (registrar).
R5 Checar jornada ignorando N sobrepostos pode exigir `ignorarAgendamentoIds?` em lib/agenda (core) — evitar; senão registrar.
## Reversão
S6a: revert do PR (sem dado). S6b: flag desligada = trigger volta ao 9005 na prática; revert de código; migration fica
(aditiva) — se preciso, nova 9046 que restaura a função 9005 e revoga a chave; tabela de encaixes preservada (rastro).
