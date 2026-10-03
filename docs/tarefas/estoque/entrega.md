# Entrega — Controle de Estoque integrado ao Prontuário

## Ordem de merge (um PR por fase; cada um depende dos anteriores)
| Fase | PR | Migration | O que entrega |
|---|---|---|---|
| E0 Base | #42 | 9028 | produtos com unidade/fator/lote, locais, entrada, transferência, perda, ajuste, estorno; saldo = soma dos movimentos |
| E1 Sincronia | #43 | 9029 | `catalog_products.quantidade` segue o saldo dos produtos "gerenciados" |
| E2 Baixa | #44 | 9030 | finalizar o atendimento dá baixa dos insumos (FEFO, local da sala); falta vira pendência |
| E3 Kit e reserva | #45 | 9031 | kit por procedimento; reserva ao iniciar e D-1 da agenda; finalizar converte, anular libera |
| E4 Frascos | #46 | 9032 | frasco aberto (toxina frasco → U), validade pós-abertura, encerrar com sobra = perda |
| E5 NF-e | #47 | 9033 | upload do XML (`fast-xml-parser`, sem DOCTYPE), conferência, lançamento, conta a pagar opcional |
| E6 Inventário | #48 | 9034 | contagem por local; fechar gera o acerto das diferenças |
| E7 Alertas | #49 | 9035 | mínimo, ponto de pedido, validade, lote/frasco vencido, pendências (cron de hora em hora) |
| E8 Relatórios | #50 | 9036 | consumo, perdas, sugestão de compra; recall de lote só com chave clínica; privilégio por coluna |
| E9 IA | (este) | 9037 | Groq como provedor; IA sugere o produto na NF-e; ferramenta MCP de consulta do estoque |

Mesclar na ordem acima. Cada migration é aditiva e está no `baseline.sql` (instalação nova) e na cadeia.

## Como ligar e testar
1. Configurações › Profissionais › cartão **Estoque** → "Ligar" (nasce desligado em toda clínica).
2. Estoque › Produtos: configure unidade de estoque, unidade de aplicação e fator (ex.: frasco = 100 U),
   lote obrigatório, controlado (conselhos), mínimo e ponto de pedido; marque "Controlar a quantidade pelo estoque".
3. Entrada manual com lote e validade, ou Estoque › Compras (NF-e) → enviar o XML → conferir item a item → Lançar.
4. Procedimentos › (procedimento) › aba **Kit**: insumos padrão. Ao iniciar o atendimento o kit vira reserva.
5. Finalize um atendimento com insumos: em até ~1 min (drenagem do `event_log`) o saldo baixa; o que faltar
   aparece em Estoque › Pendências.
6. Estoque › Alertas, Inventário e Relatórios. O recall de lote só aparece para quem tem a chave clínica
   `estoque.rastreio_lote` (papel clínico explícito; administrador sem papel clínico não vê).
7. IA (opcional): Configurações › Inteligência Artificial → Groq (chave `gsk_…`) ou outro provedor; o ponto
   "Sugerir o produto dos itens da nota fiscal" escolhe o modelo. A ferramenta "Consultar o estoque da clínica"
   fica no pacote Organizar das capacidades do assistente.

## Decisões tomadas
- NF-e só por upload do XML; leitor `fast-xml-parser` (decisão do dono) com recusa de DOCTYPE/ENTITY e limite de 1 MB.
- Baixa ao finalizar; antes disso é reserva. O prontuário nunca falha por falta de estoque (vira pendência).
- Movimentos só acrescentam; correção = estorno. Saldo negativo é recusado no banco.
- Quem só tem `estoque.ver` não lê `contact_id`/`atendimento_id`/`profissional_user_id` dos movimentos
  (privilégio por coluna); a ligação com paciente só sai pelo recall, auditado e com chave clínica.
- A IA só recebe texto da nota e nomes de produtos; a resposta é sugestão (ids da lista, confiança ≥ 0,6).
- A ferramenta MCP é só leitura, sem paciente e sem custo; papel mínimo `agent` (nível base de `estoque.ver`)
  e só responde com o estoque ligado.
- Preços do Groq (centavos de dólar por milhão de tokens, entrada/saída): llama-3.3-70b-versatile 59/79,
  llama-3.1-8b-instant 5/8, openai/gpt-oss-120b 15/60 — tirados de páginas públicas de preço em out/2026
  (o site do Groq estava bloqueado no ambiente). **Conferir em groq.com/pricing** antes de cobrar por eles.

## Fica com a clínica
- Quais conselhos podem aplicar cada produto controlado (campo por produto).
- Mínimos, pontos de pedido e validade pós-abertura de cada produto.
- Se a NF-e gera conta a pagar (opção na hora de lançar; exige `financeiro.lancar`).
