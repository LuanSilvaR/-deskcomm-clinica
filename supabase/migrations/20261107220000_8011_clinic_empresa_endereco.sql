-- 8011 · clinic (FORK) — telefone e endereço da empresa (Configurações › Organização)
-- Colunas ADITIVAS e anuláveis em organizations (núcleo; registrado no
-- UPSTREAM.md). O CEP preenche o resto pela mesma consulta da ficha do
-- paciente (#86). Os CHECKs só valem quando há valor: colunas novas nascem
-- vazias e não quebram o update.sh. Sem policy nova (leitura pela RLS de
-- organizations; escrita pelo updateTenant, admin client com gate de admin).
-- Sem HTTP.

alter table public.organizations
  add column if not exists contact_phone text,
  add column if not exists address_cep text,
  add column if not exists address_street text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists address_district text,
  add column if not exists address_city text,
  add column if not exists address_uf text,
  add column if not exists address_city_ibge_code text;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.organizations'::regclass
                    and conname = 'organizations_contact_phone_digitos') then
    alter table public.organizations add constraint organizations_contact_phone_digitos
      check (contact_phone is null or contact_phone ~ '^\d{10,13}$');
  end if;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.organizations'::regclass
                    and conname = 'organizations_address_cep_digitos') then
    alter table public.organizations add constraint organizations_address_cep_digitos
      check (address_cep is null or address_cep ~ '^\d{8}$');
  end if;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.organizations'::regclass
                    and conname = 'organizations_address_uf_sigla') then
    alter table public.organizations add constraint organizations_address_uf_sigla
      check (address_uf is null or address_uf ~ '^[A-Z]{2}$');
  end if;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.organizations'::regclass
                    and conname = 'organizations_address_ibge_digitos') then
    alter table public.organizations add constraint organizations_address_ibge_digitos
      check (address_city_ibge_code is null or address_city_ibge_code ~ '^\d{7}$');
  end if;
end $$;

comment on column public.organizations.contact_phone is 'Telefone de contato da empresa, só dígitos (10 a 13, com DDI opcional). Fork clinic 8011.';
comment on column public.organizations.address_cep is 'CEP da empresa, 8 dígitos. Preenche o endereço pela consulta de CEP (#86). Fork clinic 8011.';
comment on column public.organizations.address_city_ibge_code is 'Código IBGE do município (7 dígitos), vindo do CEP — base da nota fiscal. Fork clinic 8011.';
