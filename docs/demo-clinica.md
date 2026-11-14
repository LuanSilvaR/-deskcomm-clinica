# Clínica de demonstração — dados fictícios para testar o sistema

O script cria a empresa **"Clínica Demo"**, sete usuários e tudo o que as telas precisam para serem testadas de ponta
a ponta: agenda, atendimento, prontuário, estoque, NF-e, alertas e relatórios.
**Todos os dados são fictícios**: nomes terminam em "(fictício/a)", telefones são da faixa +55 11 90000-0xxx e os
e-mails usam o domínio reservado `.test`.

> **Não é migration, de propósito.** Migration roda em toda instalação, inclusive a de produção, e levaria para lá
> usuários com senha conhecida e pacientes falsos. O script só roda quando alguém o chama e **se recusa** a escrever
> num banco que não é local, a não ser com `--confirmo-que-nao-e-producao`.

## Como rodar
Pré-requisito: o sistema instalado localmente com os PRs do prontuário e do estoque (#42 a #52) aplicados, e o
`.env.local` com `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_DB_URL` do Supabase local.

```bash
npx tsx scripts/seed-demo-clinica.ts                              # senha forte gerada na hora
DEMO_SENHA='MinhaSenhaDeTeste#2026' npx tsx scripts/seed-demo-clinica.ts   # senha escolhida (12+ caracteres)
```

No fim, a tela mostra a senha (a mesma para os sete) e a lista de e-mails. Tudo também fica em
`.demo-clinica-creds.json`, um arquivo fora do git. Rodar de novo não duplica nada; só troca a senha.

## Usuários
| E-mail | Quem é | O que deve conseguir fazer |
|---|---|---|
| `dono@clinica-demo.test` | Administrador / dono (sem papel clínico) | Configura equipe, agenda, estoque e IA. **Não vê prontuário.** |
| `dra.ana@clinica-demo.test` | Médica dermatologista, CRM (coordenação) | Atende, vê e escreve prontuário, reabre atendimento, faz o **rastreio de lote** e configura o estoque. |
| `dr.bruno@clinica-demo.test` | Cirurgião-dentista HOF, CRO | Atende e escreve prontuário; vê o estoque. |
| `carla.biomedica@clinica-demo.test` | Biomédica esteta, CRBM | Atende e escreve prontuário; vê o estoque. |
| `diego.enfermeiro@clinica-demo.test` | Enfermeiro, COREN | Atende e escreve prontuário. A toxina é controlada (CRM/CRO): o atendimento dele abre **pendência de habilitação**. |
| `recepcao@clinica-demo.test` | Recepcionista | Agenda, chegada do paciente e documentos. **Não vê** anamnese, evolução nem fotos. |
| `compras@clinica-demo.test` | Gestor de estoque e compras | Entradas, NF-e, inventário, custos e relatórios. **Não vê prontuário.** |

Os profissionais usam o modo de permissão padrão: quem é profissional ativo recebe as permissões clínicas do seu
nível. Para testar papéis personalizados, crie-os em Configurações › Papéis de acesso.

## O que já vem pronto
- **Equipe:** 4 profissionais com especialidades e conselhos; 2 salas; 4 tipos de serviço; 3 procedimentos.
- **Pacientes:** 8 fictícios.
- **Agenda:**
  - 4 atendimentos **já finalizados** ontem (toxina, preenchimento, limpeza de pele e toxina pelo enfermeiro), com
    evolução e insumos;
  - 3 compromissos hoje;
  - 3 nos próximos dias.
- **Estoque:**
  - 7 produtos configurados: toxina fracionável, rastreada e controlada; ácido hialurônico e anestésico rastreados;
    agulha, luva, gaze e máscara;
  - lotes com validade;
  - um lote de toxina vencendo em 25 dias, que aparece em **validade próxima**;
  - luva abaixo do ponto de pedido, que aparece em **sugestão de compra**;
  - carrinho da Sala 1 abastecido;
  - kits nos 3 procedimentos.
- **Baixa já feita** dos atendimentos de ontem: frasco de toxina aberto, saldo baixado, pendência de habilitação do
  enfermeiro e alertas abertos.

## Roteiro de teste sugerido
1. **Recepção:** entrar como `recepcao@…` e marcar a chegada de um paciente de hoje em `/app/recepcao`. Tentar abrir
   o prontuário de um paciente; o sistema deve recusar.
2. **Profissional:** entrar como `dra.ana@…`, abrir `/app/atendimentos` e ver o paciente aguardando.
   - Iniciar o atendimento, preencher a anamnese (o salvamento é automático) e registrar o procedimento.
   - O kit vem pré-preenchido. A toxina pede lote e validade porque é rastreada.
   - Finalizar o atendimento.
3. **Estoque:** entrar como `compras@…`, abrir Estoque e conferir:
   - a posição, os frascos abertos, as pendências e os alertas;
   - a sugestão de compra e os relatórios;
   - o bloqueio de um lote.
4. **Recall:** como `dra.ana@…`, ir em Estoque › Relatórios › Rastreio de lote, escolher o lote `TX-2401` e um
   motivo. A tela deve mostrar os pacientes que receberam o lote. Fazer o mesmo como `dono@…`: o rastreio não deve
   aparecer.
5. **Habilitação:** como `compras@…`, abrir Estoque › Pendências e ver a pendência do enfermeiro com a toxina.
   Marcar "ciente" com um motivo.

## Garantia
`tests/invariants/seed-demo-clinica.test.ts` roda o mesmo roteiro no Postgres real a cada `pnpm test:db`. O seed passa
pelas mesmas funções da tela, com a permissão de cada pessoa. O teste prova:
- os 4 atendimentos finalizados;
- a baixa do estoque e a pendência do enfermeiro;
- que recepção e dono não leem atendimentos;
- que rodar duas vezes não duplica nada.

Se uma regra mudar e o seed parar de funcionar, o CI avisa.
