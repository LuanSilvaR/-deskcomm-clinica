# Agenda da clínica — plano completo (S1 e S4 prontas · próxima: S5 Experiência do profissional)

## Context
Refatoração da Agenda do SaaS de clínicas. Já implementado na branch `feature/agenda-por-profissional`
(sem commit): **S1** um profissional por vez (seletor, URL, memória, grade do profissional,
`agenda.ver_outros` — migration 9042) e **S4** fluxo recepção → profissional (status único, 1ª vez,
recepção até "pronto", iniciar/finalizar só pelo dono, reabrir pelo dono no mesmo dia, histórico do
agendamento, visita sem escrita direta — migration 9043).

O dono pediu agora a **experiência do perfil Profissional** (documento "Complementação — Experiência
do Perfil Profissional", PF01–PF22): ao entrar, o profissional vê só o que é do trabalho clínico (Meu
Dia, Minha Agenda, Pacientes, Prontuários, Documentos, Meu Perfil), executa ver agenda → paciente
pronto → iniciar → prontuário → finalizar → complementar só no mesmo dia → depois somente leitura, e
bloqueia a própria agenda. Regra em interface, menu, rotas, backend, ACL e ownership.

A exploração mostrou o que já existe e o que falta:
- já existe: fila "Meus atendimentos" (`/app/atendimentos`, filtra o dono; iniciar já leva a
  `/app/atendimentos/{id}`), regras de dono no banco (9043), menu filtrado por permissão no modo por
  papéis (`lib/navigation/interface.ts` `permitidos`, `lib/clinic/acesso/menu.ts`), guardas de página
  (`exigePermissaoNaPagina`), bloqueios (`/api/v1/clinic/bloqueios`, `components/clinic/Bloqueios.tsx`);
- falta / está errado: não há "Meu Dia"; a tela inicial é o painel da recepção para todos; o menu de
  um profissional (papel feito a partir do `atendente`) tem Inbox, CRM, Financeiro, Estoque etc.;
  `homeDaInterface` ignora permissões; várias páginas administrativas não têm guarda (comandas,
  faturamento, produtos, equipe, tarefas, funis, inbox, extensões…); **a rota de reabrir exige
  `atendimento.reabrir` e impede o "complementar" do dono que o banco já aceita**; finalizar não tem
  confirmação nem destaque; reabrir/anular usam `window.prompt`; "Finalizado por" não aparece
  (reabrir apaga `finalizado_por`); o detalhe da agenda oferece "Iniciar atendimento" que falha com
  prontuário ligado; não há aviso de atendimento em andamento; bloqueio não confere conflito e não
  tem tipo; **qualquer profissional vê todos os pacientes e o prontuário dos colegas** (RLS só por
  `prontuario.ver`), e adendo não tem dono.

Decisões do dono: pacientes e prontuário **só os próprios, com exceção por permissão**; papel de
sistema **"Profissional de saúde"** (menu e tela inicial saem das permissões, sem `if` de perfil);
implementar **S5 agora**. Mantidas as anteriores (procedimentos em tabela sem somar duração; encaixe
só para sobreposição com permissão; início/fim só pelo profissional, sempre).

Regras do repo: migration tripla (próxima **9044**), função nova com `revoke … from public, anon`,
Zod, `ok()/fail()`, i18n com espanhol, core tocado → `UPSTREAM.md`, aditivo (nada renomeado),
prontuário assinado é imutável (correção por adendo), gate lint + tipos + unit + test:db + tela.

---

## Sprint 5 — Experiência do profissional (a implementar agora)

### 5.1 Papel "Profissional de saúde" e chaves novas (migration 9044)
- Chaves novas no catálogo (`lib/clinic/acesso/catalogo.ts`) + `clinic_permissions`:
  - `pacientes.ver_todos` (viewer; sem ela, só pacientes com agendamento com a própria pessoa);
  - `prontuario.ver_outros` (clínica; sem ela, só o prontuário dos próprios atendimentos).
  Concedidas aos papéis de sistema existentes e aos personalizados que já veem pacientes/prontuário
  (ninguém perde o que vê hoje — mesmo padrão da 9042); coordenação clínica fica com as duas.
- Papel de sistema novo `profissional` ("Profissional de saúde"), criado em cada organização e no
  provisionamento de organização nova (`fn_acesso_provisionar_org`, nova versão em migration nova),
  com: `agenda.ver`, `agenda.bloquear_horario`, `atendimento.ver_fila/iniciar/registrar/finalizar`,
  `prontuario.ver/adendo`, `planos.ver/gerenciar`, `fotos.*`, `anexos.*`, `documentos.ver/emitir/colher_aceite`,
  `pacientes.ver/ver_ficha`, `procedimentos.ver`, `pops.ver/imprimir`. **Sem** `agenda.ver_outros`,
  `pacientes.ver_todos`, `prontuario.ver_outros`, conversas, CRM, financeiro, estoque, IA, configurações.
- Atribuição: ao cadastrar/ativar um profissional com o modo por papéis ligado, ele ganha o papel
  `profissional` (trigger em `clinic_professionals`, sem tirar papéis que o admin deu). A tela Papéis
  de acesso já permite ajustar. Modo legado: o comportamento atual continua (documentado).

### 5.2 Escopo: pacientes e prontuário só os próprios
- **Prontuário (banco):** função `fn_clinic_pode_ver_atendimento(org, atendimento)` (security definer,
  estável) = `professional_user_id = auth.uid()` ou dono do agendamento ou `prontuario.ver_outros`.
  Política RESTRITIVA de leitura nas tabelas do prontuário (`clinic_atendimentos`, `_eventos`,
  `clinic_formularios_preenchidos`, `clinic_evolucoes`, `clinic_condutas`, `clinic_procedimentos_realizados`,
  `clinic_procedimento_insumos`, `clinic_adendos`, `clinic_documentos_emitidos`/`clinic_anexos` quando
  ligados a atendimento) — chamada envolvida em `(select …)` por organização para não repetir o custo
  por linha (débito de desempenho conhecido).
- **Pacientes (API):** `GET /api/v1/contacts` e `GET /api/v1/contacts/[id]` (core), `agenda/vinculos`,
  `clinic/pacientes/*` e a página `/app/contacts/[id]`: sem `pacientes.ver_todos`, só contatos com
  agendamento cujo dono é quem pede (helper novo no molde de `lib/clinic/agenda/escopo-no-servidor.ts`);
  fora disso, 404. RLS de `contacts` fica a do núcleo (Inbox/IA leem ali) — limite registrado.
- Adendo: só o profissional do atendimento ou quem tem `prontuario.ver_outros` + `prontuario.adendo`.

### 5.3 Menu e rotas por permissão
- Catálogo (`lib/navigation/catalogo.ts`): toda porta ganha `permissao` (hoje sem: `/app/activities`,
  `/app/calls`, `/app/ads/meta`, `/app/prospecting`, `settings/meta-ads|billing|voip-trunk`); porta nova
  **"Meu dia"** (`/app/meu-dia`, `atendimento.iniciar`) no módulo Início/Atendimento; "Agenda" aparece
  como **"Minha agenda"** para quem não tem `agenda.ver_outros`. Módulos "Em breve" só para quem tem
  `configuracoes.ver`.
- Tela inicial por capacidade: `homeDaInterface` (`lib/navigation/interface.ts`) recebe as permissões;
  quem tem `atendimento.iniciar` e não tem `recepcao.mudar_status_visita` cai em `/app/meu-dia`.
  `/app/inicio` faz o mesmo desvio. Sem `if role == …`.
- Guardas de página que faltam (`exigePermissaoNaPagina`): comandas/faturamento/produtos
  (`financeiro.ver`/`produtos.ver`), `settings/tenant/financeiro`, equipe (`equipe.ver`), tarefas, funis
  (`crm.ver`), inbox/radar (`conversas.ver`), métricas (`relatorios.ver`), extensões, `settings/tenant/agenda`
  (`agenda.configurar`), `settings/tenant/profissionais` (cadastro só com `profissionais.ver`; o
  profissional bloqueia pela agenda). APIs do núcleo mais expostas (comandas, lançamentos, produtos)
  passam a exigir a chave além do papel. Registrar no `UPSTREAM.md`.

### 5.4 Meu Dia (`/app/meu-dia`)
- Página nova, cliente sobre `GET /api/v1/clinic/atendimentos/fila` (já filtra o dono; estender com
  `primeira_vez`, `finalizado_por`, `finalizado_em`, `procedimento`) + tempo real das visitas
  (padrão de `app/app/atendimentos/_client.tsx`).
- Topo: contadores só da própria agenda (pacientes do dia, aguardando, pronto, em atendimento,
  finalizados). Destaque **"Próximo paciente"** com o CTA principal "Iniciar atendimento" quando pronto.
  Cartão **"Atendimento em andamento"** (paciente, iniciado às, "Continuar" e "Finalizar").
  Lista do dia com status (texto + ícone), "Pronto" destacado, "Em recepção" sem ação clínica.
  Atalhos: Minha agenda (dia), amanhã, semana.
- A fila `/app/atendimentos` continua (é a mesma informação em colunas).

### 5.5 Do pronto ao prontuário (PF08–PF11)
- Detalhe da agenda (`components/clinic/VisitaDoPaciente.tsx`): com prontuário ligado, "Iniciar
  atendimento" chama `POST /api/v1/clinic/agendamentos/{id}/atendimento` e navega para
  `/app/atendimentos/{id}`; com atendimento aberto, "Abrir atendimento". Mesmo comportamento no Meu Dia.
- Aviso global **"Atendimento em andamento"** (AppShell) para o profissional com atendimento aberto
  (link para continuar), lido da fila.
- Especialidade: enviar a do profissional quando houver mais de uma compatível (hoje vai vazia).

### 5.6 Finalizar, complementar, somente leitura (PF12–PF17)
- `app/app/atendimentos/[id]/_client.tsx`: botão **Finalizar atendimento** fixo e destacado; diálogo de
  confirmação ("Depois de finalizado, só você poderá complementar, até o fim de hoje.").
- **Complementar** = reabrir + finalizar de novo (o que foi congelado continua imutável; só se acrescenta
  — regra do prontuário assinado). Rota `atendimentos/[id]/reabrir`: passa a exigir `atendimento.finalizar`
  (o banco decide dono + mesmo dia, 9043); flags novas `pode_complementar` (dono e mesmo dia) e
  `pode_reabrir` (gerência). Diálogos no lugar de `window.prompt` para reabrir/anular.
- Somente leitura no dia seguinte: faixa "Atendimento finalizado — bloqueado para edição · Finalizado por
  X em DD/MM às HH:MM", lida do último evento `finalizado` em `clinic_atendimento_eventos` (o reabrir
  apaga `finalizado_por`; a tabela de eventos guarda) — rota do atendimento devolve isso.
- Auditoria pós-finalização: evento `reaberto` com motivo (já existe) + auditoria
  `clinic.atendimento_complementado`; tipo de evento novo não é preciso.

### 5.7 Bloqueio da própria agenda (PF18–PF19)
- Botão "Bloquear horário" em Minha agenda e no clique de horário (prefill data/hora), diálogo reaproveitando
  o formulário de `components/clinic/Bloqueios.tsx` (extrair `FormularioDeBloqueio`).
- `clinic_agenda_blocks.tipo` (coluna nova, aditiva: `almoco|reuniao|pessoal|indisponivel|outro`) e a
  grade mostra o tipo. `POST /api/v1/clinic/bloqueios`: antes de gravar, se houver agendamento
  `pending/confirmed` do profissional na faixa → 409 `bloqueio_com_agendamento` listando paciente e horário.

### 5.8 Demonstração e verificação
- Seed: Bruno, Carla e Diego com "Profissional de saúde"; Ana com coordenação (ver outros, prontuário
  dos outros); recepção com `pacientes.ver_todos`.
- Unit: home por capacidade, porta "Minha agenda", escopo de pacientes, flags `pode_complementar`,
  conflito de bloqueio. Sabotagem da regra de escopo.
- Invariantes (test:db): profissional não lê atendimento/registros de colega; coordenação lê; papel
  `profissional` provisionado em org nova; trigger de atribuição; bloqueio com tipo; isolamento 2 orgs.
- E2E novo `clinic-experiencia-do-profissional.spec.ts`: login do profissional → Meu Dia → menu sem
  itens administrativos → URL administrativa bloqueada → iniciar abre o prontuário → finalizar com
  confirmação → complementar no mesmo dia.
- Prova em tela com Bruno (só o próprio), Ana (coordenação) e Beatriz (recepção).

---

## Sprints seguintes (planejadas)

**S2 — Filtros.** Barra horizontal (reaproveita `BarraDeFiltrosDaAgenda`): paciente com autocomplete
(com debounce), status múltiplo no vocabulário da S4, especialidade do profissional, sala (acrescentar
em `agenda-info`), procedimento (tabela da S3), "+ Mais filtros" (tipos de item, fins de semana,
cancelados, indisponíveis). Feriado não existe ainda.

**S3 — Formulário de agendamento.** Paciente · Profissional (herdado) · Observação · Procedimentos ·
Data · Hora início/fim. Tabela `clinic_agendamento_procedimentos` (N procedimentos, **sem** somar
duração; reserva de estoque passa a ler dela); `ends_at` editável para a equipe; cadastro rápido
(`NewContactDialog` com máscara BR, nascimento e 409 para duplicado); dias com estado
(Disponível/Sem agenda/Bloqueado/Lotado) por intervalo.

**S6 — Encaixe, ACL e auditoria.** `agenda.encaixe` para marcar por cima, com motivo obrigatório, via
função definer + GUC lido pelo trigger 9005; `clinic_agenda_encaixes` + auditoria; aplicar no servidor
`agenda.marcar/remarcar/cancelar/registrar_desfecho`; IA sem encaixe.

**S7 — Produtividade.** Favoritos, ←/→ entre profissionais, seleção de faixa por arraste, atalhos,
WhatsApp (interface), preferências, menu ⋮ por agendamento.

## Riscos e débitos
- Restringir pacientes/prontuário muda o que profissionais veem hoje: as chaves novas são concedidas a
  todos os papéis existentes (sem regressão); só o papel novo "Profissional de saúde" nasce restrito.
- RLS de `contacts` continua do núcleo (Inbox/IA); o escopo de pacientes vale nas rotas e telas.
- Política restritiva nova no prontuário: medir desempenho (débito de `fn_has_permission` por linha).
- O menu enxuto depende do modo por papéis ligado; no legado, o profissional segue vendo pelo nível.
- Seed usa funções do financeiro (PRs #57–59) ainda fora da `develop`: PR próprio.
