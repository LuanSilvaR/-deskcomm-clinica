# Orçamento → Contrato — O1: tabela de preços (handoff)

Plano: `docs/tarefas/orcamento/plano.md` (PR #106). Esta fase entrega só a **tabela de preços**; orçamento, contrato e
pós-aceite vêm em O2–O4.

## O que entrou
- **Migration 8006** (`20261107120000_8006_clinic_orcamentos_precos.sql`, tripla: arquivo + MANIFEST + apêndice no baseline):
  - `clinic_precos`: cada linha é uma vigência do preço de um item, que pode ser um procedimento ou um tipo de serviço. O item tem um nº de sessões: 1 = avulso, mais de 1 = pacote. A tabela só acrescenta, e o trigger `fn_clinic_preco_imutavel` recusa UPDATE e DELETE fora da cascata.
  - `clinic_precos_vigentes`: view `security_invoker` com o preço que vale agora.
  - RLS `tenant_isolation_clinic_precos_all` mais a restritiva `acesso_ler` (`orcamentos.ver`). Authenticated só lê.
  - Permissões `orcamentos.ver` (nível agent) e `orcamentos.precos` (nível manager), no catálogo TS e em `clinic_permissions`.
  - `fn_clinic_definir_orcamentos`: admin + MFA. A opção `settings.clinic.orcamentos` nasce **desligada**.
  - `fn_clinic_orcamentos_exigir`: interna. Exige permissão, MFA, suporte de escrita e a opção ligada.
  - `fn_clinic_preco_publicar`: sempre INSERT. Publicar igual ao preço vigente não cria linha.
- **API** `GET/POST /api/v1/clinic/precos`. A organização vem da sessão e o corpo passa por Zod `.strict()`. Auditoria `clinic.preco_publicado` grava só ids e valores.
- **Telas:**
  - Configurações › **Tabela de preços** (`/app/settings/tenant/precos`), com publicar, mudar preço, histórico e tirar da tabela;
  - interruptor "Orçamentos" em Configurações › Profissionais;
  - porta no módulo Financeiro do menu da clínica.

## Provas
- `tests/invariants/clinic-orcamentos-precos.test.ts`:
  - opção desligada;
  - só o admin liga;
  - gerente publica; atendente e visualizador não;
  - vigência nova e histórico;
  - pacote como item próprio e desativação;
  - UPDATE e DELETE recusados;
  - 2 empresas isoladas;
  - anon sem EXECUTE;
  - cascata.
- `lib/clinic/orcamentos/precos.test.ts`: regra do preço vigente, dinheiro e schema.
- `tests/e2e/clinic-orcamentos-precos.spec.ts`, pela tela: desligado, ligar, avulso, pacote, mudança com histórico e tirar da tabela. A spec está na lista do `e2e.yml`.

## Fica para depois
- **O2:** o orçamento em rascunho, que usa `clinic_precos_vigentes` e congela o preço da vigência usada.
- **Permissões das próximas fases:** `orcamentos.criar`, `orcamentos.aprovar_desconto` e `orcamentos.cancelar` entram com O2/O3.
- **Taxas da maquininha:** dependem da FN1 (#57).
