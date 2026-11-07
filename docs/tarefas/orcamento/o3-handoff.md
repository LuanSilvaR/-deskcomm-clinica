# Orçamento → Contrato — O3: o envio gera o contrato (handoff)

Plano: `docs/tarefas/orcamento/plano.md` (PR #106). Depende da O2 (PR #108, migration 8007).

## O que entrou
- **Migration 8008** (`20261107160000_8008_clinic_orcamentos_contrato.sql`, tripla).
  - **Colunas aditivas:**
    - em `clinic_orcamentos`: `enviado_em`/`enviado_por`, `documento_id`, `aprovado_em`, `recusado_em`, `expirado_em` e `motivo_recusa`;
    - em `clinic_documentos_emitidos`: `orcamento_id`, fixo depois de preenchido.
  - **`fn_clinic_orcamento_enviar`:** congela o rascunho e emite o **contrato** pelo `fn_clinic_documento_emitir` de sempre (sha256, `documentos.emitir`, prontuário ligado). Bloqueia com desconto pendente, fora da validade ou com modelo que não é contrato.
  - **Gatilho `fn_clinic_orcamento_pelo_documento`** (sem HTTP):
    - o aceite do contrato, presencial ou pelo link, **aprova** o orçamento;
    - cancelar o contrato pela aba Documentos cancela o orçamento enviado.
  - **Recusar, cancelar (agora também o enviado), nova versão e expirar:** cancelam o contrato não respondido e invalidam o link.
  - **Nova versão:** mesmo número, versão + 1, itens copiados, uma versão aberta por número. O enviado vira "substituído".
  - **Cron `/api/v1/cron/orcamentos-expirar`:** de hora em hora (`docker/scheduler/entrypoint.sh`, registrado no UPSTREAM.md). Chama `fn_clinic_orcamentos_expirar`, só service role.
- **Texto do contrato** (`lib/clinic/orcamentos/contrato.ts`):
  - **Marcadores `orcamento.*`:** número, itens, subtotal, desconto, total, forma de pagamento, entrada, parcelas, pagamento por extenso e validade.
  - **Anexo automático:** se o modelo não traz `{{orcamento.itens}}` nem `{{orcamento.pagamento}}`, o texto ganha um **ANEXO** com os itens e a forma de pagamento. O modelo padrão atual não precisa mudar.
  - O texto é sempre montado no servidor a partir do orçamento gravado.
  - `render.ts` aceita `_` nos marcadores e conhece os novos.
- **API:**
  - `POST /api/v1/clinic/orcamentos/[id]/enviar`;
  - `POST …/recusar`;
  - `POST …/nova-versao`;
  - `GET …/contrato` (PDF): o texto congelado, o sha256 e o aceite, sem IP. O documento é lido pelo service role, filtrado pela organização da sessão e pelo `documento_id` do orçamento, que é lido via RLS com `orcamentos.ver`.
- **Tela:**
  - "Enviar e gerar contrato", "Paciente recusou", "Nova versão", "Baixar contrato (PDF)" e o aviso para colher o aceite em Documentos;
  - a aba Documentos atualiza a lista de orçamentos ao aceitar ou cancelar.

## Provas
- `tests/invariants/clinic-orcamentos-contrato.test.ts` (7 casos):
  - envio e congelamento;
  - aceite presencial e pelo link;
  - bloqueios do envio;
  - recusa e nova versão;
  - cancelamento pelos dois lados;
  - expiração só pelo service role;
  - outra empresa e anon.
- `lib/clinic/orcamentos/contrato.test.ts`: os marcadores e o anexo.
- `tests/e2e/clinic-orcamentos-contrato.spec.ts`: envio, link sem login mostrando a forma de pagamento, aceite → aprovado, e o PDF.

## Fica para depois
- **O4, pós-aceite:** plano de tratamento com as sessões contratadas e a comanda aberta.
- **O5:** lista `/app/orcamentos` e indicadores, mais as revisões `security-lgpd` e `health-compliance`.
