# Agenda da clínica — handoff (2026-10-08)

Plano completo e decisões do dono: [`plano.md`](plano.md) (S1–S7).
Branch: `feature/agenda-por-profissional` (a partir de `7167b28c9`), **NADA COMMITADO** — S1, S4 e S5
estão todas no working tree (~144 arquivos). Antes de qualquer coisa: `git status`.

## Estado

| Sprint | Estado | Migration |
|---|---|---|
| S1 — um profissional por vez | pronta e verificada | 9042 `agenda.ver_outros` |
| S4 — fluxo recepção → profissional | pronta e verificada | 9043 fluxo operacional |
| S5 — experiência do profissional | pronta e verificada | 9044 experiência do profissional |
| S2 — filtros | **pendente** | — |
| S3 — formulário de agendamento | **pendente** | (nova: `clinic_agendamento_procedimentos`) |
| S6 — encaixe, ACL e auditoria | **pendente** | (nova) |
| S7 — produtividade | **pendente** | — |

Próxima migration do fork: **9045** (`ls supabase/migrations | grep -oE "_9[0-9]{3}_" | sort | tail -1`).
A 9044 foi editada antes de commitar (nunca publicada); depois do commit, correção só com migration nova.

## Verificação da S5 (2026-10-08)

- `pnpm typecheck` e `pnpm lint`: verdes.
- `pnpm test:db`: 289/289 arquivos.
- Unit novos: `tests/unit/clinic-experiencia-do-profissional.test.ts` 16/16 (sabotagem da borda do
  conflito: 1 vermelho de 16, o previsto).
- `pnpm test:unit` completo: os vermelhos restantes são de ambiente/Windows/rede/timeout (lgpd-pdf,
  caminhos `\`, guarda-da-release, release-chega-na-lp, e2e-parte-4, passagem, indice-de-contato,
  rascunho-superado, agenda-meet/create-or-move-lead por timeout, cercas, gateway, executor-proprio,
  catalogo-de-ensaio, confianca-do-handoff, followups). **Não comparados com um checkout limpo** —
  conferir antes do PR.
- Tela: `tests/e2e/clinic-experiencia-do-profissional.spec.ts` 2/2 contra o dev server na 3001 com o seed
  de demonstração (`DEMO_SENHA`), capturas em `.superpowers/evidence/experiencia-do-profissional/`.
  Spec está em `FORA_DO_CI` (motivo no `e2e.yml`). Para rodar local sem o `next start` da config
  padrão, usar uma config temporária com `baseURL: http://localhost:3001` e sem `webServer`.
  Beatriz (recepção) não entrou na prova de tela.

## Pendências imediatas (antes das próximas sprints)

1. **Commits e PRs** de S1, S4 e S5 para `develop` (Conventional Commits em pt-BR; um PR por sprint ou
   um só — decidir com o dono). Conferir antes: identidade do commit, tripla das migrations 9042–9044
   (arquivo + `MANIFEST.md` + apêndice no `baseline.sql`), `UPSTREAM.md` (linhas S1/S4/S5 já escritas).
2. **Profissional ainda vê "Remarcar"/"Cancelar"** na lista da Agenda e a porta "Dia por profissional"
   no menu — fechar na S6 (servidor exigir `agenda.remarcar`/`agenda.cancelar`; porta com
   `agenda.ver_outros`).
3. Especialidade do profissional no "Iniciar atendimento" quando houver mais de uma compatível (5.5,
   opcional, não feito).
4. PRs #54 e #55 do GitHub seguem abertos (#55 precisa `gh auth refresh -s workflow` ou merge pela web).

## Mapa da S5 (onde está cada coisa)

- Migration: `supabase/migrations/20261008030000_9044_clinic_experiencia_do_profissional.sql`
  (chaves `pacientes.ver_todos`/`prontuario.ver_outros`, papel `profissional`, gatilho de atribuição,
  `clinic_agenda_blocks.tipo`, RLS restritiva do prontuário, gatilho "registro só do profissional").
- Catálogo/regras: `lib/clinic/acesso/catalogo.ts` (`PAPEL_PROFISSIONAL`), `lib/clinic/acesso/experiencia.ts`,
  `lib/clinic/acesso/chave-no-nucleo.ts`, `lib/clinic/pacientes/escopo-de-pacientes.ts`,
  `lib/clinic/agenda/conflito-do-bloqueio.ts`.
- Telas: `app/app/meu-dia/*`, `components/clinic/atendimento/{AcoesDoAtendimento,AvisoDeAtendimentoEmAndamento}.tsx`,
  `components/clinic/FormularioDeBloqueio.tsx`, `app/app/agenda/_client.tsx` (permissões vindas do servidor).
- Testes: `tests/unit/clinic-experiencia-do-profissional.test.ts`,
  `tests/invariants/clinic-experiencia-do-profissional.test.ts`, `tests/e2e/clinic-experiencia-do-profissional.spec.ts`.
- Seed: `scripts/seed-demo-simulacao/roteiro.ts` (Bruno/Carla/Diego = Profissional de saúde; Ana =
  Coordenação clínica). Recarregar: `npx tsx scripts/seed-demo-simulacao.ts`.

## Como retomar

Abrir uma sessão nova e pedir: "retome a agenda da clínica pelo `docs/tarefas/agenda-por-profissional/handoff.md`".
Ordem sugerida: pendência 1 (commits/PRs) → S6 (fecha a pendência 2) → S2 → S3 → S7.
