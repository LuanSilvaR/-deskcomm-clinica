-- 8024 · clinic (FORK) — atestado de anonimização LGPD (#87)
-- Tabela do certificado emitido quando um contato é anonimizado + chave por
-- organização (settings.clinic.atestado_anonimizacao, nasce desligada).
-- Aditiva e idempotente; sem HTTP. Quem escreve é o service role (servidor);
-- o administrador da empresa só LÊ. Linha emitida é imutável para authenticated.

create table if not exists public.clinic_atestados_anonimizacao (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id),
  anonimizado_em timestamptz not null,
  emitido_em timestamptz not null default now(),
  executor jsonb not null,
  ip text,
  retidos jsonb not null default '{}'::jsonb,
  codigo text not null,
  codigo_curto text not null,
  algoritmo text not null check (algoritmo in ('hmac-sha256', 'sha256')),
  pdf_path text not null,
  pdf_sha256 text not null,
  pades boolean not null default false,
  versao text not null,
  constraint clinic_atestados_anonimizacao_contato_key unique (organization_id, contact_id)
);
create index if not exists clinic_atestados_anonimizacao_codigo_curto_idx
  on public.clinic_atestados_anonimizacao (organization_id, codigo_curto);

alter table public.clinic_atestados_anonimizacao enable row level security;
drop policy if exists tenant_isolation_clinic_atestados_anonimizacao_select on public.clinic_atestados_anonimizacao;
create policy tenant_isolation_clinic_atestados_anonimizacao_select on public.clinic_atestados_anonimizacao
  for select
  using (organization_id in (select public.fn_user_org_ids())
         and public.fn_role_at_least(organization_id, 'admin'));
revoke all on public.clinic_atestados_anonimizacao from anon;
revoke insert, update, delete, truncate on public.clinic_atestados_anonimizacao from authenticated;

-- Mesmo molde de fn_clinic_definir_titulo_livre (8003): admin + MFA provado.
create or replace function public.fn_clinic_definir_atestado_anonimizacao(p_org uuid, p_ligado boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes boolean;
begin
  if auth.uid() is null
     or p_org is null
     or p_ligado is null
     or not public.fn_role_at_least(p_org, 'admin')
     or not public.fn_support_write_allowed(p_org) then
    raise exception 'clinic_flag_forbidden' using errcode = '42501';
  end if;
  if not public.fn_session_mfa_proven() then
    raise exception 'clinic_flag_mfa_required' using errcode = '42501';
  end if;

  select (o.settings -> 'clinic' -> 'atestado_anonimizacao') = 'true'::jsonb into v_antes
    from public.organizations o
   where o.id = p_org;
  if not found then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;

  update public.organizations
     set settings = jsonb_set(
           coalesce(settings, '{}'::jsonb),
           '{clinic}',
           (case when jsonb_typeof(settings -> 'clinic') = 'object' then settings -> 'clinic' else '{}'::jsonb end)
             || jsonb_build_object('atestado_anonimizacao', p_ligado),
           true)
   where id = p_org;

  return jsonb_build_object('ligado', p_ligado, 'mudou', coalesce(v_antes, false) <> p_ligado);
end $$;
revoke execute on function public.fn_clinic_definir_atestado_anonimizacao(uuid, boolean) from public, anon;
grant  execute on function public.fn_clinic_definir_atestado_anonimizacao(uuid, boolean) to authenticated;
