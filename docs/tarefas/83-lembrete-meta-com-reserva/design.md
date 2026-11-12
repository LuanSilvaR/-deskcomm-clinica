# #83 — Lembrete de consulta: Meta primeiro, QR code de reserva

Issue: https://github.com/LuanSilvaR/-deskcomm-clinica/issues/83 · Épico #78 (lote 2) · Upstream #3891 (`91ce60dec`, adaptação manual)
Branch: `feature/upstream-lembrete-por-modelo-aprovado` · Nível: HIGH (envio de WhatsApp)

## Intenção (palavras do dono, 2026-11-11)
- "Quero que deixe todos funcionando, assim quando um apresentar problema terei o outro como backup."
- "A preferência deverá ser sempre a API da Meta, que é o mais indicado; quando ela falhar, devemos seguir pelos
  caminhos alternativos, que seria o do QR code."
- Escopo aprovado: **só o lembrete de consulta** (com o pedido de SIM/NÃO que vai junto). Levar a mesma regra para o
  aviso de agendamento (#84) e os acompanhamentos (follow-up) é **cartão novo**, depois.

Lembrete é a principal arma contra falta. Hoje o cron `agenda-reminder` pega **qualquer** `channel_session` WORKING
da org (`limit(1)`, sem ordem) e manda texto livre; se falhar, tenta de novo na próxima rodada pelo mesmo caminho.
Num número oficial (Meta) com a janela de 24 h fechada, o texto livre é recusado e o lembrete nunca chega.

## Como deve funcionar (decidido com o dono)
Para cada lembrete vencido, uma **lista de caminhos em ordem**, tentados um a um até um dar certo:

1. **Números da Meta (`meta_cloud`) conectados**, primeiro.
   - Janela de 24 h **aberta** com aquele contato naquele número → texto de sempre (molde do tipo ou frase padrão).
   - Janela **fechada** → o **modelo aprovado** escolhido para o tipo de agendamento, se ele for desse número.
   - Janela fechada **sem modelo aprovado** utilizável → este caminho não serve; passa para o próximo.
   - Erro de envio que garante que nada saiu (número caído, recusa da plataforma, credencial) → próximo caminho.
2. **Números do QR code (`waha`) conectados**, depois, um após o outro: texto de sempre.
3. **Nenhum caminho funcionou** → o lembrete **não** é carimbado como enviado, fica com o **motivo visível** para a
   equipe e a próxima rodada tenta de novo, **no máximo 3 rodadas** por degrau (decisão do dono, 2026-11-11). Na 3ª
   sem sucesso: desiste do degrau, carimba como **não enviado** (não como enviado) e cai na tarefa "ligar para o
   paciente" que já existe (9006). Contar tentativas por degrau é aditivo no compromisso (nome a cargo do builder).

### Falha que a Meta avisa depois (decisão do dono, 2026-11-11)
A Meta costuma aceitar o envio (HTTP 200) e só depois avisar pelo webhook que não entregou
(`lib/channels/meta/status-update.ts`: 131026 número sem WhatsApp, 131049 limite de marketing, 131047 janela fechada,
modelo pausado…). Para a reserva funcionar de verdade:
- quando o webhook marcar `failed` a mensagem de **um lembrete** com um código que **garante** não entrega, o
  lembrete é **reaberto** e sai **na hora** pelo próximo caminho (QR code), **desde que a consulta ainda não tenha
  começado**;
- a mensagem do lembrete precisa ser reconhecível como lembrete daquele compromisso/degrau (hoje o
  `requestId`/`actor.id` já leva o id do compromisso; a forma de ligar é a cargo do builder);
- o reenvio pela reserva **não** pode voltar à Meta e conta como uma das 3 tentativas;
- a lista de códigos "garantidos" fica num lugar só, testada; código desconhecido = ambíguo (não reenvia);
- o reenvio roda fora do webhook (Trigger/handler nunca faz HTTP direto: usa `event_log`, como o resto do fork).
Hoje `marcarLembretesQueFalharam` (9006) abre a tarefa "ligar" nesse caso: com a flag ligada, ela só abre depois que
a reserva também falhar (ou não houver reserva).

Regras que valem em todos os caminhos:
- **"Não quero receber mensagens"** = `contacts.is_blocked` (é onde o opt-out do lote 1, `lib/opt-out/`, grava)
  bloqueia o envio por **qualquer** número. Opt-out não é falha: não tenta reserva e não abre tarefa "ligar".
  A recusa de **marketing** (`consent.marketing.declined_at`) **não** barra lembrete, como hoje: lembrete é
  transacional. *(Decisão do Claude, a conferir pelo dono.)*
- A **janela de horário de envio** do número (`adiarAteAJanelaAbrir`, anti-ban) continua valendo por número: número
  fora do horário dele é pulado nesta rodada; se todos estiverem fora do horário, o motivo é `fora_da_janela` e a
  rodada seguinte tenta (como hoje).
- **Nunca duas mensagens** do mesmo lembrete: só passa para a reserva quando o erro **garante** que a mensagem não
  saiu. Atenção: `sendMessageHandler` em geral **não lança**; devolve a mensagem com status (`failed`, `queued`…), e a
  decisão precisa ler esse status, não só exceção. Erro **ambíguo** (tempo esgotado depois de enviar, resposta
  ilegível, código desconhecido) **não** cai para a reserva **e não reenvia na rodada seguinte**: carimba o degrau como
  tentado e o motivo fica "envio não confirmado" para a equipe conferir (decisão do dono, 2026-11-11: melhor conferir
  do que o paciente receber duas vezes).
- A mensagem fica registrada na conversa **do número que enviou** (`ensureConversation` com aquele canal).
- O **pedido de SIM/NÃO** continua: por texto, é anexado como hoje; por modelo, o texto do pedido não pode ser
  anexado (o corpo do modelo é fixo), então o pedido é registrado do mesmo jeito e a tela orienta a clínica a escrever
  o modelo já pedindo SIM/NÃO. A resposta é casada **pelo contato** (`lib/clinic/confirmacao/resposta.handler.ts`), então
  responder pelo outro número funciona.

**Nasce desligado.** Flag por organização em `organizations.settings.clinic` (nome a cargo do builder, no padrão das
outras chaves `clinic`), com **chave na tela** no mesmo lugar e pela mesma rota da `confirmacao_automatica`
(`/api/v1/clinic/config`). **Desligado = comportamento de hoje, byte a byte** (o mesmo `select ... limit(1)`), e o
seletor de modelo e o aviso de "não enviado" **não aparecem**. *(Decisão do Claude.)* O Playwright prova a tela com a
chave ligada e confere que ela some com a chave desligada.

## O que aproveitar do upstream (#3891)
Absorver por adaptação manual, registrando em `UPSTREAM.md` (Absorções seletivas, lote 2):
- `lib/agenda/lembrete-por-modelo.ts` (+ teste): quais modelos o lembrete consegue mandar (aprovados, do número,
  corpo de texto, variáveis só no corpo, posicionais `{{1}}`–`{{4}}` sem pular) e o preenchimento:
  `{{1}}` primeiro nome, `{{2}}` dia e hora, `{{3}}` título, `{{4}}` endereço. Na conversa fica o texto preenchido.
- Coluna `calendar_event_types.reminder_meta_template_id` com **FK composta** `(organization_id, reminder_meta_template_id)
  → meta_templates(organization_id, id) on delete set null (reminder_meta_template_id) deferrable initially deferred`,
  e `meta_templates` ganha `unique (organization_id, id)`.
- Em **Configurações › Agendamentos**, no lembrete de cada tipo, o seletor "Se a janela de 24 h já tiver fechado,
  mandar este modelo aprovado", listando só modelos utilizáveis; nenhum → "Nenhum" + a frase de onde criar.
- A rota do tipo (`app/api/v1/agenda/tipos`) confere com Zod e no servidor que o modelo é da org e utilizável.

**Não trazer** do upstream: `remetente-do-lembrete.ts` e o aviso de remetente (#2595/0625). Lá a regra é "o número
vinculado é autoridade, indisponível nunca libera outro número" — o **oposto** do que o dono pediu. O fork não tem
essas peças e não as ganha nesta tarefa.

## Banco
Migration **8023** (`<ts>_8023_clinic_lembrete_meta_com_reserva.sql`), TRIPLA (arquivo + MANIFEST + apêndice
idempotente em `baseline.sql`). É adaptação, então vai na faixa 8xxx do fork, não 9092. Conteúdo:
- a coluna e a FK do upstream (acima);
- o que for preciso para o **motivo** e a **contagem de tentativas** por degrau (aditivo; ver abaixo onde o motivo
  aparece — reaproveitar o que a 9006 já guarda antes de criar coluna nova).
Nada removido ou renomeado. Função nova em `public` (se houver): `revoke execute ... from public, anon`.

## Onde o motivo aparece *(decisão do Claude)*
**Um aviso só por consulta.** O fork já tem a marcação de falha da 9006 (`clinic_confirmation_requests.falha`:
`envio_falhou`/`nao_enviado`, rótulos em `ROTULO_DA_FALHA`, tarefa "ligar para confirmar"). O motivo novo **alimenta
esse mesmo mecanismo** (novos motivos no mesmo vocabulário), em vez de criar uma segunda linha na tela. Onde a 9006
não alcança (consulta sem pedido de confirmação), o builder estende o mesmo aviso, sem inventar um segundo. Motivos
com nome em pt-BR no `lib/i18n/dicionario.ts`: sem número conectado, todos os números fora do horário de envio, janela
da Meta fechada sem modelo aprovado, erro de envio após 3 tentativas, envio não confirmado. Opt-out **não** gera aviso
nem tarefa "ligar".

## Objetivos
- Clínica com Meta + QR code: o lembrete sai pela Meta; se a Meta não puder, sai pelo QR code.
- Clínica só com QR code (o caso de hoje, inclusive no banco local): mesmo resultado de hoje.
- A equipe enxerga por que um lembrete não saiu.

## Fora do escopo
- Aviso de agendamento (#84), follow-up, pedido de confirmação avulso (cron `clinic-confirmacao-sem-resposta`) e
  qualquer outra automação → cartão novo.
- Providers `zernio`, `zernio_social`, `datafy`, `wacalls`: ficam fora da lista de caminhos com a flag ligada.
- Escolher número por tipo de agendamento (o vínculo do upstream).
- Conectar o número oficial da Meta (é operação do dono, não código).

## Anti-objetivos (seria fracasso mesmo "funcionando")
- O paciente receber o **mesmo lembrete duas vezes** (pela Meta e pelo QR code).
- Mensagem para quem pediu para não receber.
- Lembrete carimbado como enviado sem ter saído.
- Clínica com a flag desligada notar qualquer diferença.

## Testes e prova
- Função pura de decisão (ordem dos caminhos e o que cada um faz) com testes unitários cobrindo: só QR; Meta janela
  aberta; Meta janela fechada com modelo; Meta janela fechada sem modelo → QR; Meta erro garantido → QR; Meta erro
  ambíguo → para e não reenvia; opt-out; todos fora do horário; 3ª tentativa → desiste + tarefa "ligar";
  flag desligada = caminho antigo.
- Webhook da Meta: `failed` com código garantido num lembrete → reenvio pelo QR (consulta futura); consulta já
  começada → não reenvia; código desconhecido → não reenvia; mensagem que não é lembrete → nada muda.
- `route.test.ts` do cron com os mesmos cenários (envio **simulado**, sem chamar Meta nem WAHA de verdade).
- `test:db`: FK composta, `on delete set null`, isolamento entre 2 orgs da coluna nova.
- Playwright na 3001: seletor do modelo em Configurações › Agendamentos e a linha do motivo no agendamento.
- Verify do CLAUDE.md (lint, typecheck, test:unit sem regressão, test:db) e `gh pr checks` com `verify-parte (3)` verde.
- O dono não tem número da Meta conectado: **nenhum teste manda mensagem real nem chama LLM**.

## Deixado ao builder
Nome da flag e das colunas, onde exatamente ficam os helpers, a classificação exata de erro "garantido" × "ambíguo"
a partir do que `sendMessageHandler`/adapters/webhook já devolvem (WAHA incluído), como ligar a mensagem ao
compromisso/degrau, e o texto final da tela (no tom das telas vizinhas).

## Decisões tomadas pelo Claude (para o dono conferir)
1. Opt-out = `contacts.is_blocked`; recusa de marketing não barra lembrete.
2. Chave de ligar em Configurações, junto da confirmação automática; tela nova só aparece com ela ligada.
3. Um aviso só por consulta, reaproveitando a falha da 9006 e a tarefa "ligar para confirmar".
4. Migration na faixa do fork (8023), não 9092, por ser adaptação.
5. Só `meta_cloud` e `waha` entram na lista de caminhos.
