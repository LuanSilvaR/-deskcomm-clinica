-- ════════════════════════════════════════════════════════════════════════════
-- 9025 · clinic — reabrir atendimento finalizado (FORK, prontuário F8)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/prontuario/plano.md (fase F8, seção 14).
--
-- Reabrir NÃO desfaz a imutabilidade: o que já foi finalizado continua travado
-- pelo trigger (fn_clinic_registro_imutavel só deixa mudar rascunho). Reabrir
-- serve para ACRESCENTAR o que faltou (um procedimento esquecido, a avaliação
-- que não foi preenchida); corrigir o que existe continua sendo adendo. Exige
-- `atendimento.reabrir` (chave clínica, gerência), MFA, suporte com escrita e
-- motivo; o evento `reaberto` guarda estado antes/depois, quem e por quê.
-- Idempotente.

create or replace function public.fn_clinic_reabrir_atendimento(p_org uuid, p_atendimento uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  perform public.fn_acesso_exigir(p_org, 'atendimento.reabrir');
  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'atendimento_sem_motivo' using errcode = '22023';
  end if;
  select c.status into v_status
    from public.clinic_atendimentos c
   where c.id = p_atendimento and c.organization_id = p_org
   for update;
  if not found then
    raise exception 'atendimento_nao_encontrado' using errcode = 'P0002';
  end if;
  if v_status <> 'finalizado' then
    raise exception 'atendimento_nao_finalizado' using errcode = '22023';
  end if;
  update public.clinic_atendimentos
     set status = 'em_andamento', finished_at = null, finalizado_por = null, updated_by = auth.uid(), versao = versao + 1
   where id = p_atendimento;
  insert into public.clinic_atendimento_eventos (organization_id, atendimento_id, tipo, status_antes, status_depois, motivo, ator)
  values (p_org, p_atendimento, 'reaberto', 'finalizado', 'em_andamento', left(btrim(p_motivo), 300), auth.uid());
  return jsonb_build_object('id', p_atendimento);
end $$;
revoke execute on function public.fn_clinic_reabrir_atendimento(uuid, uuid, text) from public, anon;
grant  execute on function public.fn_clinic_reabrir_atendimento(uuid, uuid, text) to authenticated;
