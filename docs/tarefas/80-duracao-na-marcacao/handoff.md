# #80 — Agenda: escolher a duração do atendimento na marcação (upstream #3714)

## O que entrou
- Cherry-pick `-x -m 1` de `978ba532f` (upstream #3714) com conflitos resolvidos à mão.
- O painel "Novo agendamento" mostra **Duração (minutos)**, aberto com a duração do tipo; 5…1440 min.
- A lista de horários é calculada para a duração escolhida (`duracao_minutos` em `GET /api/v1/agenda/horarios-livres`).
- O POST grava `ends_at = starts_at + duration_minutes`; fora da faixa → `422 agenda_duracao_invalida`.
- **Remarcar preserva o comprimento do bloco** (antes encolhia para a duração do tipo). É correção: vale com a opção desligada.

## Adaptações do fork
- Atrás de `settings.clinic.duracao_na_marcacao` — migration **8005** (`fn_clinic_definir_duracao_na_marcacao`, admin + MFA),
  nasce desligada; interruptor em Configurações › Profissionais. Desligada, a tela não mostra o campo nem envia a duração.
- Sem o caminho "serviço com agenda publicada" (`service_enabled`), que o fork não tem.
- A duração entra no `marcarEm` (S6b); o horário ocupado guarda a duração e o **Encaixar** a reenvia.
- A consulta de horários mantém o `owner_user_id` do profissional escolhido (fork).
- A IA/MCP continua marcando com a duração do tipo (critério 3).

## Prova
- unit: agenda/clinic/mcp/i18n — 160 arquivos, 1591 testes, exit 0; `agenda-duracao-escolhida` 20 casos.
- invariante `clinic-duracao-na-marcacao-opcao` (banco local): verde; a varredura de definer não acusa a função nova.
- cercas de migration/baseline/fragmento: 20 arquivos, 276 testes, exit 0 · typecheck exit 0 · eslint 0 erros.
- Tela (3001, dono, tipo de 60 min, terça 10/11):
  - opção desligada → campo ausente: `evidence/80-duracao/80-1-desligada.png`
  - 60 min → 9 horários; 90 min → 7 (somem 11:00 e 18:00): `evidence/80-duracao/80-3-ligada-90.png`
  - marcação de 90 min às 14:00: `evidence/80-duracao/80-5-confirmando-90.png` → POST 201, 14:00–15:30
  - remarcada pela API → 1h30 preservada; cancelada em seguida; POST com 3 min → 422.

## Pendências
- O texto de ajuda do upstream diz "duração do serviço" (no fork, "tipo"). Mantido para não divergir do dicionário.
- A #68 (S3, formulário de agendamento) já previa término editável: anotar que esta parte ficou pronta.
