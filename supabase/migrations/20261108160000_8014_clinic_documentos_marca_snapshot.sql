-- 8014 · clinic (FORK) — o papel timbrado de um documento EMITIDO não muda
-- (docs/padrao-documentos.md, fase D3).
--
-- clinic_documentos_emitidos ganha:
--   marca_snapshot jsonb — os dados de Configurações › Organização e › Marca
--                          (crus, + caminhos do logo e do favicon) com que o PDF
--                          foi gerado pela primeira vez;
--   layout_versao  text  — a versão do papel timbrado daquela geração.
-- Gravados UMA vez por fn_clinic_documento_fixar_marca (definer, service_role,
-- só quando ainda estão nulos) e travados por trg_clinic_documento_marca_fixa:
-- depois de fixados, nenhum UPDATE os muda. A trava de conteúdo existente
-- (trg_clinic_documento_imutavel) não muda. Aditiva; sem HTTP.

alter table public.clinic_documentos_emitidos
  add column if not exists marca_snapshot jsonb,
  add column if not exists layout_versao text;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.clinic_documentos_emitidos'::regclass
                    and conname = 'clinic_documentos_emitidos_marca_snapshot_forma') then
    alter table public.clinic_documentos_emitidos add constraint clinic_documentos_emitidos_marca_snapshot_forma
      check ((marca_snapshot is null and layout_versao is null)
          or (jsonb_typeof(marca_snapshot) = 'object' and layout_versao ~ '^\d+\.\d+\.\d+$'));
  end if;
end $$;

create or replace function public.fn_clinic_documento_marca_fixa()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.marca_snapshot is not null
     and (new.marca_snapshot is distinct from old.marca_snapshot or new.layout_versao is distinct from old.layout_versao) then
    raise exception 'documento_marca_fixa' using errcode = '55000';
  end if;
  return new;
end $$;
revoke execute on function public.fn_clinic_documento_marca_fixa() from public, anon, authenticated;
drop trigger if exists trg_clinic_documento_marca_fixa on public.clinic_documentos_emitidos;
create trigger trg_clinic_documento_marca_fixa before update on public.clinic_documentos_emitidos
  for each row execute function public.fn_clinic_documento_marca_fixa();

create or replace function public.fn_clinic_documento_fixar_marca(
  p_org      uuid,
  p_doc      uuid,
  p_snapshot jsonb,
  p_versao   text
) returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_linhas integer;
begin
  if p_org is null or p_doc is null or p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object'
     or p_versao is null or p_versao !~ '^\d+\.\d+\.\d+$' then
    raise exception 'documento_marca_invalida' using errcode = '22023';
  end if;
  update public.clinic_documentos_emitidos d
     set marca_snapshot = p_snapshot, layout_versao = p_versao
   where d.organization_id = p_org and d.id = p_doc and d.marca_snapshot is null;
  get diagnostics v_linhas = row_count;
  return v_linhas = 1;
end $$;

comment on function public.fn_clinic_documento_fixar_marca(uuid, uuid, jsonb, text) is
  'FORK clinic 8014 — fixa (uma vez) o snapshot da marca e a versão do papel timbrado de um documento emitido. Devolve false se já estava fixado. Chamador: app/api/v1/clinic/documentos/[id]/pdf e o PDF do contrato do orçamento (service role, organização da sessão).';

revoke execute on function public.fn_clinic_documento_fixar_marca(uuid, uuid, jsonb, text)
  from public, anon, authenticated;
grant  execute on function public.fn_clinic_documento_fixar_marca(uuid, uuid, jsonb, text)
  to service_role;
