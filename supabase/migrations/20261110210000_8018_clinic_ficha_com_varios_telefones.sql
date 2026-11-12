-- manifest: **A ficha guarda vários telefones, e juntar duas fichas não perde mais o segundo número (Spec 31, parte B1).** Tabela tenant-aware nova `contact_phones` (telefones extras, na forma canônica, com tipo `fixo|celular|outro`, WhatsApp `sim|nao|nao_sei`, rótulo, origem e o `lid` do WhatsApp daquele número), RLS (leitura por organização, escrita a partir de `agent`) e grants próprios; `contacts` ganha `phone_type` e `phone_whatsapp` (anuláveis), preenchidos por gatilho na gravação nova e, nas fichas que já existem, por um preenchimento que não mexe em `updated_at` (`WhatsApp = sim` quando a ficha tem mensagem RECEBIDA em canal WAHA ou `meta_cloud`). Funções puras `fn_telefone_canonico` (a regra de `canonicalPhoneBR`) e `fn_tipo_do_telefone`. **Um número, uma ficha viva:** dois gatilhos (`contacts` e `contact_phones`) com trava consultiva por organização e pela forma canônica recusam com 23505 o extra que repete o principal ou o extra de outra ficha viva (e o principal que repete um extra) — também na grafia sem o nono dígito; o par "gêmeo" entre dois principais segue aceito como hoje (a fusão por nono dígito e as importações nascem dele; ele aparece em Duplicados pelo motivo `telefone`). `fn_upsert_wa_contact` procura também nos extras (`lid` → principal → extra) e, achada pelo extra, não sobrescreve o `waha_lid`/`waha_chat_id` do principal: o `lid` de quem escreveu fica com o extra. `fn_mesclar_contatos`: o principal de cada absorvida vira extra da ficha que fica (com tipo, WhatsApp e `lid`), o extra repetido sai antes do repontamento (não entra em `nao_repontado`) e `custom_fields` passa a ser herdado sem sobrescrever a ficha que fica. LGPD: a cascata apaga os extras e as variantes deles entram na supressão da prospecção. **Fork clinic (#85):** absorção da 9043 do upstream (#3671) renumerada; as três funções reescritas (`fn_upsert_wa_contact`, `fn_mesclar_contatos`, `fn_lgpd_cascade_redact_contact`) partem da ÚLTIMA definição do FORK (inclusive a 8001) com só o delta da 9043 por cima — sem o `contact.phone_added` (#3315) e sem a `social_identity`, que o fork não tem; `fn_redigir_conversas_ao_anonimizar` (8002) não muda, porque o fork não tem o braço das mensagens de grupo; assinaturas, `search_path` e grants inalterados. Espelho no apêndice do `supabase/baseline.sql`, antes da VARREDURA anon (cria função) e antes da chamada final das travas de suporte (cria tabela). Prova em `tests/invariants/ficha-com-varios-telefones.test.ts`. A tela de editar extras é da opção `settings.clinic.varios_telefones` (8019).
--
-- Por que o "um número, uma ficha" mora no banco e não no código: são mais de
-- dez escritores de telefone (rotas, ingestões WAHA/Meta/Zernio, importações,
-- prospecção, agenda do celular, fusão). Uma regra no código seria esquecida no
-- próximo, e o defeito é mudo: nasce a segunda ficha e ninguém vê.
--
-- Idempotente: `create ... if not exists`, `drop constraint if exists` + `add`,
-- `create or replace`, `drop trigger if exists` + `create`, e o preenchimento só
-- toca ficha com telefone e tipo ainda vazio. Sem id de tenant.

-- ── 1. As duas leituras do número, no banco ────────────────────────────────
-- A forma canônica é a de `canonicalPhoneBR` (`lib/channels/phone-variants.ts`):
-- celular BR de 12 dígitos (local 6–9) ganha o nono; o resto fica como está,
-- só com os dígitos e o `+`. É a chave de "um número, uma ficha": comparar o
-- texto cru deixaria passar o mesmo número com e sem o nono dígito.
-- Sem depender de outra função e com `search_path` vazio: entra num índice, e
-- índice reconstruído por `pg_restore` não enxerga o `search_path` de ninguém.
create or replace function public.fn_telefone_canonico(p_telefone text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when s.d = '' then null
    when s.d ~ '^55[1-9][0-9][6-9][0-9]{7}$'
      then '+55' || substr(s.d, 3, 2) || '9' || substr(s.d, 5)
    else '+' || s.d
  end
  from (select pg_catalog.regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g') as d) as s;
$$;

-- O tipo que o número sugere. Só `+55` com 12 ou 13 dígitos tem regra; fora
-- disso é `outro` (estrangeiro, ramal, número incompleto). A grafia antiga de
-- celular (12 dígitos, local 6–9) é celular — a mesma leitura do
-- `fn_upsert_wa_contact`. É sugestão: a pessoa corrige na ficha.
create or replace function public.fn_tipo_do_telefone(p_telefone text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when s.d ~ '^55[1-9][0-9]9[0-9]{8}$' then 'celular'
    when s.d ~ '^55[1-9][0-9][6-9][0-9]{7}$' then 'celular'
    when s.d ~ '^55[1-9][0-9][2-5][0-9]{7}$' then 'fixo'
    else 'outro'
  end
  from (select pg_catalog.regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g') as d) as s;
$$;

revoke execute on function public.fn_telefone_canonico(text) from public, anon;
grant execute on function public.fn_telefone_canonico(text) to authenticated, service_role;
revoke execute on function public.fn_tipo_do_telefone(text) from public, anon;
grant execute on function public.fn_tipo_do_telefone(text) to authenticated, service_role;

-- ── 2. O principal ganha tipo e WhatsApp ────────────────────────────────────
-- Anuláveis: ficha sem telefone não tem tipo. `whatsapp` é separado do tipo
-- porque celular nem sempre tem WhatsApp e há fixo com WhatsApp Business.
alter table public.contacts add column if not exists phone_type text;
alter table public.contacts add column if not exists phone_whatsapp text;

alter table public.contacts drop constraint if exists contacts_phone_type_check;
alter table public.contacts add constraint contacts_phone_type_check
  check (phone_type is null or phone_type in ('fixo', 'celular', 'outro'));
alter table public.contacts drop constraint if exists contacts_phone_whatsapp_check;
alter table public.contacts add constraint contacts_phone_whatsapp_check
  check (phone_whatsapp is null or phone_whatsapp in ('sim', 'nao', 'nao_sei'));

-- ── 3. Os telefones extras ─────────────────────────────────────────────────
-- O principal continua em `contacts.phone_number` (todo leitor de hoje segue
-- igual). O extra mora aqui, já na forma canônica, com o `lid` do WhatsApp
-- daquele número quando houver: é ele que faz a mensagem pelo segundo número
-- cair na mesma ficha (Spec 31 §B3) sem sobrescrever o `wa_lid` do principal.
create table if not exists public.contact_phones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  phone_number text not null,
  tipo text not null,
  whatsapp text not null default 'nao_sei',
  rotulo text,
  origem text not null default 'manual',
  wa_lid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contact_phones drop constraint if exists contact_phones_tipo_check;
alter table public.contact_phones add constraint contact_phones_tipo_check
  check (tipo in ('fixo', 'celular', 'outro'));
alter table public.contact_phones drop constraint if exists contact_phones_whatsapp_check;
alter table public.contact_phones add constraint contact_phones_whatsapp_check
  check (whatsapp in ('sim', 'nao', 'nao_sei'));
alter table public.contact_phones drop constraint if exists contact_phones_origem_check;
alter table public.contact_phones add constraint contact_phones_origem_check
  check (origem in ('manual', 'fusao', 'importacao', 'prospeccao', 'whatsapp'));
alter table public.contact_phones drop constraint if exists contact_phones_rotulo_check;
alter table public.contact_phones add constraint contact_phones_rotulo_check
  check (rotulo is null or char_length(rotulo) between 1 and 60);
alter table public.contact_phones drop constraint if exists contact_phones_numero_canonico_check;
alter table public.contact_phones add constraint contact_phones_numero_canonico_check
  check (phone_number = public.fn_telefone_canonico(phone_number));

-- Um extra pertence a no máximo uma ficha da organização. Sem `where`: o extra
-- da lápide é apagado ou repontado pela fusão, e o do anonimizado é apagado,
-- então toda linha daqui é de ficha viva.
create unique index if not exists uniq_contact_phones_org_numero
  on public.contact_phones (organization_id, phone_number);
create unique index if not exists uniq_contact_phones_org_lid
  on public.contact_phones (organization_id, wa_lid) where wa_lid is not null;
create index if not exists idx_contact_phones_contato
  on public.contact_phones (organization_id, contact_id);

-- A busca do principal pela forma canônica (a regra "um número, uma ficha"
-- pergunta por ela a cada gravação).
create index if not exists idx_contacts_org_telefone_canonico
  on public.contacts (organization_id, public.fn_telefone_canonico(phone_number))
  where phone_number is not null and is_merged_into is null;

alter table public.contact_phones enable row level security;

-- Leitura para todo membro da organização; escrita a partir de `agent`, o mesmo
-- piso do PATCH de contato (`requireRole("agent")`). Policy `for all` só de
-- tenancy é a dívida que a 0150 congelou: um `viewer` falando direto com o
-- PostgREST apagaria o telefone de uma ficha.
drop policy if exists tenant_isolation_contact_phones_all on public.contact_phones;
drop policy if exists tenant_isolation_contact_phones_read on public.contact_phones;
create policy tenant_isolation_contact_phones_read on public.contact_phones
  for select
  using (organization_id in (select public.fn_user_org_ids()));
drop policy if exists tenant_isolation_contact_phones_write on public.contact_phones;
create policy tenant_isolation_contact_phones_write on public.contact_phones
  for all
  using (organization_id in (select public.fn_user_org_ids())
         and public.fn_role_at_least(organization_id, 'agent'))
  with check (organization_id in (select public.fn_user_org_ids())
              and public.fn_role_at_least(organization_id, 'agent'));

do $grants_contact_phones$
begin
  revoke all on table public.contact_phones from anon, authenticated, service_role;
  grant select, insert, update, delete on table public.contact_phones to authenticated, service_role;
end
$grants_contact_phones$;

-- ── 4. Um número, uma ficha viva ───────────────────────────────────────────
-- Entre as fichas VIVAS da organização, um número (pela forma canônica) é o
-- principal OU um extra de uma ficha só; o mesmo para o `lid`. Fica no banco
-- porque os escritores de telefone são muitos (rotas, ingestões, importações,
-- prospecção, fusão) e uma regra no código seria esquecida no próximo. A trava
-- consultiva é por organização E pela forma canônica: duas gravações ao mesmo
-- tempo, uma com e outra sem o nono dígito, caem na mesma trava, e a segunda
-- relê depois que a primeira terminou (cada comando do plpgsql tira foto nova).
-- A recusa é 23505, o mesmo código de `uniq_contacts_org_phone`, que as rotas
-- e a ingestão já tratam.
create or replace function public.fn_contact_phones_um_numero_uma_ficha()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dono record;
begin
  new.phone_number := public.fn_telefone_canonico(new.phone_number);
  new.wa_lid := nullif(pg_catalog.regexp_replace(coalesce(new.wa_lid, ''), '@.*$', ''), '');
  if new.phone_number is null then
    raise exception using errcode = '23502', message = 'telefone_extra_vazio';
  end if;

  -- A ficha é da MESMA organização e está viva. Sem isto, uma linha com o
  -- `organization_id` de A e o contato de B passaria pela RLS de A.
  select c.organization_id, c.is_merged_into, c.is_anonymized into v_dono
    from public.contacts c where c.id = new.contact_id;
  if not found or v_dono.organization_id <> new.organization_id then
    raise exception using errcode = '23503', message = 'telefone_extra_de_outra_organizacao';
  end if;
  if v_dono.is_merged_into is not null or v_dono.is_anonymized then
    raise exception using errcode = 'P0002', message = 'telefone_extra_de_ficha_indisponivel';
  end if;

  if tg_op = 'INSERT' then
    new.created_at := now();
    -- Sem tipo, o banco sugere pelo número (a mesma regra do principal).
    new.tipo := coalesce(new.tipo, public.fn_tipo_do_telefone(new.phone_number));
  elsif new.phone_number is distinct from old.phone_number then
    -- O número mudou: tipo e WhatsApp voltam a ser os do número novo, salvo se
    -- quem gravou mandou os dois junto.
    if new.tipo is not distinct from old.tipo then
      new.tipo := public.fn_tipo_do_telefone(new.phone_number);
    end if;
    if new.whatsapp is not distinct from old.whatsapp then
      new.whatsapp := 'nao_sei';
    end if;
  end if;
  new.updated_at := now();

  if tg_op = 'INSERT' or new.phone_number is distinct from old.phone_number
     or new.contact_id is distinct from old.contact_id then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'telefone:' || new.organization_id::text || ':' || new.phone_number, 0));
    -- O principal de QUALQUER ficha viva, inclusive a dona deste extra (o mesmo
    -- número duas vezes na ficha não é um segundo telefone).
    if exists (
      select 1 from public.contacts c
       where c.organization_id = new.organization_id
         and c.is_merged_into is null
         and c.phone_number is not null
         and public.fn_telefone_canonico(c.phone_number) = new.phone_number
    ) then
      raise exception using errcode = '23505', message = 'telefone_de_outra_ficha';
    end if;
  end if;

  if new.wa_lid is not null
     and (tg_op = 'INSERT' or new.wa_lid is distinct from old.wa_lid
          or new.contact_id is distinct from old.contact_id) then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'lid:' || new.organization_id::text || ':' || new.wa_lid, 0));
    if exists (
      select 1 from public.contacts c
       where c.organization_id = new.organization_id
         and c.is_merged_into is null
         and c.wa_lid = new.wa_lid
    ) then
      raise exception using errcode = '23505', message = 'lid_de_outra_ficha';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.fn_contact_phones_um_numero_uma_ficha() from public;
revoke execute on function public.fn_contact_phones_um_numero_uma_ficha() from anon, authenticated;

drop trigger if exists trg_contact_phones_um_numero_uma_ficha on public.contact_phones;
create trigger trg_contact_phones_um_numero_uma_ficha
  before insert or update on public.contact_phones
  for each row execute function public.fn_contact_phones_um_numero_uma_ficha();

-- O lado do principal. Tipo e WhatsApp: na gravação nova o banco sugere; quando
-- o número MUDA, os dois voltam a ser os do número novo, salvo se quem gravou os
-- mandou junto. A regra "um número, uma ficha" só olha quando a forma canônica
-- muda (a promoção da grafia de 12 para 13 dígitos do MESMO número, que o
-- `fn_upsert_wa_contact` faz, não é número novo) e compara com os EXTRAS de
-- qualquer ficha: o par "gêmeo" entre dois principais segue como hoje.
create or replace function public.fn_contacts_um_numero_uma_ficha()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_canon text := public.fn_telefone_canonico(new.phone_number);
  v_canon_antes text;
  v_lid text := nullif(pg_catalog.regexp_replace(coalesce(new.source_metadata->>'waha_lid', ''), '@.*$', ''), '');
  v_lid_antes text;
begin
  if tg_op = 'UPDATE' then
    v_canon_antes := public.fn_telefone_canonico(old.phone_number);
    v_lid_antes := nullif(pg_catalog.regexp_replace(coalesce(old.source_metadata->>'waha_lid', ''), '@.*$', ''), '');
  end if;

  if new.phone_number is null then
    new.phone_type := null;
    new.phone_whatsapp := null;
  elsif tg_op = 'UPDATE' and v_canon is distinct from v_canon_antes then
    if new.phone_type is not distinct from old.phone_type then
      new.phone_type := public.fn_tipo_do_telefone(new.phone_number);
    end if;
    if new.phone_whatsapp is not distinct from old.phone_whatsapp then
      new.phone_whatsapp := 'nao_sei';
    end if;
  else
    new.phone_type := coalesce(new.phone_type, public.fn_tipo_do_telefone(new.phone_number));
    new.phone_whatsapp := coalesce(new.phone_whatsapp, 'nao_sei');
  end if;

  if new.is_merged_into is not null or new.is_anonymized then
    return new;
  end if;

  if v_canon is not null and (tg_op = 'INSERT' or v_canon is distinct from v_canon_antes) then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'telefone:' || new.organization_id::text || ':' || v_canon, 0));
    -- Só contra os EXTRAS. Principal × principal em grafias diferentes (o par
    -- "gêmeo") continua aceito: a fusão por nono dígito, as importações e os
    -- testes do update.sh nascem justamente desse par, e quem o resolve é a tela
    -- Duplicados (motivo `telefone`). Recusá-lo aqui quebraria esses caminhos sem
    -- impedir duplicata nova nenhuma que `uniq_contacts_org_phone` já não impeça.
    if exists (
      select 1 from public.contact_phones t
       where t.organization_id = new.organization_id and t.phone_number = v_canon
    ) then
      raise exception using errcode = '23505', message = 'telefone_de_outra_ficha';
    end if;
  end if;

  if v_lid is not null and (tg_op = 'INSERT' or v_lid is distinct from v_lid_antes) then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'lid:' || new.organization_id::text || ':' || v_lid, 0));
    if exists (
      select 1 from public.contact_phones t
       where t.organization_id = new.organization_id and t.wa_lid = v_lid
    ) then
      raise exception using errcode = '23505', message = 'lid_de_outra_ficha';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.fn_contacts_um_numero_uma_ficha() from public;
revoke execute on function public.fn_contacts_um_numero_uma_ficha() from anon, authenticated;

-- ── 5. O preenchimento das fichas que já existem ───────────────────────────
-- Antes do gatilho do principal, e num bloco só: o gatilho de `updated_at` fica
-- desligado SÓ durante este `update` (a ordem das listas de contatos sai de
-- `updated_at`, e um preenchimento não é uma mudança da ficha). O `do` é uma
-- transação: se o `update.sh` morrer no meio, o gatilho não fica desligado.
-- `WhatsApp = sim` quando a ficha tem ao menos uma mensagem RECEBIDA numa
-- conversa de canal WhatsApp (WAHA ou a API oficial da Meta). Reaplicar não
-- mexe em nada: só toca ficha com telefone e tipo ainda vazio.
do $preencher_tipo$
begin
  alter table public.contacts disable trigger trg_contacts_updated_at;
  update public.contacts c set
    phone_type = public.fn_tipo_do_telefone(c.phone_number),
    phone_whatsapp = case when exists (
      select 1
        from public.messages m
        join public.channel_sessions s on s.id = m.channel_session_id and s.organization_id = m.organization_id
       where m.organization_id = c.organization_id
         and m.contact_id = c.id
         and m.direction = 'inbound'
         and s.provider in ('waha', 'meta_cloud')
    ) then 'sim' else 'nao_sei' end
  where c.phone_number is not null and c.phone_type is null;
  alter table public.contacts enable trigger trg_contacts_updated_at;
end
$preencher_tipo$;

drop trigger if exists trg_contacts_um_numero_uma_ficha on public.contacts;
create trigger trg_contacts_um_numero_uma_ficha
  before insert or update of phone_number, phone_type, phone_whatsapp, source_metadata, is_merged_into, is_anonymized
  on public.contacts
  for each row execute function public.fn_contacts_um_numero_uma_ficha();

-- ── 6. A mensagem que chega procura também nos extras ──────────────────────
-- Ordem: `lid` (o da ficha e o dos extras) → principal → extra, com as
-- variantes do nono dígito. Achada PELO EXTRA, a ficha não muda de principal:
-- o `waha_lid`/`waha_chat_id` do principal ficam como estão (o envio usa o
-- `wa_lid` antes do telefone, e sobrescrevê-lo mandaria a próxima resposta ao
-- número errado), e o `lid` de quem escreveu fica guardado com o extra. A
-- verificação de conflito passa a olhar também os extras das outras fichas.
-- Achar pelo número também prova que ele tem WhatsApp: `WhatsApp = sim`.
-- O resto é a última definição do FORK, linha a linha (sem o
-- `contact.phone_added` do #3315, que o fork não tem).
create or replace function public.fn_upsert_wa_contact(
  p_org uuid, p_kind text, p_phone text, p_lid text, p_chat_id text, p_notify text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_extra uuid;
  v_conflito text;
  v_lid text := nullif(regexp_replace(coalesce(p_lid, ''), '@.*$', ''), '');
  v_phone text := nullif(p_phone, '');
  v_canon text;
  v_digits text;
  v_alt text;
begin
  -- Celular BR de 12 dígitos (local 6–9) ganha o nono. A grafia sem o 9 fica
  -- em v_alt só para a BUSCA — não se escreve mais.
  if v_phone is not null then
    v_digits := regexp_replace(v_phone, '\D', '', 'g');
    if v_digits ~ '^55[1-9][0-9][6-9][0-9]{7}$' then
      v_alt := '+' || v_digits;
      v_phone := '+55' || substring(v_digits from 3 for 2) || '9' || substring(v_digits from 5);
    elsif v_digits ~ '^55[1-9][0-9]9[6-9][0-9]{7}$' then
      v_phone := '+' || v_digits;
      v_alt := '+55' || substring(v_digits from 3 for 2) || substring(v_digits from 6);
    end if;
    v_canon := public.fn_telefone_canonico(v_phone);
  end if;

  if v_lid is not null then
    select id into v_id from public.contacts
     where organization_id = p_org and wa_lid = v_lid and is_merged_into is null
     limit 1;
    if v_id is null then
      select t.contact_id, t.id into v_id, v_extra
        from public.contact_phones t
        join public.contacts c on c.id = t.contact_id and c.organization_id = t.organization_id
       where t.organization_id = p_org and t.wa_lid = v_lid and c.is_merged_into is null
       limit 1;
    end if;
  end if;

  if v_id is null and v_phone is not null then
    select id into v_id from public.contacts
     where organization_id = p_org and is_merged_into is null
       and phone_number in (v_phone, v_alt)
     order by case when phone_number = v_phone then 0 else 1 end
     limit 1;
  end if;

  if v_id is null and v_canon is not null then
    select t.contact_id, t.id into v_id, v_extra
      from public.contact_phones t
      join public.contacts c on c.id = t.contact_id and c.organization_id = t.organization_id
     where t.organization_id = p_org and t.phone_number = v_canon and c.is_merged_into is null
     limit 1;
  end if;

  -- Achada pelo `lid` do principal, com um número que já é extra DESTA ficha:
  -- é o extra falando, não um principal novo.
  if v_id is not null and v_extra is null and v_canon is not null then
    select t.id into v_extra from public.contact_phones t
     where t.organization_id = p_org and t.contact_id = v_id and t.phone_number = v_canon;
  end if;

  if v_extra is not null then
    -- O `lid` de quem escreveu fica com o extra, se ainda não é de ninguém.
    update public.contact_phones t set
      wa_lid = case
        when t.wa_lid is null and v_lid is not null
         and not exists (select 1 from public.contacts c
                          where c.organization_id = p_org and c.is_merged_into is null and c.wa_lid = v_lid)
         and not exists (select 1 from public.contact_phones o
                          where o.organization_id = p_org and o.wa_lid = v_lid)
        then v_lid else t.wa_lid end,
      whatsapp = case when v_canon is not null and t.phone_number = v_canon then 'sim' else t.whatsapp end
     where t.id = v_extra and t.organization_id = p_org;

    update public.contacts set
      display_name = coalesce(display_name, nullif(p_notify, '')),
      updated_at = now()
    where id = v_id and organization_id = p_org;
    return v_id;
  end if;

  if v_id is not null and v_phone is not null and (
    exists (
      select 1 from public.contacts
       where organization_id = p_org and phone_number = v_phone
         and is_merged_into is null and id <> v_id
    ) or exists (
      select 1 from public.contact_phones t
       where t.organization_id = p_org and t.phone_number = v_canon and t.contact_id <> v_id
    )
  ) then
    v_conflito := v_phone;
    v_phone := null;
  end if;

  if v_id is not null then
    update public.contacts set
      -- Promove 12→13 quando é a MESMA pessoa e o canônico está livre.
      -- Outro número (pessoa diferente) continua intocável.
      phone_number = case
        when v_phone is not null and (phone_number is null or phone_number = v_alt) then v_phone
        else phone_number
      end,
      phone_whatsapp = case
        when v_phone is not null and (phone_number is null or phone_number in (v_phone, v_alt)) then 'sim'
        else phone_whatsapp
      end,
      display_name = coalesce(display_name, nullif(p_notify, '')),
      source_metadata = source_metadata
        || case when v_lid is not null then jsonb_build_object('waha_lid', v_lid) else '{}'::jsonb end
        || case when p_chat_id is not null then jsonb_build_object('waha_chat_id', p_chat_id) else '{}'::jsonb end
        || case when nullif(p_notify, '') is not null then jsonb_build_object('notify_name', p_notify) else '{}'::jsonb end
        || case when v_conflito is not null then jsonb_build_object('telefone_em_conflito', v_conflito) else '{}'::jsonb end,
      updated_at = now()
    where id = v_id;
    return v_id;
  end if;

  begin
    insert into public.contacts (organization_id, phone_number, phone_whatsapp, source, consent, tags, source_metadata, display_name)
    values (p_org, v_phone, case when v_phone is not null then 'sim' end, 'whatsapp', '{}'::jsonb, '{}'::text[],
      case when v_lid is not null
        then jsonb_build_object('waha_lid', v_lid, 'waha_chat_id', p_chat_id, 'notify_name', nullif(p_notify, ''))
        else jsonb_build_object('waha_chat_id', p_chat_id, 'notify_name', nullif(p_notify, '')) end,
      nullif(p_notify, ''))
    returning id into v_id;
    return v_id;
  exception when unique_violation then
    -- A corrida perdida: quem ganhou pode ter gravado o número como principal
    -- OU como extra (a regra "um número, uma ficha" também levanta 23505).
    select id into v_id from public.contacts
     where organization_id = p_org and is_merged_into is null
       and (
         (v_phone is not null and phone_number = v_phone)
         or (v_alt is not null and phone_number = v_alt)
         or (v_lid is not null and wa_lid = v_lid)
       )
     order by case when phone_number = v_phone then 0 else 1 end
     limit 1;
    if v_id is null then
      select t.contact_id into v_id
        from public.contact_phones t
        join public.contacts c on c.id = t.contact_id and c.organization_id = t.organization_id
       where t.organization_id = p_org and c.is_merged_into is null
         and ((v_canon is not null and t.phone_number = v_canon)
              or (v_lid is not null and t.wa_lid = v_lid))
       limit 1;
    end if;
    return v_id;
  end;
end; $$;

-- ── 7. A fusão guarda os números e os campos ──────────────────────────────
-- A ÚLTIMA definição do FORK, com os passos 4b e 6b e a herança de
-- `custom_fields` marcados com (9043). Nada mais muda.
CREATE OR REPLACE FUNCTION public.fn_mesclar_contatos(p_organization_id uuid, p_contato_principal uuid, p_contatos_secundarios uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_principal public.contacts%rowtype;
  v_esperado integer;
  v_achado integer;
  v_alvo record;
  v_linha record;
  v_movidas integer;
  v_pulados integer;
  v_repontado jsonb := '{}'::jsonb;
  v_nao_repontado jsonb := '{}'::jsonb;
  v_nome text;
  v_apelido text;
  v_nascimento date;
  v_email text;
  v_telefone text;
  v_lid text;
  v_tags text[];
  v_leads integer := 0;
  v_service_contact uuid;
  v_campos jsonb;
  v_sec record;
  v_canon text;
  v_lid_extra text;
begin
  if not public.fn_support_write_allowed(p_organization_id) then raise exception 'support_readonly' using errcode='42501'; end if;
  -- 1 · Autorização. Fundir é destrutivo na prática: `manager`, o mesmo piso das
  --     policies de `merge_queue`. Sessão de service role (auth.uid() nulo) não
  --     passa por aqui — quem resolve a org nesse caminho é a rota, de fonte
  --     confiável, nunca do body.
  if auth.uid() is not null
     and not public.fn_role_at_least(p_organization_id, 'manager') then
    raise exception using errcode = '42501', message = 'insufficient_role';
  end if;

  if p_contato_principal is null
     or p_contatos_secundarios is null
     or cardinality(p_contatos_secundarios) = 0
     or p_contato_principal = any(p_contatos_secundarios) then
    raise exception using errcode = '22023', message = 'selecao_de_mesclagem_invalida';
  end if;

  select count(distinct id)::integer into v_esperado
    from unnest(p_contatos_secundarios) as ids(id);
  if v_esperado <> cardinality(p_contatos_secundarios) then
    raise exception using errcode = '22023', message = 'secundario_repetido';
  end if;

  -- A TRAVA DA REGRA "CLIENTES PELA AGENDA" (migration 0262), ANTES DE TODA
  -- OUTRA. O passo 5 reponta `calendar_appointments.contact_id`, e o trigger
  -- desse repontamento pede `pg_advisory_xact_lock_shared(org, 262)` — só que
  -- a esta altura a fusão já segura os contatos (passos 2 e 3).
  -- `fn_definir_cliente_pela_agenda` pega a mesma trava EXCLUSIVA e depois
  -- trava contato por contato. Medido com duas sessões, sem esta linha: a fusão
  -- morria em `deadlock detected` e a rota devolvia 500. Aqui a ordem fica a
  -- mesma das duas funções — a organização primeiro, os contatos depois. Duas
  -- fusões, ou uma fusão e uma marcação, pegam a versão compartilhada e não se
  -- esperam.
  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended(p_organization_id::text, 262));

  -- Mesmo mutex dos atendimentos, ANTES de qualquer row lock.
  for v_service_contact in select distinct id from unnest(array[p_contato_principal]||p_contatos_secundarios) ids(id) order by id loop
    perform public.fn_service_lock(p_organization_id,v_service_contact);
  end loop;
  perform 1 from public.conversations where organization_id=p_organization_id
    and contact_id=any(array[p_contato_principal]||p_contatos_secundarios) order by id for no key update;

  -- Conversa colidente NÃO aborta a fusão. Duas conversas no mesmo
  -- `channel_session_id` é exatamente COMO a duplicata de WhatsApp nasce (dois
  -- cadastros, dois números, o mesmo número de atendimento), então recusar aqui
  -- fecharia o caminho dominante do recurso — medido: o caso ordinário do
  -- `tests/e2e/juntar-contatos-duplicados.spec.ts` virava 409.
  -- Quem trata a colisão é o passo 5: `uniq_conversations_1to1_per_contact_session`
  -- levanta unique_violation, o repontamento cai para linha a linha, a conversa
  -- que não coube FICA na lápide e sai contada em `nao_repontado` — que a rota
  -- devolve e a tela anuncia ("N registro(s) continuaram no cadastro antigo").
  -- Mensagem não se perde: `messages.contact_id` não tem índice único por
  -- contato e passa inteira para o vencedor.

  -- 2 · O principal existe, é desta org, está vivo — e trava até o fim.
  select * into v_principal from public.contacts
   where id = p_contato_principal
     and organization_id = p_organization_id
     and is_merged_into is null
     and is_anonymized = false
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'contato_principal_indisponivel';
  end if;

  -- 3 · Os secundários também. `is_anonymized = false` não é zelo: L-04 é
  --     irreversível, e reencaixar a linha anonimizada num contato ativo a
  --     traria de volta ao atendimento pela porta dos fundos.
  perform 1 from public.contacts
   where id = any(p_contatos_secundarios)
     and organization_id = p_organization_id
     and is_merged_into is null
     and is_anonymized = false
   for update;
  get diagnostics v_achado = row_count;
  if v_achado <> v_esperado then
    raise exception using errcode = 'P0002', message = 'contato_secundario_indisponivel';
  end if;

  -- 4 · A LÁPIDE VEM ANTES de tudo. É ela que solta telefone/e-mail/CPF dos
  --     índices únicos parciais para o vencedor poder herdá-los no passo 6.
  update public.contacts
     set is_merged_into = p_contato_principal,
         merged_at = now(),
         updated_at = now()
   where organization_id = p_organization_id
     and id = any(p_contatos_secundarios);

  -- Cadeia: quem já tinha sido mesclado NUM dos secundários passa a apontar para
  -- o vencedor. Sem isto, `is_merged_into` vira uma corrente que a leitura teria
  -- de percorrer, e ninguém percorre.
  update public.contacts
     set is_merged_into = p_contato_principal
   where organization_id = p_organization_id
     and is_merged_into = any(p_contatos_secundarios);

  -- 4b · (9043) Os telefones extras das absorvidas que repetem o número ou o
  --     `lid` da ficha que fica saem ANTES do repontamento: o repetido não é
  --     registro perdido, é o mesmo número, e não pode cair no
  --     `unique_violation` do laço nem ser contado em `nao_repontado`. Os
  --     demais seguem para a ficha que fica pelo repontamento do catálogo.
  delete from public.contact_phones t
   where t.organization_id = p_organization_id
     and t.contact_id = any(p_contatos_secundarios)
     and (
       t.phone_number = public.fn_telefone_canonico(v_principal.phone_number)
       or (t.wa_lid is not null and t.wa_lid = v_principal.wa_lid)
     );

  -- 5 · Reponta TODO ponteiro para os perdedores. A lista sai do catálogo; o
  --     polimórfico entra à mão porque catálogo nenhum o conhece.
  for v_alvo in
    select n.nspname as esquema, c.relname as tabela, a.attname as coluna, ''::text as filtro
      from pg_catalog.pg_constraint co
      join pg_catalog.pg_class c on c.oid = co.conrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      join pg_catalog.pg_attribute a on a.attrelid = co.conrelid and a.attnum = co.conkey[1]
     where co.contype = 'f'
       and co.confrelid = 'public.contacts'::regclass
       and co.conrelid <> 'public.contacts'::regclass
       and array_length(co.conkey, 1) = 1
       and c.relkind = 'r'
       and n.nspname = 'public'
    union all
    select 'public', 'crm_lead_links', 'target_id', ' and target_kind = ''contact'''
     where to_regclass('public.crm_lead_links') is not null
    order by 2, 3
  loop
    v_pulados := 0;
    begin
      execute format(
        'update %I.%I set %I = $1 where %I = any($2)%s',
        v_alvo.esquema, v_alvo.tabela, v_alvo.coluna, v_alvo.coluna, v_alvo.filtro
      ) using p_contato_principal, p_contatos_secundarios;
      get diagnostics v_movidas = row_count;
    exception when unique_violation or exclusion_violation then
      -- Colisão REAL e esperada: `uniq_job_queue_one_running_per_contact` deixa
      -- um job 'running' por contato, e os dois lados podem ter um. Em vez de
      -- abortar a fusão inteira por causa de estado efêmero de runtime, reponta
      -- linha a linha e conta quem ficou. Quem fica NÃO vira FK órfã — continua
      -- apontando para a lápide, que existe.
      v_movidas := 0;
      for v_linha in execute format(
        'select ctid as tid from %I.%I where %I = any($1)%s',
        v_alvo.esquema, v_alvo.tabela, v_alvo.coluna, v_alvo.filtro
      ) using p_contatos_secundarios
      loop
        begin
          execute format(
            'update %I.%I set %I = $1 where ctid = $2',
            v_alvo.esquema, v_alvo.tabela, v_alvo.coluna
          ) using p_contato_principal, v_linha.tid;
          v_movidas := v_movidas + 1;
        exception when unique_violation or exclusion_violation then
          v_pulados := v_pulados + 1;
        end;
      end loop;
    end;

    if v_movidas > 0 then
      v_repontado := v_repontado
        || jsonb_build_object(v_alvo.tabela || '.' || v_alvo.coluna, v_movidas);
    end if;
    if v_pulados > 0 then
      v_nao_repontado := v_nao_repontado
        || jsonb_build_object(v_alvo.tabela || '.' || v_alvo.coluna, v_pulados);
    end if;
  end loop;

  -- 6 · O principal MANDA; o que ele não tem, vem dos perdedores. Nunca o
  --     contrário: sobrescrever o que o atendente digitou seria fusão com
  --     surpresa, e fusão não tem desfazer.
  select c.name into v_nome from public.contacts c
   where c.id = any(p_contatos_secundarios) and c.name is not null
   order by c.created_at, c.id limit 1;
  select c.display_name into v_apelido from public.contacts c
   where c.id = any(p_contatos_secundarios) and c.display_name is not null
   order by c.created_at, c.id limit 1;
  select c.birthdate into v_nascimento from public.contacts c
   where c.id = any(p_contatos_secundarios) and c.birthdate is not null
   order by c.created_at, c.id limit 1;
  select c.email into v_email from public.contacts c
   where c.id = any(p_contatos_secundarios) and c.email is not null
   order by c.created_at, c.id limit 1;
  select c.phone_number into v_telefone from public.contacts c
   where c.id = any(p_contatos_secundarios) and c.phone_number is not null
   order by c.created_at, c.id limit 1;
  -- `wa_identity`/`wa_lid` são GERADAS: o que se herda é a origem delas. Sem
  -- isto o WhatsApp do perdedor fica órfão — `fn_upsert_wa_contact` filtra
  -- `is_merged_into is null`, não acharia mais ninguém e criaria um contato
  -- novo na mensagem seguinte, refazendo a duplicata que acabou de ser desfeita.
  -- (9043) Primeiro o `lid` da absorvida cujo telefone vira o principal: o
  -- número e o WhatsApp dele andam juntos.
  select c.source_metadata->>'waha_lid' into v_lid from public.contacts c
   where c.id = any(p_contatos_secundarios)
     and c.source_metadata->>'waha_lid' is not null
   order by (v_principal.phone_number is null and c.phone_number is not distinct from v_telefone) desc,
            c.created_at, c.id limit 1;

  -- Guardas de unicidade. A lápide já tirou os perdedores dos índices parciais,
  -- então o que sobrar aqui é conflito com um TERCEIRO contato vivo — e nesse
  -- caso o vencedor simplesmente não herda o campo. Falhar a fusão inteira por
  -- causa de um e-mail seria perder o repontamento que já valeu a pena.
  if v_email is not null and exists (
    select 1 from public.contacts o
     where o.organization_id = p_organization_id and o.is_merged_into is null
       and o.id <> p_contato_principal and o.email_normalized = lower(btrim(v_email))
  ) then v_email := null; end if;
  -- (9043) Pela forma canônica e olhando os extras: o número que já é extra de
  -- alguém (inclusive da ficha que fica) não pode virar principal — a regra
  -- "um número, uma ficha" recusaria e a fusão inteira cairia.
  if v_telefone is not null and (exists (
    select 1 from public.contacts o
     where o.organization_id = p_organization_id and o.is_merged_into is null
       and o.id <> p_contato_principal and o.phone_number is not null
       and public.fn_telefone_canonico(o.phone_number) = public.fn_telefone_canonico(v_telefone)
  ) or exists (
    select 1 from public.contact_phones t
     where t.organization_id = p_organization_id
       and t.phone_number = public.fn_telefone_canonico(v_telefone)
  )) then v_telefone := null; end if;
  if v_lid is not null and (exists (
    select 1 from public.contacts o
     where o.organization_id = p_organization_id and o.is_merged_into is null
       and o.id <> p_contato_principal and o.wa_lid = v_lid
  ) or exists (
    select 1 from public.contact_phones t
     where t.organization_id = p_organization_id and t.wa_lid = v_lid
  )) then v_lid := null; end if;

  -- (9043) `custom_fields`: a chave que a ficha que fica não tem entra; em
  -- chave repetida vence a ficha que fica e, entre absorvidas, a primeira
  -- (por `created_at, id`, a ordem de todo o resto). Antes, o que estava na
  -- absorvida ficava só na lápide.
  select coalesce(jsonb_object_agg(s.chave, s.valor), '{}'::jsonb) into v_campos
    from (
      select distinct on (e.key) e.key as chave, e.value as valor
        from public.contacts c
        cross join lateral jsonb_each(
          case when jsonb_typeof(c.custom_fields) = 'object' then c.custom_fields else '{}'::jsonb end
        ) as e
       where c.organization_id = p_organization_id
         and c.id = any(p_contatos_secundarios)
       order by e.key, c.created_at, c.id
    ) as s;

  select coalesce(array_agg(distinct t), '{}'::text[]) into v_tags
    from (
      select unnest(c.tags) as t from public.contacts c
       where c.organization_id = p_organization_id
         and (c.id = p_contato_principal or c.id = any(p_contatos_secundarios))
    ) as todas;

  -- CPF e `consent` NÃO são herdados, de propósito. CPF é um PAR
  -- (`cpf_encrypted` + `cpf_hash`) preso por check constraint e criptografado
  -- com a chave da instalação — mover metade quebra a linha. `consent` é
  -- registro legal do que AQUELA pessoa autorizou; herdar um "granted_at" de
  -- outro cadastro fabricaria consentimento. Falha fechada nos dois.
  update public.contacts set
    name = coalesce(name, v_nome),
    display_name = coalesce(display_name, v_apelido),
    birthdate = coalesce(birthdate, v_nascimento),
    email = coalesce(email, v_email),
    phone_number = coalesce(phone_number, v_telefone),
    tags = v_tags,
    custom_fields = v_campos || coalesce(custom_fields, '{}'::jsonb),
    last_activity_at = greatest(
      last_activity_at,
      (select max(c.last_activity_at) from public.contacts c
        where c.id = any(p_contatos_secundarios))
    ),
    source_metadata = (
      case when source_metadata->>'waha_lid' is null and v_lid is not null
        then source_metadata || jsonb_build_object('waha_lid', v_lid)
        else source_metadata end
    )
      - case when coalesce(phone_number, v_telefone) is not null
             then 'telefone_em_conflito' else '' end
      || jsonb_build_object(
           'mesclado_de',
           coalesce(source_metadata->'mesclado_de', '[]'::jsonb)
             || to_jsonb(p_contatos_secundarios),
           'mesclado_em', to_jsonb(now())
         ),
    updated_at = now()
  where id = p_contato_principal and organization_id = p_organization_id;

  -- 6b · (9043) O telefone principal de cada absorvida vira telefone extra da
  --     ficha que fica, com tipo, WhatsApp e o `lid` dela — sem isto, a próxima
  --     mensagem daquele número não acha ficha viva e abre uma terceira. Fica de
  --     fora o número que a ficha que fica já tem (principal ou extra) e o de
  --     uma terceira ficha viva (como o e-mail, não herda). O `lid` que já é de
  --     alguém vivo não vai junto.
  for v_sec in
    select c.phone_number, c.phone_type, c.phone_whatsapp,
           nullif(regexp_replace(coalesce(c.source_metadata->>'waha_lid', ''), '@.*$', ''), '') as lid
      from public.contacts c
     where c.organization_id = p_organization_id
       and c.id = any(p_contatos_secundarios)
       and c.phone_number is not null
     order by c.created_at, c.id
  loop
    v_canon := public.fn_telefone_canonico(v_sec.phone_number);
    continue when v_canon is null;
    continue when exists (
      select 1 from public.contacts o
       where o.organization_id = p_organization_id and o.is_merged_into is null
         and o.phone_number is not null
         and public.fn_telefone_canonico(o.phone_number) = v_canon
    ) or exists (
      select 1 from public.contact_phones t
       where t.organization_id = p_organization_id and t.phone_number = v_canon
    );
    v_lid_extra := v_sec.lid;
    if v_lid_extra is not null and (exists (
      select 1 from public.contacts o
       where o.organization_id = p_organization_id and o.is_merged_into is null
         and o.wa_lid = v_lid_extra
    ) or exists (
      select 1 from public.contact_phones t
       where t.organization_id = p_organization_id and t.wa_lid = v_lid_extra
    )) then
      v_lid_extra := null;
    end if;
    insert into public.contact_phones
      (organization_id, contact_id, phone_number, tipo, whatsapp, origem, wa_lid)
    values
      (p_organization_id, p_contato_principal, v_canon,
       coalesce(v_sec.phone_type, public.fn_tipo_do_telefone(v_canon)),
       coalesce(v_sec.phone_whatsapp, 'nao_sei'), 'fusao', v_lid_extra);
  end loop;

  -- 7 · A fusão aparece na timeline de cada negócio que o vencedor passou a ter.
  --     `crm_lead_activities.lead_id` é NOT NULL — contato sem negócio nenhum
  --     não tem onde escrever, e para esse caso quem guarda o rastro é o
  --     `api_audit_log` que a rota emite, sempre.
  insert into public.crm_lead_activities
    (organization_id, lead_id, contact_id, source_module, source_id, type,
     payload, metadata, performed_at, performed_by_user_id)
  select p_organization_id, l.id, p_contato_principal, 'crm', p_contato_principal,
         'contacts_merged',
         jsonb_build_object(
           'contatos_mesclados', to_jsonb(p_contatos_secundarios),
           'repontado', v_repontado,
           'nao_repontado', v_nao_repontado
         ),
         '{}'::jsonb, now(), auth.uid()
    from public.crm_leads l
   where l.organization_id = p_organization_id
     and l.contact_id = p_contato_principal;
  get diagnostics v_leads = row_count;

  return jsonb_build_object(
    'contato_id', p_contato_principal,
    'contatos_mesclados', to_jsonb(p_contatos_secundarios),
    'repontado', v_repontado,
    'nao_repontado', v_nao_repontado,
    'atividades_emitidas', v_leads
  );
end;
$function$;

-- ── 8. LGPD: os extras entram na anonimização ─────────────────────────────
-- A cascata, a partir da ÚLTIMA definição do fork (8001); o que muda está
-- marcado com (9043). `fn_redigir_conversas_ao_anonimizar` (8002) fica como
-- está: o fork não tem o braço das mensagens de grupo que a 9043 estendia.
CREATE OR REPLACE FUNCTION "public"."fn_lgpd_cascade_redact_contact"("p_organization_id" "uuid", "p_contact_id" "uuid", "p_request_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
declare
  v_already bool;
  v_counts jsonb := '{}'::jsonb;
  v_media_paths text[] := '{}';
  v_anon_label text;
  v_count int;
  -- As grafias do telefone desta pessoa, capturadas ANTES de o passo 1 zerar
  -- `contacts.phone_number`. A ordem aqui não é detalhe: o expurgo da
  -- prospecção roda ~150 linhas depois do `update contacts`, e ler o telefone
  -- lá embaixo leria NULL — o braço por telefone existiria no código e não
  -- alcançaria linha nenhuma, que é pior que não existir, porque parece feito.
  v_variantes text[] := '{}';
begin
  perform public.fn_service_lock(p_organization_id,p_contact_id);
  select is_anonymized into v_already
    from contacts
    where id = p_contact_id and organization_id = p_organization_id;

  if not found then
    raise exception 'contact not found' using errcode = 'P0002';
  end if;

  if v_already then
    return jsonb_build_object('already_anonymized', true, 'counts', v_counts, 'media_paths', v_media_paths);
  end if;

  v_anon_label := 'Cliente Anonimizado #' || substring(p_contact_id::text from 1 for 8);

  -- Capturado AGORA, enquanto o telefone ainda existe (o passo 1 o apaga).
  -- (#85, upstream 9043) As variantes do principal E dos telefones extras,
  -- lidas ANTES de apagar os extras (passo 1b): o candidato da prospecção casado
  -- pelo número extra também é da pessoa que pediu para ser esquecida.
  select coalesce(array_agg(distinct v), '{}')
    into v_variantes
    from (
      select unnest(public.fn_telefone_variantes(c.phone_number)) as v
        from contacts c
       where c.id = p_contact_id and c.organization_id = p_organization_id
      union all
      select unnest(public.fn_telefone_variantes(t.phone_number))
        from contact_phones t
       where t.contact_id = p_contact_id and t.organization_id = p_organization_id
    ) as todas;

  -- Collect media storage paths (we only delete what we own — media_storage_path)
  select coalesce(array_agg(distinct media_storage_path) filter (where media_storage_path is not null), '{}')
    into v_media_paths
    from messages
    where organization_id = p_organization_id
      and conversation_id in (
        select id from conversations
          where contact_id = p_contact_id and organization_id = p_organization_id
      );

  -- 1. contacts (irreversible)
  update contacts set
    name = v_anon_label,
    display_name = v_anon_label,
    email = null,
    -- email_normalized NÃO entra: é GENERATED ALWAYS AS (lower(trim(email)))
    -- e o Postgres recusa escrita nela — a linha acima já a zera por derivação.
    -- Com a atribuição, o cascade INTEIRO abortava e nada era anonimizado.
    phone_number = null,
    phone_type = null,
    phone_whatsapp = null,
    cpf_encrypted = null,
    cpf_hash = null,
    birthdate = null,
    is_anonymized = true,
    anonymized_at = now(),
    consent = '{}'::jsonb,
    source_metadata = '{}'::jsonb,
    tags = '{}'::text[],
    updated_at = now()
  where id = p_contact_id and organization_id = p_organization_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('contacts', v_count);

  -- 1b. contact_phones (9043) — os telefones extras, com o `lid` de cada um.
  -- Depois do passo 1: o gatilho de redação das mensagens de grupo, que roda
  -- no `update` acima, ainda precisava lê-los.
  delete from contact_phones
   where organization_id = p_organization_id and contact_id = p_contact_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('contact_phones', v_count);

  -- 2. conversations metadata + preview strip
  update conversations set
    metadata = '{}'::jsonb,
    last_message_preview = null,
    -- O motivo CRU da última passagem (migration 0291). É código de
    -- vocabulário, não texto livre — mas ele diz que ESTA pessoa foi escalada
    -- por irritação, por assunto jurídico ou por suspeita de opt-out, e isso é
    -- um fato sobre ela. Entra NESTE update, e não num segundo: mesmo
    -- predicado, mesmas linhas, metade das varreduras.
    --
    -- ⚠️ `last_handoff_reason` é CHAVE DE NEGÓCIO em outro módulo: a ponte de
    -- voz limpa o silêncio filtrando pelo VALOR da coluna
    -- (`lib/wacalls/events-bridge.ts`). Zerá-la num contato anonimizado é
    -- seguro — não há chamada viva de contato anonimizado — e é a razão de
    -- esta entrega NÃO usar essa coluna para texto rico: ela continua
    -- recebendo só o código, e o texto vive em `passagens_de_atendimento`.
    last_handoff_reason = null,
    updated_at = now()
  where contact_id = p_contact_id and organization_id = p_organization_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('conversations', v_count);

  -- 3. messages: redact body + null media + strip metadata (preserve status/timestamps/conversation_id)
  update messages set
    body = '[mensagem anonimizada]',
    media_derived_text = null,
    media_url = null,
    media_mime = null,
    media_size_bytes = null,
    media_storage_path = null,
    metadata = '{}'::jsonb,
    updated_at = now()
  where organization_id = p_organization_id
    and conversation_id in (
      select id from conversations
        where contact_id = p_contact_id and organization_id = p_organization_id
    );
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('messages', v_count);

  -- 4. crm_lead_activities — strip payload, metadata E reason (migration 0071).
  --    `reason` é texto livre escrito por LLM sobre a conversa do lead: supor que
  --    nunca conterá um nome é a suposição que falha. `evidence` NÃO é limpa —
  --    guarda só ids, e as linhas apontadas são redigidas por conta própria.
  update crm_lead_activities set
    payload = '{}'::jsonb,
    metadata = '{}'::jsonb,
    reason = null
  where organization_id = p_organization_id
    and (
      contact_id = p_contact_id
      or lead_id in (
        select lead_id from crm_lead_links
          where target_kind = 'contact'
            and target_id = p_contact_id
            and organization_id = p_organization_id
      )
      or lead_id in (
        select id from crm_leads
          where contact_id = p_contact_id and organization_id = p_organization_id
      )
    );
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('activities', v_count);

  -- 5. crm_leads — strip title/description/custom_fields/source_metadata/tags but PRESERVE pipeline/stage/value
  update crm_leads set
    title = v_anon_label,
    description = null,
    custom_fields = '{}'::jsonb,
    source_metadata = '{}'::jsonb,
    tags = '{}'::text[],
    updated_at = now()
  where organization_id = p_organization_id
    and (
      contact_id = p_contact_id
      or id in (
        select lead_id from crm_lead_links
          where target_kind = 'contact'
            and target_id = p_contact_id
            and organization_id = p_organization_id
      )
    );
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('leads', v_count);

  -- 6. orders — PRESERVE values + status + timestamps. Strip personal fields from payload jsonb
  --    and replace customer_external_id with null (FK-safe; soft de-link). Keep contact_id null.
  update orders set
    payload = (coalesce(payload, '{}'::jsonb))
      - 'customer'
      - 'customer_name'
      - 'customer_email'
      - 'customer_phone'
      - 'shipping_address'
      - 'billing_address'
      - 'contact_identification',
    customer_external_id = null,
    contact_id = null,
    is_anonymized = true,
    updated_at = now()
  where organization_id = p_organization_id
    and contact_id = p_contact_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('orders', v_count);

  -- CAMPANHAS: o que foi DITO à pessoa e o endereço para onde foi.
  --
  -- `rendered_body` é a mensagem que ela recebeu e `recipient_address` o
  -- telefone. Sem esta limpeza, anonimizar devolveria SUCESSO deixando a
  -- prospecção legível — falha muda, com o SLA marcado como cumprido.
  -- A LINHA FICA: ela é a prova de que a pessoa esteve naquela campanha, e
  -- apagá-la desfaria a contagem de quem recebeu.
  update campaign_recipients set
    rendered_body = null,
    recipient_address = null,
    variables = '{}'::jsonb,
    last_error_detail = null,
    updated_at = now()
  where organization_id = p_organization_id
    and contact_id = p_contact_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('campaign_recipients', v_count);

  -- LISTA DE EXCLUSÃO: solta o vínculo e apaga a cauda do telefone.
  --
  -- O HASH do endereço PERMANECE de propósito: é ele que faz o "não me mande
  -- mais" continuar valendo depois da anonimização. Apagá-lo faria a pessoa
  -- voltar a receber campanha.
  update campaign_suppressions set
    address_tail = null,
    reason = null,
    contact_id = null
  where organization_id = p_organization_id
    and contact_id = p_contact_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('campaign_suppressions', v_count);
  -- REAPLICADO AO DERIVAR ESTE APÊNDICE (merge da main, 0359 comanda).
  -- O Postgres troca o corpo INTEIRO num `create or replace`: um apêndice
  -- escrito sobre uma versão anterior da função APAGA, em silêncio, o passo
  -- que outra entrega acrescentou. Anonimizar devolveria SUCESSO com o texto
  -- da comanda ainda legível — e o SLA marcado como cumprido.
  -- 6b. sales — a comanda. PRESERVA valor, status e datas, e NÃO desliga o
  --     contato: a venda é registro financeiro (e fiscal) da organização, e
  --     desligá-la do contato faria o relatório por cliente deixar de fechar
  --     com o faturamento do período — divergência muda, meses depois, num
  --     número que ninguém consegue reconciliar. O contato apontado já é
  --     `Cliente Anonimizado #N`; o que sai daqui é o TEXTO LIVRE, que é onde
  --     a pessoa é nomeada de novo ("cliente da Ana, filha da Dona Maria").
  --     Os itens (`sale_items`) não entram: `description` ali é o nome do
  --     SERVIÇO, congelado na inclusão, e apagá-lo destruiria o relatório por
  --     serviço sem tirar dado de pessoa nenhum.
  update sales set
    notes = null,
    cancel_reason = case when cancel_reason is null then null else '[redigido]' end,
    reverse_reason = case when reverse_reason is null then null else '[redigido]' end,
    updated_at = now()
  where organization_id = p_organization_id
    and contact_id = p_contact_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('sales', v_count);

  -- 7. enqueue media for async deletion (idempotent via unique (bucket, object_path))
  if array_length(v_media_paths, 1) > 0 then
    insert into storage_redaction_queue (organization_id, request_id, bucket, object_path)
    select p_organization_id, p_request_id, 'whatsapp-media', path
      from unnest(v_media_paths) as path
      where path is not null and length(path) > 0
    on conflict (bucket, object_path) do nothing;
  end if;

  -- 7b. voice_calls — o TELEFONE de quem falou ao telefone (migration 0235).
  --
  -- `peer_phone` é `not null` e guarda o número da outra ponta: depois de
  -- anonimizar o contato, ele sobrevivia ligado ao `contact_id` e reidentificava
  -- a pessoa que pediu para ser esquecida. É o mesmo argumento que a foto de
  -- perfil já tinha (ver o bloco do avatar em `lib/lgpd/redact-cascade.ts`):
  -- anonimizar em toda parte menos numa é não ter anonimizado.
  --
  -- O que fica: direção, status, motivo do fim, marcas de tempo e duração. Um
  -- registro de "houve uma chamada de 12 minutos" sem número e sem dono não
  -- identifica ninguém e é o que sustenta a métrica do atendente e a fatura.
  -- `peer_phone` é NOT NULL, então recebe o rótulo, não `null`.
  update voice_calls set
    peer_phone = v_anon_label,
    owner_user_id = null,
    created_by = null,
    updated_at = now()
  where organization_id = p_organization_id
    and contact_id = p_contact_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('voice_calls', v_count);

  -- Native discovery stores commercial/person data before the Inbox exists.
  -- Keep only keyed suppression tokens, restricted to the server, to prevent
  -- another extraction from reintroducing this erased candidate.
  --
  -- O PREDICADO ALCANÇA POR VÍNCULO **OU** POR TELEFONE, e o segundo braço é o
  -- que conserta um buraco real: quando o telefone raspado já pertencia a um
  -- contato conhecido da organização, `lib/prospecting/store.ts` grava o
  -- candidato como `skipped` e DEIXA `contact_id` nulo de propósito (lá o
  -- vínculo é o freio de mão do envio, em `worker.ts`). Só pelo `contact_id`,
  -- essa pessoa — justamente a que a empresa já conhece — pedia exclusão,
  -- recebia sucesso, a auditoria gravava `lgpd.redact_executed`, e o nome, o
  -- telefone e o endereço dela seguiam legíveis aqui.
  --
  -- Em expurgo os dois erros não têm o mesmo preço: alcançar demais custa um
  -- registro de prospecção descartado; alcançar de menos é violação legal. Por
  -- isso o `or`, e por isso a comparação por VARIANTE do nono dígito.
  update prospecting_candidates set suppression_salt = gen_random_bytes(32)
  where organization_id = p_organization_id
    and (contact_id = p_contact_id
         or (phone is not null
             and regexp_replace(phone, '\D', '', 'g') = any (v_variantes)))
    and suppression_salt is null;
  update prospecting_candidates set
    suppression_place = hmac(convert_to(place_id, 'UTF8'), suppression_salt, 'sha256'),
    suppression_phone = case when phone is null then null
      else hmac(convert_to(phone, 'UTF8'), suppression_salt, 'sha256') end,
    place_id = 'redacted:' || id::text,
    phone = null,
    data = jsonb_build_object('key', 'redacted:' || id::text,
      'name', v_anon_label, 'phone', null, 'website', null,
      'category', null, 'address', null, 'maps_url', null,
      'rating', null, 'reviews', null, 'emails', '[]'::jsonb, 'socials', '[]'::jsonb),
    status = 'skipped', service_boundary = null, error = null, updated_at = now()
  -- MESMO predicado do bloco anterior. Se os dois divergirem, a linha alcançada
  -- por um e não pelo outro fica com `suppression_salt` semeado e os dados
  -- pessoais intactos — um estado que parece tratado e não está.
  where organization_id = p_organization_id
    and (contact_id = p_contact_id
         or (phone is not null
             and regexp_replace(phone, '\D', '', 'g') = any (v_variantes)));
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('prospecting_candidates', v_count);


  -- agent_cases — o que a IA escreveu SOBRE a pessoa quando travou (migration 0280).
  --
  -- O caso é o texto que a equipe lê antes de decidir: `title`, `summary` e
  -- `blocker` saem do modelo a partir da conversa, e `context_snapshot` é o
  -- recorte dessa conversa que o motor mandou para ele. Nada disso é registro de
  -- operação — é o relato do problema de uma pessoa identificável, escrito por
  -- máquina. Sem este passo, anonimizar devolvia SUCESSO com o relato intacto.
  --
  -- As três colunas de texto são `not null`: recebem rótulo e texto fixo, nunca
  -- `null` (a mesma razão de `voice_calls.peer_phone` logo acima).
  --
  -- ⚠️ `updated_at` FICA FORA DO `set`, de propósito. O cobrador de caso parado
  -- (`app/api/v1/cron/case-stale-watcher/route.ts`) lê `updated_at` como "alguém
  -- da equipe encostou neste caso". A cascata não é alguém encostando: escrever
  -- ali faria a anonimização ADIAR a cobrança de um caso que continua parado, e
  -- o efeito só apareceria como um cliente esperando mais tempo.
  --
  -- O vínculo é pela CONVERSA porque `agent_cases` não tem FK para `contacts`.
  update agent_cases set
    title = v_anon_label,
    summary = '[resumo anonimizado]',
    blocker = '[bloqueio anonimizado]',
    context_snapshot = '{}'::jsonb
  where organization_id = p_organization_id
    and conversation_id in (
      select id from conversations
        where contact_id = p_contact_id and organization_id = p_organization_id
    );
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('agent_cases', v_count);

  -- agent_case_events — a linha do tempo do caso (migration 0280).
  --
  -- `body` é o que a pessoa da equipe escreveu ao responder o caso e o que o
  -- agente registrou sobre o que o LEAD respondeu; `metadata` carrega o recorte
  -- que o motor anexou. `kind`, `actor_kind`, `human_action` e `created_at`
  -- FICAM: são o registro de que houve um toque humano e quando — operação, não
  -- dado da pessoa, e é deles que sai a métrica de atendimento.
  update agent_case_events set
    body = null,
    metadata = '{}'::jsonb
  where organization_id = p_organization_id
    and case_id in (
      select id from agent_cases
        where organization_id = p_organization_id
          and conversation_id in (
            select id from conversations
              where contact_id = p_contact_id and organization_id = p_organization_id
          )
    );
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('agent_case_events', v_count);

  -- demandas — o assunto do pedido (migration 0280).
  --
  -- `assunto` é texto livre sobre o que a pessoa pediu. O resto da linha é a
  -- operação da demanda (origem, estado, dono, prazo, desfecho) e fica de pé:
  -- apagar a linha inteira tiraria da organização a resposta a "quantos pedidos
  -- houve em março", que é o mesmo argumento do compromisso da agenda.
  --
  -- FK direta (`demandas.contact_id` é `not null`), então o vínculo é o contato.
  update demandas set
    assunto = null
  where organization_id = p_organization_id
    and contact_id = p_contact_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('demandas', v_count);

  -- agent_inbox_items — o aviso que leva o texto do caso para a Central (migration 0280).
  --
  -- O `body` do aviso de caso parado EMBUTE o título do caso
  -- (`app/api/v1/cron/case-stale-watcher/route.ts:128`), e o do handoff embute o
  -- motivo da parada (`lib/ai/handoff/orchestrator.ts:335`). Redigir o caso e
  -- deixar o aviso de pé seria anonimizar em toda parte menos numa — que é não
  -- ter anonimizado. O molde (resolver + trocar o corpo + soltar a referência) é
  -- o de `fn_meet_redact_contact`, que já faz isto para o aviso de compromisso.
  --
  -- ⚠️ O VÍNCULO É POLIMÓRFICO E TEM TRÊS BRAÇOS, não dois. Medido nos
  -- produtores, não suposto: `handoff` nasce com `ref_kind='contact'`
  -- (`lib/ai/handoff/orchestrator.ts:339`) E com `ref_kind='conversation'`
  -- (`lib/agent-engine/agent/inbound-turn.ts:4100`); `case_stale` nasce SEMPRE
  -- com `ref_kind='agent_case'` (a rota do cron acima, e a política em
  -- `lib/ai/inbox-destino.ts:38`). Um predicado com só os dois primeiros braços
  -- casa ZERO avisos de caso parado — e casar zero linha não é erro: é sucesso
  -- com o texto intacto.
  --
  -- Os `kind` são os MEDIDOS no CHECK vigente (`supabase/baseline.sql`, bloco
  -- único de `agent_inbox_items_kind_check`). `case_opened` NÃO existe, e kind
  -- inexistente num `in (...)` também casa zero e devolve sucesso. Para
  -- reconferir sem acreditar nesta prosa:
  --   grep -n "agent_inbox_items_kind_check check" -A40 supabase/baseline.sql
  update agent_inbox_items set
    status = 'resolved',
    resolved_at = now(),
    body = 'Contato anonimizado.',
    ref_id = null
  where organization_id = p_organization_id
    -- `aviso_de_caso_nao_entregue` (migration 0292) entra AQUI e não num
    -- passo próprio: é o mesmo predicado polimórfico, e o braço
    -- `ref_kind='agent_case'` já alcança o caso do titular. O corpo do aviso
    -- embute o título do caso, que é texto sobre a pessoa.
    and kind in ('handoff', 'case_stale', 'aviso_de_caso_nao_entregue')
    and (
      (ref_kind = 'contact' and ref_id = p_contact_id)
      or (ref_kind = 'conversation' and ref_id in (
            select id from conversations
              where contact_id = p_contact_id and organization_id = p_organization_id
          ))
      or (ref_kind = 'agent_case' and ref_id in (
            select id from agent_cases
              where organization_id = p_organization_id
                and conversation_id in (
                  select id from conversations
                    where contact_id = p_contact_id and organization_id = p_organization_id
                )
          ))
    );
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('agent_inbox_items', v_count);

  -- agent_case_chat_messages — a consulta interna da equipe à IA SOBRE o caso
  -- (migration 0281). FK DIRETA para `contacts`, então o vínculo é o titular e
  -- não precisa passar pela conversa.
  --
  -- `redacted_at is null` no `where` é o que torna o passo IDEMPOTENTE: a
  -- varredura diária de redações incompletas roda a função de novo, e sem essa
  -- condição o carimbo de QUANDO se apagou seria reescrito a cada rodada.
  --
  -- A linha NÃO é apagada, só o texto: quem abrir o caso depois continua vendo
  -- que a equipe perguntou N vezes, quando, e se a IA respondeu. Apagar a linha
  -- inteira ficaria verde num teste de "o texto sumiu" e tiraria da organização
  -- a resposta a "quanto a equipe deliberou sobre este caso".
  update agent_case_chat_messages set
    body = null,
    redacted_at = now()
  where organization_id = p_organization_id
    and contact_id = p_contact_id
    and redacted_at is null;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('agent_case_chat_messages', v_count);

  -- passagens_de_atendimento — o BRIEFING é sobre a pessoa (migration 0291).
  --
  -- A linha guarda o que a IA concluiu sobre um atendimento de alguém
  -- identificável: o que ela entendeu que a pessoa quer (`title`), a narrativa
  -- que quem assumiu leu (`body`), as PALAVRAS LITERAIS do cliente (`notes`), o
  -- texto livre de quem passou (`content`) e o que a IA já tinha tentado
  -- (`tentativas`). Nada disso é registro de operação — é o relato do problema
  -- de uma pessoa, escrito por máquina, na tela de quem vai responder.
  --
  -- `body` é `not null` e recebe o RÓTULO, não `null` — a mesma razão de
  -- `voice_calls.peer_phone` e de `agent_cases.title` acima: coluna obrigatória
  -- anulada aborta o cascade INTEIRO, e um cascade abortado não anonimiza nada.
  --
  -- O que FICA, de propósito: `motor`, `origem`, `motivo_codigo`,
  -- `cliente_avisado`, `aviso_motivo_codigo`, `criado_em` e o par de
  -- reconhecimento. São operação — quantas passagens houve, por quê, quanto
  -- tempo até alguém assumir. Um passo que apagasse a linha inteira ficaria
  -- verde num teste de "o texto sumiu" e tiraria da organização a resposta a
  -- "quantos atendimentos a IA devolveu em março, e quanto tempo esperaram".
  --
  -- O vínculo é a FK DIRETA `contact_id`: a tabela a carrega exatamente para
  -- este passo não precisar passar pela conversa.
  update passagens_de_atendimento set
    body       = v_anon_label,
    title      = null,
    notes      = null,
    content    = null,
    tentativas = '[]'::jsonb
  where organization_id = p_organization_id and contact_id = p_contact_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('passagens_de_atendimento', v_count);

  -- entregas_de_aviso_de_caso — o registro do aviso ao suporte (migration 0292).
  --
  -- A tabela NÃO guarda o texto do aviso (só `corpo_hash`), e a única coluna
  -- capaz de ecoar um dado da pessoa é `erro_detalhe`: ali vai o texto CRU que
  -- o transporte devolveu, truncado, e um provedor que recusa um envio costuma
  -- devolver o destinatário dentro da mensagem de erro.
  --
  -- O que FICA, de propósito: `status`, `erro_codigo`, `tentativas`,
  -- `enviado_em`, `destino`, `corpo_hash`. São operação — quantos avisos saíram,
  -- quantos falharam e por quê. Um passo que apagasse a linha inteira ficaria
  -- verde num teste de "o texto sumiu" e tiraria da organização a resposta a
  -- "quantos avisos não chegaram em março". `destino` é o telefone da EQUIPE,
  -- não do titular: anonimizar um cliente não apaga o número do plantão.
  --
  -- ⚠️ PONTO CEGO DECLARADO: `tests/invariants/lgpd-cascata-alcanca-quem-
  -- guarda-pessoa.test.ts` só cobra tabela com FK para `contacts` E coluna cujo
  -- NOME case o padrão de PII. Esta tabela não satisfaz nenhuma das duas — o
  -- gate ficaria VERDE sem este passo. Ele entra porque é certo, não porque o
  -- gate cobra, e isto está escrito aqui para a próxima sessão não o remover
  -- achando que é ornamento. Quem o vigia é a catraca
  -- `tests/invariants/cascata-lgpd-nao-encolhe.test.ts`.
  --
  -- O vínculo é pela CONVERSA, como o de `agent_cases`: esta tabela aponta para
  -- o caso, e o caso não tem FK para `contacts`.
  update entregas_de_aviso_de_caso set
    erro_detalhe = null
  where organization_id = p_organization_id
    and case_id in (
      select id from agent_cases
        where organization_id = p_organization_id
          and conversation_id in (
            select id from conversations
              where contact_id = p_contact_id and organization_id = p_organization_id
          )
    );
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('entregas_de_aviso_de_caso', v_count);

  -- 8. dense audit row
  insert into api_audit_log (organization_id, action, actor_user_id, resource_type, resource_id, metadata, bypassed_rls)
  values (
    p_organization_id,
    'lgpd.redact_executed',
    null,
    'contact',
    p_contact_id,
    jsonb_build_object(
      'cascaded_to', v_counts,
      'media_queued', coalesce(array_length(v_media_paths, 1), 0),
      'request_id', p_request_id
    ),
    true
  );

  return jsonb_build_object(
    'already_anonymized', false,
    'counts', v_counts,
    'media_paths', v_media_paths
  );
end;
$$;
