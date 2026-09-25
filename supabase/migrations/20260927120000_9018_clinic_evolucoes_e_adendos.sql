-- ════════════════════════════════════════════════════════════════════════════
-- 9018 · clinic — evolução, adendos e o prontuário IMUTÁVEL (FORK, prontuário F2)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/prontuario/plano.md (fase F2, seção 14).
--
--   clinic_evolucoes   a evolução do atendimento (uma por atendimento)
--   clinic_adendos     correção de registro FINALIZADO: original + texto +
--                      motivo + autor + data (append-only)
--
-- Enquanto o atendimento está em andamento, anamnese, avaliação e evolução são
-- rascunho (autosave com versão). Ao FINALIZAR (requisito mínimo: evolução com
-- conteúdo e campos obrigatórios dos formulários preenchidos), tudo vira
-- `finalizado` e um trigger recusa UPDATE/DELETE — inclusive do service role.
-- Correção é só por adendo. Idempotente.

-- ─── evolução ──────────────────────────────────────────────────────────────
create table if not exists public.clinic_evolucoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  atendimento_id uuid not null,
  resposta text,
  observacoes text,
  intercorrencias text,
  orientacoes text,
  proxima_conduta text,
  status text not null default 'rascunho',
  versao integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint clinic_evolucoes_status_check check (status in ('rascunho', 'finalizado')),
  constraint clinic_evolucoes_tamanhos check (
    coalesce(char_length(resposta), 0) <= 5000 and coalesce(char_length(observacoes), 0) <= 5000
    and coalesce(char_length(intercorrencias), 0) <= 5000 and coalesce(char_length(orientacoes), 0) <= 5000
    and coalesce(char_length(proxima_conduta), 0) <= 5000),
  constraint clinic_evolucoes_atendimento_key unique (atendimento_id),
  constraint clinic_evolucoes_org_id_key unique (organization_id, id),
  constraint clinic_evolucoes_do_atendimento foreign key (organization_id, atendimento_id)
    references public.clinic_atendimentos (organization_id, id) on delete cascade
);

drop trigger if exists clinic_evolucoes_updated_at on public.clinic_evolucoes;
create trigger clinic_evolucoes_updated_at before update on public.clinic_evolucoes
  for each row execute function public.fn_set_updated_at();

-- ─── adendos (append-only) ─────────────────────────────────────────────────
create table if not exists public.clinic_adendos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  atendimento_id uuid not null,
  alvo_tipo text not null,
  alvo_id uuid not null,
  texto text not null,
  motivo text not null,
  autor uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint clinic_adendos_alvo_tipo_check check (alvo_tipo in ('formulario', 'evolucao')),
  constraint clinic_adendos_texto_tamanho check (char_length(btrim(texto)) between 1 and 5000),
  constraint clinic_adendos_motivo_tamanho check (char_length(btrim(motivo)) between 3 and 300),
  constraint clinic_adendos_do_atendimento foreign key (organization_id, atendimento_id)
    references public.clinic_atendimentos (organization_id, id) on delete cascade
);
create index if not exists clinic_adendos_atendimento_idx
  on public.clinic_adendos (organization_id, atendimento_id, created_at);

-- ─── RLS ───────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['clinic_evolucoes','clinic_adendos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation_%s_all on public.%I', t, t);
    execute format('drop policy if exists %s_select on public.%I', t, t);
    execute format($p$create policy %s_select on public.%I for select using (
        (organization_id in (select public.fn_user_org_ids()))
        and public.fn_has_permission(organization_id, 'prontuario.ver'))$p$, t, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
  end loop;
end $$;
revoke update, delete, truncate on public.clinic_adendos from service_role;

-- ─── imutabilidade ─────────────────────────────────────────────────────────
-- DELETE direto: nunca (a cascata de exclusão da empresa passa, por ser aninhada).
-- UPDATE: só de rascunho, com o atendimento em andamento.
create or replace function public.fn_clinic_registro_imutavel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() = 1 then
      raise exception 'prontuario_imutavel' using errcode = '55000';
    end if;
    return old;
  end if;
  if old.status = 'finalizado'
     or coalesce((select a.status from public.clinic_atendimentos a where a.id = old.atendimento_id), '') <> 'em_andamento' then
    raise exception 'prontuario_imutavel' using errcode = '55000';
  end if;
  return new;
end $$;
revoke execute on function public.fn_clinic_registro_imutavel() from public, anon, authenticated;

drop trigger if exists trg_clinic_formulario_imutavel on public.clinic_formularios_preenchidos;
create trigger trg_clinic_formulario_imutavel before update or delete on public.clinic_formularios_preenchidos
  for each row execute function public.fn_clinic_registro_imutavel();
drop trigger if exists trg_clinic_evolucao_imutavel on public.clinic_evolucoes;
create trigger trg_clinic_evolucao_imutavel before update or delete on public.clinic_evolucoes
  for each row execute function public.fn_clinic_registro_imutavel();

-- ─── salvar a evolução (autosave com versão) ───────────────────────────────
create or replace function public.fn_clinic_salvar_evolucao(
  p_org uuid,
  p_atendimento uuid,
  p_resposta text,
  p_observacoes text,
  p_intercorrencias text,
  p_orientacoes text,
  p_proxima_conduta text,
  p_versao_esperada integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_at record;
  v_atual record;
  v_id uuid;
  v_versao integer;
begin
  perform public.fn_acesso_exigir(p_org, 'atendimento.registrar');
  if not coalesce((select (o.settings -> 'clinic' -> 'prontuario') = 'true'::jsonb from public.organizations o where o.id = p_org), false) then
    raise exception 'prontuario_desligado' using errcode = '42501';
  end if;

  select c.id, c.status into v_at
    from public.clinic_atendimentos c
   where c.id = p_atendimento and c.organization_id = p_org
   for update;
  if not found then
    raise exception 'atendimento_nao_encontrado' using errcode = 'P0002';
  end if;
  if v_at.status <> 'em_andamento' then
    raise exception 'prontuario_imutavel' using errcode = '55000';
  end if;

  select e.id, e.versao, e.status into v_atual
    from public.clinic_evolucoes e
   where e.organization_id = p_org and e.atendimento_id = p_atendimento
   for update;

  if not found then
    if coalesce(p_versao_esperada, 0) <> 0 then
      raise exception 'registro_conflito' using errcode = '40001';
    end if;
    insert into public.clinic_evolucoes
      (organization_id, atendimento_id, resposta, observacoes, intercorrencias, orientacoes, proxima_conduta, created_by, updated_by)
    values (p_org, p_atendimento, p_resposta, p_observacoes, p_intercorrencias, p_orientacoes, p_proxima_conduta, auth.uid(), auth.uid())
    returning id, versao into v_id, v_versao;
    return jsonb_build_object('id', v_id, 'versao', v_versao, 'criado', true);
  end if;

  if v_atual.status = 'finalizado' then
    raise exception 'prontuario_imutavel' using errcode = '55000';
  end if;
  if v_atual.versao is distinct from p_versao_esperada then
    raise exception 'registro_conflito' using errcode = '40001', detail = v_atual.versao::text;
  end if;

  update public.clinic_evolucoes
     set resposta = p_resposta, observacoes = p_observacoes, intercorrencias = p_intercorrencias,
         orientacoes = p_orientacoes, proxima_conduta = p_proxima_conduta,
         versao = versao + 1, updated_by = auth.uid()
   where id = v_atual.id
  returning versao into v_versao;
  return jsonb_build_object('id', v_atual.id, 'versao', v_versao, 'criado', false);
end $$;
revoke execute on function public.fn_clinic_salvar_evolucao(uuid, uuid, text, text, text, text, text, integer) from public, anon;
grant  execute on function public.fn_clinic_salvar_evolucao(uuid, uuid, text, text, text, text, text, integer) to authenticated;

-- ─── adendo ────────────────────────────────────────────────────────────────
create or replace function public.fn_clinic_adicionar_adendo(
  p_org uuid,
  p_atendimento uuid,
  p_alvo_tipo text,
  p_alvo_id uuid,
  p_texto text,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_id uuid;
begin
  perform public.fn_acesso_exigir(p_org, 'prontuario.adendo');

  select c.status into v_status
    from public.clinic_atendimentos c
   where c.id = p_atendimento and c.organization_id = p_org;
  if not found then
    raise exception 'atendimento_nao_encontrado' using errcode = 'P0002';
  end if;
  if v_status <> 'finalizado' then
    raise exception 'adendo_so_em_finalizado' using errcode = '22023';
  end if;
  if not (
    (p_alvo_tipo = 'formulario' and exists (
       select 1 from public.clinic_formularios_preenchidos f
        where f.id = p_alvo_id and f.organization_id = p_org and f.atendimento_id = p_atendimento))
    or (p_alvo_tipo = 'evolucao' and exists (
       select 1 from public.clinic_evolucoes e
        where e.id = p_alvo_id and e.organization_id = p_org and e.atendimento_id = p_atendimento))
  ) then
    raise exception 'adendo_alvo_invalido' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'adendo_sem_motivo' using errcode = '22023';
  end if;

  insert into public.clinic_adendos (organization_id, atendimento_id, alvo_tipo, alvo_id, texto, motivo, autor)
  values (p_org, p_atendimento, p_alvo_tipo, p_alvo_id, btrim(p_texto), btrim(p_motivo), auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;
revoke execute on function public.fn_clinic_adicionar_adendo(uuid, uuid, text, uuid, text, text) from public, anon;
grant  execute on function public.fn_clinic_adicionar_adendo(uuid, uuid, text, uuid, text, text) to authenticated;

-- ─── finalizar (substitui a da 9016): requisitos + congelar ────────────────
create or replace function public.fn_clinic_finalizar_atendimento(p_org uuid, p_atendimento uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_at record;
  v_faltam text[] := '{}';
begin
  perform public.fn_acesso_exigir(p_org, 'atendimento.finalizar');

  select c.id, c.status, c.appointment_id into v_at
    from public.clinic_atendimentos c
   where c.id = p_atendimento and c.organization_id = p_org
   for update;
  if not found then
    raise exception 'atendimento_nao_encontrado' using errcode = 'P0002';
  end if;
  if v_at.status = 'finalizado' then
    return jsonb_build_object('id', v_at.id, 'appointment_id', v_at.appointment_id, 'mudou', false);
  end if;
  if v_at.status <> 'em_andamento' then
    raise exception 'atendimento_ja_encerrado' using errcode = '22023';
  end if;

  -- Requisito mínimo: evolução com conteúdo.
  if not exists (
    select 1 from public.clinic_evolucoes e
     where e.atendimento_id = v_at.id
       and coalesce(nullif(btrim(e.resposta), ''), nullif(btrim(e.observacoes), ''), nullif(btrim(e.intercorrencias), ''),
                    nullif(btrim(e.orientacoes), ''), nullif(btrim(e.proxima_conduta), '')) is not null
  ) then
    v_faltam := array_append(v_faltam, 'evolucao');
  end if;
  -- Formulário iniciado precisa ter os campos obrigatórios da versão usada.
  v_faltam := v_faltam || coalesce((
    select array_agg(f.tipo order by f.tipo)
      from public.clinic_formularios_preenchidos f
      join public.clinic_modelos_formulario_versoes v on v.id = f.modelo_versao_id
     where f.atendimento_id = v_at.id
       and exists (
         select 1 from jsonb_array_elements(v.campos) c
          where coalesce((c ->> 'obrigatorio')::boolean, false)
            and (not (f.respostas ? (c ->> 'chave'))
                 or f.respostas -> (c ->> 'chave') in ('null'::jsonb, '""'::jsonb, '[]'::jsonb)))
  ), '{}');
  if cardinality(v_faltam) > 0 then
    raise exception 'requisitos_pendentes' using errcode = '23514', detail = array_to_string(v_faltam, ',');
  end if;

  update public.clinic_formularios_preenchidos set status = 'finalizado', updated_by = auth.uid()
   where atendimento_id = v_at.id and status = 'rascunho';
  update public.clinic_evolucoes set status = 'finalizado', updated_by = auth.uid()
   where atendimento_id = v_at.id and status = 'rascunho';

  update public.clinic_atendimentos
     set status = 'finalizado', finished_at = now(), finalizado_por = auth.uid(),
         updated_by = auth.uid(), versao = versao + 1
   where id = v_at.id;

  insert into public.clinic_atendimento_eventos (organization_id, atendimento_id, tipo, status_antes, status_depois, ator)
  values (p_org, v_at.id, 'finalizado', 'em_andamento', 'finalizado', auth.uid());

  return jsonb_build_object('id', v_at.id, 'appointment_id', v_at.appointment_id, 'mudou', true);
end $$;
revoke execute on function public.fn_clinic_finalizar_atendimento(uuid, uuid) from public, anon;
grant  execute on function public.fn_clinic_finalizar_atendimento(uuid, uuid) to authenticated;
