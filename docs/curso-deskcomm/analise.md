# Curso DeskComm — Análise

> Gerado a partir do [curso oficial do DeskComm](https://www.deskcomm.com.br/curso) — versão 1.94.0, gerado em 2026-10-29. Conteúdo do **núcleo do DeskcommCRM (upstream)**; o que o fork de clínicas acrescenta está em [`docs/funcionalidades.md`](../funcionalidades.md). As capturas de tela de cada passo ficam no curso online.

[← Índice do curso](README.md)

## Módulos deste grupo

| Módulo | Tela | Lições | Para que serve |
|---|---|---|---|
| [Desempenho](#m-desempenho) | `/app/metrics` | 7 | Funil e performance por atendente nos últimos 30 dias. |
| [Meta Ads](#m-meta-ads) | `/app/ads/meta` | 3 | Quanto custou cada resultado das campanhas que trazem gente para cá. |
| [Atividades](#m-atividades) | `/app/activities` | 4 | Relatório do que a equipe e os agentes fizeram no período: quanto, quem e de que tipo. |

---

<a id="m-desempenho"></a>

## Desempenho

**Tela:** `/app/metrics`  
**Resumo:** Os números do atendimento e das vendas dos últimos 30 dias: o que o resultado custou, por que se perdeu, quanto deve entrar e como cada pessoa da equipe está indo.

**Lições:** [Conhecendo a tela de Desempenho](#l-desempenho--conhecendo-o-desempenho) · [Atrito: os quatro cartões](#l-desempenho--atrito-cartao-a-cartao) · [Ajustando quando uma conversa conta como perdida](#l-desempenho--regua-do-abandono) · [Perdas e previsão](#l-desempenho--perdas-e-previsao) · [Funil e desempenho da equipe](#l-desempenho--funil-e-equipe) · [Por canal e ganhos por período](#l-desempenho--canais-e-ganhos) · [O que um atendente vê](#l-desempenho--o-que-o-atendente-ve)

<a id="l-desempenho--conhecendo-o-desempenho"></a>

### Conhecendo a tela de Desempenho

- **Objetivo:** Saber o que a tela de Desempenho mostra, de que período são os números e como cada cartão se lê.
- **Papel mínimo:** Administrador
- **Busca no curso:** desempenho; métricas; relatório; números do atendimento; resultados das vendas; painel; indicadores; últimos 30 dias

1. **Onde ficam os números** — `/app/metrics`  
   A tela Desempenho junta os números do atendimento e das vendas da clínica. Você chega a ela pelo menu, em "Desempenho", no grupo Análise. A maior parte dos números olha para os últimos 30 dias, contados até agora, e não há como escolher outro período nesta tela. O Funil e a Previsão são a exceção: eles mostram os negócios que estão abertos agora. O campo "Atendente" mostra parte dos blocos só para uma pessoa da equipe; ele aparece numa lição mais adiante.
   > 💡 Role a tela para baixo: os blocos aparecem nesta ordem: Atrito, Perdas, Previsão, Funil, Performance por atendente, Por canal e Ganhos por período.
2. **O bloco Atrito**  
   O primeiro bloco, "Atrito", mostra o que o resultado custou para o cliente e para a equipe. A frase de cima diz em que base os números foram medidos: quantas demandas foram encerradas nos últimos 30 dias e quantas ainda estão abertas. Uma demanda é um pedido de um cliente, do começo ao fim do atendimento. Logo abaixo fica a régua que diz depois de quantas horas sem resposta uma conversa conta como perdida; ela tem uma lição própria.
3. **Como ler um cartão**  
   O Atrito tem quatro cartões: Conversão, Automação, Custo humano e Contenção. Todos se leem do mesmo jeito. À esquerda, em letra grande, fica o resultado (aqui, "Negócios ganhos": quantos negócios foram ganhos nos últimos 30 dias). À direita, em "O que isso custou", ficam as medidas do preço desse resultado. Os dois lados ficam juntos de propósito: um número bom só vale se o custo dele também estiver bom.

<a id="l-desempenho--atrito-cartao-a-cartao"></a>

### Atrito: os quatro cartões

- **Objetivo:** Entender o que mede cada cartão do Atrito e o que quer dizer o traço no lugar de um número.
- **Papel mínimo:** Administrador
- **Busca no curso:** atrito; conversão; automação; custo humano; contenção; cliente sumiu; o que significa o traço; tempo de espera

1. **Conversão** — `/app/metrics`  
   O cartão Conversão põe os negócios ganhos ao lado do esforço que o cliente teve. "Turnos até o desfecho (mediana)" mostra quantas mensagens, somando os dois lados, um atendimento típico trocou até ser encerrado. As duas linhas de "Insistência" contam quantas vezes o agente voltou a procurar o cliente por conta própria; elas só são medidas nos atendimentos que viraram um caso do agente, e aqui aparecem com "—" porque não houve nenhum. "Descadastros no período" conta quem pediu para não receber mais mensagens. "Conversas que morreram no silêncio" mostra, das conversas em que a clínica falou, quantas acabaram com a clínica falando por último, o cliente sem responder há mais de 72 horas e ninguém encerrando.
2. **Automação**  
   O cartão Automação mostra quanto o agente de IA respondeu sozinho. "Respostas dadas pelo agente" é a parte das respostas aos clientes que foi escrita pelo agente; as mensagens de automação não entram nessa conta. Do lado do custo: "Passagens para humano" conta as vezes em que o agente passou para uma pessoa o atendimento de um cliente que tem negócio no funil. "Respostas humanas fora do sistema" mostra, em porcentagem, quanto das respostas da equipe saiu pelo celular, fora do Deskcomm. "Clientes que repetiram depois da passagem" mostra, entre os atendimentos passados para uma pessoa, em quantos o cliente teve de repetir o que já tinha dito. "Perguntas que a pessoa teve de repetir" mostra, também em porcentagem, quantas vezes o cliente mandou de novo quase a mesma frase depois de receber uma resposta.
3. **Custo humano**  
   O cartão Custo humano mostra o trabalho da equipe. O número grande é o total de demandas encerradas no período. "Espera na fila humana" mede quanto o cliente esperou até alguém da equipe agir, nos atendimentos que o agente passou adiante; aqui aparece "—" porque não houve nenhum no período. As linhas vizinhas medem quantas vezes a equipe precisou entrar em cada demanda, a espera dos casos mais demorados (p90) e quantas demandas precisaram subir para alguém de nível acima. "Demandas abertas sem próximo passo" conta os atendimentos abertos em que nada está marcado para acontecer: é alguém esperando sem que ninguém tenha combinado o que vem depois. A última linha mostra, em porcentagem, quantas falas do cliente esperaram mais de 4 horas pela primeira resposta.
4. **Contenção e o traço**  
   O cartão Contenção conta as mensagens que saíram sem uma pessoa escrever. "Mensagens enviadas pelo agente" são as do agente de IA. À direita, em "O que isso custou", "Vetos por execução" mostra, em média, quantas vezes o sistema segurou uma mensagem do agente antes de ela sair. Logo abaixo aparecem as enviadas por automação (regras, follow-up e lembretes da agenda) e por integração com outro sistema, contadas à parte para não se misturarem com as do agente. Quando um número aparece como "—", não houve dado suficiente para medir: o traço não quer dizer zero.

<a id="l-desempenho--regua-do-abandono"></a>

### Ajustando quando uma conversa conta como perdida

- **Objetivo:** Mudar o número de horas de silêncio depois do qual uma conversa conta como perdida no Atrito.
- **Papel mínimo:** Administrador
- **Busca no curso:** conversa perdida; cliente não respondeu; horas sem resposta; mudar 72 horas; régua do abandono; silêncio; abandono

1. **A régua do silêncio** — `/app/metrics`  
   No alto do Atrito fica a frase "Contar como perdida no silêncio após 72 horas sem resposta". É ela que decide quando uma conversa entra na medida "Conversas que morreram no silêncio", no cartão Conversão. O aviso "(padrão do sistema)" quer dizer que a régua está no valor padrão, 72 horas. Clínicas que costumam esperar menos pelo retorno do paciente podem querer um número menor.
   > 💡 Só quem é gerente ou administrador muda a régua. Os atendentes veem o mesmo número numa frase só para leitura, sem o campo para editar.
2. **Digite o novo número**  
   Clique no campo e troque o número de horas, por exemplo para 48. Assim que o número muda, aparece o botão "Salvar" ao lado, e o aviso "(padrão do sistema)" sai. O campo aceita um número inteiro de 1 a 2160 horas (90 dias); fora disso, aparece um aviso em vermelho e o botão fica desligado. Clique em "Salvar".
3. **A medida muda junto**  
   Depois de salvar, o botão some e a medida do cartão Conversão passa a se chamar "Conversas que morreram no silêncio (após 48h)", já contada com a régua nova. Aqui o número não mudou, porque a única conversa perdida já estava em silêncio havia mais de 72 horas. A régua vale para toda a empresa e muda também a leitura dos dias que já passaram. Para voltar ao padrão, digite 72 e salve de novo.

<a id="l-desempenho--perdas-e-previsao"></a>

### Perdas e previsão

- **Objetivo:** Ver por que e em que etapa os negócios foram perdidos, quanto valiam, e o que a previsão precisa para funcionar.
- **Papel mínimo:** Administrador
- **Busca no curso:** negócios perdidos; motivo da perda; por que perdi; previsão de vendas; quanto vou faturar; chance de fechamento; valor perdido

1. **Por que os negócios foram perdidos** — `/app/metrics`  
   O cartão "Perdas" lista os negócios perdidos nos últimos 30 dias de três jeitos. "Por motivo" usa o motivo escolhido quando o negócio foi marcado como perdido. "Por categoria" junta os motivos em grupos: "Preço" conta como "Nós", "Sem resposta do cliente" como "Ausência" e "Cancelado pelo cliente" como "Cliente". "Por etapa de saída" mostra em que etapa do funil o negócio estava quando foi perdido. A maior quantidade vem sempre em cima.
   > 💡 Só gerentes e administradores veem o cartão Perdas.
2. **Quanto se perdeu**  
   Em "Valor por moeda" aparecem quantos negócios foram perdidos e a soma do valor deles. Se a clínica vende em mais de uma moeda, cada uma fica numa linha, sem somar uma com a outra.
3. **A previsão do funil**  
   O cartão "Previsão" estima quanto deve entrar por mês com os negócios abertos do funil principal, usando a chance de fechamento de cada etapa. Nesta clínica nenhuma etapa tem chance definida, por isso todo o valor em aberto aparece em "Sem chance definida na etapa — falta calibrar". Quando as etapas têm chance, aparece uma tabela por mês com o valor "Ponderado" (o valor vezes a chance) e o "Bruto" (o valor cheio). Negócio sem data prevista de fechamento fica numa linha à parte.
   > 💡 A chance de cada etapa se define em "Etapas do funil" (no menu, em "Ver tudo em CRM"), no campo "Chance de fechamento (0 a 100)".

<a id="l-desempenho--funil-e-equipe"></a>

### Funil e desempenho da equipe

- **Objetivo:** Ler quantos negócios estão abertos em cada etapa, comparar a equipe e ver os números de uma pessoa só.
- **Papel mínimo:** Administrador
- **Busca no curso:** funil; desempenho por atendente; comparar equipe; tempo de resposta; quem vendeu mais; média e mediana; filtrar atendente

1. **O funil de agora** — `/app/metrics`  
   O cartão "Funil" conta os negócios abertos agora em cada etapa. Ele mostra uma barra para cada etapa de todos os funis da clínica, e o número do título é o total de abertos. Cada barra é proporcional à etapa com mais negócios, e as etapas vazias também aparecem, inclusive as de ganho e de perda, que ficam em zero: um negócio que chega nelas deixa de estar aberto. Os negócios ganhos ou perdidos não entram aqui: este cartão olha para o que ainda está em andamento, e não para os últimos 30 dias.
2. **Performance por atendente**  
   A tabela compara as pessoas da equipe nos últimos 30 dias; o "(você)" marca quem está usando a tela. "Ganhos" e "Perdidos" contam os negócios fechados que estavam no nome da pessoa. "Conversas" conta as conversas passadas para ela. "1ª resposta" é o tempo entre a primeira mensagem do cliente e a primeira resposta escrita por alguém da equipe, nas conversas que estão no nome da pessoa. A média soma todos os tempos; a mediana é o tempo do meio. Na linha da Helena, a média fica bem maior que a mediana: uma única resposta demorada, de horas, puxa a média para cima, e a mediana mostra a resposta típica. Os tempos aparecem em minutos: 120min são 2 horas.
   > 💡 Negócio levado para outro funil não conta como perdido.
3. **Escolher uma pessoa**  
   No alto da tela, o campo "Atendente" abre a lista da equipe. Escolha uma pessoa para ver só os números dela. Clique em "Ana Ribeiro".
4. **Os números de uma pessoa**  
   Com uma pessoa escolhida, o funil passa a se chamar "Funil do atendente" e conta só os negócios abertos no nome dela, e a tabela fica só com a linha dela. O cartão "Por canal" também passa a contar só as conversas dela. O Atrito, as Perdas, a Previsão e os Ganhos por período continuam mostrando a clínica inteira. Para voltar, escolha "Todos os atendentes".

<a id="l-desempenho--canais-e-ganhos"></a>

### Por canal e ganhos por período

- **Objetivo:** Ver o atendimento de cada número de WhatsApp e acompanhar os ganhos por dia, semana ou mês.
- **Papel mínimo:** Administrador
- **Busca no curso:** por canal; número do whatsapp; conversas sem resposta; ganhos por dia; vendas por semana; gráfico de vendas; evolução

1. **Cada número de WhatsApp** — `/app/metrics`  
   O cartão "Por canal" tem uma linha para cada número de WhatsApp que teve atendimento nos últimos 30 dias; um número parado no período não aparece. "Conversas" conta as conversas passadas para alguém da equipe nesse período. "1ª resposta (média)" é o tempo médio até a primeira resposta escrita por uma pessoa. "Sem resposta" conta, dessas conversas, quantas ainda não tiveram nenhuma resposta de alguém da equipe. Um número arquivado que teve atendimento no período continua aparecendo, marcado "(arquivado)".
2. **Ganhos por período**  
   O último cartão mostra os negócios ganhos ao longo dos últimos 30 dias. O número do título é o total de ganhos, de toda a clínica. A linha do gráfico passa por cada dia, e os dias sem ganho aparecem com zero, para os vales não sumirem. Mais abaixo, rolando a tela, uma tabela repete os mesmos números, período por período. O campo à direita do título, hoje em "Dia", escolhe se os ganhos são juntados por dia, por semana ou por mês; o período continua sendo os últimos 30 dias. Clique nele.
3. **Ver por semana**  
   Escolha "Semana" para juntar os ganhos de cada semana num ponto só. Assim fica mais fácil ver se as vendas estão subindo ou caindo, sem o sobe e desce de um dia para o outro. "Mês" serve pouco aqui: como a tela olha só 30 dias, ele mostra no máximo dois meses, e os dois incompletos.

<a id="l-desempenho--o-que-o-atendente-ve"></a>

### O que um atendente vê

- **Objetivo:** Saber como a tela de Desempenho aparece para quem tem o cargo de atendente.
- **Papel mínimo:** Atendente
- **Busca no curso:** atendente vê; minha performance; meus números; cargo atendente; permissão desempenho; sua performance

1. **A tela para um atendente** — `/app/metrics`  
   Esta é a mesma tela, aberta pela Ana Ribeiro, que tem o cargo de atendente. Ela não vê o campo para escolher outra pessoa da equipe, e a régua do silêncio aparece só como uma frase, sem campo para editar. O cartão Perdas também não aparece para quem é atendente.
2. **Números só dela**  
   Para quem é atendente, boa parte dos números conta só o que a pessoa pode ver: os negócios e as conversas no nome dela e, no padrão da instalação, os que ainda não têm responsável. Por isso o cartão Conversão mostra os negócios ganhos que a Ana enxerga, e não os da clínica toda, e as conversas que morreram no silêncio são contadas só entre as que ela vê. Já as contagens de demandas (a base no alto do Atrito, "Demandas encerradas" e "Demandas abertas sem próximo passo") continuam sendo da clínica inteira.
3. **Sua performance**  
   Mais abaixo, o funil conta os negócios abertos que a Ana enxerga: os dela e os que estão sem responsável. A tabela se chama "Sua performance" e tem uma linha só, a dela: os ganhos, os perdidos, as conversas e o tempo da primeira resposta. Os cartões "Por canal" e "Ganhos por período" também contam só o que ela enxerga, por isso mostram números menores que os da clínica toda.

---

<a id="m-meta-ads"></a>

## Meta Ads

**Tela:** `/app/ads/meta`  
**Resumo:** Onde você acompanha quanto gastou e quanto custou cada resultado dos anúncios do Facebook e do Instagram, depois de ligar a sua conta de anúncios.

**Lições:** [Conhecendo a tela de Meta Ads](#l-meta-ads--conhecendo-a-tela) · [Ligando a sua conta de anúncios](#l-meta-ads--conectar-a-conta) · [Quem vê e quem liga a conta](#l-meta-ads--quem-pode-ver)

<a id="l-meta-ads--conhecendo-a-tela"></a>

### Conhecendo a tela de Meta Ads

- **Objetivo:** Achar a tela de Meta Ads, entender de onde vêm os números e reconhecer o que ela mostra antes de a conta de anúncios ser ligada.
- **Papel mínimo:** Administrador
- **Busca no curso:** meta ads; anúncios do facebook; anúncios do instagram; campanhas pagas; quanto gastei em anúncio; custo por resultado; tráfego pago

1. **Onde fica a tela** — `/app/ads/meta`  
   Meta Ads fica no menu da esquerda, no grupo "Análise", logo abaixo de "Desempenho". É a tela dos anúncios pagos do Facebook e do Instagram: quanto você gastou em cada campanha e quanto custou cada resultado. Só administradores e gerentes veem este item no menu.
   > 💡 Leia junto com "Desempenho": lá você vê o que aconteceu depois que o cliente chegou; aqui, quanto custou trazê-lo.
2. **Os números vêm na hora**  
   A frase no alto avisa como a tela funciona: ela não guarda os números. Eles são buscados no Facebook na hora: quando a tela abre, quando você troca a conta ou o período, e quando você clica em "Atualizar". Esse botão só aparece depois que a conta de anúncios estiver ligada. Até lá, nada aparece aqui.
3. **Ainda sem conta ligada**  
   Numa instalação nova, a tela mostra "Nenhuma conta de anúncios conectada.". O botão "Conectar conta de anúncios" leva à página onde você cola o acesso da sua conta. Só quem é administrador vê esse botão. Para seguir, clique nele.
   > 💡 Quem é gerente vê a mesma tela, mas no lugar do botão aparece um pedido para chamar quem administra. Isso está na última lição.

<a id="l-meta-ads--conectar-a-conta"></a>

### Ligando a sua conta de anúncios

- **Objetivo:** Saber onde e como colar o token de acesso da conta de anúncios, e o que cada campo da página de conexão pede.
- **Papel mínimo:** Administrador
- **Busca no curso:** conectar facebook ads; ligar conta de anúncios; token de acesso meta; onde colo o token; ads_read; conta padrão de anúncios; integrar anúncios

1. **Pelo caminho das Configurações** — `/app/settings`  
   Além do botão da tela de Meta Ads, a página de conexão também abre por "Configurações", no rodapé do menu. Ela fica na seção "Sua empresa", no cartão "Meta Ads". Não confunda com o cartão "Conversões": ele serve para outra coisa e pede um token diferente. Clique no cartão "Meta Ads", na coluna da direita (não no item "Meta Ads" do menu).
2. **Uma ligação só para ler**  
   A frase do alto garante que a ligação é só de leitura: nada é criado, pausado ou alterado na sua conta de anúncios. O quadro azul diz o que você precisa trazer: um token de acesso, que é uma senha especial que o Facebook gera para o sistema poder ler os seus anúncios. Ele é gerado no site Meta for Developers e precisa da permissão "ads_read".
   > 💡 O token fica guardado de forma protegida e nunca é mostrado de volta, nem para você. Atenção: para gerar o token é preciso ter um aplicativo criado no Meta for Developers, e alguns tokens vencem em poucas horas. Se a tela de Meta Ads pedir um token novo pouco depois de ligar, foi isso. Gere um token de longa duração.
3. **O campo do token**  
   Cole o token no campo "Token de acesso". O "EAA..." cinza dentro do campo é só um exemplo de como o token começa: o campo ainda está vazio. Enquanto ele estiver vazio, ou curto demais para ser um token inteiro, o botão "Salvar" fica apagado e, ao lado, aparece "Cole o token para poder salvar.". Na primeira vez, o token é obrigatório.
4. **A conta que abre primeiro**  
   O campo "Conta padrão (opcional)" escolhe qual conta de anúncios a tela de Meta Ads abre primeiro. Escreva "act_" seguido dos números da conta, como no exemplo cinza dentro do campo. Se deixar em branco, a tela abre a primeira conta ativa que o token alcançar.
   > 💡 Se o número não estiver nesse formato, ao salvar aparece "Confira os campos: algum valor não está no formato esperado.".
5. **Pronto para salvar**  
   Com o token colado, ele aparece como pontinhos, para ninguém ler por cima do seu ombro, e "Salvar" acende. Ao salvar, aparece "Conexão salva." e o campo do token fica vazio de novo, porque o token nunca é mostrado de volta. O sistema não testa o token na hora de salvar: se ele estiver vencido ou sem a permissão "ads_read", o aviso aparece na tela de Meta Ads, dizendo o que fazer.
   > 💡 Depois de ligada, esta página mostra também o botão "Desconectar". Ele apaga o token guardado e a tela de Meta Ads volta a pedir uma conexão.

<a id="l-meta-ads--quem-pode-ver"></a>

### Quem vê e quem liga a conta

- **Objetivo:** Entender o que o gerente vê na tela de Meta Ads e por que só o administrador liga a conta de anúncios.
- **Papel mínimo:** Gerente
- **Busca no curso:** gerente não consegue conectar; sem permissão meta ads; 403 sem permissão; quem pode ver anúncios; atendente não vê meta ads; pedir para administrador

1. **O gerente também vê a tela** — `/app/ads/meta`  
   Aqui você está como Carlos Mendes, gerente da clínica. Para ele, "Meta Ads" também aparece no menu, no grupo "Análise". Os números dos anúncios, como orçamento e custo de cada resultado, são da empresa inteira e não de um atendente só. Por isso só gerentes e administradores veem esta tela.
   > 💡 Atendentes não veem "Meta Ads" no menu.
2. **Sem botão para ligar**  
   Enquanto a conta não está ligada, o gerente não vê o botão "Conectar conta de anúncios". No lugar dele aparece o pedido: "Peça a quem administra a organização para conectar a conta de anúncios em Configurações.".
3. **A página de conexão é do administrador** — `/app/settings/meta-ads`  
   O gerente nem vê o cartão "Meta Ads" em Configurações. Se ele abrir a página de conexão pelo endereço, aparece "403 — Sem permissão". Ligar ou trocar o token é só para o administrador: o token dá acesso à conta de anúncios inteira da empresa, e escolher qual conta ligar é decisão de quem administra. O botão "Voltar pra Inbox" leva de volta ao trabalho.

---

<a id="m-atividades"></a>

## Atividades

**Tela:** `/app/activities`  
**Resumo:** O relatório do que aconteceu no CRM num período: quanto foi a equipe, quanto foram os agentes de IA, quem fez cada coisa e quais assuntos mais ocuparam o atendimento.

**Lições:** [Conhecendo a tela Atividades](#l-atividades--conhecendo-atividades) · [Quem fez o quê](#l-atividades--quem-fez-o-que) · [Olhar um período maior](#l-atividades--mudar-o-periodo) · [Quais assuntos mais ocuparam o atendimento](#l-atividades--por-etiqueta)

<a id="l-atividades--conhecendo-atividades"></a>

### Conhecendo a tela Atividades

- **Objetivo:** Ler o resumo do período: o total de acontecimentos, quanto foi a equipe, os agentes e o automático, e em que dias tudo aconteceu.
- **Papel mínimo:** Administrador
- **Busca no curso:** atividades; relatório; o que aconteceu; o que a equipe fez; histórico da semana; quem fez o quê; produtividade da equipe

1. **O que esta tela mostra** — `/app/activities`  
   A tela Atividades mostra o que aconteceu no seu CRM num período e quem fez cada coisa. Cada acontecimento é algo que ficou registrado num negócio do funil: mudar de etapa, assumir uma conversa, marcar um horário, concluir uma tarefa. A tela abre na aba "Atividades", com os "Últimos 7 dias". À direita aparece o total de acontecimentos do período.
   > 💡 A outra aba, "Por etiqueta", mostra quais assuntos mais ocuparam o atendimento. Ela tem uma lição só para ela.
2. **Gente, agente ou automático**  
   Os três cartões dividem o total por origem. "A equipe" conta o que as pessoas da sua equipe fizeram. "Os agentes" conta o que os agentes de IA fizeram sozinhos. "Automático" conta o que não foi nem uma pessoa da equipe nem um agente: o próprio sistema (por exemplo, ao criar o negócio quando chega a primeira mensagem), uma automação ou o próprio cliente. Embaixo do número fica a porcentagem do total.
   > 💡 O desenho ao lado de cada nome se repete na tela inteira: bolinha cheia é pessoa, anel é agente de IA e bolinha tracejada é automático.
3. **Em que dias as coisas aconteceram**  
   O quadro "Quando" tem uma barra por dia, com a data embaixo. O dia de hoje também entra: em "Últimos 7 dias" aparecem 8 barras. Quanto mais alta a barra, mais coisa aconteceu naquele dia. Para ver o número exato, pare o mouse sobre a barra. No celular, o número aparece escrito embaixo da data. A primeira e a última barra pegam só um pedaço do dia, por isso podem sair mais baixas.
   > 💡 Um dia sem nenhum acontecimento fica com uma barrinha mínima: ninguém mexeu nos negócios naquele dia. Pode ser um domingo, mas vale conferir se o atendimento não ficou parado.

<a id="l-atividades--quem-fez-o-que"></a>

### Quem fez o quê

- **Objetivo:** Ver quem mais trabalhou no período, que tipo de coisa foi feita, e ir de um acontecimento até o negócio dele.
- **Papel mínimo:** Administrador
- **Busca no curso:** quem fez; ranking da equipe; o que cada atendente fez; o que a IA fez; linha do tempo; histórico de ações; abrir o negócio

1. **Os dois rankings** — `/app/activities`  
   "Quem fez" lista quem agiu no período (cada pessoa da equipe, cada agente de IA e o automático), de quem fez mais para quem fez menos, com o número e uma barra do tamanho da parte de cada um. O desenho antes do nome diz o tipo: bolinha cheia é pessoa, anel é agente e bolinha tracejada é automático (o sistema ou uma automação). Ao lado, "O que foi feito" faz a mesma conta pelo tipo de acontecimento, como "Mudou de estágio" ou "Assumiu a conversa".
2. **A linha do tempo da operação**  
   Mais embaixo fica a "Linha do tempo da operação": os acontecimentos do período, do mais recente para o mais antigo. Cada linha traz o dia e a hora, o que aconteceu, quem fez, o negócio e o nome do cliente. Quando há um motivo, ele aparece logo abaixo: por exemplo, de qual etapa para qual o negócio foi movido. O nome do negócio é um link. Clique nele para abrir o negócio.
   > 💡 A lista mostra até os 200 acontecimentos mais recentes. Se o período tiver mais, um aviso no fim da lista diz o total.
3. **Do acontecimento ao negócio**  
   O link leva ao funil onde o negócio está agora, com a ficha dele já aberta. Role a ficha até "Linha do tempo": ali fica o histórico completo daquele negócio, inclusive o acontecimento em que você clicou. A tela Atividades é o resumo de todos os negócios juntos; a ficha é a história de um só.

<a id="l-atividades--mudar-o-periodo"></a>

### Olhar um período maior

- **Objetivo:** Trocar o período do relatório para 30 ou 90 dias e comparar com a última semana.
- **Papel mínimo:** Administrador
- **Busca no curso:** mudar o período; últimos 30 dias; relatório do mês; últimos 90 dias; ver meses anteriores; filtrar por data

1. **Escolher o período** — `/app/activities`  
   Clique no botão "Últimos 7 dias" para trocar o período. As opções são 7, 30 e 90 dias, sempre contando para trás a partir de agora. Os cartões, o gráfico, os rankings e a lista mudam juntos.
2. **O mês inteiro na tela**  
   Com "Últimos 30 dias", entram também os acontecimentos das semanas anteriores. Aqui o total subiu de 29 para 39, e o gráfico "Quando" passou a ter uma barra para cada dia, de um mês atrás até hoje. Assim dá para comparar a última semana com as anteriores.
   > 💡 O período não fica guardado: ao sair e voltar para a tela, ela abre de novo nos "Últimos 7 dias". Se nada foi registrado no período escolhido, a tela mostra "Nada aconteceu neste período" e um botão "Ver conversas", que abre a Inbox.

<a id="l-atividades--por-etiqueta"></a>

### Quais assuntos mais ocuparam o atendimento

- **Objetivo:** Usar a aba Por etiqueta para ver quais assuntos mais apareceram nas conversas e ir direto a elas na Inbox.
- **Papel mínimo:** Administrador
- **Busca no curso:** por etiqueta; relatório de tags; assuntos mais comuns; tempo de espera; conversas por assunto; etiquetas mais usadas

1. **A aba Por etiqueta** — `/app/activities`  
   A aba "Por etiqueta" mostra quais assuntos mais ocuparam o atendimento. Ela conta as etiquetas postas nas conversas (as "Tags da conversa" da Inbox), nas conversas que começaram no período. Uma conversa com duas etiquetas conta nas duas linhas. Por isso, no alto, o total aparece em "etiquetagens", e não em conversas.
   > 💡 Esta aba tem o seu próprio botão de período, com as mesmas opções de 7, 30 e 90 dias.
2. **Lendo uma linha**  
   A tabela vem da etiqueta mais usada para a menos usada. Em cada linha, "Conversas" é quantas conversas tiveram aquela etiqueta. "Abertas" e "Resolvidas" separam as que ainda estão em andamento das já encerradas. "Espera média" é quanto tempo, em média, o cliente ficou esperando resposta (um traço quer dizer que não deu para medir). "Fatia" é a parte daquela etiqueta no total.
3. **Ir direto às conversas do assunto**  
   Clique no nome de uma etiqueta para abrir a Inbox já filtrada por ela, na aba "Todas". No filtro de etiquetas aparece a etiqueta escolhida. Atenção: a Inbox mostra as conversas com aquela etiqueta de qualquer data, e também as conversas de clientes que têm a etiqueta na ficha do cliente. Por isso podem aparecer mais conversas do que o número da tabela: aqui, "convenio" tinha 2 na tabela e a Inbox mostra 4. Na lista, a etiqueta que aparece embaixo do nome é a da ficha do cliente. A etiqueta posta só na conversa não aparece ali: abra a conversa para vê-la em "Tags da conversa".
