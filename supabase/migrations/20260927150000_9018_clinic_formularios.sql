-- ════════════════════════════════════════════════════════════════════════════
-- 9018 · clinic — formulários clínicos por MODELO versionado (FORK, prontuário F2)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/prontuario/plano.md (fase F2).
--
-- Anamnese e avaliação não são formulários fixos de estética: cada empresa tem
-- MODELOS (Anamnese geral, Anamnese estética, Avaliação facial...), e cada
-- modelo tem VERSÕES imutáveis — a lista de campos em JSON. O preenchimento
-- guarda a versão usada, então mudar o modelo amanhã não reescreve o que foi
-- registrado hoje.
--
--   clinic_modelos_formulario          o modelo (tipo, nome, especialidades)
--   clinic_modelos_formulario_versoes  os campos de cada versão (imutável)
--   clinic_formularios_preenchidos     as respostas de um atendimento
--
-- Campos: {chave, rotulo, tipo, obrigatorio?, opcoes?, min?, max?, ajuda?} com
-- tipo em texto|texto_longo|numero|data|sim_nao|escolha|multipla|escala. A
-- validação fina das respostas é do código (lib/clinic/formularios/campos.ts);
-- o banco garante forma (objeto, tamanho), versão do modelo da MESMA empresa e
-- do MESMO tipo, conflito de versão e atendimento aberto.
--
-- Leitura das respostas: membro + `prontuario.ver`. Modelos não têm dado de
-- paciente: qualquer membro lê. Escrita só por função. Idempotente.

-- ─── modelos ───────────────────────────────────────────────────────────────
create table if not exists public.clinic_modelos_formulario (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tipo text not null,
  nome text not null,
  descricao text,
  especialidades uuid[] not null default '{}',
  ativo boolean not null default true,
  padrao boolean not null default false,
  versao_atual integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint clinic_modelos_formulario_tipo_check check (tipo in ('anamnese', 'avaliacao')),
  constraint clinic_modelos_formulario_nome_tamanho check (char_length(btrim(nome)) between 1 and 80),
  constraint clinic_modelos_formulario_descricao_tamanho check (descricao is null or char_length(descricao) <= 300),
  constraint clinic_modelos_formulario_org_id_key unique (organization_id, id)
);
create unique index if not exists clinic_modelos_formulario_nome_key
  on public.clinic_modelos_formulario (organization_id, tipo, lower(btrim(nome)));

drop trigger if exists clinic_modelos_formulario_updated_at on public.clinic_modelos_formulario;
create trigger clinic_modelos_formulario_updated_at before update on public.clinic_modelos_formulario
  for each row execute function public.fn_set_updated_at();

create table if not exists public.clinic_modelos_formulario_versoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  modelo_id uuid not null,
  numero integer not null,
  campos jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint clinic_modelos_formulario_versoes_campos_check check (jsonb_typeof(campos) = 'array'),
  constraint clinic_modelos_formulario_versoes_numero_check check (numero >= 1),
  constraint clinic_modelos_formulario_versoes_modelo_numero_key unique (modelo_id, numero),
  constraint clinic_modelos_formulario_versoes_org_id_key unique (organization_id, id),
  constraint clinic_modelos_formulario_versoes_do_modelo foreign key (organization_id, modelo_id)
    references public.clinic_modelos_formulario (organization_id, id) on delete cascade
);

-- ─── preenchimentos ────────────────────────────────────────────────────────
create table if not exists public.clinic_formularios_preenchidos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  atendimento_id uuid not null,
  tipo text not null,
  modelo_versao_id uuid not null,
  respostas jsonb not null default '{}'::jsonb,
  status text not null default 'rascunho',
  versao integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint clinic_formularios_preenchidos_tipo_check check (tipo in ('anamnese', 'avaliacao')),
  constraint clinic_formularios_preenchidos_status_check check (status in ('rascunho', 'finalizado')),
  constraint clinic_formularios_preenchidos_respostas_check
    check (jsonb_typeof(respostas) = 'object' and octet_length(respostas::text) <= 65536),
  constraint clinic_formularios_preenchidos_atendimento_tipo_key unique (atendimento_id, tipo),
  constraint clinic_formularios_preenchidos_org_id_key unique (organization_id, id),
  constraint clinic_formularios_preenchidos_do_atendimento foreign key (organization_id, atendimento_id)
    references public.clinic_atendimentos (organization_id, id) on delete cascade,
  constraint clinic_formularios_preenchidos_da_versao foreign key (organization_id, modelo_versao_id)
    references public.clinic_modelos_formulario_versoes (organization_id, id) on delete restrict
);

drop trigger if exists clinic_formularios_preenchidos_updated_at on public.clinic_formularios_preenchidos;
create trigger clinic_formularios_preenchidos_updated_at before update on public.clinic_formularios_preenchidos
  for each row execute function public.fn_set_updated_at();

-- ─── RLS ───────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['clinic_modelos_formulario','clinic_modelos_formulario_versoes','clinic_formularios_preenchidos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation_%s_all on public.%I', t, t);
    execute format('drop policy if exists %s_select on public.%I', t, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
  end loop;
end $$;
drop policy if exists clinic_modelos_formulario_select on public.clinic_modelos_formulario;
create policy clinic_modelos_formulario_select on public.clinic_modelos_formulario for select using (
  organization_id in (select public.fn_user_org_ids()));
drop policy if exists clinic_modelos_formulario_versoes_select on public.clinic_modelos_formulario_versoes;
create policy clinic_modelos_formulario_versoes_select on public.clinic_modelos_formulario_versoes for select using (
  organization_id in (select public.fn_user_org_ids()));
-- Respostas são conteúdo clínico: sem atalho de platform admin.
drop policy if exists clinic_formularios_preenchidos_select on public.clinic_formularios_preenchidos;
create policy clinic_formularios_preenchidos_select on public.clinic_formularios_preenchidos for select using (
  (organization_id in (select public.fn_user_org_ids()))
  and public.fn_has_permission(organization_id, 'prontuario.ver'));
revoke update, delete, truncate on public.clinic_modelos_formulario_versoes from service_role;

-- ─── modelos padrão de cada empresa ────────────────────────────────────────
create or replace function public.fn_clinic_semear_modelos(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m record;
  v_id uuid;
begin
  for m in
    select * from (values
      ('anamnese', 'Anamnese geral', 'Para qualquer atendimento.', true, $j$[
        {"chave":"queixa_principal","rotulo":"Queixa principal","tipo":"texto_longo","obrigatorio":true},
        {"chave":"objetivo","rotulo":"Objetivo do paciente","tipo":"texto_longo"},
        {"chave":"historico_relevante","rotulo":"Histórico relevante","tipo":"texto_longo"},
        {"chave":"tem_alergias","rotulo":"Informa alergias?","tipo":"sim_nao"},
        {"chave":"alergias","rotulo":"Alergias informadas","tipo":"texto","ajuda":"Somente o que o paciente informou."},
        {"chave":"medicamentos","rotulo":"Medicamentos em uso","tipo":"texto_longo"},
        {"chave":"procedimentos_anteriores","rotulo":"Procedimentos anteriores","tipo":"texto_longo"},
        {"chave":"habitos","rotulo":"Hábitos","tipo":"multipla","opcoes":[
          {"valor":"tabagismo","rotulo":"Tabagismo"},{"valor":"alcool","rotulo":"Consumo de álcool"},
          {"valor":"atividade_fisica","rotulo":"Atividade física regular"},{"valor":"exposicao_solar","rotulo":"Exposição solar frequente"}]},
        {"chave":"observacoes","rotulo":"Observações do profissional","tipo":"texto_longo"}
      ]$j$),
      ('anamnese', 'Anamnese estética', 'Procedimentos estéticos faciais e corporais.', false, $j$[
        {"chave":"queixa_principal","rotulo":"Queixa principal","tipo":"texto_longo","obrigatorio":true},
        {"chave":"objetivo","rotulo":"Objetivo do paciente","tipo":"texto_longo"},
        {"chave":"procedimentos_anteriores","rotulo":"Procedimentos estéticos anteriores","tipo":"texto_longo"},
        {"chave":"usa_acidos","rotulo":"Usa ácidos ou retinoides?","tipo":"sim_nao"},
        {"chave":"exposicao_solar","rotulo":"Exposição solar","tipo":"escolha","opcoes":[
          {"valor":"baixa","rotulo":"Baixa"},{"valor":"moderada","rotulo":"Moderada"},{"valor":"alta","rotulo":"Alta"}]},
        {"chave":"tem_alergias","rotulo":"Informa alergias?","tipo":"sim_nao"},
        {"chave":"alergias","rotulo":"Alergias informadas","tipo":"texto"},
        {"chave":"medicamentos","rotulo":"Medicamentos em uso","tipo":"texto_longo"},
        {"chave":"gestacao","rotulo":"Gestação ou amamentação","tipo":"escolha","opcoes":[
          {"valor":"nao","rotulo":"Não"},{"valor":"gestante","rotulo":"Gestante"},{"valor":"lactante","rotulo":"Amamentando"},{"valor":"nao_se_aplica","rotulo":"Não se aplica"}]},
        {"chave":"historico_queloide","rotulo":"Histórico de queloide ou cicatrização difícil?","tipo":"sim_nao"},
        {"chave":"observacoes","rotulo":"Observações do profissional","tipo":"texto_longo"}
      ]$j$),
      ('avaliacao', 'Avaliação geral', 'Para qualquer atendimento.', true, $j$[
        {"chave":"achados","rotulo":"Achados da avaliação","tipo":"texto_longo","obrigatorio":true},
        {"chave":"contraindicacoes","rotulo":"Contraindicações identificadas","tipo":"texto_longo"},
        {"chave":"observacoes","rotulo":"Observações","tipo":"texto_longo"}
      ]$j$),
      ('avaliacao', 'Avaliação estética facial', 'Pele e face.', false, $j$[
        {"chave":"fototipo","rotulo":"Fototipo (Fitzpatrick)","tipo":"escolha","opcoes":[
          {"valor":"I","rotulo":"I"},{"valor":"II","rotulo":"II"},{"valor":"III","rotulo":"III"},
          {"valor":"IV","rotulo":"IV"},{"valor":"V","rotulo":"V"},{"valor":"VI","rotulo":"VI"}]},
        {"chave":"tipo_de_pele","rotulo":"Tipo de pele","tipo":"escolha","opcoes":[
          {"valor":"seca","rotulo":"Seca"},{"valor":"normal","rotulo":"Normal"},{"valor":"oleosa","rotulo":"Oleosa"},
          {"valor":"mista","rotulo":"Mista"},{"valor":"sensivel","rotulo":"Sensível"}]},
        {"chave":"achados","rotulo":"Achados","tipo":"multipla","opcoes":[
          {"valor":"acne","rotulo":"Acne"},{"valor":"manchas","rotulo":"Manchas"},{"valor":"rugas","rotulo":"Rugas e linhas"},
          {"valor":"flacidez","rotulo":"Flacidez"},{"valor":"poros","rotulo":"Poros dilatados"},{"valor":"cicatrizes","rotulo":"Cicatrizes"}]},
        {"chave":"descricao","rotulo":"Descrição da avaliação","tipo":"texto_longo","obrigatorio":true},
        {"chave":"contraindicacoes","rotulo":"Contraindicações identificadas","tipo":"texto_longo"},
        {"chave":"observacoes","rotulo":"Observações","tipo":"texto_longo"}
      ]$j$),
      ('avaliacao', 'Avaliação corporal', 'Regiões do corpo.', false, $j$[
        {"chave":"regioes","rotulo":"Regiões avaliadas","tipo":"multipla","opcoes":[
          {"valor":"abdomen","rotulo":"Abdômen"},{"valor":"flancos","rotulo":"Flancos"},{"valor":"coxas","rotulo":"Coxas"},
          {"valor":"gluteos","rotulo":"Glúteos"},{"valor":"bracos","rotulo":"Braços"},{"valor":"costas","rotulo":"Costas"}]},
        {"chave":"achados","rotulo":"Achados","tipo":"multipla","opcoes":[
          {"valor":"gordura_localizada","rotulo":"Gordura localizada"},{"valor":"flacidez","rotulo":"Flacidez"},
          {"valor":"celulite","rotulo":"Celulite"},{"valor":"estrias","rotulo":"Estrias"}]},
        {"chave":"peso_kg","rotulo":"Peso (kg)","tipo":"numero","min":0,"max":400},
        {"chave":"altura_cm","rotulo":"Altura (cm)","tipo":"numero","min":0,"max":260},
        {"chave":"descricao","rotulo":"Descrição da avaliação","tipo":"texto_longo","obrigatorio":true},
        {"chave":"contraindicacoes","rotulo":"Contraindicações identificadas","tipo":"texto_longo"},
        {"chave":"observacoes","rotulo":"Observações","tipo":"texto_longo"}
      ]$j$)
    ) as t(tipo, nome, descricao, padrao, campos)
  loop
    select id into v_id from public.clinic_modelos_formulario
     where organization_id = p_org and tipo = m.tipo and lower(btrim(nome)) = lower(m.nome);
    if v_id is null then
      insert into public.clinic_modelos_formulario (organization_id, tipo, nome, descricao, padrao)
      values (p_org, m.tipo, m.nome, m.descricao, m.padrao)
      returning id into v_id;
      insert into public.clinic_modelos_formulario_versoes (organization_id, modelo_id, numero, campos)
      values (p_org, v_id, 1, m.campos::jsonb);
    end if;
  end loop;
end $$;
revoke execute on function public.fn_clinic_semear_modelos(uuid) from public, anon, authenticated;

create or replace function public.fn_clinic_semear_modelos_org_nova()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_clinic_semear_modelos(new.id);
  return null;
end $$;
revoke execute on function public.fn_clinic_semear_modelos_org_nova() from public, anon, authenticated;

drop trigger if exists trg_clinic_semear_modelos on public.organizations;
create trigger trg_clinic_semear_modelos
  after insert on public.organizations
  for each row execute function public.fn_clinic_semear_modelos_org_nova();

do $$
declare o record;
begin
  for o in select id from public.organizations loop
    perform public.fn_clinic_semear_modelos(o.id);
  end loop;
end $$;

-- ─── salvar (autosave com versão) ──────────────────────────────────────────
create or replace function public.fn_clinic_salvar_formulario(
  p_org uuid,
  p_atendimento uuid,
  p_tipo text,
  p_modelo_versao uuid,
  p_respostas jsonb,
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
  if p_tipo is null or p_tipo not in ('anamnese', 'avaliacao') then
    raise exception 'formulario_tipo_invalido' using errcode = '22023';
  end if;
  if p_respostas is null or jsonb_typeof(p_respostas) <> 'object' or octet_length(p_respostas::text) > 65536 then
    raise exception 'formulario_respostas_invalidas' using errcode = '22023';
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

  if not exists (
    select 1 from public.clinic_modelos_formulario_versoes v
      join public.clinic_modelos_formulario m on m.organization_id = v.organization_id and m.id = v.modelo_id
     where v.id = p_modelo_versao and v.organization_id = p_org and m.tipo = p_tipo
  ) then
    raise exception 'formulario_modelo_invalido' using errcode = '22023';
  end if;

  select f.id, f.versao, f.status into v_atual
    from public.clinic_formularios_preenchidos f
   where f.organization_id = p_org and f.atendimento_id = p_atendimento and f.tipo = p_tipo
   for update;

  if not found then
    if coalesce(p_versao_esperada, 0) <> 0 then
      raise exception 'registro_conflito' using errcode = '40001';
    end if;
    insert into public.clinic_formularios_preenchidos
      (organization_id, atendimento_id, tipo, modelo_versao_id, respostas, created_by, updated_by)
    values (p_org, p_atendimento, p_tipo, p_modelo_versao, p_respostas, auth.uid(), auth.uid())
    returning id, versao into v_id, v_versao;
    return jsonb_build_object('id', v_id, 'versao', v_versao, 'criado', true);
  end if;

  if v_atual.status = 'finalizado' then
    raise exception 'prontuario_imutavel' using errcode = '55000';
  end if;
  if v_atual.versao is distinct from p_versao_esperada then
    raise exception 'registro_conflito' using errcode = '40001', detail = v_atual.versao::text;
  end if;

  update public.clinic_formularios_preenchidos
     set respostas = p_respostas, modelo_versao_id = p_modelo_versao,
         versao = versao + 1, updated_by = auth.uid()
   where id = v_atual.id
  returning versao into v_versao;
  return jsonb_build_object('id', v_atual.id, 'versao', v_versao, 'criado', false);
end $$;
revoke execute on function public.fn_clinic_salvar_formulario(uuid, uuid, text, uuid, jsonb, integer) from public, anon;
grant  execute on function public.fn_clinic_salvar_formulario(uuid, uuid, text, uuid, jsonb, integer) to authenticated;
