-- ════════════════════════════════════════════════════════════════════════════
-- 9035 · clinic — estoque: alertas (FORK, estoque E7)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/estoque/plano.md. Uma varredura (cron `estoque-alertas`,
-- de hora em hora, service role) olha o estoque de cada clínica com a opção
-- ligada e mantém a lista de alertas em dia:
--
--   abaixo_minimo      saldo total < estoque mínimo do produto
--   ponto_pedido       saldo total <= ponto de pedido (e não abaixo do mínimo)
--   validade_proxima   lote com saldo vencendo em até 30/60/90 dias (a faixa
--                      faz parte da chave: mudar de faixa abre outro alerta)
--   lote_vencido       lote vencido ainda com saldo
--   frasco_vencido     frasco aberto vencido ainda com conteúdo (a tela tem
--                      "Registrar perda" — decisão do dono: só alertar)
--   pendencias_baixa   há pendências da baixa pelo prontuário em aberto
--
-- O que surgiu abre; o que deixou de valer resolve sozinho; quem dispensa
-- (com motivo) não vê o mesmo alerta voltar por 7 dias. Nada de paciente no
-- alerta: produto, lote, quantidades e datas.
--
--   clinic_estoque_alertas
--
-- Aditiva e idempotente (também anexada ao fim de supabase/baseline.sql).

create table if not exists public.clinic_estoque_alertas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tipo text not null,
  chave text not null,
  product_id uuid references public.catalog_products(id) on delete cascade,
  lote_id uuid,
  frasco_id uuid,
  detalhe jsonb not null default '{}'::jsonb,
  status text not null default 'aberto',
  aberto_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  fechado_em timestamptz,
  dispensado_por uuid,
  motivo text,
  constraint clinic_estoque_alertas_org_id_key unique (organization_id, id),
  constraint clinic_estoque_alertas_tipo check (tipo in (
    'abaixo_minimo', 'ponto_pedido', 'validade_proxima', 'lote_vencido', 'frasco_vencido', 'pendencias_baixa')),
  constraint clinic_estoque_alertas_status check (status in ('aberto', 'resolvido', 'dispensado')),
  constraint clinic_estoque_alertas_chave check (char_length(chave) between 1 and 200),
  constraint clinic_estoque_alertas_detalhe check (jsonb_typeof(detalhe) = 'object' and octet_length(detalhe::text) <= 2048),
  constraint clinic_estoque_alertas_motivo check (motivo is null or char_length(btrim(motivo)) between 1 and 300),
  constraint clinic_estoque_alertas_lote_fk foreign key (organization_id, lote_id)
    references public.clinic_estoque_lotes (organization_id, id),
  constraint clinic_estoque_alertas_frasco_fk foreign key (organization_id, frasco_id)
    references public.clinic_estoque_frascos (organization_id, id)
);
create unique index if not exists clinic_estoque_alertas_um_aberto
  on public.clinic_estoque_alertas (organization_id, chave) where status = 'aberto';
create index if not exists clinic_estoque_alertas_abertos_idx
  on public.clinic_estoque_alertas (organization_id, aberto_em desc) where status = 'aberto';

do $rls$
begin
  alter table public.clinic_estoque_alertas enable row level security;
  drop policy if exists tenant_isolation_clinic_estoque_alertas_all on public.clinic_estoque_alertas;
  create policy tenant_isolation_clinic_estoque_alertas_all on public.clinic_estoque_alertas
    using ((organization_id in (select public.fn_user_org_ids()))
           and public.fn_role_at_least(organization_id, 'viewer'))
    with check ((organization_id in (select public.fn_user_org_ids()))
           and public.fn_role_at_least(organization_id, 'viewer'));
  drop policy if exists acesso_ler on public.clinic_estoque_alertas;
  create policy acesso_ler on public.clinic_estoque_alertas as restrictive for select
    using (public.fn_has_permission(organization_id, 'estoque.ver'));
  revoke all on public.clinic_estoque_alertas from anon;
  revoke insert, update, delete, truncate on public.clinic_estoque_alertas from authenticated;
end
$rls$;

-- ─── o que vale AGORA numa clínica (interna) ───────────────────────────────
create or replace function public.fn_clinic_estoque_alertas_atuais(p_org uuid)
returns table (tipo text, chave text, product_id uuid, lote_id uuid, frasco_id uuid, detalhe jsonb)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with por_produto as (
    select m.product_id, sum(m.quantidade) as saldo
      from public.clinic_estoque_movimentos m
     where m.organization_id = p_org
     group by m.product_id
  ),
  por_lote as (
    select m.lote_id, sum(m.quantidade) as saldo
      from public.clinic_estoque_movimentos m
     where m.organization_id = p_org
     group by m.lote_id
    having sum(m.quantidade) > 0
  )
  select 'abaixo_minimo', 'abaixo_minimo:' || e.product_id, e.product_id, null::uuid, null::uuid,
         jsonb_build_object('saldo', coalesce(s.saldo, 0), 'minimo', e.estoque_minimo, 'unidade', e.unidade_aplicacao)
    from public.clinic_produto_estoque e
    left join por_produto s on s.product_id = e.product_id
   where e.organization_id = p_org and e.estoque_minimo > 0 and coalesce(s.saldo, 0) < e.estoque_minimo
  union all
  select 'ponto_pedido', 'ponto_pedido:' || e.product_id, e.product_id, null, null,
         jsonb_build_object('saldo', coalesce(s.saldo, 0), 'ponto_pedido', e.ponto_pedido, 'unidade', e.unidade_aplicacao)
    from public.clinic_produto_estoque e
    left join por_produto s on s.product_id = e.product_id
   where e.organization_id = p_org and e.ponto_pedido is not null and coalesce(s.saldo, 0) <= e.ponto_pedido
     and not (e.estoque_minimo > 0 and coalesce(s.saldo, 0) < e.estoque_minimo)
  union all
  select 'lote_vencido', 'lote_vencido:' || l.id, l.product_id, l.id, null,
         jsonb_build_object('validade', l.validade, 'saldo', sl.saldo)
    from public.clinic_estoque_lotes l
    join por_lote sl on sl.lote_id = l.id
   where l.organization_id = p_org and l.validade < current_date
  union all
  select 'validade_proxima',
         'validade:' || l.id || ':' || f.faixa,
         l.product_id, l.id, null,
         jsonb_build_object('validade', l.validade, 'dias', l.validade - current_date, 'faixa', f.faixa, 'saldo', sl.saldo)
    from public.clinic_estoque_lotes l
    join por_lote sl on sl.lote_id = l.id
    cross join lateral (select case when l.validade - current_date <= 30 then 30
                                    when l.validade - current_date <= 60 then 60 else 90 end as faixa) f
   where l.organization_id = p_org and l.validade between current_date and current_date + 90
  union all
  select 'frasco_vencido', 'frasco_vencido:' || fa.id, fa.product_id, fa.lote_id, fa.id,
         jsonb_build_object('vence_em', fa.vence_em, 'conteudo', fa.conteudo)
    from public.clinic_estoque_frascos_abertos fa
   where fa.organization_id = p_org and fa.vencido and fa.conteudo > 0
  union all
  select 'pendencias_baixa', 'pendencias_baixa', null, null, null, jsonb_build_object('quantidade', count(*))
    from public.clinic_estoque_pendencias p
   where p.organization_id = p_org and p.status = 'aberta'
  having count(*) > 0
$$;
revoke execute on function public.fn_clinic_estoque_alertas_atuais(uuid) from public, anon, authenticated;

-- ─── a varredura (cron, service role) ──────────────────────────────────────
create or replace function public.fn_clinic_estoque_varrer_alertas()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_atuais jsonb;
  v_n integer;
  v_abertos integer := 0;
  v_resolvidos integer := 0;
begin
  for v_org in
    select o.id from public.organizations o where (o.settings -> 'clinic' -> 'estoque') = 'true'::jsonb
  loop
    select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into v_atuais from public.fn_clinic_estoque_alertas_atuais(v_org) a;

    -- resolve o que deixou de valer
    update public.clinic_estoque_alertas x
       set status = 'resolvido', fechado_em = now(), atualizado_em = now()
     where x.organization_id = v_org and x.status = 'aberto'
       and not exists (select 1 from jsonb_array_elements(v_atuais) a where a ->> 'chave' = x.chave);
    get diagnostics v_n = row_count;
    v_resolvidos := v_resolvidos + v_n;

    -- atualiza o detalhe do que continua
    update public.clinic_estoque_alertas x
       set detalhe = a -> 'detalhe', atualizado_em = now()
      from jsonb_array_elements(v_atuais) a
     where x.organization_id = v_org and x.status = 'aberto' and x.chave = a ->> 'chave'
       and x.detalhe is distinct from a -> 'detalhe';

    -- abre o que surgiu (dispensado há menos de 7 dias não volta)
    insert into public.clinic_estoque_alertas (organization_id, tipo, chave, product_id, lote_id, frasco_id, detalhe)
    select v_org, a ->> 'tipo', a ->> 'chave', nullif(a ->> 'product_id', '')::uuid, nullif(a ->> 'lote_id', '')::uuid,
           nullif(a ->> 'frasco_id', '')::uuid, coalesce(a -> 'detalhe', '{}'::jsonb)
      from jsonb_array_elements(v_atuais) a
     where not exists (select 1 from public.clinic_estoque_alertas x
                        where x.organization_id = v_org and x.chave = a ->> 'chave'
                          and (x.status = 'aberto' or (x.status = 'dispensado' and x.fechado_em > now() - interval '7 days')));
    get diagnostics v_n = row_count;
    v_abertos := v_abertos + v_n;
  end loop;
  return jsonb_build_object('abertos', v_abertos, 'resolvidos', v_resolvidos);
end $$;
revoke execute on function public.fn_clinic_estoque_varrer_alertas() from public, anon, authenticated;
grant  execute on function public.fn_clinic_estoque_varrer_alertas() to service_role;

-- ─── dispensar (com motivo) ─────────────────────────────────────────────────
create or replace function public.fn_clinic_estoque_alerta_dispensar(p_org uuid, p_alerta uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  perform public.fn_clinic_estoque_exigir(p_org, 'estoque.movimentar');
  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'estoque_sem_motivo' using errcode = '22023';
  end if;
  select a.status into v_status from public.clinic_estoque_alertas a
   where a.id = p_alerta and a.organization_id = p_org for update;
  if v_status is null then
    raise exception 'estoque_alerta_invalido' using errcode = 'P0002';
  end if;
  if v_status <> 'aberto' then
    raise exception 'estoque_alerta_fechado' using errcode = '22023';
  end if;
  update public.clinic_estoque_alertas
     set status = 'dispensado', motivo = left(btrim(p_motivo), 300), dispensado_por = auth.uid(),
         fechado_em = now(), atualizado_em = now()
   where id = p_alerta;
  return jsonb_build_object('status', 'dispensado');
end $$;
revoke execute on function public.fn_clinic_estoque_alerta_dispensar(uuid, uuid, text) from public, anon;
grant  execute on function public.fn_clinic_estoque_alerta_dispensar(uuid, uuid, text) to authenticated;
