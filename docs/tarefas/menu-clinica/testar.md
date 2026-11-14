# Menu da clínica — como baixar e testar na sua máquina

Branch: `claude/clinic-admin-panel-reorganization-6u6dgv` (saiu de `develop`; nada foi para `develop`/`main`).

## 1. Baixar a branch
```bash
git fetch origin
git switch claude/clinic-admin-panel-reorganization-6u6dgv
# primeira vez, se o switch reclamar:
git switch -c claude/clinic-admin-panel-reorganization-6u6dgv origin/claude/clinic-admin-panel-reorganization-6u6dgv
pnpm install            # Node 22, pnpm 9
```
Para voltar ao código normal depois: `git switch develop`.

## 2. Gates rápidos (sem banco)
```bash
pnpm lint && pnpm typecheck
pnpm vitest run lib/clinic/navegacao tests/unit/navegacao-completude.test.ts tests/unit/navegacao-registry.test.ts
pnpm test:unit          # suíte inteira (demora)
pnpm test:db            # precisa de Docker: baseline + invariantes, inclui clinic-menu-da-clinica
```

## 3. Banco de TESTE (nunca o de produção)
A única mudança de banco é uma função nova (`fn_clinic_definir_menu_clinica`, migration 9014). Nenhuma
tabela, coluna ou policy muda.
- Banco de teste que já existe: aplique só o arquivo
  `supabase/migrations/20260926140000_9014_clinic_menu_da_clinica.sql` (é idempotente), ou reaplique o
  `supabase/baseline.sql` inteiro (também idempotente).
- Banco novo: `supabase/baseline.sql` + `scripts/bootstrap-owner.ts`.

## 4. Ver na tela
1. `pnpm dev` e entre como **administrador**.
2. Abra `/app/inicio` (ou ⌘K → "Início"). No fim da tela: **"Experimente o menu da clínica" → Ligar o menu da clínica**.
   - Pede a verificação em duas etapas, como as outras opções da clínica.
   - Alternativa por SQL, logado como admin com MFA: `select fn_clinic_definir_menu_clinica('<org_id>', true);`
3. Confira:
   - Menu lateral por módulos: Início, Agenda, Atendimento, Pacientes, Contratos (Em breve), LGPD, Procedimentos,
     Equipamentos (Em breve), Profissionais, Financeiro, Comissões (Em breve), Notas fiscais (Em breve), Tarefas,
     Marketing, Agente de IA; no rodapé fixo, Perfil e acesso e Configurações.
   - "Em breve" não abre nada. Módulo com várias telas abre a lista; com mais de 6, mostra "Ver tudo (N)" →
     painel do módulo em `/app/inicio/<modulo>`.
   - Início: resumo do dia (atendimentos, faltas, tarefas, conversas não lidas — cada número só aparece para quem
     vê a tela de origem) e a grade de módulos.
   - Entrar `/app` leva ao Início.
4. Entre com um **atendente** e um **visualizador**: devem ver o menu novo e exatamente as mesmas telas que viam
   antes (compare com o ⌘K). Com "acesso por permissões" ligado, quem não tem `financeiro.ver` não vê Financeiro.
5. Clique em **"Voltar ao menu anterior"** no Início: o menu de sempre volta idêntico. Esse é o rollback.

## 5. Prova automatizada de tela
`tests/e2e/clinic-menu-da-clinica.spec.ts` (Playwright) — liga pelo Início, confere módulos, "Em breve", 900px sem
rolar, atendente, mobile 390px e desliga. Roda com o ambiente de e2e do projeto (`pnpm e2e:env`, `pnpm e2e:build`,
`pnpm test:e2e tests/e2e/clinic-menu-da-clinica.spec.ts`).
