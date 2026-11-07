# Orçamento → Contrato — O2: orçamento em rascunho (handoff)

Plano: `docs/tarefas/orcamento/plano.md` (PR #106). Depende da O1 (PR #107, migration 8006).

## O que entrou
- **Migration 8007** (`20261107140000_8007_clinic_orcamentos_rascunho.sql`, tripla).
  - **`clinic_orcamentos`:**
    - número sequencial por empresa e versão;
    - status com os 7 estados do plano;
    - totais com CHECK (`total = subtotal − desconto`);
    - desconto pendente ou aprovado;
    - `condicao_pagamento` jsonb;
    - validade (padrão hoje + 15).
  - **`clinic_orcamento_itens`:** o preço e a descrição vêm da **vigência atual** da tabela de preços, nunca do corpo da requisição. Preço desatualizado é recusado (`orcamento_preco_desatualizado`).
  - **Trigger `fn_clinic_orcamento_guarda`:** o orçamento não se apaga fora da cascata da empresa, e os itens só mudam em rascunho.
  - **Permissões `orcamentos.criar`, `orcamentos.aprovar_desconto` e `orcamentos.cancelar`:** no catálogo TS e no banco.
  - **Limite de desconto `settings.clinic.orcamentos_desconto_max_pct`** (padrão 10%, só o admin muda):
    - acima do limite, o desconto fica pendente;
    - quem tem `aprovar_desconto` aprova pelo botão, ou aprova automaticamente ao salvar.
  - **Pagamento:** `fn_clinic_orcamento_condicao` aceita só dinheiro, Pix, débito, crédito (à vista) e parcelado.
    - Parcelado vai de 2 a 24 vezes, com entrada opcional em dinheiro, Pix ou débito.
    - Calcula a parcela, e o centavo que sobra vai na 1ª.
- **API:**
  - `GET/POST /api/v1/clinic/orcamentos`;
  - `PATCH /api/v1/clinic/orcamentos/[id]`;
  - `POST …/[id]/aprovar-desconto`;
  - `POST …/[id]/cancelar` (o motivo não vai para a auditoria);
  - `PATCH /api/v1/clinic/config` com `orcamentos_desconto_max_pct`.
- **Tela, componente `components/clinic/orcamentos/OrcamentosDoPaciente.tsx`:**
  - seção **Orçamento** no atendimento, entre Procedimentos e Documentos;
  - aba **Orçamentos** na ficha do paciente (`?aba=orcamentos`);
  - prévia de subtotal, desconto, total e parcelas (espelho de `lib/clinic/orcamentos/orcamento.ts`; o banco recalcula);
  - limite de desconto na Tabela de preços.
- **O1 ajustada:** `ItemDaTabela` ganhou `preco_id`, a linha da vigência que o orçamento referencia.

## Provas
- `tests/invariants/clinic-orcamentos-rascunho.test.ts` (11 casos):
  - preço da tabela e preço desatualizado;
  - número sequencial;
  - parcelas com centavo;
  - as 5 formas;
  - desconto pendente e aprovado, e o limite do admin;
  - permissões;
  - imutabilidade;
  - cancelamento;
  - 2 empresas;
  - opção desligada;
  - anon;
  - cascata.
- `lib/clinic/orcamentos/orcamento.test.ts`: o espelho da conta e o schema, que não aceita preço, organização nem boleto.
- `tests/e2e/clinic-orcamentos-rascunho.spec.ts`, pela tela: itens, parcelado com entrada, edição e cancelamento.

## Fica para depois
- **O3:** enviar congela e emite o contrato; nova versão; recusa e expiração. A permissão de cancelar passa a valer também para enviado.
- **Papel "profissional" (modo por papéis):** não recebe `orcamentos.criar` automaticamente. No modo legado o profissional é atendente e já tem a permissão.
