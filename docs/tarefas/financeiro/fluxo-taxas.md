# Fluxo — cadastro das tabelas de taxas

```
Configurações › Profissionais          Configurações › Maquininhas e taxas
[Financeiro da clínica: Ligar] ──────▶ 1. Nova maquininha
  (admin, MFA)                            ├─ "Começar de um modelo" (Ton / Cielo Smart / Mercado Pago)
                                          │     → cria a maquininha com os prazos do modelo
                                          │     → publica a 1ª tabela valendo HOJE (pode ser corrigida)
                                          └─ "Em branco" → só o nome; depois [Editar taxas]
                                       2. [Prazos e antecipação]
                                          Pix/débito/crédito D+N · tarifa por venda · antecipação % e modo
                                       3. [Editar taxas] → editor
                                          ├─ "Vale a partir de": amanhã (padrão) — hoje só na 1ª tabela
                                          ├─ linhas: forma × parcelas de/até × bandeira (ou todas) → taxa %
                                          └─ [Publicar tabela]
                                               ├─ data no passado e já existe tabela → recusa (a taxa não muda o passado)
                                               ├─ mesma data, já valendo → recusa ("publique a partir de amanhã")
                                               ├─ mesma data, ainda futura → substitui a programada
                                               └─ ok → "Valendo desde…" ou "Programada para…"
                                       4. Formas de pagamento: tipo + maquininha → [Salvar]
                                       5. Simulador: confere o líquido e a margem antes de usar no balcão
```

## Regras que o usuário vê
- Linha de bandeira específica vence "Todas". Entre linhas que servem, vence a faixa mais estreita (ex.: 6x a 11,30%
  vence 2x–6x a 7,70%).
- Faixa sem linha (ex.: Cielo 4x no modelo) → o simulador diz "não tem taxa para essa forma e parcelas — complete a
  tabela".
- Débito e Pix são sempre 1x. A taxa fica entre 0% e 100%, com até 4 casas.

## Quem pode
| Ação | Permissão |
|---|---|
| Ver as maquininhas e simular | `financeiro.ver` |
| Cadastrar, mudar prazos, publicar tabelas, configurar formas | `financeiro.taxas` (gerente e administrador) |
| Ligar a opção | administrador, com MFA |
