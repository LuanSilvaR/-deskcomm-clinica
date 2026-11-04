# Segurança da fábrica

Política do produto: [SECURITY.md da raiz](../../SECURITY.md) · ameaças: [docs/threat-model.md](../threat-model.md) ·
regras de código: [CLAUDE.md](../../CLAUDE.md) (regras 5, 6, 8). Este arquivo cobre **o que os agentes podem fazer**.

## Camadas de proteção (da mais forte para a mais fraca)

1. **`permissions.deny` em `.claude/settings.json`** — o Claude Code recusa, para qualquer agente:
   ler `.env*`, `git push --force`/`-f`, `git push origin main`, `supabase db push`,
   `supabase db reset --linked`, `rm -rf`.
2. **Hook `PreToolUse` `.claude/hooks/proteger.sh`** — bloqueia Edit/Write em: migration existente,
   migration nova sem `_clinic_`, `.env*`, `proxy.ts`, `lib/supabase/*`, `lib/auth/*`, `lib/api/auth-dual.ts`,
   `lib/mcp/auth.ts`, `supabase/baseline.sql` (área sensível do core = aprovação explícita).
3. **Frontmatter `tools`** — revisores (`code-reviewer`, `tech-lead`, `security-lgpd`, `health-compliance`,
   `ux-accessibility`, `regression-guardian`, `codebase-explorer`, `scrum-master`, `devops-engineer`)
   não têm Edit/Write.
4. **Instrução do agente** — "não faça push/deploy/merge". É a camada mais fraca: vale só junto das outras.

Limite conhecido: agente com `Bash` consegue escrever pelo shell. A garantia de "somente leitura" do
`code-reviewer` é instrução + revisão do diff, não bloqueio técnico. Para revisão com garantia, rode em
Plan mode ou confira `git status` antes e depois.

## Exige ordem explícita do dono (sempre)

push · abrir/mergear PR · deploy · tag/release · `reset --hard` · descartar mudança local · editar migration
aplicada · apagar tabela/dado · trocar framework · mudar contrato público · alterar core sem UPSTREAM.md ·
mexer em secrets, workflows ou variáveis de produção · desligar hook ou usar `--dangerously-skip-permissions`.

## Dados

Sem dados reais de pacientes em código, testes, logs, prompts de subagente ou relatórios da fábrica.
Relatório não reproduz segredo, token ou URL assinada — cite o arquivo e a linha.
