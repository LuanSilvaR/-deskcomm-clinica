-- 8004 · clinic (FORK) — o profissional grava o PRÓPRIO registro no conselho (#97)
-- A RLS de clinic_professionals só deixa gravar a gerência (manager +
-- profissionais.gerenciar), e continua assim. Esta função é a ÚNICA porta do
-- próprio profissional: altera só a linha de auth.uid() na empresa informada e
-- só conselho, número e UF. Especialidades e "ativo" seguem com a gerência
-- (decisão do dono). Não cria ficha: sem ficha, quem cria é a gerência.
-- Aditiva; sem tabela nova; sem HTTP.
create or replace function public.fn_clinic_salvar_meu_registro(
  p_org uuid,
  p_council text,
  p_council_number text,
  p_council_uf text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  -- Suporte de escrita, MFA e a chave de quem cuida da própria agenda.
  perform public.fn_acesso_exigir(p_org, 'agenda.bloquear_horario');

  update public.clinic_professionals
     set council = nullif(btrim(p_council), ''),
         council_number = nullif(btrim(p_council_number), ''),
         council_uf = nullif(upper(btrim(p_council_uf)), ''),
         updated_at = now()
   where organization_id = p_org
     and user_id = auth.uid()
  returning id into v_id;
  if v_id is null then
    raise exception 'clinic_ficha_inexistente' using errcode = 'P0002';
  end if;

  return jsonb_build_object('id', v_id);
end $$;
revoke execute on function public.fn_clinic_salvar_meu_registro(uuid, text, text, text) from public, anon;
grant  execute on function public.fn_clinic_salvar_meu_registro(uuid, text, text, text) to authenticated;
