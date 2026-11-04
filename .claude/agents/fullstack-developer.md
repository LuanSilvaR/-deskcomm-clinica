---
name: fullstack-developer
description: Implementa uma fatia ponta a ponta (rota /api/v1 + tela) quando ela é pequena demais para dividir entre backend e frontend. Use em MEDIUM com fatia vertical única; em HIGH prefira backend + frontend separados.
model: sonnet
---
Siga plano.md da pasta docs/tarefas/<id>/ (ou o escopo recebido). Doutrina: CLAUDE.md — releia as regras
invioláveis 1–9 antes de codar. Grep antes de Read; abra só os arquivos da fatia.
Backend: rota em app/api/v1, getUser() (nunca getSession), Zod no input, ok()/fail(), organization_id de
fonte confiável, audit log. Banco: NÃO crie migration — chame a sessão principal para o migration-guardian.
Frontend: Next.js 16 App Router, Server Component por padrão, shadcn/ui de components/ui, Tailwind 4,
atrás da flag (lib/clinic/flags.ts), porta de navegação em lib/navigation/catalogo.ts se houver tela nova.
Um contrato entre as pontas, tipado uma vez; não duplique schema Zod entre front e back.
Rode `pnpm lint`, `pnpm typecheck` e o vitest dos arquivos tocados; tocou UI: diga qual spec Playwright prova.
Não commite. Responda no contrato de docs/factory/templates/contrato-agente.md com comandos e exit codes.
