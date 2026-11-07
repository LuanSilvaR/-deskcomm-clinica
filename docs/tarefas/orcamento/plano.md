# Orçamento → Contrato — plano técnico

Ver `historia.md` (critérios) e `impacto.md` (o que se reaproveita).

## Decisão de arquitetura
**O orçamento é uma entidade comercial própria. O contrato é um documento do módulo que já existe (9023), gerado a partir do
orçamento.**
- O orçamento guarda o *o quê e quanto*: itens, preços, desconto, pagamento e validade.
- O documento guarda o *texto aceito*, com sha256, aceite, link e revogação, que já são prova jurídica.
- O vínculo entre os dois é `clinic_documentos_emitidos.orcamento_id`.

Não se cria um sistema de contrato paralelo.

## Fluxo
```
Atendimento (ou ficha do paciente)
  └─ Novo orçamento: itens da Tabela de preços + desconto + pagamento + validade
       rascunho ──[Enviar]──▶ enviado (emite o CONTRATO com itens e valores; texto congelado)
                                 │  presencial (tablet) ou link (wa.me / copiar)
                                 ├─ ACEITA ─▶ aprovado ─▶ plano de tratamento + comanda aberta
                                 ├─ recusa / vence ─▶ recusado | expirado (contrato cancelado)
                                 └─ clínica cancela ─▶ cancelado
       Revisar = nova versão (a anterior fica "substituído"; o contrato dela é cancelado)
```

## Modelo de dados
Migrations 8006+, TRIPLA, tabelas `clinic_*`, RLS `tenant_isolation_*` + `acesso_ler` com `orcamentos.ver`, escrita só por funções.

| Tabela | Colunas principais | Regras |
|---|---|---|
| `clinic_precos` | `procedure_id` ou `event_type_id`, `sessoes` (1 = avulso), `descricao`, `preco_cents`, `vigente_desde`, `ativo` | Imutável: preço novo = vigência nova. Vale a de maior `vigente_desde` ≤ hoje |
| `clinic_orcamentos` | `numero` (sequencial por empresa), `contact_id`, `atendimento_id?`, `profissional_user_id`, `status` (`rascunho`/`enviado`/`aprovado`/`recusado`/`expirado`/`cancelado`/`substituido`), `subtotal_cents`, `desconto_cents`, `total_cents`, `condicao_pagamento` jsonb, `validade_ate`, `versao`, `substitui_id`, `desconto_aprovado_por`, `enviado_em`, `aprovado_em`, `documento_id` | Só o rascunho muda; o resto anda por funções; enviado e aprovado são imutáveis |
| `clinic_orcamento_itens` | `orcamento_id`, `preco_id`, `procedure_id`/`event_type_id`, `descricao` congelada, `sessoes`, `quantidade`, `preco_unitario_cents`, `desconto_cents`, `total_cents` | Imutável depois do envio |
| `clinic_orcamento_vendas` | `orcamento_id` ↔ `sale_id` (1:1) | Liga a comanda sem tocar o núcleo |
| `clinic_documentos_emitidos.orcamento_id` | coluna aditiva com FK composta | — |

**Opção:**
- `settings.clinic.orcamentos` (`fn_clinic_definir_orcamentos`, admin + MFA), que depende de `prontuario`;
- configuração em `settings.clinic.orc`: `validade_dias` (padrão 15) e limite de desconto por papel.

**Permissões** (não clínicas):

| Chave | Quem tem |
|---|---|
| `orcamentos.ver` | atendente |
| `orcamentos.criar` | atendente / profissional |
| `orcamentos.aprovar_desconto` | gerente |
| `orcamentos.precos` | gerente |
| `orcamentos.cancelar` | gerente |

## Funções
| Função | Faz |
|---|---|
| `fn_clinic_orcamento_salvar` | Cria e edita rascunho; recalcula os totais em centavos; preços da vigência |
| `fn_clinic_orcamento_aprovar_desconto` | Libera o desconto acima do limite do papel (auditado) |
| `fn_clinic_orcamento_enviar` | Congela; renderiza o contrato com os marcadores `orcamento.*`; chama `fn_clinic_documento_emitir` com `orcamento_id`; validade |
| `fn_clinic_orcamento_aprovar` | Interna, disparada pelo aceite do contrato vinculado; status aprovado; plano (`fn_clinic_plano_salvar` + `fn_clinic_plano_adicionar_sessoes`); comanda aberta |
| `fn_clinic_orcamento_recusar` / `_cancelar` / `_nova_versao` | Encerram e cancelam o contrato (`fn_clinic_documento_encerrar`) |
| `fn_clinic_orcamentos_expirar` | Cron diário: vencidos → expirado, contrato cancelado, link morto |

O gancho do aceite fica dentro das funções de aceite. Trigger sem HTTP, conforme a regra 7 do `CLAUDE.md`.

## Contrato
- **Marcadores novos:** `{{orcamento.numero}}`, `{{orcamento.itens}}` (tabela), `{{orcamento.total}}`, `{{orcamento.desconto}}`,
  `{{orcamento.pagamento}}`, `{{orcamento.forma_pagamento}}`, `{{orcamento.entrada}}`, `{{orcamento.parcelas}}` e
  `{{orcamento.validade}}` (detalhe em "Forma de pagamento no contrato").
- **Modelo padrão:** ganha uma versão nova que usa esses marcadores. As versões antigas continuam valendo para o que já foi emitido.
- **PDF do contrato aceito** (`@react-pdf/renderer`): texto, itens, forma de pagamento, tabela de parcelas, sha256 e aceite
  (data, nome, canal, IP).

## Forma de pagamento no contrato
**Estrutura de `clinic_orcamentos.condicao_pagamento`** (validada por Zod na rota e por CHECK na função `salvar`):
```json
{
  "tipo": "a_vista | parcelado",
  "forma": "pix | dinheiro | debito | credito | boleto | transferencia",
  "entrada": { "valor_cents": 30000, "forma": "pix" },
  "parcelas": 5,
  "primeiro_vencimento": "2026-12-10",
  "intervalo_dias": 30,
  "observacao": "texto livre curto, sem dado clínico"
}
```
- `entrada` é opcional. `parcelas` = 1 quando `tipo` é `a_vista`.
- **As parcelas são calculadas no envio e congeladas** num array `cronograma` dentro do próprio jsonb
  (`[{ "n": 1, "vencimento": "2026-12-10", "valor_cents": 24000 }, …]`). Rateio: `(total − entrada) / parcelas`, resto na 1ª.
  A função `enviar` confere que `entrada + Σ parcelas = total_cents`; se não bater, recusa.
- **Crédito parcelado:** o cronograma não tem vencimento; o contrato diz "em N vezes no cartão de crédito". Taxa da maquininha
  é custo da clínica (FN1) e **não** aparece para o paciente.
- Mudar a forma de pagamento depois do envio = **nova versão** do orçamento (o contrato aceito nunca muda).

**Marcadores:**
| Marcador | Sai no contrato |
|---|---|
| `{{orcamento.pagamento}}` | Parágrafo completo: "Total de R$ 1.500,00, com entrada de R$ 300,00 via Pix e 5 parcelas de R$ 240,00 via boleto, vencendo todo dia 10 a partir de 10/12/2026." |
| `{{orcamento.forma_pagamento}}` | "Boleto" (rótulo da forma) |
| `{{orcamento.entrada}}` | "R$ 300,00 via Pix" ou "sem entrada" |
| `{{orcamento.parcelas}}` | Tabela nº / vencimento / valor (no crédito: "5× no cartão de crédito") |
| `{{orcamento.total}}` | "R$ 1.500,00" |

- O modelo padrão de contrato ganha a cláusula "Do preço e da forma de pagamento" usando `{{orcamento.pagamento}}` e
  `{{orcamento.parcelas}}`. A clínica pode usar só os granulares no seu modelo.
- **Onde aparece:** no resumo da seção Orçamento (antes de enviar), no texto congelado do contrato (sha256 cobre o pagamento),
  na página pública `/termo/[token]`, no aceite presencial e no PDF.
- **Pós-aceite (O4):** a comanda herda a forma e o cronograma congelados; com a FN2 (#58) cada parcela vira conta a receber
  com o vencimento do contrato. Sem a FN2, a comanda nasce com a forma e o caixa registra as parcelas.

## Telas
- **Configurações › Tabela de preços:** por procedimento, avulso e pacotes, com vigências e limite de desconto por papel.
- **Atendimento › seção "Orçamento"**, entre Plano e Documentos: novo orçamento já com o paciente e o profissional, itens sugeridos do plano, total e parcelas.
- **Paciente › aba "Orçamentos":** lista com status; enviar (presencial ou link), revisar, cancelar e ver contrato/PDF.
- **Página pública `/termo/[token]`:** a de hoje, que passa a mostrar a tabela de itens e valores.
- **`/app/orcamentos`:** funil, conversão e valor aprovado no mês.

## Fases (um PR por fase, `feature/orcamento-oN` a partir da develop)
| Fase | Migration | Entrega | Critérios |
|---|---|---|---|
| O1 | 8006 | Tabela de preços + opção + permissões + tela | 1, 15, 16 |
| O2 | 8007 | Orçamento em rascunho, itens, desconto com limite, condição de pagamento, versão; seção e aba | 2–5, 10, 14 |
| O3 | 8008 | Enviar = contrato; aceite presencial e por link aprova; recusa; validade (cron); PDF | 6–9, 13, 18 |
| O4 | 8009 | Pós-aceite: plano + comanda (parcelas pela FN2 se o #58 estiver mesclado) | 11–12 |
| O5 | — | Lista e indicadores; revisões `security-lgpd` e `health-compliance`; e2e de ponta a ponta | 17 |

## Testes
- **Unit:** cálculo do orçamento (centavos, desconto, rateio das parcelas), render dos marcadores e a vigência do preço.
- **Banco** (`tests/invariants/clinic-orcamento-*.test.ts`):
  - isolamento entre 2 empresas e opção desligada;
  - limite de desconto;
  - imutabilidade depois do envio;
  - aceite aprova, plano com N sessões e comanda com o total;
  - recusa, expiração, nova versão e contrato cancelado;
  - a recepção vê o orçamento sem ver o prontuário.
- **e2e** (registrado em `.github/workflows/e2e.yml`): criar no atendimento → enviar → aceitar no tablet → plano e comanda
  aparecem; e o aceite por link.
- **Portões por fase:** `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:db` e `pnpm cercas`.
