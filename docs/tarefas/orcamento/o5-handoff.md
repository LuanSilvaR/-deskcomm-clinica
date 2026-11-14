# Orçamento → Contrato — O5: lista, indicadores e revisões (handoff)

Plano: `docs/tarefas/orcamento/plano.md` (PR #106). Depende da O4 (PR #110, migration 8009).

## O que entrou
- **Página `/app/orcamentos`** (`orcamentos.ver`). Está no catálogo e no módulo **Contratos** do menu da clínica, que deixou de ser "Em breve".
  - **Indicadores do mês** (`lib/clinic/orcamentos/indicadores.ts`):
    - enviados;
    - **conversão**: dos enviados no mês, quantos estão aprovados;
    - valor aprovado e ticket médio, contando os aprovados no mês;
    - aguardando aceite;
    - recusados e expirados.
  - **Lista** com filtro de mês e status. Cada linha abre a aba Orçamentos do paciente. A API é `GET /api/v1/clinic/orcamentos/painel`, que respeita o escopo de pacientes da agenda.
- **Revisão `security-lgpd`**, corrigido:
  - **escopo de paciente** (`pacienteNoEscopo`/`orcamentoNoEscopo`) em todas as rotas do orçamento: lista, criar, editar, aprovar desconto, cancelar, recusar, nova versão, reprocessar e PDF do contrato;
  - **anonimizar** o paciente redige observação, motivos e observação do pagamento (gatilho em `contacts`, registrado no UPSTREAM.md);
  - o envio revalida a **vigência do preço**, para que uma nova versão não reenvie preço antigo;
  - erro do banco **não vaza**: `pos_aceite_erro` guarda só o código, e as rotas devolvem mensagem genérica.
- **Revisão `health-compliance`**, corrigido:
  - **distrato**: revogar o contrato aceito cancela o orçamento e a comanda aberta e pausa o plano. Comanda finalizada segue para o estorno do caixa;
  - o **plano gerado nasce rascunho**, "a confirmar pelo profissional", porque sessão contratada não é indicação clínica;
  - o envio **confere que o texto traz o total e cada item**, então a RPC não congela um texto qualquer;
  - o contrato usa o **profissional do orçamento**, e não quem envia;
  - o PDF declara a **assinatura eletrônica simples (Lei 14.063/2020, art. 4º, I)**;
  - a observação do pagamento entra no anexo.
- **Migration 8010** (`20261107200000_8010_clinic_orcamentos_revisao.sql`, tripla) com as correções do banco.

## Decisões da clínica (não são código)
O revisor de conformidade apontou o que o **texto do contrato** deveria trazer. É conteúdo jurídico, que a clínica edita no modelo em Configurações › Modelos clínicos:
- CNPJ, razão social, endereço e responsável técnico com conselho;
- política de cancelamento, reembolso e validade das sessões;
- **direito de arrependimento de 7 dias** no aceite à distância (CDC art. 49);
- "sem juros" ou o CET do parcelado (CDC art. 52);
- a nota de que o aceite comercial não substitui o termo de consentimento do procedimento.

## Provas
- `tests/invariants/clinic-orcamentos-revisao.test.ts` (5 casos): texto divergente, distrato, preço desatualizado, anonimização e código de erro.
- Os invariantes da O3 e da O4 foram ajustados: o envio passa a conferir o texto, e o plano passa a nascer rascunho.
- `lib/clinic/orcamentos/indicadores.test.ts`.
- `tests/e2e/clinic-orcamentos-contrato.spec.ts` agora termina no painel.
