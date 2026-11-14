/**
 * Roteiro da CLÍNICA DE DEMONSTRAÇÃO — dados 100% fictícios para testar o
 * sistema pela tela (prontuário, agenda, estoque, NF-e, alertas, relatórios).
 *
 * NÃO é migration de propósito: migration roda em TODA instalação, inclusive
 * na produção, e criaria lá usuários com senha conhecida e pacientes falsos.
 * Este roteiro só roda quando alguém chama `scripts/seed-demo-clinica.ts`
 * (que se recusa a escrever em banco remoto sem confirmação explícita).
 *
 * Cada passo diz QUEM o executa:
 *   - "superuser"    cadastro de base (empresa, membros, salas, pacientes,
 *                    agenda) — dado de configuração, sem regra clínica;
 *   - "service_role" o que no sistema roda pelo servidor (baixa do estoque,
 *                    varredura de alertas);
 *   - um usuário     tudo o que tem regra de negócio (atendimento, prontuário,
 *                    estoque) passa pelas MESMAS funções da tela, com a
 *                    permissão daquela pessoa — se a regra recusar, o seed falha.
 *
 * Idempotente: ids fixos e `on conflict do nothing`; o bloco de atendimentos só
 * roda quando a empresa ainda não tem atendimento.
 *
 * Nada aqui é dado real: nomes terminam em "(fictício/a)", telefones são da
 * faixa +55 11 90000-0xxx e e-mails usam o domínio reservado `.test`.
 */

export const ORG_DEMO = "de000000-0000-4000-8000-000000000001";
export const SLUG_DEMO = "clinica-demo";

/** Quem é quem na clínica de demonstração. */
export interface PessoaDemo {
  chave: string;
  email: string;
  nome: string;
  /** papel na empresa (user_organizations.role) */
  papel: "admin" | "manager" | "agent";
  /** o que a pessoa faz — vai para a tabela de credenciais */
  funcao: string;
  /** conselho, quando é profissional de saúde */
  conselho?: { sigla: "CRM" | "CRO" | "CRBM" | "COREN"; numero: string; uf: string };
  /** o que deve ver/fazer — para quem testa saber o que esperar */
  acesso: string;
}

export const PESSOAS_DEMO: readonly PessoaDemo[] = [
  {
    chave: "dono",
    email: "dono@clinica-demo.test",
    nome: "Rafael Dono (fictício)",
    papel: "admin",
    funcao: "Administrador / dono",
    acesso: "Configura tudo (equipe, agenda, estoque, IA). NÃO vê prontuário: não tem papel clínico.",
  },
  {
    chave: "ana",
    email: "dra.ana@clinica-demo.test",
    nome: "Dra. Ana Médica (fictícia)",
    papel: "manager",
    funcao: "Médica dermatologista — coordenação clínica",
    conselho: { sigla: "CRM", numero: "000001", uf: "SP" },
    acesso: "Atende, vê e escreve prontuário, reabre atendimento, faz o rastreio de lote (recall) e configura estoque.",
  },
  {
    chave: "bruno",
    email: "dr.bruno@clinica-demo.test",
    nome: "Dr. Bruno Dentista (fictício)",
    papel: "agent",
    funcao: "Cirurgião-dentista — harmonização orofacial",
    conselho: { sigla: "CRO", numero: "000002", uf: "SP" },
    acesso: "Atende e escreve prontuário dos próprios atendimentos; vê o estoque.",
  },
  {
    chave: "carla",
    email: "carla.biomedica@clinica-demo.test",
    nome: "Carla Biomédica (fictícia)",
    papel: "agent",
    funcao: "Biomédica esteta",
    conselho: { sigla: "CRBM", numero: "000003", uf: "SP" },
    acesso: "Atende e escreve prontuário; vê o estoque.",
  },
  {
    chave: "diego",
    email: "diego.enfermeiro@clinica-demo.test",
    nome: "Diego Enfermeiro (fictício)",
    papel: "agent",
    funcao: "Enfermeiro (estética)",
    conselho: { sigla: "COREN", numero: "000004", uf: "SP" },
    acesso: "Atende e escreve prontuário. A toxina é controlada (CRM/CRO): se ele aplicar, a baixa abre pendência de habilitação.",
  },
  {
    chave: "recepcao",
    email: "recepcao@clinica-demo.test",
    nome: "Beatriz Recepção (fictícia)",
    papel: "agent",
    funcao: "Recepcionista",
    acesso: "Agenda, chegada do paciente, documentos. NÃO vê anamnese, evolução nem fotos.",
  },
  {
    chave: "compras",
    email: "compras@clinica-demo.test",
    nome: "Marcos Estoque (fictício)",
    papel: "manager",
    funcao: "Gestor de estoque e compras",
    acesso: "Entradas, NF-e, inventário, custos e relatórios do estoque. NÃO vê prontuário.",
  },
];

export type IdsDasPessoas = Record<(typeof PESSOAS_DEMO)[number]["chave"], string>;

export interface PassoDoRoteiro {
  titulo: string;
  ator: "superuser" | "service_role" | string;
  sql: string;
}

// ids fixos por grupo (01 = produto, 02 = paciente, …)
const id = (grupo: number, n: number) =>
  `de000000-${String(grupo).padStart(4, "0")}-4000-8000-${String(n).padStart(12, "0")}`;

const ESP = { derma: id(1, 1), hof: id(1, 2), facial: id(1, 3), enf: id(1, 4) };
const SALA = { um: id(2, 1), dois: id(2, 2) };
const TIPO = { avaliacao: id(3, 1), toxina: id(3, 2), preenchimento: id(3, 3), limpeza: id(3, 4) };
const PROC = { toxina: id(4, 1), preenchimento: id(4, 2), limpeza: id(4, 3) };
const PROD = {
  toxina: id(5, 1),
  acido: id(5, 2),
  agulha: id(5, 3),
  luva: id(5, 4),
  gaze: id(5, 5),
  anestesico: id(5, 6),
  mascara: id(5, 7),
};
const PAC = Array.from({ length: 8 }, (_, i) => id(6, i + 1));
const AG = Array.from({ length: 10 }, (_, i) => id(7, i + 1));

const PACIENTES = [
  "Ana Paula Teste (fictícia)",
  "Bruna Exemplo (fictícia)",
  "Camila Demonstração (fictícia)",
  "Daniel Simulado (fictício)",
  "Eduarda Modelo (fictícia)",
  "Fernanda Ficção (fictícia)",
  "Gabriel Protótipo (fictício)",
  "Helena Ensaio (fictícia)",
];

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const j = (o: unknown) => `${q(JSON.stringify(o))}::jsonb`;

export function roteiroDemo(p: IdsDasPessoas): PassoDoRoteiro[] {
  const O = q(ORG_DEMO);
  const profissionais = PESSOAS_DEMO.filter((x) => x.conselho);

  const base: PassoDoRoteiro = {
    titulo: "empresa, equipe, salas, serviços, procedimentos e pacientes",
    ator: "superuser",
    sql: `
      insert into public.organizations (id, slug, legal_name, display_name, timezone, locale, onboarded_at, settings)
      values (${O}, ${q(SLUG_DEMO)}, 'Clínica Demonstração Estética LTDA (fictícia)', 'Clínica Demo',
              'America/Sao_Paulo', 'pt-BR', now(), '{"clinic":{"prontuario":true}}'::jsonb)
      on conflict (id) do nothing;

      insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ${PESSOAS_DEMO.map((x) => `(${q(p[x.chave]!)}, ${O}, ${q(x.papel)}, now())`).join(",\n      ")}
      on conflict do nothing;

      insert into public.clinic_specialties (id, organization_id, name) values
        (${q(ESP.derma)}, ${O}, 'Dermatologia estética'), (${q(ESP.hof)}, ${O}, 'Harmonização orofacial'),
        (${q(ESP.facial)}, ${O}, 'Estética facial'), (${q(ESP.enf)}, ${O}, 'Enfermagem estética')
      on conflict (id) do nothing;

      insert into public.clinic_professionals (organization_id, user_id, display_name, council, council_number, council_uf) values
      ${profissionais
        .map((x) => `(${O}, ${q(p[x.chave]!)}, ${q(x.nome)}, ${q(x.conselho!.sigla)}, ${q(x.conselho!.numero)}, ${q(x.conselho!.uf)})`)
        .join(",\n      ")}
      on conflict do nothing;

      insert into public.clinic_professional_specialties (organization_id, professional_id, specialty_id)
      select cp.organization_id, cp.id, e.esp::uuid
        from public.clinic_professionals cp
        join (values (${q(p.ana!)}, ${q(ESP.derma)}), (${q(p.bruno!)}, ${q(ESP.hof)}),
                     (${q(p.carla!)}, ${q(ESP.facial)}), (${q(p.diego!)}, ${q(ESP.enf)})) as e(u, esp)
          on cp.user_id = e.u::uuid
       where cp.organization_id = ${O}
      on conflict do nothing;

      insert into public.clinic_resources (id, organization_id, name, category) values
        (${q(SALA.um)}, ${O}, 'Sala 1', 'Sala'), (${q(SALA.dois)}, ${O}, 'Sala 2', 'Sala')
      on conflict (id) do nothing;

      insert into public.calendar_event_types (id, organization_id, name, slug, category, duration_minutes) values
        (${q(TIPO.avaliacao)}, ${O}, 'Consulta de avaliação', 'demo-avaliacao', 'consulta', 30),
        (${q(TIPO.toxina)}, ${O}, 'Toxina botulínica', 'demo-toxina', 'procedimento', 45),
        (${q(TIPO.preenchimento)}, ${O}, 'Preenchimento labial', 'demo-preenchimento', 'procedimento', 60),
        (${q(TIPO.limpeza)}, ${O}, 'Limpeza de pele', 'demo-limpeza', 'procedimento', 60)
      on conflict (id) do nothing;

      insert into public.clinic_procedures (id, organization_id, name, short_description) values
        (${q(PROC.toxina)}, ${O}, 'Toxina botulínica', 'Aplicação de toxina para rugas de expressão (demonstração)'),
        (${q(PROC.preenchimento)}, ${O}, 'Preenchimento com ácido hialurônico', 'Preenchimento labial (demonstração)'),
        (${q(PROC.limpeza)}, ${O}, 'Limpeza de pele profunda', 'Higienização e extração (demonstração)')
      on conflict (id) do nothing;

      insert into public.catalog_products (id, organization_id, codigo, nome, preco_cents) values
        (${q(PROD.toxina)}, ${O}, 'DEMO-TOX100', 'Toxina botulínica 100U (fictícia)', 0),
        (${q(PROD.acido)}, ${O}, 'DEMO-AH1ML', 'Ácido hialurônico 1 mL (fictício)', 0),
        (${q(PROD.agulha)}, ${O}, 'DEMO-AG30G', 'Agulha 30G (fictícia)', 0),
        (${q(PROD.luva)}, ${O}, 'DEMO-LUVA', 'Luva nitrílica (fictícia)', 0),
        (${q(PROD.gaze)}, ${O}, 'DEMO-GAZE', 'Gaze estéril (fictícia)', 0),
        (${q(PROD.anestesico)}, ${O}, 'DEMO-ANEST', 'Anestésico tópico (fictício)', 0),
        (${q(PROD.mascara)}, ${O}, 'DEMO-MASC', 'Máscara facial calmante (fictícia)', 0)
      on conflict (id) do nothing;

      insert into public.contacts (id, organization_id, name, phone_number) values
      ${PAC.map((pid, i) => `(${q(pid)}, ${O}, ${q(PACIENTES[i]!)}, ${q(`+551190000${String(i + 1).padStart(4, "0")}`)})`).join(",\n      ")}
      on conflict (id) do nothing;
    `,
  };

  const estoque: PassoDoRoteiro[] = [
    {
      titulo: "ligar o estoque",
      ator: p.dono!,
      sql: `select public.fn_clinic_definir_estoque(${O}, true);`,
    },
    {
      titulo: "local da Sala 1, produtos do estoque e entradas com lote",
      ator: p.compras!,
      sql: `
        do $demo$
        declare
          v_central uuid;
          v_carrinho uuid;
          v_lote uuid;
          v_qtd numeric;
        begin
          select l.id into v_central from public.clinic_estoque_locais l where l.organization_id = ${O} and l.padrao;
          if not exists (select 1 from public.clinic_estoque_locais l where l.organization_id = ${O} and l.resource_id = ${q(SALA.um)}) then
            perform public.fn_clinic_estoque_local_salvar(${O}, null, ${j({ nome: "Carrinho da Sala 1", tipo: "carrinho", resource_id: SALA.um })});
          end if;

          perform public.fn_clinic_estoque_produto_salvar(${O}, ${q(PROD.toxina)}, ${j({
            unidade_estoque: "frasco", unidade_aplicacao: "U", fator_conversao: 100, fracionavel: true,
            validade_pos_abertura_horas: 24, rastreado: true, controlado: true, conselhos_permitidos: ["CRM", "CRO"],
            estoque_minimo: 100, ponto_pedido: 200, registro_anvisa: "1.0000.0000.000-0", gerenciado: true,
          })}, null);
          perform public.fn_clinic_estoque_produto_salvar(${O}, ${q(PROD.acido)}, ${j({
            unidade_estoque: "seringa", unidade_aplicacao: "un", fator_conversao: 1, rastreado: true,
            estoque_minimo: 2, ponto_pedido: 4, gerenciado: true,
          })}, null);
          perform public.fn_clinic_estoque_produto_salvar(${O}, ${q(PROD.agulha)}, ${j({
            unidade_estoque: "cx", unidade_aplicacao: "un", fator_conversao: 100, estoque_minimo: 50, gerenciado: true,
          })}, null);
          perform public.fn_clinic_estoque_produto_salvar(${O}, ${q(PROD.luva)}, ${j({
            unidade_estoque: "cx", unidade_aplicacao: "un", fator_conversao: 100, estoque_minimo: 50, ponto_pedido: 150, gerenciado: true,
          })}, null);
          perform public.fn_clinic_estoque_produto_salvar(${O}, ${q(PROD.gaze)}, ${j({
            unidade_estoque: "pct", unidade_aplicacao: "un", fator_conversao: 10, gerenciado: true,
          })}, null);
          perform public.fn_clinic_estoque_produto_salvar(${O}, ${q(PROD.anestesico)}, ${j({
            unidade_estoque: "bisnaga", unidade_aplicacao: "g", fator_conversao: 30, rastreado: true, gerenciado: true,
          })}, null);
          perform public.fn_clinic_estoque_produto_salvar(${O}, ${q(PROD.mascara)}, ${j({
            unidade_estoque: "un", unidade_aplicacao: "un", fator_conversao: 1, estoque_minimo: 5, gerenciado: true,
          })}, null);

          -- só dá entrada na primeira vez (estoque = soma dos movimentos)
          if not exists (select 1 from public.clinic_estoque_movimentos m where m.organization_id = ${O}) then
            perform public.fn_clinic_estoque_entrada(${O}, jsonb_build_object('product_id', ${q(PROD.toxina)}, 'local_id', v_central,
              'quantidade', 3, 'em_unidade_estoque', true, 'lote', 'TX-2401', 'validade', '2027-06-30', 'custo_unitario_cents', 90000));
            -- lote que vence em 25 dias: aparece em "Validade próxima"
            perform public.fn_clinic_estoque_entrada(${O}, jsonb_build_object('product_id', ${q(PROD.toxina)}, 'local_id', v_central,
              'quantidade', 1, 'em_unidade_estoque', true, 'lote', 'TX-2312', 'validade', (current_date + 25)::text, 'custo_unitario_cents', 85000));
            perform public.fn_clinic_estoque_entrada(${O}, jsonb_build_object('product_id', ${q(PROD.acido)}, 'local_id', v_central,
              'quantidade', 5, 'em_unidade_estoque', true, 'lote', 'AH-778', 'validade', '2027-12-31', 'custo_unitario_cents', 45000));
            perform public.fn_clinic_estoque_entrada(${O}, jsonb_build_object('product_id', ${q(PROD.agulha)}, 'local_id', v_central,
              'quantidade', 2, 'em_unidade_estoque', true, 'custo_unitario_cents', 3000));
            -- luva abaixo do ponto de pedido: aparece em "Sugestão de compra"
            perform public.fn_clinic_estoque_entrada(${O}, jsonb_build_object('product_id', ${q(PROD.luva)}, 'local_id', v_central,
              'quantidade', 1, 'em_unidade_estoque', true, 'custo_unitario_cents', 4500));
            perform public.fn_clinic_estoque_entrada(${O}, jsonb_build_object('product_id', ${q(PROD.gaze)}, 'local_id', v_central,
              'quantidade', 20, 'em_unidade_estoque', true, 'custo_unitario_cents', 800));
            perform public.fn_clinic_estoque_entrada(${O}, jsonb_build_object('product_id', ${q(PROD.anestesico)}, 'local_id', v_central,
              'quantidade', 2, 'em_unidade_estoque', true, 'lote', 'AN-55', 'validade', '2027-03-31', 'custo_unitario_cents', 6000));
            perform public.fn_clinic_estoque_entrada(${O}, jsonb_build_object('product_id', ${q(PROD.mascara)}, 'local_id', v_central,
              'quantidade', 12, 'custo_unitario_cents', 1200));

            -- abastece o carrinho da Sala 1 (onde a Dra. Ana atende): 1 frasco, agulhas e luvas
            select l.id into v_carrinho from public.clinic_estoque_locais l
             where l.organization_id = ${O} and l.resource_id = ${q(SALA.um)};
            for v_lote, v_qtd in
              select l.id, x.qtd from public.clinic_estoque_lotes l
                join (values (${q(PROD.toxina)}::uuid, 'TX-2401', 100), (${q(PROD.agulha)}::uuid, '', 20),
                             (${q(PROD.luva)}::uuid, '', 10)) as x(prod, codigo, qtd)
                  on l.product_id = x.prod and coalesce(l.codigo, '') = x.codigo
               where l.organization_id = ${O}
            loop
              perform public.fn_clinic_estoque_transferir(${O}, jsonb_build_object(
                'lote_id', v_lote, 'origem_id', v_central, 'destino_id', v_carrinho, 'quantidade', v_qtd));
            end loop;
          end if;
        end
        $demo$;
      `,
    },
    {
      titulo: "kits dos procedimentos",
      ator: p.dono!,
      sql: `
        select public.fn_clinic_estoque_kit_salvar(${O}, ${q(PROC.toxina)}, ${j([
          { product_id: PROD.toxina, quantidade: 20 },
          { product_id: PROD.agulha, quantidade: 2 },
          { product_id: PROD.luva, quantidade: 2 },
          { product_id: PROD.gaze, quantidade: 2 },
        ])});
        select public.fn_clinic_estoque_kit_salvar(${O}, ${q(PROC.preenchimento)}, ${j([
          { product_id: PROD.acido, quantidade: 1 },
          { product_id: PROD.anestesico, quantidade: 2 },
          { product_id: PROD.agulha, quantidade: 1 },
          { product_id: PROD.luva, quantidade: 2 },
        ])});
        select public.fn_clinic_estoque_kit_salvar(${O}, ${q(PROC.limpeza)}, ${j([
          { product_id: PROD.luva, quantidade: 2 },
          { product_id: PROD.gaze, quantidade: 4 },
          { product_id: PROD.mascara, quantidade: 1 },
        ])});
      `,
    },
  ];

  // agenda: 4 atendimentos já realizados (ontem) + compromissos de hoje e amanhã
  const agenda = [
    { ag: AG[0]!, pac: PAC[0]!, prof: p.ana!, tipo: TIPO.toxina, titulo: "Toxina botulínica", quando: "now() - interval '1 day' - interval '3 hours'" },
    { ag: AG[1]!, pac: PAC[1]!, prof: p.bruno!, tipo: TIPO.preenchimento, titulo: "Preenchimento labial", quando: "now() - interval '1 day' - interval '2 hours'" },
    { ag: AG[2]!, pac: PAC[2]!, prof: p.carla!, tipo: TIPO.limpeza, titulo: "Limpeza de pele", quando: "now() - interval '1 day' - interval '1 hour'" },
    { ag: AG[3]!, pac: PAC[3]!, prof: p.diego!, tipo: TIPO.toxina, titulo: "Toxina botulínica", quando: "now() - interval '1 day'" },
    { ag: AG[4]!, pac: PAC[4]!, prof: p.ana!, tipo: TIPO.avaliacao, titulo: "Consulta de avaliação", quando: "date_trunc('hour', now()) + interval '1 hour'" },
    { ag: AG[5]!, pac: PAC[5]!, prof: p.bruno!, tipo: TIPO.preenchimento, titulo: "Preenchimento labial", quando: "date_trunc('hour', now()) + interval '2 hours'" },
    { ag: AG[6]!, pac: PAC[6]!, prof: p.carla!, tipo: TIPO.limpeza, titulo: "Limpeza de pele", quando: "date_trunc('hour', now()) + interval '3 hours'" },
    { ag: AG[7]!, pac: PAC[7]!, prof: p.ana!, tipo: TIPO.toxina, titulo: "Toxina botulínica", quando: "date_trunc('day', now()) + interval '1 day' + interval '9 hours'" },
    { ag: AG[8]!, pac: PAC[0]!, prof: p.ana!, tipo: TIPO.avaliacao, titulo: "Retorno da toxina", quando: "date_trunc('day', now()) + interval '15 days' + interval '10 hours'" },
    { ag: AG[9]!, pac: PAC[1]!, prof: p.diego!, tipo: TIPO.avaliacao, titulo: "Consulta de avaliação", quando: "date_trunc('day', now()) + interval '1 day' + interval '14 hours'" },
  ];
  const agendaPasso: PassoDoRoteiro = {
    titulo: "agenda (realizados ontem, hoje e próximos dias)",
    ator: "superuser",
    sql: `
      insert into public.calendar_appointments (id, organization_id, event_type_id, title, starts_at, ends_at, owner_user_id, contact_id, status) values
      ${agenda
        .map(
          (a) =>
            `(${q(a.ag)}, ${O}, ${q(a.tipo)}, ${q(a.titulo)}, ${a.quando}, ${a.quando} + interval '45 minutes', ${q(a.prof)}, ${q(a.pac)}, 'confirmed')`,
        )
        .join(",\n      ")}
      on conflict (id) do nothing;
      insert into public.clinic_appointment_resources (organization_id, appointment_id, resource_id, starts_at, ends_at)
      select a.organization_id, a.id, ${q(SALA.um)}, a.starts_at, a.ends_at
        from public.calendar_appointments a
       where a.organization_id = ${O} and a.owner_user_id = ${q(p.ana!)}
         and not exists (select 1 from public.clinic_appointment_resources r where r.appointment_id = a.id);
    `,
  };

  // os 4 atendimentos realizados: cada profissional registra e finaliza o SEU
  const realizado = (
    prof: string,
    ag: string,
    proc: string,
    descricao: string,
    insumos: unknown[],
    evolucao: string,
  ): PassoDoRoteiro => ({
    titulo: `atendimento realizado: ${descricao}`,
    ator: prof,
    sql: `
      do $demo$
      declare
        v_at uuid;
      begin
        if exists (select 1 from public.clinic_atendimentos a where a.organization_id = ${O} and a.appointment_id = ${q(ag)}) then
          return;
        end if;
        v_at := (public.fn_clinic_iniciar_atendimento(${O}, ${q(ag)}) ->> 'id')::uuid;
        perform public.fn_clinic_procedimento_salvar(${O}, v_at, null,
          ${j({ procedure_id: proc, descricao, regiao: "Face" })}, ${j(insumos)}, 0);
        perform public.fn_clinic_salvar_evolucao(${O}, v_at, ${q(evolucao)}, 'Paciente fictício de demonstração.',
          null, 'Evitar sol e atividade física intensa por 24 h.', 'Retorno em 15 dias.', 0);
        perform public.fn_clinic_finalizar_atendimento(${O}, v_at);
      end
      $demo$;
    `,
  });

  const atendimentos: PassoDoRoteiro[] = [
    realizado(p.ana!, AG[0]!, PROC.toxina, "Toxina botulínica — testa e glabela", [
      { descricao: "Toxina botulínica", quantidade: 20, unidade: "U", product_id: PROD.toxina, lote: "TX-2401", validade: "2027-06-30" },
      { descricao: "Agulha 30G", quantidade: 2, unidade: "un", product_id: PROD.agulha },
      { descricao: "Luva", quantidade: 2, unidade: "un", product_id: PROD.luva },
    ], "Aplicação sem intercorrências."),
    realizado(p.bruno!, AG[1]!, PROC.preenchimento, "Preenchimento labial", [
      { descricao: "Ácido hialurônico", quantidade: 1, unidade: "un", product_id: PROD.acido, lote: "AH-778", validade: "2027-12-31" },
      { descricao: "Anestésico tópico", quantidade: 2, unidade: "g", product_id: PROD.anestesico, lote: "AN-55", validade: "2027-03-31" },
      { descricao: "Luva", quantidade: 2, unidade: "un", product_id: PROD.luva },
    ], "Boa resposta imediata; edema leve esperado."),
    realizado(p.carla!, AG[2]!, PROC.limpeza, "Limpeza de pele profunda", [
      { descricao: "Gaze", quantidade: 4, unidade: "un", product_id: PROD.gaze },
      { descricao: "Máscara calmante", quantidade: 1, unidade: "un", product_id: PROD.mascara },
      { descricao: "Algodão avulso", quantidade: 1, unidade: "un" },
    ], "Pele higienizada; leve eritema ao final."),
    // enfermeiro aplicando produto controlado (CRM/CRO): baixa + pendência de habilitação
    realizado(p.diego!, AG[3]!, PROC.toxina, "Toxina botulínica — linhas periorbitais", [
      { descricao: "Toxina botulínica", quantidade: 10, unidade: "U", product_id: PROD.toxina, lote: "TX-2401", validade: "2027-06-30" },
    ], "Aplicação sem intercorrências."),
    {
      titulo: "baixa do estoque dos procedimentos finalizados e alertas",
      ator: "service_role",
      sql: `
        select public.fn_clinic_estoque_baixar_procedimento(${O}, pr.id)
          from public.clinic_procedimentos_realizados pr
         where pr.organization_id = ${O} and pr.status = 'finalizado';
        select public.fn_clinic_estoque_varrer_alertas();
      `,
    },
  ];

  return [base, ...estoque, agendaPasso, ...atendimentos];
}

/**
 * O SQL de um passo com o papel de quem o executa. Usuário = papel
 * `authenticated` com o JWT dele (é assim que a RLS e o `auth.uid()` o veem).
 * Roda numa transação de uma conexão só para aquele passo.
 */
export function scriptDoPasso(passo: PassoDoRoteiro): string {
  const corpo = passo.sql.trim();
  if (passo.ator === "superuser") return `begin;\n${corpo}\ncommit;`;
  if (passo.ator === "service_role") return `begin;\nset local role service_role;\n${corpo}\ncommit;`;
  if (!/^[0-9a-f-]{36}$/.test(passo.ator)) throw new Error(`ator inválido no passo "${passo.titulo}"`);
  const claims = JSON.stringify({ sub: passo.ator, role: "authenticated" });
  return `begin;\nset local role authenticated;\nselect set_config('request.jwt.claims', '${claims}', true);\n${corpo}\ncommit;`;
}
