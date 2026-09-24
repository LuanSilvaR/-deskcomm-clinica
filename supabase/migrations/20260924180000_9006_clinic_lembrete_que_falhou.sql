-- ════════════════════════════════════════════════════════════════════════════
-- 9006 · clinic — lembrete que falhou vira tarefa de ligação (FORK)
-- ════════════════════════════════════════════════════════════════════════════
--
-- A 9004 abre a tarefa "Ligar para confirmar" quando o paciente não responde.
-- Faltavam os dois casos em que ele NÃO PODIA responder:
--
--   envio_falhou  o lembrete saiu, mas a mensagem terminou `failed` (número
--                 inválido, WhatsApp desconectado no meio do envio). A tarefa
--                 abre na hora, sem esperar as 4 h.
--   nao_enviado   o lembrete nem saiu (canal desconectado, paciente sem
--                 telefone ou bloqueado). A 4 h da consulta, a tarefa abre do
--                 mesmo jeito, com um pedido criado já em `sem_resposta`.
--
-- `reminder_message_id` guarda a mensagem do lembrete para o cron conferir o
-- status dela. Não se depende de `message.failed`: o trigger de `messages` só
-- emite no INSERT, e a falha chega depois, por UPDATE (medido em
-- app/api/v1/cron/recover-stuck-messages/route.ts).
-- Aditiva e idempotente.

alter table public.clinic_confirmation_requests
  add column if not exists reminder_message_id uuid references public.messages(id) on delete set null;

alter table public.clinic_confirmation_requests
  add column if not exists falha text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'clinic_confirmation_requests_falha_check'
       and conrelid = 'public.clinic_confirmation_requests'::regclass
  ) then
    alter table public.clinic_confirmation_requests
      add constraint clinic_confirmation_requests_falha_check
      check (falha is null or falha in ('envio_falhou','nao_enviado'));
  end if;
end $$;

create index if not exists clinic_confirmation_requests_lembrete_idx
  on public.clinic_confirmation_requests (reminder_message_id)
  where status = 'aguardando' and reminder_message_id is not null;
