-- ════════════════════════════════════════════════════════════════════════════
-- 9023 · clinic — documentos, termos e aceite eletrônico (FORK, prontuário F6)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/prontuario/plano.md (fase F6, seção 15, e "Termo de uso
-- de imagem").
--
--   clinic_modelos_documento          contrato, consentimento, autorização,
--                                     uso de imagem, ciência de orientações
--   clinic_modelos_documento_versoes  texto de cada versão (V1, V2...) e as
--                                     OPÇÕES que o paciente marca uma a uma
--                                     (uso de imagem). IMUTÁVEL.
--   clinic_documentos_emitidos        o texto RENDERIZADO para um paciente,
--                                     congelado, com sha256. Nunca muda depois
--                                     de emitido; mudar o modelo cria versão
--                                     nova e nada retroage.
--   clinic_documento_aceites          aceite e revogação (append-only): nome
--                                     digitado, canal (presencial | link),
--                                     opções escolhidas, IP e navegador.
--   clinic_documento_links            link de aceite: token guardado só como
--                                     HASH, expira, uso único.
--
-- Documento vive FORA do prontuário (termo não é conteúdo clínico): leitura com
-- `documentos.ver`, que a recepção pode ter. Uso clínico de foto nunca depende
-- do termo de uso de imagem; divulgação depende — `fn_clinic_uso_de_imagem_
-- autorizado` é o ponto único que a fase de fotos consulta.
--
-- Os textos padrão são MODELOS editáveis, não parecer jurídico: a clínica deve
-- revisá-los com advogado(a). Escrita só por função. Idempotente.

-- ─── modelos e versões ─────────────────────────────────────────────────────
create table if not exists public.clinic_modelos_documento (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tipo text not null,
  nome text not null,
  ativo boolean not null default true,
  padrao boolean not null default false,
  versao_atual integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint clinic_modelos_documento_tipo_check
    check (tipo in ('contrato', 'consentimento', 'autorizacao', 'uso_imagem', 'ciencia')),
  constraint clinic_modelos_documento_nome_tamanho check (char_length(btrim(nome)) between 1 and 120),
  constraint clinic_modelos_documento_org_id_key unique (organization_id, id)
);
create unique index if not exists clinic_modelos_documento_nome_key
  on public.clinic_modelos_documento (organization_id, lower(btrim(nome)));
drop trigger if exists clinic_modelos_documento_updated_at on public.clinic_modelos_documento;
create trigger clinic_modelos_documento_updated_at before update on public.clinic_modelos_documento
  for each row execute function public.fn_set_updated_at();

create table if not exists public.clinic_modelos_documento_versoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  modelo_id uuid not null,
  numero integer not null,
  conteudo text not null,
  -- [{chave, rotulo, obrigatoria?}] — o paciente marca cada uma; nenhuma vem marcada.
  opcoes jsonb not null default '[]'::jsonb,
  sha256 text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint clinic_modelos_documento_versoes_conteudo_tamanho check (char_length(conteudo) between 1 and 50000),
  constraint clinic_modelos_documento_versoes_opcoes_check check (jsonb_typeof(opcoes) = 'array' and jsonb_array_length(opcoes) <= 20),
  constraint clinic_modelos_documento_versoes_numero_key unique (modelo_id, numero),
  constraint clinic_modelos_documento_versoes_org_id_key unique (organization_id, id),
  constraint clinic_modelos_documento_versoes_do_modelo foreign key (organization_id, modelo_id)
    references public.clinic_modelos_documento (organization_id, id) on delete cascade
);

-- ─── documentos emitidos ───────────────────────────────────────────────────
create table if not exists public.clinic_documentos_emitidos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id),
  modelo_versao_id uuid not null,
  tipo text not null,
  titulo text not null,
  conteudo text not null,
  opcoes jsonb not null default '[]'::jsonb,
  sha256 text not null,
  atendimento_id uuid,
  plano_id uuid,
  validade_ate date,
  status text not null default 'emitido',
  motivo text,
  emitido_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_documentos_emitidos_status_check check (status in ('emitido', 'aceito', 'revogado', 'cancelado')),
  constraint clinic_documentos_emitidos_titulo_tamanho check (char_length(btrim(titulo)) between 1 and 160),
  constraint clinic_documentos_emitidos_conteudo_tamanho check (char_length(conteudo) between 1 and 60000),
  constraint clinic_documentos_emitidos_org_id_key unique (organization_id, id),
  constraint clinic_documentos_emitidos_da_versao foreign key (organization_id, modelo_versao_id)
    references public.clinic_modelos_documento_versoes (organization_id, id),
  constraint clinic_documentos_emitidos_do_atendimento foreign key (organization_id, atendimento_id)
    references public.clinic_atendimentos (organization_id, id),
  constraint clinic_documentos_emitidos_do_plano foreign key (organization_id, plano_id)
    references public.clinic_planos_tratamento (organization_id, id)
);
create index if not exists clinic_documentos_emitidos_paciente_idx
  on public.clinic_documentos_emitidos (organization_id, contact_id, created_at desc);
drop trigger if exists clinic_documentos_emitidos_updated_at on public.clinic_documentos_emitidos;
create trigger clinic_documentos_emitidos_updated_at before update on public.clinic_documentos_emitidos
  for each row execute function public.fn_set_updated_at();

-- O que foi emitido NUNCA muda; só o status anda (emitido → aceito | cancelado;
-- aceito → revogado). DELETE direto recusado.
create or replace function public.fn_clinic_documento_imutavel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() = 1 then
      raise exception 'documento_imutavel' using errcode = '55000';
    end if;
    return old;
  end if;
  if new.conteudo is distinct from old.conteudo or new.sha256 is distinct from old.sha256
     or new.opcoes is distinct from old.opcoes or new.modelo_versao_id is distinct from old.modelo_versao_id
     or new.contact_id is distinct from old.contact_id or new.titulo is distinct from old.titulo
     or new.organization_id is distinct from old.organization_id
     or not ((old.status = new.status)
             or (old.status = 'emitido' and new.status in ('aceito', 'cancelado'))
             or (old.status = 'aceito' and new.status = 'revogado')) then
    raise exception 'documento_imutavel' using errcode = '55000';
  end if;
  return new;
end $$;
revoke execute on function public.fn_clinic_documento_imutavel() from public, anon, authenticated;
drop trigger if exists trg_clinic_documento_imutavel on public.clinic_documentos_emitidos;
create trigger trg_clinic_documento_imutavel before update or delete on public.clinic_documentos_emitidos
  for each row execute function public.fn_clinic_documento_imutavel();

create table if not exists public.clinic_documento_aceites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  documento_id uuid not null,
  tipo text not null,
  canal text not null,
  nome_digitado text,
  opcoes_escolhidas jsonb not null default '{}'::jsonb,
  motivo text,
  ip text,
  user_agent text,
  registrado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint clinic_documento_aceites_tipo_check check (tipo in ('aceite', 'revogacao')),
  constraint clinic_documento_aceites_canal_check check (canal in ('presencial', 'link')),
  constraint clinic_documento_aceites_tamanhos check (
    coalesce(char_length(nome_digitado), 0) <= 160 and coalesce(char_length(motivo), 0) <= 300
    and coalesce(char_length(ip), 0) <= 64 and coalesce(char_length(user_agent), 0) <= 300),
  constraint clinic_documento_aceites_opcoes_check check (jsonb_typeof(opcoes_escolhidas) = 'object'),
  constraint clinic_documento_aceites_do_documento foreign key (organization_id, documento_id)
    references public.clinic_documentos_emitidos (organization_id, id) on delete cascade
);
create index if not exists clinic_documento_aceites_documento_idx
  on public.clinic_documento_aceites (organization_id, documento_id, created_at);

create table if not exists public.clinic_documento_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  documento_id uuid not null,
  token_hash text not null,
  expira_em timestamptz not null,
  usado_em timestamptz,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint clinic_documento_links_hash_formato check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint clinic_documento_links_hash_key unique (token_hash),
  constraint clinic_documento_links_do_documento foreign key (organization_id, documento_id)
    references public.clinic_documentos_emitidos (organization_id, id) on delete cascade
);

-- ─── RLS ───────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['clinic_modelos_documento','clinic_modelos_documento_versoes','clinic_documentos_emitidos',
                           'clinic_documento_aceites','clinic_documento_links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation_%s_all on public.%I', t, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
  end loop;
end $$;
revoke update, delete, truncate on public.clinic_modelos_documento_versoes from service_role;
revoke update, delete, truncate on public.clinic_documento_aceites from service_role;
-- Links: ninguém lê pela API (só o hash existe, e só as funções o usam).
revoke select on public.clinic_documento_links from authenticated;

drop policy if exists clinic_modelos_documento_select on public.clinic_modelos_documento;
create policy clinic_modelos_documento_select on public.clinic_modelos_documento for select using (
  organization_id in (select public.fn_user_org_ids()));
drop policy if exists clinic_modelos_documento_versoes_select on public.clinic_modelos_documento_versoes;
create policy clinic_modelos_documento_versoes_select on public.clinic_modelos_documento_versoes for select using (
  organization_id in (select public.fn_user_org_ids()));
drop policy if exists clinic_documentos_emitidos_select on public.clinic_documentos_emitidos;
create policy clinic_documentos_emitidos_select on public.clinic_documentos_emitidos for select using (
  (organization_id in (select public.fn_user_org_ids()))
  and public.fn_has_permission(organization_id, 'documentos.ver'));
drop policy if exists clinic_documento_aceites_select on public.clinic_documento_aceites;
create policy clinic_documento_aceites_select on public.clinic_documento_aceites for select using (
  (organization_id in (select public.fn_user_org_ids()))
  and public.fn_has_permission(organization_id, 'documentos.ver'));
drop policy if exists clinic_documento_links_select on public.clinic_documento_links;
create policy clinic_documento_links_select on public.clinic_documento_links for select using (false);

-- ─── utilidades ────────────────────────────────────────────────────────────
create or replace function public.fn_clinic_sha256(p_texto text)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select encode(digest(convert_to(p_texto, 'UTF8'), 'sha256'), 'hex');
$$;
revoke execute on function public.fn_clinic_sha256(text) from public, anon;

-- Opções de um modelo: [{chave, rotulo, obrigatoria?}] com chaves únicas.
create or replace function public.fn_clinic_documento_opcoes_validas(p_opcoes jsonb)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_typeof(p_opcoes) = 'array' and jsonb_array_length(p_opcoes) <= 20
     and not exists (
       select 1 from jsonb_array_elements(p_opcoes) o
        where jsonb_typeof(o) <> 'object'
           or coalesce(o ->> 'chave', '') !~ '^[a-z][a-z0-9_]{0,39}$'
           or char_length(coalesce(o ->> 'rotulo', '')) not between 1 and 500)
     and (select count(distinct o ->> 'chave') from jsonb_array_elements(p_opcoes) o) = jsonb_array_length(p_opcoes)
$$;
revoke execute on function public.fn_clinic_documento_opcoes_validas(jsonb) from public, anon;

-- Escolhas do paciente: objeto {chave: boolean} com TODAS as chaves das opções
-- (nada presumido) e as obrigatórias marcadas.
create or replace function public.fn_clinic_documento_escolhas_validas(p_opcoes jsonb, p_escolhas jsonb)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_typeof(p_escolhas) = 'object'
     and (select count(*) from jsonb_object_keys(p_escolhas)) = jsonb_array_length(p_opcoes)
     and not exists (
       select 1 from jsonb_array_elements(p_opcoes) o
        where jsonb_typeof(p_escolhas -> (o ->> 'chave')) is distinct from 'boolean'
           or (coalesce((o ->> 'obrigatoria')::boolean, false) and (p_escolhas -> (o ->> 'chave')) <> 'true'::jsonb))
$$;
revoke execute on function public.fn_clinic_documento_escolhas_validas(jsonb, jsonb) from public, anon;

-- ─── modelos: criar / nova versão / dados ──────────────────────────────────
create or replace function public.fn_clinic_documento_modelo_salvar(
  p_org uuid, p_modelo uuid, p_tipo text, p_nome text, p_conteudo text, p_opcoes jsonb, p_ativo boolean, p_versao_esperada integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_atual record;
  v_id uuid;
  v_versao uuid;
  v_numero integer;
  v_ultima record;
begin
  perform public.fn_acesso_exigir(p_org, 'modelos_clinicos.gerenciar');
  if char_length(coalesce(p_conteudo, '')) not between 1 and 50000 or not public.fn_clinic_documento_opcoes_validas(coalesce(p_opcoes, '[]'::jsonb)) then
    raise exception 'documento_modelo_invalido' using errcode = '22023';
  end if;
  if p_modelo is null then
    if p_tipo not in ('contrato', 'consentimento', 'autorizacao', 'uso_imagem', 'ciencia') then
      raise exception 'documento_modelo_invalido' using errcode = '22023';
    end if;
    insert into public.clinic_modelos_documento (organization_id, tipo, nome, ativo, created_by)
    values (p_org, p_tipo, btrim(p_nome), coalesce(p_ativo, true), auth.uid())
    returning id into v_id;
    insert into public.clinic_modelos_documento_versoes (organization_id, modelo_id, numero, conteudo, opcoes, sha256, created_by)
    values (p_org, v_id, 1, p_conteudo, coalesce(p_opcoes, '[]'::jsonb), public.fn_clinic_sha256(p_conteudo), auth.uid())
    returning id into v_versao;
    return jsonb_build_object('id', v_id, 'versao_id', v_versao, 'numero', 1);
  end if;

  select m.id, m.versao_atual into v_atual
    from public.clinic_modelos_documento m where m.id = p_modelo and m.organization_id = p_org for update;
  if not found then
    raise exception 'documento_modelo_nao_encontrado' using errcode = 'P0002';
  end if;
  if v_atual.versao_atual <> p_versao_esperada then
    raise exception 'registro_conflito' using errcode = '40001';
  end if;
  update public.clinic_modelos_documento set nome = btrim(p_nome), ativo = coalesce(p_ativo, true) where id = p_modelo;
  select v.id, v.conteudo, v.opcoes into v_ultima
    from public.clinic_modelos_documento_versoes v where v.modelo_id = p_modelo and v.numero = v_atual.versao_atual;
  v_numero := v_atual.versao_atual;
  v_versao := v_ultima.id;
  -- Texto ou opções mudaram: versão NOVA; quem já aceitou a anterior continua nela.
  if v_ultima.conteudo is distinct from p_conteudo or v_ultima.opcoes is distinct from coalesce(p_opcoes, '[]'::jsonb) then
    v_numero := v_atual.versao_atual + 1;
    insert into public.clinic_modelos_documento_versoes (organization_id, modelo_id, numero, conteudo, opcoes, sha256, created_by)
    values (p_org, p_modelo, v_numero, p_conteudo, coalesce(p_opcoes, '[]'::jsonb), public.fn_clinic_sha256(p_conteudo), auth.uid())
    returning id into v_versao;
    update public.clinic_modelos_documento set versao_atual = v_numero where id = p_modelo;
  end if;
  return jsonb_build_object('id', p_modelo, 'versao_id', v_versao, 'numero', v_numero);
exception when unique_violation then
  raise exception 'documento_modelo_nome_em_uso' using errcode = '23505';
end $$;
revoke execute on function public.fn_clinic_documento_modelo_salvar(uuid, uuid, text, text, text, jsonb, boolean, integer) from public, anon;
grant  execute on function public.fn_clinic_documento_modelo_salvar(uuid, uuid, text, text, text, jsonb, boolean, integer) to authenticated;

-- ─── emitir (texto já renderizado pelo servidor; o banco congela e assina) ──
create or replace function public.fn_clinic_documento_emitir(
  p_org uuid, p_contact uuid, p_modelo_versao uuid, p_titulo text, p_conteudo text,
  p_atendimento uuid, p_plano uuid, p_validade_ate date)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_versao record;
  v_id uuid;
  v_hash text;
begin
  perform public.fn_acesso_exigir(p_org, 'documentos.emitir');
  if not coalesce((select (o.settings -> 'clinic' -> 'prontuario') = 'true'::jsonb from public.organizations o where o.id = p_org), false) then
    raise exception 'prontuario_desligado' using errcode = '42501';
  end if;
  select v.id, v.opcoes, m.tipo, m.ativo into v_versao
    from public.clinic_modelos_documento_versoes v
    join public.clinic_modelos_documento m on m.id = v.modelo_id
   where v.id = p_modelo_versao and v.organization_id = p_org;
  if not found or not v_versao.ativo
     or not exists (select 1 from public.contacts c where c.id = p_contact and c.organization_id = p_org)
     or (p_atendimento is not null and not exists (
           select 1 from public.clinic_atendimentos a where a.id = p_atendimento and a.organization_id = p_org and a.contact_id = p_contact))
     or (p_plano is not null and not exists (
           select 1 from public.clinic_planos_tratamento p where p.id = p_plano and p.organization_id = p_org and p.contact_id = p_contact))
     or char_length(coalesce(p_conteudo, '')) not between 1 and 60000 then
    raise exception 'documento_invalido' using errcode = '22023';
  end if;
  v_hash := public.fn_clinic_sha256(p_conteudo);
  insert into public.clinic_documentos_emitidos
    (organization_id, contact_id, modelo_versao_id, tipo, titulo, conteudo, opcoes, sha256, atendimento_id, plano_id, validade_ate, emitido_por)
  values (p_org, p_contact, p_modelo_versao, v_versao.tipo, btrim(p_titulo), p_conteudo, v_versao.opcoes, v_hash,
          p_atendimento, p_plano, p_validade_ate, auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'sha256', v_hash);
end $$;
revoke execute on function public.fn_clinic_documento_emitir(uuid, uuid, uuid, text, text, uuid, uuid, date) from public, anon;
grant  execute on function public.fn_clinic_documento_emitir(uuid, uuid, uuid, text, text, uuid, uuid, date) to authenticated;

-- Núcleo do aceite (presencial ou link). Não é chamável de fora.
create or replace function public.fn_clinic_documento_registrar_aceite(
  p_documento uuid, p_canal text, p_nome text, p_escolhas jsonb, p_ip text, p_user_agent text, p_por uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc record;
begin
  select d.id, d.organization_id, d.status, d.opcoes into v_doc
    from public.clinic_documentos_emitidos d where d.id = p_documento for update;
  if not found then
    raise exception 'documento_nao_encontrado' using errcode = 'P0002';
  end if;
  if v_doc.status <> 'emitido' then
    raise exception 'documento_ja_respondido' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_nome, ''))) < 3 then
    raise exception 'documento_sem_nome' using errcode = '22023';
  end if;
  if not public.fn_clinic_documento_escolhas_validas(v_doc.opcoes, coalesce(p_escolhas, '{}'::jsonb)) then
    raise exception 'documento_escolhas_invalidas' using errcode = '22023';
  end if;
  insert into public.clinic_documento_aceites
    (organization_id, documento_id, tipo, canal, nome_digitado, opcoes_escolhidas, ip, user_agent, registrado_por)
  values (v_doc.organization_id, v_doc.id, 'aceite', p_canal, left(btrim(p_nome), 160), coalesce(p_escolhas, '{}'::jsonb),
          left(p_ip, 64), left(p_user_agent, 300), p_por);
  update public.clinic_documentos_emitidos set status = 'aceito' where id = v_doc.id;
  return jsonb_build_object('id', v_doc.id, 'organization_id', v_doc.organization_id);
end $$;
revoke execute on function public.fn_clinic_documento_registrar_aceite(uuid, text, text, jsonb, text, text, uuid) from public, anon, authenticated;

create or replace function public.fn_clinic_documento_aceitar(
  p_org uuid, p_documento uuid, p_nome text, p_escolhas jsonb, p_user_agent text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_acesso_exigir(p_org, 'documentos.colher_aceite');
  if not exists (select 1 from public.clinic_documentos_emitidos d where d.id = p_documento and d.organization_id = p_org) then
    raise exception 'documento_nao_encontrado' using errcode = 'P0002';
  end if;
  return public.fn_clinic_documento_registrar_aceite(p_documento, 'presencial', p_nome, p_escolhas, null, p_user_agent, auth.uid());
end $$;
revoke execute on function public.fn_clinic_documento_aceitar(uuid, uuid, text, jsonb, text) from public, anon;
grant  execute on function public.fn_clinic_documento_aceitar(uuid, uuid, text, jsonb, text) to authenticated;

-- Link de aceite: o servidor gera o token (aleatório, forte) e manda só o HASH.
create or replace function public.fn_clinic_documento_link_criar(p_org uuid, p_documento uuid, p_token_hash text, p_horas integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expira timestamptz := now() + make_interval(hours => least(greatest(coalesce(p_horas, 72), 1), 720));
begin
  perform public.fn_acesso_exigir(p_org, 'documentos.colher_aceite');
  if not exists (
    select 1 from public.clinic_documentos_emitidos d where d.id = p_documento and d.organization_id = p_org and d.status = 'emitido') then
    raise exception 'documento_nao_encontrado' using errcode = 'P0002';
  end if;
  -- Um link vivo por documento: o anterior deixa de valer.
  update public.clinic_documento_links set expira_em = least(expira_em, now())
   where documento_id = p_documento and usado_em is null and expira_em > now();
  insert into public.clinic_documento_links (organization_id, documento_id, token_hash, expira_em, criado_por)
  values (p_org, p_documento, p_token_hash, v_expira, auth.uid());
  return jsonb_build_object('expira_em', v_expira);
end $$;
revoke execute on function public.fn_clinic_documento_link_criar(uuid, uuid, text, integer) from public, anon;
grant  execute on function public.fn_clinic_documento_link_criar(uuid, uuid, text, integer) to authenticated;

-- Página pública: só pelo service role, com o HASH do token. Devolve o termo
-- (não o prontuário) e o nome da clínica.
create or replace function public.fn_clinic_documento_publico_ler(p_token_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v record;
begin
  select d.id, d.titulo, d.conteudo, d.opcoes, d.status, d.sha256, o.display_name as clinica, l.expira_em, l.usado_em
    into v
    from public.clinic_documento_links l
    join public.clinic_documentos_emitidos d on d.id = l.documento_id
    join public.organizations o on o.id = d.organization_id
   where l.token_hash = p_token_hash;
  if not found or v.usado_em is not null or v.expira_em <= now() or v.status <> 'emitido' then
    return null;
  end if;
  return jsonb_build_object('titulo', v.titulo, 'conteudo', v.conteudo, 'opcoes', v.opcoes, 'sha256', v.sha256,
                            'clinica', v.clinica, 'expira_em', v.expira_em);
end $$;
revoke execute on function public.fn_clinic_documento_publico_ler(text) from public, anon, authenticated;
grant  execute on function public.fn_clinic_documento_publico_ler(text) to service_role;

create or replace function public.fn_clinic_documento_publico_aceitar(
  p_token_hash text, p_nome text, p_escolhas jsonb, p_ip text, p_user_agent text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_link record;
  v_r jsonb;
begin
  select l.id, l.documento_id, l.expira_em, l.usado_em into v_link
    from public.clinic_documento_links l where l.token_hash = p_token_hash for update;
  if not found or v_link.usado_em is not null or v_link.expira_em <= now() then
    raise exception 'documento_link_invalido' using errcode = 'P0002';
  end if;
  v_r := public.fn_clinic_documento_registrar_aceite(v_link.documento_id, 'link', p_nome, p_escolhas, p_ip, p_user_agent, null);
  update public.clinic_documento_links set usado_em = now() where id = v_link.id;
  return v_r || jsonb_build_object('documento_id', v_link.documento_id);
end $$;
revoke execute on function public.fn_clinic_documento_publico_aceitar(text, text, jsonb, text, text) from public, anon, authenticated;
grant  execute on function public.fn_clinic_documento_publico_aceitar(text, text, jsonb, text, text) to service_role;

-- Revogar (aceito → revogado; registro novo, o aceite continua lá) ou
-- cancelar (emitido e ainda não respondido → cancelado).
create or replace function public.fn_clinic_documento_encerrar(p_org uuid, p_documento uuid, p_acao text, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  perform public.fn_acesso_exigir(p_org, case when p_acao = 'revogar' then 'documentos.revogar' else 'documentos.emitir' end);
  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'documento_sem_motivo' using errcode = '22023';
  end if;
  select d.status into v_status
    from public.clinic_documentos_emitidos d where d.id = p_documento and d.organization_id = p_org for update;
  if not found then
    raise exception 'documento_nao_encontrado' using errcode = 'P0002';
  end if;
  if p_acao = 'revogar' and v_status = 'aceito' then
    insert into public.clinic_documento_aceites (organization_id, documento_id, tipo, canal, motivo, registrado_por)
    values (p_org, p_documento, 'revogacao', 'presencial', left(btrim(p_motivo), 300), auth.uid());
    update public.clinic_documentos_emitidos set status = 'revogado', motivo = left(btrim(p_motivo), 300) where id = p_documento;
  elsif p_acao = 'cancelar' and v_status = 'emitido' then
    update public.clinic_documentos_emitidos set status = 'cancelado', motivo = left(btrim(p_motivo), 300) where id = p_documento;
    update public.clinic_documento_links set expira_em = least(expira_em, now()) where documento_id = p_documento and usado_em is null;
  else
    raise exception 'documento_ja_respondido' using errcode = '22023';
  end if;
end $$;
revoke execute on function public.fn_clinic_documento_encerrar(uuid, uuid, text, text) from public, anon;
grant  execute on function public.fn_clinic_documento_encerrar(uuid, uuid, text, text) to authenticated;

-- Ponto único que a fase de fotos consulta: o paciente autorizou ESTA
-- finalidade (opção do termo de uso de imagem), dentro do prazo, sem revogar?
create or replace function public.fn_clinic_uso_de_imagem_autorizado(p_org uuid, p_contact uuid, p_opcao text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.clinic_documentos_emitidos d
      join lateral (
        select a.opcoes_escolhidas from public.clinic_documento_aceites a
         where a.documento_id = d.id and a.tipo = 'aceite' order by a.created_at desc limit 1) a on true
     where d.organization_id = p_org and d.contact_id = p_contact and d.tipo = 'uso_imagem' and d.status = 'aceito'
       and (d.validade_ate is null or d.validade_ate >= current_date)
       and (a.opcoes_escolhidas -> p_opcao) = 'true'::jsonb)
$$;
revoke execute on function public.fn_clinic_uso_de_imagem_autorizado(uuid, uuid, text) from public, anon, authenticated;

-- ─── requisito "documento": um termo ACEITO ligado ao atendimento ──────────
create or replace function public.fn_clinic_requisitos_faltando(p_atendimento uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_at record;
  v_faltam text[] := '{}';
  v_exigidas text[];
begin
  select c.id, c.organization_id, c.event_type_id, c.specialty_id into v_at
    from public.clinic_atendimentos c where c.id = p_atendimento;
  if not found then
    return v_faltam;
  end if;

  if not exists (
    select 1 from public.clinic_evolucoes e
     where e.atendimento_id = v_at.id
       and coalesce(nullif(btrim(e.resposta), ''), nullif(btrim(e.observacoes), ''), nullif(btrim(e.intercorrencias), ''),
                    nullif(btrim(e.orientacoes), ''), nullif(btrim(e.proxima_conduta), '')) is not null
  ) then
    v_faltam := array_append(v_faltam, 'evolucao');
  end if;

  select coalesce(array_agg(distinct r.secao), '{}') into v_exigidas
    from public.clinic_requisitos_finalizacao r
   where r.organization_id = v_at.organization_id
     and (r.event_type_id is null or r.event_type_id = v_at.event_type_id)
     and (r.specialty_id is null or r.specialty_id = v_at.specialty_id);

  if 'anamnese' = any (v_exigidas) and not exists (
    select 1 from public.clinic_formularios_preenchidos f where f.atendimento_id = v_at.id and f.tipo = 'anamnese') then
    v_faltam := array_append(v_faltam, 'anamnese');
  end if;
  if 'avaliacao' = any (v_exigidas) and not exists (
    select 1 from public.clinic_formularios_preenchidos f where f.atendimento_id = v_at.id and f.tipo = 'avaliacao') then
    v_faltam := array_append(v_faltam, 'avaliacao');
  end if;
  if 'conduta' = any (v_exigidas) and not exists (
    select 1 from public.clinic_condutas x
     where x.atendimento_id = v_at.id
       and coalesce(nullif(btrim(x.descricao), ''), nullif(btrim(x.protocolo), ''), nullif(btrim(x.recomendacoes), '')) is not null) then
    v_faltam := array_append(v_faltam, 'conduta');
  end if;
  if 'procedimento' = any (v_exigidas) and not exists (
    select 1 from public.clinic_procedimentos_realizados x where x.atendimento_id = v_at.id and x.status <> 'anulado') then
    v_faltam := array_append(v_faltam, 'procedimento');
  end if;
  if 'documento' = any (v_exigidas) and not exists (
    select 1 from public.clinic_documentos_emitidos d where d.atendimento_id = v_at.id and d.status = 'aceito') then
    v_faltam := array_append(v_faltam, 'documento');
  end if;

  v_faltam := v_faltam || coalesce((
    select array_agg(f.tipo order by f.tipo)
      from public.clinic_formularios_preenchidos f
      join public.clinic_modelos_formulario_versoes v on v.id = f.modelo_versao_id
     where f.atendimento_id = v_at.id
       and not (f.tipo = any (v_faltam))
       and exists (
         select 1 from jsonb_array_elements(v.campos) c
          where coalesce((c ->> 'obrigatorio')::boolean, false)
            and (not (f.respostas ? (c ->> 'chave'))
                 or f.respostas -> (c ->> 'chave') in ('null'::jsonb, '""'::jsonb, '[]'::jsonb)))
  ), '{}');

  return v_faltam;
end $$;
revoke execute on function public.fn_clinic_requisitos_faltando(uuid) from public, anon, authenticated;

-- ─── modelos padrão de cada empresa (textos editáveis, V1) ──────────────────
create or replace function public.fn_clinic_semear_documentos(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_m record;
  v_id uuid;
begin
  for v_m in
    select * from (values
      ('consentimento', 'Termo de consentimento para procedimento',
       E'# Termo de consentimento livre e esclarecido\n\nEu, {{paciente.nome}}, declaro que fui informado(a) por {{profissional.nome}}, da {{clinica.nome}}, sobre o procedimento {{procedimento}}: como é feito, os resultados esperados (que variam de pessoa para pessoa), os cuidados antes e depois, os riscos e as possíveis intercorrências, e as alternativas existentes.\n\nTive a oportunidade de fazer perguntas e todas foram respondidas. Informei com verdade meu histórico de saúde, alergias e medicamentos em uso.\n\nSei que posso desistir a qualquer momento antes da realização do procedimento.\n\nData: {{data}}',
       '[]'::jsonb),
      ('ciencia', 'Ciência das orientações pós-procedimento',
       E'# Ciência das orientações\n\nEu, {{paciente.nome}}, recebi da {{clinica.nome}} as orientações de cuidados após o procedimento {{procedimento}} e me comprometo a segui-las. Sei que devo entrar em contato com a clínica diante de qualquer reação diferente do esperado.\n\nData: {{data}}',
       '[]'::jsonb),
      ('contrato', 'Contrato de prestação de serviços',
       E'# Contrato de prestação de serviços\n\nContratante: {{paciente.nome}}.\nContratada: {{clinica.nome}}.\n\nObjeto: {{procedimento}}.\n\nValores, forma de pagamento, remarcação e cancelamento seguem o combinado com a clínica e registrado na comanda. O resultado de procedimentos estéticos depende de fatores individuais e não pode ser garantido.\n\nData: {{data}}',
       '[]'::jsonb),
      ('autorizacao', 'Autorização de atendimento de menor de idade',
       E'# Autorização\n\nEu, responsável legal por {{paciente.nome}}, autorizo a {{clinica.nome}} a realizar o atendimento {{procedimento}} e declaro ter recebido as informações sobre ele.\n\nData: {{data}}',
       '[]'::jsonb),
      ('uso_imagem', 'Autorização de uso de imagem',
       E'# Autorização de uso de imagem\n\nEu, {{paciente.nome}}, sei que a {{clinica.nome}} registra fotos para ACOMPANHAR MEU TRATAMENTO no prontuário. Esse uso faz parte da assistência à saúde e não depende desta autorização.\n\nOutros usos só acontecem se eu marcar, uma a uma, as opções abaixo. Nenhuma vem marcada. A autorização é gratuita, vale pelo prazo indicado no documento e posso revogá-la a qualquer momento pelos canais da clínica: depois da revogação, a clínica não faz novas publicações e retira as suas em até 30 dias.\n\nAs fotos são guardadas com segurança e acessadas só por quem cuida do meu tratamento. Dúvidas sobre meus dados: fale com o encarregado de dados da clínica.\n\nData: {{data}}',
       '[{"chave":"ensino_sem_identificacao","rotulo":"Uso em ensino e eventos científicos, SEM me identificar"},
         {"chave":"divulgacao_sem_rosto","rotulo":"Divulgação da clínica SEM mostrar meu rosto, tatuagens ou sinais que me identifiquem"},
         {"chave":"divulgacao_com_identificacao","rotulo":"Divulgação da clínica COM identificação (rosto visível)"},
         {"chave":"redes_sociais","rotulo":"Canal: redes sociais da clínica"},
         {"chave":"site","rotulo":"Canal: site da clínica"},
         {"chave":"material_impresso","rotulo":"Canal: material impresso da clínica"}]'::jsonb)
    ) as t(tipo, nome, conteudo, opcoes)
  loop
    if not exists (select 1 from public.clinic_modelos_documento m where m.organization_id = p_org and lower(m.nome) = lower(v_m.nome)) then
      insert into public.clinic_modelos_documento (organization_id, tipo, nome, padrao)
      values (p_org, v_m.tipo, v_m.nome, true) returning id into v_id;
      insert into public.clinic_modelos_documento_versoes (organization_id, modelo_id, numero, conteudo, opcoes, sha256)
      values (p_org, v_id, 1, v_m.conteudo, v_m.opcoes, public.fn_clinic_sha256(v_m.conteudo));
    end if;
  end loop;
end $$;
revoke execute on function public.fn_clinic_semear_documentos(uuid) from public, anon, authenticated;

create or replace function public.fn_clinic_semear_documentos_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_clinic_semear_documentos(new.id);
  return new;
end $$;
revoke execute on function public.fn_clinic_semear_documentos_trigger() from public, anon, authenticated;
drop trigger if exists trg_clinic_semear_documentos on public.organizations;
create trigger trg_clinic_semear_documentos after insert on public.organizations
  for each row execute function public.fn_clinic_semear_documentos_trigger();

do $$
declare o uuid;
begin
  for o in select id from public.organizations loop
    perform public.fn_clinic_semear_documentos(o);
  end loop;
end $$;
