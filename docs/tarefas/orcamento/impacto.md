# Orçamento → Contrato — impacto

Levantado na `develop` em adfb40f (2026-11-07).

## O que se reaproveita (não reconstruir)
| Peça | Onde | Uso no orçamento |
|---|---|---|
| Documento do tipo `contrato`, modelo versionado e imutável | migration 9023 (`clinic_modelos_documento`, `_versoes`) | O contrato do orçamento é um documento emitido a partir desse modelo |
| Emissão congelada com sha256 | `fn_clinic_documento_emitir` (9023); rota `app/api/v1/clinic/pacientes/[contactId]/documentos/route.ts` | O envio do orçamento emite o contrato com o texto já renderizado |
| Aceite presencial e por link de uso único | `fn_clinic_documento_aceitar`, `fn_clinic_documento_link_criar`, `fn_clinic_documento_publico_*`; página `app/(public)/termo/[token]/` | O aceite do contrato aprova o orçamento (aprovação em um passo) |
| Revogação e cancelamento | `fn_clinic_documento_encerrar` | Cancelar, recusar ou expirar o orçamento cancela o contrato; o distrato revoga |
| Renderização de marcadores | `lib/clinic/documentos/render.ts` | Ganha marcadores `orcamento.*` |
| Link pelo WhatsApp | `lib/clinic/documentos/whatsapp.ts` | Mesmo `wa.me` com mensagem própria |
| Plano de tratamento e sessões | migration 9021; `fn_clinic_plano_salvar`, `fn_clinic_plano_adicionar_sessoes` | O pós-aceite cria o plano com as sessões contratadas |
| Comanda | `sales`/`sale_items` (0351); `app/app/comandas/` | O pós-aceite abre a comanda "Contrato #N" |
| Parcelas e contas a receber | financeiro FN2, PR #58 (**ainda sem merge**) | O parcelamento combinado vira contas a receber |
| Taxas da maquininha (débito, crédito, parcelado por faixa) | FN1, PR #57 (**ainda sem merge**): `clinic_fin_taxas`, `lib/clinic/financeiro/taxas.ts` | Taxa e líquido estimado de cada forma no orçamento; repasse opcional |
| Vigência imutável de preços | padrão das taxas da FN1 (PR #57) | Mesmo desenho para `clinic_precos` |
| PDF | `@react-pdf/renderer` (já dependência); `lib/clinic/prontuario/pdf.tsx` | PDF do contrato aceito |
| ACL e opção por empresa | `lib/clinic/acesso/catalogo.ts`; `fn_clinic_definir_*`; `lib/clinic/flags.ts` | Permissões `orcamentos.*` e opção `orcamentos` |

## O que toca

**Banco** (migrations 8006–8009, TRIPLA):
- tabelas novas `clinic_precos`, `clinic_orcamentos`, `clinic_orcamento_itens` e `clinic_orcamento_vendas`;
- coluna aditiva `clinic_documentos_emitidos.orcamento_id`.

**Telas:**
- seção nova em `app/app/atendimentos/[id]/_client.tsx` (`SECOES`, cerca da linha 78);
- aba nova em `app/app/contacts/[id]/_client.tsx` (abas nas linhas 199, 213 e 338);
- página nova em Configurações › Tabela de preços;
- lista nova `/app/orcamentos`;
- módulo Financeiro do menu da clínica.

**Documentos:** marcadores novos em `render.ts` e uma versão nova do modelo padrão de contrato. As versões antigas continuam valendo.

**Núcleo:** nenhuma mudança obrigatória. A ligação com a comanda fica numa tabela 1:1 do fork, e não em coluna nova em `sales`.

## Riscos
- **Taxas dependem do #57 (FN1).** Sem ele, o orçamento sai sem taxa nem líquido (só o aviso).
- **O4 depende do #58 (FN2).** Sem ele, gera a comanda simples e o caixa parcela depois.
- **Ordem das migrations:** as 9039–9041 dos PRs financeiros têm timestamp anterior às 9042+ já mescladas (alerta em
  `docs/funcionalidades.md`). As do orçamento seguem a faixa 8xxx do fork (`CLAUDE.md`, regra 4).
- **Anulação:** as migrations 9026/9027 impedem anular um atendimento que tenha documento emitido ou aceito. Um orçamento enviado a partir do
  atendimento passa a bloquear a anulação; isso precisa ser explicado na tela.
- **Leitura de documentos:** a 9044 restringe a leitura de `clinic_documentos_emitidos` por profissional. A recepção precisa ver o
  contrato do orçamento; validar com `orcamentos.ver` sem abrir o prontuário.
