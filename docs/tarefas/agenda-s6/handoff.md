# agenda-s6 — handoff

## S6a — ACL das ações da agenda e porta do dia por profissional (issue #69)

| Critério | Como ficou | Prova |
|---|---|---|
| C13 | `POST/PATCH/DELETE /api/v1/agenda/agendamentos` exigem `agenda.marcar/remarcar/cancelar/registrar_desfecho` (além do papel `agent`); 403 `forbidden_permission` auditado com `details.permissao` | `tests/unit/clinic-guarda-da-agenda.test.ts` (11; sem a guarda, 4 vermelhos) |
| C14 | Lista, detalhe e grade só mostram remarcar/cancelar/confirmar/desfecho com a chave; o profissional não arrasta card | `tests/unit/clinic-agenda-acoes-por-chave.test.tsx`; tela abaixo; `tests/e2e/clinic-agenda-acl.spec.ts` |
| C15 | "Dia por profissional" exige `agenda.ver_outros` no menu, na página (URL direta → `/app/agenda`) e em `GET /api/v1/clinic/dia-por-profissional` (403) | tela + spec |
| C17 | Gerente/administrador seguem com todas as ações e a porta | tela + spec |

Medido na 3001 (2026-11-04, seed de demonstração):

```
BRUNO botões na lista: {"remarcar-":0,"cancelar-":0,"confirmar-":0,"faltou-":0,"realizado-":0}
BRUNO PATCH starts_at → 403 forbidden_permission agenda.remarcar
BRUNO PATCH status=no_show → 403 forbidden_permission agenda.registrar_desfecho
BRUNO DELETE → 403 forbidden_permission agenda.cancelar
BRUNO links 'Dia por profissional' no menu: 0
BRUNO /app/agenda/profissionais → /app/agenda
BRUNO GET dia-por-profissional → 403
ANA botões na lista: {"remarcar-":1,"cancelar-":1}
ANA /app/agenda/profissionais → /app/agenda/profissionais · GET → 200
```

### Evidências de tela

- Dr. Bruno (Profissional de saúde): "Minha agenda" sem Remarcar/Cancelar e sem "Dia por profissional" no menu —
  ![Dr. Bruno sem ações](../../../evidence/agenda-s6/s6a-1-bruno-agenda-sem-acoes.png)
- Dra. Ana (gerente): a lista segue com Remarcar/Cancelar —
  ![Dra. Ana com ações](../../../evidence/agenda-s6/s6a-2-ana-agenda-com-acoes.png)
- Dra. Ana abre o "Dia por profissional" —
  ![Dia por profissional](../../../evidence/agenda-s6/s6a-3-ana-dia-por-profissional.png)

Spec formal (fora do CI, depende do seed): `DEMO_SENHA=… pnpm exec playwright test clinic-agenda-acl` contra a 3001.

### Core tocado
Registrado em `UPSTREAM.md` (linha "Agenda S6a"). Todas as props novas são opcionais e o default é o comportamento do upstream.

### Dívidas
- **S6c:** a ACL fica na rota HTTP; `fn_appointment_change` e escrita direta por PostgREST com sessão ainda não conferem a chave.
- Papel personalizado sem as chaves passa a receber 403 em PATCH/DELETE (os papéis de sistema e o modo legado não perdem).

## S6b — encaixe (pendente)
Ver `plano.md`, passos 6–12 (migration 9045).
