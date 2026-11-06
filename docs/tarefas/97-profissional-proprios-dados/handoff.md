# #97 — Profissionais: atalho em Configurações e o profissional edita só os próprios dados

Decisões do dono (recomendação da issue): o profissional **não** altera as próprias especialidades nem o "ativo";
**altera** o próprio registro no conselho (conselho, número, UF), com auditoria `clinic.profissional.proprios_dados`.

## O que mudou

| Peça | Onde |
|---|---|
| Migration 8004 (tripla): `fn_clinic_salvar_meu_registro` (definer) — só a ficha de `auth.uid()`, só conselho/número/UF, não cria ficha | `supabase/migrations/20261105120000_8004_clinic_profissional_proprio_registro.sql`, MANIFEST, baseline |
| Rota `GET/PATCH /api/v1/clinic/profissionais/eu` (`agenda.bloquear_horario`; corpo estrito — `user_id`, especialidades e ativo → 422) | `app/api/v1/clinic/profissionais/eu/route.ts` |
| Aba "Meus dados" (próprio cartão, registro, própria jornada) e opções da clínica só para a gerência | `components/clinic/MeusDados.tsx`, `app/app/settings/tenant/profissionais/_client.tsx` |
| Menu: Profissionais também com `agenda.bloquear_horario` (`permissaoAlternativa`, core registrado no UPSTREAM.md) | `lib/navigation/{catalogo,interface}.ts` |
| Atalho no painel de Configurações (só para quem já vê a tela; não conta como morada) | `lib/clinic/navegacao/{modulos,projecao}.ts`, `app/app/inicio/[modulo]/page.tsx` |

Fora: a rota da jornada aceitar `profissionais.gerenciar` sem nível manager (item 5 da issue) — a RLS de
`attendant_availability` é por nível; mudar pede outra migration. Fica como está (ninguém perde acesso).

## Prova

- Banco: `tests/invariants/clinic-profissional-proprio-registro.test.ts` — 9/9 contra o Postgres local.
- Rota: `tests/unit/clinic-profissional-meus-dados-rota.test.ts` — 11/11; sabotagem (sem `.strict()`) → 4 vermelhos.
- Menu/módulos/vizinhos: 13 arquivos, 187 testes; cercas de migration/baseline: 12 arquivos, 55 testes.
- Tela (3001, dados fictícios da clínica demo):
  - dr.bruno vê "Profissionais" no menu, abas só "Meus dados" e "Bloqueios", nenhum cartão de colega;
    salvou o número do registro; API: jornada da dra.ana 403, ficha da dra.ana 403, `/eu` com especialidades 422, com `user_id` 422.
  - dono: atalho "Profissionais e especialidades" no painel de Configurações abre a tela completa (7 cartões).

- menu do profissional — `evidence/97-profissional/97-1-menu-do-profissional.png`
- registro salvo — `evidence/97-profissional/97-3-registro-salvo.png`
- própria jornada — `evidence/97-profissional/97-4-minha-jornada.png`
- atalho em Configurações — `evidence/97-profissional/97-5-atalho-em-configuracoes.png`
