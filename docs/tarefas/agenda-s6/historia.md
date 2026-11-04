# agenda-s6 — Encaixe, ACL e auditoria (issue #69, épico #63) — nível HIGH

## Objetivo
Recepção/gerência marca por cima de um horário ocupado ("encaixe") com motivo obrigatório e rastro;
o servidor passa a exigir `agenda.marcar/remarcar/cancelar/registrar_desfecho`; a tela esconde o que
o usuário não pode fazer, inclusive a porta "Dia por profissional" (pendência da S5, handoff l.60-65).

## O que já existe (conferido)
- Catálogo (`lib/clinic/acesso/catalogo.ts` l.90-94): `agenda.ver_outros` (9042), `marcar`, `remarcar`,
  `cancelar`, `registrar_desfecho` JÁ existem; **`agenda.encaixe` NÃO existe** (chave nova).
- `PAPEL_PROFISSIONAL` tem só `agenda.ver` + `agenda.bloquear_horario` (sem marcar/remarcar/cancelar/desfecho).
- Trigger 9005 (`fn_clinic_trava_sobreposicao`): atrás da flag `settings.clinic.trava_sobreposicao`;
  recusa com `23P01`; ignora `google_sync`; advisory lock por (org, profissional). Não lê nenhum GUC hoje.
- Handler `app/api/v1/agenda/agendamentos/_handler.ts` grava `source` = `ui` (usuário) ou `mcp` (IA/token).
  A rota POST usa `requireRole("agent")`, não as chaves `agenda.*` (verificar na implementação).
- `clinic_agenda_historico` (9043): append-only, escrito por trigger, tem `motivo`, `ator`, `tipo` com CHECK
  fechado (sem "encaixe"). Reaproveitável: SIM, ampliando o CHECK em migration nova (aditivo) em vez de
  tabela paralela só para o rastro; `clinic_agenda_encaixes` guarda o fato do encaixe (quem conflitou).

## Regras
R1. Encaixe = marcar em horário que sobrepõe outro compromisso ocupante do mesmo profissional.
R2. Exige `agenda.encaixe` (nova, crítica=false, depende de `agenda.marcar`) e motivo de 5 a 500 caracteres.
R3. Fluxo só por função `security definer` (revoke de public/anon) que liga um GUC local à transação,
    lido pelo trigger 9005; sem o GUC o trigger continua recusando. GUC nunca vem do body.
R4. Origem IA/token/webhook nunca encaixa (a função recusa pelo ator, não pela UI).
R5. Encaixe nasce atrás de flag por organização (`settings.clinic.encaixe`), desligada.
R6. Tabela `clinic_agenda_encaixes` com `organization_id` + RLS `tenant_isolation_*_all` + teste de 2 orgs.
R7. Migration TRIPLA (arquivo 9xxx + MANIFEST + apêndice no baseline).
R8. Concessão: `agenda.encaixe` só para quem já tinha `agenda.marcar` E nível manager+ (ver dúvida 1);
    `agenda.marcar/remarcar/cancelar/registrar_desfecho` já concedidas hoje a quem tem nível agent: ninguém perde.

## Critérios (Given/When/Then)
C1. Dado flag de encaixe desligada, quando alguém tenta encaixar, então 409/422 `encaixe_desligado` e nada é gravado.
C2. Dado usuário com `agenda.encaixe` e flag ligada, quando marca sobre pending/confirmed do mesmo profissional
    informando motivo, então 201, o agendamento é criado e a resposta traz `encaixe: true`.
C3. Dado o mesmo cenário sem motivo (ou com menos de 5 caracteres), então 422 e nada é gravado.
C4. Dado usuário sem `agenda.encaixe`, quando tenta encaixar, então 403 `forbidden_permission` (details.permissao = `agenda.encaixe`).
C5. Dado horário ocupado e marcação comum (sem encaixe), então 409 listando paciente e horário de quem ocupa (como #64-#66).
C6. Dado encaixe sobre compromisso `completed`, então recusado: encaixe só sobre pending/confirmed.
C7. Dado encaixe feito, então existe linha em `clinic_agenda_encaixes` (org, agendamento novo, agendamentos
    sobrepostos, motivo, ator, quando) e evento no `clinic_agenda_historico` com tipo `encaixe`, motivo e ator.
C8. Dado encaixe feito, então a grade e a lista do dia mostram marca "Encaixe" no novo compromisso, e o detalhe mostra motivo e autor.
C9. Dado usuário sem `agenda.ver_outros`, quando lê o histórico/encaixe de agenda alheia, então 403 (reusa regra da 9042).
C10. Dado concorrência (duas sessões, um encaixe e uma marcação comum no mesmo instante), então sem perda: advisory lock mantém consistência.
C11. Dado ator `ai_agent`/`api_token`/`webhook_source` (ou `source = mcp`), quando tenta encaixar, então recusado no servidor e sem linha de encaixe.
C12. Dado sync Google, então `google_sync` segue ignorado pelo trigger e nunca gera encaixe.
C13. Dado usuário sem `agenda.marcar`, `agenda.remarcar`, `agenda.cancelar` ou `agenda.registrar_desfecho`,
     quando chama a respectiva ação, então 403 `forbidden_permission` com a chave em `details.permissao`.
C14. Dado o Dr. Bruno (papel Profissional de saúde), na lista da Agenda, então não vê "Remarcar" nem "Cancelar"
     (nem Compareceu/Faltou sem `registrar_desfecho`); chamada direta à API devolve 403 (prova Playwright + teste de rota).
C15. Dado usuário sem `agenda.ver_outros`, então o menu não mostra "Dia por profissional" e `/app/agenda/profissionais`
     redireciona/nega; a rota `dia-por-profissional` devolve 403. Com a chave, a porta aparece.
C16. Dado papel existente antes da migration, quando ela roda, então o conjunto de chaves `agenda.*` de cada papel é
     superconjunto do anterior (teste db compara antes/depois); rodar duas vezes não duplica (idempotente).
C17. Dado administrador, então segue com todas as chaves, inclusive `agenda.encaixe`.
C18. Dado qualquer leitura/log desta feature, então sem dados reais de paciente (fixtures sintéticas).

## Fora do escopo
Encaixe por IA; encaixe em horário bloqueado (bloqueio/folga: continua regra própria); fila de espera;
múltiplos procedimentos somando duração (S2/S3); mudar a flag `trava_sobreposicao`; relatório de encaixes.

## Dependências
S5 (papel profissional, 9044), 9005, 9042, 9043; `lib/clinic/agenda/conflito-do-bloqueio.ts` (formato do 409);
UPSTREAM.md se tocar `_handler.ts` (core): registrar e pedir aprovação.

## Dúvidas para o dono
1. Quem pode encaixar? Rec.: gerente e administrador por padrão; recepção só se o dono conceder a chave.
2. Encaixe sobre horário fora do expediente/folga do profissional? Rec.: fora desta S6; só sobre agendamento.
3. Profissional pode cancelar/remarcar os PRÓPRIOS atendimentos? Rec.: não agora (some o botão); conceder depois por papel.
4. Avisar o paciente sobreposto ao encaixar? Rec.: não automático; só marcar para a recepção ver.
5. Flag `encaixe` ligada em quais organizações no início? Rec.: só a clínica-piloto, após a validação.
