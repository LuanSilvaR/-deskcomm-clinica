# ADR 0004 — Encaixe da agenda: função security definer liga o GUC lido pelo trigger 9005

Status: proposto (agenda-s6, issue #69) · Data: 2026-11-04

## Contexto
O trigger `fn_clinic_trava_sobreposicao` (9005) recusa sobreposição com `23P01`. O encaixe precisa passar por ele de
forma autorizada e rastreada. A rota `/api/v1/agenda/agendamentos` usa supabase-js (client de sessão): cada chamada é
uma requisição PostgREST, ou seja, uma transação. `set_config(..., true)` feito pelo handler morreria antes do INSERT.

## Decisão
`public.fn_clinic_agenda_encaixar(p_row jsonb, p_motivo text)` (security definer, `search_path` fixo,
`revoke execute from public, anon`): confere org via `fn_user_org_ids()`, chave `agenda.encaixe`, flag
`settings.clinic.encaixe`, motivo e ator pessoa (`auth.uid()`); grava a linha em `clinic_agenda_encaixes` (com `txid`),
liga o GUC `clinic.encaixe_id` local à transação e insere o compromisso. O 9005 (create or replace na 9045) só aceita o
GUC se a linha correspondente existir com `txid = txid_current()`, e só sobre pending/confirmed.

## Consequências
+ Uma transação, sem HTTP em trigger, GUC impossível de forjar pelo body; IA/token recusados por construção.
- `jsonb_populate_record(null::calendar_appointments, …)` acopla a função às colunas do core: sincronização do
  upstream que altere `calendar_appointments` exige revisar esta função.
Alternativa rejeitada: `set_config` no handler (inviável sem transação); tabela-ticket consumida pelo trigger (mais peças).
