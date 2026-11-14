# Funcionalidades do SaaS de clínicas (fork)

Inventário do que o **fork** acrescentou ao DeskcommCRM, levantado em 2026-11-03 sobre a `develop`
(`01ccbcd67`), a partir das migrations 9001–9044, do `supabase/migrations/MANIFEST.md`, do `UPSTREAM.md`,
dos documentos em `docs/tarefas/` e do código. O que é do núcleo (Inbox, CRM, IA, financeiro base) não
entra aqui — ver `docs/current-state.md`.

Convenções: **flag** = opção por organização em `organizations.settings.clinic.*`, ligada por uma
`fn_clinic_definir_*` (só administrador) pela tela `/app/settings/tenant/profissionais`
(API `/api/v1/clinic/config`). "(não confirmado)" = o levantamento não conseguiu provar pelo código.

Tutorial passo a passo das telas do núcleo: [`docs/curso-deskcomm/`](curso-deskcomm/README.md).

Backlog e estado do trabalho: [quadro Backlog Clínica](https://github.com/users/LuanSilvaR/projects/3) e
[`docs/backlog.md`](backlog.md).

## Resumo — 53 features entregues

| Módulo | Features | Migrations | PRs | Flag (nasce desligada) |
|---|---|---|---|---|
| Agenda | 9 | 9001, 9005, 9007, 9008, 9042 | #4, #8, #10–#13, #22, #71 | `profissionais`, `trava_sobreposicao`, `recursos` |
| Recepção e visita | 6 | 9002–9004, 9006, 9043 | #5–#7, #9, #23, #71 | `ficha_obrigatoria`, `confirmacao_automatica` |
| Pacientes | 2 | 9044 | #6, #71 | — |
| Controle de acesso | 6 | 9009–9014 | #14–#19, #23 | `acesso_por_permissoes`, `menu_clinica` |
| Prontuário e atendimento | 14 | 9016–9027 | #24, #26, #28–#35, #37 | `prontuario` |
| Procedimentos e POP | 4 | 9015 | #25, #27, #36, #39, #40 | `procedimentos` |
| Estoque | 11 | 9028–9038 | #42–#52 | `estoque` |
| Demonstração | 1 | — | #53, #71 | — |

**Em andamento (fora da develop):** Financeiro FN1–FN3 (#57–#59, migrations 9039–9041), menu da clínica
de um nível (#55) e skill do Headroom (#54) — todos **em conflito com a develop**. Ver
[Em andamento](#em-andamento-fora-da-develop).

---

## Agenda

### Profissionais, especialidades e bloqueios de agenda
- **O que faz:** cadastra profissionais (um por membro) e especialidades; liga o tipo de atendimento às especialidades exigidas; bloqueia períodos (recorrentes ou da clínica toda). A marcação recusa profissional não habilitado.
- **Onde:** `/app/settings/tenant/profissionais`; API `/api/v1/clinic/profissionais`, `/especialidades`, `/tipos/[id]/especialidades`, `/bloqueios`, `/agenda/profissionais`.
- **Permissões / flags:** `profissionais.ver`, `profissionais.gerenciar`, `agenda.bloquear_horario`; flag `profissionais`.
- **Banco:** 9001 (`clinic_specialties`, `clinic_professionals`, `clinic_professional_specialties`, `clinic_event_type_specialties`, `clinic_agenda_blocks`); 9044 acrescenta `clinic_agenda_blocks.tipo`.
- **Origem:** #4 (tipo do bloqueio: #71).
- **Testes:** `tests/invariants/clinic-profissionais-rls.test.ts`, `tests/e2e/clinic-profissionais-e-bloqueios.spec.ts`, `lib/clinic/agenda/expandir-bloqueios.test.ts`, `lib/clinic/profissionais/habilitacao.test.ts`.
- **Limites conhecidos:** —

### Trava de horário duplicado
- **O que faz:** o banco recusa compromisso que cruza outro do mesmo profissional (pendente, confirmado e realizado ocupam; cancelado e falta liberam), inclusive em marcações simultâneas.
- **Onde:** marcação da Agenda (`/app/agenda`); o erro 23P01 vira recusa no handler do núcleo.
- **Permissões / flags:** flag `trava_sobreposicao`.
- **Banco:** 9005 (trigger `trg_clinic_trava_sobreposicao` em `calendar_appointments`, com advisory lock).
- **Origem:** #8.
- **Testes:** `tests/invariants/clinic-trava-de-sobreposicao.test.ts`, `tests/e2e/clinic-trava-de-sobreposicao.spec.ts`.
- **Limites conhecidos:** é trigger, não exclusion constraint; o espelho do Google fica de fora; sobreposições antigas não são corrigidas.

### Próximos horários livres ao marcar
- **O que faz:** no "Novo agendamento", mostra o primeiro horário livre de cada profissional habilitado nos próximos 30 dias; um clique escolhe profissional e horário. Mesma conta da grade e do agente de IA.
- **Onde:** painel de marcação em `/app/agenda`; API `/api/v1/clinic/proximos-livres`.
- **Permissões / flags:** `agenda.ver`; exige a flag `profissionais`.
- **Banco:** nenhuma migration.
- **Origem:** #10.
- **Testes:** `lib/clinic/agenda/proximos-livres.test.ts`, `tests/e2e/clinic-proximo-livre.spec.ts`.
- **Limites conhecidos:** —

### Dia por profissional
- **O que faz:** uma coluna por profissional no dia, com jornada, bloqueios com motivo e compromissos (inclusive encaixe); tempo real; aceita `?dia=`.
- **Onde:** `/app/agenda/profissionais`; API `/api/v1/clinic/dia-por-profissional`.
- **Permissões / flags:** `agenda.ver`; flag `profissionais`.
- **Banco:** nenhuma migration.
- **Origem:** #10.
- **Testes:** `lib/clinic/agenda/dia-por-profissional.test.ts`, `tests/e2e/clinic-dia-por-profissional.spec.ts`.
- **Limites conhecidos:** o profissional ainda vê a porta "Dia por profissional"; passa a exigir `agenda.ver_outros` na S6 (#69).

### Salas e equipamentos
- **O que faz:** cadastra recursos por categoria; o tipo de atendimento exige "uma de <categoria>" ou um recurso específico; a marcação aloca ou recusa; cancelar/falta libera.
- **Onde:** `/app/settings/tenant/profissionais` (Salas e equipamentos); API `/api/v1/clinic/recursos`, `/tipos/[id]/recursos`.
- **Permissões / flags:** `profissionais.ver`, `profissionais.gerenciar`; flag `recursos`.
- **Banco:** 9007 (`clinic_resources`, `clinic_event_type_resources`, `clinic_appointment_resources`).
- **Origem:** #11.
- **Testes:** `tests/invariants/clinic-salas-e-equipamentos.test.ts`, `tests/e2e/clinic-salas-e-equipamentos.spec.ts`, `lib/clinic/agenda/recursos.test.ts`.
- **Limites conhecidos:** o intervalo antes/depois do atendimento não reserva sala; o módulo "Equipamentos" do menu segue "Em breve".

### Faltas do paciente e prazo para desmarcar pelo WhatsApp
- **O que faz:** mostra "faltou N×" (12 meses; reincidente a partir de 2) ao marcar e no detalhe; tela de reincidentes. Prazo opcional (0–168 h) impede o agente de IA de cancelar/remarcar dentro dele; a equipe continua podendo.
- **Onde:** `/app/agenda/faltas`; API `/api/v1/clinic/faltas`.
- **Permissões / flags:** `agenda.ver`; prazo `prazo_paciente_horas` nasce sem prazo.
- **Banco:** 9008 (`fn_clinic_definir_prazo_do_paciente`).
- **Origem:** #12.
- **Testes:** `tests/invariants/clinic-prazo-do-paciente.test.ts`, `lib/clinic/agenda/prazo-do-paciente.test.ts`, `tests/e2e/clinic-faltas-e-prazo.spec.ts`.
- **Limites conhecidos:** —

### Indicadores da agenda
- **O que faz:** para o gestor: taxa de faltas, compromissos sem registro, espera média na recepção, duração do atendimento, confirmação pelo WhatsApp e ocupação por profissional em 7/30/90 dias.
- **Onde:** `/app/agenda/indicadores`; API `/api/v1/clinic/indicadores`.
- **Permissões / flags:** `relatorios.gerencial`.
- **Banco:** nenhuma migration.
- **Origem:** #13.
- **Testes:** `lib/clinic/agenda/indicadores.test.ts`, `tests/e2e/clinic-indicadores.spec.ts`.
- **Limites conhecidos:** ocupação aproximada (bloqueios e exceções não descontam da jornada); o espelho do Google não entra.

### Filtros, status e lista do dia na Agenda
- **O que faz:** barra de filtros com estado na URL (paciente por nome/CPF/nascimento com atalho "/", especialidade, status múltiplo, período, "somente livres"); grade com "paciente · tipo" e ícone do status; visão Dia com "Lista por profissional" (ocupação, vagas com "Marcar", espera); tempo real. Sem flag.
- **Onde:** `/app/agenda`; API `/api/v1/clinic/agenda-do-dia`, `/agenda-info`.
- **Permissões / flags:** `agenda.ver`; passos de status seguem as permissões da recepção.
- **Banco:** nenhuma migration (a tela separada do #20 foi revertida no #21).
- **Origem:** #22.
- **Testes:** `tests/unit/clinic-filtros-da-agenda.test.ts`, `tests/unit/clinic-agenda-do-dia.test.ts`, `tests/e2e/clinic-agenda-melhorias.spec.ts`.
- **Limites conhecidos:** filtros avançados planejados na S2 (#67).

### Agenda de um profissional por vez (S1)
- **O que faz:** a Agenda abre em um profissional, com "Trocar profissional" (busca por nome) e bloqueio hachurado; quem não pode ver os outros vê só a própria — forçado pelo servidor.
- **Onde:** `/app/agenda`; API `/api/v1/clinic/agenda/disponibilidade`, `/api/v1/clinic/agenda/profissionais`.
- **Permissões / flags:** `agenda.ver_outros` (concedida a quem já via a agenda).
- **Banco:** 9042.
- **Origem:** #71 · issue #64.
- **Testes:** `tests/unit/clinic-agenda-por-profissional.test.ts`, `tests/e2e/clinic-agenda-por-profissional.spec.ts`.
- **Limites conhecidos:** o profissional ainda vê "Remarcar"/"Cancelar" (S6 #69). S2, S3, S6 e S7 pendentes (épico #63).

## Recepção e visita

### Ficha cadastral obrigatória na chegada (cadastro do paciente)
- **O que faz:** ficha completa do paciente — nome social, sexo, RG, profissão, estado civil, origem, endereço com CEP e IBGE, contato de emergência, responsável legal com CPF (exigido para menor de 18). Com a regra ligada, "Paciente chegou" e "Compareceu" exigem a ficha completa, que abre ali mesmo. Conserta a cifragem do CPF, que falhava no núcleo. O cadastro rápido (nome, e-mail, telefone, CPF opcional) é o `NewContactDialog` do núcleo, com 409 para telefone duplicado.
- **Onde:** detalhe do compromisso e `/app/contacts/[id]`; API `/api/v1/clinic/pacientes/[contactId]/ficha`, `/api/v1/clinic/pacientes/situacao`; cifragem em `lib/contacts/cpf.ts`.
- **Permissões / flags:** `pacientes.ver_ficha`, `pacientes.editar_ficha` (e `pacientes.criar/editar/excluir/importar/mesclar`); flag `ficha_obrigatoria`.
- **Banco:** 9002 (`clinic_patient_profiles`, `encrypt_cpf`/`decrypt_cpf`, anonimização).
- **Origem:** #5.
- **Testes:** `tests/invariants/clinic-ficha-do-paciente.test.ts`, `tests/unit/clinic-ficha-rotas.test.ts`, `lib/clinic/pacientes/ficha.test.ts`, `tests/e2e/clinic-ficha-do-paciente.spec.ts`, `tests/unit/contato-duplicado-409.test.ts`.
- **Limites conhecidos:** sem máscara de entrada (CPF/CEP/telefone validados só no envio); o cadastro rápido não confere CPF duplicado; o CPF não se edita no "Editar contato" (só na ficha); consentimento LGPD sem tela de coleta no cadastro. O conserto do CPF é candidato a PR no upstream.

### Status da visita e painel da Recepção
- **O que faz:** visita em cinco estados (agendado → na recepção → pronto → em atendimento → finalizado); voltar é correção com motivo; histórico só acumula; painel com colunas em tempo real e `?dia=`; finalizar marca "Compareceu".
- **Onde:** `/app/recepcao`; API `/api/v1/clinic/visitas`, `/api/v1/clinic/agendamentos/[id]/visita`.
- **Permissões / flags:** `recepcao.ver_painel`, `recepcao.mudar_status_visita`, `recepcao.corrigir_status`.
- **Banco:** 9003 (`clinic_appointment_visits`, `clinic_appointment_visit_events`, `fn_clinic_mudar_status_visita`).
- **Origem:** #6 (`corrigir_status` no #16).
- **Testes:** `tests/invariants/clinic-status-da-visita.test.ts`, `tests/unit/clinic-rotas.test.ts`, `tests/e2e/clinic-status-da-visita.spec.ts`.
- **Limites conhecidos:** atendimento que termina antes do horário marcado não marca "Compareceu" (o núcleo recusa horário futuro).

### Fluxo recepção → profissional e histórico do agendamento (S4)
- **O que faz:** a recepção confirma os dados e leva a visita até "pronto"; só o dono inicia/finaliza; sair de "finalizado" só o próprio profissional no mesmo dia ou quem tem `atendimento.reabrir`; histórico append-only (criado, confirmado, remarcado, cancelado com motivo, faltou, realizado, troca de profissional).
- **Onde:** `/app/agenda`; API `/api/v1/clinic/agendamentos/[id]/dados-confirmados`, `/historico`, `/visita`.
- **Permissões / flags:** `recepcao.mudar_status_visita`, `recepcao.corrigir_status`, `atendimento.iniciar`, `atendimento.finalizar`, `atendimento.reabrir`.
- **Banco:** 9043 (`clinic_agenda_historico`; visita sem escrita direta de `authenticated`).
- **Origem:** #71 · issue #65.
- **Testes:** `tests/unit/clinic-fluxo-operacional.test.ts`, `tests/invariants/clinic-fluxo-operacional.test.ts`.
- **Limites conhecidos:** especialidade no "Iniciar atendimento" quando mais de uma é compatível (opcional, não feito).

### Painel inicial da Recepção
- **O que faz:** busca de paciente, cadastro rápido, contadores do dia clicáveis, pacientes de hoje com status e ações, sala de espera com tempo de espera e vagas livres.
- **Onde:** `/app/inicio`.
- **Permissões / flags:** depende da flag `menu_clinica` (não confirmado).
- **Banco:** nenhuma migration.
- **Origem:** #23.
- **Testes:** `tests/e2e/clinic-inicio-da-recepcao.spec.ts`.
- **Limites conhecidos:** —

### Confirmação de consulta pelo WhatsApp (SIM/NÃO)
- **O que faz:** o lembrete de 12 h ou mais pede SIM/NÃO e a resposta é lida sozinha; sem resposta até 4 h antes, abre a tarefa "Ligar para confirmar"; SIM atrasado ainda vale e fecha a tarefa.
- **Onde:** detalhe e histórico da Agenda; cron `/api/v1/cron/clinic-confirmacao-sem-resposta` (15 min).
- **Permissões / flags:** flag `confirmacao_automatica`.
- **Banco:** 9004 (`clinic_confirmation_requests`; tarefas em `crm_tasks`).
- **Origem:** #7.
- **Testes:** `tests/invariants/clinic-confirmacao-de-consulta.test.ts`, `lib/clinic/confirmacao/resposta.test.ts`, `tests/e2e/clinic-confirmacao-de-consulta.spec.ts`.
- **Limites conhecidos:** —

### Lembrete que falhou vira tarefa de ligação
- **O que faz:** lembrete com falha abre a tarefa de ligar na hora; lembrete que nem saiu abre a tarefa a 4 h da consulta.
- **Onde:** cron `/api/v1/cron/clinic-confirmacao-sem-resposta`.
- **Permissões / flags:** flag `confirmacao_automatica`.
- **Banco:** 9006.
- **Origem:** #9.
- **Testes:** os da confirmação (específicos não confirmados).
- **Limites conhecidos:** compromisso marcado há menos de 30 min fica fora da regra do "não saiu".

## Pacientes

### Busca do paciente e histórico na timeline
- **O que faz:** "Quem será atendido" acha o paciente por nome, telefone, CPF (pelo hash) ou nascimento, mostrando o fim do telefone para separar homônimos; a Timeline do paciente traz agendamentos, atendimentos e marcos.
- **Onde:** `/app/agenda` (marcação), `/app/contacts/[id]`; API `/api/v1/clinic/pacientes/[contactId]/historico`.
- **Permissões / flags:** `pacientes.ver`.
- **Banco:** lê as tabelas da 9003.
- **Origem:** #6.
- **Testes:** `lib/clinic/pacientes/busca.test.ts`, `tests/e2e/clinic-status-da-visita.spec.ts`.
- **Limites conhecidos:** —

### Profissional vê só os próprios pacientes, papel "Profissional de saúde" e Meu dia (S5)
- **O que faz:** sem `pacientes.ver_todos`, lista e detalhe mostram só pacientes com agendamento com a própria pessoa (os outros dão 404); sem `prontuario.ver_outros`, só os próprios atendimentos (RLS restritiva). Papel-modelo "Profissional de saúde", tela Meu dia, finalizar com confirmação, complementar no mesmo dia, bloqueio com tipo e conflito (409).
- **Onde:** `/app/meu-dia`, `/app/contacts`, `/app/contacts/[id]`.
- **Permissões / flags:** `pacientes.ver_todos`, `prontuario.ver_outros` (concedidas a quem já via); papel `profissional`.
- **Banco:** 9044.
- **Origem:** #71 · issue #66.
- **Testes:** `tests/unit/clinic-experiencia-do-profissional.test.ts`, `tests/invariants/clinic-experiencia-do-profissional.test.ts`, `tests/e2e/clinic-experiencia-do-profissional.spec.ts` (fora do CI: depende do seed).
- **Limites conhecidos:** a RLS de `contacts` segue a do núcleo (Inbox/IA); a recepção ainda não entrou na prova de tela.

## Controle de acesso

### Papéis de acesso por empresa
- **O que faz:** catálogo de permissões por módulo (com dependências e chaves críticas) e papéis por empresa; com o modo desligado vale o nível legado.
- **Onde:** `lib/clinic/acesso/catalogo.ts`; API `/api/v1/clinic/acesso/eu`.
- **Permissões / flags:** `papeis.ver`, `papeis.gerenciar`; flag `acesso_por_permissoes`.
- **Banco:** 9009 (`clinic_permissions`, `clinic_roles`, `clinic_role_permissions`, `clinic_member_roles`, `fn_member_permissions`, `fn_has_permission`).
- **Origem:** #14.
- **Testes:** `lib/clinic/acesso/catalogo.test.ts`, `tests/invariants/clinic-papeis-de-acesso.test.ts`.
- **Limites conhecidos:** —

### Editar papéis e atribuí-los aos membros
- **O que faz:** matriz por módulo para criar, editar, duplicar, desativar e excluir papéis. Travas no banco: só se concede o que se possui, papel de sistema protegido, a empresa nunca fica sem Administrador, MFA. Papéis-modelo Administrador, Gerente, Atendente e Visualizador em toda empresa.
- **Onde:** `/app/settings/tenant/papeis`; API `/api/v1/clinic/acesso/papeis`, `/papeis/[id]`, `/membros/[userId]/papeis`.
- **Permissões / flags:** `papeis.gerenciar`, `equipe.atribuir_papeis`.
- **Banco:** 9010, 9011.
- **Origem:** #14, #15.
- **Testes:** `tests/invariants/clinic-papeis-de-acesso.test.ts`, `tests/e2e/clinic-papeis-de-acesso.spec.ts`.
- **Limites conhecidos:** —

### Modo por permissões
- **O que faz:** ligado, o papel legado passa a ser calculado das permissões (recalculado por triggers); desligar volta ao legado; só liga com ao menos um Administrador.
- **Onde:** `/app/settings/tenant/profissionais` (via `/api/v1/clinic/config`).
- **Permissões / flags:** `papeis.gerenciar`; flag `acesso_por_permissoes`.
- **Banco:** 9012.
- **Origem:** #17, #18.
- **Testes:** `tests/invariants/clinic-papeis-de-acesso.test.ts`, `tests/e2e/clinic-papeis-de-acesso.spec.ts`.
- **Limites conhecidos:** entitlement por módulo (ACL-014) adiado.

### Rotas, RLS e telas por permissão
- **O que faz:** as rotas da clínica usam `requirePermission`; policies restritivas protegem financeiro, ficha e cadastros da clínica até no acesso direto pelo PostgREST; Recepção, Profissionais e Indicadores decidem pela permissão efetiva.
- **Onde:** rotas `app/api/v1/clinic/**`.
- **Permissões / flags:** `financeiro.*`, `pacientes.ver_ficha`/`editar_ficha`, `profissionais.gerenciar`, `agenda.bloquear_horario`.
- **Banco:** 9013.
- **Origem:** #16, #17.
- **Testes:** `tests/invariants/clinic-papeis-de-acesso.test.ts` (não confirmado), `tests/unit/clinic-rotas.test.ts`.
- **Limites conhecidos:** com o modo desligado, só muda que o visualizador não grava o próprio bloqueio direto pelo PostgREST.

### Menu por permissão e aba Membros
- **O que faz:** menu e portas seguem as permissões; aba Membros com busca sem acento, contagem, convites pendentes/expirados e "Convidar <e-mail>".
- **Onde:** `/app/settings/tenant/papeis` (aba Membros); API `/api/v1/clinic/acesso/membros`.
- **Permissões / flags:** `equipe.ver`, `equipe.convidar`.
- **Banco:** nenhuma migration.
- **Origem:** #18, #19.
- **Testes:** `tests/e2e/clinic-papeis-de-acesso.spec.ts`.
- **Limites conhecidos:** —

### Menu organizado por módulos da clínica
- **O que faz:** menu lateral, hubs e Início em 17 módulos; Contratos, Equipamentos, Comissões e Notas Fiscais aparecem "Em breve". Só apresentação.
- **Onde:** `/app/inicio`, `/app/inicio/[modulo]`.
- **Permissões / flags:** flag `menu_clinica`.
- **Banco:** 9014 (a 9014 original, do #20, foi revertida e nunca aplicada).
- **Origem:** #23.
- **Testes:** `lib/clinic/navegacao/modulos.test.ts`, `tests/invariants/clinic-menu-da-clinica.test.ts`, `tests/e2e/clinic-menu-da-clinica.spec.ts`.
- **Limites conhecidos:** módulos "Em breve"; a versão de um nível está no PR #55 (em conflito).

## Prontuário e atendimento

Vale para todo o módulo: depende da flag `prontuario` (nasce desligada). Regras no banco em funções
`fn_clinic_*` com `fn_acesso_exigir`; organização sempre da sessão; sem atalho de platform admin na leitura
clínica; auditoria só com metadados, sem texto clínico (`tests/unit/clinic-auditoria-sem-conteudo-clinico.test.ts`).

### Acesso clínico separado da administração (F0)
- **O que faz:** quem administra não vê conteúdo clínico; administrador e suporte só veem com papel clínico; no modo legado só profissional ativo recebe as chaves clínicas.
- **Permissões / flags:** grupo `clinica` com 19 chaves (`atendimento.*`, `prontuario.{ver,adendo,exportar}`, `planos.*`, `fotos.*`, `anexos.*`, `documentos.*`, `modelos_clinicos.gerenciar`); papéis-modelo sem chave clínica.
- **Banco:** 9016.
- **Origem:** #24.
- **Testes:** `tests/invariants/clinic-acesso-clinico.test.ts`.
- **Limites conhecidos:** escopo é a clínica inteira (preparado para "próprios"/"unidade"); acesso emergencial auditado do suporte (break-glass) é futuro.

### Fila "Meus atendimentos", iniciar e finalizar (F1)
- **O que faz:** após o check-in, o paciente aparece em "Aguardando"; o profissional inicia (ligado ao agendamento, visita vai a "em atendimento") e finaliza.
- **Onde:** `/app/atendimentos`, `/app/atendimentos/[id]`; API `/api/v1/clinic/atendimentos/fila`, `/api/v1/clinic/agendamentos/[id]/atendimento`, `/api/v1/clinic/atendimentos/[id]`.
- **Permissões / flags:** `atendimento.ver_fila`, `.iniciar`, `.finalizar`, `prontuario.ver`; exige MFA.
- **Banco:** 9017 (`clinic_atendimentos`, `clinic_atendimento_eventos` só inclusão).
- **Origem:** #26.
- **Testes:** `tests/invariants/clinic-atendimentos.test.ts`, `tests/e2e/clinic-atendimento-fila.spec.ts`.
- **Limites conhecidos:** —

### Anamnese e avaliação por modelo versionado (F2)
- **O que faz:** formulários de anamnese e avaliação no atendimento, com salvamento automático; edição simultânea gera conflito em vez de sobrescrever.
- **Onde:** `/app/atendimentos/[id]`; API `/api/v1/clinic/atendimentos/[id]/formularios/[tipo]`.
- **Permissões / flags:** `atendimento.registrar`, `prontuario.ver`.
- **Banco:** 9018 (`clinic_modelos_formulario`, `_versoes` imutáveis, `clinic_formularios_preenchidos`).
- **Origem:** #28.
- **Testes:** `tests/invariants/clinic-prontuario-registros.test.ts`.
- **Limites conhecidos:** —

### Evolução, adendos e prontuário imutável (F2)
- **O que faz:** evolução obrigatória para finalizar; depois de finalizado nada se edita — correção é adendo.
- **Onde:** `/app/atendimentos/[id]`; API `/api/v1/clinic/atendimentos/[id]/adendos`, `/registros`.
- **Permissões / flags:** `atendimento.registrar`, `prontuario.adendo`.
- **Banco:** 9019 (`clinic_evolucoes`, `clinic_adendos`; trigger recusa UPDATE/DELETE de registro finalizado, inclusive do service role).
- **Origem:** #28.
- **Testes:** `tests/invariants/clinic-prontuario-registros.test.ts`.
- **Limites conhecidos:** exceção explícita para service role em migrations futuras prevista no plano (não confirmado se implementada).

### Aba "Prontuário" do paciente — linha do tempo (F2, F9)
- **O que faz:** linha do tempo clínica na ficha do paciente com abas Prontuário, Planos, Documentos e Fotos e anexos; filtros De/Até/Profissional/Plano.
- **Onde:** `/app/contacts/[id]`; API `/api/v1/clinic/pacientes/[contactId]/prontuario`.
- **Permissões / flags:** `prontuario.ver`, `planos.ver`, `documentos.ver`.
- **Banco:** lê 9017–9026.
- **Origem:** #28, #35.
- **Testes:** `tests/invariants/clinic-linha-do-tempo-indices.test.ts` (reprova consulta sem índice).
- **Limites conhecidos:** —

### Modelos clínicos editáveis e requisitos para finalizar (F3)
- **O que faz:** a clínica cria e publica versões de formulários (a anterior fica intacta) e define o que é obrigatório para finalizar por tipo e especialidade; evolução sempre obrigatória.
- **Onde:** `/app/settings/tenant/modelos-clinicos`; API `/api/v1/clinic/modelos`, `/api/v1/clinic/requisitos`.
- **Permissões / flags:** `modelos_clinicos.gerenciar`.
- **Banco:** 9020 (`clinic_requisitos_finalizacao`, `fn_clinic_requisitos_faltando`).
- **Origem:** #29.
- **Testes:** `tests/invariants/clinic-requisitos-e-modelos.test.ts`, `tests/e2e/clinic-modelos-clinicos.spec.ts`.
- **Limites conhecidos:** —

### Conduta, plano de tratamento e sessões (F4)
- **O que faz:** conduta com salvamento automático; dela sai um plano com sessões (planejada/agendada/realizada/cancelada); a sessão vira "realizada" quando o atendimento ligado é finalizado.
- **Onde:** `/app/atendimentos/[id]`, aba Planos do paciente; API `/api/v1/clinic/pacientes/[contactId]/planos`.
- **Permissões / flags:** `planos.ver`, `planos.gerenciar`, `atendimento.registrar`.
- **Banco:** 9021 (`clinic_condutas`, `clinic_planos_tratamento`, `clinic_plano_sessoes`).
- **Origem:** #30.
- **Testes:** `tests/invariants/clinic-conduta-e-planos.test.ts`.
- **Limites conhecidos:** catálogo de protocolos por serviço é futuro.

### Procedimentos realizados e insumos (F5)
- **O que faz:** registra o procedimento feito (catálogo da 9015), região, parâmetros, intercorrências e insumos com lote, validade e Reg. ANVISA; erro é anulado, não apagado. Ao finalizar, avisa o estoque pelo `event_log`.
- **Onde:** `/app/atendimentos/[id]`.
- **Permissões / flags:** `atendimento.registrar`.
- **Banco:** 9022 (`clinic_procedimentos_realizados`, `clinic_procedimento_insumos`).
- **Origem:** #31 (Reg. ANVISA: #37).
- **Testes:** `tests/invariants/clinic-procedimentos-realizados.test.ts`.
- **Limites conhecidos:** falta ligar o procedimento realizado à versão do POP (backlog).

### Documentos, termos e aceite eletrônico (F6)
- **O que faz:** emite contrato, consentimento, autorização, uso de imagem e ciência de orientações a partir de modelos versionados; aceite presencial (nome digitado) ou por link de uso único que expira; revogação; envio pelo WhatsApp (F9).
- **Onde:** aba Documentos em `/app/contacts/[id]`; página pública `/termo/[token]`; API `/api/v1/clinic/pacientes/[contactId]/documentos`.
- **Permissões / flags:** `documentos.ver`, `.emitir`, `.colher_aceite`, `.revogar` (suporte sem `documentos.*` desde a F10).
- **Banco:** 9023 (modelos e versões imutáveis, `clinic_documentos_emitidos` congelado com sha256, `clinic_documento_aceites` com IP e navegador, `clinic_documento_links` com hash do token).
- **Origem:** #32, #35, #37.
- **Testes:** `tests/invariants/clinic-documentos-e-aceites.test.ts`, `tests/e2e/clinic-documentos.spec.ts`.
- **Limites conhecidos:** textos padrão não são parecer jurídico; assinatura certificada (ICP-Brasil/gov.br) é futura; o WhatsApp abre por `wa.me` com mensagem genérica.

### Fotos clínicas e anexos (F7)
- **O que faz:** foto pela câmera ou anexo (convertido para WebP com miniatura), antes/depois lado a lado; finalidade clínica ou de divulgação — divulgação só com termo de imagem aceito para a finalidade e o canal.
- **Onde:** aba "Fotos e anexos" em `/app/contacts/[id]`; API `/api/v1/clinic/pacientes/[contactId]/anexos`.
- **Permissões / flags:** `fotos.ver`, `fotos.enviar`, `anexos.ver`, `anexos.enviar`; cota `cota_arquivos_mb` (padrão 5 GB).
- **Banco:** 9024 (bucket privado `clinical-files`, URL assinada de 60 s, `clinic_anexos` imutável); divulgação por canal na 9027.
- **Origem:** #33, #37.
- **Testes:** `tests/invariants/clinic-anexos-e-fotos.test.ts`, `tests/invariants/clinic-revisao-conformidade.test.ts`.
- **Limites conhecidos:** trocar o armazenamento (R2/B2) exige outra implementação do adaptador.

### Reabrir atendimento finalizado (F8)
- **O que faz:** a gerência clínica reabre com motivo; o que foi finalizado segue imutável — só se acrescenta.
- **Onde:** `/app/atendimentos/[id]`; API `/api/v1/clinic/atendimentos/[id]/reabrir`.
- **Permissões / flags:** `atendimento.reabrir` (e, desde a S5, o próprio profissional no mesmo dia).
- **Banco:** 9025.
- **Origem:** #34.
- **Testes:** `tests/invariants/clinic-reabrir-atendimento.test.ts`.
- **Limites conhecidos:** —

### Exportar e imprimir o prontuário, PDF e limite de leitura (F8–F10)
- **O que faz:** versão imprimível e PDF gerado no servidor (só texto, fuso da clínica); cada atendimento e adendo mostra "Nome — CRM 12345/SP"; limite de leituras clínicas por usuário contra raspagem.
- **Onde:** `/imprimir/prontuario/[contactId]`; API `/api/v1/clinic/pacientes/[contactId]/prontuario/pdf`.
- **Permissões / flags:** `prontuario.exportar`.
- **Banco:** sem migration própria (não confirmado); auditoria `clinic.prontuario_visto`.
- **Origem:** #34, #35, #37.
- **Testes:** `tests/invariants/clinic-revisao-conformidade.test.ts`.
- **Limites conhecidos:** cada profissional precisa ter o conselho preenchido; o sistema não trava qual conselho executa qual procedimento.

### Cabeçalho clínico e anular atendimento aberto por engano (F9)
- **O que faz:** alergias e alertas no topo (com histórico), plano ativo e último/próximo atendimento; atendimento aberto por engano e sem registro pode ser anulado com motivo (a visita volta a "pronto").
- **Onde:** `/app/atendimentos/[id]`, `/app/contacts/[id]`; API `/api/v1/clinic/pacientes/[contactId]/cabecalho`.
- **Permissões / flags:** (não confirmado).
- **Banco:** 9026 (`clinic_prontuarios`, `clinic_prontuario_alteracoes`).
- **Origem:** #35, #37.
- **Testes:** `tests/invariants/clinic-cabecalho-e-anulacao.test.ts`.
- **Limites conhecidos:** —

### Correções de segurança, LGPD e conformidade (F10)
- **O que faz:** suporte sem `documentos.*`; termo de imagem sem opção obrigatória; divulgação revalidada na leitura; DELETE direto recusado em atendimentos, cabeçalho e planos; upload só após conferir paciente e cota; Reg. ANVISA nos insumos.
- **Banco:** 9027.
- **Origem:** #37.
- **Testes:** `tests/invariants/clinic-revisao-conformidade.test.ts`.
- **Limites conhecidos:** recepção e administrador continuam vendo os termos (decisão registrada).

### Regras regulatórias aplicadas
- **CFM 1.821/2007 (guarda de 20 anos):** anonimização LGPD não apaga prontuário, fotos nem termos; apagar o contato é recusado.
- **CFM 1.638/2002 (autoria):** nome e registro no conselho em cada atendimento e adendo.
- **Imutabilidade:** registro finalizado não se altera nem se apaga; erro é anulado com motivo; correção é adendo; reabrir não destrava o já registrado; documento emitido congelado com sha256.
- **Lei 14.063/2020:** citada só como decisão da clínica (avaliar assinatura avançada para contratos de valor alto); hoje o aceite é eletrônico simples com canal, IP e navegador.
- **LGPD art. 8º e 11, I:** consentimento específico, destacado e revogável para divulgação de imagem.

## Procedimentos e POP

Depende da flag `procedimentos` (nasce desligada).

### Catálogo de procedimentos
- **O que faz:** cadastro dos procedimentos ligado às especialidades e aos profissionais; só aparece o profissional com ao menos uma especialidade do procedimento.
- **Onde:** `/app/procedimentos`, `/app/procedimentos/[id]`; API `/api/v1/clinic/procedimentos`.
- **Permissões / flags:** `procedimentos.ver`, `procedimentos.gerenciar`.
- **Banco:** 9015 (`clinic_procedures` e vínculos; trigger de coerência profissional × especialidade).
- **Origem:** #25, #27.
- **Testes:** `tests/unit/clinic-procedimentos-coerencia.test.ts`, `tests/invariants/clinic-procedimentos-e-pop.test.ts`, `tests/e2e/clinic-procedimentos.spec.ts`.
- **Limites conhecidos:** —

### Editor do POP com versões, aprovação e histórico
- **O que faz:** um POP por procedimento (POP-001) a partir do modelo padrão (21 seções) ou em branco; salva sozinho com trava de edição simultânea; aprovação com permissão própria; versão aprovada imutável, mudança vira nova versão com motivo (1.0 → 1.1 ou 2.0); histórico.
- **Onde:** aba POP em `/app/procedimentos/[id]`; API `/api/v1/clinic/pops/[popId]`.
- **Permissões / flags:** `pops.ver`, `pops.editar`, `pops.aprovar`.
- **Banco:** 9015 (`clinic_pops`, `clinic_pop_versions`).
- **Origem:** #25, #36.
- **Testes:** `tests/unit/clinic-pop-documento.test.ts`, `tests/e2e/clinic-pop.spec.ts`.
- **Limites conhecidos:** conteúdo é JSON de blocos fechados (sem HTML); comparar versões lado a lado está no backlog.

### Impressão do POP em PDF A4
- **O que faz:** PDF da versão com bloco documental, cabeçalho e rodapé paginados, marca da clínica (nome, razão social, CNPJ, endereço, cor, logo); rascunho ou versão substituída sai "NÃO VIGENTE".
- **Onde:** API `/api/v1/clinic/pops/versoes/[id]/pdf`.
- **Permissões / flags:** `pops.imprimir`.
- **Banco:** nenhuma migration.
- **Origem:** #39.
- **Testes:** `tests/unit/clinic-pop-impressao.test.ts`.
- **Limites conhecidos:** telefone, site e e-mail da clínica não existem no cadastro.

### Acabamento do POP (teclado e espanhol)
- **O que faz:** barra de formatação acessível pelo teclado (Alt+F10, setas, Esc), `aria-pressed`, botões de 44 px no celular; modelo padrão no idioma de quem cria (português ou espanhol).
- **Onde:** editor em `/app/procedimentos/[id]`.
- **Origem:** #40.
- **Testes:** `tests/e2e/clinic-pop.spec.ts`.
- **Limites conhecidos:** —

## Estoque

Uma tela, `/app/estoque`, com as abas Posição, Alertas, Movimentações, Pendências, Compras (NF-e),
Inventário, Relatórios e Locais. Depende da flag `estoque` (nasce desligada). APIs em
`app/api/v1/clinic/estoque/*`. Roteiro de teste em `docs/tarefas/estoque/entrega.md`.

### Estoque por lote, validade e local (E0)
- **O que faz:** produto para estoque (EAN, NCM, ANVISA, unidade e fator, rastreado, controlado, mínimo) e locais; entrada com lote e validade, transferência, perda, ajuste e estorno. Saldo = soma dos movimentos, nunca negativo.
- **Permissões / flags:** `estoque.ver`, `.movimentar`, `.inventariar`, `.configurar`, `.custos`, `.estornar`.
- **Banco:** 9028 (`clinic_produto_estoque`, `clinic_estoque_locais`, `clinic_estoque_lotes`, `clinic_estoque_operacoes`, `clinic_estoque_movimentos`, view `clinic_estoque_saldos`).
- **Origem:** #42.
- **Testes:** `tests/invariants/clinic-estoque-base.test.ts`, `tests/e2e/clinic-estoque.spec.ts`, `lib/clinic/estoque/posicao.test.ts`.
- **Limites conhecidos:** movimento não se corrige, só se estorna (de propósito).

### Quantidade do catálogo vem do saldo (E1)
- **O que faz:** em produto "Controlar a quantidade pelo estoque", a quantidade do catálogo passa a ser saldo ÷ fator.
- **Permissões / flags:** `estoque.configurar`.
- **Banco:** 9029 (triggers; um deles em `catalog_products`, do núcleo).
- **Origem:** #43.
- **Testes:** `tests/invariants/clinic-estoque-sincronia.test.ts`.
- **Limites conhecidos:** trigger do fork em tabela do núcleo — atenção em merge com o upstream.

### Finalizar o atendimento dá baixa no estoque (E2)
- **O que faz:** ao finalizar, os insumos saem do local da sala (ou padrão) pelo lote informado ou por FEFO; o atendimento nunca falha por falta de estoque — vira pendência resolvida com motivo.
- **Onde:** aba Pendências; consumidor do evento `clinic.procedimento_confirmado`.
- **Banco:** 9030 (`clinic_estoque_pendencias`).
- **Origem:** #44.
- **Testes:** `tests/invariants/clinic-estoque-consumo.test.ts`, `tests/e2e/clinic-estoque-baixa.spec.ts`.
- **Limites conhecidos:** a baixa leva cerca de 1 min (drenagem do `event_log`).

### Kit por procedimento e reserva (E3)
- **O que faz:** kit de insumos padrão por procedimento; reserva na véspera e ao iniciar; finalizar converte em baixa, anular libera; disponível = saldo − reservas.
- **Onde:** aba Kit em `/app/procedimentos/[id]`; cron `/api/v1/cron/estoque-reservas`.
- **Permissões / flags:** `procedimentos.gerenciar` para salvar o kit.
- **Banco:** 9031 (`clinic_procedimento_kits`, `clinic_estoque_reservas`).
- **Origem:** #45.
- **Testes:** `tests/invariants/clinic-estoque-kits-reservas.test.ts`, `tests/e2e/clinic-estoque-kit.spec.ts`.
- **Limites conhecidos:** a reserva da véspera só vale para agendamento ligado a sessão de plano.

### Frascos abertos e fracionamento (E4)
- **O que faz:** abre frasco (ex.: toxina, 1 frasco = 100 U) com validade após aberto; o consumo usa primeiro o frasco aberto no prazo; encerrar transforma a sobra em perda com motivo.
- **Banco:** 9032 (`clinic_estoque_frascos`).
- **Origem:** #46.
- **Testes:** `tests/invariants/clinic-estoque-frascos.test.ts`, `tests/e2e/clinic-estoque-frascos.spec.ts`.
- **Limites conhecidos:** estorno não devolve para frasco encerrado (de propósito).

### Entrada pelo XML da NF-e (E5)
- **O que faz:** envia o XML, confere item a item (de/para aprendido, lote e validade obrigatórios em rastreado, vencido recusado) e lança a entrada com custo rateado; opcionalmente gera conta a pagar.
- **Onde:** aba Compras (NF-e).
- **Permissões / flags:** `estoque.compras`; conta a pagar exige `financeiro.lancar`.
- **Banco:** 9033 (bucket `clinic-nfe`, fornecedores, notas e itens; escreve em `financial_entries` do núcleo).
- **Origem:** #47.
- **Testes:** `tests/invariants/clinic-estoque-nfe.test.ts`, `tests/e2e/clinic-estoque-nfe.spec.ts`.
- **Limites conhecidos:** só upload de XML (sem consulta à SEFAZ).

### Inventário por local (E6)
- **O que faz:** abre a contagem de um local, registra por lote e, ao fechar, grava uma única operação de acerto com diferença e motivo.
- **Permissões / flags:** `estoque.inventariar`.
- **Banco:** 9034.
- **Origem:** #48.
- **Testes:** `tests/invariants/clinic-estoque-inventario.test.ts`, `tests/e2e/clinic-estoque-inventario.spec.ts`.
- **Limites conhecidos:** —

### Alertas do estoque (E7)
- **O que faz:** abaixo do mínimo, ponto de pedido, validade em 30/60/90 dias, lote vencido, frasco aberto vencido e pendências; resolve sozinho quando deixa de valer; dispensado com motivo não volta por 7 dias.
- **Onde:** aba Alertas; cron `/api/v1/cron/estoque-alertas` (hora em hora).
- **Banco:** 9035 (`clinic_estoque_alertas`).
- **Origem:** #49.
- **Testes:** `tests/invariants/clinic-estoque-alertas.test.ts`, `tests/e2e/clinic-estoque-alertas.spec.ts`.
- **Limites conhecidos:** alerta só na tela (aviso por e-mail/WhatsApp não confirmado).

### Relatórios e rastreio de lote — recall (E8)
- **O que faz:** consumo (por procedimento, profissional, produto), perdas e sugestão de compra, sem paciente; o recall lista os pacientes que receberam um lote, auditado e limitado a 30 consultas/hora.
- **Permissões / flags:** `estoque.ver`; custo com `estoque.custos`; recall com a chave clínica `estoque.rastreio_lote`.
- **Banco:** 9036 (funções de relatório; privilégio por coluna esconde paciente e profissional dos movimentos).
- **Origem:** #50.
- **Testes:** `tests/invariants/clinic-estoque-relatorios.test.ts`, `tests/e2e/clinic-estoque-relatorios.spec.ts`.
- **Limites conhecidos:** recall físico, descarte (PGRSS, RDC 222/2018) e SNGPC ficam fora do sistema.

### IA no estoque — Groq, sugestão na NF-e e consulta pelo assistente (E9)
- **O que faz:** Groq como provedor de IA; sugestão do produto nos itens da nota não reconhecidos (confiança mínima 0,6, só sugestão); ferramenta só de leitura `crm_estoque_consultar` para o assistente, sem paciente e sem custo.
- **Onde:** Configurações › Inteligência Artificial.
- **Permissões / flags:** opt-in por ponto de IA; respeita o teto de IA.
- **Banco:** 9037 (modelos e preços da Groq).
- **Origem:** #51.
- **Testes:** `lib/clinic/estoque/nfe/ia.test.ts`, `lib/mcp/tools/estoque.test.ts`.
- **Limites conhecidos:** preços da Groq vieram de páginas públicas — conferir em groq.com/pricing antes de cobrar.

### Correções de segurança e conformidade (E10)
- **O que faz:** rastreado exige lote e validade no insumo; lote escolhido pelo sistema fica "presumido"; quarentena de lote; perda com categoria; lote vencido aplicado gera alerta; Reg. ANVISA e fabricação no lote; recall auditado no banco.
- **Banco:** 9038.
- **Origem:** #52.
- **Testes:** `tests/invariants/clinic-estoque-revisao.test.ts`, `tests/e2e/clinic-estoque-revisao.spec.ts`.
- **Limites conhecidos:** o vínculo paciente ↔ lote é imutável (guarda de 20 anos); o XML da nota deve ser guardado por 5 anos.

## Demonstração

### Clínica de demonstração com dados fictícios
- **O que faz:** um comando cria localmente uma clínica com pacientes, agenda, atendimentos, estoque e 7 usuários por perfil (Dono, Dra. Ana, Dr. Bruno, Carla, Diego, Recepção, Compras), passando pelas mesmas funções da tela. `scripts/seed-demo-simulacao.ts` (#71) acrescenta a simulação usada na prova da S5 (Bruno, Carla e Diego como "Profissional de saúde").
- **Onde:** `npx tsx scripts/seed-demo-clinica.ts`; guia em `docs/demo-clinica.md`. Credenciais em `.demo-clinica-creds.json` (fora do git).
- **Permissões / flags:** recusa banco remoto sem `--confirmo-que-nao-e-producao`; senha de `DEMO_SENHA` ou gerada na hora.
- **Origem:** #53, #71.
- **Testes:** `tests/invariants/seed-demo-clinica.test.ts`.
- **Limites conhecidos:** dados 100% fictícios (telefones na faixa de teste, e-mails `.test`, sem CPF).

---

## Financeiro hoje na develop

As rotas `app/api/v1/financeiro/*` (comandas, faturamento em lote, catálogo, fidelidade, lançamentos), as
telas `/app/comandas`, `/app/faturamento`, `/app/settings/tenant/financeiro` e as tabelas
(`sales`, `financial_entries`, `commissions`, `loyalty_ledger`…) são **do núcleo**. O fork acrescentou só as
permissões `financeiro.*` (exigidas além do papel — `UPSTREAM.md`) e a conta a pagar opcional da NF-e (E5).
Maquininhas, taxas, pagamento dividido e caixa **ainda não estão na develop**.

## Em andamento (fora da develop)

Todos os PRs abaixo estão com CI verde, mas **em conflito com a develop** (CONFLICTING/DIRTY).

| PR | O que entrega | Migrations | Observação |
|---|---|---|---|
| #55 | Menu da clínica de um nível, abas do módulo no topo, Início com a grade de módulos; Contratos, Equipamentos e Comissões saem do "Em breve" | — | flag `menu_clinica`; primeiro da fila |
| #57 FN1 | Maquininhas e taxas por forma de pagamento, parcela e bandeira (vigência imutável); simulador de líquido, antecipação e margem | 9039 | flag `financeiro_avancado` (nasce desligada); `financeiro.taxas`; depende de #55 |
| #58 FN2 | Comanda com pagamento dividido, parcelas, alerta de margem; cada parcela vira conta a receber; comissão sobre o líquido; baixa automática | 9039–9040 | depende de #57 |
| #59 FN3 | Caixa do dia: gaveta, troco, suprimento, sangria, fechamento contando cédulas, dupla conferência (limite padrão R$ 5.000) | 9039–9041 | `financeiro.caixa`, `financeiro.conferir`; depende de #58 |
| #54 | Skill do Headroom (só documentação) | — | independente |

**Atenção ao retomar o Financeiro:** as migrations 9039–9041 têm timestamp `20261007…`, anterior ao das
9042–9044 (`20261008…`) que já estão na develop. É preciso conferir se o `update.sh` e o invariante de ordem
aceitam isso ou renumerar antes do merge. Ordem declarada: #55 → #57 → #58 → #59.
