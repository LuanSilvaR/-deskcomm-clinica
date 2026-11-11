# #83 — Lembrete de consulta: Meta primeiro, QR code de reserva — handoff

Branch: `feature/upstream-lembrete-por-modelo-aprovado` · Épico #78 (lote 2) · Upstream #3891 (adaptação manual).
Spec: [design.md](design.md) · Plano: [plano.md](plano.md).

## O que mudou, em português simples
Antes, o lembrete de consulta saía por qualquer número de WhatsApp conectado. Se fosse o número oficial da Meta e a
janela de 24 horas com o paciente estivesse fechada, a Meta recusava e o lembrete nunca chegava.

Agora, **se a clínica ligar a chave nova**, o lembrete segue esta ordem:

1. Tenta o **número oficial da Meta**. Janela aberta: manda o texto de sempre. Janela fechada: manda o **modelo
   aprovado** escolhido para aquele tipo de agendamento.
2. Se a Meta não puder (sem modelo, fora do horário, recusou com certeza), tenta o **número de QR code**.
3. Se nenhum funcionar, o lembrete **não** é marcado como enviado, a tela mostra o motivo e a próxima rodada tenta de
   novo, no máximo 3 vezes. Enquanto ainda há tentativa, o selo diz "Lembrete não saiu — tentando de novo (1/3)"; só
   depois da 3ª ele diz "— ligar". A tarefa "ligar" (a que já existia) **não** abre na 3ª falha: ela só abre quando a
   **confirmação automática** da clínica está ligada e **somente na janela de até 4 horas antes da consulta**. Com a
   confirmação automática desligada, não abre tarefa nenhuma (só o selo na tela).
4. Se a Meta aceitar o envio e só depois avisar que não entregou, o lembrete sai na hora pelo QR code (uma única vez),
   desde que a consulta ainda não tenha começado.

Regras de segurança: nunca manda duas vezes (erro duvidoso não reenvia); quem pediu para não receber mensagens
(contato bloqueado) não recebe por nenhum número e, com a chave ligada, também **não ganha tarefa de ligar**; **chave desligada = tudo como era antes**. A chave **nasce
desligada**.

## Como validar na 3001 (passo a passo)
A 3001 está rodando esta branch, no banco de teste local (clínica fictícia "E2E Test Org").

1. Abra `http://localhost:3001/login` e entre como administrador de teste (`e2e-admin@deskcomm.test`; a senha e o código
   de duas etapas estão no arquivo `.e2e-creds.json` da pasta `wt-lembrete-83`).
2. Vá em **Configurações › Profissionais**. Procure o cartão **"Lembrete pelo número oficial, com reserva pelo QR code"**.
   Ele deve estar com o botão **Ligar** (chave desligada, cartão cinza).
3. Vá em **Configurações › Agendamentos**, clique em **Editar** num tipo que tenha o aviso ligado. Com a chave
   desligada **não deve existir** o campo "Se a janela de 24 h já tiver fechado, mandar este modelo aprovado".
4. Volte a Profissionais e clique em **Ligar** no cartão. O botão passa a **Desligar**.
5. Volte a Agendamentos › Editar. Agora o campo do modelo aparece, com a opção **"Nenhum"** e a frase
   **"Crie um em Conexões → Modelos"** (se não houver modelo aprovado).
6. Para ver o aviso de "não saiu": o lembrete só marca esse motivo quando roda de verdade com um paciente. O motivo
   aparece como um selo amarelo no cartão do paciente em **Recepção** e no histórico da agenda, por exemplo
   **"Lembrete não saiu: janela fechada e sem modelo aprovado — ligar"**. O teste automático cria esse caso de mentira
   (veja a foto 05) e apaga depois.
7. **Deixe a chave desligada** ao terminar (clique em **Desligar**). Em produção ninguém é afetado até alguém ligar.

O que **não** dá para validar aqui: o envio de verdade pela Meta. Não há número oficial conectado no ambiente de teste, e
nenhum teste chama a Meta, o WhatsApp ou IA. Essa parte é provada pelos testes automáticos (sem envio real).

## Provas pela tela (Playwright contra a 3001)
Spec: `tests/e2e/agenda-lembrete-com-reserva.spec.ts` — 1 teste, passou (21,9 s). Ele liga e desliga a chave, confere
o seletor, confere o selo e devolve a chave a **desligada**, apagando tudo o que criou.

| Foto | O que mostra |
|---|---|
| `evidence/83-lembrete-com-reserva/01-seletor-ausente-com-a-chave-desligada.png` | chave desligada: o seletor de modelo **não** existe |
| `evidence/83-lembrete-com-reserva/02-chave-desligada-em-profissionais.png` | cartão novo em Profissionais, desligado |
| `evidence/83-lembrete-com-reserva/03-chave-ligada-em-profissionais.png` | cartão ligado (botão "Desligar") |
| `evidence/83-lembrete-com-reserva/04-seletor-de-modelo-com-a-chave-ligada.png` | seletor com "Nenhum" e a frase de onde criar o modelo |
| `evidence/83-lembrete-com-reserva/05-selo-lembrete-sem-modelo.png` | selo "Lembrete não saiu: janela fechada e sem modelo aprovado — ligar" na Recepção |

Observação: o selo só aparece com a chave **ligada** (de propósito: desligada, a tela é idêntica à de antes). Ele
aparece na Recepção e no histórico da agenda; o painel de detalhe da consulta continua mostrando só o pedido de
confirmação.

## Verify
Cada comando redirecionado para `../wt-lembrete-83-t9-*.log`.

| Comando | Resultado |
|---|---|
| `pnpm lint` | exit 0 (0 erros, 427 avisos que já existiam) |
| `pnpm typecheck` | exit 0 |
| `pnpm test:db` | 310 de 311 arquivos verdes (2699 testes). O 1 vermelho, `agenda-meet-export` ("baseline completo reaplicado"), estourou 30 s porque rodei o `test:unit` ao mesmo tempo (máquina lenta); sozinho: **exit 0, 6/6 verdes** (`pnpm test:db tests/invariants/agenda-meet-export.test.ts`) |
| `pnpm test:unit` (sem `.env.local`) | 1ª rodada: 21 arquivos vermelhos de 1409. **2 eram desta branch e foram corrigidos** (commit `fix(agenda): cerca tela-rota e lista do CI…`): `agenda-reativar-tipo` (o PATCH do tipo calculava o modelo dentro do corpo) e `e2e-cobertura-completa` (a spec nova não estava numa lista do CI). Os 2 passam agora (25/25 com a pasta da tela). Os outros **19 falham igual numa cópia limpa da `origin/develop` sem `.env`** (mesmos arquivos, conferido arquivo a arquivo): sem regressão |
| Prova pela tela (Playwright, 3001) | 1 teste, passou |

Os 19 arquivos que também falham na `develop` limpa (ambiente Windows/PDF/guarda de release, nada do #83):
`rascunho-superado-nao-e-regravado`, `guarda-da-release-reconhece-o-corte`, `guarda-da-release-confere-identidade`,
`followups-de-demonstracao-sao-possiveis`, `release-chega-na-lp`, `e2e-parte-4-fala-com-os-servicos-do-runner`,
`telas-sem-dado-de-mentira`, `tag-em-lote-mostra-existentes`, `passagem-motivo-em-portugues`,
`confianca-do-handoff-nao-e-similaridade`, `lib/theme.test.tsx`, `indice-de-contato-ignora-ficha-mesclada`,
`lgpd-pdf-meet`, `catalogo-de-ensaio-espelha-o-vocabulario`, `faixa-de-conexao-caida-vem-do-seam`,
`executor-proprio-so-roda-o-que-e-nosso`, `lgpd-pdf-replies`, `sem-marcador-de-conflito`,
`cercas-sao-selecionadas-pelo-import`.

Nota: ao fim do Playwright no Windows aparece `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` e o processo
sai com 127 mesmo com "1 passed" — é um defeito conhecido do Node no Windows ao encerrar, não do teste.

## Antes de publicar (ordem importa)
> **ATENÇÃO — risco alto:** aplique a migration **8023 ANTES de subir o código**. Se o código subir primeiro, o robô
> que manda os lembretes (cron) passa a dar erro para **TODAS as clínicas, mesmo as de chave desligada**, e **nenhum
> lembrete sai** até a migration ser aplicada. Não é só as telas que quebram.

**A migration 8023 precisa ser aplicada no banco ANTES de subir o código.** Sem ela, as colunas novas
(`reminder_meta_template_id`, `reminder_tentativas`, `reminder_falha`, `reminder_falha_at`) não existem e as telas de
Agendamentos e a Recepção falham ao ler. A migration é aditiva e idempotente (nada removido). Arquivo:
`supabase/migrations/20261111120000_8023_clinic_lembrete_meta_com_reserva.sql` (também no `MANIFEST.md` e no
apêndice de `supabase/baseline.sql`). No banco local de desenvolvimento ela já foi aplicada.

Depois de subir, a chave continua **desligada** em todas as clínicas. Para usar: conectar o número oficial da Meta,
criar e aprovar um modelo em Conexões › Modelos, escolhê-lo no tipo de agendamento e só então ligar a chave.

## Limitações conhecidas (menores adiados durante a revisão)
Nenhuma impede o uso; ficam para um cartão de acabamento.
- A lista de exceções do teste de segurança cita a rota `clinic/config`; o fixture do teste da 8023 não limpa os dados
  ao final; a função nova está fora da ordem alfabética em `database.types.ts`.
- Faltam testes para a ordenação dos números com `metadata` vazio e com empate de data de criação.
- O adiamento por horário roda para todo número (sem efeito colateral conhecido); a ordem "QR falha, Meta duvidosa"
  não tem teste.
- Alguns testes do cron estão mais fracos do que o ideal (3ª tentativa, "rodada seguinte não reenvia"); a gravação do
  motivo ignora erro do banco (igual ao caminho antigo); faltam casos de 2ª tentativa e de degraus com contagens
  diferentes.
- Consulta marcada antes do horário do QR abrir: a reserva é liberada a cada rodada e a tarefa "ligar" da 9006 só
  abre depois (custo aceito); as linhas "aguardando" contam no limite de 200 da varredura da 9006; o `metadata` é
  regravado inteiro.
- Erro persistente ao ler o contato na reserva: a reivindicação é liberada a cada rodada, sem teto (falha fechada:
  nunca manda por engano).
- O teste da rota `clinic/config` não cobre o 403 da opção nova.
- Uma 2ª ida ao banco só para `reminder_falha` (erro ignorado, como nas rotas vizinhas); a rota `agenda-info` faz uma
  consulta a `organizations` a mais mesmo com a chave desligada; classes de estilo duplicadas no selo.
- Fora do escopo (cartão novo): levar a mesma regra para o aviso de agendamento (#84) e para os follow-ups.
- Sem chave ligada e com a clínica só com QR code, nada muda (comportamento de hoje).
