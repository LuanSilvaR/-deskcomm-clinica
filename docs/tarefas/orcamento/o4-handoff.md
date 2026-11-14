# Orçamento → Contrato — O4: pós-aceite (handoff)

Plano: `docs/tarefas/orcamento/plano.md` (PR #106). Depende da O3 (PR #109, migration 8008).

## O que entrou
- **Migration 8009** (`20261107180000_8009_clinic_orcamentos_pos_aceite.sql`, tripla).
  - **Gatilho `fn_clinic_orcamento_ao_aprovar`** (sem HTTP): quando o orçamento vira "aprovado", o que acontece no aceite do contrato, chama `fn_clinic_orcamento_pos_aceite` na mesma transação.
  - **Plano de tratamento** ativo, com as sessões contratadas: cada item vira sessões × quantidade sessões planejadas, numeradas, do procedimento ou do tipo de serviço.
  - **Comanda aberta** (`sales`/`sale_items`):
    - leva os itens com os preços do orçamento, o desconto do orçamento e o profissional como atendente;
    - a comissão vem da regra em vigor, com a mesma precedência da inclusão manual;
    - a observação traz o pagamento combinado (forma, entrada e parcelas);
    - a ligação fica em `clinic_orcamento_vendas` (1:1), então `sales` não muda.
  - **Idempotente.** Se o pós-aceite falha, **o aceite fica**: o erro vai para `pos_aceite_erro`, e o botão "Gerar plano e comanda" chama `fn_clinic_orcamento_reprocessar` (`orcamentos.criar`).
- **API:** `POST /api/v1/clinic/orcamentos/[id]/reprocessar`.
- **Tela:** o orçamento aprovado mostra "Ver plano de tratamento" e "Comanda aberta — abrir comandas", ou o erro com o botão para gerar.

## Provas
- `tests/invariants/clinic-orcamentos-pos-aceite.test.ts` (5 casos):
  - o aceite pelo link (sem usuário) gera o plano e a comanda;
  - reprocessar não duplica nada;
  - a falha não derruba o aceite;
  - permissões e outra empresa;
  - RLS de `clinic_orcamento_vendas`.
- `tests/e2e/clinic-orcamentos-contrato.spec.ts`: depois do aceite, os links do plano e da comanda aparecem.

## Fica para depois
- **Parcelamento com recebíveis e taxa da maquininha:** quando o #58 (FN2) tiver merge, a comanda passa a nascer com as parcelas. Até lá, o caixa finaliza com a forma combinada.
- **O5:** lista e indicadores, mais as revisões `security-lgpd` e `health-compliance`.
