-- 8015 · clinic (FORK) — o conteúdo do POP pode ter até 5 MB (issue #124).
--
-- O CHECK clinic_pop_versions_documento_check limitava o JSON do editor a 1 MB.
-- Um POP de 12 mil caracteres com tabelas ocupa ~25 KB, mas o dono do produto
-- pediu folga para POPs bem maiores. O limite da aplicação
-- (lib/clinic/pops/documento.ts › LIMITE_DE_BYTES) subiu junto: os dois números
-- têm de ser o mesmo, ou a tela aceita o que o banco recusa.
--
-- Afrouxar um CHECK não invalida linha nenhuma (todo conteúdo de ≤ 1 MB cabe em
-- ≤ 5 MB). Idempotente: troca a regra só se ela ainda não for a nova.

do $$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.clinic_pop_versions'::regclass
       and conname = 'clinic_pop_versions_documento_check'
       and pg_get_constraintdef(oid) not like '%5242880%'
  ) then
    alter table public.clinic_pop_versions drop constraint clinic_pop_versions_documento_check;
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.clinic_pop_versions'::regclass
       and conname = 'clinic_pop_versions_documento_check'
  ) then
    alter table public.clinic_pop_versions add constraint clinic_pop_versions_documento_check
      check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 5242880);
  end if;
end $$;
