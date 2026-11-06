# Agendamento exige paciente — handoff

Pedido do dono do produto (06/11/2026): não pode existir agendamento sem paciente.

## O que mudou
- **Rota** (`app/api/v1/agenda/agendamentos/_handler.ts`): marcar sem `contact_id` recusa com
  **422 `agenda_sem_paciente`** ("Escolha o paciente que será atendido."), antes de qualquer outra checagem.
  Vale para pessoa, IA e token. Remarcar não muda (mantém o paciente do compromisso).
- **Painel** (`components/agenda/PainelDeMarcacao.tsx`): prop nova `pendencia`. Presente, o "Confirmar"
  fica desabilitado e a frase aparece acima dele.
- **Agenda** (`app/app/agenda/_client.tsx`): passa `pendencia` quando não há paciente; o "Encaixar" também
  não envia sem paciente.
- **Seletor** (`components/agenda/VinculoDaMarcacao.tsx`): saiu a opção "Compromisso pessoal, sem cliente".
  Tempo do profissional sem paciente continua sendo "Bloquear horário". O rótulo diz
  "Quem será atendido (obrigatório)" e o campo tem `aria-required`.

## Prova
- Unit: `tests/unit/agenda-paciente-obrigatorio.test.tsx` (painel) e `agenda-emite-atividade` (rota recusa e
  não grava). Testes que marcavam sem paciente passaram a usar paciente fictício.
- Tela na 3001, como recepção:
  - sem paciente → Confirmar desabilitado e aviso:
    `evidence/agenda-paciente-obrigatorio/pac-1-sem-paciente.png`
  - com paciente → Confirmar ativo:
    `evidence/agenda-paciente-obrigatorio/pac-2-com-paciente.png`
  - rótulo com "(obrigatório)":
    `evidence/agenda-paciente-obrigatorio/pac-3-rotulo.png`
  - POST direto sem paciente → `422 agenda_sem_paciente`.
