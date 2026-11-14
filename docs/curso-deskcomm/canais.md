# Curso DeskComm — Canais

> Gerado a partir do [curso oficial do DeskComm](https://www.deskcomm.com.br/curso) — versão 1.94.0, gerado em 2026-10-29. Conteúdo do **núcleo do DeskcommCRM (upstream)**; o que o fork de clínicas acrescenta está em [`docs/funcionalidades.md`](../funcionalidades.md). As capturas de tela de cada passo ficam no curso online.

[← Índice do curso](README.md)

## Módulos deste grupo

| Módulo | Tela | Lições | Para que serve |
|---|---|---|---|
| [Conexões](#m-conexoes) | `/app/connections` | 6 | Seus números de WhatsApp: por QR ou canal oficial da Meta, com saúde, reconexão e templates. |
| [Webhooks](#m-webhooks) | `/app/webhooks` | 6 | Avise outros sistemas quando algo acontecer aqui dentro. |

---

<a id="m-conexoes"></a>

## Conexões

**Tela:** `/app/connections`  
**Resumo:** Onde você liga e acompanha os números de WhatsApp e os outros canais da empresa: se cada um está funcionando, para quem a IA responde, pausas e proteção contra bloqueio.

**Lições:** [Conhecendo a tela de Conexões](#l-conexoes--conhecendo-a-tela) · [Liberar a IA aos poucos](#l-conexoes--acesso-da-ia) · [Renomear, pausar e excluir um número](#l-conexoes--renomear-pausar-excluir) · [Proteger o número contra bloqueio](#l-conexoes--protecao-de-envio) · [Agendar uma pausa](#l-conexoes--janela-de-manutencao) · [Os outros tipos de canal](#l-conexoes--outros-canais)

<a id="l-conexoes--conhecendo-a-tela"></a>

### Conhecendo a tela de Conexões

- **Objetivo:** Saber onde ficam os seus números de WhatsApp e ler, em cada um, se ele está funcionando.
- **Papel mínimo:** Administrador
- **Busca no curso:** conexões; meu whatsapp; números conectados; ver se o whatsapp está conectado; canais; whatsapp caiu; status do número

1. **Onde ficam os seus canais** — `/app/connections`  
   Conexões é a tela dos canais por onde a clínica fala com os clientes. Só quem é administrador abre esta tela. No alto ficam as abas, uma por tipo de canal. A tela abre em "Números por QR", que são os números de WhatsApp conectados lendo um QR Code com o celular. As outras abas ("API Oficial (Meta)", "Provedor parceiro", "Telefone", "Redes sociais" e "Chamada de voz") aparecem na última lição. A faixa vermelha no alto aparece quando algum número cai. Ela é explicada no passo 5.
2. **A barra de cima**  
   A frase da esquerda diz quantos números estão na lista. Ela conta todos, inclusive os que estão desconectados. À direita ficam os botões que valem para todos os números de uma vez. "Atualizar saúde" confere de novo se cada número está funcionando. "Pausar todas" e "Agendar pausa" você aprende na lição sobre pausas. "Conectar novo WhatsApp" abre a janela para ligar mais um número. O quadro "Para integrar" só interessa a quem liga outro sistema ao mesmo número. Se não for o seu caso, pode ignorar.
   > 💡 Ao abrir a tela, o sistema já confere cada número uma vez, sem você clicar em nada.
3. **Conectar um número novo**  
   Ao clicar em "Conectar novo WhatsApp", abre uma janela com duas formas de ligar o número. Em "QR Code", você abre o WhatsApp do celular, vai em Aparelhos conectados → Conectar um aparelho e lê o código da tela. Em "Conectar por código", você digita o telefone com código do país e DDD, clica em "Gerar código" e digita no celular o código que aparece. Quando o celular confirma, aparece o aviso "WhatsApp conectado!" e o selo do cartão do número fica verde, em "Conectado". Todo número novo começa em modo de teste: a IA não responde ninguém até você autorizar.
   > 💡 O QR Code muda sozinho a cada 15 segundos. Se ele vencer antes de você ler, é só esperar o próximo. Se fechar a janela sem conectar, o número fica na lista como "Escaneie o QR": use "Reconectar" para tentar de novo ou a lixeira para tirá-lo.
4. **O cartão de um número**  
   Cada número tem um cartão. No alto aparecem o nome que a equipe deu ao número e o telefone. O selo verde "Conectado" diz que ele está recebendo e enviando mensagens. Logo abaixo, depois de "Verificado", fica a data e a hora da última vez que o sistema conferiu o número. "Ainda não verificado" quer dizer que o sistema ainda não conseguiu conferir este número nenhuma vez. Mais embaixo, o cartão diz quem da equipe recebe as conversas deste número. Para escolher essas pessoas, use o link "Configurar responsáveis por número". A chave "Guardar o histórico anterior à vinculação" vem desligada, e assim só entram as mensagens novas. Mexer nela reinicia o número por alguns segundos, e desligá-la num número já conectado pode apagar o que ele já guardou.
5. **Quando um número cai**  
   Quando um número cai, o selo do cartão muda. Em vermelho, "Caiu" e "Parado" querem dizer que o número não está funcionando. Em amarelo, "Escaneie o QR" pede que você leia o código de novo, e "Conectando…" aparece enquanto ele volta. Uma faixa vermelha também aparece no alto de todas as telas do sistema, avisando que nenhuma mensagem entra nem sai por ele. O botão "Reconectar", que existe em todo cartão, tenta religar o número sem você pegar o celular. Se não der, a janela que abre mostra um QR para ler ou, se o número foi desvinculado do celular, o botão "Gerar novo QR".
   > 💡 Depois que o número volta a funcionar, a faixa vermelha some na próxima vez que a página carregar.

<a id="l-conexoes--acesso-da-ia"></a>

### Liberar a IA aos poucos

- **Objetivo:** Testar o atendimento automático com números de confiança antes de liberar a IA para todos os clientes.
- **Papel mínimo:** Administrador
- **Busca no curso:** ia não responde; liberar ia para clientes; modo de teste; testar robô com meu número; ia aberta ao público; números autorizados

1. **Os dois jeitos da IA** — `/app/connections`  
   Cada número diz, no próprio cartão, para quem a IA responde. Na Recepção aparece "IA aberta ao público": a IA pode atender qualquer pessoa que escrever. Na Fisioterapia aparece "IA em modo de teste": ela só responde aos números de teste que você autorizar. Como a lista ainda está vazia, o cartão avisa que a IA não responde ninguém neste número.
2. **Abrir o acesso da IA**  
   Clique em "Configurar acesso da IA", no cartão da Fisioterapia. Abre um painel do lado direito. Na caixa "Números autorizados para teste" você escreve os telefones que vão poder conversar com a IA, um por linha, com o código do país (+55) e o DDD. Use números da sua equipe ou de pessoas de confiança. O número cinza que aparece na caixa vazia é só um exemplo.
   > 💡 Para a IA responder, o agente também precisa estar publicado e ligado a este número. As mensagens continuam chegando à Inbox, e os testes são mensagens de verdade no WhatsApp.
3. **Autorizar um número de teste**  
   Escreva o telefone e clique em "Salvar lista de teste". O painel fecha e o cartão passa a mostrar quantos números estão autorizados. A partir daí, só esses números recebem respostas automáticas neste número da clínica, desde que um agente de IA esteja publicado e ligado a este número. Para os outros clientes, a conversa chega à Inbox e a equipe responde.
4. **Liberar para todos os clientes**  
   Quando os testes derem certo, abra o painel de novo e clique em "Liberar atendimento ao público". O sistema pede confirmação: a lista de teste deixa de limitar as respostas e a IA, com o agente ligado a este número, pode atender qualquer pessoa que escrever. "Confirmar liberação" libera. "Continuar em teste" fecha a pergunta sem mudar nada.
   > 💡 Contatos bloqueados e conversas que estão com uma pessoa da equipe continuam sem resposta automática, mesmo com a IA liberada.

<a id="l-conexoes--renomear-pausar-excluir"></a>

### Renomear, pausar e excluir um número

- **Objetivo:** Dar um nome fácil a cada número, pausar um número por um tempo e saber o que acontece ao excluí-lo.
- **Papel mínimo:** Administrador
- **Busca no curso:** renomear número whatsapp; mudar nome da conexão; pausar número; desligar whatsapp por um tempo; excluir número; grupos do whatsapp

1. **Dar um nome ao número** — `/app/connections`  
   Clique em "Renomear" no cartão do número. Abre a janela "Nome interno da conexão". Esse nome é o que a equipe vê no sistema, por exemplo na Inbox, para saber por qual número o cliente chegou. O cliente não vê este nome, e o nome do perfil no WhatsApp não muda.
2. **Nome salvo**  
   Escreva o novo nome e clique em "Salvar". O cartão já aparece com o nome novo. Use nomes que digam para que serve cada número, como a unidade ou o setor.
3. **Pausar um número**  
   O botão "Pausar" desliga o número sem desconectá-lo. Enquanto ele está pausado, as mensagens que chegam ficam guardadas, mas não aparecem na Inbox, a IA não responde e nada é enviado por ele. O cartão ganha o selo "Pausado", e o botão vira "Retomar". Pausar não religa o número: este continua com o selo "Caiu". Ao retomar, as mensagens guardadas aparecem na Inbox, sem perder nenhuma.
4. **Pausar ou retomar todos de uma vez**  
   Na barra de cima, "Pausar todas" pausa todos os números que ainda não estão pausados, inclusive os que caíram, e "Retomar todas" tira da pausa todos os pausados. O número entre parênteses diz quantos números o clique vai mudar. Cada botão só aparece quando tem algum número para mudar.
5. **Grupos do número**  
   O botão "Grupos" abre a lista dos grupos de WhatsApp de que o número participa. Cada grupo tem uma chave: grupo ligado aparece na Inbox para a equipe responder. A IA nunca responde em grupo. Como este número caiu, a lista não carrega e aparece o aviso para conferir a conexão.
6. **Excluir um número**  
   A lixeira, no fim do cartão, exclui o número. Antes, uma janela pede confirmação. Ao confirmar, o número é desconectado do WhatsApp e sai desta lista, e as conversas que ele já teve continuam na Inbox. Para usar o mesmo número de novo, é preciso conectá-lo outra vez. Se você só quer parar por um tempo, use "Pausar".

<a id="l-conexoes--protecao-de-envio"></a>

### Proteger o número contra bloqueio

- **Objetivo:** Entender e ajustar os limites que evitam que o WhatsApp bloqueie o número por excesso de mensagens.
- **Papel mínimo:** Administrador
- **Busca no curso:** evitar bloqueio do whatsapp; número bloqueado; limite de mensagens por dia; horário de envio; aquecimento do número; enviar no domingo

1. **Abrir a proteção de envio** — `/app/connections`  
   Clique em "Proteção de envio" no cartão do número. Abre um painel com os limites que protegem o número contra bloqueio do WhatsApp. Campo vazio usa o padrão seguro do sistema, que aparece escrito em cinza dentro do campo. No começo vem a idade do número: preencha "Este número é usado desde" com o dia em que o número começou a ser usado. Número novo começa enviando pouco por dia e vai subindo aos poucos, e é isso que o texto logo abaixo explica.
   > 💡 Só ligue "pular o aquecimento" se o número já envia mensagens há semanas. Num número novo, é o caminho mais rápido para o bloqueio.
2. **Os horários**  
   "Janela de resposta" é o horário em que a IA responde a quem escreveu. "Janela de disparo" é o horário dos envios em massa e das mensagens que retomam uma conversa parada. Fora da janela, o envio fica guardado para o próximo horário permitido. Os horários seguem o fuso escolhido mais abaixo no painel.
   > 💡 Para a IA responder a qualquer hora, use 0 e 24 na janela de resposta.
3. **Dias e domingo**  
   Em "Dias da prospecção" você marca os dias em que sai a primeira mensagem da prospecção, quando é a clínica que procura o cliente. A chave "Enviar aos domingos" vem ligada: quem escreve no domingo recebe resposta no domingo. Desligada, o número não responde nem faz envios em massa no domingo.
4. **Ritmo e teto do dia**  
   "Ritmo entre envios" é o tempo mínimo entre uma mensagem e outra do mesmo número, mais uma variação que muda a cada envio, porque um ritmo sempre igual parece robô. O "Atraso humano" é quanto a IA espera antes da primeira resposta, como alguém que viu a notificação e digitou. Ele é contado em milésimos de segundo: 3000 são 3 segundos. O "Teto diário de envios" é o máximo de mensagens que o número manda por dia. Ele vem em 300. Num número novo, vale o que for menor: o teto ou o limite do aquecimento.
5. **Fuso, aquecimento e salvar**  
   Em "Fuso horário da janela" você escolhe o fuso dos horários acima. O quadro "Aquecimento automático de número novo" mostra quantas mensagens por dia um número pode mandar conforme a idade dele. Para guardar o que mudou, clique em "Salvar proteção". "Cancelar" fecha sem salvar.

<a id="l-conexoes--janela-de-manutencao"></a>

### Agendar uma pausa

- **Objetivo:** Marcar um horário para os números pausarem e voltarem sozinhos, como numa troca de aparelho ou numa folga.
- **Papel mínimo:** Administrador
- **Busca no curso:** agendar pausa; pausar whatsapp à noite; janela de manutenção; desligar número no feriado; pausa automática; retomar sozinho

1. **Abrir o agendamento** — `/app/connections`  
   Clique em "Agendar pausa", na barra de cima. Abre a janela "Janela de manutenção". Nela você marca quando a pausa começa e quando termina. No horário marcado, o sistema pausa os números e depois os tira da pausa sozinho. As mensagens que chegarem durante a pausa ficam guardadas e aparecem na Inbox na volta.
   > 💡 Os horários seguem o fuso da organização, mostrado logo abaixo dos campos, e não o do seu computador.
2. **Escolher os números**  
   Em "Escopo" você escolhe se a pausa vale para todas as conexões ou para um número só. Depois é só clicar em "Agendar".
3. **Pausas já agendadas**  
   Abaixo dos campos aparece "Janelas agendadas", com o começo, o fim e o número de cada pausa marcada. Aqui há uma pausa da Fisioterapia, de noite. "Cancelar janela" desmarca a pausa. Se ela já tiver começado, o que foi pausado continua pausado até você retomar.

<a id="l-conexoes--outros-canais"></a>

### Os outros tipos de canal

- **Objetivo:** Conhecer as abas da API Oficial da Meta, do provedor parceiro, do telefone, das redes sociais e da chamada de voz, e o que cada uma pede para funcionar.
- **Papel mínimo:** Administrador
- **Busca no curso:** api oficial do whatsapp; conectar meta business; templates da meta; instagram e facebook no atendimento; número de telefone para ligações; chamada de voz

1. **API Oficial (Meta)** — `/app/connections?aba=oficial`  
   A aba "API Oficial (Meta)" liga o número oficial do WhatsApp Business, sem QR Code. Para isso você precisa ter um app criado na Meta. Os três dados vêm desse app, na parte WhatsApp → Configuração da API: o ID do número de telefone, o ID da conta do WhatsApp Business e o token de acesso. Ao clicar em "Validar e conectar", o sistema confere os dados com a Meta antes de guardar. Se o número não responder, nada é salvo. Depois de conectar, olhe o quadro logo abaixo: se ele disser "Cole isto no painel da Meta", copie os valores para o painel da Meta, senão as respostas dos clientes não chegam.
   > 💡 O token fica guardado de forma protegida e nunca mais aparece na tela.
2. **Templates da Meta**  
   Na sub-aba "Templates da Meta" ficam os modelos de mensagem aprovados pela Meta. Eles são criados na sua conta do WhatsApp Business, e esta tela só mostra uma cópia deles. Sem o canal oficial conectado, aparece "Canal oficial não conectado": conecte primeiro na sub-aba "Conexão". Depois de conectar, o botão "Sincronizar com a Meta" traz os modelos. Passadas 24 horas da última mensagem do cliente, só um modelo aprovado pode ser enviado. O aviso fala em "Conexões WhatsApp": é a sub-aba "Conexão", ao lado.
   > 💡 Não confunda com "Respostas rápidas", do menu: aquelas são textos prontos da sua equipe.
3. **Provedor parceiro** — `/app/connections?aba=parceiro`  
   A aba "Provedor parceiro" liga um número oficial do WhatsApp Business por meio de uma empresa parceira, cujo nome aparece no título do cartão. Você precisa ter conta com essa empresa. Cole a "Conta" (o identificador do número no painel do parceiro) e a "Chave de API" e clique em "Conectar". A chave é testada com o parceiro antes de ser guardada, e o selo "Não conectado" muda quando der certo. Logo depois, a tela mostra dois valores para colar no painel do parceiro. Copie na hora: o segredo só aparece uma vez, e sem esse passo as respostas dos clientes não chegam.
4. **Telefone** — `/app/connections?aba=telefonia`  
   A aba "Telefone" lista os números que recebem ligações. Cada número aponta para um agente de voz e um modo de atendimento. Para cadastrar, clique em "Novo número". As ligações só chegam se quem cuida da instalação tiver contratado e ligado a linha telefônica: cadastrar aqui, sozinho, não faz o telefone tocar. A clínica de exemplo ainda não tem nenhum.
5. **Redes sociais** — `/app/connections?aba=sociais`  
   A aba "Redes sociais" traz as mensagens das suas contas em redes sociais para o atendimento. Ela usa um provedor externo que você precisa contratar. Primeiro cole a "Chave de API" desse provedor e clique em "Buscar perfis". Escolha o perfil da empresa e clique em "Salvar conexão". Depois autorize cada rede em "Autorizar conta" e, no cartão da conta, clique em "Receber no atendimento" para as mensagens entrarem na Inbox.
6. **Chamada de voz** — `/app/connections?aba=voz`  
   A aba "Chamada de voz" liga as chamadas de voz pelo WhatsApp. Ela depende de um serviço que quem cuida da instalação do sistema precisa configurar. Enquanto isso não acontece, a aba mostra o aviso "A chamada de voz não está configurada." A linha de baixo do aviso é um recado técnico para quem cuida da instalação. Você não precisa entendê-la, só repassá-la.

---

<a id="m-webhooks"></a>

## Webhooks

**Tela:** `/app/webhooks`  
**Resumo:** Onde você liga os formulários do seu site ao funil, vê cada contato que chegou por eles e cria avisos automáticos para outros sistemas quando algo acontece no CRM.

**Lições:** [Conhecendo a tela de Webhooks](#l-webhooks--conhecendo-a-tela) · [Criar uma fonte para o seu formulário](#l-webhooks--criar-fonte) · [Ligar a fonte ao seu site](#l-webhooks--ligar-ao-site) · [Ver quem preencheu seus formulários](#l-webhooks--leads-recebidos) · [Avisar outro sistema quando algo acontece](#l-webhooks--avisar-outro-sistema) · [Conferir se o aviso chegou](#l-webhooks--conferir-avisos)

<a id="l-webhooks--conhecendo-a-tela"></a>

### Conhecendo a tela de Webhooks

- **Objetivo:** Saber para que serve cada aba e ler de relance se cada formulário está ligado e recebendo contatos.
- **Papel mínimo:** Administrador
- **Busca no curso:** webhooks; integração; formulário do site; landing page; receber contatos de fora; ligar outro sistema; fontes de captação

1. **As quatro abas** — `/app/webhooks`  
   A tela de Webhooks liga o CRM a outros lugares. Na aba "Receber dados" ficam as fontes: cada formulário ou landing page que traz contatos para o seu funil. "Leads recebidos" mostra tudo o que chegou por esses formulários. Em "Automações" você cria regras que agem sozinhas, como avisar outro sistema quando um paciente fecha. "Atividade" mostra o que cada automação fez.
   > 💡 Só quem é gerente ou administrador vê esta tela. Os atendentes que tentam abri-la vão para a Inbox.
2. **Uma fonte para cada formulário**  
   Cada cartão é uma fonte. O selo verde "Ativa" quer dizer que ela está aceitando contatos. "Pausada" quer dizer que ela recusa os envios: quem preencher aquele formulário não entra no funil. Embaixo do nome aparece há quanto tempo chegou o último contato, ou "nunca recebeu" se ainda não chegou nenhum. Um formulário que costumava receber todo dia e está parado há muito tempo merece uma olhada.
3. **Abrindo uma fonte**  
   Clique num cartão para abrir o painel da fonte, à direita. No alto ficam o nome e a situação. O lápis ao lado do nome serve para renomear a fonte. Logo abaixo vem o endereço da fonte: é ele que você cola no seu site. A próxima lição mostra como.
   > 💡 Logo abaixo do endereço há três chaves técnicas: autorizar IA, atualizar o card e reaproveitar o card. Elas servem para integrações feitas por um programador. Pode deixá-las desligadas.

<a id="l-webhooks--criar-fonte"></a>

### Criar uma fonte para o seu formulário

- **Objetivo:** Criar uma fonte nova e escolher em que funil e etapa os contatos do formulário vão entrar.
- **Papel mínimo:** Administrador
- **Busca no curso:** criar fonte; conectar formulário; nova landing page; contatos do site no funil; formulário cair no funil; captar leads do site

1. **Começar uma fonte** — `/app/webhooks`  
   Para cada formulário ou landing page, crie uma fonte. Assim você sabe de onde veio cada contato e pode pausar um formulário sem mexer nos outros. Clique em "Nova fonte".
2. **Dar um nome**  
   Dê à fonte um nome que diga qual é o formulário. Aqui, "Formulário de avaliação postural". Depois escolha o "Funil de entrada", o funil em que o contato vai entrar. O "Estágio de entrada" (a etapa do funil) só abre depois do funil. Em "URL de obrigado", cole a página de agradecimento do seu site. Ela vale para o formulário pronto do CRM. Preencha agora: depois de criada, a fonte não deixa mudar esse endereço.
   > 💡 Se for usar o formulário pronto e deixar a URL de obrigado vazia, quem enviar verá uma página com texto técnico. O exemplo em cinza dentro do campo é só um modelo e some quando você digita.
3. **Escolher o funil**  
   A lista mostra os funis da sua empresa. Nesta clínica de exemplo há um só, "Pacientes". Clique nele.
4. **Escolher a etapa**  
   Agora, em "Estágio de entrada", escolha a etapa do funil em que o contato entra. Quem preenche um formulário em geral ainda está no começo, então "Primeiro contato" costuma ser a escolha certa.
5. **Criar a fonte**  
   Confira o funil e o estágio e clique em "Criar fonte". Se esquecer um dos dois, a tela avisa e não cria. Capriche nessa escolha: depois de criada, a fonte não deixa trocar o funil nem o estágio.
6. **A fonte pronta**  
   A fonte nasce ativa, e o painel dela abre sozinho. O endereço no alto já está pronto para usar: cada envio com nome, telefone ou e-mail vira um contato no funil Pacientes, na etapa Primeiro contato. As chaves técnicas logo abaixo do endereço podem ficar desligadas. A próxima lição mostra como colocar esse endereço no seu site.

<a id="l-webhooks--ligar-ao-site"></a>

### Ligar a fonte ao seu site

- **Objetivo:** Colocar o formulário no seu site, ajustar as perguntas, testar se funciona e saber pausar ou proteger a fonte.
- **Papel mínimo:** Administrador
- **Busca no curso:** colar formulário no site; endereço do webhook; elementor; wordpress; testar formulário; lead de teste; perguntas do formulário

1. **O endereço da fonte** — `/app/webhooks`  
   Abra a fonte do formulário que você quer ligar. O endereço da fonte é para onde o seu formulário manda os dados. Muitos construtores de site têm um campo para colar esse endereço. O botão ao lado copia o endereço inteiro. No seu CRM, o endereço começa com o endereço da sua instalação.
2. **Perguntas extras do formulário**  
   Além de nome, WhatsApp e e-mail, o formulário pode ter perguntas suas. Esta fonte já pergunta "Qual é o seu objetivo?", com uma lista de opções. "+ Adicionar pergunta" cria outra: você escreve a pergunta e escolhe o tipo de resposta (texto curto, texto longo, número, moeda, lista de opções ou caixa de seleção). "Remover" tira a pergunta. O botão "Salvar perguntas" só fica disponível depois que você muda alguma coisa. As respostas ficam guardadas no lead.
   > 💡 "Resposta obrigatória" faz o formulário pronto não deixar enviar sem essa resposta. "Chave enviada ao CRM" é o nome interno do campo: pode deixar o que aparece.
3. **O formulário pronto**  
   Se o seu site não tem formulário, use o pronto. "Copiar formulário" copia o código, já com as suas perguntas e apontando para o endereço certo. Cole esse código numa área de código do seu site, ou entregue a quem cuida dele. Para quem enviar ver uma página de agradecimento, a fonte precisa ter sido criada com a "URL de obrigado" preenchida.
4. **Passo a passo para o seu caso**  
   Clique em "Como conectar no seu caso" para ver onde colar o endereço nas ferramentas mais usadas: Elementor Pro, JetFormBuilder, WordPress, Zapier ou n8n, e "Formulário próprio", que é o código pronto do passo anterior. Logo abaixo, "Para desenvolvedores" traz um exemplo técnico para quem programa.
5. **Testar a fonte**  
   Para ter certeza de que está tudo certo, clique em "Enviar lead de teste". Um contato chamado "Lead de Teste" entra no funil, na etapa da fonte. Quando dá certo, aparece o link "Ver no Kanban", e o envio aparece em "Últimos recebimentos". Atenção: o teste é um contato de verdade. Se você tiver automações para quando entra um contato novo, como uma mensagem de boas-vindas, elas também rodam para ele.
   > 💡 Depois do teste, apague o card "Lead de Teste" do funil e o contato dele em Contatos, para ele não se misturar com os pacientes de verdade.
6. **Últimos recebimentos**  
   Em "Últimos recebimentos" fica cada envio que chegou por esta fonte, do mais novo para o mais antigo. O primeiro é o teste que você acabou de fazer. A bolinha verde quer dizer só que o envio chegou; a vermelha, que a assinatura não conferiu. Para saber se o envio virou lead, veja a aba "Leads recebidos". A lista se atualiza sozinha a cada 5 segundos enquanto o painel está aberto.
7. **Pausar ou excluir**  
   Para parar de receber contatos por um tempo, desligue "Fonte ativa": aparece o aviso "Fonte pausada.", o formulário passa a ser recusado e nada entra no funil. Ao fechar o painel, o cartão da fonte mostra "Pausada". Ligue de novo quando quiser. "Excluir fonte" desliga o endereço para sempre. Os contatos que já chegaram continuam no funil.
   > 💡 Acima fica a "Assinatura (HMAC)". Ela é só para quem tem um programador ligando outro sistema: protege o endereço para que só esse sistema consiga mandar contatos. Não ligue se você usa o formulário pronto ou um construtor de site: eles não sabem assinar, e todos os envios passam a ser recusados. Com ela ligada, o botão de teste também fica desligado.

<a id="l-webhooks--leads-recebidos"></a>

### Ver quem preencheu seus formulários

- **Objetivo:** Encontrar cada envio dos formulários, saber se ele virou lead e entender por que um envio não entrou.
- **Papel mínimo:** Administrador
- **Busca no curso:** leads recebidos; quem preencheu o formulário; formulário não chegou; lead não entrou; origem do lead; utm campanha

1. **Tudo o que chegou** — `/app/webhooks?aba=leads`  
   A aba "Leads recebidos" lista cada envio dos seus formulários, do mais novo para o mais antigo: quem é, o contato, por qual fonte chegou, o dia e a hora, a página de origem e o resultado. "Virou lead" quer dizer que entrou no funil. "Reenvio" é quando o sistema que envia manda de novo o mesmo envio, com o mesmo código de identificação: ele não cria outro lead. Se a mesma pessoa preencher o formulário duas vezes, cada envio vira um lead. "Não entrou" quer dizer que o envio foi recusado.
   > 💡 Existe também "Card atualizado": aparece só em fontes com assinatura em que você ligou a opção de atualizar o card, quando o envio muda um card que já existia.
2. **Procurar e filtrar**  
   No alto ficam os filtros. Digite um nome, telefone ou e-mail e aperte Enter (ou clique na lupa). Também dá para ver só uma fonte, só um resultado ou um período, com "De" e "Até". Vamos ver só os envios que não entraram: clique em "Resultado".
3. **Só os que não entraram**  
   Com "Não entrou" escolhido, a lista mostra só os envios recusados. Este não tem nome: a tabela mostra "(sem identificação)". Clique nele para ver o motivo.
4. **Por que não entrou**  
   O painel abre com o motivo em vermelho. Aqui o formulário não mandou nome, telefone nem e-mail que o CRM reconhecesse. Logo abaixo, em "O que o formulário trouxe", você vê os nomes que o formulário usou nos campos. Com isso, quem cuida do site sabe o que corrigir.
5. **Um envio que virou lead** — `/app/webhooks?aba=leads`  
   Agora um envio que deu certo, o da Larissa Mendes. Em "O que o formulário trouxe" aparecem nome, telefone, e-mail e a resposta da pergunta extra. O botão "Cadastrar como campo do lead" transforma essa resposta num campo do funil, que passa a aparecer no card do lead.
6. **De onde veio e onde está**  
   Em "De onde veio" aparecem a página do formulário, o endereço de internet (IP) e o navegador de quem enviou. As linhas com "utm" dizem de qual anúncio ou campanha a pessoa veio, quando o seu link tem essa marcação. Aqui, do Instagram, campanha "avaliacao-outubro". O botão "Ver o lead no funil" abre o lead que esse envio criou.

<a id="l-webhooks--avisar-outro-sistema"></a>

### Avisar outro sistema quando algo acontece

- **Objetivo:** Montar uma automação que manda um aviso para outro sistema (planilha, financeiro, laboratório) quando algo acontece no CRM.
- **Papel mínimo:** Administrador
- **Busca no curso:** avisar outro sistema; enviar dados para outro sistema; webhook de saída; integrar com planilha; automação; quando fechar negócio avisar

1. **Suas automações** — `/app/webhooks?aba=automacoes`  
   A aba "Automações" mostra as regras da sua empresa. Cada cartão traz o nome, a situação ("Ativa" ou "Pausada"), quando ela age e quantas ações faz. A chave liga e pausa a regra. Os ícones à direita abrem a regra no designer (um desenho do caminho), editam e excluem. No alto, "Montar no designer" cria uma regra nova direto no designer. Esta regra avisa o sistema do financeiro sempre que um paciente fecha.
2. **Nome e momento**  
   Toda automação tem três partes: QUANDO (o que acontece), SE (uma condição, se quiser) e ENTÃO (o que fazer). Dê um nome que diga o que ela faz. Depois escolha o QUANDO: clique em "Escolha o gatilho".
3. **Quando ela age**  
   A lista traz tudo o que pode disparar uma automação: um contato novo, um lead que muda de etapa, um negócio ganho ou perdido, uma mensagem que chega, um horário marcado ou cancelado, e outros. Para avisar o laboratório, escolha "Quando um horário for marcado".
4. **Condição e ação**  
   A parte SE é opcional. Com "Adicionar condição" você limita a regra, por exemplo, a um tipo de atendimento. Para avisar sempre, deixe vazio. Na parte ENTÃO, clique em "Adicionar ação" para escolher o que a automação faz.
5. **Escolher "Avisar outro sistema"**  
   Entre as ações, "Avisar outro sistema (webhook)" é a que manda os dados do que aconteceu para o endereço de outro sistema. Esse outro sistema precisa ter um endereço próprio para receber avisos. É assim que o CRM conversa com um sistema de gestão ou com ferramentas como Zapier e n8n, que podem levar o aviso adiante, por exemplo para uma planilha.
6. **O endereço do outro sistema**  
   Cole em "Endereço (URL)" o endereço que o outro sistema te deu para receber avisos. O "Segredo (opcional)" serve para o outro sistema conferir que o aviso veio mesmo do seu CRM. Só preencha se quem cuida dele pedir; o texto cinza é só um exemplo. "Incluir o responsável no corpo" fica desligado: ligue só se o outro sistema precisar saber quem da equipe atende o cliente.
   > 💡 Embaixo, "Adicionar ação" soma outra ação à mesma regra.
7. **Criar a automação**  
   Clique em "Criar automação". Ela nasce pausada, para você revisar antes, e aparece na lista com o selo "Pausada" e a chave desligada. Quando tiver revisado, ligue a chave: a partir daí, cada horário marcado manda um aviso para o endereço do laboratório. Na aba "Atividade" você confere se ele chegou.

<a id="l-webhooks--conferir-avisos"></a>

### Conferir se o aviso chegou

- **Objetivo:** Ver na aba Atividade se cada automação funcionou e o que fazer quando um aviso não chega.
- **Papel mínimo:** Administrador
- **Busca no curso:** atividade das automações; aviso não chegou; webhook falhou; reenviar aviso; histórico de automações; erro 404

1. **O que cada automação fez** — `/app/webhooks?aba=atividade`  
   A aba "Atividade" mostra cada vez que uma automação agiu, da mais recente para a mais antiga. Cada cartão traz o nome da regra, há quanto tempo foi e o resultado. "Sucesso" quer dizer que todas as ações da regra deram certo; num aviso, que o outro sistema respondeu que recebeu. "Falhou" quer dizer que nenhuma ação deu certo; num aviso, que o outro sistema não aceitou ou não respondeu.
   > 💡 Pode aparecer também "Parcial", quando só algumas ações deram certo, e "Aguardando envio", quando uma mensagem espera para sair.
2. **Quando o aviso falha**  
   Embaixo da ação que falhou aparece o que o outro sistema respondeu. Aqui é "http_404": o endereço não foi encontrado do outro lado. Em geral é endereço digitado errado ou que mudou. Confira o endereço na automação (o lápis do cartão, na aba Automações). Depois volte aqui e clique em "Reenviar": o mesmo aviso sai de novo e um cartão novo mostra o resultado.
3. **Ver as novidades**  
   Se algo acabou de acontecer e ainda não aparece na lista, clique em "Atualizar" para buscar as execuções mais novas.
