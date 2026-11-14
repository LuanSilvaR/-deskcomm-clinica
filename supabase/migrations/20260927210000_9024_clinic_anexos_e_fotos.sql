-- ════════════════════════════════════════════════════════════════════════════
-- 9024 · clinic — anexos e fotos clínicas (FORK, prontuário F7)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/prontuario/plano.md (fase F7, "Custo de armazenamento" e
-- "Termo de uso de imagem").
--
-- ARMAZENAMENTO SEM CUSTO NOVO: o bucket `clinical-files` mora no Storage que a
-- instalação já tem (na VPS, disco local — o backup do kit já o inclui). A foto
-- chega COMPRIMIDA pelo navegador (WebP, 1600 px, sem EXIF/GPS) + miniatura de
-- 320 px; a cota por clínica (`settings.clinic.cota_arquivos_mb`, padrão 5 GB)
-- impede o disco de encher sem aviso. Imagem nunca vai para o banco.
--
-- ACESSO: bucket PRIVADO e ZERO policy em `storage.objects` para ele — ninguém
-- lê nem grava direto. Só as rotas, com o service role, depois de conferir a
-- permissão na linha de `clinic_anexos` (RLS): download por URL assinada de
-- 60 s, auditado. Caminho não enumerável: `<org>/<paciente>/<uuid>.<ext>`.
--
-- FINALIDADE: toda foto é CLÍNICA (acompanhar o tratamento — base legal da
-- assistência, não depende de termo). Marcar para DIVULGAÇÃO só é aceito se o
-- paciente autorizou aquela opção no termo de uso de imagem (9023), no prazo e
-- sem revogar; revogou → as fotos marcadas voltam sozinhas a "só clínico".
--
-- RETENÇÃO: anexo clínico não é apagado — `anulado` com motivo (lançado por
-- engano). Prontuário tem guarda legal (CFM 1.821/2007: 20 anos), então a
-- anonimização LGPD do contato NÃO apaga estes arquivos; a decisão fica aqui e
-- no plano. Idempotente.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clinical-files', 'clinical-files', false, 10485760,
        array['image/webp', 'image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.clinic_anexos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id),
  atendimento_id uuid,
  plano_id uuid,
  tipo text not null,
  storage_key text not null,
  miniatura_key text,
  mime text not null,
  bytes integer not null,
  sha256 text not null,
  nome_original text,
  descricao text,
  largura integer,
  altura integer,
  regiao text,
  momento text,
  capturada_em timestamptz,
  divulgacao_opcao text,
  status text not null default 'ativo',
  anulado_motivo text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint clinic_anexos_tipo_check check (tipo in ('foto', 'documento')),
  constraint clinic_anexos_status_check check (status in ('ativo', 'anulado')),
  constraint clinic_anexos_momento_check check (momento is null or momento in ('antes', 'durante', 'depois', 'acompanhamento')),
  constraint clinic_anexos_divulgacao_check
    check (divulgacao_opcao is null or divulgacao_opcao in ('ensino_sem_identificacao', 'divulgacao_sem_rosto', 'divulgacao_com_identificacao')),
  constraint clinic_anexos_mime_check check (mime in ('image/webp', 'image/jpeg', 'image/png', 'application/pdf')),
  constraint clinic_anexos_foto_e_imagem check (tipo <> 'foto' or mime like 'image/%'),
  -- arquivo (até 10 MB) + miniatura (até 512 KB).
  constraint clinic_anexos_bytes_check check (bytes between 1 and 11010048),
  constraint clinic_anexos_sha_formato check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint clinic_anexos_chave_formato check (storage_key ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png|pdf)$'),
  constraint clinic_anexos_tamanhos check (
    coalesce(char_length(nome_original), 0) <= 200 and coalesce(char_length(descricao), 0) <= 500
    and coalesce(char_length(regiao), 0) <= 120 and coalesce(char_length(anulado_motivo), 0) <= 300),
  constraint clinic_anexos_chave_key unique (storage_key),
  constraint clinic_anexos_org_id_key unique (organization_id, id),
  constraint clinic_anexos_do_atendimento foreign key (organization_id, atendimento_id)
    references public.clinic_atendimentos (organization_id, id),
  constraint clinic_anexos_do_plano foreign key (organization_id, plano_id)
    references public.clinic_planos_tratamento (organization_id, id)
);
create index if not exists clinic_anexos_paciente_idx on public.clinic_anexos (organization_id, contact_id, created_at desc);
create index if not exists clinic_anexos_atendimento_idx on public.clinic_anexos (organization_id, atendimento_id) where atendimento_id is not null;
drop trigger if exists clinic_anexos_updated_at on public.clinic_anexos;
create trigger clinic_anexos_updated_at before update on public.clinic_anexos
  for each row execute function public.fn_set_updated_at();

-- O arquivo e seus metadados de origem nunca mudam; só anular (com motivo) e a
-- marcação de divulgação andam. DELETE direto recusado.
create or replace function public.fn_clinic_anexo_imutavel()
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
  if (to_jsonb(new) - array['status', 'anulado_motivo', 'divulgacao_opcao', 'updated_at', 'updated_by', 'regiao', 'descricao', 'momento'])
     is distinct from (to_jsonb(old) - array['status', 'anulado_motivo', 'divulgacao_opcao', 'updated_at', 'updated_by', 'regiao', 'descricao', 'momento'])
     or old.status = 'anulado' then
    raise exception 'prontuario_imutavel' using errcode = '55000';
  end if;
  return new;
end $$;
revoke execute on function public.fn_clinic_anexo_imutavel() from public, anon, authenticated;
drop trigger if exists trg_clinic_anexo_imutavel on public.clinic_anexos;
create trigger trg_clinic_anexo_imutavel before update or delete on public.clinic_anexos
  for each row execute function public.fn_clinic_anexo_imutavel();

alter table public.clinic_anexos enable row level security;
drop policy if exists tenant_isolation_clinic_anexos_all on public.clinic_anexos;
drop policy if exists clinic_anexos_select on public.clinic_anexos;
-- Foto e documento são conteúdo clínico: permissão por tipo, sem atalho de
-- platform admin.
create policy clinic_anexos_select on public.clinic_anexos for select using (
  (organization_id in (select public.fn_user_org_ids()))
  and public.fn_has_permission(organization_id, case when tipo = 'foto' then 'fotos.ver' else 'anexos.ver' end));
revoke all on public.clinic_anexos from anon;
revoke insert, update, delete, truncate on public.clinic_anexos from authenticated;

-- ─── cota ──────────────────────────────────────────────────────────────────
create or replace function public.fn_clinic_cota_arquivos_bytes(p_org uuid)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select ((o.settings -> 'clinic' ->> 'cota_arquivos_mb'))::bigint from public.organizations o
      where o.id = p_org and (o.settings -> 'clinic' ->> 'cota_arquivos_mb') ~ '^[0-9]{1,7}$'),
    5120) * 1048576
$$;
revoke execute on function public.fn_clinic_cota_arquivos_bytes(uuid) from public, anon, authenticated;

create or replace function public.fn_clinic_uso_de_arquivos(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (p_org in (select public.fn_user_org_ids())) then
    raise exception 'acesso_proibido' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'usados', (select coalesce(sum(a.bytes), 0) from public.clinic_anexos a where a.organization_id = p_org),
    'cota', public.fn_clinic_cota_arquivos_bytes(p_org));
end $$;
revoke execute on function public.fn_clinic_uso_de_arquivos(uuid) from public, anon;
grant  execute on function public.fn_clinic_uso_de_arquivos(uuid) to authenticated;

-- ─── registrar (o arquivo já subiu pela rota, com o service role) ──────────
create or replace function public.fn_clinic_anexo_registrar(p_org uuid, p_contact uuid, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tipo text := p_dados ->> 'tipo';
  v_chave text := p_dados ->> 'storage_key';
  v_mini text := nullif(p_dados ->> 'miniatura_key', '');
  v_bytes bigint := coalesce((p_dados ->> 'bytes')::bigint, 0) + coalesce((p_dados ->> 'miniatura_bytes')::bigint, 0);
  v_at uuid := nullif(p_dados ->> 'atendimento_id', '')::uuid;
  v_plano uuid := nullif(p_dados ->> 'plano_id', '')::uuid;
  v_id uuid;
begin
  perform public.fn_acesso_exigir(p_org, case when v_tipo = 'foto' then 'fotos.enviar' else 'anexos.enviar' end);
  if not coalesce((select (o.settings -> 'clinic' -> 'prontuario') = 'true'::jsonb from public.organizations o where o.id = p_org), false) then
    raise exception 'prontuario_desligado' using errcode = '42501';
  end if;
  -- O caminho é da empresa e do paciente informados; nada fora disso entra.
  if v_tipo not in ('foto', 'documento')
     or not exists (select 1 from public.contacts c where c.id = p_contact and c.organization_id = p_org)
     or v_chave is null or split_part(v_chave, '/', 1) <> p_org::text or split_part(v_chave, '/', 2) <> p_contact::text
     or (v_mini is not null and (split_part(v_mini, '/', 1) <> p_org::text or split_part(v_mini, '/', 2) <> p_contact::text))
     or (v_at is not null and not exists (
           select 1 from public.clinic_atendimentos a where a.id = v_at and a.organization_id = p_org and a.contact_id = p_contact))
     or (v_plano is not null and not exists (
           select 1 from public.clinic_planos_tratamento p where p.id = v_plano and p.organization_id = p_org and p.contact_id = p_contact)) then
    raise exception 'anexo_invalido' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('clinic_anexos_cota:' || p_org::text, 0));
  if (select coalesce(sum(a.bytes), 0) from public.clinic_anexos a where a.organization_id = p_org) + v_bytes
     > public.fn_clinic_cota_arquivos_bytes(p_org) then
    raise exception 'anexo_cota_excedida' using errcode = '53400';
  end if;
  insert into public.clinic_anexos
    (organization_id, contact_id, atendimento_id, plano_id, tipo, storage_key, miniatura_key, mime, bytes, sha256, nome_original,
     descricao, largura, altura, regiao, momento, capturada_em, created_by, updated_by)
  values (p_org, p_contact, v_at, v_plano, v_tipo, v_chave, v_mini, p_dados ->> 'mime', v_bytes, p_dados ->> 'sha256',
          left(nullif(btrim(p_dados ->> 'nome_original'), ''), 200), left(nullif(btrim(p_dados ->> 'descricao'), ''), 500),
          nullif(p_dados ->> 'largura', '')::integer, nullif(p_dados ->> 'altura', '')::integer,
          left(nullif(btrim(p_dados ->> 'regiao'), ''), 120), nullif(p_dados ->> 'momento', ''),
          nullif(p_dados ->> 'capturada_em', '')::timestamptz, auth.uid(), auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;
revoke execute on function public.fn_clinic_anexo_registrar(uuid, uuid, jsonb) from public, anon;
grant  execute on function public.fn_clinic_anexo_registrar(uuid, uuid, jsonb) to authenticated;

-- Anular (lançado por engano) ou marcar/desmarcar para divulgação.
create or replace function public.fn_clinic_anexo_mudar(p_org uuid, p_anexo uuid, p_acao text, p_valor text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v record;
begin
  select a.id, a.tipo, a.contact_id, a.status into v
    from public.clinic_anexos a where a.id = p_anexo and a.organization_id = p_org for update;
  if not found then
    raise exception 'anexo_nao_encontrado' using errcode = 'P0002';
  end if;
  perform public.fn_acesso_exigir(p_org, case when v.tipo = 'foto' then 'fotos.enviar' else 'anexos.enviar' end);
  if v.status <> 'ativo' then
    raise exception 'prontuario_imutavel' using errcode = '55000';
  end if;
  if p_acao = 'anular' then
    if char_length(btrim(coalesce(p_valor, ''))) < 3 then
      raise exception 'anexo_sem_motivo' using errcode = '22023';
    end if;
    update public.clinic_anexos
       set status = 'anulado', anulado_motivo = left(btrim(p_valor), 300), divulgacao_opcao = null, updated_by = auth.uid()
     where id = p_anexo;
  elsif p_acao = 'divulgacao' then
    if p_valor is not null and (v.tipo <> 'foto' or not public.fn_clinic_uso_de_imagem_autorizado(p_org, v.contact_id, p_valor)) then
      raise exception 'anexo_sem_autorizacao_de_imagem' using errcode = '42501';
    end if;
    update public.clinic_anexos set divulgacao_opcao = p_valor, updated_by = auth.uid() where id = p_anexo;
  else
    raise exception 'anexo_invalido' using errcode = '22023';
  end if;
end $$;
revoke execute on function public.fn_clinic_anexo_mudar(uuid, uuid, text, text) from public, anon;
grant  execute on function public.fn_clinic_anexo_mudar(uuid, uuid, text, text) to authenticated;

-- Revogou (ou venceu) a autorização de uso de imagem: fotos marcadas para
-- divulgação voltam a "só clínico" na mesma transação. Sem HTTP.
create or replace function public.fn_clinic_revogacao_desmarca_fotos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo = 'uso_imagem' and new.status = 'revogado' and old.status <> 'revogado' then
    update public.clinic_anexos a
       set divulgacao_opcao = null, updated_by = auth.uid()
     where a.organization_id = new.organization_id and a.contact_id = new.contact_id and a.status = 'ativo'
       and a.divulgacao_opcao is not null
       and not public.fn_clinic_uso_de_imagem_autorizado(new.organization_id, new.contact_id, a.divulgacao_opcao);
  end if;
  return new;
end $$;
revoke execute on function public.fn_clinic_revogacao_desmarca_fotos() from public, anon, authenticated;
drop trigger if exists trg_clinic_revogacao_desmarca_fotos on public.clinic_documentos_emitidos;
create trigger trg_clinic_revogacao_desmarca_fotos after update of status on public.clinic_documentos_emitidos
  for each row execute function public.fn_clinic_revogacao_desmarca_fotos();
