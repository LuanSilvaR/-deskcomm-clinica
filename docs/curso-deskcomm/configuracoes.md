# Curso DeskComm — Configurações

> Gerado a partir do [curso oficial do DeskComm](https://www.deskcomm.com.br/curso) — versão 1.94.0, gerado em 2026-10-29. Conteúdo do **núcleo do DeskcommCRM (upstream)**; o que o fork de clínicas acrescenta está em [`docs/funcionalidades.md`](../funcionalidades.md). As capturas de tela de cada passo ficam no curso online.

[← Índice do curso](README.md)

## Módulos deste grupo

| Módulo | Tela | Lições | Para que serve |
|---|---|---|---|
| [Tipos de agendamento](#m-tipos-de-agendamento) | `/app/settings/tenant/agenda` | 6 | O que se pode marcar, quanto dura, onde acontece e quem atende. |
| [Aviso de agendamento](#m-aviso-de-agendamento) | `/app/agenda/avisos` | 5 | Receber no WhatsApp cada horário marcado, remarcado ou cancelado, e o resumo das 7h. |
| [Propostas](#m-propostas) | `/app/settings/tenant/proposals` | 3 | Configure a validade padrão e condições para propostas comerciais. |
| [Modelos de proposta](#m-modelos-de-proposta) | `/app/settings/tenant/proposals/modelos` | 5 | Personalize os modelos da plataforma ou crie os da sua empresa, inclusive a partir de uma proposta que você já usa. |
| [Financeiro](#m-financeiro) | `/app/settings/tenant/financeiro` | 5 | Contas, formas de pagamento e como cada lançamento é classificado. |
| [Meta de vendas](#m-meta-de-vendas) | `/app/settings/metas` | 2 | Quanto a empresa quer vender no mês, para o Desempenho medir o progresso. |
| [Perfil](#m-perfil) | `/app/settings/profile` | 3 | Seu nome, idioma, fuso horário e avatar. |
| [Segurança](#m-seguranca) | `/app/settings/security` | 3 | Verificação em duas etapas, códigos de recuperação e sessões. |
| [Notificações](#m-notificacoes) | `/app/settings/notifications` | 3 | Por onde e sobre o quê você quer ser avisado. |
| [App no celular](#m-app-no-celular) | `/app/settings/aplicativo` | 2 | Instale o sistema na tela de início do celular e receba os avisos. |
| [Equipe](#m-equipe) | `/app/team` | 6 | Quem trabalha aqui, com qual papel e quanta conversa cada um aguenta. |
| [Distribuição de atendimento](#m-distribuicao-de-atendimento) | `/app/settings/atendimento` | 6 | Quem recebe cada cliente novo, e o que cada atendente enxerga. |
| [Automações](#m-automacoes) | `/app/settings/automacoes` | 3 | O freio único do passo em que a IA escolhe entre as opções de uma regra, para a empresa inteira. |
| [Tags](#m-tags) | `/app/settings/tags` | 6 | O vocabulário de etiquetas da empresa: onde cada uma é usada e como renomear, juntar ou excluir. |
| [Recursos opcionais](#m-recursos-opcionais) | `/app/settings/recursos` | 4 | Tudo o que se liga e desliga, se está ligado e onde se ajusta. |
| [Organização](#m-organizacao) | `/app/settings/tenant` | 5 | Dados da empresa, retenção de dados e encarregado de LGPD. |
| [Conversões](#m-conversoes) | `/app/settings/conversoes` | 6 | Devolver ao anúncio as vendas que ele trouxe, e marcar a origem de quem chega pelo site. |
| [Meta Ads (conexão)](#m-meta-ads-conexao) | `/app/settings/meta-ads` | 3 | Conectar a conta de anúncios para ler o desempenho das campanhas. |
| [Marca](#m-marca) | `/app/settings/marca` | 4 | O nome e a cor que sua empresa mostra dentro do sistema. |
| [Plano e cobrança](#m-plano-e-cobranca) | `/app/settings/billing` | 3 | Pagamento, troca de plano e faturas da sua empresa. |
| [LGPD](#m-lgpd) | `/app/lgpd/requests` | 4 | Pedidos de exportação e exclusão de dados feitos por clientes. |
| [API Tokens](#m-api-tokens) | `/app/settings/api-tokens` | 3 | Chaves para outro sistema conversar com o seu CRM. |
| [Trunk SIP](#m-trunk-sip) | `/app/settings/voip-trunk` | 2 | Credenciais do provedor SIP para chamadas de voz por IA. |
| [Servidor MCP externo](#m-servidor-mcp-externo) | `/app/settings/servidor-mcp-externo` | 4 | O endereço e a chave do sistema de fora que a IA da empresa pode consultar. |
| [Extensões](#m-extensoes) | `/app/extensions` | 4 | Guias instalados para orientar o trabalho no CRM, com permissões e estado visíveis. |
| [Dados externos](#m-dados-externos) | `/app/integracao-dados` | 4 | Conecte um banco de dados de outro sistema para o agente consultar em tempo real. |

---

<a id="m-tipos-de-agendamento"></a>

## Tipos de agendamento

**Tela:** `/app/settings/tenant/agenda`  
**Resumo:** Onde você cadastra o que os clientes podem marcar: quanto dura, onde acontece, quem atende, o preço e o lembrete que vai pelo WhatsApp.

**Lições:** [Conhecendo os tipos de agendamento](#l-tipos-de-agendamento--conhecendo-a-tela) · [Criar um tipo de agendamento](#l-tipos-de-agendamento--criar-um-tipo) · [Quem atende, preço e lembrete](#l-tipos-de-agendamento--ajustar-um-tipo) · [Desativar e reativar um tipo](#l-tipos-de-agendamento--desativar-e-reativar) · [Aula em grupo com horário fixo](#l-tipos-de-agendamento--servico-com-horarios) · [Regras gerais da agenda](#l-tipos-de-agendamento--regras-gerais)

<a id="l-tipos-de-agendamento--conhecendo-a-tela"></a>

### Conhecendo os tipos de agendamento

- **Objetivo:** Achar a tela pelas Configurações e entender o que cada linha da lista mostra.
- **Papel mínimo:** Administrador
- **Busca no curso:** tipos de agendamento; serviços da agenda; o que o cliente pode marcar; duração da consulta; cadastrar consulta; configurar agenda

1. **Onde fica** — `/app/settings`  
   Abra "Configurações" no rodapé do menu da esquerda. No grupo "Sua empresa" está o cartão "Tipos de agendamento". Para seguir, clique nele.
2. **A lista do que se pode marcar**  
   A página abre com o título "Agendamentos", que é o nome da área e pode ser mudado nas regras gerais. Cada linha é uma coisa que a clínica atende: uma consulta, um procedimento, um retorno. É desta lista que saem as opções da tela de marcar horário e do agente de IA. O botão "Novo tipo de agendamento" cadastra mais um.
3. **O que uma linha diz**  
   Na linha da "Limpeza dental" aparecem, nesta ordem: o nome, a categoria ("Procedimento"), a duração ("40 min") e onde acontece ("Presencial"). O trecho "avisa o cliente" mostra que este tipo manda lembrete pelo WhatsApp, e os números são minutos antes do horário: 1440 é um dia e 120 são duas horas. "texto próprio" quer dizer que a mensagem foi escrita pela clínica. À direita, "Configurar Limpeza dental" abre os horários próprios do serviço, "Editar" muda os dados do tipo e "Desativar" tira o tipo das opções.
4. **Os avisos em amarelo**  
   "sem responsável — definir quem atende" quer dizer que ninguém foi escolhido para atender aquele tipo. Sem isso, a agenda não tem horário nenhum para oferecer a esse tipo, nem na tela de marcar nem no agente de IA. Clicar no aviso abre o ajuste na hora. Um tipo com "desativado" fica apagadinho: some das opções de marcar, mas o histórico continua.
5. **Mais ajustes no fim da página**  
   Abaixo da lista ficam duas partes que abrem com um clique. "Regras gerais da agenda" reúne o nome da área da agenda, os prazos de confirmação de presença, quem mexe na agenda de quem e os dias fechados, e tem lição própria neste módulo. Para ver a outra, clique em "Contas e calendários Google".
6. **Sua agenda do Google**  
   Aqui cada pessoa da equipe ajusta a própria conta do Google, depois de conectada: escolhe quais agendas ocupam os horários dela e em qual agenda os compromissos novos aparecem. Sem conta conectada, aparece só o link "Conecte sua conta pela Agenda", que leva à tela da Agenda, onde a conexão é feita. Se lá aparecer "Sincronizar com o Google ainda não está disponível", quem instalou o sistema ainda precisa cadastrar o Google; até lá, a agenda funciona normalmente, só não conversa com o Google.

<a id="l-tipos-de-agendamento--criar-um-tipo"></a>

### Criar um tipo de agendamento

- **Objetivo:** Cadastrar um atendimento novo com nome, categoria, duração, local e quem atende.
- **Papel mínimo:** Administrador
- **Busca no curso:** criar tipo de agendamento; novo serviço na agenda; cadastrar retorno; duração do atendimento; quem atende a consulta; adicionar procedimento

1. **Começar um tipo novo** — `/app/settings/tenant/agenda`  
   Vamos cadastrar o "Retorno de fisioterapia", uma volta rápida do paciente depois do tratamento. Clique em "Novo tipo de agendamento".
2. **O formulário**  
   Abre um formulário curto. "Nome" é o que o cliente e a equipe vão ler. "Categoria" agrupa o tipo (consulta, retorno, procedimento…). "Duração (minutos)" diz quanto tempo o horário ocupa na agenda. "Onde acontece" pode ser presencial, por telefone, WhatsApp, link de vídeo ou Google Meet; o Google Meet só gera o link com a agenda do Google conectada. "Criar como serviço em rascunho" é para quem vai montar horários próprios antes de abrir as reservas: o tipo nasce desativado e sem quem atende, e você o ajusta depois pelo botão "Configurar" da linha dele.
3. **Preencher**  
   Escreva o nome, escolha a categoria "Retorno", a duração de 30 minutos e "Presencial". Em "Quem atende", escolha a pessoa da equipe que faz esse atendimento: aqui, a Ana Ribeiro. Na primeira vez, o campo já vem com o seu nome; confira sempre, porque se ele estiver em "Definir depois" o tipo fica sem horário para oferecer até alguém ser escolhido.
4. **Pronto para marcar**  
   Ao clicar em "Criar tipo", o formulário fecha e o "Retorno de fisioterapia" entra na lista, já com a categoria, a duração e o local. Como a Ana atende, a agenda já oferece horários desse tipo dentro da jornada de trabalho dela. Não dá para criar dois tipos com o mesmo nome, nem se o outro estiver desativado: o sistema avisa que já existe. Nesse caso, reative o antigo.

<a id="l-tipos-de-agendamento--ajustar-um-tipo"></a>

### Quem atende, preço e lembrete

- **Objetivo:** Editar um tipo: escolher quem atende, pôr um preço padrão e ligar os lembretes pelo WhatsApp.
- **Papel mínimo:** Administrador
- **Busca no curso:** editar tipo de agendamento; lembrete de consulta whatsapp; avisar cliente antes da consulta; preço padrão do serviço; sem responsável na agenda; mudar duração

1. **Resolver o aviso amarelo** — `/app/settings/tenant/agenda`  
   A "Avaliação odontológica" está sem ninguém para atender, então nenhum horário dela aparece para marcar. Clique no aviso "sem responsável — definir quem atende". O botão "Editar" da linha abre o mesmo ajuste.
2. **Quem atende e preço**  
   O ajuste abre logo abaixo da linha. Em "Quem atende", escolha o Carlos Mendes. "Preço padrão" é opcional: ele vira o valor sugerido na comanda e pode ser mudado lá. Aqui também dá para trocar o nome e a duração. Enquanto o ajuste está aberto, o botão "Editar" da linha vira "Fechar", que recolhe o ajuste.
3. **Ligar o lembrete**  
   Marque "Avisar o cliente antes do compromisso, pelo WhatsApp". Escolha quanto antes (aqui, 1 dia) e escreva a mensagem. As palavras entre chaves, como {{nome}} e {{hora}}, são trocadas pelos dados de cada cliente na hora do envio. Mensagem em branco usa o texto padrão do sistema. O lembrete só sai se a clínica tiver um número de WhatsApp conectado e funcionando.
4. **Mais de um lembrete**  
   "Adicionar lembrete" cria outro aviso, com antecedência e mensagem próprias: por exemplo, um no dia anterior e outro duas horas antes. Com mais de um, aparece "Remover" para tirar um deles. Em "Canal para enviar os lembretes", o padrão "Automático" usa o número da conversa da reserva ou, se a clínica tiver um número só, esse número. Se a clínica tiver mais de um número, escolha qual envia: no automático, uma reserva que não veio de conversa fica sem lembrete e a equipe recebe um aviso. Clique em "Salvar" para gravar tudo.
5. **O resultado na lista**  
   O ajuste fecha e a linha mostra o novo estado: o aviso amarelo sumiu, porque agora o Carlos atende, e aparece "avisa o cliente" com as antecedências em minutos (1440 é um dia, 120 são duas horas). O lembrete só sai para horários deste tipo que estejam confirmados e tenham um contato cadastrado.

<a id="l-tipos-de-agendamento--desativar-e-reativar"></a>

### Desativar e reativar um tipo

- **Objetivo:** Tirar um atendimento das opções de marcar sem perder o histórico, e trazê-lo de volta.
- **Papel mínimo:** Administrador
- **Busca no curso:** desativar tipo de agendamento; parar de oferecer serviço; apagar tipo de consulta; reativar serviço na agenda; tirar opção de marcar

1. **Desativar** — `/app/settings/tenant/agenda`  
   A clínica parou de oferecer a orientação nutricional por vídeo. Tipo de agendamento não se apaga, se desativa: assim o histórico fica guardado. Clique em "Desativar" na linha dela.
2. **Desativado, não apagado**  
   A linha fica apagadinha, ganha a palavra "desativado" e vai para o fim da lista. O tipo some das opções de marcar horário. Os atendimentos já feitos continuam guardados com o nome certo, e os horários que já estavam marcados continuam marcados: desativar não cancela nada. O botão "Desativar" vira "Reativar".
3. **De volta à lista**  
   Clicando em "Reativar", o tipo volta para a lista normal, com a mesma configuração de antes, e passa de novo a aparecer para marcar.

<a id="l-tipos-de-agendamento--servico-com-horarios"></a>

### Aula em grupo com horário fixo

- **Objetivo:** Transformar um tipo em serviço com horários próprios e vagas, como uma turma de pilates.
- **Papel mínimo:** Administrador
- **Busca no curso:** aula em grupo com vagas; turma com capacidade; horário fixo da aula; configurar serviço na agenda; limite de pessoas por horário; pilates em grupo

1. **Abrir a configuração do serviço** — `/app/settings/tenant/agenda`  
   Alguns atendimentos têm horário fixo e várias pessoas ao mesmo tempo, como o pilates em grupo. Para isso existe o botão "Configurar" seguido do nome do tipo, à direita de cada linha. Clique em "Configurar Pilates em grupo".
2. **As quatro abas**  
   A configuração abre no alto da página, com quatro abas: "Serviço" (como se reserva), "Horários" (quando acontece), "Google" (publicar num calendário do Google, se a agenda do Google estiver conectada) e "Bloqueios" (impedir reservas num período). Mudar isto vale para as reservas novas; as que já existem ficam como estão. "Exigir confirmação humana" segura a vaga até alguém da equipe confirmar. No topo, "Nome e duração" volta aos dados do tipo e "Fechar" recolhe esta configuração.
3. **Turma com vagas**  
   Marque "Usar programação de serviço". Em "Como reservar", escolha "Coletivo com capacidade" e diga em "Capacidade padrão" quantas pessoas cabem na turma: aqui, 6. "Individual por profissional" é para atendimento de uma pessoa por vez; nesse caso, escolha também os profissionais em "Opções adicionais". "Coletivo sem limite automático" não conta vagas. "Ativar reservas deste serviço" já vem marcado; desmarcado, o serviço fica em rascunho, sem receber reservas. Para salvar com as reservas ativas, é preciso ter pelo menos um horário, que é o próximo passo.
4. **O horário da turma**  
   Na aba "Horários", clique em "Adicionar horário". Escolha "Toda semana", o dia ("Terça-feira") e o "Início" (19:00). "Horário fixo" é uma turma que começa naquela hora; "Faixa de atendimento" abre horários dentro de um intervalo. "Copiar horário" repete a linha para o dia seguinte.
5. **Programação salva**  
   Ao clicar em "Salvar programação", aparece a confirmação com quantas reservas futuras foram mantidas. Agora o pilates tem turma às terças, 19h, com até 6 vagas, e a linha dele na lista passa a mostrar "Coletivo com capacidade · 6". Abaixo, em "Conferir horários salvos", escolha uma data e clique em "Atualizar fontes e conferir" para ver os horários daquele dia antes de divulgar.

<a id="l-tipos-de-agendamento--regras-gerais"></a>

### Regras gerais da agenda

- **Objetivo:** Conhecer as regras que valem para a clínica toda e fechar um dia de feriado.
- **Papel mínimo:** Administrador
- **Busca no curso:** fechar agenda no feriado; bloquear dia na agenda; confirmação de presença; nome da agenda; cliente pela agenda etiqueta; atendente mexer na agenda do colega

1. **Abrir as regras** — `/app/settings/tenant/agenda`  
   No fim da página, clique em "Regras gerais da agenda". A primeira regra é o "Título da área da agenda": o nome que aparece no topo da tela da Agenda e desta página. Vazio, fica "Agendamentos". Escreva e clique em "Salvar título".
2. **Confirmação de presença**  
   Depois de cada horário, o sistema pede à equipe que confirme se o cliente veio. Sem essa confirmação, ele nunca presume falta. "Pedir confirmação após o fim" diz quantos minutos depois do fim esse pedido aparece. "Proteger de cobranças por silêncio" diz por quanto tempo as mensagens automáticas que cobram resposta do cliente ficam seguradas enquanto ninguém confirma. "Soltar o horário de um pedido não confirmado", que só vale para tipos que pedem confirmação, diz depois de quanto tempo um pedido de horário que ninguém aprovou solta a vaga; o cliente não é avisado disso. Ajuste e clique em "Salvar prazos".
3. **Clientes pela agenda**  
   Com "Quem tem horário marcado vira cliente" ligado, todo contato com horário marcado ganha a etiqueta "cliente"; horário cancelado e falta não contam. Ao ligar, o sistema pede confirmação, porque quem já teve horário também ganha a etiqueta na hora. Clique em "Ligar" para aplicar ou em "Cancelar" para desistir. Desligar depois não tira a etiqueta de ninguém. Só o administrador muda esta regra.
4. **Agenda dos colegas e Google Meet**  
   "Atendentes podem mexer na agenda dos colegas" vem ligado: qualquer atendente vê, cancela e remarca o horário de qualquer colega, e mexe nas tarefas da equipe. Desligado, cada um mexe só nos próprios; gerentes e administradores continuam mexendo em tudo. Essa regra vale assim que você clica. Logo abaixo, "O Meet da reunião nasce com o acesso aberto" deixa entrar quem tiver o link, sem pedir licença. Ela precisa da agenda do Google conectada, e quem já estava conectado precisa reconectar a agenda para a opção passar a valer.
5. **Fechar um dia**  
   Em "Dias fora da rotina", escolha "Fechar o dia", a data e um motivo, e clique em "Fechar este dia". Atenção: o dia fechado vale só para a agenda de quem está usando o sistema, e não para a clínica toda. Para fechar a agenda de outro gerente ou administrador, ele precisa entrar com a própria conta e fazer o mesmo. "Abrir para atendimento" faz o contrário: abre um dia fora da jornada, como um sábado. "Repetir toda semana até" fecha o mesmo dia da semana até a data escolhida.
6. **O dia na lista**  
   O dia entra na lista logo abaixo, com "o dia todo" e o motivo. Nesse dia, a agenda deixa de oferecer horários; o que já estava marcado continua marcado, para você decidir o que fazer com cada um. "Reabrir" desfaz o fechamento.

---

<a id="m-aviso-de-agendamento"></a>

## Aviso de agendamento

**Tela:** `/app/agenda/avisos`  
**Resumo:** Receber no seu WhatsApp cada horário marcado, remarcado ou cancelado, e às 7h o resumo do dia, para nunca marcar duas pessoas no mesmo horário.

**Lições:** [Conhecendo o Aviso de agendamento](#l-aviso-de-agendamento--conhecendo-a-tela) · [Escolher para onde vai o aviso](#l-aviso-de-agendamento--trocar-o-numero) · [Quando o sistema estranha o número](#l-aviso-de-agendamento--numero-recusado) · [Conferir se os avisos estão chegando](#l-aviso-de-agendamento--ultimos-avisos) · [Pausar o aviso e mandar um teste](#l-aviso-de-agendamento--pausar-e-testar)

<a id="l-aviso-de-agendamento--conhecendo-a-tela"></a>

### Conhecendo o Aviso de agendamento

- **Objetivo:** Achar a tela e entender cada parte: para onde vai o aviso, a chave que liga, os botões e a lista dos últimos avisos.
- **Papel mínimo:** Administrador
- **Busca no curso:** aviso de agendamento; receber agendamento no whatsapp; avisar quando marcar horário; aviso de consulta marcada; notificação de agenda no celular; resumo da agenda do dia

1. **Onde fica a tela** — `/app/settings`  
   Clique em "Configurações", no rodapé do menu lateral. Na parte "Sua empresa" fica o cartão "Aviso de agendamento". Ele serve para quem também marca horários fora do sistema (no caderno, no celular): cada horário que a IA ou a equipe marcar aqui chega no seu WhatsApp, e você não marca duas pessoas no mesmo horário.
   > 💡 Só quem administra a conta vê e muda esta tela.
2. **As partes da tela**  
   No alto fica o quadro de configuração: para onde o aviso vai e a chave que liga. Embaixo fica a lista "Últimos avisos", com o que já foi mandado. Nesta clínica o aviso já está ligado e vai para o celular da Helena. Repare que o menu lateral passa a marcar "Agenda": esta tela também fica dentro da Agenda.
3. **Usar o mesmo número do aviso de caso**  
   A primeira chave reaproveita o número que você já cadastrou no aviso de caso (o aviso que chega no seu WhatsApp quando a IA abre um caso). Aqui ela aparece travada, porque esse aviso ainda não tem número. Quando tiver, você pode ligar esta chave: os avisos da agenda vão para o mesmo número, e se você trocar o número lá, eles acompanham.
   > 💡 O aviso de caso é configurado na tela "Aviso no WhatsApp", do Agente de IA. Ache pela busca do alto da tela.
4. **Quem envia e quem recebe**  
   Em "Conexão que envia os avisos" você escolhe qual número de WhatsApp da clínica manda a mensagem. Só aparecem os números que podem mandar uma mensagem escrita na hora, sem precisar de modelo aprovado. Atenção: um número desconectado também aparece na lista, e por ele o aviso não sai. Em "Número que recebe os avisos" vai o celular de quem quer ser avisado, começando por +55 e o DDD.
   > 💡 O número que recebe não pode ser um dos números conectados da sua conta: um ficaria respondendo o outro sem parar. O sistema recusa na hora de salvar.
5. **A chave que liga o aviso**  
   A chave "Receber avisos de agendamento no WhatsApp" liga e desliga o aviso. Ligada, cada horário marcado, remarcado ou cancelado vira uma mensagem curta com o primeiro nome do cliente, o serviço, o dia e a hora, quem atende e de onde veio: IA, equipe ou o próprio cliente. Se a agenda estiver ligada ao Google Agenda, um horário remarcado ou cancelado lá também gera aviso. Às 7h chega também o resumo do dia, com a agenda de hoje.
   > 💡 Só o primeiro nome do cliente vai na mensagem, porque o celular pode ser lido por quem estiver perto.
6. **Salvar e o horário de silêncio**  
   Nada muda até você clicar em "Salvar". Logo abaixo do quadro, a tela avisa: das 22h às 7h não sai aviso, para não acordar ninguém. O que for marcado nesse horário aparece no resumo das 7h. O horário é o da empresa. O botão "Enviar teste", ao lado, é explicado na lição "Pausar o aviso e mandar um teste".

<a id="l-aviso-de-agendamento--trocar-o-numero"></a>

### Escolher para onde vai o aviso

- **Objetivo:** Escolher o número da clínica que envia, digitar o celular que recebe e salvar.
- **Papel mínimo:** Administrador
- **Busca no curso:** trocar número do aviso de agendamento; mudar celular que recebe aviso; configurar aviso de agenda no whatsapp; escolher número que envia aviso; ligar aviso de agendamento

1. **Escolher o número que envia** — `/app/agenda/avisos`  
   Clique em "Conexão que envia os avisos" para abrir a lista dos números da clínica. Aqui só existe a "Recepção Bem Viver". Se a clínica não tiver nenhum número que sirva, a lista fica travada e a tela pede para conectar um WhatsApp em Conexões antes.
2. **Digitar o celular que recebe**  
   Em "Número que recebe os avisos", digite o celular começando pelo código do país: +55, o DDD e o número. O sistema tira sozinho espaços, traços e parênteses. Enquanto o número estiver incompleto, aparece "Esse número ainda não está completo." e o botão "Salvar" fica apagado.
3. **Número completo, ligar e salvar**  
   Com o número completo, o aviso some e o "Salvar" acende. Confira se a chave "Receber avisos de agendamento no WhatsApp" está ligada: ela só pode ser ligada depois de escolher a conexão e o número. Clique em "Salvar": aparece por alguns segundos, no canto de baixo da tela, a confirmação "Aviso salvo.".
4. **Conferir que ficou salvo** — `/app/agenda/avisos`  
   Ao abrir a tela de novo, o número novo continua no campo e a chave segue ligada: a mudança foi gravada. A partir de agora os avisos vão para esse celular. Ele passa a ser um número da equipe: o que ele mandar para a clínica não vira atendimento na Inbox.

<a id="l-aviso-de-agendamento--numero-recusado"></a>

### Quando o sistema estranha o número

- **Objetivo:** Entender o que fazer quando o número digitado já é de um cliente ou é um número da própria clínica.
- **Papel mínimo:** Administrador
- **Busca no curso:** número já é de um cliente; usar mesmo assim aviso; aviso de agendamento não salva; número conectado não pode receber aviso; erro ao salvar número do aviso

1. **Um número que já é de cliente** — `/app/agenda/avisos`  
   Aqui foi digitado o celular da Juliana Castro, que é paciente da clínica. Ao clicar em "Salvar", o sistema confere se o número já está nos seus contatos antes de gravar.
2. **O sistema pergunta antes**  
   Aparece um quadro com o aviso "Esse número já é de um cliente seu". Se você continuar, esse número passa a ser só da equipe: as mensagens que ele mandar param de chegar como atendimento. "Usar mesmo assim" grava assim mesmo. "Escolher outro número" fecha o quadro sem gravar nada.
   > 💡 Use "Usar mesmo assim" só se o número for mesmo seu, por exemplo quando você se cadastrou como cliente para testar.
3. **Um número da própria clínica**  
   E se você digitar o número da "Recepção Bem Viver", que é o próprio WhatsApp da clínica? Esse o sistema não aceita: um número ficaria respondendo o outro sem parar. Ao clicar em "Salvar", aparece por alguns segundos, no canto de baixo da tela, a mensagem "Esse é um dos números conectados da sua conta", e nada é gravado. Digite outro celular.

<a id="l-aviso-de-agendamento--ultimos-avisos"></a>

### Conferir se os avisos estão chegando

- **Objetivo:** Ler a lista "Últimos avisos" e saber o que cada linha quer dizer.
- **Papel mínimo:** Administrador
- **Busca no curso:** aviso de agendamento não chegou; conferir avisos enviados; histórico de avisos da agenda; aviso não saiu; resumo das 7h não chegou

1. **A lista dos últimos avisos** — `/app/agenda/avisos`  
   Cada linha é um aviso, da mais nova para a mais antiga (aparecem as 20 últimas). À esquerda vem o tipo: "Novo agendamento", "Remarcado", "Cancelado" ou "Resumo do dia". À direita, o dia e a hora em que o aviso saiu (ou em que foi registrado, se não saiu). Não é a hora da consulta. Embaixo, o que aconteceu com ele ("Enviado", "Não saiu" ou "Entrou no resumo das 7h") e para qual celular, só com os quatro últimos números à mostra.
2. **Um aviso que não saiu**  
   Quando uma linha diz "Não saiu", a frase em vermelho logo abaixo explica o motivo. Aqui foi "A conexão de WhatsApp escolhida para os avisos está fora do ar.": o número da clínica estava desconectado naquela hora. Esse aviso não é mandado de novo depois. Confira o número em Conexões. Se a lista estiver vazia, o aviso ainda não foi ligado ou acabou de ser ligado: com ele ligado, todo dia de manhã aparece pelo menos a linha do resumo.
3. **O que foi marcado de madrugada**  
   Quando alguém marca, remarca ou cancela um horário entre 22h e 7h (vale a hora em que isso foi feito, não a hora da consulta), o aviso não sai na hora. A linha mostra "Vai no resumo das 7h" e, depois que o resumo sai, muda para "Entrou no resumo das 7h". O "Resumo do dia" traz a agenda de hoje e, no fim, o que mudou durante a noite.
   > 💡 O resumo sai logo depois das 7h. Se o sistema estiver fora do ar até as 10h, o resumo daquele dia não é mandado, e o que mudou de madrugada vai no resumo do dia seguinte.

<a id="l-aviso-de-agendamento--pausar-e-testar"></a>

### Pausar o aviso e mandar um teste

- **Objetivo:** Desligar o aviso por um tempo sem perder a configuração, e saber quando usar o botão de teste.
- **Papel mínimo:** Administrador
- **Busca no curso:** desligar aviso de agendamento; parar de receber aviso da agenda; pausar aviso no whatsapp; testar aviso de agendamento; enviar teste do aviso

1. **Desligar a chave** — `/app/agenda/avisos`  
   Para parar de receber os avisos, clique na chave "Receber avisos de agendamento no WhatsApp" para desligá-la. A conexão e o número continuam preenchidos, então para voltar basta ligar de novo. Ainda falta gravar: o próximo clique é em "Salvar".
2. **Salvar para valer**  
   A chave só vale depois do "Salvar". Clique nele: aparece por alguns segundos, no canto de baixo da tela, a confirmação "Aviso salvo.". A partir daí nenhum aviso novo sai, nem o resumo das 7h. A lista "Últimos avisos" continua aí, com o que já foi mandado.
3. **A pausa ficou gravada, e o teste** — `/app/agenda/avisos`  
   Abrindo a tela de novo, a chave continua desligada: a pausa foi gravada, e a conexão e o número seguem preenchidos para quando você quiser voltar. O botão "Enviar teste" manda uma mensagem de verdade para o número salvo, dizendo que o aviso está configurado e funcionando. Ele funciona mesmo com a chave desligada. Use quando trocar o número, para ter certeza de que chega. O teste conta no limite diário de mensagens do número da clínica, e dá para mandar até três por hora.
   > 💡 O botão só funciona depois de salvar. Se a mensagem não sair, a tela diz o motivo, por exemplo que o número da clínica está desconectado.

---

<a id="m-propostas"></a>

## Propostas

**Tela:** `/app/settings/tenant/proposals`  
**Resumo:** Onde você liga as propostas comerciais da sua empresa e define o prazo de validade, as condições de pagamento e o aviso que a equipe recebe quando a IA prepara uma proposta.

**Lições:** [Ligar as propostas da clínica](#l-propostas--ligar-as-propostas) · [Validade e condições padrão](#l-propostas--validade-e-condicoes) · [Aviso quando a IA prepara uma proposta](#l-propostas--aviso-da-ia)

<a id="l-propostas--ligar-as-propostas"></a>

### Ligar as propostas da clínica

- **Objetivo:** Encontrar a tela de Propostas em Configurações e ligar as propostas comerciais para a sua empresa.
- **Papel mínimo:** Administrador
- **Busca no curso:** ligar propostas; ativar proposta comercial; orçamento para cliente; onde fica propostas; configurar propostas; mandar orçamento

1. **Propostas mora em Configurações** — `/app/settings`  
   Abra "Configurações", no rodapé do menu lateral. Na parte "Sua empresa" está o cartão "Propostas". É ali que você decide se a sua empresa usa propostas comerciais: orçamentos que você monta, revisa e manda para o cliente aceitar.
   > 💡 Só gerente ou administrador vê este cartão. Se ele não aparece, peça a quem administra o servidor para ligar "Propostas comerciais" em Admin › Sistema.
2. **A chave que liga tudo**  
   A tela começa com a chave "Ligar propostas comerciais para esta organização". Ela vem desligada. Enquanto estiver assim, o cartão "Propostas" não aparece em "Ver tudo em CRM" e ninguém da equipe consegue criar uma proposta.
3. **Ligar e salvar**  
   Clique na chave para ligá-la. Ela muda de cor, mas nada foi gravado ainda: a mudança só vale depois que você clica em "Salvar", no fim da tela.
4. **Propostas ligadas**  
   Depois de salvar, aparece no alto o link "Modelos de proposta". Ele é o sinal de que a mudança foi gravada, porque a tela não mostra mensagem de confirmação. É a mesma tela do cartão "Modelos de proposta" em Configurações: lá você escolhe e personaliza os modelos que dão a cara das suas propostas.
5. **Onde ficam as propostas no dia a dia** — `/app/crm`  
   Com as propostas ligadas, o cartão "Propostas" passa a aparecer em "Ver tudo em CRM", na parte "Fechar a venda". É por ele que você e a equipe criam, revisam e enviam as propostas. O envio vai pelo WhatsApp, na conversa que o paciente já tem com a clínica, então é preciso ter um número de WhatsApp conectado.

<a id="l-propostas--validade-e-condicoes"></a>

### Validade e condições padrão

- **Objetivo:** Definir a validade que a IA usa ao rascunhar propostas e o texto de condições de pagamento que entra nas propostas sem você digitar de novo.
- **Papel mínimo:** Administrador
- **Busca no curso:** validade da proposta; prazo do orçamento; condições de pagamento padrão; parcelamento na proposta; texto padrão da proposta; quantos dias vale o orçamento

1. **Os dois campos de padrão** — `/app/settings/tenant/proposals`  
   Logo abaixo da chave ficam dois campos que valem para todas as propostas da empresa: "Validade padrão (dias)" e "Condições padrão". A validade vem com 15 dias e as condições vêm em branco.
2. **Quantos dias a proposta vale**  
   Em "Validade padrão (dias)", digite por quantos dias o paciente pode aceitar a proposta, de 1 a 365. Aqui a clínica usa 10 dias. Esse número vale para as propostas que a IA rascunha. Quando você cria uma proposta à mão, confira o campo "Validade da proposta": lá a data já vem com 15 dias.
3. **As condições que se repetem**  
   Em "Condições padrão", escreva o que vale para quase todo orçamento: formas de pagamento, desconto à vista, prazo dos pacotes. Esse texto entra nas propostas que a IA rascunha e também nas que você cria sem preencher o campo "Condições de pagamento / Observações".
4. **Salvar**  
   Clique em "Salvar". Enquanto grava, o botão mostra "Salvando…" e depois volta a "Salvar", sem mensagem de confirmação. Se a validade estiver fora de 1 a 365 dias, nada é gravado e aparece o aviso "Campos inválidos.". As propostas que já existem não mudam: os novos padrões valem para as próximas.

<a id="l-propostas--aviso-da-ia"></a>

### Aviso quando a IA prepara uma proposta

- **Objetivo:** Entender o aviso no WhatsApp da equipe quando a IA rascunha uma proposta, e saber desligá-lo.
- **Papel mínimo:** Administrador
- **Busca no curso:** aviso de proposta no whatsapp; ia fez proposta; notificação de orçamento; desligar aviso da proposta; rascunho da ia; revisar proposta da ia

1. **O aviso para a equipe** — `/app/settings/tenant/proposals`  
   A última chave é "Avisar no WhatsApp da equipe quando a IA rascunhar uma proposta". Ela vem ligada. Quando a IA prepara uma proposta, a equipe recebe no WhatsApp o título, o primeiro nome do paciente e um link para revisar e enviar. O paciente não recebe nada: a proposta só vai para ele depois que alguém da equipe revisar.
2. **Para onde o aviso vai**  
   O aviso usa o número escolhido na tela "Aviso no WhatsApp", em "Ver tudo em IA" (não é o "Aviso de agendamento" de Configurações, e só o administrador abre essa tela). Se esse aviso não estiver configurado e ligado lá, ou se o número estiver desconectado, nada é enviado, mesmo com esta chave ligada.
3. **Desligar o aviso**  
   Prefere conferir as propostas da IA só pela tela? Clique na chave para desligá-la e depois em "Salvar". As propostas continuam sendo rascunhadas e continuam aparecendo em "Alertas" como prontas para revisão; só a mensagem no WhatsApp da equipe deixa de ser enviada.

---

<a id="m-modelos-de-proposta"></a>

## Modelos de proposta

**Tela:** `/app/settings/tenant/proposals/modelos`  
**Resumo:** Onde você escolhe quais modelos de proposta a clínica usa, cria os seus e ajusta os textos que vão para o paciente.

**Lições:** [Conhecendo os modelos](#l-modelos-de-proposta--conhecendo-os-modelos) · [Deixar de usar um modelo](#l-modelos-de-proposta--deixar-de-usar-um-modelo) · [Criar um modelo da clínica](#l-modelos-de-proposta--criar-um-modelo-da-clinica) · [Editar um modelo da clínica](#l-modelos-de-proposta--editar-um-modelo-da-clinica) · [Personalizar um modelo da plataforma](#l-modelos-de-proposta--personalizar-um-modelo-da-plataforma)

<a id="l-modelos-de-proposta--conhecendo-os-modelos"></a>

### Conhecendo os modelos

- **Objetivo:** Encontrar a tela de Modelos de proposta e entender a diferença entre os modelos da plataforma e os da sua empresa.
- **Papel mínimo:** Administrador
- **Busca no curso:** modelos de proposta; onde ficam os modelos de orçamento; modelo de proposta comercial; texto padrão da proposta; modelo de orçamento da clínica; lista de modelos

1. **Os modelos moram em Configurações** — `/app/settings`  
   Abra "Configurações", no rodapé do menu lateral. Na parte "Sua empresa" está o cartão "Modelos de proposta". Um modelo é o texto pronto que vira a proposta: as partes, a ordem e os campos que mudam de um paciente para outro.
   > 💡 O cartão só aparece para gerente ou administrador. Se as propostas ainda não foram ligadas no cartão "Propostas", ao lado, a tela de modelos abre só com um aviso e o botão "Ir para Configurações › Propostas".
2. **A lista de modelos**  
   Cada linha é um modelo. Embaixo do nome aparece de onde ele vem e quantas partes (seções) tem. "Da plataforma" são os modelos que já vêm prontos com o sistema, como o "Projeto personalizado". "Da empresa" são os que a clínica criou, como o "Pacote de nutrição — 3 meses".
   > 💡 Os modelos da plataforma foram escritos para projetos digitais (site, loja virtual, automação). Para a clínica, o melhor é criar os seus e deixar de usar os que não servem.
3. **Os botões de cada tipo**  
   Num modelo da plataforma você tem "Não usar" e "Personalizar": o texto original não muda, mas você pode fazer uma cópia da clínica para editar. Num modelo da empresa você tem "Editar" e "Remover". "Não usar", "Personalizar" e "Editar" têm lições a seguir. "Remover" pergunta antes de agir e tira o modelo da lista. As propostas já enviadas não mudam.
4. **Duas formas de criar um modelo**  
   No alto da tela ficam as duas formas de criar um modelo da clínica. Em "Novo modelo em branco" você dá um nome e escreve as partes. Em "Criar a partir da proposta que a empresa já usa" você envia o arquivo da proposta que já usa (PDF ou arquivo de texto, até 5 MB), e a IA divide o texto em partes para você revisar antes de salvar.
   > 💡 Arquivo do Word não é aceito: no Word, use "Salvar como" e escolha PDF. Enviar o arquivo depende de a IA estar ligada nesta instalação. Sem ela, aparece um aviso em vermelho e nenhum modelo é criado. O caminho em branco funciona sempre.

<a id="l-modelos-de-proposta--deixar-de-usar-um-modelo"></a>

### Deixar de usar um modelo

- **Objetivo:** Tirar da lista de escolhas um modelo da plataforma que não serve para a clínica, e trazê-lo de volta se precisar.
- **Papel mínimo:** Administrador
- **Busca no curso:** esconder modelo de proposta; desligar modelo que não uso; tirar modelo da lista; modelo não aparece para a IA; voltar a usar modelo

1. **Um modelo que não serve para a clínica** — `/app/settings/tenant/proposals/modelos`  
   O "Catálogo imobiliário" foi feito para imobiliárias. Para que ninguém escolha esse modelo por engano, clique em "Não usar" na linha dele.
2. **Desligado**  
   A linha passa a dizer "Desligado — não aparece para a IA nem no seletor". O modelo some da lista de escolhas ao criar uma proposta e a IA deixa de sugeri-lo. Propostas antigas feitas com ele continuam abrindo normalmente.
3. **Trazer de volta**  
   Mudou de ideia? Clique em "Usar" na mesma linha. O aviso de desligado some e o modelo volta para a lista de escolhas.

<a id="l-modelos-de-proposta--criar-um-modelo-da-clinica"></a>

### Criar um modelo da clínica

- **Objetivo:** Criar do zero um modelo de proposta para os planos de fisioterapia, com as partes e os campos que mudam de um paciente para outro.
- **Papel mínimo:** Administrador
- **Busca no curso:** criar modelo de proposta; novo modelo de orçamento; proposta de plano de tratamento; escrever texto da proposta; campos que mudam por paciente; adicionar seção na proposta

1. **Dar um nome** — `/app/settings/tenant/proposals/modelos`  
   Em "Novo modelo em branco", escreva o nome do modelo, como "Plano de tratamento — Fisioterapia", e clique em "Criar". O botão só acende quando o nome tem pelo menos 2 letras.
2. **O modelo já nasce gravado**  
   Ao clicar em "Criar", o modelo é gravado com uma parte de exemplo, "Resumo da proposta", e abre para edição. O texto de exemplo só traz o nome do projeto e o do paciente. Por isso o aviso amarelo diz que o modelo ainda quase não pede nada ao paciente: com tão poucos campos, a IA não tem o que perguntar.
3. **Acrescentar uma parte**  
   Clique em "+ Seção" para acrescentar uma parte nova no fim. Dê um título e escreva o texto. O que muda de um paciente para outro vai entre chaves duplas, como {{project.objective}} (o objetivo) e {{included.list}} (o que está incluído). Na proposta, cada campo é trocado pelo dado daquele paciente.
   > 💡 Pode usar nomes seus, sem espaço e sem acento, como {{objetivo_do_tratamento}}. Use _ no lugar do espaço. Campo que ficar sem dado aparece na proposta como "[a definir]".
4. **O que a IA vai perguntar**  
   Com os campos no texto, o aviso amarelo vira o quadro azul "Este modelo vai pedir ao cliente:", com cada campo e o nome dele. À direita, "Campos usados" lista todos os campos do modelo, inclusive os que o sistema preenche sozinho, como o nome do paciente.
5. **Salvar o modelo**  
   Clique em "Salvar modelo". Você volta para a lista, que confirma no alto "Modelo «Plano de tratamento — Fisioterapia» salvo.". O "×" da faixa fecha o aviso.
   > 💡 Se alguma parte ficar sem título ou sem texto, o modelo não é salvo e a tela mostra, numa caixa vermelha, o que falta corrigir.
6. **O modelo novo na lista**  
   Descendo a lista, o modelo novo aparece junto dos outros da empresa, depois dos da plataforma e em ordem alfabética, com a marca "Da empresa" e 2 seções: a parte de exemplo e a que você acrescentou. A partir de agora ele pode ser escolhido ao criar uma proposta.

<a id="l-modelos-de-proposta--editar-um-modelo-da-clinica"></a>

### Editar um modelo da clínica

- **Objetivo:** Mudar a ordem das partes de um modelo, decidir quais aparecem sempre e salvar a mudança.
- **Papel mínimo:** Administrador
- **Busca no curso:** editar modelo de proposta; mudar texto da proposta; ordem das seções da proposta; seção obrigatória ou opcional; remover parte do modelo

1. **Abrir o modelo** — `/app/settings/tenant/proposals/modelos`  
   Na lista, clique em "Editar" na linha do "Pacote de nutrição — 3 meses".
2. **Nome e para que serve**  
   No alto ficam o "Nome do modelo", que aparece na lista de escolhas ao criar uma proposta, e "Para que serve (opcional)", uma anotação sua sobre o modelo. Por enquanto essa anotação só aparece aqui, nesta tela.
3. **Os controles de cada parte**  
   Cada parte tem as setas ↑ e ↓, que sobem e descem a parte na proposta, e "Remover", que tira a parte do modelo. Embaixo do texto, "Só aparece se tiver dado" faz a parte sumir da proposta quando nenhum dos campos dela foi preenchido, como em "O que não está incluído". "Obrigatória" desmarca essa opção: a parte sai sempre. As duas não ficam marcadas juntas.
4. **Trocar a ordem**  
   Clicamos na seta ↑ de "Investimento": a parte subiu uma posição e agora vem antes de "O que não está incluído". A mudança aparece na hora, mas só vale depois de salvar.
5. **Salvar**  
   No fim da tela, clique em "Salvar modelo". Só depois de salvar a mudança passa a valer. Se você sair da tela sem salvar, ela se perde.
6. **Modelo salvo**  
   Você volta para a lista, com a confirmação "Modelo «Pacote de nutrição — 3 meses» salvo.". As próximas propostas feitas com este modelo já saem com a nova ordem.

<a id="l-modelos-de-proposta--personalizar-um-modelo-da-plataforma"></a>

### Personalizar um modelo da plataforma

- **Objetivo:** Fazer uma cópia da clínica de um modelo da plataforma, ajustar o texto e saber como voltar ao original.
- **Papel mínimo:** Administrador
- **Busca no curso:** personalizar modelo da plataforma; mudar modelo pronto; copiar modelo de proposta; voltar ao modelo original; ajustar texto do modelo

1. **Personalizar** — `/app/settings/tenant/proposals/modelos`  
   O texto de um modelo da plataforma não pode ser mudado. Para ajustar, clique em "Personalizar": a clínica ganha uma cópia própria, que abre na hora para edição. Aqui vamos personalizar o "Projeto personalizado".
2. **Ajustar o texto**  
   A cópia traz todas as partes do original. Troque o que não combina com a clínica. Aqui, o "Resumo da proposta" passou a falar em plano de cuidado em vez de design e desenvolvimento. Mantenha os campos entre chaves duplas: são eles que trazem o dado de cada paciente.
3. **Salvar a cópia**  
   Antes de salvar, desça pelas outras partes: "Garantia e suporte", por exemplo, ainda fala de desenvolvimento. Revise cada uma. Depois, no fim da tela, clique em "Salvar modelo" para gravar o texto ajustado. As próximas propostas com este modelo passam a usar o texto da clínica.
   > 💡 A cópia já foi criada quando você clicou em "Personalizar": se sair sem salvar, ela continua na lista como "Personalizado", mas com o texto original.
4. **Personalizado, com volta**  
   O modelo agora aparece como "Personalizado", com "Editar" para mudar de novo e o mesmo "Não usar" de antes. "Voltar ao modelo da plataforma" pergunta antes: "Voltar ao modelo da plataforma? As mudanças da empresa deixam de valer nas próximas propostas." Ao confirmar, a cópia da clínica é desativada e as próximas propostas voltam a usar o texto original.

---

<a id="m-financeiro"></a>

## Financeiro

**Tela:** `/app/settings/tenant/financeiro`  
**Resumo:** Onde você diz onde o dinheiro da clínica fica, como o cliente paga, como cada entrada e saída é classificada e quais contas se repetem todo mês.

**Lições:** [Conhecendo o Financeiro](#l-financeiro--conhecendo-a-tela) · [Cadastrar, editar e desativar uma conta](#l-financeiro--contas) · [Formas de pagamento](#l-financeiro--formas-de-pagamento) · [Plano de contas](#l-financeiro--plano-de-contas) · [Contas que se repetem todo mês](#l-financeiro--todo-mes)

<a id="l-financeiro--conhecendo-a-tela"></a>

### Conhecendo o Financeiro

- **Objetivo:** Achar a tela pelas Configurações e saber para que serve cada uma das listas.
- **Papel mínimo:** Administrador
- **Busca no curso:** configurar financeiro; onde cadastro as contas; formas de pagamento da clínica; plano de contas; organizar o dinheiro; caixa e banco

1. **Onde fica** — `/app/settings`  
   Abra "Configurações" no rodapé do menu da esquerda. No grupo "Sua empresa" está o cartão "Financeiro". Para seguir, clique nele.
2. **Onde o dinheiro fica e como o cliente paga**  
   A tela é uma página só, com várias listas uma embaixo da outra. "Contas" são os lugares onde o dinheiro fica: o caixa da recepção, a conta no banco. "Formas de pagamento" são os jeitos como o cliente paga, e cada uma diz em qual conta o dinheiro cai. Por isso as duas ficam juntas: dá para conferir de uma olhada que o Pix cai na conta do banco e o dinheiro vivo cai no caixa. O aviso ⚠️ ao lado de "Cartão de crédito" quer dizer que essa forma ainda não tem conta. Você resolve isso na lição "Formas de pagamento".
3. **Como cada lançamento é classificado**  
   Mais abaixo, o "Plano de contas" é a lista de categorias que separam cada entrada e cada saída, como "Consultas e sessões" ou "Aluguel". Se quem administra o servidor instalar o módulo "Comandas", aparece logo depois uma parte chamada "Comissão", para combinar quanto cada pessoa da equipe recebe por atendimento.
4. **As contas de todo mês**  
   No fim da página, "Todo mês" guarda as contas que se repetem, como o aluguel e a internet. O sistema abre cada uma no dia certo, para você não esquecer de lançar. Nas próximas lições você aprende a mexer em cada lista.
   > 💡 Quem é atendente vê as listas, mas não vê os campos nem os botões de cadastrar, editar e desativar. Só gerentes e administradores mudam o Financeiro.

<a id="l-financeiro--contas"></a>

### Cadastrar, editar e desativar uma conta

- **Objetivo:** Criar uma conta nova, corrigir o nome de uma conta e tirar de uso a que não serve mais.
- **Papel mínimo:** Administrador
- **Busca no curso:** cadastrar conta do banco; criar caixa da clínica; onde o dinheiro fica; renomear conta; desativar conta financeira; conta da maquininha

1. **Os campos da conta** — `/app/settings/tenant/financeiro`  
   Em "Contas", escreva o nome da conta e escolha o tipo: "Caixa" (dinheiro guardado na clínica), "Banco" ou "Outra". O botão "Adicionar conta" só fica disponível quando o nome tem pelo menos 2 letras. Embaixo fica a lista das contas que estão em uso, com o nome e o tipo de cada uma.
2. **Preencher**  
   Vamos cadastrar a conta onde cai o dinheiro das vendas na maquininha de cartão. Escreva "Conta da maquininha" e escolha o tipo "Outra". Depois, clique em "Adicionar conta".
3. **A conta entrou na lista**  
   A "Conta da maquininha" aparece na lista, com o tipo "Outra", e o campo de nome fica vazio para a próxima. A partir de agora ela aparece para escolher nas formas de pagamento e nas contas de todo mês. Se já existir uma conta em uso com o mesmo nome, o sistema avisa e não cria outra.
4. **Corrigir uma conta**  
   Para mudar o nome ou o tipo de uma conta, clique em "Editar" na linha dela. Os dados dela sobem para os campos do alto, e o botão vira "Salvar". Mude o que precisar e clique em "Salvar". Os pagamentos ligados a essa conta continuam ligados a ela. Se mudar de ideia, "Cancelar" limpa os campos sem mudar nada.
5. **Tirar uma conta de uso**  
   Quando uma conta não serve mais, clique em "Desativar" na linha dela. Ela não é apagada: os lançamentos antigos continuam guardados com ela. Ela só sai da lista e deixa de aparecer para escolher. Atenção: o clique vale na hora, sem pergunta de confirmação.
6. **Fora da lista**  
   A "Conta da maquininha" saiu da lista. Se alguma forma de pagamento ainda apontava para ela, a forma passa a mostrar "conta removida" no lugar do nome. Troque a conta dessa forma logo: o sistema não troca sozinho, e enquanto você não troca, o dinheiro pago com ela continua indo para a conta desativada. O mesmo vale para as contas de todo mês ligadas a ela.

<a id="l-financeiro--formas-de-pagamento"></a>

### Formas de pagamento

- **Objetivo:** Dizer em qual conta cai cada forma de pagamento e cadastrar uma forma nova.
- **Papel mínimo:** Administrador
- **Busca no curso:** formas de pagamento; cadastrar pix; cartão de crédito e débito; sem conta definida; em qual conta cai o pagamento; como o cliente paga

1. **O aviso de forma sem conta** — `/app/settings/tenant/financeiro`  
   Cada linha mostra a forma de pagamento e, depois da seta, a conta onde o dinheiro cai. "Cartão de crédito" está com o aviso "sem conta definida". Dá para cadastrar a forma antes de decidir a conta. Mas, se a clínica usa comandas, uma comanda paga com ela não fecha: na hora de fechar, a tela da comanda avisa que a forma ainda não tem conta de destino. Para resolver, clique em "Editar" na linha do cartão de crédito.
2. **Escolher a conta**  
   O nome "Cartão de crédito" sobe para o campo do alto. Em "Conta de destino", escolha "Conta corrente da clínica", que é onde a operadora do cartão deposita. Depois clique em "Salvar".
3. **Aviso resolvido**  
   O aviso sumiu: agora a linha diz "Cartão de crédito → Conta corrente da clínica". Se a clínica usa comandas, a partir daqui toda comanda paga no cartão de crédito põe o dinheiro nessa conta.
4. **Cadastrar uma forma nova**  
   Para aceitar cartão de débito, escreva "Cartão de débito" no nome e, em "Conta de destino", escolha "Conta corrente da clínica". Depois clique em "Adicionar forma". Se ainda não souber a conta, dá para deixar "Decidir depois": a forma é cadastrada com o aviso de sem conta, e você resolve depois como acabou de fazer.
5. **Pronta para usar**  
   "Cartão de débito → Conta corrente da clínica" entra na lista, em ordem alfabética. Se a clínica usa comandas, ela passa a aparecer como opção de pagamento na hora de fechar uma. "Desativar" tira uma forma de uso sem apagar os pagamentos antigos feitos com ela.

<a id="l-financeiro--plano-de-contas"></a>

### Plano de contas

- **Objetivo:** Criar uma categoria nova para classificar entradas ou saídas.
- **Papel mínimo:** Administrador
- **Busca no curso:** plano de contas; categoria de despesa; classificar entrada e saída; separar gastos da clínica; categoria de receita; o que é plano de contas

1. **As categorias do dinheiro** — `/app/settings/tenant/financeiro`  
   O plano de contas é a lista de categorias que dizem de onde veio cada entrada e para onde foi cada saída. Cada categoria é de "Entrada" ou de "Saída", e isso aparece depois do nome. Aqui, "Consultas e sessões" e "Convênios" são entradas; "Aluguel" e "Material de consumo" são saídas.
2. **Escolher é obrigatório**  
   Escreva o nome da categoria nova, por exemplo "Material de escritório". Repare que o botão "Adicionar plano" continua apagado: o campo "Entrada ou saída?" começa vazio de propósito, e o botão só funciona depois que você escolhe. Assim ninguém cadastra uma despesa como se fosse entrada por pressa.
3. **Escolher a direção**  
   Material de escritório é dinheiro que sai, então escolha "Saída". O botão "Adicionar plano" acende. Clique nele.
4. **Categoria criada**  
   "Material de escritório · Saída" entra na lista e os dois campos voltam ao começo. "Editar" e "Desativar" funcionam como nas contas: editar corrige o nome ou a direção; desativar tira a categoria de uso sem apagar os lançamentos que já foram classificados com ela.

<a id="l-financeiro--todo-mes"></a>

### Contas que se repetem todo mês

- **Objetivo:** Cadastrar uma conta fixa, como o contador, para o sistema abri-la sozinho todo mês.
- **Papel mínimo:** Administrador
- **Busca no curso:** conta fixa todo mês; lançamento recorrente; aluguel todo mês; despesa mensal automática; lembrar de pagar conta; cadastrar contador

1. **O que já se repete** — `/app/settings/tenant/financeiro`  
   Em "Todo mês" ficam as contas fixas. Cada linha mostra o nome, se é saída ou entrada, o valor e o dia do mês. No dia certo, o sistema abre a conta sozinho, e ela aparece em Análise › Faturamento. Ela nasce como conta a pagar, nunca como paga: o sistema sabe que a conta vence, mas não sabe se você já pagou. Atenção: se você cadastrar uma conta fixa com um dia que já passou neste mês, o sistema abre a deste mês em até um dia, mesmo que você já tenha pago.
2. **Preencher a conta fixa**  
   Escreva o nome ("Honorários do contador"), deixe "Saída", escolha a conta de onde o dinheiro sai, o valor (450,00) e o dia do mês. Aqui o contador é pago no dia 31. Como nem todo mês tem dia 31, aparece o aviso: "Nos meses mais curtos, cai no último dia do mês." O botão "Adicionar" só acende com tudo preenchido.
3. **Conta fixa cadastrada**  
   A linha "Honorários do contador · Saída · R$ 450,00 · dia 31" entra na lista. Repare que os campos continuam preenchidos: não clique em "Adicionar" de novo, senão a mesma conta fixa entra duas vezes. Para mudar o valor ou o dia, use "Editar" e depois "Salvar". O "×" no fim da linha tira a conta fixa de uso, sem pergunta de confirmação; as contas que ela já abriu continuam lá.

---

<a id="m-meta-de-vendas"></a>

## Meta de vendas

**Tela:** `/app/settings/metas`  
**Resumo:** Dizer quantas vendas a clínica quer fechar no mês, para a tela de Desempenho mostrar quanto já foi feito e quanto falta.

**Lições:** [Definindo a meta do mês](#l-meta-de-vendas--definindo-a-meta) · [Acompanhando e corrigindo a meta](#l-meta-de-vendas--acompanhando-a-meta)

<a id="l-meta-de-vendas--definindo-a-meta"></a>

### Definindo a meta do mês

- **Objetivo:** Achar a tela Meta de vendas, entender os dois campos e salvar a meta do mês.
- **Papel mínimo:** Administrador
- **Busca no curso:** meta de vendas; meta do mês; definir meta; quanto quero vender no mês; objetivo de vendas; alvo de vendas da equipe; cadastrar meta mensal

1. **Onde fica a tela** — `/app/settings`  
   Clique em "Configurações", no rodapé do menu lateral. Na parte "Sua empresa" fica o cartão "Meta de vendas". É ali que você diz quantas vendas a clínica quer fechar no mês. A tela de Desempenho usa esse número para mostrar quanto já foi feito e quanto falta.
   > 💡 Só o administrador e o gerente abrem esta tela. Quem é atendente, como a Ana, vê a meta no Desempenho, mas não consegue mudá-la.
2. **As partes da tela**  
   No alto, o título e a frase logo abaixo dele explicam para que serve a meta. No meio fica o quadro com os dois campos e o botão "Salvar meta". Embaixo, uma nota avisa o que entra na conta: a meta é da clínica inteira e conta a quantidade de vendas ganhas no mês, e não o valor delas.
3. **Preenchendo os campos**  
   O campo "Mês" já vem no mês atual: a meta vale do dia 1º ao último dia dele. Em "Vendas ganhas no mês", digite quantos negócios a clínica quer fechar como ganhos. Aqui a Helena digitou 20. Use um número inteiro maior que zero: com o campo vazio ou em zero, o botão "Salvar meta" fica apagado. Embaixo do número, a frase "Ainda não há meta para este mês." confirma que este mês ainda não tem meta salva.
   > 💡 Conta como venda o negócio marcado como ganho no funil, na data em que foi fechado. Um negócio criado no mês passado e ganho neste mês conta para este mês.
4. **Salvando a meta**  
   Clique em "Salvar meta". Um aviso rápido, "Meta salva.", pisca por alguns segundos no canto de baixo da tela (some sozinho), e a frase embaixo do número muda para "Salvar de novo corrige a meta deste mês — nada é duplicado.". A partir de agora a tela de Desempenho mostra o progresso da clínica contra essas 20 vendas.

<a id="l-meta-de-vendas--acompanhando-a-meta"></a>

### Acompanhando e corrigindo a meta

- **Objetivo:** Ver no Desempenho quanto da meta já foi feito e corrigir o número quando o plano do mês mudar.
- **Papel mínimo:** Administrador
- **Busca no curso:** acompanhar meta de vendas; quanto falta para a meta; percentual da meta; progresso das vendas do mês; mudar a meta; corrigir meta do mês; meta no desempenho

1. **Quando ainda não há meta** — `/app/metrics`  
   Abra "Desempenho", no grupo Análise do menu, e desça até o quadro "Meta do mês". Sem meta cadastrada, ele diz "Nenhuma meta cadastrada para este mês." e não mostra zero: a clínica pode ter vendido, só não tem alvo. O link "Definir a meta" leva direto à tela de cadastro.
   > 💡 O administrador, o gerente e o atendente veem este quadro. O link "Definir a meta" só aparece para o administrador e o gerente; o atendente lê "Só quem administra a empresa define a meta.".
2. **Cadastrando pelo atalho**  
   O link abre a tela Meta de vendas. A Helena digitou 20 em "Vendas ganhas no mês" e clicou em "Salvar meta". O aviso "Meta salva." pisca no canto de baixo e some sozinho, e a frase embaixo do número passa a dizer que salvar de novo corrige a meta.
3. **Lendo o progresso** — `/app/metrics`  
   De volta ao Desempenho, o quadro mostra o mês ao lado do título e, na linha "Empresa", quanto da meta já foi feito: "45% da meta". A barra enche conforme as vendas entram. Embaixo, "9 de 20 Vendas ganhas" e "Faltam 11 para a meta". Quando a meta é batida, a barra fica verde e a frase vira "Meta atingida.".
   > 💡 Para o administrador e o gerente, o quadro conta as vendas da clínica inteira e não muda quando se escolhe um atendente no filtro "Atendente".
4. **Corrigindo a meta** — `/app/settings/metas`  
   O plano mudou? Volte em Configurações, "Meta de vendas". O campo já mostra a meta atual. Troque o número e clique em "Salvar meta" de novo: pisca o aviso "Meta salva.", que some sozinho, e a meta do mês é corrigida, sem criar outra. Aqui a Helena baixou de 20 para 15, porque uma fisioterapeuta entrou de férias. Uma meta não pode ser apagada, só corrigida.
5. **O progresso com a meta nova** — `/app/metrics`  
   No Desempenho, o quadro já usa a meta nova: as mesmas 9 vendas agora são "60% da meta", e "Faltam 6 para a meta". Se ainda aparecer o número antigo, recarregue a página.

---

<a id="m-perfil"></a>

## Perfil

**Tela:** `/app/settings/profile`  
**Resumo:** Onde você acha todas as Configurações e ajusta o que é só seu: o nome que a equipe vê, a foto, o idioma e o fuso horário.

**Lições:** [Achando as Configurações](#l-perfil--achando-as-configuracoes) · [Seu nome e sua foto](#l-perfil--nome-e-foto) · [Idioma e fuso horário](#l-perfil--idioma-e-fuso)

<a id="l-perfil--achando-as-configuracoes"></a>

### Achando as Configurações

- **Objetivo:** Saber chegar às Configurações de qualquer tela e entender como a lista de telas está dividida.
- **Papel mínimo:** Administrador
- **Busca no curso:** configurações; onde ficam as configurações; ajustes do sistema; minha conta; dados da empresa; engrenagem; preferências

1. **A porta das Configurações** — `/app/settings`  
   O item "Configurações", com o desenho de uma engrenagem, fica no rodapé do menu da esquerda e aparece em todas as telas. Clicando nele, abre esta página, que lista todas as telas de ajuste do sistema. Cada cartão tem o nome da tela e uma frase dizendo para que ela serve. O primeiro grupo, "Sua empresa", vale para a clínica inteira: tipos de agendamento, equipe, marca, recursos que se ligam e desligam, plano e outros.
2. **Dados e acesso**  
   Rolando até o fim aparece "Dados e acesso": os pedidos de dados feitos pelos clientes ("LGPD"), as chaves para outros sistemas conversarem com o seu ("API Tokens"), os dados da linha telefônica para a IA fazer chamadas de voz ("Trunk SIP") e o endereço de um sistema de fora que a IA pode consultar ("Servidor MCP externo"). Cada pessoa só vê os cartões que o cargo dela permite usar, e alguns só aparecem quando o recurso está ligado na instalação: um atendente vê bem menos cartões que a dona da clínica.
3. **Sua conta**  
   Logo acima fica "Sua conta", com o que vale só para você: "Perfil" (nome, idioma, fuso e foto), "Segurança" (verificação em duas etapas e sessões), "Notificações" (sobre o que você quer ser avisado) e "App no celular" (instalar o sistema no telefone). Cada pessoa da equipe ajusta o seu, sem mexer no dos colegas. Para seguir, clique em "Perfil".

<a id="l-perfil--nome-e-foto"></a>

### Seu nome e sua foto

- **Objetivo:** Mudar o nome com que você aparece no sistema e colocar uma foto no seu perfil.
- **Papel mínimo:** Administrador
- **Busca no curso:** mudar meu nome; trocar nome do usuário; colocar foto de perfil; avatar; foto no canto da tela; meu perfil; trocar email

1. **A tela de Perfil** — `/app/settings/profile`  
   O Perfil guarda os seus dados pessoais dentro do sistema. O "Email" ainda não dá para trocar: logo abaixo dele está escrito "Trocar email — em breve.". Em seguida ficam o "Nome completo", o "Idioma", o "Fuso horário" e o "Avatar URL", que é o endereço da sua foto.
2. **Mudar o seu nome**  
   Apague o nome no campo "Nome completo" e escreva como você quer aparecer, com até 120 caracteres (espaços contam). Depois clique em "Salvar". Aparece o aviso "Perfil atualizado." e o novo nome passa a valer no menu do canto de cima, com as iniciais no círculo. Se ali ainda aparecer o nome antigo, recarregue a página.
   > 💡 O botão "Salvar" grava tudo o que está no formulário de uma vez: nome, idioma, fuso e foto.
3. **Colocar uma foto**  
   Ainda não dá para enviar um arquivo do computador. Para ter foto, cole no campo "Avatar URL" o endereço de uma imagem que já está na internet, aberta para qualquer pessoa (por exemplo, a foto da equipe no site da clínica). Prefira um endereço que comece com "https://". Depois de salvar, a foto entra no círculo do canto de cima, no lugar das iniciais. Se não aparecer, recarregue a página.
   > 💡 Para tirar a foto, apague o endereço deste campo e salve: as iniciais voltam.
4. **Onde o nome e a foto aparecem** — `/app/settings/profile`  
   Clique no círculo do canto de cima, à direita, para abrir o menu da sua conta. No alto dele aparecem o seu nome e o seu email, do jeito que estão gravados no Perfil. O círculo mostra a sua foto ou, sem foto, as iniciais do nome (aqui, "HP", de Helena Prado). Logo abaixo, quem administra o servidor vê "Modo administrador". "Sair" desconecta você de todos os aparelhos onde estava conectado, não só deste, e os avisos no celular também param.

<a id="l-perfil--idioma-e-fuso"></a>

### Idioma e fuso horário

- **Objetivo:** Escolher em que idioma o sistema aparece para você e conhecer o campo de fuso horário.
- **Papel mínimo:** Administrador
- **Busca no curso:** mudar idioma; sistema em espanhol; trocar língua; fuso horário; horário errado; português ou espanhol

1. **Escolher o idioma** — `/app/settings/profile`  
   Clique no campo "Idioma" para ver as opções. "Seguir o idioma da empresa" faz o sistema aparecer no idioma que a empresa escolheu para todos: se a empresa mudar, você muda junto. Escolhendo "Português (BR)" ou "Español" e clicando em "Salvar", vale a sua escolha, mesmo que a empresa use outro idioma.
   > 💡 O idioma da empresa fica em Configurações › Organização.
2. **O atalho do topo**  
   Há um jeito mais rápido de trocar o idioma, de qualquer tela: o botão com a sigla do idioma em uso ("PT"), no canto de cima, ao lado do botão de tema. Ao escolher outro idioma ali, a página recarrega na hora já no idioma novo, e a escolha fica gravada no seu perfil.
   > 💡 Escolher um idioma por este atalho faz você parar de acompanhar o idioma da empresa. Para voltar a acompanhá-lo, escolha "Seguir o idioma da empresa" no Perfil e clique em "Salvar".
3. **O fuso horário**  
   O campo "Fuso horário" lista as cidades pelo nome técnico, como "America/Sao_Paulo" (horário de Brasília) ou "America/Manaus". A escolha fica guardada no seu perfil quando você clica em "Salvar", mas hoje ela ainda não muda os horários que você vê: a Agenda segue o fuso da empresa, para todos da equipe verem a mesma semana.
   > 💡 Se os horários estão errados para a clínica toda, ajuste o fuso em Configurações › Organização.

---

<a id="m-seguranca"></a>

## Segurança

**Tela:** `/app/settings/security`  
**Resumo:** Onde você protege a sua conta com um código do celular, decide quem da equipe precisa fazer o mesmo e encerra o acesso em todos os aparelhos.

**Lições:** [Conhecendo a tela de Segurança](#l-seguranca--conhecendo-a-seguranca) · [Ativando a verificação em duas etapas](#l-seguranca--ativando-a-verificacao) · [Exigindo a verificação da equipe](#l-seguranca--exigir-da-equipe)

<a id="l-seguranca--conhecendo-a-seguranca"></a>

### Conhecendo a tela de Segurança

- **Objetivo:** Achar a tela de Segurança e reconhecer cada quadro: verificação em duas etapas, regra para a equipe, códigos de recuperação, chamada de voz e sessões.
- **Papel mínimo:** Administrador
- **Busca no curso:** segurança da conta; proteger minha conta; senha vazada; código no celular; sair de todos os aparelhos; onde fica a segurança; autenticação em dois fatores

1. **Onde fica a Segurança** — `/app/settings`  
   Abra "Configurações", no rodapé do menu lateral. Na parte "Sua conta" fica o cartão "Segurança". Clique nele.
2. **A verificação em duas etapas**  
   O primeiro quadro é a "Verificação em duas etapas". Com ela ligada, além da senha o sistema pede um código de 6 dígitos que só aparece no seu celular. Assim, se alguém descobrir a sua senha, ainda não consegue entrar. O selo do lado direito mostra a situação da sua conta: aqui está "Desativada". Logo abaixo fica o quadro "Exigir da equipe", que só o administrador vê. Ele é explicado na lição "Exigindo a verificação da equipe".
   > 💡 Na próxima lição você vê como ativar pelo botão "Ativar".
3. **Códigos de recuperação**  
   Os códigos de recuperação são a sua saída se você perder o celular. Na tela que pede o código, clique em "Perdi acesso ao autenticador" e digite um deles: o sistema desliga a verificação da sua conta, e você entra só com a senha e cadastra o celular novo. Cada código vale uma vez só. Enquanto a verificação em duas etapas está desligada, o botão "Regenerar códigos de recuperação" fica cinza. Com ela ligada, o botão gera códigos novos e os antigos deixam de valer na mesma hora. A frase "Habilite MFA antes de gerar códigos." quer dizer isso: ligue primeiro a verificação.
   > 💡 Guarde os códigos fora do celular: num papel ou num cofre de senhas.
4. **Chamada de voz pelo WhatsApp**  
   Este quadro autoriza as chamadas de voz pelo número de WhatsApp da empresa. Leia o aviso amarelo antes: para fazer as chamadas, o sistema conecta um segundo aparelho ao número da empresa por um caminho que não é o oficial do WhatsApp, e o WhatsApp pode bloquear a conta inteira. Nesta instalação aparece a frase de que o servidor não tem a chamada de voz instalada: quem cuida da instalação precisa ligá-la primeiro.
   > 💡 Com a chamada de voz instalada, o administrador marca a caixa de aceite do risco e clica em "Ligar chamada de voz". Isso só autoriza: o aparelho ainda precisa ser conectado em Conexões, na aba "Chamada de voz".
5. **Sair de todos os aparelhos**  
   Em "Sessões ativas" você encerra o acesso da sua conta em todos os aparelhos de uma vez: no computador da recepção, no celular, em qualquer lugar. Use quando perder um aparelho ou suspeitar que alguém entrou na sua conta. A lista de cada aparelho ainda não existe: por enquanto, só o botão de sair de todos. Clique em "Sair de todos os dispositivos".
6. **Confirmar antes de sair**  
   O sistema pede confirmação. Ao clicar em "Confirmar", a sua conta sai de todos os aparelhos, inclusive deste, e você volta para a tela de entrada. Junto, os avisos no celular param e os navegadores marcados como confiáveis voltam a pedir o código. Para desistir, clique em "Cancelar".

<a id="l-seguranca--ativando-a-verificacao"></a>

### Ativando a verificação em duas etapas

- **Objetivo:** Saber o que acontece em cada etapa ao ligar o código do celular na sua conta.
- **Papel mínimo:** Administrador
- **Busca no curso:** ativar verificação em duas etapas; código do celular para entrar; google authenticator; configurar autenticador; qr code de segurança; códigos de recuperação; proteger login

1. **O botão Ativar** — `/app/settings/security`  
   Antes de começar, instale no celular um aplicativo autenticador, como Google Authenticator, Authy, 1Password ou Bitwarden. Depois, na tela de Segurança, clique em "Ativar".
2. **As etapas do cadastro**  
   Abre a janela "Configure a verificação em duas etapas". Ao clicar em "Iniciar configuração", aparece um QR code: no aplicativo autenticador, adicione uma conta nova e aponte a câmera para ele. Se não der para apontar a câmera, clique em "Não consegue escanear? Digite o código manual" e copie a sequência no aplicativo. O aplicativo passa a mostrar um código de 6 dígitos que muda a cada 30 segundos. Digite esse código na janela: ao digitar o sexto número ela confere sozinha (o botão "Confirmar" faz o mesmo).
   > 💡 Esta janela não tem botão de fechar. Se abriu sem querer e você ainda não digitou o código, recarregue a página: ela some sem mudar nada na sua conta. Depois que o código é aceito não recarregue, ou você perde os códigos de recuperação da próxima etapa.
3. **Depois de confirmar** — `/app/settings/security`  
   Com o código certo, a janela mostra 10 códigos de recuperação. Eles não aparecem de novo: use "Copiar todos" ou "Baixar .txt", guarde num lugar seguro, marque "Salvei meus códigos em local seguro." e clique em "Concluir". A página recarrega. A foto mostra esta tela antes da ativação. Depois de concluir, o selo "Desativada" passa para "Ativada" e o botão cinza "Regenerar códigos de recuperação" passa a funcionar. O botão "Ativar" vira "Desligar", a não ser que a empresa exija a verificação de você. A partir daí, toda entrada pede o código do aplicativo.
   > 💡 Na tela que pede o código ao entrar, marque "Confiar neste dispositivo por 30 dias" ANTES de digitar o código, porque a tela confere sozinha no sexto número. Esse navegador passa a aparecer no quadro "Dispositivos confiáveis" desta tela, que só existe com a verificação ligada.

<a id="l-seguranca--exigir-da-equipe"></a>

### Exigindo a verificação da equipe

- **Objetivo:** Escolher quem da equipe precisa ligar a verificação em duas etapas e quantos dias de prazo cada um tem.
- **Papel mínimo:** Administrador
- **Busca no curso:** obrigar equipe a usar código; exigir verificação dos funcionários; segurança da equipe; prazo para ativar verificação; dias de carência; proteger dados dos clientes

1. **O quadro Exigir da equipe** — `/app/settings/security`  
   Só quem é administrador da empresa vê o quadro "Exigir da equipe". Nele você decide quem precisa ligar a verificação em duas etapas. Vale ligar se a sua equipe mexe com dados de clientes: uma senha vazada vira só um susto, não um vazamento. Aqui a clínica ainda está em "Não exigir de ninguém".
2. **Quem e em quanto tempo**  
   Em "Nível mínimo", escolha o cargo a partir do qual a verificação passa a ser obrigatória. Aqui foi escolhido "Atendente": vale para atendentes, gerentes e administradores. Em "Dias de carência", diga quantos dias cada um tem para ativar, de 0 a 30; aqui, 7. O botão "Salvar" só acende quando algo mudou.
   > 💡 "Somente leitura" alcança todo mundo. Com "Não exigir de ninguém", o campo de dias fica cinza.
3. **Como a regra funciona**  
   As duas frases debaixo dos campos resumem a regra. A primeira diz quem é alcançado: o cargo escolhido e todos os acima dele. A segunda diz como corre o prazo: durante os dias de carência ninguém é bloqueado; depois deles, quem foi alcançado e ainda não ativou vê a tela travada até fazer o cadastro. O prazo conta a partir da mudança da regra, ou da entrada da pessoa na empresa, o que vier depois. Por isso, mudar a regra de novo reinicia a contagem de todos. Ao clicar em "Salvar", a regra é gravada e a página recarrega com a escolha nova nos campos.
   > 💡 A regra vale para você também. Se você ainda não ativou a sua verificação e escolher 0 dias, a sua tela trava logo depois de salvar: ative a sua antes. Quem é alcançado pela regra e já tem a verificação ligada não consegue mais desligá-la na própria tela de Segurança.

---

<a id="m-notificacoes"></a>

## Notificações

**Tela:** `/app/settings/notifications`  
**Resumo:** Onde você escolhe sobre o que quer ser avisado, como o aviso aparece na tela e no celular, os lembretes de tarefa e os sons da equipe.

**Lições:** [Conhecendo a tela de notificações](#l-notificacoes--conhecendo-notificacoes) · [Lembretes de tarefa](#l-notificacoes--lembretes-de-tarefa) · [O que o aviso mostra e os sons](#l-notificacoes--o-que-o-aviso-mostra-e-sons)

<a id="l-notificacoes--conhecendo-notificacoes"></a>

### Conhecendo a tela de notificações

- **Objetivo:** Saber até onde os avisos chegam nesta instalação e escolher, por tipo de aviso, se ele aparece na tela.
- **Papel mínimo:** Administrador
- **Busca no curso:** notificações; avisos; desligar aviso; aviso de mensagem nova; notificação no navegador; parar de receber avisos; configurar alertas

1. **Onde ficam as notificações** — `/app/settings`  
   Clique em "Configurações", no rodapé do menu lateral, para abrir a lista de todas as configurações. Notificações fica no grupo "Sua conta": é onde você decide sobre o que quer ser avisado e por onde.
2. **Até onde os avisos chegam**  
   O quadro amarelo no topo diz o que esta instalação consegue fazer. Na imagem, ele avisa que os avisos só aparecem enquanto o site está aberto numa aba: faltam as chaves do servidor, e quem cuida do servidor resolve rodando a atualização da instalação, que cria essas chaves. Se na sua tela o quadro falar em conexão segura (https), quem cuida do servidor precisa ligar um domínio com https. Se ele disser que os avisos já funcionam "inclusive com a aba fechada", não falta nada. O link "Receber no celular: instalar o app" leva ao passo a passo de pôr o sistema no celular.
3. **Os tipos de aviso**  
   A tabela lista os seis tipos de aviso: "Nova mensagem", "Lead atribuído a você", "Lead ganho" e "Lead perdido" (dos negócios em que você é o responsável), "Você foi mencionado" (quando alguém cita você numa nota interna de conversa) e "Ligação recebida" (só para quem usa a telefonia do sistema). Cada coluna é um jeito de ser avisado. "In-app" é a janelinha que surge no canto da tela com o site aberto. "Push" é a notificação do próprio computador ou celular, que aparece mesmo com outra janela na frente; com o site fechado, só se o quadro do topo disser que a instalação consegue. "Email" ainda não está disponível. Nesta foto a coluna Push aparece apagada: o navegador usado bloqueou as notificações, como explicamos no passo 5.
4. **Desligar um aviso na tela**  
   Clique no interruptor da linha e da coluna que quer mudar. Aqui, desligamos a janelinha de "Lead perdido": quando um negócio em que você é o responsável for marcado como perdido, nada aparece no canto da tela. A mudança vale na hora e não tem botão de salvar. Ela fica guardada só neste navegador: no celular ou em outro computador, cada um escolhe de novo.
5. **O interruptor que manda nos outros**  
   O "Push" de "Nova mensagem" é a chave geral dos avisos fora do site neste aparelho: desligado, nenhum outro aviso vai para a bandeja e os outros interruptores de Push ficam travados. Os interruptores de Push de cada tipo só valem com o site aberto; com o site fechado, quem manda é só essa chave geral. Na imagem, o navegador está bloqueando as notificações. Por isso a linha mostra "O navegador bloqueou as notificações" e a coluna Push fica apagada: os interruptores até aparecem ligados, mas não valem nem mudam enquanto o navegador bloquear. Para liberar, clique no ícone à esquerda do endereço do site (um cadeado ou dois tracinhos), permita as notificações e recarregue a página.
   > 💡 Num navegador que ainda não respondeu, ligar o Push faz o navegador perguntar se o site pode mostrar notificações. Responda "Permitir".

<a id="l-notificacoes--lembretes-de-tarefa"></a>

### Lembretes de tarefa

- **Objetivo:** Escolher quando o sistema avisa sobre tarefas perto do prazo ou vencidas, e se o aviso chega também no WhatsApp.
- **Papel mínimo:** Administrador
- **Busca no curso:** lembrete de tarefa; aviso de prazo; tarefa vencida; avisar antes de vencer; lembrete no whatsapp; não esquecer retorno ao cliente

1. **O quadro dos lembretes** — `/app/settings/notifications`  
   Mais abaixo na tela fica "Lembretes de tarefa". Ele avisa o responsável quando o prazo de uma tarefa chega perto, mesmo que ninguém esteja com o site aberto: o aviso fica guardado na Central. De fábrica, o aviso de prazo perto vem ligado, com 1 hora de antecedência.
2. **Mudar a antecedência**  
   Em "Antecedência do aviso", escolha entre 15 minutos, 1 hora ou 1 dia. Aqui escolhemos "1 dia": o aviso chega 24 horas antes do prazo. A escolha é salva na hora e é só sua: cada pessoa da equipe escolhe os próprios lembretes.
3. **Avisar quando a tarefa vence**  
   Ligue "Avisar quando a tarefa vence sem conclusão" para receber um aviso quando o prazo passar e a tarefa ainda não estiver concluída. Ele vem desligado de fábrica. O aviso sai uma vez só por tarefa, sem repetir.
4. **Receber também no WhatsApp**  
   Ligue "Receber também no WhatsApp" e digite o seu número só com algarismos, começando pelo 55 do Brasil e o DDD, como pede o campo "Número com DDD, só dígitos". Ao sair do campo, ele é salvo. A mensagem sai pelo número de WhatsApp da empresa, e só quando ele estiver conectado. Ela traz só o nome da tarefa e aparece na caixa de entrada como uma conversa com o seu contato. O seu número precisa estar cadastrado como contato no sistema: sem isso, o lembrete fica só na Central.

<a id="l-notificacoes--o-que-o-aviso-mostra-e-sons"></a>

### O que o aviso mostra e os sons

- **Objetivo:** Decidir o que os avisos mostram com o celular bloqueado e conhecer os sons dos avisos da equipe.
- **Papel mínimo:** Administrador
- **Busca no curso:** privacidade da notificação; esconder mensagem no celular bloqueado; tela bloqueada; som do aviso; trocar som da notificação; aviso sonoro

1. **O que aparece fora do site** — `/app/settings/notifications`  
   O quadro "O que os avisos mostram fora do app" decide o que aparece no aviso do celular bloqueado e nas notificações do computador. A escolha vale para toda a empresa. De fábrica, fica em "Mostrar quem mandou (recomendado)": aparecem o nome e a foto do cliente, mas não o que ele escreveu.
2. **Esconder tudo**  
   Para mais sigilo, escolha "Esconder tudo": o aviso diz só que chegou algo, sem o nome do cliente nem a mensagem. A mudança é salva assim que você clica. Só administradores podem mudar; os outros da equipe veem a escolha, com o aviso "Quem decide é um administrador."
3. **Os sons dos avisos**  
   No fim da tela ficam os "Sons dos avisos". Eles tocam com o site aberto quando chega um aviso na Central. "Etapa que avisa" toca quando um negócio entra numa etapa do funil marcada para avisar. "Precisa de uma pessoa" toca quando o atendimento automático passa a conversa para alguém da equipe, ou quando ele para porque acabou o saldo do serviço de IA. Clique em "Ouvir" para escutar o som.
4. **Trocar por um som seu**  
   Hoje as duas linhas dizem "Som do sistema": é o som de fábrica. Clique em "Trocar som" e escolha um arquivo de áudio MP3, OGG ou WAV de até 1 MB no seu computador. O som novo vale para toda a equipe, e a linha passa a dizer "Som personalizado". Para voltar ao som de fábrica, aparece o botão "Usar o do sistema". Trocar e voltar o som é para gerentes e administradores.

---

<a id="m-app-no-celular"></a>

## App no celular

**Tela:** `/app/settings/aplicativo`  
**Resumo:** Como colocar o sistema na tela de início do celular, como um aplicativo, e onde ligar os avisos de mensagem nova depois de instalar.

**Lições:** [Conhecendo a tela App no celular](#l-app-no-celular--conhecendo-a-tela) · [Do app aos avisos de mensagem nova](#l-app-no-celular--ligar-os-avisos)

<a id="l-app-no-celular--conhecendo-a-tela"></a>

### Conhecendo a tela App no celular

- **Objetivo:** Achar a tela App no celular em Configurações e entender o que ela mostra no computador e no celular.
- **Papel mínimo:** Administrador
- **Busca no curso:** app no celular; instalar o aplicativo; baixar o app; usar no celular; atalho na tela de início; aplicativo para iPhone; aplicativo para Android

1. **Onde fica a tela** — `/app/settings`  
   Clique em "Configurações", no rodapé do menu lateral. Na parte "Sua conta" fica o cartão "App no celular". Não existe app para baixar em loja: o próprio sistema vira um ícone na tela de início do celular, e abre como um aplicativo. Cada pessoa da equipe faz isso no próprio aparelho.
2. **A tela se ajusta ao seu aparelho**  
   A tela tem uma caixa só, e o que está escrito nela depende de onde você a abriu: computador, iPhone ou Android. O sistema descobre isso sozinho, então você não precisa escolher nada. Nesta foto, aberta num navegador de computador que não oferece instalação, ela pede para você abrir o mesmo endereço no celular. Se o seu Chrome ou Edge oferecer a instalação, aparece o botão "Instalar app".
3. **No computador**  
   Num computador cujo navegador não oferece instalação, a caixa diz: "Abra este endereço no celular. No computador, Chrome e Edge instalam pelo ícone na barra de endereço." Ou seja: copie o endereço que está no alto do navegador e abra no celular. Se quiser o sistema como programa no computador, use o Chrome ou o Edge: a caixa mostra o botão "Instalar app" ou, se não mostrar, clique no ícone de instalar no canto da barra de endereço.
   > 💡 No celular, abra o endereço no Chrome (Android) ou no Safari (iPhone). Se o link veio pelo Instagram ou pelo Facebook, a tela avisa que esse navegador de dentro do aplicativo não instala e ensina a abrir no navegador certo. Se veio pelo WhatsApp e a opção de instalar não aparece, toque em Abrir no Safari ou Abrir no Chrome e repita.
4. **No celular**  
   Esta foto ainda é a do computador. Aberta no celular, essa mesma caixa troca de texto e vira o passo a passo daquele aparelho. No iPhone: tocar em Compartilhar, escolher "Adicionar à Tela de Início", abrir pelo ícone novo e entrar de novo com e-mail e senha. No Android: aparece o botão "Instalar app" ou, se ele não aparecer, a tela ensina a usar o menu (⋮) do navegador e tocar em "Instalar app" ou "Adicionar à tela inicial".
   > 💡 No iPhone, os avisos só funcionam no app aberto pelo ícone da tela de início, com iOS 16.4 ou mais novo. Quando você já está dentro do app, a tela mostra "Você já está usando o app."

<a id="l-app-no-celular--ligar-os-avisos"></a>

### Do app aos avisos de mensagem nova

- **Objetivo:** Saber onde ligar os avisos depois de instalar o app e como voltar para a tela de instalação a partir de Notificações.
- **Papel mínimo:** Administrador
- **Busca no curso:** avisos no celular; notificação de mensagem nova; receber aviso com o app fechado; ligar notificações; push no celular; celular não avisa

1. **Notificações e o atalho para o app** — `/app/settings/notifications`  
   Depois de instalar, o passo a passo do celular manda você ligar os avisos em "Notificações", também em Configurações. No alto dessa tela, o link "Receber no celular: instalar o app" traz de volta para a tela App no celular. A caixa de aviso logo abaixo diz se o sistema consegue avisar mesmo fechado. Aqui ela diz que os avisos só aparecem com o site aberto: falta um ajuste no servidor, que quem administra o servidor faz rodando a atualização da instalação. Os comandos que aparecem nela são para quem cuida do servidor, não para você. A última linha avisa que os avisos por e-mail ainda não existem: por isso a coluna Email da tabela fica apagada.
2. **O interruptor que liga os avisos**  
   Na tabela, a linha "Nova mensagem" tem a coluna "Push". É esse interruptor que liga os avisos no aparelho em que você está: ao ligá-lo, o navegador pergunta se pode mostrar notificações, e você toca em permitir. Ele vale só para aquele aparelho, então faça isso no celular, já dentro do app. Nesta foto o navegador tinha bloqueado as notificações: por isso aparece "O navegador bloqueou as notificações. Libere-as nas configurações do site e recarregue." e o interruptor fica cinza e não responde ao clique. Ele parece ligado, mas o aparelho não mostra aviso nenhum até você liberar as notificações no navegador. Logo abaixo, a linha avisa que desligar esse Push desliga todos os avisos daquele aparelho fora do app.
   > 💡 Se o interruptor já aparece ligado e o celular nunca perguntou se podia mostrar notificações, desligue e ligue de novo: a pergunta só aparece no momento em que você liga.
3. **Voltando para a instalação**  
   Clique em "Receber no celular: instalar o app" para abrir a tela App no celular. É o caminho mais curto quando alguém da equipe diz que o celular não está avisando. Confira três coisas: se a caixa de aviso de Notificações diz que os avisos só aparecem com o site aberto (aí quem resolve é quem administra o servidor), se o app foi instalado naquele celular, e se o Push de "Nova mensagem" está ligado nele.

---

<a id="m-equipe"></a>

## Equipe

**Tela:** `/app/team`  
**Resumo:** Quem trabalha no sistema, com qual papel, o que cada um vê no menu, como as conversas são divididas e o horário de cada atendente.

**Lições:** [Conhecendo a tela Equipe](#l-equipe--conhecendo-a-equipe) · [Convidar alguém para a equipe](#l-equipe--convidar-pessoas) · [Escolher o que cada pessoa vê no menu](#l-equipe--interface-de-cada-um) · [Como as conversas são distribuídas](#l-equipe--distribuir-conversas) · [Plantão, carga e capacidade](#l-equipe--plantao-e-capacidade) · [Publicar o horário de atendimento](#l-equipe--horario-de-atendimento)

<a id="l-equipe--conhecendo-a-equipe"></a>

### Conhecendo a tela Equipe

- **Objetivo:** Achar a tela Equipe, entender a lista de membros e saber trocar o papel, tirar e devolver o acesso de alguém.
- **Papel mínimo:** Administrador
- **Busca no curso:** equipe; membros; funcionários; quem tem acesso; papel do usuário; tirar acesso de funcionário; permissões

1. **Onde fica a Equipe** — `/app/settings`  
   A tela Equipe fica nas Configurações, no grupo "Sua empresa". É nela que você vê quem trabalha no sistema, com qual papel, e quantas conversas cada pessoa aguenta ao mesmo tempo. Para seguir, clique em "Equipe".
2. **Duas abas e o botão de convite** — `/app/team`  
   A tela tem duas abas. "Membros" lista as pessoas com acesso e os convites enviados. "Atendimento" mostra como as conversas são distribuídas e o horário de cada um. O botão "Convidar membros" chama gente nova; ele só aparece para quem é Administrador.
3. **A lista de membros**  
   Cada linha é uma pessoa: nome e e-mail, o papel, a interface (o que ela vê no menu), a situação e a última vez que entrou no sistema. "Aceito" quer dizer que a pessoa aceitou o convite e tem acesso (o Carlos ainda não entrou, por isso a última atividade dele está vazia); "Revogado", que ela perdeu o acesso. Na sua própria linha aparece "você": ninguém troca o próprio papel nem tira o próprio acesso.
4. **Trocar o papel de alguém**  
   Clique no papel de uma pessoa para trocá-lo. "Somente leitura" consulta sem atender. "Atendente" atende as conversas. "Gerente" também acompanha a equipe e ajusta o atendimento. "Administrador" pode tudo nesta empresa, inclusive convidar e tirar pessoas. A troca vale assim que você escolhe, sem botão de salvar. Atenção: quem passa para "Somente leitura" deixa de atender, e as conversas abertas que estavam com essa pessoa voltam para a Fila. O sistema não deixa rebaixar o último Administrador.
5. **Tirar o acesso de alguém**  
   No botão de três pontinhos da linha fica "Revogar acesso". Ao confirmar em "Revogar", a pessoa não entra mais nesta empresa, as conversas abertas que estavam com ela voltam para a Fila, sem dono, e ela sai da lista de responsáveis dos números de atendimento. A linha dela continua na lista, com o selo "Revogado". O sistema não deixa revogar o último Administrador. Aqui, só olhe: feche em "Cancelar". O aviso fala em "tenant": é o mesmo que esta empresa.
   > 💡 O aviso diz que só dá para desfazer convidando de novo, mas "Devolver acesso", no próximo passo, resolve sem convite.
6. **Devolver o acesso**  
   O Marcos saiu da clínica e teve o acesso revogado. Se ele voltar, não precisa de convite novo: nos três pontinhos da linha dele aparece "Devolver acesso". O clique já devolve, sem pedir confirmação, e ele volta a entrar com o mesmo papel que tinha antes. Se ele atendia algum número, coloque-o de novo como responsável em Configurações › Distribuição de atendimento: essa parte não volta sozinha.

<a id="l-equipe--convidar-pessoas"></a>

### Convidar alguém para a equipe

- **Objetivo:** Mandar convites, acompanhar se chegaram e reenviar, copiar ou cancelar um convite.
- **Papel mínimo:** Administrador
- **Busca no curso:** convidar; adicionar funcionário; novo usuário; convite não chegou; link de convite; cadastrar atendente

1. **O botão de convite** — `/app/team`  
   Para chamar alguém para trabalhar no sistema, clique em "Convidar membros", no alto da tela Equipe.
2. **Preencher o convite** — `/app/team/invite`  
   No campo "Emails", escreva um e-mail por linha. Escolha em "Papel" o acesso que as pessoas vão ter nesta empresa. Depois clique em "Enviar convites"; o resultado aparece logo abaixo do botão, com a situação de cada convite. Nesta foto os e-mails estão preenchidos, sem enviar.
   > 💡 Se o sistema não tiver um serviço de e-mail configurado, o convite é criado mesmo assim. Embaixo do e-mail aparece um aviso técnico ("Resend não configurado") e o link do convite: copie esse link e mande para a pessoa, por exemplo pelo WhatsApp.
3. **Acompanhar os convites** — `/app/team`  
   De volta à aba "Membros", abaixo da equipe fica a lista "Convites". Ela mostra o papel, o "Status" ("Pendente", "Expirado", "Aceito" ou "Revogado"), se o e-mail saiu, quando foi enviado, até quando vale e quem convidou. Quando aparece "Não saiu", o e-mail não foi entregue: use "Copiar link" e mande o link para a pessoa por WhatsApp. Se o convite estiver "Expirado", primeiro use "Reenviar" para renovar o prazo e só depois copie o link. Se o convite foi reenviado, a data mostra quantas vezes, como "(reenviado 1x)".
4. **Reenviar ou cancelar**  
   Nos três pontinhos de um convite em aberto ficam três opções. "Reenviar" renova o convite por mais 24 horas e tenta mandar o e-mail de novo; serve também para convite expirado. "Copiar link" copia o link do convite. "Revogar" cancela: a pessoa não consegue mais entrar com aquele link. O Gerente vê esta lista, mas só o Administrador mexe nela.

<a id="l-equipe--interface-de-cada-um"></a>

### Escolher o que cada pessoa vê no menu

- **Objetivo:** Deixar o menu de uma pessoa mais simples, sem mudar o que o papel dela permite.
- **Papel mínimo:** Administrador
- **Busca no curso:** menu simplificado; esconder telas; interface; personalizar menu; o que o funcionário vê

1. **A coluna Interface** — `/app/team`  
   A coluna "Interface" diz como está o menu de cada pessoa: "Completa", "Simplificada" ou "Personalizada". Clique no botão de uma pessoa para mudar. Aqui, vamos abrir o da Ana.
2. **Completa ou simplificada**  
   Em "Perfil de interface", "Completa" mostra todas as telas que o papel permite. "Simplificada" deixa só o dia a dia: Inbox, Agenda, Funis, Contatos, Tarefas e Conexões, além das configurações pessoais (Perfil, Segurança, Notificações e App no celular), que nunca somem. A interface muda só o menu: o que a pessoa pode fazer continua definido pelo papel.
3. **Escolher tela por tela**  
   Clique em "Personalizar áreas visíveis" para marcar e desmarcar telas uma a uma; ao desmarcar qualquer tela, o campo acima muda para "Personalizada". Ao clicar em "Salvar interface", o menu da pessoa muda na próxima vez que ela recarregar a página ou abrir o sistema, sem precisar sair da conta. A mudança vale só nesta empresa.

<a id="l-equipe--distribuir-conversas"></a>

### Como as conversas são distribuídas

- **Objetivo:** Escolher se as conversas novas esperam na fila ou vão sozinhas para alguém da equipe.
- **Papel mínimo:** Administrador
- **Busca no curso:** distribuir conversas; rodízio; roteamento; dividir atendimento; quem recebe a conversa; fila

1. **A aba Atendimento** — `/app/team?aba=atendimento`  
   Na aba "Atendimento", o quadro "Modo de roteamento" decide para quem vão as conversas novas na empresa toda. Se um número tiver regra própria em Configurações › Distribuição de atendimento, vale a regra do número (essa tela também mostra este mesmo modo, com outros nomes). Logo abaixo fica a lista de atendentes, com o plantão, a carga e o horário de cada um. Gerentes e Administradores mexem aqui; os outros papéis veem só um aviso.
2. **Os três modos** — `/app/team?aba=atendimento`  
   "Manual (atendente puxa da fila)": ninguém recebe sozinho; a conversa espera na Fila até alguém assumir. "Rodízio (distribui automático)": o sistema entrega uma conversa para cada atendente, na vez de cada um. "Menor carga (quem tem menos conversas na mão)": vai para quem está com menos conversas abertas. Nos dois automáticos, só recebe quem está de plantão, ainda tem espaço e não é "Somente leitura"; se o número tiver lista de responsáveis, só quem está nela.
3. **Quando ninguém está livre** — `/app/team?aba=atendimento`  
   Se não há ninguém disponível, o sistema espera alguns segundos e tenta de novo. É o campo "Backoff (s)", a espera entre tentativas, que começa em 60. Depois do número de "Tentativas máx." (5 de início), aparece em "Alertas" (o sino) o aviso "Uma conversa aguarda um responsável", e o sistema passa a tentar de 15 em 15 minutos. O botão "Salvar" acende quando você muda algo.

<a id="l-equipe--plantao-e-capacidade"></a>

### Plantão, carga e capacidade

- **Objetivo:** Ler quem está atendendo agora e definir quantas conversas cada pessoa aguenta ao mesmo tempo.
- **Papel mínimo:** Administrador
- **Busca no curso:** plantão; quem está online; capacidade; limite de conversas; disponível; atendente desligado

1. **Quem está de plantão** — `/app/team?aba=atendimento`  
   A coluna "Status" tem dois selos. O de cima diz se a pessoa recebe conversas agora: "De plantão" (chave ligada e dentro do horário, ou sem horário publicado), "Fora do horário" (chave ligada, mas fora do expediente dela) ou "Desligado" (chave desligada). O de baixo diz se ela está com o sistema aberto: "Com a tela aberta" ou "Sem sinal de tela", com a hora do último sinal.
2. **Carga e capacidade** — `/app/team?aba=atendimento`  
   "Carga" é quantas conversas abertas estão com a pessoa agora. "Capacidade" é quantas ela aguenta ao mesmo tempo. Quando a carga chega à capacidade, o número fica vermelho e a distribuição automática pula essa pessoa. Para mudar, digite o novo número e clique fora do campo: salva na hora.
3. **Ligar e desligar o plantão** — `/app/team?aba=atendimento`  
   A chave "Disponível" liga e desliga o plantão de cada pessoa, e vale na hora. Desligada, a pessoa não recebe conversas pela distribuição automática, mas continua podendo assumir conversas pela Inbox. Atenção: desligada, ela também não pode ser marcada nos tipos de agendamento configurados como serviço. O Carlos está com a chave desligada.

<a id="l-equipe--horario-de-atendimento"></a>

### Publicar o horário de atendimento

- **Objetivo:** Montar a semana de trabalho de um atendente, para a distribuição respeitar o expediente e a Agenda oferecer horários.
- **Papel mínimo:** Administrador
- **Busca no curso:** horário de atendimento; expediente; jornada; horários da agenda; não publicado; dias de trabalho

1. **A coluna Horário** — `/app/team?aba=atendimento`  
   A coluna "Horário" mostra a semana de trabalho de cada um. "Não publicado" quer dizer que a pessoa ainda não tem horário: se a chave dela estiver ligada, a distribuição manda conversa para ela a qualquer hora, mas a Agenda não oferece nenhum horário para marcar com ela. Para montar a semana do Carlos, clique no botão do relógio ("Editar") na linha dele.
2. **O editor de horário** — `/app/team?aba=atendimento`  
   O editor começa vazio e avisa: "Nenhuma janela publicada — ninguém consegue marcar com esta pessoa." Primeiro, confira o "Fuso horário". Depois, clique em "Adicionar janela". Cada janela é um dia com hora de início e de fim.
3. **Uma janela pronta** — `/app/team?aba=atendimento`  
   A janela nova nasce na segunda, das 08:00 às 18:00. Troque o dia e as horas se precisar; a lixeira apaga a janela. Para ter manhã e tarde com intervalo, use duas janelas no mesmo dia. Com a janela de segunda-feira pronta, clique em "Copiar estes horários para os outros dias úteis".
4. **A semana inteira** — `/app/team?aba=atendimento`  
   O botão copiou as faixas da segunda para terça, quarta, quinta e sexta. Nada foi gravado ainda: dá para ajustar um dia ou cancelar. Quando estiver certo, clique em "Salvar".
5. **Conferir o que foi gravado** — `/app/team?aba=atendimento`  
   Depois de salvar, o quadro "Publicado" mostra o que ficou gravado, juntando os dias iguais: aqui, "Seg–Sex 08:00–18:00". Confira antes de sair e clique em "Fechar". A partir de agora, a Agenda mostra esses horários livres do Carlos. Lembre que a chave "Disponível" dele está desligada: ligue-a para ele também receber conversas e poder ser marcado nos agendamentos configurados como serviço.

---

<a id="m-distribuicao-de-atendimento"></a>

## Distribuição de atendimento

**Tela:** `/app/settings/atendimento`  
**Resumo:** Onde você decide quem da equipe recebe cada cliente novo, o que cada atendente enxerga e quando a IA volta a responder.

**Lições:** [Conhecendo a tela](#l-distribuicao-de-atendimento--conhecendo-a-tela) · [Quem recebe o cliente novo](#l-distribuicao-de-atendimento--quem-recebe-o-cliente-novo) · [O que cada atendente enxerga](#l-distribuicao-de-atendimento--o-que-cada-atendente-enxerga) · [Quando a IA volta a responder](#l-distribuicao-de-atendimento--quando-a-ia-volta) · [Responsáveis por número](#l-distribuicao-de-atendimento--responsaveis-por-numero) · [Assinatura das mensagens e telefone do cliente](#l-distribuicao-de-atendimento--assinatura-e-telefone)

<a id="l-distribuicao-de-atendimento--conhecendo-a-tela"></a>

### Conhecendo a tela

- **Objetivo:** Achar a tela de Distribuição de atendimento e reconhecer as decisões que ficam nela.
- **Papel mínimo:** Administrador
- **Busca no curso:** distribuição de atendimento; quem recebe o cliente; dividir clientes entre atendentes; configurações; rodízio; fila de atendimento

1. **Onde fica a tela** — `/app/settings`  
   Clique em "Configurações", no rodapé do menu lateral. Na parte "Sua empresa" fica o cartão "Distribuição de atendimento". Clique nele para abrir a tela.
   > 💡 Só gerente e administrador abrem esta tela. Um atendente que tentar entrar recebe a página de acesso negado.
2. **As duas decisões principais**  
   No alto ficam as duas decisões que andam juntas. A primeira é quem recebe o cliente novo: alguém pega da fila ou o sistema entrega sozinho. A segunda é o que cada atendente enxerga: tudo, ou só a própria carteira. A opção marcada, com a borda colorida, é a que vale hoje. Numa instalação nova, ninguém recebe nada sozinho e o atendente vê os próprios clientes mais os que ainda não têm dono.
3. **Quando a IA volta a responder**  
   Descendo a tela, três quadros cuidam da passagem entre a IA e a equipe: se a IA volta sozinha quando a pessoa some, quanto tempo a IA espera quando alguém responde pelo celular, e se a conversa fica com quem respondeu. Logo abaixo deles fica o botão "Salvar", que grava tudo o que você mudou nesta parte de cima da tela.
4. **Regras de cada número**  
   Em "Responsáveis por número" aparece um quadro para cada número ou rede social cadastrada na empresa. Aqui só existe o "Recepção Bem Viver". Nele você escolhe quem atende aquele número e se ele segue uma regra própria. Este quadro tem os próprios botões de salvar.
5. **Assinatura e telefone do cliente**  
   No fim da tela ficam mais duas escolhas. A primeira diz se o nome de quem escreveu aparece na mensagem que chega ao cliente. A segunda diz se o telefone que o cliente informa na conversa entra sozinho na ficha dele. As duas têm uma lição só delas no fim deste módulo.

<a id="l-distribuicao-de-atendimento--quem-recebe-o-cliente-novo"></a>

### Quem recebe o cliente novo

- **Objetivo:** Escolher entre a fila aberta, o rodízio e a entrega para quem tem menos conversas.
- **Papel mínimo:** Administrador
- **Busca no curso:** rodízio de atendentes; distribuir clientes automaticamente; fila de atendimento; quem atende primeiro; dividir conversas; menos conversas

1. **Os três jeitos de distribuir** — `/app/settings/atendimento`  
   Esta escolha vale para a conversa que chega sem dono. Em "Cada um pega o que quiser", o cliente novo cai numa fila aberta e o primeiro atendente que clicar assume. É o jeito que vem marcado numa instalação nova. Nos outros dois, o sistema escolhe quem recebe, e ninguém precisa pegar da fila.
2. **Ligar o rodízio**  
   Clique em "Rodízio automático entre os atendentes". Cada cliente novo vai para quem está há mais tempo sem receber, só entre os atendentes disponíveis, dentro do horário e com espaço na capacidade. Ao marcar, aparecem dois campos. "Tentativas antes de desistir" diz quantas vezes o sistema tenta de novo quando não há ninguém disponível. "Espera entre tentativas (segundos)" diz o intervalo entre uma tentativa e outra. Quando as tentativas acabam, a conversa fica na fila, aparece um aviso em "Alertas" e o sistema continua tentando, mais devagar, a cada 15 minutos.
   > 💡 Ninguém começa disponível. Antes de ligar o rodízio, abra "Equipe", aba "Atendimento", e marque "Disponível" para quem vai receber clientes. Sem isso, ninguém recebe nada.
3. **Entregar para quem tem menos conversas**  
   A terceira opção, "Vai para quem tem menos conversas na mão", entrega cada cliente novo para quem está com menos conversas em aberto. Se duas pessoas empatam, recebe quem está há mais tempo sem receber, como no rodízio. É a melhor escolha para equipe grande, onde uma pessoa sobrecarregada e outra parada custam caro. Os dois campos de tentativas continuam valendo.
4. **Salvar a escolha**  
   Enquanto você não salva, aparece o aviso "Há mudanças não salvas." ao lado do botão. Clique em "Salvar" para gravar. Aparece a mensagem "Distribuição de atendimento salva." e a nova regra passa a valer para os próximos clientes que chegarem sem dono.
   > 💡 Se você sair da tela sem salvar, a mudança se perde.

<a id="l-distribuicao-de-atendimento--o-que-cada-atendente-enxerga"></a>

### O que cada atendente enxerga

- **Objetivo:** Decidir se o atendente vê os clientes de todo mundo ou só os dele, sem deixar a fila sem ninguém.
- **Papel mínimo:** Administrador
- **Busca no curso:** atendente vê só os clientes dele; esconder clientes de outro atendente; carteira de clientes; privacidade entre atendentes; quem vê o quê; visibilidade

1. **Três níveis de visão** — `/app/settings/atendimento`  
   Esta escolha vale só para quem tem o papel de Atendente. Gerente e administrador continuam vendo tudo. Em "Todos veem tudo", qualquer atendente abre a conversa e o negócio de qualquer colega. Em "Os seus, mais os que ainda não têm dono", que vem marcado numa instalação nova, ele vê os próprios clientes e a fila de quem acabou de chegar. Em "Só os seus", ele vê apenas o que foi entregue a ele, nem a fila.
2. **O aviso da combinação que trava tudo**  
   Clique em "Só os seus". Com a distribuição em "Cada um pega o que quiser", aparece um aviso logo abaixo das opções: nenhum atendente enxerga a fila para pegar o cliente, então ninguém é atendido. A tela avisa antes de você salvar.
3. **Combine com o rodízio**  
   Para usar "Só os seus", ligue uma distribuição automática. Suba até "Quem recebe o cliente novo" e clique em "Rodízio automático entre os atendentes": o sistema passa a entregar cada cliente novo a alguém, e o aviso some. "Só os seus" continua marcado mais abaixo. Depois, clique em "Salvar" no fim desta parte.

<a id="l-distribuicao-de-atendimento--quando-a-ia-volta"></a>

### Quando a IA volta a responder

- **Objetivo:** Ajustar quando a IA retoma uma conversa que estava com uma pessoa da equipe.
- **Papel mínimo:** Administrador
- **Busca no curso:** ia voltar a responder sozinha; devolver conversa para a ia; ia parou de responder; responder pelo celular; silêncio da ia; conversa fica com o atendente

1. **A IA volta sozinha?** — `/app/settings/atendimento`  
   Quando alguém assume uma conversa, a IA para de responder nela até a conversa ser devolvida. Se ninguém devolve, o cliente que escreve de novo fica sem resposta. Esta caixa vem desmarcada: a IA só volta quando alguém clica em "Devolver ao automático", no alto da conversa.
2. **Devolver depois de um tempo**  
   Marque a caixa "Devolver ao agente sozinho depois de um tempo sem resposta da equipe". Aparece o campo "Minutos sem resposta da equipe", que já vem com 60. O tempo conta a partir do último sinal de uma pessoa na conversa: assumir, responder pela tela ou pelo celular. Passado esse tempo, a IA volta a atender, mas só onde há um agente de IA publicado.
   > 💡 O prazo vai de 5 minutos a 24 horas (1440 minutos).
3. **Quando alguém responde pelo celular**  
   Se alguém da equipe responde o cliente direto pelo celular, fora do sistema, a IA fica calada naquela conversa por um tempo. Esse tempo é o deste campo, e o padrão é 60 minutos. Cada nova resposta pelo celular recomeça a contagem. Quem atende o dia inteiro pelo celular costuma preferir um prazo curto, como 15.
4. **A conversa fica com quem respondeu**  
   Marque "A conversa fica com quem atendeu". Assim, quem responde pela Inbox uma conversa sem dono passa a ser o dono dela, e a IA fica calada até alguém devolver. E quando o cliente volta a escrever numa conversa encerrada, ela vai direto para o último atendente, sem passar pela distribuição, se ele ainda faz parte da equipe. Clique em "Salvar" para gravar as mudanças.

<a id="l-distribuicao-de-atendimento--responsaveis-por-numero"></a>

### Responsáveis por número

- **Objetivo:** Escolher quem atende cada número de WhatsApp e dar a ele uma regra própria.
- **Papel mínimo:** Administrador
- **Busca no curso:** quem atende cada número; responsável pelo whatsapp; atendente de um número; dois números de whatsapp; regra por número; destino padrão

1. **O quadro do número** — `/app/settings/atendimento`  
   Cada número conectado tem um quadro com o nome dele. A frase no alto diz como ele está agora: "Usa todos os atendentes elegíveis da organização." Ou seja, enquanto você não escolher ninguém, qualquer atendente que esteja disponível pode receber os clientes deste número.
   > 💡 Sem número conectado, aparece só o link "Conecte um número para escolher os responsáveis.".
2. **Uma regra só para este número**  
   Em "Como este número distribui", escolha "Rodízio automático entre os atendentes". A regra vale só para este número; os outros seguem a da organização. Atenção: com uma regra própria, só recebem os clientes deste número as pessoas que você marcar logo abaixo. Com uma regra escolhida, a lista "Atendente de destino padrão" fica liberada: se você escolher uma pessoa nela, todo cliente novo deste número vai direto para ela, sem passar pela distribuição. Se ela estiver indisponível ou com a capacidade cheia, a conversa espera por ela e não vai para outra pessoa.
3. **Quem atende este número**  
   Marque quem pode receber os clientes deste número. Aqui, Ana Ribeiro e Carlos Mendes. A Helena fica de fora: a distribuição automática não entrega a ela os clientes deste número.
   > 💡 Cuidado: salvar sem marcar ninguém deixa as conversas deste número paradas na fila.
4. **Salvar os responsáveis**  
   Clique em "Salvar responsáveis". Logo abaixo aparece "Responsáveis salvos." e a frase do alto muda para "Somente as pessoas selecionadas recebem este número.". A partir de agora, a distribuição automática só entrega os clientes deste número para quem você marcou.
5. **Voltar ao padrão**  
   Para desfazer tudo, clique em "Voltar ao padrão da organização". O número perde a regra própria e a lista de responsáveis, e volta a usar todos os atendentes e a distribuição da organização. A frase do alto volta a ser "Usa todos os atendentes elegíveis da organização.". Logo abaixo aparece de novo "Responsáveis salvos.", confirmando a mudança.

<a id="l-distribuicao-de-atendimento--assinatura-e-telefone"></a>

### Assinatura das mensagens e telefone do cliente

- **Objetivo:** Mostrar ao cliente quem escreveu cada mensagem e decidir se o telefone que ele informa entra sozinho na ficha.
- **Papel mínimo:** Administrador
- **Busca no curso:** assinar mensagem com nome do atendente; nome do atendente na mensagem; nome da ia na mensagem; assinatura whatsapp; telefone na ficha do cliente; salvar telefone automático

1. **Quem fala aparece na mensagem?** — `/app/settings/atendimento`  
   Ligada, a assinatura põe em negrito, na primeira linha da mensagem que chega ao cliente, o nome de quem escreveu. "Assinar as mensagens dos atendentes" usa o nome de cada atendente. "Assinar as mensagens da IA" usa o "Nome da IA", que vem como "Assistente Virtual". Numa instalação nova, as duas vêm desligadas.
   > 💡 O histórico do sistema guarda o texto como foi escrito. Campanhas, lembretes e integrações não assinam.
2. **A IA assina com o nome de cada agente**  
   Marque "Assinar as mensagens da IA". Isso libera a última caixa, "Assinar com o nome de cada agente". Marcada, cada mensagem da IA leva o nome do agente que a escreveu, como está no cadastro dele; aqui seria "Bia — Recepção virtual". Depois, clique em "Salvar assinatura".
3. **Telefone que entra sozinho na ficha** — `/app/settings/atendimento`  
   Às vezes o cliente diz o telefone dele na conversa, e o agente de IA anota. Com esta opção desligada, que é como ela vem, o número vira uma sugestão na ficha e espera alguém da equipe confirmar. Se ninguém decidir em 7 dias, a sugestão é descartada.
   > 💡 Só um administrador da empresa pode mudar esta opção. Para um gerente, a chave aparece travada.
4. **Ligar a opção**  
   Clique na chave. Ela salva na hora, sem botão de salvar, e aparece por alguns segundos o aviso "Opção salva." no canto da tela. A frase abaixo passa a começar com "Ligado:". Ligada, quando a ficha do cliente está sem telefone e o agente de IA anota o número que ele disse, o número é gravado na hora. Se o cliente tem um negócio aberto, isso fica registrado no histórico dele. Um número que já está na ficha nunca é trocado sozinho: isso continua exigindo uma pessoa.

---

<a id="m-automacoes"></a>

## Automações

**Tela:** `/app/settings/automacoes`  
**Resumo:** Um interruptor só, que decide se a IA pode escolher o caminho dentro das suas automações, para a empresa inteira.

**Lições:** [Conhecendo a tela de Automações](#l-automacoes--conhecendo-a-tela) · [Onde a IA decide numa automação](#l-automacoes--onde-a-ia-decide) · [Desligar a IA das automações e conferir](#l-automacoes--desligar-e-conferir)

<a id="l-automacoes--conhecendo-a-tela"></a>

### Conhecendo a tela de Automações

- **Objetivo:** Achar a tela de Automações e entender o que o interruptor dela controla.
- **Papel mínimo:** Administrador
- **Busca no curso:** automações; configurar automação; IA decide; desligar IA das regras; interruptor da IA; freio da IA

1. **Onde fica** — `/app/settings`  
   Clique em "Configurações", no rodapé do menu lateral, para abrir a lista de todas as configurações. "Automações" fica no grupo "Sua empresa". Só quem é gerente ou administrador vê e abre esta tela.
2. **Uma tela, um interruptor**  
   Esta tela tem uma chave só. Ela vale para um passo específico das suas automações, o "A IA decide": nele, a IA lê a situação e escolhe uma entre as opções que quem montou a regra deixou prontas. Esse passo só funciona se a IA estiver configurada na sua instalação. A chave vale para todas as regras da empresa de uma vez.
3. **Ligado é o padrão**  
   A chave vem ligada: as regras que têm o passo "A IA decide" deixam a IA escolher. Ela vem assim para não quebrar regras que já existem. O texto embaixo do nome da chave resume o que acontece se você desligar. Ali, "modelo" quer dizer a IA, e a chave vale só para o passo "A IA decide": a ação "Mensagem escrita pela IA" continua funcionando. Como desligar está na última lição.

<a id="l-automacoes--onde-a-ia-decide"></a>

### Onde a IA decide numa automação

- **Objetivo:** Reconhecer, numa automação, o passo que o interruptor controla.
- **Papel mínimo:** Administrador
- **Busca no curso:** onde a IA escolhe; passo A IA decide; automação com IA; ver regra no designer; opções da IA

1. **Uma regra com esse passo** — `/app/webhooks?aba=automacoes`  
   As automações ficam no menu "Webhooks", aba "Automações". Esta regra, "Separar o novo paciente por especialidade", tem um passo em que a IA decide. Para ver os passos dela, clique em "Abrir no designer", o primeiro dos três ícones no canto de baixo, à direita, do cartão.
2. **A caixa "A IA decide"**  
   No designer, cada caixa é um passo da regra. A caixa "A IA decide" lista as opções da IA: Nutrição, Fisioterapia ou Odontologia, cada uma pondo uma etiqueta no paciente. A caixa logo acima dela, "Adicionar tag", não usa IA e roda sempre. A frase "Hoje este passo só se edita pela API" quer dizer que ele foi criado por uma integração técnica: pela tela dá para ver o passo, mas não dá para criar nem mudar. Na lista da esquerda há também "Mensagem pela IA": é outro tipo de passo, e a chave de Automações não mexe nele.
3. **O que a IA lê**  
   Clique na caixa para abrir o painel ao lado. Ele mostra a "Instrução para a IA", o texto que ela segue para escolher, e as "Opções". Com o interruptor de Automações desligado, é este passo que deixa de rodar, em todas as regras da empresa.

<a id="l-automacoes--desligar-e-conferir"></a>

### Desligar a IA das automações e conferir

- **Objetivo:** Desligar o passo "A IA decide" para a empresa inteira, ver onde isso aparece e ligar de novo.
- **Papel mínimo:** Administrador
- **Busca no curso:** desligar A IA decide; IA parar de escolher nas regras; IA decide pulado; por que a automação não rodou; ligar IA decide de novo

1. **Desligar** — `/app/settings/automacoes`  
   Para tirar a IA das escolhas "A IA decide" de todas as suas automações, clique na chave. Não há botão de salvar: a mudança vale no clique.
2. **Desligado**  
   A chave fica desligada e a mudança já está salva. A partir de agora, o passo "A IA decide" é pulado em todas as regras e nada daquele passo acontece. Os outros passos das regras continuam rodando igual, inclusive a "Mensagem escrita pela IA", que esta chave não desliga.
3. **Onde aparece o passo pulado** — `/app/webhooks?aba=atividade`  
   Em "Webhooks", aba "Atividade", cada cartão é uma vez que uma regra rodou. Neste exemplo, de 3 horas atrás, a empresa estava com a chave desligada: a etiqueta entrou, mas o passo da IA, que aparece com o nome técnico "ai_decide", foi pulado. Por isso o cartão diz "Parcial", e a frase embaixo explica o motivo.
4. **Ligar de novo** — `/app/settings/automacoes`  
   Para devolver as escolhas à IA, volte a Configurações, Automações, e clique na chave outra vez. Ligada, a IA volta a decidir nas próximas vezes que as regras rodarem. O que foi pulado enquanto ela estava desligada não é refeito.

---

<a id="m-tags"></a>

## Tags

**Tela:** `/app/settings/tags`  
**Resumo:** Onde você arruma as etiquetas da empresa: vê onde cada uma é usada, dá cor, corrige o nome, junta as repetidas e tira as que não servem mais.

**Lições:** [Conhecendo a tela de Tags](#l-tags--conhecendo-a-tela) · [Dar cor a uma etiqueta](#l-tags--dar-cor) · [Corrigir o nome de uma etiqueta](#l-tags--renomear) · [Juntar etiquetas repetidas](#l-tags--juntar-repetidas) · [Excluir uma etiqueta](#l-tags--excluir) · [Etiquetas de contato interno](#l-tags--contato-interno)

<a id="l-tags--conhecendo-a-tela"></a>

### Conhecendo a tela de Tags

- **Objetivo:** Achar a tela de Tags e entender o que cada número da lista diz sobre uma etiqueta.
- **Papel mínimo:** Administrador
- **Busca no curso:** tags; etiquetas; onde ficam as etiquetas; lista de etiquetas; quantos clientes têm a etiqueta; marcadores dos clientes; organizar etiquetas

1. **Onde fica** — `/app/settings`  
   Clique em "Configurações", no rodapé do menu lateral, para abrir a lista de todas as configurações. "Tags" fica no grupo "Sua empresa". Clique no cartão para abrir a tela.
   > 💡 Só gerente e administrador abrem esta tela. Um atendente que tentar entrar recebe a página de acesso negado.
2. **Todas as etiquetas num lugar só** — `/app/settings/tags`  
   Etiquetas são as marcas que ficam nos clientes, nos negócios do funil e nas conversas, como "convenio" ou "particular". Esta tela reúne todas as da empresa, em ordem alfabética: as que a equipe coloca à mão, as que as regras automáticas colocam e as que você cadastrou. Cada linha é uma etiqueta. Acima da lista aparece quantas existem e em que página você está; cada página mostra até 100.
3. **Onde cada etiqueta está**  
   Os números de cada linha dizem onde a etiqueta aparece. "Contatos" conta os clientes que têm a etiqueta, "Leads" conta os negócios do funil e "Conversas" conta as conversas da Inbox. Aqui, "convenio" está em 3 clientes e em nenhum negócio ou conversa.
4. **A coluna que evita surpresa**  
   "Regras de agente" conta quantas regras automáticas da empresa têm a ação de colocar essa etiqueta, ligadas ou desligadas. Aqui, "aguardando-exame" tem 1. Enquanto uma regra dessas estiver ligada, ela coloca a etiqueta de novo toda vez que rodar, mesmo que você tenha tirado de todo mundo. Olhe esta coluna antes de mexer numa etiqueta.
5. **Cor, selo e botões**  
   As etiquetas coloridas, como "convenio", já foram cadastradas com uma cor. O selo "em uso, fora do vocabulário", como em "Fisio", marca as que estão em uso (em clientes, negócios, conversas ou numa regra) mas nunca foram cadastradas: alguém ou alguma regra escreveu, e pronto. No fim de cada linha ficam os botões "Cor", "Renomear", "Juntar" e "Excluir". Cada um abre um quadro logo abaixo da lista, e as próximas lições mostram um por um.

<a id="l-tags--dar-cor"></a>

### Dar cor a uma etiqueta

- **Objetivo:** Escolher a cor de uma etiqueta para achá-la de longe nas listas e nos filtros.
- **Papel mínimo:** Administrador
- **Busca no curso:** cor da etiqueta; mudar cor da tag; pintar etiqueta; etiqueta colorida; destacar etiqueta; etiqueta cinza

1. **Uma etiqueta sem cor** — `/app/settings/tags`  
   A etiqueta "pos-operatorio" está cinza e com o selo "em uso, fora do vocabulário". Uma cor ajuda a equipe a achar esses pacientes de longe. Clique em "Cor" na linha dela.
2. **Oito cores para escolher**  
   Abaixo da lista abre o quadro da cor. São oito bolinhas de cor fixas, escolhidas para serem fáceis de distinguir e de ler. Na ordem: amarelo, âmbar, vermelho, verde-água, azul, índigo, roxo e cinza. Quem usa leitor de tela ouve o nome de cada uma. "Sem cor" tira a cor da etiqueta.
3. **Veja antes de salvar**  
   Clique numa bolinha, como a vermelha (a terceira). A "Prévia" mostra na hora como a etiqueta vai ficar, antes de salvar. Gostou? Clique em "Confirmar".
4. **Pronto, colorida**  
   A etiqueta ficou vermelha e o selo "em uso, fora do vocabulário" sumiu: dar cor também cadastra a etiqueta. A nova cor aparece onde a etiqueta aparece, como nas listas de conversas e de clientes e nos filtros.

<a id="l-tags--renomear"></a>

### Corrigir o nome de uma etiqueta

- **Objetivo:** Renomear uma etiqueta em todos os clientes e nas regras automáticas de uma vez só.
- **Papel mínimo:** Administrador
- **Busca no curso:** renomear etiqueta; mudar nome da tag; corrigir nome da etiqueta; etiqueta escrita errada; trocar nome da etiqueta

1. **Um nome feio de ler** — `/app/settings/tags`  
   A etiqueta "aguardando-exame" foi escrita com hífen e está em 2 clientes. Ela também tem 1 regra automática que a coloca sozinha. Para escrever do jeito certo, clique em "Renomear" na linha dela.
2. **Digite o novo nome**  
   No quadro que abre abaixo da lista, escreva o nome novo no campo "Novo nome", aqui "Aguardando exame". Depois clique em "Confirmar".
   > 💡 Se o nome digitado já for de outra etiqueta, a tela avisa antes: confirmar vai juntar as duas numa só.
3. **Trocado em todo lugar**  
   A linha agora se chama "Aguardando exame" e continua com os 2 clientes. A troca vale para todos os clientes, negócios e conversas que tinham a etiqueta. E a regra automática também passou a escrever o nome novo, então o nome antigo não volta.

<a id="l-tags--juntar-repetidas"></a>

### Juntar etiquetas repetidas

- **Objetivo:** Achar duas etiquetas que querem dizer a mesma coisa e transformar as duas numa só.
- **Papel mínimo:** Administrador
- **Busca no curso:** etiquetas repetidas; juntar etiquetas; tag duplicada; duas etiquetas iguais; unir tags; mesclar etiquetas

1. **Procure por um pedaço do nome** — `/app/settings/tags`  
   Etiqueta repetida acontece: cada pessoa escreve de um jeito. Para achar as parecidas, digite um pedaço do nome no campo "Buscar etiquetas", aqui "fisio", e clique em "Buscar".
2. **Duas grafias, uma ideia** — `/app/settings/tags?page=1&busca=fisio`  
   A busca achou "Fisio" e "fisioterapia". As duas querem dizer a mesma coisa, mas para o sistema são etiquetas diferentes: um filtro por "fisioterapia" deixa de fora quem foi marcado com "Fisio". Fique com a mais clara, "fisioterapia", e clique em "Juntar" na linha de "Fisio".
3. **Diga qual etiqueta fica** — `/app/settings/tags?page=1&busca=fisio`  
   No quadro que abre, escreva em "Etiqueta de destino" o nome exato da etiqueta que fica, "fisioterapia". Juntar só aceita uma etiqueta que já existe: se o nome não existir, a tela avisa e não deixa confirmar. Depois clique em "Confirmar".
4. **Agora é uma só** — `/app/settings/tags?page=1&busca=fisio`  
   "Fisio" sumiu da lista. Os 2 clientes que tinham "Fisio" passaram a ter "fisioterapia", que agora está em 4 clientes e manteve a cor roxa. Se alguma regra automática escrevesse "Fisio", ela também passaria a escrever "fisioterapia".

<a id="l-tags--excluir"></a>

### Excluir uma etiqueta

- **Objetivo:** Tirar de todos os clientes uma etiqueta que não serve mais, sem ser pego de surpresa por uma regra automática.
- **Papel mínimo:** Administrador
- **Busca no curso:** excluir etiqueta; apagar tag; remover etiqueta de todos; etiqueta que não uso mais; tirar etiqueta

1. **Uma campanha que acabou** — `/app/settings/tags`  
   A etiqueta "promo-julho" marcou quem veio por uma promoção que já terminou. Ela está em 2 clientes e nenhuma regra a coloca (a coluna "Regras de agente" mostra 0). Para tirá-la de todo mundo, use "Excluir" na linha dela.
2. **Confira o que sai**  
   O quadro diz exatamente de onde a etiqueta vai sair: 2 clientes, nenhum negócio e nenhuma conversa. Excluir não tem volta, por isso o botão "Confirmar" fica vermelho. Os clientes continuam lá: só a etiqueta sai deles.
3. **Saiu da lista**  
   Depois de confirmar, "promo-julho" some da lista: a contagem no alto passa de 13 para 12 etiquetas.
4. **Quando uma regra ainda escreve**  
   Agora veja "Excluir" na "aguardando-exame". O quadro mostra um aviso amarelo: 1 regra automática ainda tem a ação de colocar essa etiqueta. Excluir aqui não apaga a regra: se ela estiver ligada, vai colocar a etiqueta de volta da próxima vez que rodar. Nesse caso, clique em "Cancelar" e mude a regra primeiro, em "Webhooks", na aba "Automações".

<a id="l-tags--contato-interno"></a>

### Etiquetas de contato interno

- **Objetivo:** Marcar etiquetas de quem não é cliente (equipe, família, fornecedor) para não virar negócio no funil nem receber resposta da IA.
- **Papel mínimo:** Administrador
- **Busca no curso:** contato interno; fornecedor no funil; equipe no whatsapp; IA não responder família; não virar card; contato que não é cliente

1. **Quem não é cliente** — `/app/settings/tags`  
   No mesmo WhatsApp também escrevem pessoas que não são clientes: equipe, sócio, família, fornecedor. No fim da tela fica o quadro "Etiquetas de contato interno". O contato marcado com uma dessas etiquetas não vira negócio no funil e não recebe resposta da IA. A conversa continua normal na Inbox, e você pode responder à mão. Numa instalação nova o campo vem vazio: "interno", "equipe" e "familia" em cinza são só um exemplo.
2. **Uma etiqueta por linha**  
   Escreva no campo as etiquetas que marcam quem não é cliente, uma por linha. Aqui a clínica usa "fornecedor", que já está na "Distribuidora Vida Natural", e "equipe". Depois clique em "Salvar".
   > 💡 Deixe o campo em branco para nenhum contato ser tratado como interno.
3. **Lista salva**  
   Depois de salvar, a lista volta arrumada: tudo em letras minúsculas e sem repetição, por isso "Fornecedor" virou "fornecedor". Maiúsculas não fazem diferença na hora de reconhecer a etiqueta no contato.

---

<a id="m-recursos-opcionais"></a>

## Recursos opcionais

**Tela:** `/app/settings/recursos`  
**Resumo:** Uma lista única de tudo o que se liga e desliga no sistema: o que cada recurso faz, quem decide, se está ligado e o botão que leva até a tela onde ele se ajusta.

**Lições:** [Conhecendo os Recursos opcionais](#l-recursos-opcionais--conhecendo-a-tela) · [Ler o estado de cada recurso](#l-recursos-opcionais--ler-o-estado) · [Módulos da instalação](#l-recursos-opcionais--modulos-da-instalacao) · [O que o gerente vê](#l-recursos-opcionais--o-que-o-gerente-ve)

<a id="l-recursos-opcionais--conhecendo-a-tela"></a>

### Conhecendo os Recursos opcionais

- **Objetivo:** Achar a tela, entender que ela só mostra e ler as partes de cada linha da lista.
- **Papel mínimo:** Administrador
- **Busca no curso:** recursos opcionais; onde ligar e desligar; o que está ligado; funções extras do sistema; ativar recurso; lista de configurações

1. **Onde fica a tela** — `/app/settings`  
   Abra "Configurações", no rodapé do menu lateral. Na parte "Sua empresa" está o cartão "Recursos opcionais". Clique nele.
   > 💡 Só gerente ou administrador vê este cartão. Um atendente que abrir o endereço direto cai numa página de acesso negado.
2. **Uma tela que só mostra**  
   Aqui estão juntos os recursos que a sua empresa pode ligar e desligar, que antes ficavam espalhados por várias telas. Os que só quem administra o servidor configura, como o e-mail, não entram nesta lista. Esta tela não liga nada: ela mostra o estado de cada recurso e leva você até a tela dele pelo botão "Ajustar". É lá que a mudança é feita.
3. **As partes de uma linha**  
   Cada recurso é uma linha. Em cima vem o nome e, logo abaixo, o que ele faz. A linha pequena diz quem pode mudar (aqui, "Gerente ou administrador") e como o recurso vem de fábrica ("Padrão: desligado"). À direita, o selo mostra como ele está agora na sua empresa, e o botão "Ajustar" abre a tela onde ele se liga.
4. **Onde o recurso se liga de verdade**  
   O "Ajustar" de "A conversa fica com quem atendeu" abre a tela "Distribuição de atendimento". Desça até a opção: para ligar, marque a caixa e clique em "Salvar", logo abaixo dela. O botão "Salvar" fica apagado até você marcar a caixa. Depois, a tela de Recursos opcionais passa a mostrar o selo "Ligado" nessa linha.

<a id="l-recursos-opcionais--ler-o-estado"></a>

### Ler o estado de cada recurso

- **Objetivo:** Entender o que quer dizer cada selo: Ligado, Desligado, Varia em cada item e Veja na tela dele.
- **Papel mínimo:** Administrador
- **Busca no curso:** o que significa ligado desligado; varia em cada item; veja na tela dele; recurso está ligado; como saber se está ativado

1. **Ligado e Desligado** — `/app/settings/recursos`  
   Na parte "Da sua empresa", o selo mostra o estado de cada recurso na sua empresa. "Atendentes podem mexer na agenda dos colegas" vem ligado de fábrica e continua "Ligado". "Quem tem horário marcado vira cliente" vem desligado e continua "Desligado". Para mudar qualquer um dos dois, use o "Ajustar" da linha.
2. **Varia em cada item e Veja na tela dele**  
   Alguns recursos não têm um estado só para a empresa toda. "Avisar a equipe quando o negócio entra na etapa" se liga em cada etapa do funil, por isso o selo diz "Varia em cada item". Já "Reportar vendas à Meta" mostra "Veja na tela dele": esta lista não consegue ler o estado dele, e só a tela do recurso sabe se está ligado.
   > 💡 Se aparecer "Não consegui ler agora", o sistema não conseguiu consultar o estado naquele momento. Não quer dizer que o recurso está desligado: recarregue a página.
3. **Os recursos de cada agente**  
   A última parte, "Em cada agente", reúne o que se ajusta agente por agente de IA. Como cada agente pode estar de um jeito, o selo diz "Varia em cada item". "Roteiro que não recomeça" mostra "Desligado por quem administra o servidor": ele depende do módulo "Fluxos de atendimento", que o servidor não ligou, e por isso não tem botão "Ajustar".

<a id="l-recursos-opcionais--modulos-da-instalacao"></a>

### Módulos da instalação

- **Objetivo:** Saber quais módulos o servidor liberou para a sua empresa e como chegar a um módulo disponível.
- **Papel mínimo:** Administrador
- **Busca no curso:** módulo desligado; liberar módulo no servidor; desligado por quem administra o servidor; propostas não aparece; módulos disponíveis

1. **Módulos que o servidor decide** — `/app/settings/recursos`  
   A primeira parte lista os módulos maiores do sistema, como "Banco de dados externo" e "Fluxos de atendimento". Quem decide se eles existem na sua instalação é quem administra o servidor, não a empresa. Desligado, o selo diz "Desligado por quem administra o servidor" e não há botão: para usar, peça a essa pessoa.
2. **Um módulo disponível**  
   Nesta instalação, quem administra o servidor liberou "Propostas comerciais". O selo diz "Disponível nesta instalação" e aparece o botão "Ajustar", que leva à tela onde a empresa usa o módulo.
3. **A chave da empresa**  
   O botão abre "Configurações › Propostas". O servidor ter liberado não basta: a empresa ainda precisa ligar as propostas para si, nesta primeira chave (a de cima, ainda desligada), e clicar em "Salvar". A chave verde mais abaixo é outra coisa: só avisa a equipe no WhatsApp quando a IA rascunha uma proposta. O módulo "Propostas" deste curso ensina o resto.
4. **As duas chaves na lista** — `/app/settings/recursos`  
   De volta aos Recursos opcionais, a linha "Proposta comercial da empresa", na parte "Da sua empresa", mostra a chave da empresa: ela segue "Desligado" até alguém ligar e salvar. As propostas só funcionam com as duas ligadas, a do servidor e a da empresa. Se o servidor desligar o módulo, esta linha passa a dizer "Desligado por quem administra o servidor".

<a id="l-recursos-opcionais--o-que-o-gerente-ve"></a>

### O que o gerente vê

- **Objetivo:** Saber o que muda na tela para quem é gerente: a lista é a mesma, mas o botão Ajustar só aparece onde ele pode mexer.
- **Papel mínimo:** Gerente
- **Busca no curso:** gerente não vê ajustar; permissão do gerente; sem botão ajustar; quem pode mudar recurso

1. **O gerente também acha a tela** — `/app/settings`  
   Entrando como gerente (aqui, o Carlos Mendes), o cartão "Recursos opcionais" também aparece em "Configurações", na parte "Sua empresa". Atendentes não veem este cartão.
2. **Ajustar só onde ele decide**  
   O gerente vê a lista inteira, mas o "Ajustar" só aparece onde ele pode mudar. "Avisar a equipe quando o negócio entra na etapa" é de "Gerente ou administrador" e tem o botão. "Reportar vendas à Meta" é do "Administrador da empresa" e fica sem botão: para mudar, peça a um administrador.
3. **Módulos para o gerente** — `/app/settings/recursos`  
   Nos módulos vale a mesma regra. "Propostas comerciais" tem "Ajustar" para o gerente, porque a tela de Propostas aceita gerente. Os módulos desligados no servidor ficam sem botão para todo mundo.

---

<a id="m-organizacao"></a>

## Organização

**Tela:** `/app/settings/tenant`  
**Resumo:** Onde você cadastra os dados da sua empresa, decide por quanto tempo guardar fotos e áudios das conversas, ajusta o menu da equipe e, se precisar, apaga os dados de teste para recomeçar.

**Lições:** [Conhecendo a tela Organização](#l-organizacao--conhecendo-a-tela) · [Preencher os dados da empresa](#l-organizacao--dados-da-empresa) · [Por quanto tempo guardar fotos e áudios](#l-organizacao--retencao-de-midia) · [O menu da empresa e a regra da Inbox](#l-organizacao--menu-e-regras-da-inbox) · [Apagar os dados de teste](#l-organizacao--zona-de-perigo)

<a id="l-organizacao--conhecendo-a-tela"></a>

### Conhecendo a tela Organização

- **Objetivo:** Achar a tela Organização e reconhecer os quadros que ela reúne.
- **Papel mínimo:** Administrador
- **Busca no curso:** dados da empresa; configurações da empresa; onde mudo o nome da empresa; cadastro da clínica; organização; razão social e cnpj

1. **Onde fica a tela** — `/app/settings`  
   Abra "Configurações", no rodapé do menu lateral. Na parte "Sua empresa" está o cartão "Organização". Clique nele.
   > 💡 Só quem é administrador da empresa abre esta tela. Gerente e atendente que digitarem o endereço caem numa página de acesso negado.
2. **O cadastro da empresa**  
   O primeiro quadro guarda o cadastro da sua empresa: o nome que a equipe vê, a razão social, o CNPJ, o fuso horário, o idioma, a moeda e o país, o e-mail do encarregado de dados, o endereço da sua política de privacidade e por quanto tempo guardar as fotos e os áudios das conversas. Nada muda enquanto você não clicar em "Salvar", no fim do quadro.
3. **Os outros quadros**  
   Rolando a tela aparecem mais três quadros. "Menu lateral" escolhe quais áreas a empresa mostra no menu. "Inbox" guarda uma regra de atendimento que vale para todos. "Zona de perigo" apaga os dados de teste. O cadastro, o menu e a regra da Inbox têm cada um o seu botão de gravar: salvar um não salva os outros.

<a id="l-organizacao--dados-da-empresa"></a>

### Preencher os dados da empresa

- **Objetivo:** Conferir o nome, a razão social e o CNPJ, cadastrar o encarregado de dados e salvar.
- **Papel mínimo:** Administrador
- **Busca no curso:** mudar nome da empresa; cadastrar cnpj; razão social; encarregado de dados lgpd; email do dpo; política de privacidade da clínica; fuso horário da empresa

1. **Nome, razão social e CNPJ** — `/app/settings/tenant`  
   "Nome de exibição" é como a empresa aparece para a equipe dentro do sistema. "Razão social" e "CNPJ" são os dados oficiais: é a razão social que aparece no relatório que o cliente recebe quando pede uma cópia dos dados dele.
   > 💡 Escreva o CNPJ sempre do mesmo jeito, com pontos, barra e traço. Se outra empresa desta instalação já tem esse CNPJ cadastrado, o sistema não grava e avisa "Este CNPJ já pertence a outra organização.".
2. **Fuso, idioma, moeda e país**  
   "Fuso horário" e "Idioma" são os padrões da empresa. "Moeda" vale para todo preço do catálogo, mas um produto já cadastrado continua com a moeda com que foi criado. "País" decide qual documento o contato usa e qual lei aparece no relatório de dados do cliente. Trocar o país já sugere o fuso dele no campo "Fuso horário".
   > 💡 A lista de países é curta de propósito: só entram países cuja lei de proteção de dados já foi revisada.
3. **O encarregado de dados e a política de privacidade**  
   "DPO email" é o e-mail do encarregado de dados, a pessoa que responde quando um cliente pergunta o que a empresa guarda sobre ele. Esse e-mail sai no relatório de dados que o cliente recebe. Em "URL política de privacidade", cole o endereço completo da página de privacidade da sua empresa, começando com https://. Quem da sua equipe abrir a página de privacidade do sistema passa a ser levado para a sua.
   > 💡 Deixando o e-mail em branco, o sistema usa o encarregado cadastrado para a instalação inteira, se houver.
4. **Salvar**  
   Clique em "Salvar", no canto do quadro. O botão mostra "Salvando…" enquanto grava. A confirmação "Organização atualizada." aparece por alguns segundos e não está na foto; o próximo passo reabre a tela para conferir o que ficou salvo. Se um campo estiver mal preenchido, como um e-mail sem @, o próprio navegador aponta o campo e não deixa salvar até você corrigir.
5. **Conferindo o que ficou gravado** — `/app/settings/tenant`  
   Ao abrir a tela de novo, os campos mostram o que ficou gravado: o e-mail do encarregado e o endereço da política de privacidade agora fazem parte do cadastro da empresa.

<a id="l-organizacao--retencao-de-midia"></a>

### Por quanto tempo guardar fotos e áudios

- **Objetivo:** Entender a retenção de mídia e a limpeza automática das fotos, áudios e anexos antigos.
- **Papel mínimo:** Administrador
- **Busca no curso:** apagar fotos antigas; guardar áudios do whatsapp; retenção de mídia; espaço de armazenamento cheio; limpeza automática; por quanto tempo guarda os arquivos

1. **A retenção de mídia** — `/app/settings/tenant`  
   "Retenção de mídia (dias)" é por quanto tempo o sistema guarda as fotos, áudios e documentos que chegam pelas conversas. O padrão é 365 dias. O valor aceito vai de 30 a 3650 dias (dez anos).
2. **Trocar o prazo**  
   Digite um prazo novo, por exemplo 180. A frase abaixo da chave "Limpeza automática de mídia antiga" já mostra o resultado: com ela ligada, a mídia das conversas e os anexos das notas internas com mais de 180 dias passam a ser apagados. Só vale depois de clicar em "Salvar".
   > 💡 O texto das mensagens não é apagado: a limpeza tira só os arquivos (fotos, áudios, documentos) e, junto com o áudio, a transcrição dele. No lugar do arquivo, a conversa mostra um aviso de que a mídia expirou.
3. **Ligar e desligar a limpeza**  
   Clique na chave para desligar a limpeza: a frase muda para "Desligado", e nenhum arquivo é apagado por idade. Ao ligar de novo, o navegador pede uma confirmação, porque a partir daí os arquivos mais antigos que o prazo começam a ser apagados. Como sempre nesta tela, a mudança só vale depois de "Salvar".

<a id="l-organizacao--menu-e-regras-da-inbox"></a>

### O menu da empresa e a regra da Inbox

- **Objetivo:** Escolher quais áreas aparecem no menu para toda a empresa e conhecer o bloqueio da caixa de mensagem até assumir.
- **Papel mínimo:** Administrador
- **Busca no curso:** esconder itens do menu; menu simplificado para a equipe; deixar o menu mais simples; atendente só responde depois de assumir; bloquear resposta sem assumir; personalizar menu lateral

1. **O quadro Menu lateral** — `/app/settings/tenant`  
   Aqui você escolhe as áreas que a empresa mostra no menu lateral. Isso não muda o que cada pessoa pode fazer: quem tem permissão ainda chega a uma área escondida por um link ou um aviso. Depois, em "Equipe", você ainda pode deixar o menu de uma pessoa com menos áreas, mas nunca com mais do que a empresa escolheu aqui.
2. **Completa ou Simplificada**  
   Em "Perfil de interface", "Completa" mostra todas as áreas que o papel de cada pessoa permite. "Simplificada" deixa no menu só o dia a dia: Inbox, Agenda, Funis, Contatos e Tarefas, e Conexões para quem administra. Perfil, Segurança, Notificações e App no celular ficam sempre lá, e, para quem administra, também Equipe e Organização. Trocar de perfil desfaz a escolha feita área por área.
3. **Escolher área por área**  
   Clique em "Personalizar áreas visíveis" para marcar e desmarcar cada área, separadas por grupo. A lista rola: descendo dentro dela aparecem as outras áreas, como Contatos, Tarefas e Conexões. Ao mexer numa caixa, o título ganha "(personalizada)". Para valer, clique em "Aplicar interface" (até lá, o menu da esquerda continua igual): aparece o aviso "Menu lateral da empresa salvo.".
   > 💡 Se você desmarcar tudo, aparece o aviso "Selecione ao menos uma área de trabalho permitida ao papel.".
4. **Bloquear a caixa até assumir**  
   No quadro "Inbox", marque "Bloquear a caixa de mensagem até o atendente assumir a conversa" e clique em "Aplicar regras de atendimento". A partir daí, só o responsável pela conversa consegue digitar. Quem abre uma conversa sem responsável, ou que está com um colega, não consegue digitar nem enviar até clicar em "Assumir". Quem já assumiu continua respondendo normalmente.
   > 💡 A regra vale para a empresa inteira e não muda o que cada papel pode fazer: só pede que a pessoa assuma antes de escrever.

<a id="l-organizacao--zona-de-perigo"></a>

### Apagar os dados de teste

- **Objetivo:** Saber o que a Zona de perigo apaga, o que ela mantém e como a confirmação protege contra um clique sem querer.
- **Papel mínimo:** Administrador
- **Busca no curso:** apagar tudo e começar de novo; limpar dados de teste; zerar conversas e contatos; zona de perigo; excluir todos os contatos; recomeçar do zero

1. **O que a Zona de perigo faz** — `/app/settings/tenant`  
   No fim da tela fica a "Zona de perigo". Ela apaga de vez as mensagens, conversas, negócios, propostas, contatos, agendamentos e pedidos da empresa, com tudo o que estava ligado a eles, como notas e histórico. Serve para limpar os testes antes de começar a atender de verdade. Continuam de pé a equipe, as configurações, os funis e etapas, os agentes de IA e os números de WhatsApp conectados.
2. **A confirmação**  
   O botão "Apagar todos os dados de atendimento" não apaga nada sozinho: ele abre uma janela avisando que a ação é irreversível. Enquanto o nome da empresa, como aparece em negrito na janela, não for digitado igualzinho, com as mesmas maiúsculas e acentos, o botão "Apagar de vez" fica desativado.
3. **Nome digitado: botão liberado**  
   Com "Clínica Bem Viver" digitado, o botão "Apagar de vez" fica liberado. Ao clicar nele, tudo é apagado e aparece um aviso com quantas mensagens, conversas, negócios e contatos saíram. Não dá para desfazer. Se mudou de ideia, clique em "Cancelar" e nada acontece.
   > 💡 Faça isso só enquanto ainda estiver testando: depois que os clientes reais chegarem, essa limpeza apaga o histórico deles.

---

<a id="m-conversoes"></a>

## Conversões

**Tela:** `/app/settings/conversoes`  
**Resumo:** Onde você liga a conta de anúncios para avisar à Meta quais clientes do anúncio viraram venda, confere o que chegou e marca a origem de quem vem pelo site.

**Lições:** [Conhecendo a tela e ligando a Meta](#l-conversoes--conhecendo-a-tela) · [O que a Meta recebe além da venda](#l-conversoes--o-que-a-meta-recebe) · [Vendas que não chegaram ao anúncio](#l-conversoes--vendas-nao-reportadas) · [Histórico de envios e diagnóstico](#l-conversoes--historico-e-diagnostico) · [Links rastreáveis](#l-conversoes--links-rastreaveis) · [Marcar quem chega pelo site](#l-conversoes--origem-pelo-site)

<a id="l-conversoes--conhecendo-a-tela"></a>

### Conhecendo a tela e ligando a Meta

- **Objetivo:** Entender para que serve a tela de Conversões e o que cada campo da conexão com a Meta faz.
- **Papel mínimo:** Administrador
- **Busca no curso:** conversões; devolver venda ao anúncio; ligar meta ads; token da meta; conjunto de dados; anúncio facebook instagram venda; pixel

1. **Onde fica** — `/app/settings`  
   Clique em "Configurações", no rodapé do menu lateral, para abrir a lista de todas as configurações. "Conversões" fica no grupo "Sua empresa". Clique no cartão para abrir a tela.
   > 💡 Só o administrador da empresa vê este cartão, porque a tela guarda o acesso à conta de anúncios. Os outros cargos nem encontram o cartão, e quem digita o endereço cai na página de acesso negado.
2. **Para que serve a tela** — `/app/settings/conversoes`  
   Quando um paciente que veio de um anúncio fecha e o negócio é marcado como ganho, o valor da venda volta para a plataforma do anúncio. É esse retorno que ensina o anúncio a procurar mais gente parecida com quem comprou. A tela tem quatro abas: "Configuração" (a conexão com a Meta, um cartão do Google Ads, as vendas que não chegaram e a marcação de quem vem pelo site), "Histórico de envios" (cada tentativa de envio), "Diagnóstico" (a saúde da ligação com o Google Ads) e "Links rastreáveis" (links que marcam de onde o cliente veio).
3. **A conexão com a Meta**  
   O primeiro cartão, sem título, logo abaixo dos avisos, é o da conta de anúncios do Facebook e do Instagram (Meta). Em "Identificador do destino de conversões" vai o número da fonte de dados que recebe as vendas. Ele fica no Gerenciador de Eventos da Meta, em Fontes de dados. Em "Token de acesso" vai a chave gerada ali mesmo, nas configurações dessa fonte de dados. Aqui ela já foi salva: o campo aparece vazio, com "Gravado. Deixe em branco para manter.", porque a chave nunca volta para a tela. A chave "Reportar vendas automaticamente" liga e pausa o envio. Depois de mexer, clique em "Salvar conexão".
   > 💡 Não existe botão para apagar a conexão. Para parar de enviar, desligue "Reportar vendas automaticamente" e salve: o envio pausa e a chave fica guardada para quando você quiser voltar.
4. **Conferir com o código de teste**  
   Para conferir se as vendas estão chegando sem bagunçar os números do anúncio, cole em "Código de teste (opcional)" o código que o gerenciador de eventos da Meta mostra e salve. Enquanto ele estiver preenchido, as vendas vão marcadas como teste e não contam para o anúncio aprender. Depois de salvar, aparece um aviso azul no alto da tela para lembrar disso; na foto o código ainda não foi salvo. Terminou de conferir? Apague o código e salve de novo. As vendas que fecharem durante o teste aparecem nas pendências como "Evento recebido em modo de teste". Depois de apagar o código, clique em "Verificar ou tentar novamente" em cada uma para que contem de verdade.

<a id="l-conversoes--o-que-a-meta-recebe"></a>

### O que a Meta recebe além da venda

- **Objetivo:** Saber quando ligar o envio pelo número de WhatsApp, preencher a página do anúncio e escolher o que cada etapa do funil avisa à Meta.
- **Papel mínimo:** Administrador
- **Busca no curso:** anúncio clique para whatsapp; id da página; conta whatsapp business; evento por etapa do funil; avisar meta agendamento; lead qualificado meta

1. **Venda pelo canal da conversa** — `/app/settings/conversoes`  
   Esta chave só vale para quem NÃO preencheu a conexão direta do cartão de cima. Como esta clínica já tem a conexão, aqui ela não muda nada. Sem a conexão direta, a venda de quem veio de anúncio pode sair pelo provedor do número de WhatsApp. Isso só funciona quando o número foi conectado por um provedor parceiro que faz esse repasse e que já está ligado à sua fonte de dados da Meta. Um número conectado pelo QR Code não envia nada por aqui. Saem para o provedor o valor, a moeda, o telefone do cliente e a conversa. A chave vem desligada e salva assim que você clica: ligue só se a sua política de privacidade cobre esse uso.
2. **Página e conta do WhatsApp Business**  
   Quando a venda vem de um anúncio que abre conversa no WhatsApp, a Meta exige saber de qual página do Facebook ou de qual conta do WhatsApp Business ela veio. Sem isso, a Meta recusa a venda. Preencha só um dos dois campos: "ID da Página" ou "ID da conta do WhatsApp Business". A Meta aceita um ou outro, não os dois juntos. Depois clique em "Salvar".
   > 💡 Este cartão só aparece depois que a conexão com a Meta foi salva.
3. **O que cada etapa do funil avisa**  
   Além da venda, a Meta pode ficar sabendo de quem agendou ou recebeu orçamento. Assim o anúncio aprende antes de a venda fechar. Cada etapa aberta do funil tem uma linha e uma chave. O contador mostra quantas etapas estão enviando. Clique em "Usar o recomendado" para o sistema sugerir pelo nome de cada etapa.
4. **A sugestão aplicada**  
   A etapa "Consulta agendada" foi ligada com o evento "Lead enviado". A sugestão vem do nome da etapa: nomes com agendamento, consulta, visita ou reunião viram "Lead enviado"; com orçamento, proposta ou cotação viram "Início de compra (orçamento)"; com qualificação ou interesse viram "Lead qualificado". Em "Evento enviado à Meta" você pode trocar o evento (o nome entre parênteses é o que a Meta usa, pode ignorar). Etapas sem sugestão ficam como estavam. A etapa de ganho não aparece aqui, porque a venda já vai pela conexão.
5. **Salvar as regras**  
   A sugestão só vale depois de clicar em "Salvar regras". O evento sai uma vez por negócio, quando ele entra na etapa, seja pela equipe, pela IA ou por uma automação. Só vale para quem veio de anúncio da Meta, e vai sem valor: o valor vai junto com a venda. Negócios que já estavam na etapa antes de você ligar não são enviados.

<a id="l-conversoes--vendas-nao-reportadas"></a>

### Vendas que não chegaram ao anúncio

- **Objetivo:** Ler a lista de vendas que não foram reportadas, entender o motivo de cada uma e mandar de novo depois de corrigir.
- **Papel mínimo:** Administrador
- **Busca no curso:** venda não chegou na meta; conversão não reportada; reprocessar venda; venda sem valor; meta recusou a venda; pendências de conversão

1. **A lista do que não chegou** — `/app/settings/conversoes`  
   Mais abaixo, na aba "Configuração", fica "Conversões que não foram reportadas": as vendas de anúncio cujo envio ainda não foi confirmado pela plataforma. Ao lado do título aparece quantas conversões a plataforma já aceitou. Cada linha mostra o negócio, o evento, a origem, o valor, o que houve (com a instrução do que fazer), quando foi e o botão para tentar de novo. Aparecem só as 20 mais recentes; para ver todas, use a aba "Histórico de envios".
   > 💡 Lista vazia nem sempre quer dizer que está tudo certo: pode ser que ainda nenhuma venda de anúncio tenha fechado.
2. **Venda sem valor**  
   A avaliação da Bruna Tavares foi marcada como ganha sem valor preenchido, e a Meta exige valor e moeda numa compra. Clique no nome do negócio para abri-lo, preencha o valor e volte aqui. Então clique em "Verificar ou tentar novamente": o sistema agenda um novo envio e a linha mostra "Reprocessamento agendado".
3. **Venda recusada pela Meta**  
   Quando a Meta recusa, o texto pequeno abaixo do motivo é a resposta dela, às vezes em inglês. Aqui ela diz que faltou a página ou a conta do WhatsApp Business. É só preencher o cartão "Página e conta do WhatsApp Business das vendas de clique-para-WhatsApp", mais acima, e depois clicar em "Verificar ou tentar novamente" nesta linha.
4. **Venda esperando nova tentativa**  
   Na linha da Sofia Andrade houve uma falha passageira, e o sistema já agendou uma nova tentativa sozinho: não precisa fazer nada. Lembre do aviso acima da lista: a plataforma aceitar o envio não garante que ela ligou a venda ao anúncio. Para ter certeza, confira no gerenciador da plataforma.

<a id="l-conversoes--historico-e-diagnostico"></a>

### Histórico de envios e diagnóstico

- **Objetivo:** Conferir tudo o que foi enviado, filtrar as falhas e ver a saúde da ligação com o Google Ads.
- **Papel mínimo:** Administrador
- **Busca no curso:** histórico de conversões; conferir envio para meta; id do evento; conversões com falha; diagnóstico google ads; google ads não configurado

1. **Abrir o histórico** — `/app/settings/conversoes`  
   A aba "Histórico de envios" mostra cada tentativa de mandar uma venda ou etapa às plataformas: as que deram certo, as que falharam e as que nem saíram. Clique nela.
2. **Filtros e lista**  
   No alto ficam os filtros: período (abre nos últimos 30 dias), status, evento, plataforma e uma busca pelo nome do negócio. Escolha e clique em "Filtrar". Abaixo aparece quantos envios há e a lista. O selo de cada linha diz o resultado: "Entregue", "Falhou", "Aguardando" (o envio está na fila: o sistema vai tentar de novo ou espera a confirmação da plataforma) ou "Não enviado" (falta algo do seu lado). Linhas "Lead enviado" são avisos das etapas do funil, não vendas.
3. **Os detalhes de um envio**  
   Clique numa linha para abrir os detalhes. Aqui, a venda que a Meta recusou: em cima vem o motivo e a resposta da Meta. "ID do evento" é o código para achar esta venda no gerenciador da plataforma; nos envios entregues aparece também o "Protocolo". Logo abaixo ficam o valor e quando a venda aconteceu. "Abrir negócio" leva ao negócio no funil e, como este envio não foi entregue, aparece também "Verificar ou tentar novamente".
4. **Só as falhas**  
   Para ver só o que deu errado, escolha "Falhas" em "Status" e clique em "Filtrar". O endereço da página guarda os filtros: dá para mandar o link para quem cuida dos anúncios conferir a mesma lista. Quem recebe o link precisa ser administrador desta empresa no sistema; os outros cargos não abrem esta tela.
5. **Diagnóstico do Google Ads**  
   A aba "Diagnóstico" mostra a saúde da ligação com o Google Ads em cartões, cada um com o próximo passo. Verde está bem, amarelo pede atenção e vermelho é problema. Nesta instalação o Google Ads ainda não foi preparado por quem instalou o sistema, e o primeiro cartão diz o que falta com nomes técnicos em maiúsculas: copie esse texto e mande para quem cuida do servidor. Não é nada que você tenha feito.

<a id="l-conversoes--links-rastreaveis"></a>

### Links rastreáveis

- **Objetivo:** Criar um link de WhatsApp por campanha ou botão e ver quantos cliques, contatos e negócios cada um trouxe.
- **Papel mínimo:** Administrador
- **Busca no curso:** link rastreável whatsapp; saber de onde veio o cliente; link da bio instagram; quantos cliques no link; link por campanha; utm

1. **Os links e o que trouxeram** — `/app/settings/conversoes?aba=links`  
   Na aba "Links rastreáveis" você cria um link de WhatsApp para cada campanha ou botão. Quem clica abre o WhatsApp com um código curto na mensagem. Se a pessoa enviar sem apagar o código, o sistema liga a conversa àquele link. A tabela mostra os cliques, os contatos e os negócios de cada link e se ele está ativo.
   > 💡 Cliques contam acessos repetidos. Contatos e negócios contam pessoas e negócios diferentes de cada link. Registros antigos apagados pela limpeza automática saem da conta.
2. **Editar um link**  
   Clique em "Editar" na linha do link. O formulário abaixo recebe os dados dele: nome, WhatsApp com código do país, mensagem inicial, onde será usado e os campos de campanha. A foto mostra a parte de baixo do formulário. Em "Mensagem inicial" você muda o texto; em "Prévia da mensagem" confere como ele vai sair com um código de exemplo no fim. Cada clique recebe o seu próprio código. Depois de mudar, clique em "Salvar link".
3. **O link e o script para o site**  
   Com o link aberto, aparecem logo abaixo dois caminhos, cada um com seu botão de copiar. O link vai onde você controla o endereço, como a bio, o anúncio ou um botão. O script é um pedacinho de código que quem cuida do seu site cola uma vez em todas as páginas; com ele, os botões de WhatsApp normais daquele número continuam como estão e o código entra sozinho. Use só um script por número. Em "URL do site", digite o endereço da sua página começando com https:// e clique em "Verificar instalação": o sistema abre o site numa aba (permita a abertura) e, em até 20 segundos, diz se achou o script. Se não confirmar, confira com quem cuida do site antes de concluir que está faltando.
4. **Criar um link novo**  
   Para começar do zero, clique em "Novo link". O formulário volta ao começo, com uma mensagem inicial sugerida e "Site" já escolhido. Dê um nome que você reconheça, como o da campanha, informe o WhatsApp com código do país (por exemplo +5511…), ajuste a mensagem, escolha onde será usado (Site, Anúncio ou Orgânico) e clique em "Salvar link".

<a id="l-conversoes--origem-pelo-site"></a>

### Marcar quem chega pelo site

- **Objetivo:** Ligar o endereço de captura para que quem toca no botão de WhatsApp da sua página entre no CRM com a origem da campanha.
- **Papel mínimo:** Administrador
- **Busca no curso:** botão whatsapp do site; origem do cliente site; landing page whatsapp; endereço de captura; script do site; de qual campanha veio

1. **O endereço de captura** — `/app/settings/conversoes`  
   No fim da aba "Configuração" fica "Quem chegou pelo site". O jeito mais simples é o endereço de captura: em vez do link comum do WhatsApp, o botão da sua página aponta para um endereço do sistema. Ele guarda de qual campanha a pessoa veio e abre o WhatsApp com um código curto no texto. Em "Para qual WhatsApp mandar" já aparece o número da clínica. O texto que a pessoa vai enviar precisa manter o pedaço "[ref:{token}]" no fim: é ali que o código curto entra. Sem ele, o botão de salvar não libera.
2. **Copiar e salvar**  
   Em "Cole este endereço no botão da sua página" está o endereço pronto. Os campos entre chaves só são preenchidos pela Meta quando ficam nos parâmetros de URL do anúncio. Se a página atende mais de uma campanha, o botão precisa repassar o que a página recebeu, senão a conversa entra sem origem. Clique em "Copiar endereço" e cole no botão de WhatsApp da sua página. Depois clique em "Salvar endereço de captura": a chave já vem ligada, mas o endereço só funciona depois de salvo.
3. **O script do site aparece**  
   Salvo o endereço, o cartão "Script para instalar no site", um pouco acima, passa a mostrar o script. É o outro caminho: em vez de trocar o botão pelo endereço, quem cuida do seu site cola esse pedacinho de código uma vez em todas as páginas e mantém os botões normais de WhatsApp. Ele guarda a origem enquanto a pessoa navega e ajusta os botões do número salvo. Clique em "Copiar script do site" se for usar esse caminho. Se trocar o número, copie o script de novo.
4. **Onde a origem aparece**  
   O código só vale na primeira mensagem do contato e nunca apaga uma origem que já existia, nem a de um anúncio. Só viajam dados da campanha, nenhum dado pessoal. A origem aparece na ficha do contato e no filtro "Site (landing page)" da lista de contatos.

---

<a id="m-meta-ads-conexao"></a>

## Meta Ads (conexão)

**Tela:** `/app/settings/meta-ads`  
**Resumo:** A página onde o administrador liga, troca ou desliga a conta de anúncios do Facebook e do Instagram, para o sistema poder ler os resultados das campanhas.

**Lições:** [Conhecendo a página de conexão](#l-meta-ads-conexao--conhecendo-a-tela) · [Ligando a conta de anúncios](#l-meta-ads-conexao--ligar-a-conta) · [Trocando a conta ou desligando](#l-meta-ads-conexao--trocar-ou-desconectar)

<a id="l-meta-ads-conexao--conhecendo-a-tela"></a>

### Conhecendo a página de conexão

- **Objetivo:** Achar a página de conexão do Meta Ads em Configurações e entender o que ela pede antes de a conta ser ligada.
- **Papel mínimo:** Administrador
- **Busca no curso:** conectar meta ads; ligar conta de anúncios facebook; configurar anúncios instagram; onde fica meta ads configurações; token de acesso meta; ads_read

1. **Onde fica** — `/app/settings`  
   Abra "Configurações", no rodapé do menu. A página fica na seção "Sua empresa", no cartão "Meta Ads". Não confunda com o cartão "Conversões": ele serve para outra coisa e pede um token diferente. Só o administrador da empresa vê este cartão. Clique nele.
2. **Uma ligação só para ler**  
   A frase do alto avisa que a ligação é só de leitura: o sistema lê o desempenho das campanhas e mostra em "Análise", na tela Meta Ads, mas nada é criado, pausado ou alterado na sua conta de anúncios. O quadro azul diz o que você precisa trazer: um token de acesso, uma senha especial que o Facebook gera para o sistema ler os seus anúncios. O token é gerado no site Meta for Developers, dentro de um aplicativo da sua conta de desenvolvedor da Meta. Na hora de gerar, marque a permissão "ads_read" (é ela que deixa o sistema ler os anúncios). Se quem cuida dos seus anúncios é outra pessoa ou agência, peça o token a ela.
   > 💡 O token fica guardado de forma protegida e nunca é mostrado de volta, nem para você.
3. **Os dois campos**  
   O campo "Token de acesso" recebe o token que você gerou. O "EAA…" cinza é só um exemplo de como ele começa: o campo está vazio. O mesmo vale para o "act_123456789012345" cinza do campo de baixo. O campo "Conta padrão (opcional)" diz qual conta de anúncios a tela de Meta Ads abre primeiro. Enquanto não houver um token colado no campo, o botão "Salvar" fica apagado e aparece "Cole o token para poder salvar.". Se você colou e o aviso continua, o token veio cortado: copie-o de novo, inteiro.

<a id="l-meta-ads-conexao--ligar-a-conta"></a>

### Ligando a conta de anúncios

- **Objetivo:** Colar o token, escolher a conta padrão, salvar e reconhecer a página com a conta já ligada.
- **Papel mínimo:** Administrador
- **Busca no curso:** como colar o token do facebook; salvar conexão meta ads; conta padrão act; ligar anúncios ao sistema; conexão salva meta

1. **Cole o token** — `/app/settings/meta-ads`  
   Cole o token no campo "Token de acesso". Ele aparece como pontinhos, para ninguém ler por cima do seu ombro. Com o token colado, o botão "Salvar" acende. Na primeira vez, o token é obrigatório. O "act_123…" cinza no campo de baixo ainda é só um exemplo: a conta padrão fica para o próximo passo.
2. **Escolha a conta que abre primeiro**  
   Se você tem mais de uma conta de anúncios, escreva em "Conta padrão (opcional)" a que deve abrir primeiro: "act_" seguido dos números da conta, que aparecem no Gerenciador de Anúncios. Se deixar em branco, a tela de Meta Ads abre a primeira conta ativa que o token alcançar.
3. **Conexão salva**  
   Clique em "Salvar". Por alguns segundos aparece o aviso "Conexão salva." no canto de baixo da tela. O campo do token fica vazio de novo, agora com "Guardado — preencha só para trocar", e logo abaixo aparece "Já existe um token guardado.": o token foi guardado, mas nunca é mostrado de volta. O sistema não testa o token na hora de salvar. Se ele estiver vencido ou sem a permissão "ads_read", o aviso aparece na tela de Meta Ads, dizendo o que fazer.
4. **A página com a conta ligada**  
   Com a conta ligada, o "Salvar" funciona mesmo com o campo do token em branco, e surge o botão "Desconectar", que apaga o token guardado. A frase no fim da página lembra que, para trocar só a conta padrão, basta deixar o token em branco.

<a id="l-meta-ads-conexao--trocar-ou-desconectar"></a>

### Trocando a conta ou desligando

- **Objetivo:** Trocar a conta padrão sem colar o token de novo, entender o aviso de formato errado e desligar a conta de anúncios.
- **Papel mínimo:** Administrador
- **Busca no curso:** trocar conta de anúncios meta; trocar token facebook ads; desconectar meta ads; desligar conta de anúncios; token vencido meta

1. **Com a conta já ligada** — `/app/settings/meta-ads`  
   Aqui a conta da clínica já está ligada, com a conta padrão "act_284019573310482". Para trocar só a conta padrão, deixe o campo do token em branco: o token guardado é mantido. Para trocar o token, por exemplo quando ele vence, cole o novo no mesmo campo e salve.
2. **Cuidado com o formato**  
   A conta padrão precisa ter "act_" na frente dos números. Se você escrever só os números, como aqui, e clicar em "Salvar", aparece por alguns segundos o aviso "Confira os campos: algum valor não está no formato esperado." no canto de baixo da tela, e nada é gravado. A conta que estava salva continua valendo.
3. **Trocando a conta padrão**  
   Com "act_" na frente, clique em "Salvar": a nova conta padrão é gravada e aparece por alguns segundos o aviso "Conexão salva.". O token guardado não muda. Da próxima vez, a tela de Meta Ads já abre nesta conta.
4. **O botão Desconectar**  
   "Desconectar" apaga na hora, sem pedir confirmação, o token guardado e a conta padrão escolhida. Nada muda na sua conta de anúncios, e nenhum número de campanha se perde: o sistema não guarda esses números, só os lê da Meta quando você abre a tela. Depois disso, a tela de Meta Ads volta a pedir uma conexão. Atenção: o sistema nunca devolve o token. Para ligar de novo, você vai precisar dele; se não o guardou, gere outro no Meta for Developers.
5. **Conta desligada**  
   Aparece por alguns segundos o aviso "Conta desconectada." e a página volta ao começo: campos vazios (o "EAA…" e o "act_123…" cinzas são só exemplos), "Salvar" apagado e "Cole o token para poder salvar.". Para ligar de novo, cole um token e salve: o mesmo que você guardou, ou um novo gerado no Meta for Developers.

---

<a id="m-marca"></a>

## Marca

**Tela:** `/app/settings/marca`  
**Resumo:** Onde você coloca o nome, a cor e o logo da sua empresa dentro do sistema, e escolhe o nome que aparece nos e-mails que as automações mandam aos seus clientes.

**Lições:** [Conhecendo a tela Marca](#l-marca--conhecendo-a-tela) · [Colocar o nome e a cor da empresa](#l-marca--nome-e-cor) · [Quando o sistema ajusta a sua cor](#l-marca--quando-a-cor-e-ajustada) · [Logo e nome nos e-mails](#l-marca--logo-e-emails)

<a id="l-marca--conhecendo-a-tela"></a>

### Conhecendo a tela Marca

- **Objetivo:** Achar a tela Marca e reconhecer os quadros que ela reúne.
- **Papel mínimo:** Administrador
- **Busca no curso:** mudar a cor do sistema; colocar o nome da minha empresa; personalizar o sistema com minha marca; onde troco o logo; marca da clínica; identidade visual

1. **Onde fica a tela** — `/app/settings`  
   Abra "Configurações", no rodapé do menu lateral. Na parte "Sua empresa" está o cartão "Marca". Clique nele.
   > 💡 Só quem é administrador da empresa abre esta tela. Gerente e atendente que digitarem o endereço caem numa página de acesso negado.
2. **Como sua empresa aparece**  
   O primeiro quadro guarda o nome, a cor e o logo da sua empresa. Com eles, o menu lateral e os botões passam a ter a sua cara para quem trabalha na sua empresa, e os e-mails do sistema, como o convite da equipe, saem com o nome da sua empresa.
3. **Os e-mails e a origem de cada coisa**  
   Rolando a tela, "Como seus e-mails saem" muda o nome que o cliente vê nos e-mails das automações. "De onde vem cada coisa" diz, para o nome, a cor e o logo, se foi você que definiu aqui, se veio de quem instalou o sistema ou se é o padrão.
4. **O que a marca ainda não muda**  
   O último quadro avisa onde a sua marca ainda não aparece: o título da aba do navegador e a tela de entrada continuam com o nome do sistema. Os e-mails de convite da equipe e de pedidos de dados já saem com o nome da sua empresa, quando o envio de e-mails está ligado no sistema. O relatório de LGPD entregue ao cliente leva a razão social, que fica em Configurações › Organização. O nome, a cor e o nome nos e-mails só são gravados quando você clica em "Salvar", no fim da página. O logo é diferente: ele é gravado assim que você escolhe o arquivo.

<a id="l-marca--nome-e-cor"></a>

### Colocar o nome e a cor da empresa

- **Objetivo:** Escrever o nome da empresa, escolher a cor da marca, conferir a prévia e salvar.
- **Papel mínimo:** Administrador
- **Busca no curso:** mudar a cor dos botões; trocar o nome no menu; cor da minha marca no sistema; personalizar cores; nome da clínica no topo do menu; código da cor da marca

1. **O nome da empresa** — `/app/settings/marca`  
   Em "Nome da sua empresa", escreva o nome como você quer que a equipe veja. Quando a empresa não tem logo, é ele que aparece no alto do menu lateral. Com logo, o logo ocupa esse lugar. Deixando em branco, fica o nome que já aparece em cinza dentro do campo.
2. **A cor da marca**  
   Em "Cor da sua marca", cole o código da cor, como #0e7c66. Se preferir escolher no olho, clique no quadradinho colorido ao lado: ele abre o seletor de cores do computador e preenche o código para você.
   > 💡 O código da cor costuma estar no material da sua marca, com quem fez o seu logo ou no seu site.
3. **A escala de tons**  
   Logo abaixo aparece a escala que o sistema monta a partir da sua cor. Os tons com contorno são os que vão de fato para a tela, e a legenda diz qual é qual: "Sua cor", "Botões no modo claro" e "Botões no modo escuro". Aqui, no modo claro, o botão usa exatamente a sua cor. No modo escuro, usa um tom mais claro da mesma escala, para não se perder no fundo escuro. Com algumas cores, o modo claro também troca por um tom vizinho, para o texto em cima do botão continuar legível.
4. **Conferir antes de salvar**  
   Em "De onde vem cada coisa", o nome e a cor agora dizem "você definiu aqui". Logo abaixo podem aparecer avisos sobre a cor. Com este verde, o aviso lembra que ele ficou parecido com o verde que o sistema usa para indicar sucesso: vale conferir se os avisos continuam fáceis de distinguir.
5. **Salvar e ver no menu**  
   Clique em "Salvar", no fim da página. Um aviso rápido "Marca salva." confirma e, sem recarregar nada, os botões passam a usar a sua cor, ou o tom dela que o sistema escolheu na escala. Se a empresa ainda não tem logo, o alto do menu lateral passa a mostrar o nome da empresa.
   > 💡 Para voltar ao que era antes, apague o nome e a cor, deixe os campos em branco e salve de novo.

<a id="l-marca--quando-a-cor-e-ajustada"></a>

### Quando o sistema ajusta a sua cor

- **Objetivo:** Entender os avisos sobre a cor, usar uma cor diferente no tema escuro e corrigir um código de cor errado.
- **Papel mínimo:** Administrador
- **Busca no curso:** cor do botão ficou diferente; minha cor não apareceu; cor amarela ficou escura; cor para o modo escuro; cor cinza não funciona; código de cor inválido

1. **Uma cor clara demais** — `/app/settings/marca`  
   Com uma cor bem clara, como este amarelo, o texto em cima dos botões ficaria difícil de ler. Por isso, no modo claro, o sistema usa um tom mais escuro da mesma escala. No modo escuro, a sua cor vai como está. As frases em "De onde vem cada coisa" contam isso. A última, em laranja, lembra que este amarelo ficou parecido com a cor que o sistema usa para indicar erro: vale conferir se os avisos de erro continuam fáceis de distinguir.
2. **Uma cor neutra**  
   Cinza, preto ou branco não destacam nada na tela. Com uma cor assim, o aviso diz que os botões seguem com a cor padrão do sistema.
3. **Uma cor só para o tema escuro**  
   Se a sua marca tem uma versão para fundo escuro, coloque-a em "Cor da sua marca no tema escuro (opcional)". Deixando em branco, os dois modos usam a cor de cima. A legenda embaixo da escala, em "Botões no modo escuro", passa a seguir essa cor. O código pode sair um pouco diferente do que você digitou, porque o sistema escolhe na escala o tom que deixa o texto do botão legível.
4. **Código de cor errado**  
   O campo aceita só o código da cor, como #0e7c66. Se você escrever outra coisa, como o nome da cor, aparece em vermelho "Use um código de cor como #7a5cd6." e o botão "Salvar", no fim da página, fica apagado até você corrigir.

<a id="l-marca--logo-e-emails"></a>

### Logo e nome nos e-mails

- **Objetivo:** Saber como subir o logo da empresa e escolher o nome e o endereço de resposta dos e-mails das automações.
- **Papel mínimo:** Administrador
- **Busca no curso:** colocar o logo da empresa; trocar logo do sistema; logo para fundo escuro; nome que aparece no email; resposta do cliente no meu email; remetente dos emails automáticos

1. **O logo** — `/app/settings/marca`  
   Em "Logo", clique no botão de escolher arquivo (no seu computador ele pode aparecer como "Escolher arquivo" ou "Choose File") e selecione a imagem. Ela sobe na hora, sem precisar do "Salvar", e aparece o aviso "Logo atualizado.". Use PNG ou JPG de até 512 KB, de preferência com fundo transparente. Depois disso surge o botão "Remover", para tirar o logo.
   > 💡 Se o seu logo é escuro e some no fundo escuro, suba uma versão clara em "Logo para o tema escuro (opcional)".
2. **A prévia nos dois fundos**  
   Embaixo, a prévia mostra como o logo fica no fundo claro e no fundo escuro do sistema. Sem logo próprio, ela mostra o que aparece hoje no lugar dele.
3. **O nome nos e-mails**  
   Em "Como seus e-mails saem", "Nome de exibição" é o remetente que o cliente lê nos e-mails das automações. "Responder para" é o e-mail que recebe a resposta quando o cliente responde. O endereço de envio continua sendo o do sistema. Isso vale para as automações que mandam e-mail, e só quando quem instalou o sistema já ligou o envio de e-mails.
4. **E-mail escrito errado**  
   Um endereço sem @ ou sem o final, como .com.br, mostra em vermelho "Use um endereço de e-mail como contato@suaempresa.com" e deixa o "Salvar" apagado. Corrija e clique em "Salvar". O nome e o endereço passam a valer nos próximos e-mails das suas automações, se o envio de e-mails do sistema estiver ligado.

---

<a id="m-plano-e-cobranca"></a>

## Plano e cobrança

**Tela:** `/app/settings/billing`  
**Resumo:** Onde você vê o plano da sua empresa, quanto dele já usa, a situação do pagamento, e onde troca de plano ou cancela a assinatura.

**Lições:** [Conhecendo seu plano](#l-plano-e-cobranca--conhecendo-seu-plano) · [Trocar de plano](#l-plano-e-cobranca--trocar-de-plano) · [Cancelar a assinatura](#l-plano-e-cobranca--cancelar-assinatura)

<a id="l-plano-e-cobranca--conhecendo-seu-plano"></a>

### Conhecendo seu plano

- **Objetivo:** Achar a tela, ler o plano contratado, a situação do pagamento e quanto do plano a empresa já usa.
- **Papel mínimo:** Administrador
- **Busca no curso:** meu plano; plano e cobrança; assinatura; mensalidade; quanto eu pago; limite do plano; faturas; pagamento do sistema

1. **Onde fica a tela** — `/app/settings`  
   Abra "Configurações", no rodapé do menu lateral. Na parte "Sua empresa" está o cartão "Plano e cobrança". Clique nele.
   > 💡 Só quem é administrador da empresa abre esta tela. Gerente e atendente que digitarem o endereço caem na página "Sem permissão". Se a tela mostrar só "Em breve", quem instalou o sistema não usa planos pagos: não há nada a pagar aqui.
2. **Seu plano e a situação do pagamento**  
   O quadro "Seu plano" mostra o nome do plano que a sua empresa assina e quanto ele custa por mês (ou por ano, se o plano for anual). Logo abaixo vem a situação do pagamento em poucas palavras. "Em dia" quer dizer que está tudo pago. Quando algo muda, a frase muda junto: "Em atraso desde" uma data, "Cancelada, acesso até" uma data, ou "Teste grátis até" uma data.
3. **Quanto do plano você já usa**  
   Embaixo, três linhas comparam o que a empresa usa com o limite do plano. "Pessoas" conta quem tem acesso ao sistema. "Números conectados" conta os canais cadastrados em Conexões que não foram excluídos, mesmo os que estão desconectados no momento. "Uso de IA no mês" mostra quanto todas as funções de inteligência artificial do sistema gastaram neste mês, em dólar, e volta a zero no começo de cada mês. Quando um plano não tem limite, aparece "sem limite".
   > 💡 Chegou no limite de pessoas ou de números? O sistema não deixa passar dele. Para liberar espaço, exclua um número em Conexões ou tire o acesso de alguém em Equipe. Para crescer, troque para um plano maior, como mostra a próxima lição.
4. **Trocar o cartão e ver as faturas**  
   O botão "Gerenciar pagamento" leva você, nesta mesma aba, à página da empresa que faz a cobrança. Lá você troca o cartão de crédito e vê as faturas. Ao terminar, ela traz você de volta. A troca de plano não fica lá: ela é feita aqui mesmo, no botão "Trocar de plano". Se a cobrança da sua empresa é por boleto ou Pix (Asaas), esse botão não aparece: a fatura chega por um link.
   > 💡 Se um dia a mensalidade atrasar e houver uma fatura em aberto, aparece aqui o botão "Pagar agora", que abre essa fatura, e o botão "Já paguei", que confere na hora se o pagamento já chegou.

<a id="l-plano-e-cobranca--trocar-de-plano"></a>

### Trocar de plano

- **Objetivo:** Comparar o plano atual com outro, ver quanto custa subir de plano e o que acontece ao descer.
- **Papel mínimo:** Administrador
- **Busca no curso:** trocar de plano; mudar plano; plano maior; aumentar limite de pessoas; fazer upgrade; plano mais barato; diminuir plano

1. **Abrir a troca** — `/app/settings/billing`  
   Na tela "Plano e cobrança", clique em "Trocar de plano". Abre um quadro logo abaixo dos botões, e o botão some enquanto o quadro está aberto. Para desistir, saia da tela sem confirmar.
2. **Comparar os planos lado a lado**  
   Em "Novo plano", escolha o plano que você quer. Aqui escolhemos "Clínica Completa". Logo abaixo, o plano atual e o novo aparecem lado a lado, com o preço e os limites de pessoas, de números conectados e de IA por mês. Só aparecem os outros planos que quem administra o sistema oferece, com a mesma forma de cobrança (mensal ou anual) do plano de hoje.
3. **Subir de plano: o valor proporcional**  
   Quando o plano novo é mais caro, a tela já mostra uma estimativa do ajuste: a diferença de preço só pelos dias que faltam até a próxima renovação. A data da renovação não muda. Ao confirmar, abre o pagamento desse ajuste (no boleto/Pix, aparece o botão "Abrir a fatura"). Os limites novos passam a valer depois que o pagamento é confirmado. Até lá, ficam os limites de hoje.
   > 💡 Saiu sem pagar? O botão "Pagar ajuste do upgrade" fica nesta tela. Se a diferença for pequena (menos de R$ 5), não há cobrança agora: o plano novo entra na próxima renovação.
4. **Descer de plano: vale na renovação**  
   Escolha agora um plano mais barato, como o "Essencial". A troca para baixo não cobra nada hoje: o plano novo e os limites dele passam a valer na próxima renovação, e a fatura atual continua com o mesmo valor e a mesma data. Depois de confirmar, o quadro "Seu plano" mostra "Novo plano a partir de" com a data e o nome do plano.
   > 💡 Se a empresa usa mais do que o plano escolhido permite, a troca é recusada e a tela diz o que fazer antes, por exemplo "Revogue o acesso de 1 pessoa(s) em Equipe." Durante o teste grátis é diferente: qualquer troca, para cima ou para baixo, vale na hora e sem ajuste.

<a id="l-plano-e-cobranca--cancelar-assinatura"></a>

### Cancelar a assinatura

- **Objetivo:** Saber onde se cancela a assinatura e o que acontece com o acesso depois.
- **Papel mínimo:** Administrador
- **Busca no curso:** cancelar assinatura; cancelar plano; parar de pagar; encerrar contrato do sistema; reembolso; até quando tenho acesso

1. **O botão de cancelar** — `/app/settings/billing`  
   Na tela "Plano e cobrança", o último botão da fileira é "Cancelar assinatura". Clicar nele ainda não cancela nada: só abre a confirmação.
2. **Leia antes de confirmar**  
   A confirmação avisa: você continua usando o sistema até o fim do período que já pagou, e não há devolução do valor proporcional. Só depois de clicar em "Confirmar cancelamento" o pedido vai para a empresa que faz a cobrança. Se mudar de ideia, basta sair da tela sem clicar.
3. **Depois de cancelar** — `/app/settings/billing`  
   A foto mostra a tela antes do cancelamento. Depois que você confirma, a tela diz até que dia mantém o acesso, e a frase da situação, que hoje diz "Em dia", passa a dizer "Cancelada, acesso até" essa data. Até lá, os administradores veem uma faixa no alto do sistema: "Sua assinatura termina em" e a data. Os botões "Trocar de plano" e "Cancelar assinatura" deixam de aparecer.
   > 💡 Mudou de ideia depois que o acesso acabou? Aparece o botão "Assinar de novo", nesta tela ou na tela de conta suspensa, para onde o sistema leva quando o acesso é bloqueado.

---

<a id="m-lgpd"></a>

## LGPD

**Tela:** `/app/lgpd/requests`  
**Resumo:** Onde chegam os pedidos dos clientes da loja virtual para receber uma cópia dos próprios dados ou apagá-los, com o prazo de cada um.

**Lições:** [Conhecendo a lista de pedidos](#l-lgpd--conhecendo-a-lista) · [Filtrar os pedidos](#l-lgpd--filtrar-pedidos) · [Atender um pedido de cópia dos dados](#l-lgpd--pedido-de-copia) · [Atender um pedido para apagar os dados](#l-lgpd--pedido-de-exclusao)

<a id="l-lgpd--conhecendo-a-lista"></a>

### Conhecendo a lista de pedidos

- **Objetivo:** Achar a tela da LGPD, entender o aviso de prazo e ler cada coluna da lista.
- **Papel mínimo:** Administrador
- **Busca no curso:** lgpd; pedido de dados do cliente; cliente pediu para apagar os dados; lei de proteção de dados; exportar dados do cliente; prazo lgpd; privacidade

1. **Onde fica a tela** — `/app/settings`  
   Clique em "Configurações", no rodapé do menu lateral, e desça até a parte "Dados e acesso": ali fica o cartão "LGPD". É nele que chegam os pedidos dos clientes que querem uma cópia dos próprios dados ou que querem ser apagados do seu cadastro.
   > 💡 Só quem administra a conta vê esta tela.
2. **De onde vêm os pedidos**  
   A tela "Solicitações LGPD" mostra os pedidos de clientes sobre os próprios dados. Eles só chegam aqui se a sua loja Nuvemshop estiver conectada ao CRM: quando um cliente da loja pede uma cópia dos dados ou pede para ser apagado, a loja manda o pedido para cá e o prazo começa a contar. Pedido feito por WhatsApp ou telefone não aparece nesta lista. Para apagar essa pessoa, abra a ficha dela em Contatos e use "Anonimizar contato". A Clínica Bem Viver tem a loja conectada e quatro pedidos.
3. **O aviso vermelho de prazo**  
   Quando algum pedido em aberto já passou do prazo, ou tem menos de 2 dias para vencer, aparece este aviso vermelho no alto. Ele conta quantos pedidos estão nessa situação. Aqui é 1: o pedido do cliente 48213907, que já passou do prazo. Quando nenhum está tão perto do fim, mas algum já gastou mais da metade do prazo, o aviso fica amarelo. Pedido concluído não entra na conta.
4. **As colunas da lista**  
   Cada linha é um pedido, e o que vence primeiro fica em cima. "Tipo" diz o que o cliente pediu: "Solicitação dados" é uma cópia dos dados; "Anonimização cliente" é apagar os dados pessoais. "Sujeito" é o número do cliente na loja virtual. "Recebido" diz há quanto tempo o pedido chegou e "Vence" quanto falta para o prazo (em vermelho quando faltam menos de 2 dias; depois do prazo aparece "atrasado hoje" ou quantos dias de atraso). "SLA" resume o prazo: "OK", "Alerta" (mais da metade do prazo já passou), "Crítico" (menos de 2 dias) ou "Vencido".
   > 💡 são os prazos que o sistema usa, e não números escritos na lei. A cópia dos dados tem 7 dias úteis e o apagamento 15 dias úteis, contados do dia em que o pedido chegou. Sábado, domingo e feriados nacionais não contam.
5. **O andamento de cada pedido**  
   A coluna "Status" diz em que pé o pedido está. Num pedido de cópia, "Recebido" quer dizer que ele espera a sua aprovação. Num pedido de apagamento, o sistema começa sozinho: se ele ficou em "Recebido", o processamento automático não rodou e você pode aprovar à mão. Depois vem "Processando" e, quando termina, "Concluído". "Revisão pendente" quer dizer que o sistema não conseguiu terminar sozinho: a cópia ficou pronta mas não foi enviada por e-mail (você baixa e entrega), ou o cliente do pedido de apagamento não foi achado no CRM. "Falhou" quer dizer que deu erro três vezes seguidas. Para abrir um pedido, clique em "Ver", no fim da linha.

<a id="l-lgpd--filtrar-pedidos"></a>

### Filtrar os pedidos

- **Objetivo:** Mostrar só os pedidos de um tipo ou de uma situação, e voltar para a lista completa.
- **Papel mínimo:** Administrador
- **Busca no curso:** filtrar pedidos lgpd; ver só pedidos de exclusão; pedidos de dados atrasados; limpar filtros lgpd; pedidos lgpd concluídos

1. **Os três filtros** — `/app/lgpd/requests`  
   Acima da lista ficam três filtros. "Status: todos" separa pelo andamento (por exemplo, só os recebidos). "Tipo: todos" separa cópia de dados de apagamento. "SLA: todos" separa pela situação do prazo. Eles podem ser usados juntos.
2. **Escolher um tipo**  
   Clique em "Tipo: todos" para abrir a lista de tipos. "Solicitação dados" é o cliente pedindo uma cópia dos dados. "Anonimização cliente" é o cliente pedindo para ser apagado. "Anonimização tenant" aparece quando alguém desinstala o aplicativo do CRM da loja Nuvemshop. Nesse caso o sistema apaga sozinho os dados pessoais de todos os contatos da empresa no CRM, e não só dos clientes da loja.
3. **A lista filtrada**  
   Agora a lista mostra só os 2 pedidos de cópia de dados, e o contador ao lado dos filtros diz "2 solicitações". Para voltar a ver tudo, clique em "Limpar filtros": ele só aparece quando algum filtro está ligado. Repare que o aviso do alto ficou amarelo: ele conta só os pedidos que aparecem na lista, e entre as cópias de dados nenhuma venceu, mas uma já gastou mais da metade do prazo.
4. **Ver só os que esperam por você**  
   No filtro "Status: todos", escolha "Recebido" para ver só os pedidos que ainda não começaram a ser atendidos. É um bom jeito de começar o dia: aqui são 3, as duas cópias que esperam a sua aprovação e o apagamento atrasado.

<a id="l-lgpd--pedido-de-copia"></a>

### Atender um pedido de cópia dos dados

- **Objetivo:** Abrir um pedido de cópia dos dados, conferir o que será enviado e preparar a aprovação.
- **Papel mínimo:** Administrador
- **Busca no curso:** cliente pediu cópia dos dados; aprovar exportação de dados lgpd; enviar dados para o cliente; pré-visualizar dados do titular; como responder pedido lgpd

1. **Abrir o pedido** — `/app/lgpd/requests`  
   O Pedro Henrique Lima pediu, pela loja virtual, uma cópia dos dados que a clínica guarda sobre ele. Na linha do pedido dele (cliente 48227316), clique em "Ver".
2. **O topo do pedido**  
   No alto aparecem o código do pedido, o andamento ("Recebido") e o tipo ("Solicitação de dados"). Logo abaixo ficam o dia e a hora em que o pedido chegou e a data-limite para responder ("Vence em"). O link "Solicitações", acima do código, volta para a lista.
3. **Prazo e detalhes**  
   O quadro "Linha do tempo SLA" mostra a barra do prazo (verde no começo, amarela a partir de três quartos, vermelha no fim) e as etapas "Recebido" (D+0), "Revisão intermediária" (D+5) e "Entrega ao titular" (D+7). Essas etapas contam dias corridos: o prazo que vale é o "Vence em", no alto da página. O quadro "Detalhes" traz o tipo, a origem ("nuvemshop" é a loja virtual), quantas tentativas o sistema já fez e o número do cliente na loja, que aparece como "External customer ID".
4. **O histórico do pedido**  
   Embaixo, a "Trilha de auditoria" lista tudo o que acontece com o pedido, com dia e hora. Por enquanto só tem a chegada pela loja ("lgpd.data_request_received"); a aprovação e o envio entram aqui depois. Esse registro fica guardado e não pode ser editado, e serve de prova de que a clínica respondeu no prazo.
5. **Ver o que será enviado**  
   Antes de aprovar, clique em "Pré-visualizar dados". A janela mostra o cadastro do cliente, com o e-mail e o telefone parcialmente escondidos, e quantos registros dele existem no sistema: conversas, mensagens, "Leads" (negócios no funil), pedidos, atividades, entradas de auditoria e consentimentos. Nada é enviado nem alterado ao abrir esta janela. A janela se chama "Prévia de dados do titular". Em "Expandir amostra" você vê até 10 exemplos de cada tipo de registro. O CPF nunca aparece nesta prévia.
6. **Aprovar o envio**  
   Feche a prévia e clique em "Aprovar export". A janela mostra o nome do cliente e o e-mail para onde a cópia vai: confira se é a pessoa certa, porque o envio não pode ser desfeito. No campo "Justificativa", escreva o motivo da aprovação (no mínimo 10 caracteres) e clique em "Confirmar aprovação". O pedido passa para "Processando", e o sistema monta um PDF com os dados e manda por e-mail. Se o envio de e-mails do sistema não estiver configurado, ou se o cliente não tiver e-mail, o pedido fica em "Revisão pendente" e aparece o botão "Baixar PDF" para você entregar o arquivo. O link do botão vale por 72 horas.
   > 💡 O botão de aprovar só aparece enquanto o pedido está em "Recebido".

<a id="l-lgpd--pedido-de-exclusao"></a>

### Atender um pedido para apagar os dados

- **Objetivo:** Abrir um pedido de apagamento que ficou parado, entender o que a aprovação apaga e ler um pedido já concluído.
- **Papel mínimo:** Administrador
- **Busca no curso:** cliente pediu para apagar os dados; anonimizar cliente lgpd; excluir dados do paciente; pedido lgpd vencendo; direito ao esquecimento

1. **O pedido atrasado** — `/app/lgpd/requests`  
   A Juliana Castro pediu para ser apagada do cadastro. Normalmente o sistema faz o apagamento sozinho assim que o pedido chega. Este ficou parado em "Recebido" e já passou do prazo (selo "Vencido"), então precisa de alguém hoje. Clique em "Ver" na linha dele (cliente 48213907).
2. **O prazo vencido**  
   O tipo é "Anonimização cliente" e o prazo de 15 dias úteis já acabou. Na "Linha do tempo SLA", a barra está cheia e vermelha, e o canto direito diz há quantos dias o prazo passou ("d em atraso"). As etapas de um apagamento são outras: "Processamento" (D+10) e "Anonimização concluída" (D+15), contadas em dias corridos. A bolinha fica verde quando o dia da etapa chega, mesmo que nada tenha sido feito: quem diz se o pedido foi atendido é o selo "Recebido" ao lado do código.
3. **Aprovar a anonimização**  
   Antes de aprovar, use "Pré-visualizar dados" para conferir que é a pessoa certa: a janela de aprovação não mostra o nome. Depois clique em "Aprovar anonimização", na janela "Aprovar anonimização de contato", escreva no campo "Justificativa" o motivo, com pelo menos 10 caracteres, e clique em "Confirmar aprovação". Isso não tem volta. O sistema troca o nome do cliente por "Cliente Anonimizado" seguido de um código e apaga o telefone, o e-mail e o conteúdo das conversas, mensagens e arquivos dele. As datas ficam guardadas, para os seus números continuarem certos. O pedido passa para "Processando" e, quando termina, vira "Concluído".
4. **Um pedido já concluído** — `/app/lgpd/requests/9e06c2f8-7d35-4b81-b6e4-be7000000004`  
   Este pedido de apagamento foi atendido há 3 dias. O selo diz "Concluído", o quadro "Detalhes" mostra quando terminou em "Concluído em", e a "Trilha de auditoria" guarda as três etapas: a chegada pela loja ("lgpd.redact_received"), a aprovação ("lgpd.manually_approved", com o começo do código de quem aprovou depois de "por") e o apagamento terminado ("lgpd.redact_completed"). A "Linha do tempo SLA" continua contando os dias mesmo depois de concluído: quem diz que o pedido foi atendido é o selo "Concluído" e a data em "Concluído em".

---

<a id="m-api-tokens"></a>

## API Tokens

**Tela:** `/app/settings/api-tokens`  
**Resumo:** Onde você cria as chaves que deixam outro sistema (uma agenda online, um prontuário, um assistente de IA) conversar com o seu CRM, escolhe o que cada chave pode fazer e desliga a que não usa mais.

**Lições:** [Conhecendo a tela de API Tokens](#l-api-tokens--conhecendo-a-tela) · [Criar uma chave para outro sistema](#l-api-tokens--criar-um-token) · [Desligar uma chave que não se usa mais](#l-api-tokens--revogar-um-token)

<a id="l-api-tokens--conhecendo-a-tela"></a>

### Conhecendo a tela de API Tokens

- **Objetivo:** Achar a tela de API Tokens e ler a lista de chaves: o nome, o começo da chave, o que cada uma pode fazer, se está ligada e até quando vale.
- **Papel mínimo:** Administrador
- **Busca no curso:** api tokens; chave de integração; ligar outro sistema ao crm; integrar agenda online; token de acesso; conectar assistente de ia

1. **Onde ficam as chaves** — `/app/settings`  
   Abra "Configurações", no rodapé do menu lateral. Na parte "Dados e acesso" fica o cartão "API Tokens". Clique nele.
   > 💡 Só o administrador da empresa vê este cartão. Quem tem outro cargo e tenta abrir a tela recebe um aviso de acesso negado.
2. **Uma chave para cada sistema**  
   Um token é uma chave. Você entrega a chave a outro sistema, como a agenda online do site ou um assistente de IA, e ele passa a ler e gravar no seu CRM sem ninguém digitar nada. Cada linha da lista é uma chave. A frase do topo avisa: a chave completa aparece uma única vez, no momento em que você cria.
   > 💡 Crie uma chave para cada sistema. Assim, se um deles parar de ser usado, você desliga só a chave dele.
3. **Nome, começo da chave e permissões**  
   Em "Nome" fica o apelido que você deu à chave. Em "Prefixo" aparece só o começo dela: o sistema não guarda a chave inteira, então este pedaço serve para você conferir qual chave um sistema está usando. Em "Escopos" estão as permissões da chave, com o nome curto de cada uma. O assistente de IA, por exemplo, pode ler o CRM ("mcp:read"), agir nele ("mcp:write") e age com poder de gerente ("role:manager").
4. **Ligada, desligada e validade**  
   A coluna "Status" diz se a chave funciona: "Ativo" quer dizer ligada, "Revogado" quer dizer desligada para sempre. A coluna "Expira" mostra a data em que a chave deixa de valer sozinha. Um traço ("—") quer dizer que ela não tem data para vencer: vale até alguém revogar.
   > 💡 Depois da data de "Expira", o sistema recusa a chave, mas a coluna "Status" continua mostrando "Ativo". Confira sempre as duas colunas juntas.

<a id="l-api-tokens--criar-um-token"></a>

### Criar uma chave para outro sistema

- **Objetivo:** Criar uma chave com nome, permissões e validade, e guardar a chave completa antes de fechar a janela.
- **Papel mínimo:** Administrador
- **Busca no curso:** criar token; gerar chave de api; integrar prontuário com o crm; nova chave de integração; copiar token; permissões do token

1. **Começar uma chave nova** — `/app/settings/api-tokens`  
   Neste exemplo, o prontuário eletrônico da clínica vai consultar a lista de pacientes do CRM. Ele precisa de uma chave. Clique em "Criar token", no alto da tela.
2. **Dê um nome que diga de quem é**  
   Abre a janela "Criar novo token". Em "Nome", escreva para qual sistema é a chave, aqui "Prontuário eletrônico da clínica". O nome precisa ter pelo menos 2 letras. É ele que vai te dizer, meses depois, se a chave ainda está em uso.
3. **Marque só o que o sistema precisa**  
   Em "Escopos" ficam as permissões. Cada botão traz o nome curto e, ao lado, o que ele libera. Clique para marcar: o botão marcado ganha uma borda colorida. O prontuário só precisa consultar os pacientes, então marque só "mcp:read". Apesar de a descrição falar em agentes de IA, é esta permissão que deixa qualquer sistema ler o CRM. Quanto menos permissões, menor o estrago se a chave cair em mãos erradas.
   > 💡 Hoje, só as permissões "mcp:read" (ler), "mcp:write" (gravar) e as de papel ("role:…") abrem portas de verdade. As outras, como "contacts:read" ou "leads:write", aparecem na lista, mas o CRM ainda não as confere: uma chave só com elas é recusada. Sem pelo menos um escopo marcado, o botão "Criar" avisa "Selecione ao menos um escopo."
4. **Validade e criar**  
   Em "Expira em (dias) — opcional" você diz por quantos dias a chave vale, de 1 a 365. Aqui, 180. O "365" apagado no campo vazio é um exemplo: sem digitar nada, a chave vale até você revogar. Depois clique em "Criar".
   > 💡 Uma validade obriga a trocar a chave de tempos em tempos. Se ela vencer, o outro sistema para de conversar com o CRM até receber uma chave nova.
5. **Copie a chave agora**  
   Abre a janela "Token criado" com a chave completa. Clique em "Copiar para clipboard" e cole a chave no outro sistema, ou num lugar seguro. Esta é a única vez que ela aparece: o CRM guarda só uma impressão da chave, não a chave, e não consegue mostrá-la de novo. Se você perder, crie outra e revogue esta.
6. **A chave nova na lista**  
   Clique em "Fechar". A chave nova aparece no topo da lista, "Ativo", com as permissões que você marcou e a data em que vence. Daqui para frente, a lista mostra só o começo dela.

<a id="l-api-tokens--revogar-um-token"></a>

### Desligar uma chave que não se usa mais

- **Objetivo:** Saber quando e como revogar uma chave, o que acontece depois e como trocar uma chave sem deixar o outro sistema parado.
- **Papel mínimo:** Administrador
- **Busca no curso:** revogar token; desligar chave de api; cancelar integração; chave vazou; trocar token; parar outro sistema de acessar o crm

1. **O botão Revogar** — `/app/settings/api-tokens`  
   Cada chave ligada tem o botão "Revogar" no fim da linha. Ele desliga a chave na hora, sem pedir confirmação, e não tem volta. A partir daí, o sistema que usava a chave é recusado e não lê nem grava mais nada no CRM. Use quando parar de usar um sistema ou quando desconfiar que a chave vazou.
   > 💡 Confira o nome da linha antes de clicar: como não há confirmação, um clique na linha errada desliga a integração errada.
2. **Depois de revogada**  
   A chave revogada continua na lista, com o selo "Revogado" e sem o botão "Revogar". Ela fica ali como registro de que existiu. Revogada não volta a funcionar: se o sistema precisar de acesso de novo, crie outra chave.
3. **Trocar uma chave sem parar nada**  
   Para trocar a chave de um sistema, siga esta ordem: crie a chave nova em "Criar token", cole a chave nova no outro sistema e só então revogue a antiga. Revogando primeiro, o sistema fica sem acesso no intervalo.
   > 💡 Cada empresa pode ter até 50 chaves ligadas ao mesmo tempo. Chaves revogadas ou vencidas não contam. Se aparecer o aviso de limite, revogue as que não usa mais.

---

<a id="m-trunk-sip"></a>

## Trunk SIP

**Tela:** `/app/settings/voip-trunk`  
**Resumo:** Onde você guarda os dados da linha de telefone contratada com um provedor, para a IA fazer ligações de voz, e pega o bloco de configuração que vai para o servidor.

**Lições:** [Conhecendo a tela do Trunk SIP](#l-trunk-sip--conhecendo-a-tela) · [Cadastrar e alterar o provedor](#l-trunk-sip--cadastrar-o-provedor)

<a id="l-trunk-sip--conhecendo-a-tela"></a>

### Conhecendo a tela do Trunk SIP

- **Objetivo:** Achar a tela e saber para que serve cada campo do cadastro do provedor de telefone.
- **Papel mínimo:** Administrador
- **Busca no curso:** trunk sip; ligação de voz pela ia; configurar telefone; provedor de telefonia; linha telefônica no sistema; credenciais sip

1. **Onde fica a tela** — `/app/settings`  
   Abra "Configurações", no rodapé do menu lateral. Na parte "Dados e acesso" está o cartão "Trunk SIP". Clique nele.
   > 💡 Só o administrador vê este cartão. A telefonia é um recurso opcional do servidor: esta tela só tem uso se quem instalou o sistema ligou a parte de telefone.
2. **Para que serve**  
   Para a IA fazer ligações de voz, a empresa contrata uma linha com um provedor de telefone pela internet (o "provedor SIP"). Aqui você guarda os dados de acesso dessa linha. Salvar aqui não liga nada sozinho: depois, quem cuida do servidor precisa colar um bloco de configuração no servidor de telefone, como diz o texto do topo.
3. **Os dados da linha**  
   Os quatro primeiros campos vêm do provedor, quando você contrata a linha. "Host" é o endereço do provedor (o texto cinza no campo é só um exemplo). "Porta" já vem com 5060, o número mais comum; só mude se o provedor pedir. "Usuário" e "Senha" são o login da sua linha.
   > 💡 A senha fica guardada trancada: depois de salva, a tela mostra só os quatro últimos caracteres.
4. **Campo opcional, chave e Salvar**  
   "From-domain (opcional)" só é preenchido se o provedor exigir: normalmente é o endereço público do seu servidor. A chave "Ativo" diz se as ligações que o sistema faz saem por esta linha. Desligada, os dados ficam guardados e o sistema para de ligar por ela; as ligações recebidas não mudam, porque dependem do que foi colado no servidor. O botão "Salvar" grava tudo.
   > 💡 Na primeira vez a senha é obrigatória: sem ela, o sistema avisa e não salva. Depois, para salvar qualquer mudança (até desligar "Ativo"), digite a senha de novo.

<a id="l-trunk-sip--cadastrar-o-provedor"></a>

### Cadastrar e alterar o provedor

- **Objetivo:** Salvar os dados da linha, pegar o bloco para o servidor e alterar um dado depois.
- **Papel mínimo:** Administrador
- **Busca no curso:** cadastrar provedor sip; salvar senha do telefone; bloco pjsip para o servidor; trocar porta do provedor; configurar ligação da ia; copiar configuração do telefone

1. **Preencha com os dados do provedor** — `/app/settings/voip-trunk`  
   Copie para a tela o que o provedor enviou: o endereço em "Host", o login em "Usuário" e a senha em "Senha". Aqui a porta ficou com 5060 e o "From-domain (opcional)" ficou vazio. Depois clique em "Salvar".
2. **O bloco para o servidor**  
   Logo depois de salvar aparece o quadro "Cole em asterisk/pjsip.conf". É o texto que quem cuida do servidor cola no arquivo de configuração do telefone. Clique em "Copiar" e mande para essa pessoa agora: ele leva a senha e só aparece neste momento.
   > 💡 Se o botão disser que não conseguiu copiar, selecione o texto do quadro e copie à mão.
3. **A senha fica guardada**  
   No cadastro, ao lado de "Senha", agora aparece "configurada, termina em 4821": são os quatro últimos caracteres da senha salva. O campo voltou a ficar vazio, porque a senha nunca é mostrada inteira de novo.
4. **Ao voltar à tela** — `/app/settings/voip-trunk`  
   Quando você abre a tela de novo, os dados salvos aparecem preenchidos, mas o quadro do bloco não volta: sem a senha inteira, ele não pode ser montado outra vez. A senha continua guardada; o campo fica vazio.
5. **Alterar um dado**  
   Para mudar um dado, como a porta, troque o campo, digite a senha da linha de novo e clique em "Salvar". O quadro "Cole em asterisk/pjsip.conf" aparece outra vez, já com a mudança e com a senha. Copie e mande de novo para quem cuida do servidor: a mudança só vale para as ligações depois que ele colar o bloco novo.
   > 💡 Digite a senha sempre que salvar uma mudança, mesmo com o texto cinza "Deixe em branco para manter a atual" no campo. Hoje, salvar com a senha em branco mostra "Erro interno. Tente de novo em instantes." e não grava nada; tentar de novo não adianta, só digitar a senha.

---

<a id="m-servidor-mcp-externo"></a>

## Servidor MCP externo

**Tela:** `/app/settings/servidor-mcp-externo`  
**Resumo:** Onde o dono da instalação cadastra e testa o endereço e a chave de um sistema de fora (um prontuário, um sistema de gestão).

**Lições:** [Conhecendo a tela do servidor externo](#l-servidor-mcp-externo--conhecendo-a-tela) · [Cadastrar o endereço e a chave](#l-servidor-mcp-externo--cadastrar-o-servidor) · [O que a tela recusa](#l-servidor-mcp-externo--o-que-a-tela-recusa) · [Testar e remover](#l-servidor-mcp-externo--testar-e-remover)

<a id="l-servidor-mcp-externo--conhecendo-a-tela"></a>

### Conhecendo a tela do servidor externo

- **Objetivo:** Achar a tela do servidor MCP externo e reconhecer os dois campos e os três botões dela.
- **Papel mínimo:** Administrador
- **Busca no curso:** servidor mcp externo; ligar a ia a outro sistema; ia consultar meu prontuário; conectar sistema de gestão à ia; endereço e chave do sistema de fora; integrar erp com a ia

1. **Onde fica a tela** — `/app/settings`  
   Abra "Configurações", no rodapé do menu lateral. Na parte "Dados e acesso" fica o cartão "Servidor MCP externo". Clique nele.
   > 💡 Só o dono da instalação entra nesta tela. Quem não é dono e clica no cartão vê "Sem permissão". Se a verificação em duas etapas estiver ligada na sua conta, o sistema pode pedir o código antes de abrir a tela.
2. **Para que serve**  
   Esta tela guarda o endereço e a senha de acesso (a chave) de um sistema de fora, como o prontuário ou o sistema de gestão da clínica. MCP é o nome do jeito padrão de a IA conversar com outro sistema. Guardar aqui ainda não faz a IA usar esse sistema: aqui você só cadastra e testa a ligação. A frase do cartão já avisa a regra: o endereço precisa começar com https e ser de um servidor público na internet.
   > 💡 A tela sempre abre com os campos vazios, mesmo que um servidor já esteja cadastrado: o endereço e a chave guardados não voltam para a tela.
3. **Os campos e os botões**  
   Em "Endereço do servidor MCP" vai o endereço que o fornecedor do seu sistema passou. Em "Chave de acesso" vai a senha de acesso; ela aparece em bolinhas enquanto você digita. Logo abaixo ficam "Salvar", que guarda os dois, e "Testar conexão", que pergunta ao sistema de fora o que ele oferece. Mais embaixo, separado, fica "Remover", que apaga o cadastro. O texto cinza que aparece no endereço (https://erp.example.com/mcp) é só um exemplo de formato: o campo está vazio.

<a id="l-servidor-mcp-externo--cadastrar-o-servidor"></a>

### Cadastrar o endereço e a chave

- **Objetivo:** Preencher o endereço e a chave do sistema de fora, salvar e conferir o fim da chave que ficou gravada.
- **Papel mínimo:** Administrador
- **Busca no curso:** cadastrar servidor mcp; salvar endereço e chave; colocar a chave do sistema; ligar prontuário na ia; onde ponho a chave de acesso

1. **Preencha os dois campos** — `/app/settings/servidor-mcp-externo`  
   Cole em "Endereço do servidor MCP" o endereço que o fornecedor do sistema passou. Aqui usamos o do prontuário da Clínica Bem Viver. Depois cole a chave em "Chave de acesso". Os dois são obrigatórios.
   > 💡 Não cole a chave dentro do endereço (por exemplo, depois de um "?token="). O endereço com segredo colado é recusado.
2. **Salve**  
   Clique em "Salvar". A tela confirma com "Configuração salva". O campo da chave fica vazio de novo e aparece um aviso com só os quatro últimos caracteres dela, aqui "7Q4x". É a única vez que você vê esse pedaço: a chave é guardada de forma embaralhada e não volta para a tela.
   > 💡 Anote em algum lugar seguro qual chave você usou. Se perder, peça uma nova ao fornecedor do sistema e salve de novo: o cadastro novo substitui o anterior.
3. **O próximo passo é testar**  
   Com o cadastro salvo, o próximo passo é "Testar conexão": a tela pergunta ao seu sistema o que ele oferece e mostra a resposta. O que aparece quando o teste não encontra resposta está na lição "Testar e remover".
   > 💡 Salvar não chama o seu sistema: só confere se o endereço tem a forma certa e guarda. Quem chama o sistema é o botão "Testar conexão".

<a id="l-servidor-mcp-externo--o-que-a-tela-recusa"></a>

### O que a tela recusa

- **Objetivo:** Entender as duas recusas mais comuns ao salvar: campo vazio e endereço que não é seguro.
- **Papel mínimo:** Administrador
- **Busca no curso:** endereço recusado por segurança; não consigo salvar o servidor mcp; erro ao salvar endereço; preencha o endereço e a chave; por que precisa de https

1. **Faltou a chave** — `/app/settings/servidor-mcp-externo`  
   Se você preencher só o endereço e clicar em "Salvar", a tela avisa em vermelho que precisa dos dois. Nada é gravado. Para apagar um cadastro, o caminho é o botão "Remover", não salvar com um campo vazio.
2. **Endereço da rede interna** — `/app/settings/servidor-mcp-externo`  
   Aqui o endereço aponta para um computador dentro da clínica (um número que começa com 192.168) e não usa https. Ao clicar em "Salvar", a tela recusa e explica: o endereço precisa ser de um servidor na internet, em https, sem rede interna, sem "localhost" e sem segredo colado nele. Nada é gravado.
   > 💡 Se o seu sistema só funciona dentro da clínica, peça ao fornecedor um endereço público em https.

<a id="l-servidor-mcp-externo--testar-e-remover"></a>

### Testar e remover

- **Objetivo:** Usar "Testar conexão" para ver se o sistema de fora responde e "Remover" para apagar o cadastro.
- **Papel mínimo:** Administrador
- **Busca no curso:** testar conexão servidor mcp; nenhum servidor externo respondeu; ver ferramentas do sistema de fora; remover servidor mcp; apagar o cadastro do sistema externo

1. **Testar a conexão** — `/app/settings/servidor-mcp-externo`  
   "Testar conexão" usa o endereço e a chave já salvos, não o que está digitado nos campos. Quando o sistema responde, aparece embaixo o cartão "O que o servidor oferece", com o nome do servidor consultado (só a parte principal do endereço) e a lista de ferramentas que ele anuncia.
2. **Quando nada responde**  
   Aqui o teste não encontrou resposta, e a tela avisa "Nenhum servidor externo respondeu". Esse aviso aparece tanto quando não há nada salvo quanto quando o sistema de fora não atende ou recusa a chave. Confira o endereço e a chave com o fornecedor, salve de novo e teste outra vez.
3. **Remover o cadastro**  
   Com um servidor cadastrado, clique em "Remover" para apagar o cadastro. Não há pergunta de confirmação: o endereço e a chave desta empresa são apagados na hora. A tela confirma com "Servidor externo removido".
   > 💡 Para cadastrar de novo, é só preencher o endereço e a chave e clicar em "Salvar".

---

<a id="m-extensoes"></a>

## Extensões

**Tela:** `/app/extensions`  
**Resumo:** Onde você instala e liga guias prontos que orientam a equipe no CRM, como o roteiro da primeira consulta, vendo antes quais telas cada guia pode abrir.

**Lições:** [Conhecendo a tela de Extensões](#l-extensoes--conhecendo-a-tela) · [Ativar um guia e usá-lo](#l-extensoes--ativar-um-guia) · [Ajustar como os cartões aparecem](#l-extensoes--aparencia-dos-cartoes) · [Catálogo, versões e remoção](#l-extensoes--catalogo-e-versoes)

<a id="l-extensoes--conhecendo-a-tela"></a>

### Conhecendo a tela de Extensões

- **Objetivo:** Achar a tela de Extensões e ler o cartão de uma extensão instalada: se está ativa, a versão, de onde veio e quais telas ela pode abrir.
- **Papel mínimo:** Administrador
- **Busca no curso:** extensões; guias do crm; o que é extensão; instalar guia no crm; complementos; permissões da extensão

1. **Onde ficam as extensões** — `/app/settings`  
   Abra "Configurações", no rodapé do menu lateral. Na parte "Sua empresa" fica o cartão "Extensões". Clique nele.
2. **Guias que orientam o trabalho**  
   Uma extensão é um guia pronto: um passo a passo que aparece no CRM para orientar a equipe, como o roteiro para marcar a primeira consulta. Ela não recebe os dados dos seus pacientes e não roda programa de ninguém: no máximo, um botão do guia abre uma tela do CRM, como a Agenda. A tela tem duas abas: "Instaladas", o que já está no seu CRM, e "Catálogo", o que pode ser instalado.
   > 💡 O quadro "Oriente o trabalho com novos guias", no alto, só aparece para quem cuida do servidor onde o CRM roda (o responsável pela instalação). O administrador de uma empresa não o vê. A frase do topo fala em "Tarefas", mas cada guia abre a tela escrita no próprio cartão.
3. **O cartão de uma extensão**  
   Cada extensão instalada ganha um cartão. Ao lado do nome, o selo diz se ela está "Ativa" ou "Desativada" na sua empresa. O quadro cinza mostra a "Versão", a "Origem" (o endereço de onde ela veio) e a "Permissão": as telas do CRM que o guia pode abrir. Aqui, o "Roteiro da primeira consulta" só abre a Agenda e não lê seus dados.
   > 💡 Extensão instalada não aparece sozinha para a equipe. Ela só vale na sua empresa depois que um administrador a ativa, como mostra a próxima lição.
4. **Procurar uma extensão**  
   Com muitas extensões, use a busca: digite parte do nome ou da descrição e a lista mostra só as que combinam. Aqui, "retorno" deixou só o guia "Retorno de pacientes". A busca vale nas duas abas.
5. **Filtrar por categoria**  
   Ao lado da busca, a lista de categorias separa as extensões pelo assunto: "Produtividade", "Vendas" ou "Atendimento". Escolha uma para ver só as daquele assunto, ou "Todas as categorias" para ver tudo de novo.

<a id="l-extensoes--ativar-um-guia"></a>

### Ativar um guia e usá-lo

- **Objetivo:** Ligar uma extensão instalada na sua empresa, abrir o guia dela e achar os cartões do guia no CRM.
- **Papel mínimo:** Administrador
- **Busca no curso:** ativar extensão; ligar guia; abrir guia; usar extensão no crm; guia da recepção; orientações instaladas

1. **Ligar a extensão** — `/app/extensions`  
   No cartão do "Roteiro da primeira consulta", a chave "Ativa no CRM" liga a extensão só na sua empresa. Desligada, a frase embaixo avisa que a configuração fica guardada. Clique na chave.
   > 💡 Só o administrador da empresa vê a chave. Os outros cargos não mudam nada aqui: com a extensão desativada, veem o aviso "Peça a um administrador da organização para ativar este guia."; depois de ativada, veem o botão "Abrir guia".
2. **Salvar a mudança**  
   A chave ligou e a frase mudou para "Os guias aparecem no hub do CRM." (o "hub do CRM" é a tela CRM, que vamos ver no fim desta lição). Mas nada vale antes de salvar: clique em "Salvar configuração".
3. **Extensão ativa**  
   Salvo. O selo passou para "Ativa" e aparece a frase "Configuração salva.". Agora surgiu o botão "Abrir guia", que leva ao conteúdo do guia. Clique nele.
   > 💡 Para tirar o guia da equipe, desligue a chave e salve de novo. A configuração fica guardada para quando você religar.
4. **O conteúdo do guia**  
   O guia mostra o nome, a versão e as telas que ele pode abrir. Embaixo vêm os cartões com o passo a passo, como "Marcar a primeira consulta". O botão do cartão, aqui "Abrir a Agenda", confere de novo se a extensão continua ativa e então leva você à Agenda do CRM.
   > 💡 A frase pequena embaixo do botão fala em "Tarefas", mas o botão abre a tela que está escrita nele, aqui a Agenda.
5. **O guia no dia a dia** — `/app/crm`  
   A equipe não precisa vir até Extensões. Na tela "CRM" (no menu lateral, o link "Ver tudo em CRM") aparece a parte "Orientações instaladas", com um cartão para cada passo a passo das extensões ativas. Clicar no cartão abre o guia com esse passo em primeiro lugar. O link "Gerenciar extensões" volta para esta configuração.

<a id="l-extensoes--aparencia-dos-cartoes"></a>

### Ajustar como os cartões aparecem

- **Objetivo:** Deixar os cartões de um guia mais compactos e sem a descrição, e conferir o resultado na tela inicial do CRM.
- **Papel mínimo:** Administrador
- **Busca no curso:** cartões compactos; densidade dos cards; esconder descrição do guia; aparência da extensão; configurar extensão; deixar guia menor

1. **As duas opções de aparência** — `/app/extensions`  
   Abaixo da chave "Ativa no CRM" ficam duas opções que mudam só a aparência dos cartões do guia. "Densidade dos cards" escolhe entre "Confortável", com mais espaço, e "Compacta". "Mostrar descrição nos cards" liga ou desliga a frase curta embaixo do título de cada cartão.
2. **Escolher a densidade**  
   Clique em "Densidade dos cards" e escolha "Compacta".
3. **Esconder a descrição e salvar**  
   Desligue "Mostrar descrição nos cards". Como a extensão está desativada, ligue também "Ativa no CRM": só os guias ativos aparecem para a equipe. Por fim, clique em "Salvar configuração".
4. **Configuração salva**  
   Pronto: apareceu a frase "Configuração salva.". A extensão está ativa, com a densidade "Compacta" e sem a descrição nos cartões. As escolhas ficaram gravadas na sua empresa.
5. **O resultado na tela inicial** — `/app/crm`  
   Agora abra a tela "CRM" (link "Ver tudo em CRM" no menu lateral). Em "Orientações instaladas", o cartão "Marcar a primeira consulta" ficou mais baixo e perdeu a frase de descrição embaixo do título. O nome do guia, no alto, e a linha "Abre Agenda; não lê seus dados." continuam lá.
   > 💡 A escolha vale só para a sua empresa. Outra empresa no mesmo CRM pode usar o mesmo guia com outra aparência.

<a id="l-extensoes--catalogo-e-versoes"></a>

### Catálogo, versões e remoção

- **Objetivo:** Para quem administra a instalação: entender o catálogo, instalar e trocar a versão de uma extensão, desfazer uma troca e remover.
- **Papel mínimo:** Administrador
- **Busca no curso:** catálogo de extensões; instalar extensão; atualizar extensão; voltar versão anterior; remover extensão; admitir catálogo

1. **Admitir um catálogo** — `/app/extensions`  
   Este quadro só aparece para quem administra a instalação do CRM. Um catálogo é um arquivo com a lista de extensões que alguém oferece para instalar. Clique em "Escolher arquivo JSON", escolha o arquivo e depois em "Admitir catálogo". O CRM guarda quem admitiu, quando, o endereço de origem e o número da versão do arquivo, e as extensões dele passam a aparecer na aba "Catálogo". Admitir não instala nada: instalar é o passo seguinte.
   > 💡 Como diz o quadro à direita, o arquivo não comprova quem o publicou. Só admita um catálogo de uma fonte em que você confia.
2. **A aba Catálogo**  
   Na aba "Catálogo" cada cartão é uma versão de uma extensão. O quadro mostra a "Identidade" (um código com o editor, o nome e a versão), a "Origem revisada", o "Publicado por" e "O que ela abre". Aqui o "Roteiro da primeira consulta" aparece em duas versões: a 1.1.0 já está instalada, e a 1.0.0 oferece "Trocar para 1.0.0".
3. **Instalar uma extensão nova**  
   "Orientações pós-consulta" ainda não está instalada. O botão "Instalar versão revisada" baixa o pacote do endereço do catálogo, confere se é o mesmo arquivo revisado e instala para a instalação inteira. Depois disso, o administrador de cada empresa decide se ativa.
   > 💡 Se o endereço do catálogo estiver fora do ar, a instalação falha e o motivo aparece em "Atividade recente", no fim da tela.
4. **Trocar de versão**  
   Ao clicar em "Trocar para 1.0.0", o CRM pede confirmação. A versão escolhida substitui a atual em todas as empresas, e quem estava com a extensão ativa continua com ela ativa. Ao confirmar em "Trocar", o pacote é baixado de novo do endereço do catálogo; se ele estiver fora do ar, a troca falha e a versão atual continua. Aqui vamos só ler e clicar em "Cancelar".
5. **Desfazer a última troca**  
   De volta à aba "Instaladas", quem administra a instalação vê no cartão o quadro "Em todas as organizações", que conta quantas empresas estão com a extensão ativa. O botão "Desfazer a última troca (volta para 1.0.0)" devolve a versão anterior em todas as empresas sem baixar nada, então funciona mesmo com o catálogo fora do ar. Ele também pede confirmação.
6. **Remover da instalação**  
   "Remover da instalação" tira a extensão de todas as empresas: quem a usava deixa de ver os guias, e a configuração de cada empresa fica guardada. Não há desfazer: para voltar, é preciso reinstalar pelo catálogo, o que só funciona se o endereço do catálogo estiver no ar e ainda listar a versão. Depois, cada empresa ativa de novo. Aqui só abrimos a confirmação; para sair sem remover, clique em "Cancelar".
7. **Atividade recente**  
   No fim da tela, "Atividade recente" guarda o recibo de cada pedido: catálogo admitido, instalação, atualização ou troca de versão, troca desfeita, remoção e configuração. Cada um mostra o resultado ("Concluída", "Falhou" ou "Cancelada"), a data e a hora. Um pedido ainda em andamento aparece como "Preparando": quem o fez pode verificar ou cancelar; os outros responsáveis só podem cancelar.
   > 💡 Nos recibos de "Configuração", a linha de baixo diz "Operação da plataforma", mas eles registram uma mudança feita só na sua empresa, como ligar um guia.

---

<a id="m-dados-externos"></a>

## Dados externos

**Tela:** `/app/integracao-dados`  
**Resumo:** Onde você liga o CRM ao banco de dados de outro sistema da clínica, para o agente de IA consultar essas informações sem poder mudar nada lá.

**Lições:** [Conhecendo a tela de Dados externos](#l-dados-externos--conhecendo-a-tela) · [Cadastrar uma conexão nova](#l-dados-externos--cadastrar-conexao) · [Testar, editar e remover uma conexão](#l-dados-externos--testar-editar-remover) · [Escolher o que o assistente pode ver](#l-dados-externos--o-que-o-assistente-ve)

<a id="l-dados-externos--conhecendo-a-tela"></a>

### Conhecendo a tela de Dados externos

- **Objetivo:** Achar a tela e ler, em cada conexão, se ela está funcionando e o que o assistente já pode consultar.
- **Papel mínimo:** Administrador
- **Busca no curso:** dados externos; banco de dados; outro sistema; integração; ERP; sistema da clínica; agente consultar dados; conectar banco

1. **Onde fica** — `/app/settings`  
   Abra "Configurações", no rodapé do menu lateral. Na parte "Dados e acesso" fica o cartão "Dados externos". Clique nele.
   > 💡 Este cartão só existe quando quem administra o servidor liga o recurso "Banco de dados externo", no Admin, em "Recursos opcionais". Desligado, a tela some para todo mundo.
2. **Para que serve**  
   Aqui você liga o CRM ao banco de dados de outro sistema que a clínica já usa, como o sistema de agendamentos ou o cadastro de convênios. Só funciona com bancos PostgreSQL ou MySQL, e o servidor do CRM precisa conseguir chegar até esse banco pela rede. A ligação é só de leitura: nada que o agente faz muda o sistema de origem. Cada cartão da lista é uma conexão.
   > 💡 Conectar não basta para o agente usar os dados. Na configuração de cada agente de IA, ligue as capacidades 'Ver as tabelas do banco conectado' e 'Buscar dados no banco conectado'. Elas ficam no pacote 'Organizar a operação'.
3. **Uma conexão recém-cadastrada**  
   O nome em cima é o que você deu à conexão. Ao lado aparecem dois selos: o primeiro diz se ela funciona ("Não testada" quer dizer que ninguém clicou em "Testar" ainda) e o segundo diz o tipo do banco, PostgreSQL ou MySQL. Embaixo ficam o endereço do servidor, a porta, o nome do banco e o usuário usado para entrar.
   > 💡 Os selos possíveis são "Conectada" (o último teste deu certo), "Falha no último teste", "Não testada" e "Desativada".
4. **Os avisos em laranja**  
   As frases em laranja embaixo do cartão dizem o que falta. "O assistente ainda não enxerga nada deste banco" quer dizer que nenhuma tabela foi liberada: o link "Escolher o que ele pode ler" leva direto a essa escolha. O segundo aviso diz que, nas conversas, o assistente consultaria o banco sem se limitar ao paciente que está falando. Para corrigir, use "Editar" e diga qual coluna identifica o cliente.
5. **Uma conexão desativada**  
   O cartão "Cadastro de convênios" mostra o selo "Desativada": o cadastro continua salvo, mas o agente não usa esse banco. Ele também mostra "2 tabelas liberadas", que é o que o assistente pode ler quando a conexão estiver ativa. Como esta conexão já diz qual coluna identifica o paciente, o aviso em laranja sobre o cliente não aparece.
6. **Os botões de cada conexão**  
   "Explorar" abre a conexão para ver as tabelas e escolher o que o assistente lê. "Testar" confere se o CRM consegue entrar no banco. O lápis ("Editar") muda os dados da conexão e a lixeira ("Remover") apaga a conexão. Você usa cada um deles nas próximas lições.
   > 💡 Todo mundo da equipe vê esta lista e pode explorar os dados liberados. Só o administrador da empresa vê 'Nova conexão', o lápis e a lixeira, e só ele consegue testar a conexão.

<a id="l-dados-externos--cadastrar-conexao"></a>

### Cadastrar uma conexão nova

- **Objetivo:** Preencher o formulário de conexão com os dados que o responsável pelo outro sistema passar, com segurança e limites certos.
- **Papel mínimo:** Administrador
- **Busca no curso:** conectar banco de dados; nova conexão; cadastrar banco; mysql; postgresql; usuário só leitura; senha do banco; host e porta

1. **Começar uma conexão** — `/app/integracao-dados`  
   Peça a quem cuida do outro sistema (o fornecedor ou o técnico de informática) o endereço do servidor, a porta, o nome do banco e um usuário com senha que só consiga ler. Com esses dados em mãos, clique em "Nova conexão".
   > 💡 Só o administrador da empresa vê este botão. O servidor do CRM precisa conseguir chegar ao banco: se o CRM está na internet e o banco fica num computador da clínica, peça ao responsável que libere esse acesso. Sem isso, o teste sempre falha.
2. **O tipo de banco**  
   Abre a janela "Conectar banco de dados". Comece pelo "Tipo de banco": PostgreSQL ou MySQL. Pergunte ao responsável qual é o do seu sistema. A frase de cima avisa que a senha é guardada embaralhada e nunca aparece de novo na tela.
   > 💡 Depois de criada, a conexão não troca de tipo. Para trocar, é preciso remover e cadastrar de novo.
3. **O guia para quem usa MySQL**  
   Ao escolher MySQL, aparece o "Como criar um acesso só de leitura (guia rápido)". Clique nele para abrir: são comandos prontos para você mandar a quem administra o banco. Eles criam um usuário novo que só lê e liberam somente as informações que o assistente pode ver. A porta muda sozinha para 3306, a porta comum do MySQL.
   > 💡 Se o seu sistema for um site em WordPress, o próprio formulário recomenda criar uma "view": uma tabela de consulta só com o que o assistente deve ver.
4. **Os dados de acesso**  
   Em "Nome da conexão", dê um nome que a equipe reconheça. Em "Host" vai o endereço do servidor e em "Porta", o número que o responsável informar. "Banco de dados" é o nome do banco lá dentro. "Usuário" e "Senha" são os do acesso só de leitura criado para o CRM.
   > 💡 Use um usuário só para o CRM, nunca o do administrador do banco.
5. **A segurança da conexão**  
   Em "Segurança da conexão (TLS)" você escolhe se a conversa entre o CRM e o banco vai protegida. Deixe em "Obrigatório (padrão)", a não ser que o responsável peça outra opção. "Sem TLS" só serve para um banco dentro da mesma rede, que você confia.
   > 💡 As duas opções "Verificar certificado" são mais rígidas: além de proteger a conversa, conferem se o servidor apresenta um certificado válido e recusam a ligação se não apresentar. Use uma delas, ou "Preferir TLS", só se o responsável pedir.
6. **Quem é o cliente na conversa**  
   No quadro 'Cliente nas conversas', em 'O que identifica o cliente', escolha 'Telefone do cliente' ou 'E-mail do cliente'. Em 'Nome da coluna', escreva o nome do campo onde o outro sistema guarda esse dado. Assim, quando um paciente escreve no WhatsApp, o assistente só lê as linhas desse paciente. Escolhendo telefone, o aviso logo abaixo explica em que formato o número precisa estar gravado.
   > 💡 Se deixar 'Não configurado', o assistente consulta o banco nas conversas sem se limitar ao paciente que está falando. Se configurar, uma tabela que não tenha essa coluna fica fora das conversas.
7. **Limites e salvar**  
   Os "Limites de leitura" dizem quanto o assistente pode ler de uma vez: quantas linhas por consulta, quantos filtros e o tamanho da resposta. Os valores que já vêm preenchidos servem para quase todo mundo. Ao clicar em "Salvar", o CRM guarda a conexão e abre a página dela para você escolher o que o assistente pode ler.
   > 💡 Uma conexão nova não libera nada sozinha: até você escolher as tabelas, o assistente não enxerga nenhum dado desse banco.

<a id="l-dados-externos--testar-editar-remover"></a>

### Testar, editar e remover uma conexão

- **Objetivo:** Conferir se o CRM alcança o banco, entender a falha, ajustar a conexão e saber o que acontece ao removê-la.
- **Papel mínimo:** Administrador
- **Busca no curso:** testar conexão; falha no teste; não conecta; editar conexão; trocar senha do banco; desativar conexão; remover conexão; apagar banco

1. **Testar a conexão** — `/app/integracao-dados`  
   Depois de cadastrar, clique em "Testar". O CRM tenta entrar no banco com o usuário e a senha guardados e mostra o resultado no próprio cartão.
   > 💡 O teste não mexe em nenhum dado do outro sistema: ele só confere se a entrada funciona.
2. **Quando o teste falha**  
   Neste exemplo, o servidor 192.168.0.50 não respondeu. O selo virou 'Falha no último teste' e a linha vermelha mostra o motivo, em inglês. Mande essa linha para quem cuida do outro sistema: em geral é endereço, porta, senha ou um bloqueio de rede. Quando o teste dá certo, o selo vira 'Conectada'. Se nenhuma tabela foi escolhida ainda, a página da conexão abre sozinha para você fazer isso.
3. **Corrigir os dados**  
   O lápis abre a janela "Editar conexão" com os dados já preenchidos. O tipo de banco fica travado. A senha nunca volta para a tela: o campo diz "Guardada — preencha só para trocar". Deixe em branco para manter a senha atual.
4. **Desativar sem apagar**  
   A chave "Conexão ativa" para o uso do banco sem apagar o cadastro. Desligada e salva, o cartão mostra "Desativada" e o agente deixa de consultar esse banco. Para voltar, é só ligar a chave de novo e clicar em "Salvar".
5. **Remover uma conexão**  
   A lixeira pede confirmação antes. Ao clicar em 'Remover', a conexão inteira é apagada: a senha guardada, as tabelas escolhidas e os ajustes. O agente deixa de enxergar esse banco. O banco do outro sistema não é tocado: só some a ligação com o CRM. Se quiser só pausar, prefira desativar. Aqui, clique em 'Cancelar'.

<a id="l-dados-externos--o-que-o-assistente-ve"></a>

### Escolher o que o assistente pode ver

- **Objetivo:** Abrir uma conexão, decidir quais informações do outro sistema o assistente pode ler e saber onde consultar os dados.
- **Papel mínimo:** Administrador
- **Busca no curso:** o que o assistente pode ver; liberar tabelas; escolher tabelas; esconder dados sensíveis; explorar dados; ver dados do outro sistema; tudo liberado

1. **Abrir a conexão** — `/app/integracao-dados`  
   Clique em "Explorar" no cartão da conexão. O link em laranja "Escolher o que ele pode ler" leva para a mesma página.
2. **A página da conexão**  
   No topo ficam o nome, o endereço e o lembrete 'somente leitura'. Logo abaixo vem o quadro 'O que o assistente pode ver'. O selo à direita resume a escolha atual: 'Nada liberado', o número de tabelas liberadas ou 'Tudo liberado'. Numa conexão em que nada foi liberado ainda, o quadro já vem aberto.
3. **Só o que você marcar**  
   Deixe marcado 'Só o que eu marcar (recomendado)'. Quando o CRM alcança o banco, aparece aqui a lista das tabelas, cada uma com uma caixinha para liberar. Depois de marcar uma tabela, o botão 'Detalhes' deixa escolher as colunas e escrever uma descrição para o assistente. Neste exemplo o banco não respondeu, por isso aparece o aviso de que o catálogo não pôde ser lido e o botão 'Tentar de novo'.
   > 💡 O aviso amarelo continua até você marcar a primeira tabela e clicar em 'Salvar': até lá, o assistente não enxerga nada deste banco.
4. **Liberar tudo, com cuidado**  
   A opção "Tudo que o usuário do banco enxerga" libera de uma vez tudo o que o usuário do banco consegue ler. O aviso amarelo explica o risco: se houver senhas ou outros dados sensíveis, o assistente passa a enxergá-los. Nada muda até você clicar em "Salvar". Até lá, aparece "Alterações não salvas" ao lado dos botões, e "Descartar alterações" volta para o que estava salvo.
   > 💡 Prefira liberar tabela por tabela. Ou peça ao responsável um usuário de banco que só enxergue o necessário.
5. **Consultar os dados**  
   Antes, clique em "Descartar alterações" para voltar ao modo recomendado. Mais abaixo fica o explorador. À esquerda, em "Tabelas", aparecem as tabelas liberadas. Clique numa delas e, à direita, os dados aparecem numa grade, página por página, só para leitura. Aqui a lista mostra "Não foi possível ler o catálogo." porque o banco de exemplo não respondeu.
   > 💡 Qualquer pessoa da equipe pode abrir esta página e consultar os dados liberados. Só o administrador muda o que é liberado.
