# Curso DeskComm — Atendimento

> Gerado a partir do [curso oficial do DeskComm](https://www.deskcomm.com.br/curso) — versão 1.94.0, gerado em 2026-10-29. Conteúdo do **núcleo do DeskcommCRM (upstream)**; o que o fork de clínicas acrescenta está em [`docs/funcionalidades.md`](../funcionalidades.md). As capturas de tela de cada passo ficam no curso online.

[← Índice do curso](README.md)

## Módulos deste grupo

| Módulo | Tela | Lições | Para que serve |
|---|---|---|---|
| [Inbox](#m-inbox) | `/app/inbox` | 9 | As conversas de WhatsApp, com você e a IA atendendo lado a lado. |
| [Radar](#m-radar) | `/app/radar` | 5 | Quem esfriou e ainda está aberto — o que corre risco de morrer sem resposta. |
| [Agenda](#m-agenda) | `/app/agenda` | 7 | O que está marcado, com quem, e quem atende — seu e da equipe. |
| [Respostas rápidas](#m-respostas-rapidas) | `/app/templates` | 5 | Scripts salvos para responder mais rápido, seus ou da equipe. |

---

<a id="m-inbox"></a>

## Inbox

**Tela:** `/app/inbox`  
**Resumo:** Onde você e a IA atendem os clientes do WhatsApp lado a lado: a fila de quem espera, a conversa, a ficha do cliente e os atalhos do dia a dia.

**Lições:** [Conhecendo a Inbox](#l-inbox--conhecendo-a-tela) · [Entendendo a lista: abas, cores e contadores](#l-inbox--abas-e-sinais) · [Achando a conversa certa](#l-inbox--achando-a-conversa) · [Lendo o histórico da conversa](#l-inbox--lendo-o-historico) · [Assumir um cliente e preparar a resposta](#l-inbox--assumir-e-responder) · [Recados para a equipe com a nota interna](#l-inbox--nota-interna) · [Pausar o robô, passar adiante e encerrar](#l-inbox--passar-pausar-encerrar) · [A ficha do cliente ao lado da conversa](#l-inbox--ficha-do-cliente) · [Trabalhar mais rápido: atalhos e ações em lote](#l-inbox--atalhos-e-lote)

<a id="l-inbox--conhecendo-a-tela"></a>

### Conhecendo a Inbox

- **Objetivo:** Reconhecer as três partes da Inbox (lista, conversa e ficha do cliente) e abrir a primeira conversa.
- **Papel mínimo:** Administrador
- **Busca no curso:** inbox; caixa de entrada; conversas; tela principal; whatsapp; atendimento; ficha do cliente

1. **As três partes da tela** — `/app/inbox`  
   A Inbox é onde você lê e responde os clientes. À esquerda fica a lista de conversas, no meio aparece a conversa que você abrir e à direita fica a ficha do cliente. Quando você entra pelo menu, ela abre na aba Fila, que mostra quem está esperando por uma pessoa. Ao lado ficam as abas Automático (conversas que o atendimento automático está cuidando) e Minhas (as que estão com você). Na linha de baixo, as abas Todas, Fechadas e Arquivadas mostram todas as conversas, as já encerradas e as guardadas fora da fila.
   > 💡 No meio da tela aparece "Ou navegue com J e K": as teclas "j" e "k" passam para a próxima conversa e para a anterior. Você aprende esses atalhos na última lição.
2. **Começar uma conversa você mesmo**  
   O botão "Iniciar conversa", no alto da lista, serve para você mandar a primeira mensagem para um cliente, sem esperar que ele escreva. A conversa abre no seu nome e o atendimento automático não responde nela. A exceção é quando outro atendente já está cuidando daquele número: aí a conversa continua com ele. Para seguir, clique na conversa da Mariana Souza, a primeira da lista.
   > 💡 Só quem é atendente ou tem cargo acima vê este botão.
3. **Abrindo uma conversa**  
   Clique numa linha da lista para abrir a conversa no meio da tela. A linha aberta fica com o fundo destacado e uma barra colorida à esquerda. Um segundo e meio depois de abrir, o contador de mensagens não lidas some sozinho. Nesta conversa aparece o cartão "Por que a IA passou para você": é o resumo que o atendimento automático deixa quando passa o cliente para uma pessoa. O botão "Assumir e responder" do cartão passa a conversa para você; isso fica para a lição sobre assumir um cliente.
4. **O topo da conversa**  
   No topo aparecem o nome do cliente, um selo que diz se o atendimento está aberto ou já terminou e quem está cuidando dele agora: uma pessoa, o atendimento automático ou ninguém ("Sem responsável"). Ao lado do nome aparece também o número por onde o cliente chegou (aqui, "Recepção Bem Viver"). Os botões logo abaixo, como Assumir e Fechar, valem para esta conversa. No canto direito, abaixo dos botões, o aviso "Automático pausado" diz que o atendimento automático não responde nesta conversa. "Reservar serviço" marca um horário na agenda e "Marcar como pessoal" tira o contato da Inbox; os outros botões aparecem nas próximas lições.
5. **A ficha do cliente**  
   A coluna da direita é a ficha do cliente. No alto ficam o telefone e as etiquetas do cliente. Mais abaixo vêm as "Tags da conversa", que valem só para este atendimento, e as "Demandas abertas" (o que ele pediu e ainda não foi resolvido). Rolando a ficha para baixo aparecem os "Leads recentes" (os negócios dele no funil) e os "Pedidos recentes". Tudo sem você precisar sair da conversa. Os outros blocos, como "Sobre a empresa" e "Tarefas desta demanda", ficam para a lição sobre a ficha. Em telas largas de computador ela fica à vista (dá para escondê-la no botão "Recolher"); no celular, ela abre pelo botão "Ficha".
6. **Ajustar a largura da lista**  
   Para deixar a lista de conversas mais larga ou mais estreita, arraste a divisória entre a lista e a conversa. Dar dois cliques nela volta as colunas à largura padrão, e o navegador guarda a largura que você escolheu.
   > 💡 Com o foco na divisória, as setas ← e → do teclado também mudam a largura.

<a id="l-inbox--abas-e-sinais"></a>

### Entendendo a lista: abas, cores e contadores

- **Objetivo:** Saber o que cada aba mostra e ler de relance quem está cuidando de cada cliente, quem espera há mais tempo e quem tem mensagem nova.
- **Papel mínimo:** Administrador
- **Busca no curso:** abas; fila; automático; minhas; todas; fechadas; arquivadas; bolinha; não lidas; contador; quem está atendendo; posição na fila

1. **As seis abas** — `/app/inbox`  
   As abas separam as conversas: Automático (o robô está atendendo), Fila (esperando uma pessoa), Minhas (as suas que ainda estão abertas), Todas (todas as conversas, inclusive as fechadas e as arquivadas), Fechadas e Arquivadas. O número cinza ao lado de cada aba mostra quantas conversas há nela. Quando o número é zero, ele não aparece.
   > 💡 O número das abas se atualiza sozinho a cada 30 segundos.
2. **Quem espera há mais tempo**  
   Na Fila, quem espera há mais tempo fica em cima. Cada linha mostra a posição (1º, 2º…) e há quanto tempo o cliente aguarda resposta. A bolinha âmbar no canto de baixo, à esquerda, do círculo com as iniciais quer dizer "Aguardando atendente". O número em destaque à direita é a quantidade de mensagens que ainda não foram lidas.
   > 💡 Ao abrir a conversa, o contador de não lidas zera.
3. **O que o robô está atendendo**  
   A aba Automático mostra as conversas em que o atendimento automático está respondendo sozinho. Essas conversas aparecem com a bolinha roxa, que quer dizer "Automático atendendo". Nas outras abas, como a Todas, um ícone de robô antes da prévia da mensagem indica a mesma coisa.
4. **As suas conversas**  
   A aba Minhas lista as conversas que estão no seu nome e ainda estão abertas. A bolinha azul quer dizer "Em atendimento": uma pessoa da equipe está cuidando.
5. **Quem cuida e o que é grupo**  
   Na aba Todas aparecem selos nas linhas. "Grupo" marca um grupo de WhatsApp. O nome da pessoa da equipe diz quem cuida daquele cliente. Nesta clínica de exemplo, você é a Helena Prado (o "HP" no canto de cima). O ícone de robô antes da prévia da mensagem quer dizer que o atendimento automático está respondendo.
   > 💡 O nome da pessoa não aparece nas abas Fila, Automático e Minhas, nem quando todas as conversas da lista são da mesma pessoa.
6. **Selos de cuidado**  
   Mais abaixo na mesma lista aparecem outros dois selos. "Exemplo para a IA" marca uma conversa usada para ensinar o robô a responder. O ícone de brilho à direita de cada linha liga ou desliga esse selo: cheio e verde, está ligado; só o contorno, desligado. "Bloqueado" marca um cliente que pediu para não receber mais mensagens.
7. **Atendimentos encerrados**  
   A aba Fechadas guarda os atendimentos que já foram encerrados. A aba Arquivadas guarda o que você tirou da frente sem apagar. Uma conversa fechada ou arquivada sem responsável fica com a bolinha cinza clara. Ao passar o mouse sobre a bolinha de qualquer conversa fechada, aparece a palavra "Encerrada".
   > 💡 Uma conversa fechada que tem responsável continua com a bolinha azul, mas o texto dela diz "Encerrada".

<a id="l-inbox--achando-a-conversa"></a>

### Achando a conversa certa

- **Objetivo:** Usar a busca e os filtros (Não lidos, Grupos, etiquetas) e desfazer tudo quando a lista parecer vazia.
- **Papel mínimo:** Administrador
- **Busca no curso:** buscar; pesquisar; procurar cliente; filtro; não lidos; grupos; etiqueta; tag; todas as tags; limpar filtros; lista vazia

1. **Buscar pelo nome** — `/app/inbox?filter=all`  
   Digite o nome ou o telefone do cliente na busca. Aqui digitamos "Mari" e a lista já mostra a Mariana. A lista filtra logo depois que você para de digitar. A busca também encontra palavras da última mensagem da conversa, mas não das mensagens mais antigas.
   > 💡 Digite pelo menos 2 letras. Para buscar pelo telefone, digite pelo menos 4 números. A busca não muda o número ao lado de "Todas": ele continua contando a aba toda.
2. **Só o que ainda não foi lido**  
   O botão "Não lidos" liga e desliga um filtro. Quando está ligado, fica colorido, e a lista mostra só as conversas com mensagens que ninguém leu ainda.
   > 💡 Com "Não lidos" ligado, o número ao lado de cada aba também passa a contar só as conversas não lidas. Aqui, "Todas" mostra 4 em vez de 12. Como os números mudam de tamanho, as abas podem trocar de linha. O Inbox lembra o "Não lidos" e o número escolhido neste navegador: ao voltar, ele abre do jeito que você deixou, até você desligar o filtro.
3. **Só os grupos**  
   O botão "Grupos" mostra só as conversas de grupos de WhatsApp e esconde, por enquanto, as conversas com um cliente só.
   > 💡 O filtro "Grupos" não muda o número ao lado de "Todas" (continua 12): ele só esconde as outras conversas da lista. Um grupo só entra na Inbox depois de ligado em Conexões › Grupos, a partir da primeira mensagem que chegar depois disso.
4. **Filtrar por etiqueta**  
   Clique no botão "Todas as tags", logo abaixo da busca, e marque uma ou mais etiquetas, como "retorno" ou "convenio", para ver só os clientes marcados com elas. O menu fica aberto enquanto você marca. Se a lista for longa, use o campo "Buscar etiqueta" no topo do menu.
   > 💡 Com duas ou mais etiquetas marcadas, aparecem as opções "Todas (E)" (a conversa precisa ter todas) e "Qualquer uma (OU)" (basta ter uma).
5. **A lista filtrada**  
   Agora a lista mostra só os clientes com a etiqueta escolhida, e o botão passa a mostrar essa etiqueta em destaque. Na própria linha do cliente, as etiquetas aparecem em selos. Quando são mais de duas, as outras viram um "+1", "+2"… Repare que o número ao lado de "Todas" também caiu, para 1: a etiqueta muda a contagem das abas, assim como "Não lidos".
6. **Quando a lista fica vazia**  
   Aqui buscamos "Joa" com a etiqueta "retorno" ainda ligada. Nenhuma conversa combina com os dois ao mesmo tempo, então aparece "Nenhuma conversa com esses filtros" e, logo abaixo, os filtros que estão ligados ("Ativos: Busca · Etiqueta"). A caixa não está vazia: são os filtros que estão escondendo as conversas. O "1" ao lado de "Todas" é a Fernanda: ela tem a etiqueta, mas não combina com a busca "Joa". A busca não muda esse número.
7. **Limpar tudo**  
   "Limpar filtros" desliga de uma vez a busca, Não lidos, Grupos, as etiquetas e os demais filtros. O botão de etiqueta volta a dizer "Todas as tags", a lista volta inteira e você continua na mesma aba.
   > 💡 Os filtros se perdem quando você recarrega a página. Só a aba escolhida fica guardada.

<a id="l-inbox--lendo-o-historico"></a>

### Lendo o histórico da conversa

- **Objetivo:** Entender as mensagens: de quem é cada uma, se foi entregue e lida, quando falhou, e como achar ou citar uma mensagem antiga.
- **Papel mínimo:** Administrador
- **Busca no curso:** histórico; mensagens; enviada; entregue; lida; checks; falhou; IA respondeu; responder mensagem; citar; buscar na conversa

1. **Cliente à esquerda, empresa à direita** — `/app/inbox?id=be100000-0000-4000-8000-000000000005`  
   As mensagens do cliente ficam à esquerda, em cinza. As mensagens da empresa ficam à direita, na cor da marca. Pílulas como "Hoje" e "Ontem" separam os dias.
2. **Quem mandou cada mensagem**  
   Toda mensagem que sai da empresa mostra, em cima, quem a mandou: "IA", com um robozinho, para o atendimento automático; "Você" para o que você escreveu; "Atendente" para outra pessoa da equipe; e "Celular" quando alguém respondeu pelo WhatsApp do telefone. Lembretes e follow-ups automáticos aparecem como "Automação". Assim dá para saber o que o robô respondeu e o que foi escrito por uma pessoa.
3. **Enviada, entregue e lida**  
   Nas mensagens enviadas pela empresa, os tiques ao lado da hora mostram o caminho da mensagem: um tique quer dizer enviada, dois tiques cinza quer dizer entregue, e dois tiques azuis quer dizer que o cliente leu. Repare na cor: é ela que separa entregue de lida.
4. **Mensagem que não saiu**  
   Quando uma mensagem não sai, ela ganha uma borda vermelha e o selo "Falhou", ao lado da hora. Logo abaixo vem o motivo. Quando o sistema não sabe o motivo, aparece um aviso geral, como na foto. Nas mensagens escritas pela equipe costuma aparecer o botão "Tentar de novo", que manda a mesma mensagem outra vez. Quando há chance de ela já ter chegado ao cliente, o sistema pede confirmação antes. Se mandar de novo não resolveria, como num número sem WhatsApp, o botão não aparece. As respostas da IA não ganham esse botão: o próprio sistema tenta de novo.
5. **O menu de cada mensagem**  
   Passe o mouse sobre uma mensagem e clique na setinha "Opções da mensagem". Esse menu reúne as ações daquela mensagem, como responder a ela ou encaminhá-la para outra conversa. Nas mensagens do cliente, gestores e administradores também veem "Ocultar no CRM". Ele esconde a mensagem só aqui dentro: ela continua no WhatsApp do cliente.
   > 💡 No computador, a setinha só aparece quando o mouse passa sobre a mensagem. No celular, ela fica sempre à vista.
6. **Responder em cima de uma mensagem**  
   Com "Responder a esta mensagem", o trecho escolhido aparece acima do campo de escrever. Quando você envia uma resposta escrita, ela sai citando essa mensagem, como no WhatsApp. O X desfaz a escolha.
   > 💡 Arquivos enviados saem sem a citação.
7. **Buscar dentro da conversa**  
   A lupa no topo abre uma busca dentro da conversa. As mensagens que têm a palavra ganham um contorno, e um contador mostra quantas foram encontradas. A busca só olha as mensagens que já estão carregadas na tela, e as notas internas ficam de fora.
   > 💡 A tecla Esc fecha a busca. Em conversas longas, aparece no topo do histórico o botão "Carregar mais antigas": clique nele antes, para a busca alcançar mensagens mais antigas.

<a id="l-inbox--assumir-e-responder"></a>

### Assumir um cliente e preparar a resposta

- **Objetivo:** Pegar uma conversa que a IA passou para a equipe e montar a resposta com texto, respostas prontas e anexos.
- **Papel mínimo:** Administrador
- **Busca no curso:** assumir; pegar conversa; IA passou; passagem; responder; escrever mensagem; resposta pronta; respostas rápidas; atalho barra; anexar; enviar; sugerir resposta

1. **Por que a IA passou para você** — `/app/inbox`  
   Quando o atendimento automático entrega um cliente para a equipe, aparece este cartão dentro da conversa. Ele mostra o motivo da troca, o que o cliente quer, o que a IA já tentou, as últimas palavras dele e se ele já foi avisado de que uma pessoa vai assumir.
2. **Agora a conversa é sua**  
   Ao clicar em "Assumir e responder", a conversa passa para o seu nome. Ela sai da aba Fila e agora fica na aba Minhas. Por isso ela some da lista da esquerda, que continua mostrando a Fila: para achá-la de novo, clique em Minhas. O topo da conversa mostra você como responsável. O atendimento automático, que já tinha parado quando passou o cliente para a equipe, continua parado: o selo no topo diz "Automático pausado — alguém assumiu".
   > 💡 Antes de assumir, o botão "Assumir" no topo da conversa faz a mesma coisa. Depois que a conversa é sua, ali aparece "Liberar", para soltá-la.
3. **Escrever a resposta**  
   Escreva no campo de baixo. Quando está vazio, ele mostra "Escreva uma mensagem…". O Enter envia, e Shift + Enter pula uma linha sem enviar. O botão de avião, à direita, também envia. A estrelinha, entre o rosto e o campo, pede ao agente de IA uma sugestão de resposta. A sugestão aparece num quadro acima do campo, com "Aprovar e enviar" e "Rejeitar": nada sai sem o seu clique.
   > 💡 Com o campo vazio, no lugar do avião aparece o microfone, que serve para gravar áudio.
4. **Respostas prontas num clique**  
   Os botões logo acima do campo são as respostas rápidas da equipe. Um clique coloca o texto pronto no campo, no lugar do que estiver escrito, já com o primeiro nome do cliente, para você conferir antes de enviar. Nada é enviado sozinho.
   > 💡 As respostas rápidas são criadas no item "Respostas rápidas" do menu lateral. A aba "Nota interna", ao lado de "Responder", serve para escrever recados que só a equipe vê.
5. **O nome do cliente já vem trocado**  
   Depois do clique, o texto da resposta pronta fica no campo, já com "Mariana" no lugar do nome. Confira, ajuste se quiser e só então envie.
6. **Ou chame pelo atalho /**  
   Digitar uma barra (/) no começo do campo abre a lista das respostas prontas. Continue digitando, sem espaço, parte do nome (por exemplo /exame) ou o atalho cadastrado em Respostas rápidas (por exemplo /jejum). A lista filtra: na foto, /exame deixou só "Preparo para exame de sangue". Clique na que quiser.
   > 💡 O {{primeiro_nome}} que aparece na lista é trocado pelo primeiro nome do cliente quando você escolhe a resposta. Neste menu o Enter não escolhe: é preciso clicar. A tecla Esc fecha a lista.
7. **Anexar foto, documento ou contato**  
   O botão "+" abre as opções de anexo. Em "Fotos e vídeos" ou "Documento" você escolhe um arquivo, e a janela "Enviar anexo" mostra como ele vai ficar e deixa escrever uma legenda antes de enviar. "Contato" abre a janela "Enviar contato", onde você escolhe alguém da sua base ou digita nome e telefone.
   > 💡 Você também pode colar uma imagem copiada (Ctrl+V, ou Cmd+V no Mac) direto no campo de mensagem.

<a id="l-inbox--nota-interna"></a>

### Recados para a equipe com a nota interna

- **Objetivo:** Registrar um recado que só a equipe vê e chamar um colega com @.
- **Papel mínimo:** Administrador
- **Busca no curso:** nota interna; recado; anotação; só a equipe vê; mencionar; @; marcar colega; avisar colega

1. **O que é uma nota interna** — `/app/inbox?id=be100000-0000-4000-8000-000000000005`  
   As notas internas aparecem no meio da conversa, num balão amarelado, com o nome de quem escreveu e o aviso "Nota interna · só o time vê". Elas nunca chegam ao cliente e servem para combinar coisas com a equipe. A mensagem com borda vermelha logo acima é outro assunto: um envio que falhou, que se manda de novo em "Tentar de novo".
2. **Mudar para Nota interna**  
   Acima do campo de escrever há duas opções: "Responder" manda a mensagem para o cliente e "Nota interna" guarda um recado só para a equipe. Com a nota escolhida, o botão "Nota interna" fica colorido, o fundo em volta do campo fica amarelado e o campo passa a mostrar "Escreva uma nota interna… (só o time vê)". Os botões de respostas rápidas somem, porque elas são para o cliente.
3. **Chamar um colega com @**  
   Na nota, digite @ para abrir a lista da equipe e clique no colega. O seu próprio nome também aparece na lista. Quando a nota for salva, o colega recebe o aviso "Você foi mencionado": na tela, se estiver com o sistema aberto, e no celular ou computador, se tiver ativado as notificações.
   > 💡 Deixe um espaço antes do @. Você também pode digitar as primeiras letras do nome para filtrar a lista. O @ só chama a lista na nota interna. Ao responder o cliente, ele vira texto comum.
4. **Salvar a nota**  
   O nome do colega entra no texto. Aperte Enter, ou clique no aviãozinho ao lado, para salvar a nota. Para pular linha, use Shift+Enter.
5. **A nota no histórico**  
   A nota aparece no histórico com o seu nome e a hora, e a menção ao colega fica destacada. Ao passar o mouse sobre a nota, aparece uma lixeira no canto. Quem escreveu a nota, e também gestores e administradores, podem apagá-la por ela. A nota é apagada na hora, sem pedir confirmação.

<a id="l-inbox--passar-pausar-encerrar"></a>

### Pausar o robô, passar adiante e encerrar

- **Objetivo:** Controlar quem atende (pausar e devolver o automático, transferir), pedir um lembrete e encerrar, reabrir e arquivar um atendimento.
- **Papel mínimo:** Administrador
- **Busca no curso:** pausar robô; pausar IA; devolver ao automático; transferir; passar para colega; lembrete; lembrar; fechar conversa; encerrar; reabrir; arquivar

1. **Calar o robô numa conversa sua** — `/app/inbox?id=be100000-0000-4000-8000-000000000007`  
   Esta conversa já está no seu nome, mas o atendimento automático (o robô) ainda pode responder nela. O seu nome aparece logo abaixo do nome do cliente (nesta demonstração, Helena Prado). "Pausar o automático" faz o robô parar de responder nesta conversa, e o responsável continua o mesmo. O botão "Liberar", logo à esquerda, faz outra coisa: solta a conversa, que fica sem responsável.
   > 💡 Numa conversa sem responsável, o botão que cala o robô é o "Assumir".
2. **Devolver ao automático**  
   Com o robô pausado, aparece o aviso "Automático pausado — alguém assumiu", e o botão muda para "Devolver ao automático". Ao devolver, o robô volta a atender e a conversa fica sem responsável.
   > 💡 Se o robô estava parado para o cliente inteiro (isso acontece quando ele pediu para falar com uma pessoa), devolver religa o robô em todas as conversas desse cliente. Se a ficha do cliente estiver marcada como "Sempre atendimento humano", o sistema não deixa devolver.
3. **Transferir para um colega**  
   Ao devolver, a conversa ficou sem responsável: no topo, o botão voltou a ser "Assumir". "Transferir" passa a conversa para outra pessoa da equipe na hora, sem ela precisar aceitar. Escolha quem vai continuar e, se quiser, escreva o motivo: a troca fica registrada, e o motivo aparece no histórico do negócio desse cliente.
   > 💡 Transferir também faz o robô parar de responder nesta conversa.
4. **Pedir um lembrete** — `/app/inbox?id=be100000-0000-4000-8000-000000000005`  
   "Lembrar" serve para quando você está esperando o cliente responder. Escolha o prazo: se ele não responder até lá, a conversa sobe para o topo da lista e aparece um aviso na Central dizendo que o cliente não respondeu no prazo. Nada é enviado ao cliente. Nesta conversa o robô já estava pausado. O balão vermelho é uma mensagem que não saiu, e o quadro bege é um recado interno da equipe: nada disso tem a ver com o lembrete.
   > 💡 Com um lembrete ligado, o botão passa a dizer "Lembrete ativo", e é por ele que você cancela.
5. **Encerrar o atendimento**  
   Quando o assunto terminou, clique em "Fechar". Uma confirmação aparece antes de encerrar. Ela diz que dá para reabrir depois, mas nem sempre é preciso: se o cliente escrever de novo, a conversa reabre sozinha, sem responsável.
   > 💡 O lembrete marcado no passo anterior continua ligado. Se o prazo vencer com a conversa fechada, nada acontece. Se ela for reaberta antes, o lembrete volta a valer.
6. **Reabrir**  
   Depois de fechada, a conversa mostra o selo "Fechada", e o campo de mensagem fica travado: parece normal, mas não aceita texto. "Reabrir" começa um novo atendimento com o mesmo cliente, mas sem responsável: até alguém clicar em "Assumir", quem cuida dela é o atendimento automático.
7. **Arquivar sem apagar**  
   "Arquivar" tira a conversa da Fila e da aba Minhas e a guarda na aba Arquivadas (é o "histórico" de que a confirmação fala). Nada é apagado. Se a conversa ainda estava aberta, o atendimento é encerrado; se o cliente escrever de novo, ela volta, sem responsável.
   > 💡 O lembrete marcado antes continua ligado. Depois de reabrir, o botão no topo da conversa diz "Lembrete ativo", e é por ele que você cancela.

<a id="l-inbox--ficha-do-cliente"></a>

### A ficha do cliente ao lado da conversa

- **Objetivo:** Organizar o cliente sem sair da conversa: etiquetas, próximo passo da demanda e etapa no funil.
- **Papel mínimo:** Administrador
- **Busca no curso:** ficha; painel do contato; etiqueta; tag do contato; tag da conversa; demanda; próximo passo; funil; etapa; lead; recolher painel

1. **O que a ficha mostra** — `/app/inbox?filter=all&id=be100000-0000-4000-8000-000000000005`  
   No alto da ficha ficam o nome, o telefone e as etiquetas do cliente. Logo abaixo há atalhos: "Marcar compromisso" abre a Agenda já com este cliente escolhido, "Tags do contato" abre o editor de etiquetas, "Novo Lead" abre um negócio novo para ele no funil e "Ver contato" leva à ficha completa do cliente. A mensagem com borda vermelha na conversa é só um envio que falhou neste exemplo; ela não tem a ver com a ficha.
2. **Etiquetas da pessoa**  
   As "Tags do contato" acompanham o cliente em todas as conversas dele. Digite uma etiqueta nova e aperte Enter para adicionar. O X ao lado de uma etiqueta (aqui, o de "retorno") remove essa etiqueta. O botãozinho de paleta logo depois de cada etiqueta troca a cor dela.
   > 💡 Com o campo vazio, aparecem logo abaixo, com um "+", as etiquetas já usadas na clínica. Ao digitar, ficam só as que combinam com o texto; aqui nenhuma aparece porque nenhuma combina com "vip". Clicar numa delas abre a janela "Adicionar tag" para escolher a cor e grava a etiqueta com a mesma grafia, para todo mundo escrever igual.
3. **Etiquetas só deste atendimento**  
   Repare que "vip" já entrou nas etiquetas da pessoa. Já as "Tags da conversa" marcam só este atendimento, como o assunto tratado agora. Elas não ficam gravadas no cliente. Digite e aperte Enter, igual às etiquetas da pessoa. Enquanto você não aperta Enter, continua aparecendo "Sem tags.".
4. **O que o cliente pediu**  
   Em "Demandas abertas" fica cada pedido do cliente que ainda não foi resolvido, com a situação ("Aberta") e há quanto tempo está aberto. Quando ninguém combinou o que fazer, aparece a frase "Sem próximo passo definido". "Demanda vigente neste canal" é só um aviso, não um botão: mostra que esta é a demanda desta conversa. "Encerrar demanda" registra o resultado quando o pedido estiver resolvido. Clique em "Marcar próximo passo" para anotar o que vai acontecer a seguir.
5. **Anotar o próximo passo**  
   Escreva o que vai acontecer a seguir e clique em "Salvar" (ou aperte Enter).
   > 💡 O botão "Salvar" só funciona depois de pelo menos 3 letras.
6. **Próximo passo anotado**  
   Depois de salvar, a demanda mostra o próximo passo no lugar de "Sem próximo passo definido", e o botão "Marcar próximo passo" some. Assim a equipe toda vê o que falta fazer.
7. **O cliente no funil**  
   Em "Leads recentes" (lead é o negócio aberto com este cliente) aparecem o nome do negócio e, logo abaixo, o funil e a etapa em que ele está. "Etapa do funil" muda a etapa sem sair da conversa, e "Abrir no funil" abre o quadro do funil já com os detalhes deste negócio na tela. "Levar para outro funil" muda o negócio de funil, não só de etapa. A frase "Este funil não tem campos extras." só avisa que este funil não pede informações a mais. "Tarefas desta demanda" e "Memória do contato", mais acima, são outras partes da ficha. Para continuar, clique em "Recolher", no alto da ficha.
   > 💡 Se você escolher uma etapa de perda, o sistema pede o motivo antes de mover.
8. **Recolher a ficha**  
   "Recolher" esconde a ficha e dá mais espaço para a conversa. Este navegador lembra a escolha nas próximas visitas. Para abrir a ficha de novo, clique no botão com setas duplas (») no alto da borda direita.

<a id="l-inbox--atalhos-e-lote"></a>

### Trabalhar mais rápido: atalhos e ações em lote

- **Objetivo:** Navegar pelo teclado e resolver várias conversas de uma vez.
- **Papel mínimo:** Administrador
- **Busca no curso:** atalhos; teclado; J K; próxima conversa; selecionar várias; em lote; marcar como lida; arquivar várias; transferir várias

1. **Cinco letras que economizam cliques** — `/app/inbox?filter=all`  
   Com a Inbox aberta e o cursor fora de qualquer campo de texto, cinco teclas fazem o trabalho do mouse: "j" abre a próxima conversa da lista, "k" volta para a anterior, "r" leva o cursor ao campo de resposta, "a" assume a conversa aberta e "e" fecha a conversa aberta. Só o "e" pergunta antes de agir ("Fechar conversa?").
   > 💡 Os atalhos não funcionam enquanto o cursor está dentro de um campo de texto. Clique fora dele antes de usar. Aperte "?" para ver a lista de atalhos.
2. **Andar pela lista com J e K**  
   Aperte "j" para abrir a próxima conversa da lista e "k" para voltar à anterior, sem usar o mouse. Se nenhuma conversa estiver aberta, o "j" abre a primeira da lista. Atenção: abrir uma conversa a marca como lida em poucos segundos.
3. **Marcar várias conversas**  
   A caixinha à esquerda de cada linha marca a conversa sem abri-la. Assim que uma é marcada, aparece acima da lista a barra de ações em lote, com a quantidade de conversas selecionadas. Aqui marcamos as conversas do Roberto e da Mariana. A conversa do Pedro, aberta no meio da tela, também fica com o fundo verde-claro, mas não entra no lote: a caixinha dela está vazia. Só contam as caixinhas marcadas, por isso a barra diz "2 conversas selecionadas".
   > 💡 "Selecionar todas" marca todas as conversas que estão na lista agora (na aba Todas, inclusive as fechadas e as arquivadas) e só acrescenta à seleção. Para desmarcar tudo, use o X no fim da barra.
4. **Mais ações**  
   Em "Mais ações" ficam Arquivar, Pausar IA, Devolver ao automático e "Transferir para…". Cada conversa marcada recebe a ação como se você a fizesse uma por uma. Pausar IA desliga o atendimento automático e, se a conversa não tiver responsável, você passa a ser o responsável. Devolver ao automático tira o responsável e deixa a IA atender de novo.
   > 💡 Arquivar, Pausar IA e Devolver ao automático acontecem na hora, sem pedir confirmação. "Transferir para…" abre uma janela para escolher o colega e, se quiser, escrever o motivo; só transfere quando você confirma em Transferir. Se alguma conversa não puder receber a ação, o aviso no fim diz quantas foram recusadas e o motivo.
5. **Marcar todas como lidas**  
   "Marcar como lida" zera o contador de não lidas de todas as conversas marcadas. No fim, aparece o aviso "2 conversas atualizadas." e a seleção é desfeita. O "Fechar" da barra, ao lado de "2 conversas selecionadas", encerra todas as marcadas de uma vez e, ao contrário da tecla "e", não pede confirmação. Não confunda com o "Fechar" do topo da conversa aberta: esse fecha só a conversa do Pedro.

---

<a id="m-radar"></a>

## Radar

**Tela:** `/app/radar`  
**Resumo:** A lista dos clientes que esfriaram e ainda estão em aberto, para você agir antes de perder a venda.

**Lições:** [Lendo o Radar](#l-radar--lendo-o-radar) · [Quem está cuidando de cada cliente](#l-radar--quem-esta-cuidando) · [Assumir um cliente pelo Radar](#l-radar--assumir-pelo-radar) · [Para onde cada linha leva](#l-radar--abrindo-o-negocio) · [Demandas sem próximo passo](#l-radar--sem-proximo-passo)

<a id="l-radar--lendo-o-radar"></a>

### Lendo o Radar

- **Objetivo:** Entender o que entra no Radar e o que querem dizer Crítico, Em risco e Em voo.
- **Papel mínimo:** Administrador
- **Busca no curso:** radar; cliente esfriou; parado; sem resposta; crítico; em risco; em voo; venda parada

1. **O que aparece aqui** — `/app/radar`  
   O Radar mostra os negócios ainda abertos no funil em que ninguém mexeu nem falou com o cliente há mais de 24 horas. Mensagem do cliente não conta: cliente escrevendo e ninguém respondendo é justamente o risco. As três etiquetas no alto contam quantos negócios estão em cada nível. O quadro amarelo acima delas é outra lista, a dos clientes esperando sem nada combinado; ele tem uma lição só para ele, "Demandas sem próximo passo".
   > 💡 A lista se atualiza sozinha a cada minuto.
2. **Crítico: parado há 3 dias ou mais**  
   Cada linha é um negócio: o nome dele, o cliente e há quanto tempo está parado. "Crítico" quer dizer 3 dias ou mais sem ninguém agir. O aviso "Sem próximo passo agendado" diz que não há nenhum retorno do assistente nem compromisso marcado com esse cliente. Os críticos ficam no topo e, dentro de cada nível, o mais esquecido vem primeiro.
3. **Em risco: entre 1 e 3 dias**  
   "Em risco" é o negócio parado há mais de 24 horas e menos de 3 dias. Ainda dá tempo de retomar com calma, mas ele vira crítico se continuar esquecido.
4. **Em voo: o assistente vai voltar a falar**  
   "Em voo" é o negócio parado, mas com um retorno já marcado pelo assistente. A linha mostra quando ele pretende voltar a falar com o cliente, como "Assistente retorna em 2d". Ele não está esquecido: só fique de olho, porque o retorno só sai se o WhatsApp estiver conectado e o assistente estiver ligado.
   > 💡 O prazo de 24 horas pode mudar por etapa do funil. Abra "Ver tudo em CRM" no menu e depois "Etapas do funil": cada etapa tem a "Janela de esfriando". Com 48 horas, por exemplo, o negócio só fica crítico depois de 6 dias.

<a id="l-radar--quem-esta-cuidando"></a>

### Quem está cuidando de cada cliente

- **Objetivo:** Saber, pela linha do Radar, se o negócio tem alguém cuidando ou se está largado.
- **Papel mínimo:** Administrador
- **Busca no curso:** quem cuida do cliente; sem dono; com atendente; responsável; agente de IA; assistente

1. **Quatro situações** — `/app/radar`  
   No fim da segunda linha de cada negócio aparece quem cuida dele. "Sem dono": ninguém. "Com atendente": uma pessoa da equipe. "Assistente na conversa": o atendimento automático está respondendo esse cliente. "Agente:" seguido de um nome: o negócio é de um agente de IA.
2. **Quando aparece o botão "Assumir"**  
   O botão "Assumir" aparece quando o cliente tem conversa no WhatsApp e nem a conversa nem o negócio estão com uma pessoa da equipe. Na Sandra, ninguém cuida. Na Renata, quem responde é o atendimento automático. No Gustavo, o negócio é do agente de IA: assumir traz a conversa para você e cala o atendimento automático nela, mas o negócio continua em nome do agente. No Paulo não aparece, porque ele já está com uma atendente. No Marcos também não: ele ainda não conversou pelo WhatsApp.

<a id="l-radar--assumir-pelo-radar"></a>

### Assumir um cliente pelo Radar

- **Objetivo:** Trazer para você um cliente esquecido e ir direto para a conversa com ele.
- **Papel mínimo:** Administrador
- **Busca no curso:** assumir cliente; pegar atendimento; resgatar cliente; cliente esquecido; responder cliente parado

1. **Clique em "Assumir"** — `/app/radar`  
   A Sandra está crítica e ninguém cuida dela. Clique em "Assumir" na linha dela para trazer a conversa para você.
2. **Agora a conversa é sua**  
   A linha passa a mostrar "Com atendente" e o botão some. A conversa fica com você e o atendimento automático para de responder nela. Se o negócio não tinha responsável, você passa a ser o responsável. A Sandra continua no Radar até alguém falar com ela. Para responder, clique no nome do negócio.
3. **A conversa da Sandra**  
   A Inbox abre na conversa com a Sandra. No alto, "Automático pausado — alguém assumiu" confirma que o assistente parou de responder, e o seu nome aparece abaixo do dela. Leia o que já foi dito e responda.

<a id="l-radar--abrindo-o-negocio"></a>

### Para onde cada linha leva

- **Objetivo:** Saber o que abre quando você clica num negócio do Radar, com e sem conversa no WhatsApp.
- **Papel mínimo:** Administrador
- **Busca no curso:** abrir negócio; abrir conversa; ver cliente; clicar no radar; cliente sem conversa; funil

1. **Cliente com conversa** — `/app/radar`  
   Clique na linha, fora do botão "Assumir", para abrir o cliente. Quando ele já conversou pelo WhatsApp, como a Renata, a Inbox abre direto na conversa dela.
2. **A conversa da Renata**  
   Aqui está a conversa com a Renata. A última mensagem foi do assistente, há 30 horas, e ela não respondeu. O botão "Assumir" no alto também existe aqui, para tirar a conversa do automático. Para voltar ao Radar, use o item "Radar" no menu da esquerda.
3. **Cliente sem conversa** — `/app/radar`  
   O Marcos ainda não conversou pelo WhatsApp. Por isso a linha dele não tem "Assumir". Clique nela para abrir o negócio no funil.
4. **O negócio no funil**  
   O funil abre com os detalhes do negócio do Marcos na tela: valor, etapa, responsável e os dados do contato. Daqui você edita o negócio sem procurá-lo no quadro. Como ele ainda não conversou, "Abrir conversa no Inbox" cria a conversa com ele e leva você até ela, sem mandar nenhuma mensagem.

<a id="l-radar--sem-proximo-passo"></a>

### Demandas sem próximo passo

- **Objetivo:** Achar o cliente que espera sem nada combinado e tirá-lo do Radar anotando o próximo passo.
- **Papel mínimo:** Administrador
- **Busca no curso:** sem próximo passo; demanda aberta; cliente esperando; nada combinado; quadro amarelo; próximo passo

1. **O quadro amarelo** — `/app/radar`  
   O quadro amarelo no alto lista os clientes com um pedido em aberto em que ninguém anotou o que acontece a seguir. Na mesma linha, à direita, aparece há quantas horas o pedido está aberto. Clique no nome para abrir a conversa.
   > 💡 Se a sua empresa usa Propostas, podem aparecer ali mais dois quadros: propostas vencidas sem retomada e propostas esperando revisão.
2. **O pedido da Fernanda**  
   A Inbox abre na conversa da Fernanda. Na ficha do cliente, à direita, "Demandas abertas" mostra o pedido dela com a frase "Sem próximo passo definido". Clique em "Marcar próximo passo". A mensagem com borda vermelha na conversa é outro assunto: um envio que falhou, que se manda de novo em "Tentar de novo".
3. **Escreva o que vem a seguir**  
   Escreva o que vai acontecer a seguir e clique em "Salvar".
4. **Próximo passo anotado**  
   A demanda agora mostra o próximo passo. Volte ao Radar pelo item "Radar" do menu da esquerda.
5. **A Fernanda saiu do quadro** — `/app/radar`  
   De volta ao Radar, a Fernanda sai do quadro amarelo: ela já tem um próximo passo anotado. Se ela ainda aparecer, espere até um minuto ou atualize a página. Os negócios parados continuam na lista até alguém agir em cada um: anotar o próximo passo da demanda não tira o negócio da lista.

---

<a id="m-agenda"></a>

## Agenda

**Tela:** `/app/agenda`  
**Resumo:** Onde ficam as consultas, sessões e reuniões da equipe: ver a semana, marcar, remarcar, cancelar e registrar quem veio.

**Lições:** [Conhecendo a Agenda](#l-agenda--conhecendo-a-agenda) · [A agenda de cada pessoa da equipe](#l-agenda--agenda-de-cada-pessoa) · [A lista de compromissos](#l-agenda--lista-de-compromissos) · [Os detalhes de um compromisso](#l-agenda--detalhes-do-compromisso) · [Marcar um novo agendamento](#l-agenda--novo-agendamento) · [Marcar direto na grade](#l-agenda--marcar-pela-grade) · [Remarcar e cancelar](#l-agenda--remarcar-e-cancelar)

<a id="l-agenda--conhecendo-a-agenda"></a>

### Conhecendo a Agenda

- **Objetivo:** Reconhecer as partes da Agenda e andar pelos dias, semanas e meses.
- **Papel mínimo:** Administrador
- **Busca no curso:** agenda; agendamentos; calendário; compromissos; consultas marcadas; semana; mês; dia; hoje

1. **As partes da tela** — `/app/agenda?tipo=be310000-0000-4000-8000-000000000001`  
   A Agenda mostra os compromissos da clínica: consultas, sessões e reuniões da equipe. Abaixo do título "Agendamentos" ficam as setas para mudar de semana e os botões de visão. Logo depois vem a lista de compromissos, separada em abas, e mais abaixo a grade da semana, com um bloco colorido para cada compromisso. No topo, o quadro "Sincronizar com o Google ainda não está disponível" aparece enquanto a instalação não tem a ligação com o Google cadastrada. A Agenda funciona normalmente sem ela; só não troca compromissos com a agenda do Google.
   > 💡 Quem administra a instalação vê o link "Cadastrar as credenciais do Google". O resto do quadro, com o endereço de retorno, é para essa pessoa e pode ser ignorado por quem só usa a Agenda. Na sua instalação, o endereço mostra o seu domínio; na foto aparece o desta demonstração (127.0.0.1). Depois do cadastro, o quadro troca pelo botão "Conectar Google".
2. **Andar pelas semanas**  
   As setas ao lado da data mudam o período: a da esquerda volta e a da direita avança. Na visão de semana, cada clique anda uma semana inteira. O texto ao lado das setas mostra o período que está na tela, de domingo a sábado. O botão "Hoje" volta para o dia de hoje, de onde você estiver.
3. **Ver um dia só**  
   Os botões "Dia", "Semana" e "Mês" trocam o tamanho do período. Em "Dia", a grade mostra só um dia, com mais espaço para cada compromisso, e as setas passam a andar um dia por vez. No celular, a Agenda já abre nesta visão.
4. **Ver o mês inteiro**  
   Em "Mês", cada quadrado é um dia. Dentro dele aparecem até dois compromissos, com a hora e o nome, na cor de quem atende. Quando o dia tem mais, aparece no canto quantos ficaram de fora, como "+1". É o jeito de ver de longe quais dias estão cheios. Para voltar à grade de horários, clique em "Semana", no alto, ao lado de "Dia".

<a id="l-agenda--agenda-de-cada-pessoa"></a>

### A agenda de cada pessoa da equipe

- **Objetivo:** Saber de quem é cada compromisso e ver a agenda de uma pessoa só.
- **Papel mínimo:** Administrador
- **Busca no curso:** agenda da equipe; agenda de um profissional; filtrar por pessoa; cores; quem atende; agenda da Ana; ver só uma pessoa

1. **Cada pessoa tem uma cor** — `/app/agenda?tipo=be310000-0000-4000-8000-000000000001`  
   As bolinhas com as iniciais, ao lado dos botões "Dia", "Semana" e "Mês", são as pessoas da equipe. Cada pessoa tem uma cor, e os compromissos dela aparecem na grade e na lista com essa cor. Aqui estão a Helena Prado, a Ana Ribeiro, da fisioterapia, e o Carlos Mendes, da odontologia.
2. **Ver só a agenda de uma pessoa**  
   Clique na bolinha de uma pessoa para ver só a agenda dela. A grade e a lista passam a mostrar apenas os compromissos da Ana, a bolinha dela sobe um pouco e as outras ficam cinza. Ao lado aparece o botão "Todos".
3. **Voltar a ver a equipe inteira**  
   Para ver de novo a agenda de todos, clique em "Todos" ou outra vez na bolinha da pessoa escolhida. A grade volta a mostrar os compromissos da equipe inteira, cada um na cor de quem atende.

<a id="l-agenda--lista-de-compromissos"></a>

### A lista de compromissos

- **Objetivo:** Usar as abas da lista para ver o que vem pela frente, aprovar horários e registrar quem veio.
- **Papel mínimo:** Administrador
- **Busca no curso:** próximos compromissos; aguardando confirmação; confirmar horário; passados; realizado; faltou; não compareceu; cancelados; histórico

1. **As quatro abas** — `/app/agenda?tipo=be310000-0000-4000-8000-000000000001`  
   A lista fica logo acima da grade e tem quatro abas: "Próximos", "Aguardando confirmação", "Passados" e "Cancelados". O número em cada aba diz quantos compromissos ela tem. A lista acompanha o período que está na tela: aqui avançamos uma semana com a seta da direita, para ver o que vem pela frente. Em cada linha aparecem o dia, o horário, o nome do cliente (ou o nome do compromisso, quando não há cliente), quem vai atender e a situação.
   > 💡 Clique no nome da linha para abrir os detalhes do compromisso.
2. **Aprovar um horário**  
   Em "Aguardando confirmação" ficam os horários reservados que ainda precisam de um sim da clínica. Isso acontece nos tipos de atendimento em que uma pessoa aprova cada horário. O botão "Confirmar" aprova o horário, e ele passa para "Próximos".
3. **O que já passou**  
   "Passados" mostra o que já aconteceu no período. Aqui voltamos para a semana passada, clicando duas vezes na seta da esquerda. Como a semana já passou, a grade avisa que não há horário livre. O selo diz o resultado: "Realizado" quando o paciente veio e "Não compareceu" quando faltou. Os que ainda estão como "Confirmado" esperam alguém da equipe dizer o que houve, com os botões "Realizado" e "Faltou".
4. **Registrar que o paciente veio**  
   Ao clicar em "Realizado", aparece o aviso "Marcado como realizado." e, em instantes, o selo da linha muda e os botões somem. Só dá para registrar presença ou falta depois que o horário começou.
5. **Os cancelados**  
   Em "Cancelados" ficam os horários desmarcados. Eles saem da grade, para o horário ficar livre de novo, mas continuam aqui para consulta.

<a id="l-agenda--detalhes-do-compromisso"></a>

### Os detalhes de um compromisso

- **Objetivo:** Abrir um compromisso e entender o que cada parte do painel mostra.
- **Papel mínimo:** Administrador
- **Busca no curso:** abrir compromisso; detalhes da consulta; observação; anotação; local do atendimento; compareceu; faltou; lembrar em uma hora; motivo do cancelamento

1. **Abrir pelo bloco da grade** — `/app/agenda?tipo=be310000-0000-4000-8000-000000000001`  
   Clique num bloco da grade para abrir os detalhes daquele compromisso. Todo bloco mostra o nome; os mais compridos mostram também o horário de início. Aqui vamos abrir a reunião de equipe de quarta-feira.
2. **O que o painel mostra**  
   Os detalhes abrem na lateral: o nome do compromisso, o dia e o horário, o local e a observação. A "Anotação" é um recado interno, para quem vai atender. Logo abaixo vem a situação (aqui, "Agendado", que é o mesmo que aparece como "Confirmado" na lista) e com quem é. Esta reunião não tem cliente, por isso aparece "Compromisso pessoal, sem cliente vinculado.". Quando há um cliente, no lugar aparece o link "Ver contato", que abre a ficha dele.
   > 💡 O quadro "Sincronização Google", no alto do painel, aparece em todo compromisso. Enquanto a agenda do Google não estiver conectada, ele pode dizer "Ainda não publicado no Google." ou "Há alterações aguardando sincronização.", com o botão "Tentar sincronizar novamente". Pode ignorar: o compromisso fica só aqui na Agenda.
3. **As ações do compromisso**  
   Mais abaixo ficam as ações. "Compareceu" e "Faltou" registram o que aconteceu, e só funcionam depois que o horário começou. Quando o compromisso tem cliente e ele avisou por mensagem, escolha a mensagem dele em "Mensagem do cliente usada como evidência (opcional)" antes de clicar. "Lembrar em uma hora" adia por uma hora o aviso que pede à equipe para registrar a presença. Para desmarcar, escreva o motivo, com pelo menos 3 letras, em "Motivo do cancelamento" e clique em "Cancelar agendamento".

<a id="l-agenda--novo-agendamento"></a>

### Marcar um novo agendamento

- **Objetivo:** Marcar um horário para um cliente pelo botão Novo agendamento.
- **Papel mínimo:** Administrador
- **Busca no curso:** marcar consulta; novo agendamento; agendar cliente; marcar horário; escolher dia; horários livres; convidado; endereço; observação

1. **O botão Novo agendamento** — `/app/agenda?tipo=be310000-0000-4000-8000-000000000001`  
   O botão "Novo agendamento", no alto à direita, abre o painel para marcar um horário. Ele só aparece para quem é atendente ou tem cargo acima, e fica apagado enquanto não houver nenhum tipo de agendamento cadastrado.
2. **Os dados do compromisso**  
   O painel abre na lateral. Em cima ficam os dados do compromisso: "Quem será atendido", o "Tipo de agendamento", o "E-mail do convidado", o "Endereço" e a "Observação". Escolha o tipo pelos botões (eles aparecem quando a clínica tem mais de um tipo); cada um mostra a duração. O endereço já vem com o do tipo escolhido, e dá para trocar. Se "Quem será atendido" ficar em branco, o compromisso é pessoal, sem cliente.
   > 💡 O convite por e-mail só sai quando quem atende conectou a agenda do Google. Aí o cliente com e-mail na ficha já é convidado, e o "E-mail do convidado" serve para chamar mais alguém, como um acompanhante. Sem o Google conectado, ninguém recebe convite por e-mail.
3. **Escolher o cliente**  
   Clique em "Quem será atendido" e digite o nome do cliente. A lista mostra os contatos que combinam; clique no certo. Quando nenhum contato combina com o que você digitou, a lista oferece "Criar" com esse nome, para cadastrar o cliente ali mesmo. A primeira opção, "Compromisso pessoal, sem cliente", serve para marcar um horário sem cliente, como uma reunião.
4. **O resumo e o calendário**  
   Com o cliente escolhido, aparece "Conversa vinculada (opcional)", para ligar o compromisso a uma conversa dele. Mais abaixo, à esquerda, o painel resume o atendimento: quem atende, o tipo, a duração e o local. No calendário ao lado, os dias com horário livre ficam coloridos. Clique num deles.
5. **Escolher o horário e confirmar**  
   Os horários livres do dia aparecem à direita. Clique no que quiser e aparece o resumo com o dia e a hora. O compromisso só é marcado quando você clica em "Confirmar". Depois disso, o painel mostra "Marcado." e o botão "Ver na agenda".
   > 💡 Precisa de um horário que não está na lista? "Outro horário" deixa digitar a hora. Vale fora dos horários publicados; a agenda só recusa se o horário já estiver ocupado.

<a id="l-agenda--marcar-pela-grade"></a>

### Marcar direto na grade

- **Objetivo:** Escolher o tipo de atendimento e marcar clicando num horário livre da grade.
- **Papel mínimo:** Administrador
- **Busca no curso:** clicar na grade; horário livre; marcar rápido; horários livres de; tipo de atendimento; jornada; expediente; semana que vem

1. **Horários livres de qual tipo** — `/app/agenda?tipo=be310000-0000-4000-8000-000000000001`  
   Logo acima da grade fica a linha "Horários livres de", com um botão para cada tipo de agendamento. O tipo escolhido decide quais horários a grade oferece: a duração dele e o expediente de quem atende. Aqui está escolhida a "Sessão de fisioterapia", que é da Ana. Quando não sobra horário livre no período, aparece o aviso "Nenhum horário livre neste período.". E, se quem atende ainda não publicou o expediente, o aviso é "A jornada de atendimento ainda não foi publicada.".
2. **Achar um horário livre**  
   Avançamos uma semana: ali a Ana ainda tem muitos horários livres. Passe o mouse na grade: o horário livre que está embaixo do mouse fica colorido e o cursor vira a mãozinha de clique. Os espaços fora do expediente e os horários já ocupados não mudam de cor nem respondem ao clique.
3. **O painel já vem com a hora**  
   Clique no horário livre e o painel de marcação abre com esse dia e essa hora já escolhidos. Preencha "Quem será atendido" no alto do painel, se for um cliente, e clique em "Confirmar".

<a id="l-agenda--remarcar-e-cancelar"></a>

### Remarcar e cancelar

- **Objetivo:** Mudar o horário de um compromisso e desmarcar com motivo.
- **Papel mínimo:** Administrador
- **Busca no curso:** remarcar consulta; mudar horário; trocar dia; cancelar consulta; desmarcar; motivo do cancelamento; arrastar compromisso

1. **Remarcar e Cancelar na lista** — `/app/agenda?tipo=be310000-0000-4000-8000-000000000001`  
   Na aba "Próximos" da lista, cada compromisso tem os botões "Remarcar" e "Cancelar". Avançamos para a semana que vem e vamos remarcar a sessão de fisioterapia do Roberto Almeida.
2. **Escolher o novo horário**  
   Abre o painel "Remarcar agendamento", com o mesmo calendário de marcar. Escolha o novo dia e o novo horário e clique em "Confirmar". O compromisso muda de lugar e continua com o mesmo cliente, o mesmo tipo e a mesma pessoa que atende.
   > 💡 Antes de clicar em "Remarcar", confira se "Horários livres de", acima da grade, está no tipo do compromisso: os horários oferecidos seguem esse tipo. Para remarcar uma consulta do Carlos, escolha antes "Consulta odontológica" ali. Trocar o tipo dentro do painel não muda o tipo do compromisso. Também dá para arrastar o bloco na grade até outro horário: a Agenda pergunta antes de remarcar.
3. **Cancelar com motivo**  
   Para desmarcar, clique em "Cancelar" na linha do compromisso. Aqui vamos desmarcar a sessão da Camila Rocha de quarta-feira. O painel pede o motivo, que é obrigatório: escreva pelo menos 3 letras e o botão "Cancelar agendamento" acende. O horário volta a ficar livre e o compromisso vai para a aba "Cancelados". "Voltar" fecha o painel sem cancelar nada.

---

<a id="m-respostas-rapidas"></a>

## Respostas rápidas

**Tela:** `/app/templates`  
**Resumo:** Textos, imagens e áudios prontos que você e a equipe usam na Inbox com um clique, para não digitar a mesma coisa toda vez.

**Lições:** [Conhecendo as respostas rápidas](#l-respostas-rapidas--conhecendo-respostas-rapidas) · [Criar uma resposta rápida](#l-respostas-rapidas--criar-resposta) · [Respostas com imagem ou áudio](#l-respostas-rapidas--imagem-e-audio) · [Editar, mudar a ordem e excluir](#l-respostas-rapidas--editar-ordenar-excluir) · [O que o atendente vê](#l-respostas-rapidas--visao-do-atendente)

<a id="l-respostas-rapidas--conhecendo-respostas-rapidas"></a>

### Conhecendo as respostas rápidas

- **Objetivo:** Entender o que cada linha da lista mostra: de quem é a resposta, se leva imagem ou áudio e o que dá para fazer com ela.
- **Papel mínimo:** Administrador
- **Busca no curso:** respostas rápidas; mensagens prontas; textos salvos; modelos de mensagem; scripts de atendimento; resposta padrão; onde ficam as respostas prontas

1. **A lista de respostas prontas** — `/app/templates`  
   Respostas rápidas são mensagens que você salva uma vez e usa sempre que precisar, sem digitar de novo: horários, endereço, preparo para exame. Cada linha mostra o nome da resposta e o começo do texto. Elas aparecem na Inbox, logo acima do campo de mensagem, na mesma ordem desta lista.
2. **Da equipe ou só sua**  
   O selo ao lado do nome diz de quem é a resposta. "Compartilhado" é da equipe: todos usam. "Pessoal" é só de quem criou: aqui, a "Confirmação de consulta" é da Helena, que é quem está usando o sistema nesta tela, e só ela pode mudá-la. Os colegas não veem as respostas pessoais uns dos outros.
   > 💡 A conta que instalou o sistema é a exceção: ela vê também as respostas pessoais dos colegas, na lista e nos botões da Inbox, com o selo "Pessoal" e sem lápis nem lixeira.
3. **Respostas com imagem ou áudio**  
   Uma resposta rápida pode levar imagens junto com o texto, ou ser só um áudio. O selo "Imagens" mostra quantas imagens ela leva. O selo "🎧 Áudio" marca a resposta que é um áudio gravado; no lugar do texto aparece "Resposta rápida de áudio".
4. **Os botões de cada linha**  
   À direita de cada linha ficam o lápis, que abre a resposta para editar, e a lixeira, que apaga. Os pontinhos à esquerda servem para mudar a ordem: clique neles e arraste a linha para cima ou para baixo. Esses botões só aparecem nas respostas que você pode mudar.
   > 💡 Quem é atendente vê os botões só nas respostas pessoais dele. As compartilhadas só gerente e administrador mudam.

<a id="l-respostas-rapidas--criar-resposta"></a>

### Criar uma resposta rápida

- **Objetivo:** Salvar um texto pronto, com o nome do cliente trocado sozinho, e encontrá-lo na Inbox.
- **Papel mínimo:** Administrador
- **Busca no curso:** criar resposta rápida; nova mensagem pronta; salvar texto para reutilizar; colocar nome do cliente na mensagem; atalho de mensagem; compartilhar resposta com a equipe

1. **Começar uma nova** — `/app/templates`  
   Clique em "Nova resposta rápida", no alto da tela. Abre uma janela para escrever a resposta.
2. **Nome e mensagem**  
   Em "Título" vai o nome curto que aparece no botão da Inbox. Em "Mensagem" vai o texto que o cliente vai receber. Escreva {{primeiro_nome}} onde quiser o primeiro nome do cliente, ou {{nome}} para o nome completo: na Inbox, ele é trocado sozinho pelo nome de quem está na conversa.
   > 💡 Se a Inbox não souber o nome do cliente (nem no cadastro, nem no WhatsApp), o {{primeiro_nome}} fica escrito do jeito que está, aparece um aviso amarelo e o envio fica travado até você apagar ou trocar essa parte. Para não depender do nome, escreva um texto de reserva depois de uma barra: com {{primeiro_nome\|"cliente"}}, a palavra "cliente" entra quando o nome falta.
3. **Atalho e equipe**  
   O "Atalho (opcional)" é uma palavra curta para achar a resposta rápido: na Inbox, com o campo de mensagem vazio, digite / e o atalho (aqui, /pix) e clique na resposta que aparece na lista. Ligue "Compartilhar com a equipe" para todos usarem a resposta; desligado, ela fica só para você. Depois de criada, isso não muda mais. No fim, clique em "Criar resposta rápida".
   > 💡 Só gerente e administrador veem a opção de compartilhar. O que um atendente cria é sempre pessoal.
4. **A resposta nova entra no topo**  
   Ao clicar em "Criar resposta rápida", a janela fecha e a resposta aparece no alto da lista, com o selo "Compartilhado". Toda resposta nova entra em primeiro lugar; para mudar a posição, arraste-a pelos pontinhos.
5. **Pronta para usar na Inbox** — `/app/inbox`  
   Abra uma conversa na Inbox: a resposta nova já está entre os botões acima do campo de mensagem. Um clique coloca o texto no campo, com o nome do cliente já trocado. Atenção: ele substitui o que você já tinha escrito. Nada é enviado sem você conferir e clicar em enviar. Se os botões estiverem apagados, a conversa ainda não pode receber resposta (por exemplo, falta assumi-la).

<a id="l-respostas-rapidas--imagem-e-audio"></a>

### Respostas com imagem ou áudio

- **Objetivo:** Saber como pôr imagens numa resposta rápida, criar uma resposta de áudio e conferir o que já está salvo.
- **Papel mínimo:** Administrador
- **Busca no curso:** resposta rápida com imagem; mandar foto pronta; resposta de áudio; áudio pronto para o cliente; anexar imagem na resposta; formato de áudio aceito

1. **Imagens junto com o texto** — `/app/templates`  
   Na janela "Nova resposta rápida", abaixo do atalho, fica a parte "Imagens (opcional)". Clique em "Adicionar imagem" e escolha uma foto do seu computador: vale JPG ou PNG, até 5 MB cada, no máximo 5 imagens. Na Inbox, a imagem entra junto com o texto, e você vê a prévia antes de enviar.
2. **Uma resposta que é um áudio**  
   No alto da janela, em "Tipo de resposta rápida", clique em "Áudio". O campo de mensagem dá lugar a "Arquivo de áudio": escolha o arquivo gravado (OGG, MP3, AAC, AMR ou WAV, até 16 MB). A resposta de áudio não tem texto: na Inbox, o clique abre a janela "Enviar anexo" com o arquivo pronto, e você confere e clica em "Enviar". Para ouvir antes, use o lápis aqui nesta tela.
   > 💡 O áudio do gravador do iPhone e do Mac (M4A) não é aceito e nem aparece na hora de escolher o arquivo. Converta para MP3 antes.
3. **Conferir a imagem salva** — `/app/templates`  
   Para ver o que uma resposta já leva, clique no lápis dela. No "Cartão da clínica", a imagem aparece em miniatura abaixo de "Imagens (opcional)". O X no canto tira a imagem, mas nada muda até você clicar em "Salvar": "Cancelar" devolve tudo como estava.
4. **Ouvir o áudio salvo** — `/app/templates`  
   Numa resposta de áudio, o lápis abre a janela com o tocador do áudio atual: dê o play para ouvir antes de usar (o tempo do áudio aparece depois do play). Para trocar o áudio, escolha outro arquivo em "Arquivo de áudio" e clique em "Salvar".

<a id="l-respostas-rapidas--editar-ordenar-excluir"></a>

### Editar, mudar a ordem e excluir

- **Objetivo:** Manter a lista em dia: corrigir um texto, deixar as mais usadas no começo e apagar o que não serve mais.
- **Papel mínimo:** Administrador
- **Busca no curso:** editar resposta rápida; mudar texto da mensagem pronta; mudar ordem das respostas; arrastar resposta; apagar resposta rápida; excluir mensagem pronta

1. **Corrigir um texto** — `/app/templates`  
   Clique no lápis da resposta que quer mudar. A janela "Editar resposta rápida" abre com tudo preenchido: altere o que precisar e clique em "Salvar". O botão "Compartilhar com a equipe" fica esmaecido, sem como clicar, porque não dá para mudar isso depois de criada.
   > 💡 Para transformar uma resposta pessoal em compartilhada, crie uma nova com a opção ligada e exclua a antiga.
2. **Mudar a ordem**  
   As respostas mais usadas ficam melhor no começo, porque a Inbox mostra os botões na ordem desta lista. Clique nos pontinhos à esquerda de uma resposta e arraste para cima ou para baixo. Aqui, a "Confirmação de consulta" foi levada para o primeiro lugar.
   > 💡 Também dá pelo teclado: com o foco nos pontinhos, aperte a barra de espaço, use as setas ↑ e ↓ e aperte espaço de novo para soltar.
3. **Excluir uma resposta** — `/app/templates`  
   Clique na lixeira da resposta que não serve mais. Antes de apagar, aparece a pergunta "Excluir esta resposta rápida?": clique em "Excluir" para confirmar ou em "Cancelar" para desistir. Não dá para desfazer, e as imagens ou o áudio dela são apagados junto.
4. **Saiu da lista**  
   Depois de confirmar, o "Preparo para exame de sangue" some desta lista e dos botões da sua Inbox. Para os colegas, ele some assim que a Inbox deles recarregar.

<a id="l-respostas-rapidas--visao-do-atendente"></a>

### O que o atendente vê

- **Objetivo:** Entender o que muda quando quem entra na tela é um atendente, e não um gerente ou administrador.
- **Papel mínimo:** Atendente
- **Busca no curso:** atendente não consegue editar resposta; permissão respostas rápidas; por que não aparece o lápis; resposta pessoal do atendente; quem pode compartilhar resposta

1. **A lista vista pela Ana** — `/app/templates`  
   A Ana é atendente. Ela vê e usa todas as respostas compartilhadas, mas não tem lápis, lixeira nem pontinhos nelas: só gerente e administrador mudam o que é da equipe. A "Confirmação de consulta", que é pessoal da Helena, não aparece para ela.
2. **O que a Ana cria é só dela**  
   Na janela "Nova resposta rápida" da Ana não existe a opção "Compartilhar com a equipe": tudo o que um atendente cria fica pessoal. Para uma resposta valer para todos, peça a um gerente ou administrador que a crie.
3. **A resposta pessoal da Ana**  
   Depois de criada, a resposta aparece no alto da lista com o selo "Pessoal". Nela a Ana tem o lápis, a lixeira e os pontinhos: é dela, ela pode mudar. Os outros atendentes e o gerente não veem esta resposta.
