# Curso DeskComm — Admin da plataforma

> Gerado a partir do [curso oficial do DeskComm](https://www.deskcomm.com.br/curso) — versão 1.94.0, gerado em 2026-10-29. Conteúdo do **núcleo do DeskcommCRM (upstream)**; o que o fork de clínicas acrescenta está em [`docs/funcionalidades.md`](../funcionalidades.md). As capturas de tela de cada passo ficam no curso online.

[← Índice do curso](README.md)

## Módulos deste grupo

| Módulo | Tela | Lições | Para que serve |
|---|---|---|---|
| [Dashboard (Admin)](#m-admin-dashboard) | `/admin/dashboard` | 2 | O painel de quem cuida do servidor: em uma tela, os números e os alertas de todas as empresas da instalação. |
| [Inbox (Admin)](#m-admin-inbox) | `/admin/inbox` | 3 | Onde quem cuida do servidor lê as conversas de todas as empresas da instalação, sem responder, para dar suporte. |
| [Tenants (Admin)](#m-admin-tenants) | `/admin/tenants` | 6 | A lista de todas as empresas instaladas no seu servidor: onde você cria uma empresa nova, abre a ficha de cada uma, confere a saúde e o agente dela e, quando precisa, suspende o acesso. |
| [Audit (Admin)](#m-admin-audit) | `/admin/audit` | 3 | O caderno de registro do servidor: cada coisa que muda em qualquer empresa fica anotada aqui, com o quê, quem fez e quando, para você conferir depois. |
| [LGPD (Admin)](#m-admin-lgpd) | `/admin/lgpd` | 3 | A lista dos pedidos de LGPD de todas as empresas do seu servidor (clientes que pedem uma cópia dos seus dados ou que eles sejam apagados), com o prazo e o risco de cada um, para você cobrar quem está atrasado. |
| [Incidents (Admin)](#m-admin-incidents) | `/admin/incidents` | 3 | A lista de problemas do servidor que pedem atenção: o que aconteceu, em qual empresa, quão grave é, e o lugar onde você anota como resolveu. |
| [Usage (Admin)](#m-admin-usage) | `/admin/usage` | 3 | Quanto cada empresa do servidor conversou e gastou com IA, dia a dia e somado, para você saber quem usa mais e quanto custa. |
| [Users (Admin)](#m-admin-users) | `/admin/users` | 3 | A lista de todas as pessoas que fazem parte de alguma empresa do seu servidor, em todas as empresas: quem é, em qual empresa trabalha, com que papel, quando entrou pela última vez e se ainda tem acesso. |
| [Platform Admins (Admin)](#m-admin-platform-admins) | `/admin/platform-admins` | 2 | A lista de quem tem a chave do Admin do seu servidor: quem pode mexer em tudo, quem só olha, quem precisa do código do celular e quem já perdeu o acesso. |
| [Marca (Admin)](#m-admin-marca) | `/admin/marca` | 5 | Onde quem instalou o sistema troca o nome, a cor, o logo e o ícone que aparecem para todas as empresas do servidor, inclusive na tela de entrada. |
| [Google Agenda (Admin)](#m-admin-google) | `/admin/google` | 2 | Onde quem instalou o sistema cadastra, uma vez só, o aplicativo do Google que deixa cada pessoa da equipe ligar a própria agenda do Google à Agenda do CRM. |
| [API Oficial da Meta (Admin)](#m-admin-meta) | `/admin/meta` | 4 | Onde quem instalou o sistema cadastra a chave secreta do aplicativo da Meta e recebe o token que liga o WhatsApp oficial a este servidor, para todas as empresas. |
| [Cadastro (Admin)](#m-admin-cadastro) | `/admin/cadastro` | 3 | Onde quem instalou o sistema decide quem pode criar conta: qualquer pessoa, só quem recebeu convite, ou quem você aprovar um por um. |
| [E-mail (Admin)](#m-admin-email) | `/admin/email` | 3 | Onde quem instalou o sistema escolhe por onde saem os e-mails de todas as empresas deste servidor: convites da equipe, entrega de dados da LGPD e avisos de prazo. |
| [Recursos opcionais (Admin)](#m-admin-sistema) | `/admin/sistema` | 4 | O lugar onde quem instalou o sistema liga os recursos extras, decide como ele se comporta e vê o que depende do servidor, para todas as empresas de uma vez. |
| [Destinos internos (Admin)](#m-admin-destinos-internos) | `/admin/destinos-internos` | 2 | Onde quem cuida do servidor libera, um por um, os endereços da rede interna da própria máquina que o sistema pode chamar, como um serviço que você mesmo instalou ao lado dele. |
| [Credenciais (Admin)](#m-admin-configuracao) | `/admin/configuracao` | 3 | Onde quem instalou o sistema confere as senhas e chaves do servidor e preenche os contatos que todas as empresas veem: o e-mail de suporte e o do encarregado de dados. |
| [Extensões (Admin)](#m-admin-extensoes) | `/admin/extensoes` | 2 | Onde quem instalou o sistema confere, sem mexer em nada, de onde vêm as extensões do servidor, quais estão instaladas e em quantas empresas cada uma está ligada. |
| [Módulos (Admin)](#m-admin-modulos) | `/admin/modulos` | 2 | Onde quem instalou o sistema acrescenta partes extras ao servidor, como Comandas e Honorários, que passam a valer para todas as empresas dele. |
| [Cobrança (Admin)](#m-admin-cobranca) | `/admin/cobranca` | 5 | Onde quem revende o sistema cobra as empresas clientes: conecta a conta de pagamento, cria os planos, define quantos dias de atraso tolerar e acompanha quem está em dia. |
| [Atualização do sistema](#m-atualizacao) | `/app/settings/atualizacao` | 1 | Onde quem instalou o sistema vê a versão em uso, descobre que saiu uma versão nova, lê o que muda e pede a atualização sem abrir o servidor. |

---

<a id="m-admin-dashboard"></a>

## Dashboard (Admin)

**Tela:** `/admin/dashboard`  
**Resumo:** O painel de quem cuida do servidor: em uma tela, os números e os alertas de todas as empresas da instalação.

**Lições:** [Conhecendo o Dashboard do Admin](#l-admin-dashboard--conhecendo-o-dashboard) · [Lendo os alertas](#l-admin-dashboard--alertas-ativos)

<a id="l-admin-dashboard--conhecendo-o-dashboard"></a>

### Conhecendo o Dashboard do Admin

- **Objetivo:** Entender para que serve o Dashboard do Admin e o que cada cartão de número conta.
- **Papel mínimo:** Administrador
- **Busca no curso:** dashboard admin; painel da instalação; visão geral do servidor; todas as empresas; tenants ativos; conversas pendentes; whatsapp caiu; lgpd em risco; gasto de ia

1. **A primeira tela do Admin** — `/admin/dashboard`  
   O Admin é a área de quem cuida da instalação inteira, e não de uma empresa só. O "Dashboard" é a primeira tela do menu: ele junta, num lugar, os números de todas as empresas do servidor. No Admin, cada empresa cadastrada se chama "tenant". A tela se atualiza sozinha a cada 30 segundos, sem você recarregar.
   > 💡 Só quem é administrador da plataforma entra no Admin. Para atendentes, gerentes e até para o administrador de uma empresa, esta área não abre, a menos que a pessoa também seja administradora da plataforma. A faixa amarela "Sem SMTP configurado", no alto, é um aviso geral do Admin: o envio de e-mails ainda não está configurado. O item "E-mail" do menu leva ao ajuste.
2. **Quantas empresas estão ativas**  
   O cartão "Tenants Ativos" conta as empresas que estão funcionando no servidor. Empresas suspensas, arquivadas ou anonimizadas não entram na conta. Aqui são 4: a Clínica Bem Viver e mais três empresas de exemplo.
3. **Clientes esperando uma pessoa**  
   O cartão "Pendentes >10min" soma, em todas as empresas, as conversas marcadas como pendentes (em geral, as que o atendimento automático passou para uma pessoa) em que o cliente escreveu pela última vez há mais de 10 minutos. Quando o número passa de zero, ele fica laranja. Aqui são 54, todas da Rede Sorriso Pleno.
   > 💡 Este cartão não mostra a fila inteira de cada empresa: ele conta só as conversas marcadas como pendentes.
4. **Números de WhatsApp com problema**  
   O cartão "LGPD em Risco" conta os pedidos de clientes sobre os próprios dados (uma cópia ou a exclusão deles) que ainda estão em aberto e cujo prazo vence nos próximos 5 dias ou já venceu. Quando passa de zero, fica vermelho. O cartão "Budgets IA" conta as empresas cujo gasto com IA chegou a 80% ou mais do teto que elas definiram. Repare que ele fala em gasto acumulado: esse número não zera na virada do mês e pode somar o gasto de meses anteriores. O cartão "Alertas WAHA" deveria contar os números de WhatsApp com problema de conexão. Hoje ele fica sempre em zero. Para saber se o número de uma empresa caiu, abra a página de saúde dela e veja o cartão "WAHA", que mostra quantos números estão conectados.
5. **Prazos da LGPD e gasto com IA**  
   O cartão "LGPD em Risco" conta os pedidos de clientes sobre os próprios dados (uma cópia ou a exclusão deles) ainda em aberto e cujo prazo vence nos próximos 5 dias ou já venceu. Quando passa de zero, fica vermelho. O cartão "Budgets IA" conta as empresas cujo gasto com IA chegou a 80% ou mais do teto que elas definiram, e fica laranja quando passa de zero. Repare que ele fala em gasto acumulado: esse número não zera na virada do mês e pode somar o gasto de meses anteriores.
   > 💡 Para ver o gasto do mês de uma empresa, abra a página de saúde dela, como mostra a próxima lição.

<a id="l-admin-dashboard--alertas-ativos"></a>

### Lendo os alertas

- **Objetivo:** Ler a lista de alertas, entender os selos de cada linha e abrir a empresa que precisa de atenção.
- **Papel mínimo:** Administrador
- **Busca no curso:** alertas do servidor; alerta crítico; prazo lgpd vencido; prazo lgpd vencendo; fila de conversas cheia; teto de gasto de ia; empresa com problema

1. **A lista de alertas** — `/admin/dashboard`  
   Abaixo dos cartões fica "Alertas ativos". Cada linha é um alerta, e a mesma empresa pode aparecer em mais de uma linha, e o número no canto diz quantos alertas foram encontrados (a conta vai até 20). Os críticos vêm primeiro; depois, os mais recentes. A lista mostra até 10 linhas e avisa quantos ficaram de fora. Quando não há nada, aparece "Nenhum alerta crítico no momento. Tudo certo!".
2. **Os selos de cada linha**  
   Cada linha traz o nome da empresa e dois selos. O primeiro diz a urgência: "Crítico", em vermelho, ou "Atenção". O segundo diz o assunto: "LGPD" (prazo de pedido de dados), "Overflow" (fila cheia), "IA Budget" (gasto com IA) ou "WAHA" (número de WhatsApp com problema). Embaixo vem a frase que explica o problema. Aqui, a Rede Sorriso Pleno tem um pedido de LGPD com o prazo já vencido.
3. **Prazos que ainda vão vencer**  
   Nem todo alerta de LGPD já está atrasado. A FisioMove Reabilitação aparece com "Atenção" porque tem um pedido ainda aberto cujo prazo termina nos próximos dias. A frase "Prazo LGPD expira em" mostra a data para a equipe se organizar antes de vencer. Clicar nessa linha abre a lista de pedidos na tela "LGPD" do Admin.
4. **Fila cheia numa empresa**  
   O alerta "Overflow" aparece quando uma empresa passa de 50 conversas pendentes, ou seja, passadas para uma pessoa e ainda sem atendimento. Aqui, a Rede Sorriso Pleno tem 54. Costuma ser sinal de que falta gente atendendo naquela empresa.
5. **Empresas perto do teto de IA**  
   Os alertas "IA Budget" aparecem quando o gasto acumulado de uma empresa chega a 80% ou mais do teto. Aqui, a FisioMove está em 92% e a NutriVida em 87%, ambas com "Atenção". A FisioMove escolheu só acompanhar; a NutriVida escolheu parar a IA ao atingir o limite. O gasto acumulado do alerta não prova que a IA parou: o limite considera o gasto do mês. Clique na linha da NutriVida para conferir esse número na página de saúde, no próximo passo.
6. **Abrindo a empresa do alerta**  
   Clicar numa linha leva você à tela com os detalhes do problema. Os alertas de fila e de IA abrem a página de saúde daquela empresa; os de LGPD abrem a tela "LGPD" do Admin. Aqui, o cartão "Orçamento IA" mostra o gasto do mês, que é o que decide se a IA para. Ele está em 0%: os 87% do alerta eram o gasto acumulado. Os outros cartões em amarelo ("WAHA", "Nuvemshop" e "Audit Lag") só dizem que essa empresa de exemplo ainda não ligou esses canais nem tem atividade registrada; não é defeito. Para voltar ao painel, clique em "Dashboard" no menu.
   > 💡 Esta página fica dentro de "Tenants", por isso o menu marca "Tenants" e não "Dashboard".

---

<a id="m-admin-inbox"></a>

## Inbox (Admin)

**Tela:** `/admin/inbox`  
**Resumo:** Onde quem cuida do servidor lê as conversas de todas as empresas da instalação, sem responder, para dar suporte.

**Lições:** [Conhecendo a Inbox do Admin](#l-admin-inbox--conhecendo-a-inbox-do-admin) · [Lendo a conversa de uma empresa](#l-admin-inbox--lendo-uma-conversa) · [Buscando e filtrando conversas](#l-admin-inbox--buscar-e-filtrar)

<a id="l-admin-inbox--conhecendo-a-inbox-do-admin"></a>

### Conhecendo a Inbox do Admin

- **Objetivo:** Entender para que serve a Inbox do Admin e ler o que cada linha da lista mostra.
- **Papel mínimo:** Administrador
- **Busca no curso:** inbox do admin; ver conversas de todas as empresas; suporte aos clientes da instalação; conversas de outra empresa; caixa de entrada geral; ler whatsapp das empresas

1. **Todas as conversas, de todas as empresas** — `/admin/inbox`  
   A "Inbox" do Admin junta numa lista só as conversas de todas as empresas do servidor. No Admin, cada empresa se chama "tenant". Ela serve para suporte: você lê o que aconteceu num atendimento sem precisar entrar na empresa. Aqui não dá para responder; é só leitura.
   > 💡 Só quem é administrador da plataforma vê esta tela. Cada vez que você abre a lista ou uma conversa, isso fica registrado no histórico do Admin, em "Audit". O aviso que fala em "Impersonate" se refere ao botão "Acompanhar organização", que fica na página da empresa (você chega lá na lição "Lendo a conversa de uma empresa").\ A faixa amarela "Sem SMTP configurado", no alto, é um aviso geral do Admin: o envio de e-mails ainda não está configurado. O item "E-mail" do menu leva ao ajuste.
2. **O que cada linha mostra**  
   Cada linha é uma conversa. Em cima vem o nome do cliente e quando chegou a última mensagem: a hora, se foi hoje; há quantos dias, se foi nesta semana; ou a data, se foi antes. Logo abaixo, um selo com um prédio diz de qual empresa é a conversa. Na última linha fica o começo da última mensagem e, quando há, um número com as mensagens ainda não lidas.
3. **O nome curto da empresa**  
   Pare o mouse em cima do selo da empresa para ver o nome curto dela no sistema, o mesmo que aparece ao lado do nome na página da empresa. Ajuda quando duas empresas têm nomes parecidos.
4. **A ordem da lista**  
   A lista mistura as empresas e põe no alto quem escreveu por último. A ordem segue a última mensagem do cliente, e não a da empresa. Aqui, a Rafaela, da Rede Sorriso Pleno, vem antes do Pedro, da Clínica Bem Viver. A lista traz 30 conversas por vez; quando há mais, aparece "Carregar mais" no fim.

<a id="l-admin-inbox--lendo-uma-conversa"></a>

### Lendo a conversa de uma empresa

- **Objetivo:** Abrir uma conversa, ler as mensagens e os dados do cliente e chegar à página da empresa.
- **Papel mínimo:** Administrador
- **Busca no curso:** abrir conversa no admin; ler conversa de outra empresa; ver mensagens do cliente; por que não consigo responder no admin; somente leitura; dados do contato e da empresa

1. **Abrindo a conversa** — `/admin/inbox`  
   Clique numa linha para abrir a conversa no meio da tela. No alto aparecem o nome do cliente, a situação da conversa e a empresa. A situação aparece com a palavra do sistema, em inglês: "Open" é a conversa que ainda ninguém pegou; "Ai_handling", com a IA; "Claimed", com um atendente; "Closed", encerrada.
   > 💡 A tela é só de leitura: aqui não há campo para responder. O aviso no rodapé fala em "Impersonate (em breve)", mas esse recurso já existe e se chama "Acompanhar organização". O último passo desta lição mostra onde ele fica.
2. **As mensagens**  
   As mensagens aparecem na ordem em que foram trocadas, como na Inbox da empresa. As do cliente ficam à esquerda; as da empresa ficam à direita, com o selo de quem mandou: "IA" quando foi a inteligência artificial, "Atendente" quando foi alguém da equipe pelo sistema, "Celular" quando responderam pelo WhatsApp do celular. Aqui aparecem só as 50 mensagens mais recentes; para ver as anteriores, é preciso entrar na empresa com "Acompanhar organização".
3. **Os dados do cliente**  
   À direita, "Contato" mostra o nome e o telefone do cliente. O e-mail aparece com parte escondida, para proteger o cliente. Se o cliente pediu para não receber mais mensagens, aparece o selo "Bloqueado".
4. **De qual empresa é**  
   Embaixo, "Tenant" mostra a empresa dona da conversa: o nome, o nome curto ("Slug") e a situação dela no servidor ("Active" quer dizer ativa). O link "Abrir tenant" leva para a página dessa empresa.
5. **Agir dentro da empresa**  
   Na página da empresa fica o botão "Acompanhar organização". Ele abre a confirmação "Iniciar acompanhamento?". Marque "Somente leitura" se quiser só olhar, sem poder mudar nada; deixe desmarcado para poder agir como alguém da equipe. Ao clicar em "Confirmar e entrar", você cai na Inbox da empresa com a sua identidade de administrador, por até uma hora, e tudo o que fizer fica registrado no seu nome. Os detalhes estão no módulo "Tenants".

<a id="l-admin-inbox--buscar-e-filtrar"></a>

### Buscando e filtrando conversas

- **Objetivo:** Achar uma conversa pelo que foi escrito nela e mostrar só as conversas abertas.
- **Papel mínimo:** Administrador
- **Busca no curso:** buscar conversa no admin; procurar mensagem de cliente; filtrar conversas abertas; achar atendimento de uma empresa; pesquisar pelo texto da mensagem

1. **Buscar pelo que o cliente escreveu** — `/admin/inbox`  
   Digite uma palavra em "Buscar mensagem..." e a lista mostra só as conversas cuja última mensagem tem essa palavra. A busca não olha o nome do cliente nem as mensagens mais antigas. Aqui, "encaixe" achou o Marcos, da Rede Sorriso Pleno.
2. **Filtrar pela situação** — `/admin/inbox`  
   Abaixo da busca fica o filtro de situação, que começa em "Todos". Clique nele para ver as opções. "Aberto" mostra as conversas abertas. "Pendente" e "Resolvido" são situações de uma versão antiga do sistema e, numa instalação de hoje, costumam voltar vazias.
3. **Só as conversas abertas**  
   "Com "Aberto" escolhido, ficam só as conversas que ainda ninguém pegou, nem a IA nem um atendente, de todas as empresas. Saem as que estão com a IA, as que estão com um atendente, as encerradas e as arquivadas. Para ver tudo de novo, volte o filtro para "Todos"." Rótulo do segundo destaque: "Aberta, da Rede Sorriso Pleno".

---

<a id="m-admin-tenants"></a>

## Tenants (Admin)

**Tela:** `/admin/tenants`  
**Resumo:** A lista de todas as empresas instaladas no seu servidor: onde você cria uma empresa nova, abre a ficha de cada uma, confere a saúde e o agente dela e, quando precisa, suspende o acesso.

**Lições:** [Conhecendo a lista de empresas](#l-admin-tenants--conhecendo-a-lista) · [Criando uma empresa nova](#l-admin-tenants--criar-empresa) · [Lendo a ficha de uma empresa](#l-admin-tenants--ficha-da-empresa) · [Editando e acompanhando uma empresa](#l-admin-tenants--editar-e-acompanhar) · [Conferindo a saúde e o agente de uma empresa](#l-admin-tenants--saude-e-agente) · [Suspendendo, reativando e excluindo](#l-admin-tenants--suspender-reativar-excluir)

<a id="l-admin-tenants--conhecendo-a-lista"></a>

### Conhecendo a lista de empresas

- **Objetivo:** Ler a lista de empresas do servidor, entender a situação de cada uma e filtrar a lista pela situação.
- **Papel mínimo:** Administrador
- **Busca no curso:** lista de empresas; tenants; clientes do servidor; empresas instaladas; ver empresas suspensas; situação da empresa

1. **Todas as empresas do servidor** — `/admin/tenants`  
   No Admin, "Tenants" é o nome dado às empresas instaladas no seu servidor. Cada clínica que usa o sistema aqui é um tenant. Esta tela lista todas elas, das mais novas para as mais antigas. Logo abaixo do título aparece quantas empresas a lista mostra.
   > 💡 A lista carrega 30 empresas por vez. Quando há mais, o número ganha um "+" e aparece o botão "Carregar mais" no fim da tabela.
2. **O que cada coluna diz**  
   Cada linha é uma empresa. "Slug" é o apelido curto dela no sistema, sem espaços nem acentos. "Nome" é como ela aparece para a equipe. "CNPJ" mostra só o começo do número. "Users" conta os acessos ligados à empresa, inclusive os de quem já perdeu o acesso. "Conversas" conta as conversas dela. "Criado em" é o dia em que a empresa foi criada no servidor.
3. **A situação de cada empresa**  
   A coluna "Status" diz como a empresa está. "Ativo": funcionando normalmente. "Onboarding": a empresa existe, mas a configuração inicial ainda não foi concluída. "Suspenso": o acesso foi cortado, e a equipe dela não entra. "Redigido": os dados pessoais da empresa foram apagados por pedido de LGPD.
4. **Os atalhos de cada linha**  
   No fim de cada linha há três atalhos. O olho abre a página de saúde da empresa. O lápis abre a ficha, onde você também edita os dados. O botão de pausa abre a confirmação para suspender a empresa, sem sair da lista. Numa empresa suspensa pelo admin, ele vira um botão de "Reativar". Se a empresa foi suspensa por falta de pagamento, ele vira um ícone de recibo que leva à ficha. Numa empresa redigida, só existe o link "Ver", que abre a ficha.
5. **Filtrando pela situação**  
   O seletor ao lado do campo de busca mostra só as empresas de uma situação. Ele começa em "Todos os status". Escolha "Ativo", "Onboarding", "Suspenso" ou "Redigido" para ver só aquelas empresas.
6. **Só as suspensas**  
   Com "Suspenso" escolhido, a lista mostra só as empresas com o acesso cortado. Para voltar a ver todas, abra o seletor de novo e escolha "Todos os status".

<a id="l-admin-tenants--criar-empresa"></a>

### Criando uma empresa nova

- **Objetivo:** Preencher o cadastro de uma empresa nova e saber o que acontece quando ela é criada.
- **Papel mínimo:** Administrador
- **Busca no curso:** criar empresa nova; novo tenant; cadastrar cliente no servidor; nova organização; convidar dono da empresa; adicionar clínica

1. **O botão de criar** — `/admin/tenants`  
   Para colocar uma empresa nova no servidor, clique em "Novo tenant", no alto da lista.
2. **O nome e o slug**  
   Comece pelo "Nome de exibição", que é como a equipe vê a empresa. Enquanto você digita, o sistema monta o "Slug" sozinho: o mesmo nome em minúsculas, sem acentos e com hífens no lugar dos espaços. Você pode trocar o slug à mão. Se ele já existir em outra empresa, o sistema avisa ao criar.
3. **Os dados da empresa e do responsável**  
   "Razão social" e "CNPJ" são opcionais; sem razão social, o sistema usa o nome de exibição. O "Plano" (Standard, Pro ou Enterprise) é só uma etiqueta para você organizar: ele não cobra nem limita nada. Se a Cobrança estiver ligada no seu servidor, no lugar dele aparece "Plano de cobrança", e aí o plano escolhido cobra de verdade. Em "E-mail do responsável", coloque o e-mail da pessoa que vai ser a dona da empresa no sistema.
4. **O que o responsável vai ver no menu**  
   Em "Interface" você escolhe quais áreas aparecem no menu do responsável. "Completa" mostra todas; "Simplificada" mostra menos áreas, para quem está começando. Em "Personalizar áreas visíveis" dá para marcar uma a uma. Isso só muda o menu: o que a pessoa pode fazer continua definido pelo cargo dela.
5. **Criar a empresa**  
   Confira os dados e clique em "Criar organização". A empresa é criada e aparece na lista como "Onboarding" até a configuração inicial ser concluída. Você entra nela como administrador, para fazer essa configuração. O responsável recebe um convite para ser o dono: a tela mostra o link do convite e o botão "Copiar convite", e, se o servidor tiver e-mail configurado, o convite também vai por e-mail. O convite tem prazo de validade. O seu acesso à empresa é provisório e sai quando o dono aceitar.
   > 💡 "Cancelar" volta para a tela anterior sem criar nada.

<a id="l-admin-tenants--ficha-da-empresa"></a>

### Lendo a ficha de uma empresa

- **Objetivo:** Abrir a ficha de uma empresa e entender os dados, os números, as integrações e a equipe dela.
- **Papel mínimo:** Administrador
- **Busca no curso:** ficha da empresa; detalhes do tenant; quantas conversas a empresa tem; equipe de uma empresa; alterar e-mail de acesso; dados da empresa no admin

1. **Abrindo a ficha** — `/admin/tenants`  
   Para ver tudo sobre uma empresa, clique no lápis da linha dela. Aqui vamos abrir a ficha da Clínica Bem Viver.
2. **O topo da ficha**  
   No topo ficam o nome da empresa, o slug e a situação. Logo abaixo, as abas: "Visão Geral" (esta), "Saúde" e "Agente". As abas "Equipe" e "Uso" ainda não funcionam e mostram "em breve". O link "Tenants", acima do nome, volta para a lista.
3. **Informações e volumes**  
   O quadro "Informações" mostra o plano, a razão social, o CNPJ, "Onboarding concluído" (o dia em que a configuração inicial terminou) e "Criado em". Numa empresa suspensa, aparece também "Suspenso em". Em "Volumes" ficam os totais da empresa: usuários, conversas, mensagens, leads e pedidos.
4. **Integrações, LGPD e IA**  
   Em "Integrações", você vê a situação da loja Nuvemshop e, em "WAHA sessions", quantos canais de atendimento a empresa tem cadastrados, conectados ou não. Em "Compliance & IA", ficam os pedidos de LGPD ainda abertos, que ganham um alerta amarelo quando existem, e quantas vezes a IA foi usada nos últimos 30 dias.
5. **A equipe e os e-mails de acesso**  
   "Membros e e-mails de acesso" lista as pessoas ligadas a esta empresa, com o e-mail de login e o cargo. Selos mostram quem é o "Dono", quem é "Admin da plataforma" e quem teve o "Acesso revogado". É aqui que você corrige o e-mail de quem se cadastrou errado: "Alterar e-mail" troca o endereço de login e de recuperação de senha, e a empresa recebe um aviso. O botão fica apagado para quem é admin da plataforma, que só troca o e-mail pela própria conta, e para quem já teve o acesso revogado.

<a id="l-admin-tenants--editar-e-acompanhar"></a>

### Editando e acompanhando uma empresa

- **Objetivo:** Usar o quadro de ações da ficha para corrigir os dados de uma empresa e para entrar nela como ela vê.
- **Papel mínimo:** Administrador
- **Busca no curso:** editar dados da empresa; entrar como a empresa; acompanhar organização; ver o sistema como o cliente; corrigir cnpj da empresa; suporte ao cliente

1. **O quadro de ações** — `/admin/tenants/a7000000-0000-4000-8000-000000000001`  
   À direita da ficha fica o quadro "Ações". "Acompanhar organização" deixa você entrar na empresa para ver o que a equipe vê. "Editar dados" corrige o cadastro. "Suspender tenant" corta o acesso; ele tem uma lição só para ele. Para excluir uma empresa, é preciso suspendê-la primeiro.
2. **Corrigindo os dados**  
   "Editar dados" abre os mesmos campos que o administrador da empresa vê em Configurações › Empresa: nome, razão social, CNPJ, e-mail do responsável pelos dados pessoais (DPO), fuso horário, idioma, moeda, país, a limpeza automática da mídia antiga (e depois de quantos dias ela apaga) e o endereço da política de privacidade. Altere o que precisar e clique em "Salvar". Fechar a janela não muda nada.
3. **Entrando na empresa para ajudar** — `/admin/tenants/a7000000-0000-4000-8000-000000000001`  
   "Acompanhar organização" pede confirmação antes. Ao clicar em "Confirmar e entrar", você vai para a Inbox da empresa, com a sua própria identidade: tudo o que você fizer fica registrado no seu nome. O acesso dura até uma hora. Marque "Somente leitura" para só olhar, sem poder mudar nada.
   > 💡 Use isto para ver um problema exatamente como o cliente vê, sem pedir a senha dele.

<a id="l-admin-tenants--saude-e-agente"></a>

### Conferindo a saúde e o agente de uma empresa

- **Objetivo:** Ler os quatro cartões de saúde de uma empresa e ver qual agente de IA ela tem publicado.
- **Papel mínimo:** Administrador
- **Busca no curso:** saúde da empresa; whatsapp da empresa desconectado; gasto de ia do cliente; agente publicado da empresa; empresa com problema; teto de gasto ia

1. **Abrindo a saúde pela lista** — `/admin/tenants`  
   O olho, no fim da linha, abre direto a página de saúde da empresa. Vamos ver a FisioVida Reabilitação.
2. **Os quatro cartões**  
   A aba "Saúde" tem quatro cartões, cada um com um selo: "OK" em verde, "Atenção" em amarelo ou "Crítico" em vermelho. A página se atualiza sozinha a cada minuto, e o horário da última leitura fica no canto.
3. **O WhatsApp e a loja**  
   O cartão "WAHA" mostra quantos canais de WhatsApp da empresa estão conectados, do total. Aqui é "0/1 conectada": o único número está parado, por isso o selo é "Crítico". Sem nenhum número, o selo é "Atenção". O cartão "Nuvemshop" diz se a loja virtual está ligada e quando o acesso a ela vence. Empresa que não usa loja virtual aparece como "Não conectado", com selo "Atenção": nesse caso, não há nada a resolver.
4. **O gasto com IA e os registros**  
   "Orçamento IA" compara o gasto do mês com o teto da empresa, em dólares. A FisioVida já usou 92%. O selo fica em "Atenção" a partir de 80%. Só vira "Crítico" quando chega a 100% e o teto está no modo que para a IA; aqui o "Limite" é "Só avisa". Com o limite "Não aplicado", o selo fica sempre em "OK". "Audit Lag" mostra há quanto tempo foi gravado o último registro de atividade da empresa: até 2 minutos é "OK", e acima de 10 minutos vira "Crítico".
   > 💡 Abrir a ficha ou esta página também grava um registro na empresa. Por isso, logo depois de você olhar, o "Audit Lag" tende a mostrar poucos segundos.
5. **O agente de IA da empresa**  
   A aba "Agente" lista os agentes de IA da empresa. Cada um mostra se está ativo e qual versão está publicada. Na FisioVida, o agente está "Inativo" e nunca foi publicado, por isso aparece "Nenhum agente publicado": a IA dela não atende ninguém. "Tipo" mostra um nome técnico; "rag_bot" é o agente de atendimento. Esta aba é só para consultar: mudar o agente se faz dentro da empresa.
6. **Um agente no ar** — `/admin/tenants/a7000000-0000-4000-8000-000000000001/agent`  
   Na Odonto Sorriso Leve, o agente "Lia — Atendimento Sorriso Leve" está "Ativo". Em "Versão publicada", "v3 · anthropic · claude-sonnet-4-6" quer dizer: versão 3, usando a IA da Anthropic, no modelo claude-sonnet-4-6. "Publicado em" diz desde quando essa é a versão em uso. Para ela responder de fato, a empresa também precisa estar com o WhatsApp conectado.

<a id="l-admin-tenants--suspender-reativar-excluir"></a>

### Suspendendo, reativando e excluindo

- **Objetivo:** Saber cortar o acesso de uma empresa, devolver o acesso e, no fim, excluí-la de vez.
- **Papel mínimo:** Administrador
- **Busca no curso:** suspender empresa; cortar acesso do cliente; reativar empresa suspensa; excluir empresa do servidor; apagar tenant; cliente cancelou contrato

1. **Suspender pela lista** — `/admin/tenants`  
   O botão de pausa, no fim da linha, suspende a empresa sem sair da lista. Ele abre uma confirmação com o nome da empresa, para não suspender a errada.
2. **O que a suspensão faz**  
   Leia o aviso com atenção: a equipe da empresa perde o acesso, e a IA, os envios e as automações dela param. Mensagens na fila e tarefas agendadas são descartadas e não saem quando ela voltar; os follow-ups em andamento ficam parados e retomam de onde pararam quando ela for reativada. As mensagens que chegarem continuam gravadas. Escreva o motivo (pelo menos 10 caracteres) e clique em "Confirmar suspensão". Para desistir, use "Cancelar".
   > 💡 "Cancelar", à esquerda do botão vermelho, fecha a janela sem suspender.
3. **Uma empresa suspensa** — `/admin/tenants/a7000000-0000-4000-8000-000000000004`  
   Na ficha de uma empresa suspensa aparece uma faixa amarela no topo, com quando ela foi suspensa. No quadro "Ações", a frase "Suspensão administrativa" diz que foi o admin que suspendeu. No lugar de "Suspender tenant", aparecem "Reativar tenant" e "Excluir tenant".
   > 💡 A faixa sempre diz "Sem razão registrada", mesmo quando você escreveu um motivo. O motivo fica guardado no histórico do Admin, na tela "Audit".
4. **Devolvendo o acesso**  
   "Reativar tenant" pede o motivo da reativação, que fica registrado no histórico do Admin. Ao clicar em "Confirmar reativação", a equipe volta a entrar.
5. **Excluindo de vez** — `/admin/tenants/a7000000-0000-4000-8000-000000000004`  
   "Excluir tenant" apaga a empresa e todos os dados dela, sem volta: conversas, mensagens, leads, arquivos, agentes e integrações. Os números de WhatsApp são desconectados, e os logins de quem só trabalhava nesta empresa são removidos; quem participa de outra empresa continua. Para liberar "Excluir definitivamente", escreva o motivo e digite o slug da empresa, que aparece logo acima do campo.

---

<a id="m-admin-audit"></a>

## Audit (Admin)

**Tela:** `/admin/audit`  
**Resumo:** O caderno de registro do servidor: cada coisa que muda em qualquer empresa fica anotada aqui, com o quê, quem fez e quando, para você conferir depois.

**Lições:** [Conhecendo o registro](#l-admin-audit--conhecendo-o-registro) · [Achando um evento com os filtros](#l-admin-audit--filtrando-o-registro) · [Lendo a página de um evento](#l-admin-audit--lendo-um-evento)

<a id="l-admin-audit--conhecendo-o-registro"></a>

### Conhecendo o registro

- **Objetivo:** Abrir o registro de auditoria, entender o que cada coluna diz e carregar eventos mais antigos.
- **Papel mínimo:** Administrador
- **Busca no curso:** registro de auditoria; audit log; quem mudou o quê; histórico de alterações; o que aconteceu no sistema; rastrear ação de usuário

1. **O caderno de registro do servidor** — `/admin/audit`  
   "Audit" é o registro de auditoria: um caderno onde o sistema anota sozinho cada coisa importante que acontece no servidor, em todas as empresas. Uma conversa transferida, um convite feito, um agente publicado, uma empresa suspensa: tudo vira uma linha aqui. Pelo sistema, ninguém consegue editar nem apagar uma linha. Só a limpeza automática tira as muito antigas, por padrão depois de 5 anos. Abaixo do título aparece quantos eventos a lista está mostrando.
   > 💡 A lista traz 50 eventos por vez, dos mais novos para os mais antigos. Quando há mais, o número ganha um "+".
2. **O que cada coluna diz**  
   Cada linha é um evento. "Quando" diz há quanto tempo ele aconteceu. "Action" é o código do que aconteceu, em inglês: "auth.login_success" é uma entrada no sistema, "conversation.transferred" é uma conversa transferida. "Tenant" é o apelido da empresa onde aconteceu. "Actor" é o código de quem fez, e "Recurso" é o tipo da coisa mexida, com o começo do código dela. Um traço quer dizer que a informação não existe: sem empresa (como uma entrada no sistema, ou quando a empresa já foi apagada) ou sem pessoa (quando foi o próprio sistema ou uma integração ligada por chave de acesso).
   > 💡 Consultar o registro também vira linha: cada vez que a lista carrega (ao abrir a tela, mudar um filtro ou carregar mais) entra um "platform_admin.audit_listed", e abrir um evento grava "platform_admin.audit_entry_viewed".
3. **Ver os detalhes de um evento**  
   No fim de cada linha, o botão "Ver" abre a página do evento, com tudo o que foi anotado: a data e a hora exatas, quem fez (com parte do e-mail escondida), a empresa e os detalhes da mudança. Você aprende a ler essa página na última lição.
4. **Eventos mais antigos**  
   Role a lista até o fim. Quando existem mais eventos do que os 50 mostrados, aparece o botão "Carregar mais": cada clique traz os 50 seguintes, mais antigos, para baixo da lista. Para achar algo específico sem rolar tanto, use os filtros, que você vê na próxima lição.

<a id="l-admin-audit--filtrando-o-registro"></a>

### Achando um evento com os filtros

- **Objetivo:** Recortar o registro por empresa e por tipo de ação, conhecer os filtros de pessoa e de data e limpar tudo.
- **Papel mínimo:** Administrador
- **Busca no curso:** filtrar auditoria por empresa; procurar evento no registro; quem transferiu a conversa; filtrar por data; filtrar por usuário; limpar filtros

1. **Só uma empresa** — `/admin/audit`  
   Clique em "Tenants" para escolher de quais empresas ver os eventos. Abre uma lista com as empresas do servidor, nome e apelido, e uma busca no alto. Clique numa empresa para marcá-la; dá para marcar mais de uma. Aqui vamos marcar a Clínica Bem Viver.
   > 💡 A lista mostra até 30 empresas. Se a que você procura não aparece, filtre por pessoa ou por data.
2. **O filtro ligado**  
   Com a empresa marcada, o botão "Tenants" mostra quantas estão escolhidas e a lista passa a trazer só os eventos dela. Clique fora da caixinha para fechá-la. O mesmo botão desmarca: abra de novo e clique na empresa, ou use "Limpar seleção".
3. **Só um tipo de ação**  
   "Actions" filtra pelo que aconteceu. A lista traz todos os códigos que o sistema registra, e a busca recorta por família: digite "conversation." para ver só os eventos de conversa. "conversation.transferred" é a transferência de uma conversa para outra pessoa da equipe.
4. **Os dois filtros juntos**  
   Os filtros se somam: agora a lista mostra só as transferências de conversa da Clínica Bem Viver. Cada linha diz há quanto tempo foi e o código de quem fez. Para saber quem recebeu a conversa e por quê, abra o evento em "Ver".
5. **Pessoa, datas e limpar**  
   No campo "Actor (user ID)" você cola o código completo de uma pessoa para ver só o que ela fez; o código aparece na coluna "Actor" e na página de cada evento. Os dois campos de data limitam o período: o primeiro é o início e o segundo, o fim. Com qualquer filtro ligado aparece "Limpar", que desliga tudo de uma vez: empresas, ações, pessoa e datas.
   > 💡 Com o código da pessoa pela metade, a lista fica vazia: o filtro só funciona com o código inteiro. Depois do "Limpar", os campos de data continuam mostrando a data digitada, mesmo sem filtrar mais nada. Apague-os à mão para não se confundir.

<a id="l-admin-audit--lendo-um-evento"></a>

### Lendo a página de um evento

- **Objetivo:** Ler tudo o que foi anotado sobre um evento: o quê, quando, quem, em qual empresa e o que mudou, e ir até a coisa que foi mexida.
- **Papel mínimo:** Administrador
- **Busca no curso:** detalhes do evento de auditoria; quem fez essa alteração; e-mail de quem mudou; o que mudou exatamente; abrir conversa pelo registro; ver empresa do evento

1. **O que aconteceu e quando** — `/admin/audit/ad100000-0000-4000-8000-000000000001`  
   Esta é a página que abre ao clicar em "Ver" numa linha do registro. Aqui, a transferência de uma conversa na Clínica Bem Viver. No alto ficam o código da ação, o apelido da empresa e, logo abaixo, a data e a hora exatas, seguidas de há quanto tempo foi. "Audit Log", acima do título, volta para a lista.
   > 💡 Quando quem fez estava agindo como administrador do servidor, aparece ao lado do título o selo "Platform Admin".
2. **O que mudou**  
   "Metadata" guarda os detalhes da mudança, do jeito que o sistema anotou. Nesta transferência, "to_user_id" é o código da pessoa que recebeu a conversa e "note" é o motivo escrito por quem transferiu. Logo abaixo, "Resource Type" e "Resource ID" dizem qual coisa foi mexida; aqui, uma conversa. "negocio_aberto" diz o que aconteceu com o negócio do contato: "sem_negocio_aberto" quer dizer que ele não tinha negócio aberto, então nada mudou no funil.
   > 💡 "Actor IP" e "User Agent" mostram o endereço e o navegador de quem fez, quando o sistema anotou; o traço quer dizer que não foi anotado. "Request ID" é o número do pedido, útil para o suporte achar o caso nos registros técnicos. "Bypassed RLS" = "Sim" diz que a ação passou por cima da separação entre empresas, como fazem as ações do administrador do servidor.
3. **Quem fez e em qual empresa**  
   O quadro "Actor" mostra quem fez: o código da pessoa e o e-mail dela, com o começo trocado por asteriscos por segurança. O quadro "Tenant" mostra a empresa onde aconteceu: nome, apelido e situação ("active" é ativa, "suspended" é suspensa, "archived" é arquivada). O botão "Ver tenant" abre a ficha dessa empresa.
4. **Ir até a conversa**  
   Quando a coisa mexida é uma conversa ou uma empresa, aparece o quadro "Recurso". O botão "Abrir recurso" leva direto até ela: aqui, abre a conversa na Inbox do Admin, para você ler o que aconteceu antes e depois da transferência.

---

<a id="m-admin-lgpd"></a>

## LGPD (Admin)

**Tela:** `/admin/lgpd`  
**Resumo:** A lista dos pedidos de LGPD de todas as empresas do seu servidor (clientes que pedem uma cópia dos seus dados ou que eles sejam apagados), com o prazo e o risco de cada um, para você cobrar quem está atrasado.

**Lições:** [Conhecendo a lista de pedidos](#l-admin-lgpd--conhecendo-a-lista) · [Achando os pedidos que precisam de atenção](#l-admin-lgpd--filtrando-os-pedidos) · [Abrindo um pedido](#l-admin-lgpd--abrindo-um-pedido)

<a id="l-admin-lgpd--conhecendo-a-lista"></a>

### Conhecendo a lista de pedidos

- **Objetivo:** Ler a lista de pedidos de LGPD de todas as empresas do servidor e entender o aviso vermelho, o prazo, o risco e a situação de cada pedido.
- **Papel mínimo:** Administrador
- **Busca no curso:** pedidos de lgpd; lgpd de todas as empresas; cliente pediu para apagar dados; cliente pediu cópia dos dados; prazo da lgpd; pedido de lgpd atrasado; proteção de dados

1. **Os pedidos de todas as empresas** — `/admin/lgpd`  
   Pela LGPD, o cliente de uma empresa pode pedir uma cópia dos dados que ela guarda sobre ele, ou pedir que esses dados sejam apagados (o sistema os torna anônimos: o nome vira "Cliente Anonimizado"). Hoje esses pedidos só chegam pela loja virtual Nuvemshop ligada à empresa; se nenhuma empresa tem loja Nuvemshop ligada, a lista fica vazia. Esta tela junta os pedidos de TODAS as empresas do seu servidor (é isso que "Cross-tenant" quer dizer). Abaixo do título aparece quantos pedidos a lista mostra.
   > 💡 A lista vem ordenada pelo prazo: quem vence primeiro aparece em cima. Ela carrega 50 pedidos por vez; quando há mais, o número ganha um "+" e aparece o botão "Carregar mais" no fim. A faixa amarela "Sem SMTP configurado", no alto, é um aviso geral do Admin: o envio de e-mails ainda não está configurado. O item "E-mail" do menu leva ao ajuste.
2. **O aviso vermelho**  
   O aviso vermelho no topo só aparece quando existe pedido ainda aberto que já passou do prazo ou que vence em menos de 24 horas. Ele mostra quantos são. Pedidos concluídos ou que falharam não entram nessa conta. Quando nenhum pedido está nessa situação, o aviso some.
   > 💡 Para ver só os pedidos vencidos, use o filtro de risco, que você aprende na próxima lição. O link "Ver detalhes" do aviso ainda não aplica esse filtro: ele recarrega a mesma lista completa.
3. **O que cada coluna diz**  
   Cada linha é um pedido. "ID" é o código curto do pedido. "Tipo" diz o que foi pedido: "Solicitação de dados" (o cliente quer uma cópia dos dados), "Anonimização cliente" (o cliente quer que os dados dele sejam tornados anônimos) ou "Anonimização tenant" (a empresa desinstalou o aplicativo da loja Nuvemshop, e os dados de todos os clientes dela serão tornados anônimos). "Tenant" é a empresa que recebeu o pedido. "Recebido em" diz há quanto tempo ele chegou.
4. **Prazo e risco**  
   A empresa tem 7 dias úteis para entregar uma cópia dos dados e 15 dias úteis para torná-los anônimos. "Vence em" conta quanto falta até o fim do último dia do prazo, ou há quantas horas ele passou ("em atraso"). "Risco" resume isso num selo: "OK" (dentro do prazo), "Alerta" (mais da metade do prazo já passou), "Crítico" (vence em menos de 24 horas) e "Vencido" (o prazo passou).
   > 💡 Pedido concluído ou que falhou mostra "—" em "Vence em": não há mais prazo a contar. Mas o selo de risco olha só a data: um pedido já concluído também fica "Vencido" depois que o prazo passa. Antes de cobrar, confira a coluna "Status". No horário de Brasília, o prazo acaba às 21h do último dia.
5. **A situação de cada pedido**  
   A coluna "Status" diz em que pé o pedido está. "Recebido": chegou e ainda não começou a ser feito (o pedido de cópia dos dados espera alguém da empresa aprovar). "Processando": está sendo feito. "Revisão": travou e precisa que alguém da empresa resolva à mão. "Concluído": terminou. "Falhou": deu erro e o sistema desistiu depois de várias tentativas.

<a id="l-admin-lgpd--filtrando-os-pedidos"></a>

### Achando os pedidos que precisam de atenção

- **Objetivo:** Usar os filtros de situação, tipo e risco para ver só os pedidos que importam agora, e voltar à lista completa.
- **Papel mínimo:** Administrador
- **Busca no curso:** filtrar pedidos de lgpd; ver pedidos vencidos; pedidos de lgpd atrasados; filtro de risco lgpd; pedidos em revisão; limpar filtros lgpd

1. **Os três filtros** — `/admin/lgpd`  
   Acima da lista ficam três filtros. O primeiro escolhe a situação do pedido, o segundo o tipo de pedido e o terceiro o risco do prazo. Eles começam em "Todos os status", "Todos os tipos" e "Todos os riscos", ou seja, sem filtro. Clique no filtro de risco para abrir as opções.
2. **Ver só os vencidos**  
   As opções são as mesmas do selo de risco: "Vencido", "Crítico (<24h)", "Alerta (>50%)" e "OK". Escolha "Vencido" para ver só os pedidos cujo prazo já passou. Os que ainda não estão em "Concluído" são os primeiros a cobrar da empresa.
3. **A lista filtrada**  
   Agora a lista mostra só os pedidos vencidos, de todas as empresas, e o número abaixo do título conta só eles. Enquanto houver algum filtro ligado, aparece ao lado dos filtros o selo "Limpar filtros". Clique nele para voltar à lista completa.
4. **Pedidos que travaram**  
   Outro filtro útil é o de situação. Escolha "Revisão" no primeiro filtro para ver os pedidos que travaram e esperam alguém da empresa resolver à mão. Aqui aparece o pedido da Odonto Sorriso Leve. A próxima lição abre esse pedido para ver o motivo.
   > 💡 Os filtros podem ser combinados: situação, tipo e risco ao mesmo tempo.

<a id="l-admin-lgpd--abrindo-um-pedido"></a>

### Abrindo um pedido

- **Objetivo:** Abrir a ficha de um pedido de LGPD, ler o prazo, os detalhes e o histórico, e entender por que ele travou.
- **Papel mínimo:** Administrador
- **Busca no curso:** abrir pedido de lgpd; detalhes do pedido lgpd; histórico do pedido lgpd; por que o pedido travou; prazo do pedido de dados; quem aprova pedido lgpd

1. **Abrir a ficha** — `/admin/lgpd`  
   Cada linha tem um botão "Ver" no fim. Ele abre a ficha completa do pedido. Clique em "Ver" no pedido da Odonto Sorriso Leve, que está em revisão.
2. **O topo da ficha**  
   No topo ficam o código do pedido, a situação ("Revisão pendente"), o tipo e a empresa. Logo abaixo aparecem o dia em que o pedido chegou e o último dia do prazo. A frase em itálico avisa que esta ficha é só para leitura: quem aprova ou resolve o pedido é o administrador da própria empresa, na tela de LGPD dela.
3. **A linha do tempo do prazo**  
   O quadro "Linha do tempo SLA" mostra o prazo em forma de barra. À esquerda, há quantos dias o pedido chegou ("D+" e o número de dias); à direita, quantos dias faltam até o último dia do prazo. A barra fica verde, amarela quando três quartos do prazo já passaram, e vermelha quando ele acaba. Abaixo vêm as etapas de referência; a bolinha fica verde quando a data dela já passou.
   > 💡 As datas das etapas contam dias corridos desde a chegada, mas o prazo conta só dias úteis. Por isso "Entrega ao titular" pode cair antes do prazo real. A data que vale é a de "Vence em", no topo da ficha.
4. **Os detalhes e o motivo da trava**  
   O quadro "Detalhes" mostra o código completo, o tipo, a situação, de onde o pedido veio ("Origem"), quantas vezes o sistema tentou fazê-lo ("Tentativas") e a empresa. Quando algo deu errado, aparece no fim desse quadro uma caixa vermelha "Erro". Aqui ela diz "email_not_configured": o arquivo com os dados do cliente foi gerado, mas o servidor não tem envio de e-mail configurado, então ele não foi entregue ao cliente. "Escopo" diz se o pedido é de um cliente só ("contact") ou da loja inteira; "Slug" é o apelido da empresa no endereço do sistema; "External customer ID" é o número do cliente na Nuvemshop.
   > 💡 O envio de e-mail do servidor é configurado na tela "E-mail" do menu do Admin. O aviso "Sem SMTP configurado", no alto, lembra disso enquanto ele não estiver pronto. Configurar o e-mail não reenvia este pedido: o arquivo já gerado fica com a empresa, que o baixa na tela de LGPD dela e entrega ao cliente.
5. **O histórico do pedido**  
   O quadro "Trilha de auditoria" lista o que aconteceu com o pedido, do mais antigo para o mais novo, com data e hora: a chegada ("lgpd.data_request_received"), a aprovação pela empresa ("lgpd.manually_approved") e a geração do arquivo ("lgpd.export_generated"). Quando o registro guarda quem fez a ação, aparece "por" e o começo do código da pessoa. Cada vez que alguém abre esta ficha, isso também é registrado ("platform_admin.lgpd_request_viewed") e aparece aqui numa abertura seguinte (se reabrir logo em seguida, recarregue a página para ver).
   > 💡 Para voltar à lista, use "LGPD Cross-tenant", no alto da ficha.

---

<a id="m-admin-incidents"></a>

## Incidents (Admin)

**Tela:** `/admin/incidents`  
**Resumo:** A lista de problemas do servidor que pedem atenção: o que aconteceu, em qual empresa, quão grave é, e o lugar onde você anota como resolveu.

**Lições:** [Conhecendo a lista de incidentes](#l-admin-incidents--conhecendo-os-incidentes) · [Filtrando por situação e gravidade](#l-admin-incidents--filtrando-incidentes) · [Lendo e resolvendo um incidente](#l-admin-incidents--resolvendo-um-incidente)

<a id="l-admin-incidents--conhecendo-os-incidentes"></a>

### Conhecendo a lista de incidentes

- **Objetivo:** Abrir a lista de incidentes e entender o que cada coluna diz.
- **Papel mínimo:** Administrador
- **Busca no curso:** incidentes; problemas no servidor; falhas registradas na instalação; alerta crítico; o que deu errado no sistema; lista de erros

1. **A lista de problemas do servidor** — `/admin/incidents`  
   "Incidents" é a lista de incidentes: o lugar feito para registrar problemas do servidor que pedem a atenção de quem administra, como um número de WhatsApp que caiu. Nesta versão, porém, nada no sistema abre um incidente sozinho, então numa instalação nova a lista vem vazia. A tela abre mostrando só os incidentes abertos, ou seja, os que ainda ninguém resolveu. Abaixo do título aparece quantos estão na lista.
   > 💡 Nesta versão, nenhuma parte do sistema abre incidentes sozinha: numa instalação nova esta lista aparece vazia, com o aviso "Nenhum incidente encontrado". Os incidentes deste curso são exemplos, colocados para mostrar como a tela funciona.
2. **O que cada coluna diz**  
   Cada linha é um incidente. "Quando" diz há quanto tempo ele foi aberto. "Tipo" é o código do problema, em inglês. "Tenant" é a empresa onde aconteceu; o traço quer dizer que o problema é do servidor inteiro, não de uma empresa. "Severidade" diz a gravidade: "Crítico", "Atenção" ou "Info" (só para você saber). "Status" diz em que pé está: "Aberto" ou "Resolvido".
   > 💡 Os mais novos aparecem primeiro. A lista traz 30 por vez; quando há mais, o número ganha um "+" e aparece o botão "Carregar mais" no fim.
3. **Abrir um incidente**  
   No fim de cada linha, "Ver" abre a página do incidente, com os detalhes do problema e o botão para resolvê-lo. Você aprende essa página na última lição.

<a id="l-admin-incidents--filtrando-incidentes"></a>

### Filtrando por situação e gravidade

- **Objetivo:** Ver os incidentes já resolvidos, recortar só os críticos e desligar o filtro.
- **Papel mínimo:** Administrador
- **Busca no curso:** ver incidentes resolvidos; filtrar incidentes críticos; histórico de problemas resolvidos; filtrar por gravidade; limpar filtros de incidentes

1. **Escolher a situação** — `/admin/incidents`  
   O primeiro filtro escolhe a situação dos incidentes. Ele começa em "Abertos". "Resolvidos" mostra os que alguém já resolveu. "Reconhecidos" é para os que alguém já viu mas ainda não resolveu; nesta versão nenhum botão da tela marca um incidente assim, então essa lista fica vazia. Clique em "Resolvidos".
2. **O histórico do que foi resolvido**  
   Agora a lista mostra só os incidentes resolvidos, com o selo verde "Resolvido". Abrindo um deles em "Ver", você lê a anotação de quem resolveu, explicando o que foi feito.
3. **Escolher a gravidade**  
   O segundo filtro recorta pela gravidade: "Crítico", "Atenção" ou "Info". Ele começa em "Todas severidades". Vamos voltar para os abertos e ver só os críticos, os que pedem ação primeiro. Clique em "Crítico".
4. **Os dois filtros juntos, e limpar**  
   Os filtros se somam: agora a lista mostra só os incidentes abertos e críticos. Com a gravidade escolhida aparece "Limpar filtros", que volta para todas as gravidades. A situação escolhida no primeiro filtro continua como está.

<a id="l-admin-incidents--resolvendo-um-incidente"></a>

### Lendo e resolvendo um incidente

- **Objetivo:** Ler a página de um incidente, registrar como ele foi resolvido e ver que ele saiu da lista de abertos.
- **Papel mínimo:** Administrador
- **Busca no curso:** resolver incidente; marcar problema como resolvido; nota de resolução; detalhes do incidente; whatsapp caiu no servidor; fechar alerta crítico

1. **A página do incidente** — `/admin/incidents`  
   Esta é a página que abre ao clicar em "Ver": aqui, o número de WhatsApp da Clínica Bem Viver que caiu. No alto ficam o código do problema, os selos de gravidade e de situação, o apelido da empresa e a data em que foi aberto. "Incidentes", acima do título, volta para a lista.
2. **Os detalhes e o histórico**  
   "Payload" guarda os detalhes do problema, do jeito que foram anotados: aqui, qual número caiu e há quantos minutos. "Audit Trail" é o histórico deste incidente. Ele ainda está vazio porque é a primeira vez que alguém abre esta página. Cada visita fica anotada como "platform_admin.incident_viewed", e a resolução, como "incident.resolved": você vê as duas linhas daqui a pouco.
3. **Anotar como foi resolvido**  
   Depois de resolver o problema de verdade (aqui, reconectar o número na tela Conexões da própria empresa, não no Admin), clique em "Resolver incidente". Abre uma janela para você escrever o que causou o problema e o que foi feito. O botão "Confirmar resolução" só libera com pelo menos 10 caracteres escritos, e a anotação pode ter no máximo 1000.
   > 💡 Resolver não pode ser desfeito, e fica anotado no registro de auditoria ("Audit" no menu), com quem resolveu e a anotação.
4. **Incidente resolvido**  
   Ao confirmar, aparece o aviso "Incidente resolvido com sucesso". O selo de situação muda para "Resolvido", o botão "Resolver incidente" some e surge o quadro "Resolução", com a sua anotação e a data. No "Audit Trail" já aparecem a sua visita e a resolução, com dia e hora.
5. **Fora da lista de abertos**  
   Volte para a lista em "Incidentes". O incidente resolvido saiu da lista de abertos, e o número abaixo do título diminuiu. Ele continua guardado: escolha "Resolvidos" no primeiro filtro para encontrá-lo de novo.

---

<a id="m-admin-usage"></a>

## Usage (Admin)

**Tela:** `/admin/usage`  
**Resumo:** Quanto cada empresa do servidor conversou e gastou com IA, dia a dia e somado, para você saber quem usa mais e quanto custa.

**Lições:** [Conhecendo a tela de uso](#l-admin-usage--conhecendo-a-tela) · [Quanto cada empresa usa](#l-admin-usage--uso-por-empresa) · [Trocar o período e baixar a planilha](#l-admin-usage--periodo-e-planilha)

<a id="l-admin-usage--conhecendo-a-tela"></a>

### Conhecendo a tela de uso

- **Objetivo:** Abrir a tela "Usage" do Admin e ler os três gráficos de consumo da instalação.
- **Papel mínimo:** Administrador
- **Busca no curso:** consumo de ia; quanto gastei com ia; uso por empresa; mensagens por dia; custo da inteligência artificial; tokens por dia; relatório de uso

1. **Onde fica o consumo** — `/admin/usage`  
   No Admin, o item "Usage" do menu (a palavra inglesa para "uso") abre a tela "Uso & Custo". Ela mostra quanto as empresas da instalação conversaram e quanto gastaram com IA. A tela junta todas as empresas do servidor, e não só a sua. No Admin, cada empresa se chama "tenant".
   > 💡 Só quem é administrador da plataforma entra no Admin. Para um atendente ou gerente de uma empresa, esta área não abre. A faixa amarela "Sem SMTP configurado", no alto, é um aviso geral do Admin: o envio de e-mails ainda não está configurado. O item "E-mail" do menu leva ao ajuste.
2. **O período**  
   No canto direito fica o período que a tela inteira mostra. Ela abre em "Últimos 30 dias". Os gráficos e a tabela de baixo sempre falam desse mesmo período. Na última lição você aprende a trocá-lo.
3. **Mensagens e custo por dia**  
   "Mensagens / dia" soma as mensagens enviadas e recebidas por todas as empresas em cada dia, inclusive as de contatos pessoais, que a tabela lá de baixo deixa de fora. "Custo AI / dia (R$)" mostra quanto a IA custou em cada dia. Atenção: apesar do "R$" no título, os valores estão em dólar (US$), a moeda em que o provedor de IA cobra. Quando um gráfico não tem nada no período, ele mostra "Sem dados no período".
4. **Tokens: o que a IA lê e escreve**  
   "AI Tokens / dia" conta os tokens usados em cada dia. Token é um pedacinho de texto: a IA lê a conversa e escreve a resposta em tokens, e o provedor cobra por eles. Por isso este gráfico costuma subir e descer junto com o do custo. Os números do eixo usam "k" para mil: "20k" são 20 mil tokens.
5. **O número de um dia**  
   Pare o mouse sobre qualquer ponto de um gráfico para ver a data e o número daquele dia. Aqui, o balão mostra quantas mensagens houve no dia apontado.

<a id="l-admin-usage--uso-por-empresa"></a>

### Quanto cada empresa usa

- **Objetivo:** Ler a tabela "Uso por tenant" e achar quem gasta mais com IA e quem está sem agente no ar.
- **Papel mínimo:** Administrador
- **Busca no curso:** qual empresa gasta mais; custo de ia por cliente; empresa sem agente; mensagens por empresa; uso por tenant; tabela de consumo

1. **A tabela por empresa** — `/admin/usage`  
   Abaixo dos gráficos fica "Uso por tenant": uma linha por empresa da instalação, com os números do período escolhido. Embaixo do nome vem o identificador curto da empresa no sistema. A empresa que mais gasta com IA vem primeiro; em caso de empate, a que tem mais mensagens.
2. **O que cada coluna conta**  
   "Mensagens" conta as enviadas e recebidas no período, fora as dos contatos marcados como pessoais. "Conversas" conta as conversas que começaram no período. "Invoc. AI" conta cada vez que o sistema chamou a IA: respostas do agente, testes, leitura de áudios, base de conhecimento e outras tarefas. "Tokens" soma o texto que ela leu e escreveu. "Custo AI" é quanto isso custou, em dólar.
3. **Quem mais gasta com IA**  
   A FisioMove Reabilitação está no topo: é a empresa que mais gastou com IA nos últimos 30 dias. A coluna "Agente" mostra o nome do atendente de IA publicado nela, o "Téo — Agenda da Fisio". Quando uma empresa tem mais de um agente publicado, aparece o de maior prioridade. Atenção: um agente pausado continua aparecendo aqui, então o nome nesta coluna não garante que ele esteja respondendo.
4. **Empresa sem agente no ar**  
   Na linha da OdontoVita, a coluna "Agente" diz "Nenhum agente publicado": essa empresa não tem atendente de IA no ar, e as colunas de IA dela estão zeradas mesmo com mensagens no período. Se o cliente contratou o atendimento com IA, esse é o sinal de que algo ficou para trás.
5. **Agente publicado, mas sem uso**  
   A Clínica Bem Viver tem a "Bia — Recepção virtual" publicada, mas a IA está zerada: no período, a Bia não respondeu ninguém. Ter o agente publicado não basta. Se a IA de uma empresa fica zerada com o agente no ar, vale conferir se ele não está pausado ou sem número de WhatsApp ligado.

<a id="l-admin-usage--periodo-e-planilha"></a>

### Trocar o período e baixar a planilha

- **Objetivo:** Ver o uso dos últimos 7 ou 90 dias e baixar a tabela numa planilha.
- **Papel mínimo:** Administrador
- **Busca no curso:** uso da última semana; consumo dos últimos 90 dias; mudar período do relatório; exportar planilha de uso; baixar csv de consumo

1. **Abrindo os períodos** — `/admin/usage`  
   Clique no período, no canto direito, para ver as opções: "Últimos 7 dias", "Últimos 30 dias" e "Últimos 90 dias".
2. **Só a última semana**  
   Com "Últimos 7 dias", os gráficos passam a mostrar só os 7 dias mais recentes, e a tabela recalcula os números de cada empresa para essa semana. Bom para ver se o movimento de agora está normal.
3. **Três meses de uso**  
   Com "Últimos 90 dias", dá para ver a tendência. Repare no custo: ele sobe por volta de 40 dias atrás, quando a FisioMove Reabilitação começou a usar a IA. Na tabela abaixo do gráfico, o NutriVida Consultório passa para o topo ao somar os três meses.
4. **Baixar a planilha**  
   O botão "Exportar CSV", acima da tabela, baixa a tabela numa planilha, com uma linha por empresa e os números do período escolhido; o nome do arquivo diz o período, como "usage-90d.csv". Abra no Google Planilhas (Arquivo > Importar). No Excel, use Dados > De Texto/CSV em vez de dar dois cliques, senão tudo cai numa coluna só. Atenção: a coluna "custo_reais" está, na verdade, em dólar, como na tela.

---

<a id="m-admin-users"></a>

## Users (Admin)

**Tela:** `/admin/users`  
**Resumo:** A lista de todas as pessoas que fazem parte de alguma empresa do seu servidor, em todas as empresas: quem é, em qual empresa trabalha, com que papel, quando entrou pela última vez e se ainda tem acesso.

**Lições:** [Conhecendo a lista de pessoas](#l-admin-users--conhecendo-a-lista) · [Encontrando uma pessoa](#l-admin-users--encontrar-uma-pessoa) · [A ficha de uma pessoa](#l-admin-users--ficha-da-pessoa)

<a id="l-admin-users--conhecendo-a-lista"></a>

### Conhecendo a lista de pessoas

- **Objetivo:** Ler a lista de pessoas do servidor: o que cada coluna diz, por que a mesma pessoa pode aparecer duas vezes e o que quer dizer "Revogado".
- **Papel mínimo:** Administrador
- **Busca no curso:** lista de usuários; todas as pessoas do servidor; quem tem conta; users admin; ver equipe de todas as empresas; último acesso

1. **Todas as pessoas do servidor** — `/admin/users`  
   No Admin, "Users" é a lista de todas as pessoas que fazem parte de alguma empresa do seu servidor, de todas as empresas juntas. Aqui você só consulta: nada se muda nesta tela. Logo abaixo do título aparece quantas linhas a lista mostra. Quem entrou no sistema mais recentemente aparece primeiro; quem nunca entrou fica no fim.
   > 💡 A lista carrega 30 linhas por vez. Quando há mais, o número ganha um "+" e aparece o botão "Carregar mais" no fim da tabela.
2. **O que cada coluna diz**  
   Cada linha é uma pessoa dentro de uma empresa. "Email" e "Nome" são os da conta. "Tenant" é a empresa, com o nome curto que a identifica no sistema embaixo. "Role" é o papel da pessoa naquela empresa: Admin, Manager, Agente ou Viewer (este último só olha, não mexe). "Último acesso" diz há quanto tempo a conta entrou no sistema pela última vez, em qualquer empresa; um traço quer dizer que ela ainda não entrou nenhuma vez.
3. **A mesma pessoa em duas empresas**  
   Uma pessoa pode trabalhar em mais de uma empresa do servidor com a mesma conta. Nesse caso ela aparece numa linha para cada empresa, e o papel pode ser diferente em cada uma. Aqui, a consultora Marina Lopes é Viewer na Odonto Sorriso Leve e Manager na FisioVida. Por isso o número no alto conta linhas, e não pessoas.
4. **Quem ainda tem acesso**  
   A coluna "Status" diz se a pessoa ainda entra naquela empresa. "Ativo": entra normalmente. "Revogado": alguém tirou o acesso dela na tela Equipe, em Configurações, daquela empresa. A conta continua existindo, mas ela não entra mais ali. Para ver tudo sobre uma pessoa, clique em "Ver", no fim da linha.

<a id="l-admin-users--encontrar-uma-pessoa"></a>

### Encontrando uma pessoa

- **Objetivo:** Achar alguém pelo nome ou e-mail e filtrar a lista por empresa e por papel.
- **Papel mínimo:** Administrador
- **Busca no curso:** buscar usuário; achar pessoa pelo email; filtrar por empresa; quem é admin; filtrar por papel; pessoas de uma clínica

1. **Buscar pelo nome ou e-mail** — `/admin/users`  
   Digite parte do nome ou do e-mail na busca. Não precisa apertar Enter: a lista se ajusta sozinha logo depois que você para de digitar. Aqui, "marina" trouxe as duas linhas da Marina Lopes, uma para cada empresa.
   > 💡 A busca diferencia acento: 'patricia' não acha 'Patrícia' pelo nome. Se não achar, tente com acento ou por um pedaço do e-mail.
2. **Ver só uma empresa** — `/admin/users`  
   O primeiro filtro, que começa em "Todos os tenants", mostra a lista de empresas do servidor. Escolha uma para ver só a equipe dela.
3. **A equipe de uma empresa**  
   Com "FisioVida Reabilitação" escolhida, a lista mostra só as pessoas dessa clínica, inclusive quem teve o acesso revogado.
4. **Somar o filtro de papel**  
   O segundo filtro, que começa em "Todos os roles", separa as pessoas pelo papel: Admin, Manager, Agente ou Viewer. Ele soma com o filtro de empresa. Aqui, empresa FisioVida e papel Admin mostram quem administra aquela clínica. Para desfazer, volte cada filtro para "Todos os tenants" e "Todos os roles".
5. **Quando ninguém aparece** — `/admin/users`  
   Se nenhuma pessoa bate com a busca e os filtros, a lista mostra "Nenhum usuário encontrado". Confira se o nome está escrito certo (com acento) ou volte os filtros para "Todos os tenants" e "Todos os roles".
   > 💡 Se a lista vier vazia sem nenhuma busca nem filtro, recarregue a página: pode ter sido uma falha passageira do servidor.

<a id="l-admin-users--ficha-da-pessoa"></a>

### A ficha de uma pessoa

- **Objetivo:** Abrir a ficha de uma pessoa e ler os dados da conta, as empresas em que ela está e o que ela fez por último no sistema.
- **Papel mínimo:** Administrador
- **Busca no curso:** detalhes do usuário; em quais empresas a pessoa está; verificação em duas etapas ativa; e-mail confirmado; histórico do usuário; o que a pessoa fez

1. **Os dados da conta** — `/admin/users`  
   Clicando em "Ver" numa linha, abre a ficha da pessoa. No alto ficam o nome, o e-mail e o código da conta. O quadro "Informações do usuário" mostra quando o e-mail foi confirmado (ou "Pendente", se ainda não foi), o último acesso, o dia em que a conta foi criada e o "MFA": "Ativo" quando a pessoa usa a verificação em duas etapas, "Inativo" quando não usa.
2. **Em quais empresas ela está**  
   O quadro "Memberships" lista as empresas em que a pessoa está, com o papel em cada uma, o dia em que ela aceitou o convite e se o acesso está "Ativo" ou "Revogado". O nome da empresa é um link: ele abre a ficha da empresa, em "Tenants".
3. **O que a pessoa fez por último** — `/admin/users`  
   O último quadro, "Audit recente", lista as últimas ações dessa pessoa que ficaram registradas no sistema, até 50, da mais nova para a mais antiga. Cada linha traz o código da ação (por exemplo, "platform_admin.users_listed" é abrir ou filtrar esta lista de pessoas) e o dia e a hora. Na foto, a ficha da Helena, que usa o sistema todo dia, rolada até o fim. Quem ainda não fez nada que fique registrado, como a Marina, aparece com "Nenhuma entrada de auditoria encontrada para este usuário."
   > 💡 Para ver o registro completo de todas as ações do servidor, use "Audit" no menu do Admin. Lá, cole o código da conta (o que aparece no alto desta ficha) no filtro "Actor (user ID)" para ver só o que esta pessoa fez.

---

<a id="m-admin-platform-admins"></a>

## Platform Admins (Admin)

**Tela:** `/admin/platform-admins`  
**Resumo:** A lista de quem tem a chave do Admin do seu servidor: quem pode mexer em tudo, quem só olha, quem precisa do código do celular e quem já perdeu o acesso.

**Lições:** [Quem administra o servidor](#l-admin-platform-admins--conhecendo-a-tela) · [O que cada acesso permite](#l-admin-platform-admins--lendo-cada-acesso)

<a id="l-admin-platform-admins--conhecendo-a-tela"></a>

### Quem administra o servidor

- **Objetivo:** Entender o que é um administrador da plataforma, por que esta tela não tem botões de mudar e o que cada coluna da lista mostra.
- **Papel mínimo:** Administrador
- **Busca no curso:** platform admins; administradores da plataforma; quem administra o servidor; quem tem acesso ao admin; dono da instalação; super admin; acesso total ao sistema

1. **A lista de quem tem a chave do Admin** — `/admin/dashboard`  
   No Admin, "Platform Admins" quer dizer administradores da plataforma: as pessoas que entram nesta área do Admin e enxergam todas as empresas do seu servidor, não só a clínica delas. Para chegar aqui, clique em "Platform Admins" no menu do Admin. A tela mostra quem tem essa chave hoje e quem já teve.
   > 💡 Quem não está nesta lista, ou teve o acesso revogado, é mandado para uma tela de acesso negado ao tentar abrir o Admin. A faixa amarela "Sem SMTP configurado", no alto, é um aviso geral do Admin: o envio de e-mails ainda não está configurado. O item "E-mail" do menu leva ao ajuste.
2. **Por que não há botão de mudar**  
   O aviso azul explica que esta tela só mostra. Não existe botão para incluir, tirar ou mudar ninguém aqui, de propósito: quem dá ou tira essa chave é a pessoa técnica que cuida do banco de dados do servidor (o "DBA" do aviso), direto no banco, e o aviso pede que ela deixe uma nota explicando a mudança no registro de auditoria. Assim, ninguém ganha acesso a todas as empresas com um clique.
3. **O que cada coluna diz**  
   Cada linha é uma pessoa, da chave mais nova para a mais antiga. "Usuário" mostra o e-mail e o nome. "Concedido em" diz há quanto tempo a chave foi dada, e "Concedido por" mostra o e-mail de quem deu. "Scope" diz o que a pessoa pode fazer, "MFA" diz se ela é obrigada a usar a verificação em duas etapas e "Status" diz se o acesso ainda vale. "Motivo" é a explicação escrita quando a chave foi dada.
   > 💡 A próxima lição explica "Scope", "MFA" e "Status" com calma.
4. **Lendo um motivo comprido**  
   Quando o motivo passa de 40 letras, ele aparece cortado, com "…" no fim e um sublinhado pontilhado. Pare o mouse em cima para ler o texto inteiro. O da Helena diz "Bootstrap inicial do self-host (dono da instância)": é a linha que o próprio sistema criou na instalação do servidor, dando a chave para a dona.

<a id="l-admin-platform-admins--lendo-cada-acesso"></a>

### O que cada acesso permite

- **Objetivo:** Diferenciar acesso total de acesso só de leitura, saber quem é obrigado a usar o código do celular e reconhecer um acesso revogado.
- **Papel mínimo:** Administrador
- **Busca no curso:** acesso só de leitura no admin; scope full support_readonly; verificação em duas etapas obrigatória; mfa do administrador; acesso revogado; tirar acesso de administrador; quem deu o acesso

1. **Acesso total ou só de leitura** — `/admin/dashboard`  
   Abra "Platform Admins" no menu do Admin. A coluna "Scope" diz o tamanho da chave. "full" é acesso total: a pessoa vê e muda tudo no Admin, como criar ou suspender empresas. "support_readonly" é só de leitura: a pessoa abre o painel e vê tudo, mas qualquer tentativa de mudar algo é recusada. Aqui, o Carlos acompanha o painel sem poder alterar nada.
2. **Quem precisa do código do celular**  
   A coluna "MFA" fala da verificação em duas etapas: além da senha, um código de 6 números do aplicativo autenticador do celular. "Sim" quer dizer que a pessoa é obrigada: enquanto ela não cadastrar o código, o sistema não a deixa seguir, nem no Admin nem no resto do DeskComm. "Não" quer dizer que não é obrigada. Esse "Sim" ou "Não" também só muda direto no banco, como o resto desta tela.
   > 💡 Mesmo com "Não", quem cadastrou a verificação por conta própria precisa digitar o código ao entrar.
3. **Acesso ativo e acesso revogado**  
   A coluna "Status" diz se a chave ainda vale. "Ativo": a pessoa entra no Admin normalmente. "Revogado": a chave foi tirada e ela não entra mais no Admin (cai na tela de acesso negado). A linha não some: ela fica na lista, mais apagada, como histórico. Aqui, o Marcos Teixeira, que cuidava da informática da clínica, perdeu o acesso. Atenção: a tela não mostra quando, por quem nem por que a chave foi tirada. O "Motivo" da linha continua sendo o de quando ela foi dada.
4. **Quando e por quem**  
   "Concedido em" diz há quanto tempo a chave foi dada, e "Concedido por" mostra o e-mail de quem deu, sem o final do endereço (".com.br"). A chave do Carlos foi dada pela Helena. Na linha da própria Helena, quem deu foi ela mesma: o sistema registra a dona como autora da chave criada na instalação.

---

<a id="m-admin-marca"></a>

## Marca (Admin)

**Tela:** `/admin/marca`  
**Resumo:** Onde quem instalou o sistema troca o nome, a cor, o logo e o ícone que aparecem para todas as empresas do servidor, inclusive na tela de entrada.

**Lições:** [Conhecendo a marca da instalação](#l-admin-marca--conhecendo-a-tela) · [Trocar o nome e a cor](#l-admin-marca--nome-e-cor) · [Quando a cor não serve](#l-admin-marca--quando-a-cor-nao-serve) · [Logo e ícone da aba](#l-admin-marca--logo-e-icone) · [Ajustes finos com CSS](#l-admin-marca--css-personalizado)

<a id="l-admin-marca--conhecendo-a-tela"></a>

### Conhecendo a marca da instalação

- **Objetivo:** Achar a tela "Marca" do Admin, entender que ela vale para todas as empresas e ler de onde vem o nome, o logo e a cor de hoje.
- **Papel mínimo:** Administrador
- **Busca no curso:** mudar o nome do sistema; marca própria do revendedor; trocar a cor do sistema inteiro; personalizar a tela de login; white label; logo da instalação

1. **Onde fica a tela** — `/admin/marca`  
   No Admin, o item "Marca" do menu abre a marca da instalação inteira: o nome, a cor, o logo e o ícone que o sistema mostra para todo mundo deste servidor. Ela vale para todas as empresas, e também para telas que vêm antes de qualquer empresa, como a de entrada.
   > 💡 Só quem é administrador da plataforma abre esta tela. Quem não é e tenta abrir o endereço vê a tela "Acesso negado". A marca de uma empresa específica fica em outro lugar: "Configurações" › "Marca", dentro do sistema. A faixa amarela "Sem SMTP configurado", no alto, é um aviso geral do Admin: o envio de e-mails ainda não está configurado. O item "E-mail" do menu leva ao ajuste.
2. **O nome do sistema**  
   O primeiro quadro é o nome do sistema. Se o campo estiver vazio, o texto clarinho dentro dele é o nome que está valendo hoje. Se a instalação já gravou um nome, ele aparece escrito no campo. Esse nome aparece no título da aba do navegador, na tela de entrada, nos menus e, quando o envio de e-mails estiver configurado, nos e-mails das empresas que não escolheram um nome próprio. Deixar o campo em branco volta para o nome dado na instalação do servidor ou, se não houver, para o nome padrão.
   > 💡 O nome ainda não chega às telas de cadastro nem às da configuração inicial: essas continuam com o nome gravado no arquivo de instalação do servidor.
3. **A cor, o logo e o ícone**  
   Logo abaixo ficam a cor da marca e, no quadro seguinte, o logo; o ícone fica no fim desse mesmo quadro. O código clarinho "#7a5cd6" é um exemplo: enquanto o quadradinho estiver cinza, nenhuma cor foi escolhida e vale a cor padrão do sistema. A cor só vale depois de "Salvar". O logo e o ícone são gravados assim que você escolhe o arquivo.
4. **De onde vem cada coisa**  
   Em "Como está agora", o quadro "De onde vem cada coisa" diz, para o nome, o logo e a cor, quem decidiu o que está valendo: esta tela ("definido nesta tela"), o arquivo de instalação do servidor ("veio do arquivo de instalação do servidor") ou o padrão do sistema ("padrão do sistema"). Numa instalação nova, o nome costuma aparecer como vindo do arquivo de instalação, e o logo e a cor como padrão do sistema.
   > 💡 A frase miúda no fim do quadro diz que o logo ainda é trocado no arquivo de instalação. Ela está desatualizada: hoje o logo é trocado nesta mesma tela, como você vê na lição "Logo e ícone da aba".

<a id="l-admin-marca--nome-e-cor"></a>

### Trocar o nome e a cor

- **Objetivo:** Escrever o nome e a cor da sua marca, entender a prévia que o sistema monta e saber o que acontece ao salvar.
- **Papel mínimo:** Administrador
- **Busca no curso:** trocar a cor dos botões; colocar a cor da minha marca; mudar o nome que aparece no sistema; código da cor hexadecimal; cor no modo escuro; contraste do botão

1. **Escreva o nome** — `/admin/marca`  
   Clique em "Nome do sistema", apague o que estiver escrito e escreva o nome da sua marca. Aqui usamos "Bem Viver Saúde". Até 120 letras.
2. **Escreva o código da cor**  
   Em "Cor da marca", escreva o código da sua cor, que começa com # (aqui, "#1f8a70", um verde). Também dá para clicar no quadradinho ao lado do campo e escolher a cor com o mouse. Assim que a cor está certa, o sistema monta uma escala de tons a partir dela e marca quais tons vão para os botões no modo claro e no modo escuro.
3. **Dá para ler o botão?**  
   Mais abaixo, "O texto em cima dos botões" mede se o que está escrito nos botões fica fácil de ler com a sua cor, no modo claro e no modo escuro. "passa em AA" quer dizer que está dentro do mínimo recomendado. Em "O que o sistema ajustou", ele conta se precisou escurecer ou clarear o tom. A linha em amarelo avisa que, para quem tem dificuldade de distinguir cores, a sua ficou parecida com a cor de erro do sistema.
4. **Uma cor para o modo escuro**  
   O campo "Cor da marca no tema escuro (opcional)" serve para quando a sua marca tem uma versão própria para fundo escuro. Aqui usamos "#5fd3b0", um verde mais claro. Com ela, a prévia mostra uma segunda escala, só do modo escuro. Deixando em branco, os dois modos usam a cor de cima.
5. **Salvar**  
   Nada disso vale até você clicar em "Salvar", no fim do formulário. Depois do clique, aparece por alguns segundos "Marca salva.", e o nome e a cor passam a valer na tela de entrada e nas empresas que não escolheram uma marca própria. "De onde vem cada coisa" passa a dizer "definido nesta tela". A linha amarela é um alerta e não impede salvar. Se a cor estiver escrita errado, o botão fica apagado.

<a id="l-admin-marca--quando-a-cor-nao-serve"></a>

### Quando a cor não serve

- **Objetivo:** Reconhecer os avisos que a tela dá antes de salvar: código de cor errado, cor clara demais e cor neutra.
- **Papel mínimo:** Administrador
- **Busca no curso:** cor não aparece nos botões; use um código de cor; cor amarela ficou escura; cor cinza não funciona; botão salvar apagado; aviso da cor da marca

1. **Código escrito errado** — `/admin/marca`  
   O campo da cor só aceita o código com #, como "#1f8a70". Se você escrever o nome da cor ("verde", por exemplo), aparece em vermelho "Use um código de cor como #7a5cd6." e o botão "Salvar" fica apagado até você corrigir.
2. **Cor clara demais**  
   Com uma cor clara, como o amarelo "#f5c518", o texto dos botões ficaria difícil de ler no modo claro. Então, no modo claro, o sistema escolhe sozinho um tom mais escuro da mesma escala para os botões e conta isso em "O que o sistema ajustou". A sua cor original continua no logo e nos destaques.
3. **Cor neutra**  
   Cinza, preto ou branco não destacam nada na tela. Com uma cor assim (aqui, "#808080"), o aviso diz que os botões seguem com a cor padrão do sistema e que a sua fica guardada só para o logo.

<a id="l-admin-marca--logo-e-icone"></a>

### Logo e ícone da aba

- **Objetivo:** Saber como subir o logo (claro e escuro) e o ícone, e conferir a prévia nas duas aparências.
- **Papel mínimo:** Administrador
- **Busca no curso:** colocar meu logo no sistema; trocar o ícone da aba; logo para fundo escuro; tamanho do logo; favicon; logo some no modo escuro

1. **O arquivo do logo** — `/admin/marca`  
   Em "Logo", clique no botão de escolher arquivo e selecione a imagem do seu logo: PNG ou JPG, de até 512 KB, de preferência com fundo transparente. SVG não é aceito. O logo é gravado na hora, sem passar pelo "Salvar": aparece "Logo atualizado." e, ao lado, o botão "Remover". Se o arquivo for grande, o sistema tenta cortar as bordas vazias e diminuir a imagem antes de enviar.
2. **A prévia nas duas aparências**  
   As duas caixas mostram como o logo fica no fundo claro e no fundo escuro do sistema. Sem logo próprio, aparece o nome em texto, como na foto. Depois que você sobe um logo, se não houver a versão escura, a prévia escura o mostra sobre uma plaquinha branca, para um logo escuro com fundo transparente não sumir. Para evitar a plaquinha, use "Logo para o tema escuro (opcional)".
3. **O ícone da aba**  
   "Ícone do aplicativo e do navegador" é a figurinha que aparece na aba do navegador e no aplicativo instalado. Use uma imagem quadrada, de 512×512 ou maior, PNG ou JPG, de até 512 KB. Aqui o sistema não diminui a imagem por você. Assim como o logo, ela vale assim que você escolhe o arquivo. Depois de subir, aparece o botão "Remover ícone", que volta para o ícone que o sistema desenha a partir da sua marca.

<a id="l-admin-marca--css-personalizado"></a>

### Ajustes finos com CSS

- **Objetivo:** Conhecer o quadro "CSS personalizado", para quem tem um designer que quer ajustar detalhes visuais.
- **Papel mínimo:** Administrador
- **Busca no curso:** css personalizado; mudar fonte do sistema; arredondar os botões; ajuste visual avançado; designer personalizar o visual; regras css

1. **O quadro de CSS** — `/admin/marca`  
   No fim da tela fica "CSS personalizado". É para ajustes finos que um designer escreve em código: cor de um texto, borda arredondada, tipo de letra (só os que já existem no computador de quem usa: não dá para carregar uma fonte nova). Eles valem em todas as telas, inclusive na de entrada, para todas as empresas do servidor. Se você não tem quem escreva isso, pode deixar em branco.
2. **Ver um exemplo**  
   Clique em "Ver exemplo" para ver duas regras prontas: uma troca a cor de parte dos textos clarinhos e outra arredonda mais os cantos. Por segurança, o sistema só aceita regras de aparência (cores, bordas, sombras e letras): nada que mude o lugar das coisas na tela, nada de endereços de internet. Até 16 KB.
3. **Salvar o CSS**  
   O CSS tem botão próprio, "Salvar CSS". Ele confere as regras antes de gravar: se alguma não for permitida, aparece um aviso dizendo o tipo de problema (por exemplo, uma propriedade que não é aceita) e nada é gravado. Se der certo, aparece "CSS personalizado salvo.". Para tirar todos os ajustes, apague o texto e salve vazio.
   > 💡 Se um ajuste deixar a tela difícil de ler, abra o endereço desta tela com ?sem_css no fim: ela aparece sem o CSS, e você consegue corrigir.

---

<a id="m-admin-google"></a>

## Google Agenda (Admin)

**Tela:** `/admin/google`  
**Resumo:** Onde quem instalou o sistema cadastra, uma vez só, o aplicativo do Google que deixa cada pessoa da equipe ligar a própria agenda do Google à Agenda do CRM.

**Lições:** [Conhecendo a tela do Google Agenda](#l-admin-google--conhecendo-a-tela) · [Cadastrar o aplicativo do Google](#l-admin-google--cadastrar)

<a id="l-admin-google--conhecendo-a-tela"></a>

### Conhecendo a tela do Google Agenda

- **Objetivo:** Saber para que serve o cadastro do Google desta instalação e o que é cada parte da tela.
- **Papel mínimo:** Administrador
- **Busca no curso:** google agenda; google calendar; sincronizar agenda com o google; credenciais do google; endereço de retorno; conectar google; admin

1. **Onde fica a tela** — `/admin/google`  
   No Admin, o item "Google Agenda" do menu abre o cadastro do aplicativo do Google desta instalação. Com ele cadastrado, cada pessoa da equipe consegue ligar a própria agenda do Google à Agenda do sistema. O cadastro vale para todas as empresas deste servidor e é feito uma vez só. Depois, cada pessoa conecta a conta dela, sozinha.
   > 💡 A faixa amarela "Sem SMTP configurado", no alto, é um aviso geral do Admin: o envio de e-mails ainda não está configurado. O item "E-mail" do menu leva ao ajuste.
2. **O endereço de retorno**  
   "Endereço de retorno" é o endereço para onde o Google devolve a pessoa depois que ela autoriza a agenda. Ele já vem pronto e não dá para editar: só copiar. Cole exatamente isto em "URIs de redirecionamento autorizados", na tela de credenciais do Google Cloud. O Google compara letra por letra; se algo for diferente, ele recusa a conexão.
   > 💡 Na sua instalação, o endereço começa com o seu domínio. Na foto aparece o desta demonstração (127.0.0.1).
3. **As duas informações do Google**  
   "ID do cliente" e "Chave secreta do cliente" são as duas informações que o Google Cloud mostra quando você cria o aplicativo. Copie cada valor para o campo correspondente. O texto clarinho que aparece nos campos vazios é só um exemplo do formato. A chave é guardada cifrada e nunca mais aparece nesta tela, nem para você.
4. **O aviso e a situação**  
   O quadro de aviso, logo acima do "Salvar", explica: se você trocar uma credencial que já está em uso, quem já conectou a agenda pode precisar conectar de novo, porque as autorizações antigas foram dadas ao aplicativo anterior. Ninguém perde compromisso por isso. Na mesma linha do "Salvar", à esquerda, "Nunca configurado por aqui." diz que ninguém salvou nada nesta tela ainda. Depois do primeiro "Salvar", ali aparece "Última alteração em" com a data e a hora.
5. **Também se chega pela Agenda** — `/app/agenda`  
   Enquanto o aplicativo do Google não está cadastrado, a tela Agenda mostra o quadro "Sincronizar com o Google ainda não está disponível". A Agenda funciona normalmente; só não troca compromissos com o Google. Quem administra a instalação vê ali o link "Cadastrar as credenciais do Google", que traz direto para a tela do Admin. As outras pessoas da equipe veem só o aviso, sem o link. O quadro também lembra de registrar o endereço de retorno no Google, o mesmo do passo 2.

<a id="l-admin-google--cadastrar"></a>

### Cadastrar o aplicativo do Google

- **Objetivo:** Preencher o ID e a chave do Google, saber quando o "Salvar" acende e o que muda depois de salvar.
- **Papel mínimo:** Administrador
- **Busca no curso:** cadastrar credenciais do google; id do cliente google; chave secreta google; chave secreta do Google; salvar google agenda; botão salvar apagado

1. **Cole o ID do cliente** — `/admin/google`  
   Copie o ID do cliente no Google Cloud e cole no campo "ID do cliente". O botão "Salvar" continua apagado: no primeiro cadastro, o ID e a chave são obrigatórios juntos.
   > 💡 Os valores preenchidos nesta lição são marcadores de demonstração. Use o ID e a chave secreta da sua própria conta do Google; estes exemplos não conectam uma agenda.
2. **Cole a chave e salve**  
   Agora cole a chave secreta. O campo mostra bolinhas no lugar das letras. Com as duas informações, o "Salvar" acende: clique nele para gravar. Depois de salvar, o campo da chave fica vazio e mostra "(já cadastrada)", e aparece a data da última alteração. Na Agenda, cada pessoa pode conectar a própria conta pelo botão "Conectar Google".
   > 💡 Salvar não testa as informações com o Google: a prova é alguém clicar em "Conectar Google" na Agenda. Antes disso, confira no Google Cloud se a "Google Calendar API" está ligada (APIs e serviços › Biblioteca), senão a conexão é recusada. Para corrigir só o ID depois, deixe a chave em branco: ela continua a que já estava. Quem tem acesso somente leitura ao Admin recebe o aviso "Seu acesso à administração da plataforma é somente leitura." e nada é gravado.
3. **Quando a chave vem colada errado**  
   Um erro comum é copiar a chave junto com o resto da linha do arquivo do Google, com aspas e vírgula no fim. Aqui, o marcador de demonstração foi colado desse jeito. A tela percebe na hora: aparece o aviso para copiar só o valor da chave, e o "Salvar" volta a ficar apagado. Tire as aspas e a vírgula para corrigir.

---

<a id="m-admin-meta"></a>

## API Oficial da Meta (Admin)

**Tela:** `/admin/meta`  
**Resumo:** Onde quem instalou o sistema cadastra a chave secreta do aplicativo da Meta e recebe o token que liga o WhatsApp oficial a este servidor, para todas as empresas.

**Lições:** [Conhecendo a tela da Meta](#l-admin-meta--conhecendo-a-tela) · [Cadastrar a chave e copiar o token](#l-admin-meta--cadastrar-a-chave) · [Gerar um novo token](#l-admin-meta--gerar-novo-token) · [O que levar para o painel da Meta](#l-admin-meta--levar-para-a-meta)

<a id="l-admin-meta--conhecendo-a-tela"></a>

### Conhecendo a tela da Meta

- **Objetivo:** Achar a tela "API Oficial (Meta)" do Admin e reconhecer os dois quadros: a chave secreta e o token de verificação.
- **Papel mínimo:** Administrador
- **Busca no curso:** whatsapp oficial da meta; api oficial do whatsapp; configurar app da meta; chave secreta do aplicativo meta; token de verificação do webhook; whatsapp business api

1. **Onde fica a tela** — `/admin/meta`  
   No Admin, o item "API Oficial (Meta)" do menu abre esta tela. Ela guarda duas coisas: a chave secreta do aplicativo que você criou na Meta, que o sistema usa para conferir se cada mensagem recebida pelo número oficial veio mesmo da Meta, e um token de verificação, que a Meta usa para confirmar o endereço do seu servidor. As duas valem para a instalação inteira: cada empresa conecta o próprio número depois, em "Conexões".
   > 💡 Só quem é administrador da plataforma abre esta tela. Ela fica aqui, e não nas configurações de uma empresa, porque trocar estes dados mexe na chegada de mensagens de todas as empresas do servidor. A faixa amarela "Sem SMTP configurado", no alto, é um aviso geral do Admin: o envio de e-mails ainda não está configurado. O item "E-mail" do menu leva ao ajuste.
2. **O quadro da chave secreta**  
   O primeiro quadro é a "Chave secreta do aplicativo", que você copia do painel da Meta. Vazio, o campo mostra "32 letras e números", o tamanho da chave. O que você digita aparece como bolinhas, e a chave nunca volta a aparecer na tela depois de salva. Embaixo, "Nunca configurado por aqui." quer dizer que ninguém salvou nada nesta tela ainda. O botão "Salvar" fica apagado até o campo ter pelo menos 16 caracteres.
3. **O quadro do token**  
   O segundo quadro é o "Token de verificação", um código que a Meta pede para confirmar o endereço do seu servidor. Você não inventa esse código: o sistema cria um sozinho na primeira vez que você salva a chave secreta. Por enquanto o quadro diz que ele "Ainda não existe".

<a id="l-admin-meta--cadastrar-a-chave"></a>

### Cadastrar a chave e copiar o token

- **Objetivo:** Salvar a chave secreta do aplicativo da Meta e copiar o token de verificação que o sistema cria na hora.
- **Papel mínimo:** Administrador
- **Busca no curso:** onde colocar a chave secreta da meta; salvar app secret da meta; gerar token de verificação do whatsapp; copiar token do webhook da meta; cadastrar aplicativo da meta

1. **Cole a chave secreta** — `/admin/meta`  
   Cole no campo a chave secreta que você copiou do painel da Meta. Ela tem 32 letras e números e aparece como bolinhas. Assim que o campo tem pelo menos 16 caracteres, o botão "Salvar" acende.
2. **Copie o token na hora**  
   Ao clicar em "Salvar", a chave é guardada embaralhada no seu servidor e aparece por alguns segundos o aviso "Chave secreta salva.". Como é a primeira vez, o sistema já cria o token de verificação e mostra ele no quadro de baixo. O botão "Copiar" leva o token para a área de transferência, pronto para colar no painel da Meta.
   > 💡 Por segurança, o token não aparece de novo depois que você sai desta página. Se perder, dá para gerar outro aqui mesmo, como mostra a próxima lição.
3. **A chave ficou guardada**  
   O quadro de cima mudou: o campo mostra "(já cadastrada)" e embaixo aparece a data da "Última alteração". Para trocar a chave depois, é só digitar uma nova e salvar. Deixar o campo em branco mantém a que já está guardada.

<a id="l-admin-meta--gerar-novo-token"></a>

### Gerar um novo token

- **Objetivo:** Criar outro token de verificação quando o anterior se perdeu, sabendo o que muda na Meta.
- **Papel mínimo:** Administrador
- **Busca no curso:** perdi o token de verificação da meta; gerar outro token do webhook; trocar token de verificação whatsapp; token da meta não aparece mais

1. **O botão "Gerar novo token"** — `/admin/meta`  
   Depois que a chave secreta está salva, o quadro do token mostra quando ele foi "Gerado em" e ganha o botão "Gerar novo token". O token em si só aparece logo depois de ser criado: quando você sai da página, ele some e fica só a data. Se você perdeu o token antes de colar no painel da Meta, o caminho é criar outro com esse botão.
2. **Leia o aviso antes de confirmar**  
   Antes de trocar, o sistema pergunta. O token atual deixa de valer na hora. As mensagens que já chegam continuam chegando, porque elas são conferidas pela chave secreta. O que muda é que, se você colou o token à mão no painel da Meta, precisa colar o novo lá também. Sem isso, a Meta não consegue confirmar o endereço do seu servidor de novo. "Cancelar" fecha sem mudar nada.
3. **O token novo aparece**  
   Ao confirmar, o token novo surge no quadro, no lugar do anterior, com o botão "Copiar" ao lado. Copie e cole no painel da Meta logo em seguida, no lugar do antigo. A data de "Gerado em" sempre mostra quando o token que está valendo foi criado.

<a id="l-admin-meta--levar-para-a-meta"></a>

### O que levar para o painel da Meta

- **Objetivo:** Saber onde achar a chave secreta no painel da Meta, onde colar o token e onde pegar o endereço de cada número.
- **Papel mínimo:** Administrador
- **Busca no curso:** onde achar a chave secreta no painel da meta; onde colar o token de verificação; url de callback do webhook da meta; configurar webhook do whatsapp oficial

1. **Onde achar a chave secreta** — `/admin/meta`  
   Enquanto nenhuma chave foi salva, o texto embaixo do campo diz onde ela fica: no painel da Meta, em "Configurações do app › Básico". Copie de lá e cole aqui. O sistema guarda a chave embaralhada e ela nunca volta a aparecer nesta tela.
2. **Onde colar o token**  
   O texto do quadro do token explica o resto. No painel da Meta, em "WhatsApp › Configuração › Webhook", o token vai no campo "Verificar token". O outro campo, "URL de callback", é de cada número: ele aparece em "Conexões" › "API Oficial (Meta)", depois que o número da empresa é conectado.
   > 💡 Ao conectar um número em "Conexões", o sistema tenta avisar a Meta sozinho, usando o token desta tela. Quando consegue, Conexões mostra "Webhook registrado pela instalação" e não é preciso colar nada. Se aparecer "Cole isto no painel da Meta", faça o passo à mão.
3. **Abrir Conexões sem perder o token**  
   O link "Abrir Conexões em outra aba" abre a tela de Conexões já na parte da API oficial, numa aba nova. Assim o token continua aberto nesta página enquanto você pega o endereço do número na outra.
   > 💡 Se abrir Conexões nesta mesma aba, você sai da página e o token recém-criado some.

---

<a id="m-admin-cadastro"></a>

## Cadastro (Admin)

**Tela:** `/admin/cadastro`  
**Resumo:** Onde quem instalou o sistema decide quem pode criar conta: qualquer pessoa, só quem recebeu convite, ou quem você aprovar um por um.

**Lições:** [Conhecendo a tela de Cadastro](#l-admin-cadastro--conhecendo-a-tela) · [Deixar entrar só quem foi convidado](#l-admin-cadastro--so-convite) · [Aprovar quem quer abrir uma empresa](#l-admin-cadastro--com-aprovacao)

<a id="l-admin-cadastro--conhecendo-a-tela"></a>

### Conhecendo a tela de Cadastro

- **Objetivo:** Saber o que a tela de Cadastro controla e como ela vem quando o sistema é instalado.
- **Papel mínimo:** Administrador
- **Busca no curso:** quem pode criar conta; cadastro aberto; fechar cadastro; novas contas no sistema; criar conta; admin cadastro

1. **Onde fica a tela** — `/admin/cadastro`  
   No Admin, o item "Cadastro" do menu abre a tela que decide quem pode criar uma conta neste sistema. A regra vale para o servidor inteiro, não para uma empresa só. Por isso ela fica no Admin, e só quem administra a instalação vê esta tela.
   > 💡 A faixa amarela "Sem SMTP configurado", no alto, é um aviso geral do Admin: o envio de e-mails ainda não está configurado. O item "E-mail" do menu leva ao ajuste.
2. **As duas chaves**  
   A tela tem duas chaves. "Cadastro apenas por convite" fecha a porta: só entra quem foi convidado. "Cadastro com aprovação" deixa a pessoa criar a conta, mas a empresa dela só é aberta depois que você aprovar. Com as duas desligadas, como vem na instalação, qualquer pessoa pode criar uma conta e abrir a própria empresa. Quem já tem conta continua entrando normalmente, seja qual for a escolha.
3. **Salva na hora, e fica registrado**  
   Não há botão de salvar: a escolha vale assim que você clica na chave, e dá para voltar atrás com outro clique. Cada troca fica registrada no item "Audit" do menu, com data e hora e o e-mail (parcialmente escondido) de quem trocou. A tela de Audit é técnica e está em inglês: a troca aparece como "platform.signup_mode_updated", e, abrindo o registro, o quadro "Metadata" mostra o modo de antes em "de" e o de depois em "para". É ali que se descobre por que, de repente, ninguém mais consegue criar conta.

<a id="l-admin-cadastro--so-convite"></a>

### Deixar entrar só quem foi convidado

- **Objetivo:** Fechar o cadastro para que só entre quem recebeu convite, e reabrir quando quiser.
- **Papel mínimo:** Administrador
- **Busca no curso:** fechar cadastro; só por convite; impedir que estranhos criem conta; bloquear novas contas; cadastro fechado; convite obrigatório

1. **Ligar o convite obrigatório** — `/admin/cadastro`  
   Para fechar a porta, clique na chave "Cadastro apenas por convite". Faça isso quando o sistema for só da sua clínica e você não quer que um desconhecido crie conta e abra uma empresa no seu servidor.
2. **O que muda com a chave ligada**  
   Ligada, a chave fica colorida e o texto muda: quem abrir a tela de cadastro sem convite vê o aviso "Cadastro apenas por convite" e um botão "Entrar", que leva ao login, no lugar do formulário. A chave "Cadastro com aprovação" fica apagada, porque não há ninguém sem convite para aprovar. O quadro amarelo de baixo lembra que isso vale até para você: se um dia precisar de uma conta nova, ela também terá de vir por convite.
   > 💡 Convide as pessoas pela tela "Equipe", em Configurações, antes de precisar.
3. **O aviso do servidor**  
   Logo depois da troca, pode aparecer no alto o aviso "A troca de modo ainda não chegou ao servidor.". O sistema já segue a regra nova, mas o serviço que guarda as senhas e cria as contas continua com a regra antiga, e esta tela só avisa: não corrige sozinha. Na instalação comum, com tudo num servidor só, o aviso mostra um comando para rodar no servidor, e a troca chega lá na próxima atualização. Quando o banco de dados fica num serviço separado, como nesta foto, atualização nenhuma resolve: é preciso trocar a opção à mão no painel do Supabase, e o aviso diz onde. Os termos técnicos que aparecem no quadro (como "GoTrue" e "DISABLE_SIGNUP") são para quem cuida do servidor.
   > 💡 Se você não mexe no servidor, mande a foto deste aviso para quem instalou o sistema para você.
4. **Reabrir o cadastro**  
   Para voltar a aceitar qualquer pessoa, clique de novo na chave. Ela desliga, o texto volta a dizer "Desligado: qualquer pessoa pode criar uma conta e abrir a própria empresa" e os quadros amarelos somem. A chave "Cadastro com aprovação" volta a poder ser ligada.

<a id="l-admin-cadastro--com-aprovacao"></a>

### Aprovar quem quer abrir uma empresa

- **Objetivo:** Ligar o cadastro com aprovação e decidir, pedido por pedido, quem pode abrir uma empresa no sistema.
- **Papel mínimo:** Administrador
- **Busca no curso:** aprovar cadastro; pedidos de empresa nova; aprovar nova empresa; recusar cadastro; fila de aprovação; quem pediu para entrar

1. **Ligar a aprovação** — `/admin/cadastro`  
   Se você hospeda o sistema para várias clínicas e quer escolher quem entra, clique na chave "Cadastro com aprovação". Com ela ligada, a pessoa cria a conta normalmente, mas no lugar de abrir a empresa ela envia um pedido, e o pedido espera por você nesta tela. O sistema não avisa quando chega pedido novo: passe por aqui de tempos em tempos.
2. **A fila de pedidos**  
   Com a chave ligada, aparece o quadro "Pedidos aguardando aprovação". Cada linha é um pedido: em cima, o nome da empresa que a pessoa quer abrir; embaixo, o e-mail dela. O pedido mais antigo fica no alto. Aqui há três clínicas esperando.
3. **Aprovar ou recusar**  
   "Aprovar" cria a empresa com o nome do pedido e torna quem pediu administrador dela. "Recusar" fecha a porta para aquela conta enquanto a aprovação estiver ligada: ela vê o aviso "Pedido não aprovado" e não consegue pedir outra vez. Se ela tiver um convite, ainda pode entrar pelo link do convite. Nos dois casos o sistema não avisa a pessoa: combine com ela. Se foi aprovada, basta entrar de novo para começar a usar.
   > 💡 Só dá para aprovar quem já confirmou o e-mail. Se a conta não confirmou, a tela avisa e o pedido continua na fila.
4. **Depois de decidir**  
   Assim que você decide, o pedido sai da fila. Aqui o pedido da "OdontoVita Sorrisos" foi recusado e sumiu da lista; ficaram os outros dois. Cada aprovação e cada recusa fica registrada no item "Audit" do menu.
5. **Desligar a aprovação**  
   Clique de novo na chave para voltar ao cadastro aberto. Atenção: a partir daí, quem estava esperando aprovação, e até quem você recusou, pode abrir a própria empresa sozinho na próxima vez que entrar, sem passar por você. A fila some desta tela, mas os pedidos não decididos continuam guardados: se você ligar a chave outra vez, eles voltam a aparecer.

---

<a id="m-admin-email"></a>

## E-mail (Admin)

**Tela:** `/admin/email`  
**Resumo:** Onde quem instalou o sistema escolhe por onde saem os e-mails de todas as empresas deste servidor: convites da equipe, entrega de dados da LGPD e avisos de prazo.

**Lições:** [Conhecendo a tela de E-mail](#l-admin-email--conhecendo-a-tela) · [Cadastrando o seu servidor de e-mail](#l-admin-email--servidor-proprio) · [Usando um serviço externo de envio](#l-admin-email--servico-externo)

<a id="l-admin-email--conhecendo-a-tela"></a>

### Conhecendo a tela de E-mail

- **Objetivo:** Saber para que serve a tela de E-mail do Admin, ler a situação atual do envio e reconhecer os dois caminhos possíveis.
- **Papel mínimo:** Administrador
- **Busca no curso:** configurar e-mail do sistema; convite não chega no e-mail; servidor de e-mail smtp; por onde saem os e-mails; e-mail da instalação; admin

1. **Onde fica a tela** — `/admin/email`  
   No Admin, o item "E-mail" do menu abre o servidor de e-mail desta instalação. Convite de equipe, entrega de dados pedidos pela LGPD e aviso de prazo saem por aqui. O que você configura nesta tela vale para todas as empresas do servidor, não só para a sua clínica. Enquanto o seu servidor de e-mail próprio não estiver salvo, pode aparecer no alto de todas as telas do Admin a tarja amarela "Sem SMTP configurado" (SMTP é o nome técnico de um servidor de e-mail). O atalho "Configurar em /admin/email" dela traz para cá.
2. **A situação do envio**  
   No fim do quadro, ao lado dos botões, uma frase diz por onde o e-mail está saindo agora. Aqui ela avisa que nenhum caminho está configurado. Nesse caso, quem convida alguém para a equipe recebe um link para copiar e mandar à pessoa, em vez de o convite chegar na caixa de entrada dela. Quando o servidor próprio estiver salvo com o endereço e o e-mail do remetente preenchidos, a frase muda para "Em uso: o e-mail está saindo por este servidor.". Se o e-mail sair pelo serviço externo, ela avisa isso.
3. **Os dois caminhos**  
   Há dois jeitos de mandar e-mail. O primeiro é o seu próprio servidor de e-mail, no quadro de cima. O segundo é um "Serviço externo de envio", no quadro de baixo: uma empresa que entrega o e-mail por você. Basta um dos dois. Se os dois estiverem configurados, o servidor próprio tem preferência, mesmo que os dados dele estejam errados: o sistema não volta sozinho ao serviço externo. Por isso, depois de salvar o servidor próprio, teste sempre.
   > 💡 A frase cinza abaixo de "Chave do serviço de e-mail" diz que sem ela nenhum e-mail sai. Isso só vale quando o quadro do seu servidor próprio está vazio. Com o servidor próprio salvo, a chave não é necessária.

<a id="l-admin-email--servidor-proprio"></a>

### Cadastrando o seu servidor de e-mail

- **Objetivo:** Preencher os dados do servidor de e-mail próprio e entender o que os botões "Testar conexão" e "Salvar" fazem.
- **Papel mínimo:** Administrador
- **Busca no curso:** cadastrar servidor smtp; porta 587 starttls; senha do e-mail do sistema; remetente dos e-mails; testar conexão do e-mail; e-mail da clínica

1. **Endereço e porta** — `/admin/email`  
   Os dados vêm de quem hospeda o seu e-mail (a empresa do seu domínio ou da sua caixa de e-mail). Em "Endereço do servidor", escreva só o nome do servidor, normalmente "smtp." seguido do seu domínio: sem "smtp://" na frente e sem a porta no fim. Em "Porta", o número que o provedor informar. O mais comum é 587.
2. **A segurança da conexão**  
   Em "Segurança", escolha o tipo de proteção que o provedor indicar. A própria lista ajuda: "STARTTLS" normalmente combina com a porta 587, e "TLS/SSL" com a porta 465. "Sem criptografia" só serve para um servidor dentro da sua própria rede.
3. **Usuário e senha**  
   "Usuário" e "Senha" são os da conta de e-mail que vai enviar as mensagens: normalmente o próprio endereço e a senha dele. Atenção: alguns provedores (como Gmail e Outlook) não aceitam a senha normal aqui e pedem uma "senha de app", que você gera nas configurações de segurança da sua conta de e-mail. A senha é guardada cifrada e nunca volta a aparecer nesta tela. Depois de salva, o campo fica vazio: deixe assim para manter a senha, ou digite outra para trocar.
4. **Quem aparece como remetente**  
   Os dois últimos campos dizem quem aparece como remetente. Em "E-mail que aparece como remetente", use de preferência o mesmo endereço da conta que envia (ou um que essa conta tenha permissão de usar), senão o seu servidor pode recusar a mensagem. "Nome que aparece como remetente" é um nome de reserva: convites e avisos da LGPD saem com o nome da marca da empresa.
5. **Salvar e testar**  
   "Salvar" grava os dados. Assim que o endereço do servidor e o e-mail do remetente estiverem salvos, todos os e-mails passam a sair por este servidor, mesmo que algum dado esteja errado. "Testar conexão" entra no seu servidor com o usuário e a senha e avisa se deu certo, sem mandar e-mail nenhum. Atenção: o teste confere o que já está SALVO, não o que está digitado. Se nada foi salvo ainda, ele responde "Preencha e salve o servidor e o remetente antes de testar.". Se já havia um servidor salvo, ele testa o antigo. Por isso: salve primeiro e teste logo em seguida.
   > 💡 se o teste disser "O servidor respondeu, mas recusou o usuário e a senha.", confira a senha. Se disser "Não foi possível falar com o servidor. Confira o endereço, a porta e a segurança.", confira esses três e também a senha.

<a id="l-admin-email--servico-externo"></a>

### Usando um serviço externo de envio

- **Objetivo:** Configurar o serviço externo de envio em vez do servidor próprio e saber voltar ao valor do arquivo de instalação.
- **Papel mínimo:** Administrador
- **Busca no curso:** serviço externo de e-mail; chave do serviço de e-mail; trocar remetente dos e-mails; voltar ao padrão e-mail; e-mail sem servidor próprio; admin

1. **Os dois campos do serviço** — `/admin/email`  
   O quadro "Serviço externo de envio" tem dois campos, e os dois precisam estar preenchidos para funcionar. Hoje o sistema funciona com o serviço Resend (resend.com): é dele a chave aceita aqui. "Chave do serviço de e-mail" é o código que a Resend te dá; ele fica escondido e, depois de salvo, só aparecem os quatro últimos caracteres. "Endereço que aparece como remetente" é o e-mail que seus clientes veem, e precisa ser de um domínio que você confirmou na Resend. O selo "Não configurado" ao lado de cada um diz que nada foi definido ainda. A frase cinza abaixo da chave só vale se você não tiver salvo o servidor próprio, no quadro de cima.
2. **Salvando um campo**  
   Cada campo tem o seu próprio botão "Salvar": escreva e clique no botão da mesma linha. Na hora aparece o aviso "Pronto, já está valendo.". O campo de digitar volta a ficar vazio e, logo acima dele, surge a linha "Agora:" com o valor gravado. O selo passa a dizer "Definido aqui nesta tela" e aparece o botão "Voltar ao padrão". O que você salva aqui vale no lugar do que estiver no arquivo de instalação do servidor.
3. **Voltar ao padrão**  
   "Voltar ao padrão" apaga o que foi gravado nesta tela, e o sistema volta a usar o valor do arquivo de instalação do servidor. Aparece o aviso "Voltou para o valor do arquivo de instalação.". Como nesta demonstração o arquivo não tem esse valor, a linha "Agora:" some e o selo volta a "Não configurado". O botão "Voltar ao padrão" some até você salvar de novo.

---

<a id="m-admin-sistema"></a>

## Recursos opcionais (Admin)

**Tela:** `/admin/sistema`  
**Resumo:** O lugar onde quem instalou o sistema liga os recursos extras, decide como ele se comporta e vê o que depende do servidor, para todas as empresas de uma vez.

**Lições:** [Conhecendo a tela de Recursos opcionais](#l-admin-sistema--conhecendo-a-tela) · [Ligar um módulo para as empresas](#l-admin-sistema--ligar-um-modulo) · [Decidir como o sistema se comporta](#l-admin-sistema--comportamento) · [O que depende do servidor](#l-admin-sistema--depende-do-servidor)

<a id="l-admin-sistema--conhecendo-a-tela"></a>

### Conhecendo a tela de Recursos opcionais

- **Objetivo:** Saber o que a tela de Recursos opcionais controla e reconhecer as suas três partes.
- **Papel mínimo:** Administrador
- **Busca no curso:** recursos opcionais; onde ligar recursos do sistema; ligar e desligar funções; configuração da instalação; módulos do sistema; admin recursos opcionais

1. **Onde fica a tela** — `/admin/sistema`  
   No Admin, o item "Recursos opcionais" do menu abre a tela que junta tudo o que se liga e desliga neste sistema. O que você escolhe aqui vale para todas as empresas hospedadas no seu servidor, não para uma só. Por isso só quem administra a instalação vê esta tela.
2. **Primeira parte: Módulos**  
   A primeira parte, "Módulos", lista os recursos extras que a maioria das instalações não usa. Todos vêm desligados. Desligado, um módulo não aparece para nenhuma empresa: nem tela, nem item no menu. Cada um tem uma chave à direita, e o texto ao lado conta o que ligar abre.
3. **Segunda parte: Comportamento**  
   A segunda parte, "Comportamento", reúne as escolhas sobre como o sistema age no dia a dia, como o que acontece quando uma empresa passa do teto de gasto com a IA. Elas ficam no quadro "O que esta instalação faz". A lição "Decidir como o sistema se comporta" explica cada uma.
4. **Terceira parte: Depende do servidor**  
   A última parte, "Depende do servidor", só mostra, não liga nada. São recursos que precisam de uma senha de outro serviço ou de um ajuste no servidor, como o envio de e-mail. O selo de cada linha diz se ele está "Configurado" ou "Não configurado". Quando a tela não consegue conferir, o selo diz "Não dá para ver daqui". Nenhuma senha aparece aqui.

<a id="l-admin-sistema--ligar-um-modulo"></a>

### Ligar um módulo para as empresas

- **Objetivo:** Ligar um módulo opcional, saber onde ele aparece depois e como desligar.
- **Papel mínimo:** Administrador
- **Busca no curso:** ligar módulo; ativar propostas comerciais; como liberar recurso para as empresas; módulo não aparece no menu; desligar módulo; liguei e não apareceu

1. **Escolha o módulo** — `/admin/sistema`  
   Cada módulo tem um quadro com o nome, o que ele faz e onde vai aparecer. Aqui, "Propostas comerciais" deixa a IA montar propostas pelos modelos da empresa. A linha de baixo diz onde ele aparece no menu depois de ligado. Para ligar, clique na chave à direita.
2. **Ligou, salvou**  
   Não há botão de salvar: o módulo fica ligado assim que você clica, e a chave fica colorida. A linha de baixo passa a dizer "Aparece no menu em:", com o caminho no menu das empresas. Cada troca fica registrada no item "Audit" do menu, com quem ligou e quando.
   > 💡 As propostas pedem um segundo passo: cada empresa ainda precisa ligá-las para si, em "Configurações" › "Propostas".
3. **Módulo que vira tela no Admin**  
   A "Cobrança dos seus clientes" é diferente: quem controla é você. Ligada, ela cria o item "Cobrança" no menu do Admin, onde você monta planos e decide quais empresas passam a pagar. As empresas que já existem ficam isentas até você escolher. Para receber de verdade, a tela Cobrança pede que você conecte uma conta do Asaas ou da Stripe, e o sistema precisa estar num endereço com https. As empresas que pagam veem o próprio plano em "Plano e cobrança". Clique na chave para ver.
4. **O item novo no menu do Admin**  
   Com a cobrança ligada, o item "Cobrança" passa a aparecer no fim do menu do Admin. Para desligar qualquer módulo, clique de novo na chave. Desligar a cobrança faz os limites dos planos deixarem de valer e libera as empresas que estavam suspensas por falta de pagamento.
5. **Módulos que se instalam em outra tela**  
   Abaixo das chaves ficam "Honorários" e "Comandas". Esses não ligam por chave: eles se instalam na tela "Módulos" do Admin. O selo mostra se estão ligados, e o botão "Ajustar" leva até lá.

<a id="l-admin-sistema--comportamento"></a>

### Decidir como o sistema se comporta

- **Objetivo:** Entender as quatro escolhas de comportamento e onde ficam as que moram em outras telas.
- **Papel mínimo:** Administrador
- **Busca no curso:** proteção de gasto de IA; IA parou de responder teto de gasto; assinatura nas entregas do canal; divulgação de pagamento; conferência de promessa; comportamento do sistema

1. **O quadro de comportamento** — `/admin/sistema`  
   O quadro "O que esta instalação faz" tem quatro escolhas. Elas valem para todas as empresas daqui, com uma exceção que a lição mostra adiante. Como nos módulos, cada escolha salva na hora, sem botão de salvar, e fica registrada no item "Audit" do menu, com o valor de antes e o de depois.
2. **Proteção de gasto de IA**  
   Cada empresa escolhe um teto de gasto com a IA. Esta escolha decide o que acontece quando ela passa dele. "Respeita o teto de cada empresa" é o padrão: vale o que cada empresa escolheu. "Só avisa, nunca para a IA" avisa a empresa, mas deixa a IA seguir respondendo. "Desligada" ignora o teto: nem avisa, nem para. Esta escolha nunca liga a proteção de uma empresa: só pode afrouxá-la.
3. **Exigir assinatura nas entregas do canal**  
   Ligada, esta chave faz o sistema recusar toda mensagem do WhatsApp conectado por QR code que chegar sem a assinatura secreta da conexão. Ela vem desligada porque nem todo servidor de WhatsApp assina: ligar sem que ele assine corta a entrada de mensagens. Logo abaixo, a tela conta se as últimas mensagens chegaram assinadas. Se nenhuma mensagem chegou na última semana, aparece "Nenhuma entrega do WhatsApp na última semana para conferir a assinatura.". Quando aparecer "Pode ligar: o WhatsApp já assina.", é seguro ligar.
4. **Divulgação e conferência de promessa**  
   "Divulgação de pagamento no atendimento" decide o que fazer quando a primeira mensagem a um contato sai sem o aviso de que quem atende é um assistente virtual. "Injetar" acrescenta o aviso, e "Vetar" barra o envio e pede à IA para reescrever. Ela só age se a empresa tiver um texto de aviso cadastrado. Já a "Conferência de promessa antes de enviar", ligada, faz a IA reler cada mensagem para não prometer o que a empresa não cumpre. Ela se soma a uma conferência fixa que sempre roda, e cada releitura custa uma chamada a mais à IA. Aqui você escolhe o padrão: cada empresa pode mudar o dela no painel de segurança do agente. Aqui a divulgação está em "Injetar", e a conferência de promessa vem ligada de fábrica.
5. **Escolhas que moram em outra tela**  
   Abaixo do quadro ficam duas escolhas da instalação que têm tela própria: "Quem pode criar conta" e "Destinos internos". O selo "Veja na tela dele" quer dizer que esta lista não mostra o valor. Clique em "Ajustar" para abrir a tela e ver ou mudar.

<a id="l-admin-sistema--depende-do-servidor"></a>

### O que depende do servidor

- **Objetivo:** Ler o estado dos recursos que dependem do servidor e saber o caminho para configurar cada um.
- **Papel mínimo:** Administrador
- **Busca no curso:** e-mail não configurado; o que falta configurar no servidor; recursos que dependem do servidor; configurar google agenda; notificação com a aba fechada; arquivo de ambiente do servidor

1. **Como ler uma linha** — `/admin/sistema`  
   Cada linha diz o nome do recurso e o que ele faz. Embaixo, em letra menor, aparece quem decide e se ele vem ligado ou desligado. O selo à direita é o estado agora: aqui o e-mail aparece "Não configurado", então convite de equipe e recuperação de senha ainda não chegam por e-mail.
2. **O botão Ajustar leva até a tela**  
   Clicar em "Ajustar" abre a tela onde o recurso se configura. No caso do e-mail, é a tela "E-mail" do Admin, onde você cadastra o servidor que vai enviar os e-mails do sistema. Depois de salvar lá, o selo em "Recursos opcionais" passa a dizer "Configurado".
   > 💡 na instalação feita pelo kit, a recuperação de senha só passa a usar esse e-mail depois que quem cuida do servidor roda a atualização do sistema.
3. **Recursos sem tela** — `/admin/sistema`  
   Alguns recursos não têm botão "Ajustar": eles só ligam no arquivo de configuração do servidor, e a linha diz o que fazer. Mostre esse texto a quem cuida do seu servidor. Depois do ajuste e de reiniciar o sistema, o selo muda para "Configurado". A "Telefonia por SIP" mostra "Não dá para ver daqui": ela é montada fora deste sistema, e a tela não tem como saber se está pronta. Isso não quer dizer que está desligada.

---

<a id="m-admin-destinos-internos"></a>

## Destinos internos (Admin)

**Tela:** `/admin/destinos-internos`  
**Resumo:** Onde quem cuida do servidor libera, um por um, os endereços da rede interna da própria máquina que o sistema pode chamar, como um serviço que você mesmo instalou ao lado dele.

**Lições:** [Conhecendo os destinos internos](#l-admin-destinos-internos--conhecendo-a-tela) · [Liberar um endereço](#l-admin-destinos-internos--liberar-um-endereco)

<a id="l-admin-destinos-internos--conhecendo-a-tela"></a>

### Conhecendo os destinos internos

- **Objetivo:** Entender por que o sistema recusa endereços da rede interna, o que esta lista libera e o que ela não libera.
- **Papel mínimo:** Administrador
- **Busca no curso:** destinos internos; liberar endereço da rede interna; endereço 10.0.0 recusado; serviço rodando no próprio servidor; rede local do servidor; ip interno bloqueado; admin

1. **Onde fica a tela** — `/admin/destinos-internos`  
   No Admin, o item "Destinos internos" do menu abre esta tela. Por proteção, o sistema não fala com endereços da rede interna do próprio servidor, como 10.0.0.5 ou 192.168.1.20: ele recusa antes de qualquer dado ou chave sair daqui. Aqui você abre exceções, endereço por endereço. Ela vale para o servidor inteiro, por isso só quem administra a instalação vê esta tela.
2. **O que a lista libera, e só isso**  
   O quadro "Endereços liberados" explica o alcance da lista. Um endereço que está nela deixa de ser recusado só por ser da rede interna, e o resto das regras continua valendo. No servidor de verdade, o endereço ainda precisa começar com https e ter certificado válido: um serviço que só responde em http continua recusado, mesmo estando na lista. A lista também só vale para serviços que quem instalou o servidor apontou no arquivo de configuração, como o buscador de empresas da tela "Prospecção" ou o serviço que transcreve áudios. Esses serviços são instalados à parte, e a lista sozinha não liga nenhum deles. O endereço que uma empresa escolhe no painel dela, como o de um provedor de IA, continua sem poder apontar para dentro, esteja aqui ou não.
3. **Como escrever um endereço**  
   No campo "Um endereço por linha", cada linha é uma exceção. Vale um endereço exato, como 10.1.2.7, ou uma faixa, como 10.1.0.0/16, que libera todos os endereços que começam com 10.1. O texto clarinho no campo vazio é só um exemplo. Nome de máquina não entra: o sistema confere o endereço para o qual o nome aponta na hora da chamada, e não o nome.
   > 💡 Se quem instalou o servidor já tinha escrito endereços no arquivo de configuração, eles aparecem aqui com um aviso. Ao salvar por esta tela, passa a valer o que está nela, e o arquivo deixa de ser consultado.
4. **Libere só o necessário**  
   O aviso amarelo, no pé do quadro, é o conselho mais importante da tela. Cada endereço da lista é uma porta que o servidor passa a poder abrir para dentro da própria rede, levando junto a chave da instalação. Libere só o endereço exato do serviço que você mesmo colocou lá. Nunca libere uma faixa inteira só para não ter trabalho.

<a id="l-admin-destinos-internos--liberar-um-endereco"></a>

### Liberar um endereço

- **Objetivo:** Escrever um endereço na lista, entender a recusa de uma linha errada, salvar e conferir o registro da mudança.
- **Papel mínimo:** Administrador
- **Busca no curso:** liberar endereço interno; adicionar ip na lista; não entendi estas linhas; salvar destinos internos; buscador de empresas no próprio servidor; quem liberou o endereço

1. **Uma linha com erro** — `/admin/destinos-internos`  
   Digamos que o buscador de empresas roda numa máquina da rede do servidor, no endereço 10.1.2.7, e que alguém escreveu também o nome dessa máquina, "servidor-de-busca". Ao clicar em "Salvar", nada é gravado: a tela mostra em vermelho "Não entendi estas linhas:" seguido da linha recusada. Assim você acha o erro sem conferir a lista inteira.
2. **Salvar a lista certa**  
   Apague a linha com o nome, deixe só 10.1.2.7 e clique em "Salvar". Ao lado do botão aparece "Lista salva.". Em até meio minuto, esse endereço deixa de ser recusado para os serviços que o arquivo de configuração do servidor aponta para ele, desde que o endereço use https. Se você repetir uma linha, ela é gravada uma vez só.
   > 💡 Para fechar todas as exceções, apague tudo do campo e salve: com a lista vazia, nenhum endereço interno é liberado.
3. **A mudança fica registrada** — `/admin/audit`  
   Cada "Salvar" que dá certo vira uma linha no registro do servidor, a tela "Audit" do menu do Admin. A linha aparece como "platform.internal_destinations_updated" e mostra quando a mudança foi feita. O botão "Ver", no fim da linha, abre os detalhes. Em "Metadata", "de" é a lista de antes e "para" é a de depois. "vinha_do_env" verdadeiro quer dizer que, até ali, valia o que estava no arquivo de configuração. No quadro "Actor" aparece o e-mail de quem mudou, com parte escondida. Assim, se um dia alguém perguntar desde quando o servidor fala com a rede interna, a resposta está aqui.

---

<a id="m-admin-configuracao"></a>

## Credenciais (Admin)

**Tela:** `/admin/configuracao`  
**Resumo:** Onde quem instalou o sistema confere as senhas e chaves do servidor e preenche os contatos que todas as empresas veem: o e-mail de suporte e o do encarregado de dados.

**Lições:** [Conhecendo a tela de Credenciais](#l-admin-configuracao--conhecendo-a-tela) · [Preenchendo os contatos da instalação](#l-admin-configuracao--contatos-da-instalacao) · [Os itens que só se conferem](#l-admin-configuracao--itens-so-de-consulta)

<a id="l-admin-configuracao--conhecendo-a-tela"></a>

### Conhecendo a tela de Credenciais

- **Objetivo:** Saber para que serve a tela de Credenciais do Admin, como ela se divide e o que dizem os selos de cada item.
- **Papel mínimo:** Administrador
- **Busca no curso:** credenciais da instalação; senhas e chaves do servidor; configuração da instalação admin; onde vejo as chaves do sistema; arquivo de instalação do servidor; admin

1. **Onde fica a tela** — `/admin/configuracao`  
   No Admin, o item "Credenciais" do menu abre a "Configuração da instalação". Ela reúne o que este servidor precisa saber para funcionar: contatos, senhas e chaves. Vale para todas as empresas do servidor, não só para a sua clínica. O que dá para trocar aqui vale na hora, sem mexer no servidor.
2. **Os quadros por assunto**  
   A tela é dividida em quadros: "E-mail", "Segurança e privacidade", "WhatsApp", "Banco de dados", "Fila de tarefas" e "Inteligência artificial". Cada quadro tem uma frase que explica para que ele serve. O de e-mail vem primeiro, mas aqui dentro só ficou o e-mail de suporte. O que faz o sistema enviar convites e recuperação de senha fica na tela "E-mail", pelo link que aparece logo no topo do quadro.
3. **Onde fica o envio de e-mail**  
   A chave do serviço que envia os e-mails e o endereço remetente não ficam nesta tela. O link "O serviço de envio de e-mail — próprio ou externo — fica em E-mail →" leva para a tela "E-mail" do Admin, onde está tudo sobre como os e-mails saem. A faixa amarela "Sem SMTP configurado", no alto, é um aviso geral do Admin: o envio de e-mails ainda não está configurado. O item "E-mail" do menu leva ao ajuste.
4. **De onde vem cada valor**  
   Ao lado do nome de cada item, um selo diz de onde vem o valor. "Não configurado", em amarelo: ninguém definiu ainda. "Vem do arquivo de instalação do servidor", em cinza: o valor foi escrito quando o servidor foi instalado. "Definido aqui nesta tela", em verde: alguém salvou o valor por esta tela, e ele vale no lugar do arquivo.

<a id="l-admin-configuracao--contatos-da-instalacao"></a>

### Preenchendo os contatos da instalação

- **Objetivo:** Cadastrar o e-mail de suporte e o e-mail do encarregado de dados, e saber voltar ao valor do arquivo de instalação.
- **Papel mínimo:** Administrador
- **Busca no curso:** e-mail de suporte do sistema; cadastrar encarregado de dados dpo; contato da lgpd da instalação; onde muda o e-mail de ajuda; voltar ao padrão credenciais; admin

1. **O e-mail de suporte** — `/admin/configuracao`  
   "E-mail de suporte" é o endereço que o administrador de cada empresa vê quando precisa de ajuda com a conta: na tela de conta suspensa e na tela "Plano e cobrança" (enquanto a cobrança automática das empresas não estiver ligada). Se ninguém preencher, essas telas só dizem para falar com quem administra o sistema, sem endereço. Escreva o e-mail no campo.
2. **Salvo e valendo**  
   Cada item tem o seu próprio botão "Salvar". Ao clicar, um aviso rápido confirma "Pronto, já está valendo.". Em seguida, a linha "Agora:" mostra o endereço gravado e o selo passa a dizer "Definido aqui nesta tela". Daqui em diante, este valor vale no lugar do que estiver no arquivo de instalação.
3. **O encarregado de dados (DPO)**  
   No quadro "Segurança e privacidade", "E-mail do encarregado de dados (DPO)" é o contato que a LGPD exige para pedidos de privacidade. Ele aparece nos documentos de privacidade e na entrega dos dados pedidos por um paciente, e recebe o aviso quando um pedido passa do prazo. Se a empresa preencheu o encarregado dela em Configurações, vale o dela. Este é o contato usado quando ela não preencheu. Escreva o e-mail e clique no "Salvar" ao lado dele.
4. **Voltar ao padrão**  
   Depois que um item é salvo por aqui, aparece ao lado o botão "Voltar ao padrão". Ele serve para desfazer: apaga o que foi gravado nesta tela, e o sistema volta a usar o valor do arquivo de instalação do servidor.
5. **De volta ao valor do arquivo**  
   Depois do clique, um aviso aparece por alguns segundos no canto de baixo da tela: "Voltou para o valor do arquivo de instalação.". Como nesta demonstração o arquivo não tem e-mail de suporte, a linha "Agora:" some e o selo volta a "Não configurado". O botão "Voltar ao padrão" também some até você salvar outra vez. Aqui desfizemos também o do encarregado de dados.

<a id="l-admin-configuracao--itens-so-de-consulta"></a>

### Os itens que só se conferem

- **Objetivo:** Entender por que a maioria das senhas e chaves aparece só para conferir e onde elas são trocadas.
- **Papel mínimo:** Administrador
- **Busca no curso:** trocar senha do whatsapp do servidor; por que não consigo editar a chave; chave que tranca as credenciais; senha do banco de dados; conferir chave guardada no servidor; admin

1. **Guardado, mas sem campo** — `/admin/configuracao`  
   A maioria dos itens não tem campo para escrever. Eles servem para conferir: o selo diz se o valor existe, e a linha "Guardado, terminando em" mostra só os quatro últimos caracteres da senha, nunca ela inteira. Assim você confirma qual senha está em uso sem expô-la.
2. **O porquê de cada um**  
   Embaixo de cada item, uma frase curta diz por que ele não se troca por aqui, seguida de "por quê?". Clique nela para ler a explicação completa. Na "Chave que tranca as credenciais", por exemplo: ela é a chave do cofre onde ficam as outras senhas, e por isso mora no arquivo do servidor, fora do banco de dados. Clique de novo, em "ocultar", para fechar.
3. **As senhas do WhatsApp**  
   No quadro "WhatsApp", as duas senhas têm um par no programa que conecta o WhatsApp. Trocar só de um lado deixaria os dois falando senhas diferentes, e o WhatsApp cairia. Por isso a troca é feita no arquivo de instalação do servidor, seguida de reinício dos dois programas: um pedido para quem cuida da sua hospedagem.
4. **Banco, fila e inteligência artificial**  
   Os últimos quadros seguem a mesma ideia. O endereço e a senha do banco de dados aparecem com "Necessária para o sistema ligar": sem eles o sistema não abre nem esta tela. A senha da fila tem um par em outro programa. O "Modo de distribuição das conversas da IA" é lido por outro programa só quando ele liga. Todos se trocam no arquivo de instalação do servidor.

---

<a id="m-admin-extensoes"></a>

## Extensões (Admin)

**Tela:** `/admin/extensoes`  
**Resumo:** Onde quem instalou o sistema confere, sem mexer em nada, de onde vêm as extensões do servidor, quais estão instaladas e em quantas empresas cada uma está ligada.

**Lições:** [Conhecendo a tela de Extensões do Admin](#l-admin-extensoes--conhecendo-a-tela) · [Quem está usando cada extensão](#l-admin-extensoes--quem-usa-cada-extensao)

<a id="l-admin-extensoes--conhecendo-a-tela"></a>

### Conhecendo a tela de Extensões do Admin

- **Objetivo:** Saber para que serve a tela de Extensões do Admin e ler as suas duas partes: o catálogo de onde as extensões vêm e as extensões instaladas no servidor.
- **Papel mínimo:** Administrador
- **Busca no curso:** extensões do servidor; de onde vêm as extensões; catálogo de extensões admitido; extensões instaladas na instalação; guias prontos do crm; admin

1. **Onde fica a tela** — `/admin/extensoes`  
   No Admin, o item "Extensões" do menu abre as "Extensões da instalação": a visão do servidor inteiro, e não só da sua clínica. Extensões são guias prontos que orientam a equipe dentro do CRM. Esta tela só mostra: aqui não há botão para instalar, ligar ou configurar nada. Isso continua sendo feito dentro de cada empresa.
   > 💡 A faixa amarela "Sem SMTP configurado", no alto, é um aviso geral do Admin: o envio de e-mails ainda não está configurado. O item "E-mail" do menu leva ao ajuste.
2. **De onde vêm as extensões**  
   O primeiro quadro mostra os catálogos aceitos neste servidor. Catálogo é o arquivo com a lista de extensões que podem ser instaladas. Para cada um você vê o endereço de onde ele vem, a "Revisão" do arquivo, a data em que foi admitido e a "impressão digital": o começo de um código que identifica exatamente aquele arquivo, útil numa conversa com o suporte. O sistema não confere quem escreveu o catálogo: só admita arquivo de uma fonte em que você confia. Numa instalação nova aparece "Nenhum catálogo admitido ainda": enquanto for assim, não há extensão para instalar.
3. **As extensões instaladas**  
   O segundo quadro, "Instaladas neste servidor", lista cada extensão com o nome curto de quem a publica, uma barra, o nome dela e a versão em uso. Em "guias-clinica/retorno-de-pacientes v1.0.0", quem publica é "guias-clinica" e o guia é o "Retorno de pacientes". Uma extensão é instalada uma vez só, para o servidor todo; depois, cada empresa decide se a liga. Uma extensão removida some desta lista.

<a id="l-admin-extensoes--quem-usa-cada-extensao"></a>

### Quem está usando cada extensão

- **Objetivo:** Ler em quantas empresas cada extensão está ligada e saber onde ir para instalar ou configurar.
- **Papel mínimo:** Administrador
- **Busca no curso:** quantas empresas usam a extensão; extensão ligada em quais clínicas; extensão instalada mas desligada; onde instalar uma extensão; configurar extensão da empresa; admin

1. **Instalada, mas desligada** — `/admin/extensoes`  
   Embaixo de cada extensão, uma frase conta as empresas. No "Roteiro da primeira consulta", "0 de 2" quer dizer que duas empresas já mexeram nesse guia (ligaram ou desligaram em algum momento) e nenhuma está com ele ligado agora: ninguém está vendo esse guia. As empresas que nunca mexeram nele não entram na conta, e também não o veem. "Ligada" aqui é o mesmo que "Ativa" na tela da empresa. Ao lado vem a data em que a extensão foi instalada.
2. **Ligada em uma empresa**  
   Já o "Retorno de pacientes" mostra "1 de 2": das duas empresas que já mexeram nesse guia, uma está com ele ligado. A tela diz quantas, não quais. Quando nenhuma empresa nunca ligou nem desligou a extensão, a frase muda para "Nenhuma empresa usa esta extensão".
3. **Para instalar ou configurar**  
   Admitir um catálogo, instalar, trocar de versão e ligar uma extensão são feitos na tela "Extensões" de dentro da empresa. O link "Extensões da empresa →", no fim desta tela, leva até lá. Clique nele.
4. **A tela da empresa**  
   Abriu a tela "Extensões" da empresa em que você está, aqui a Clínica Bem Viver. Como você administra o servidor, aparece o quadro "Oriente o trabalho com novos guias", marcado como "Responsável pela instalação", com "Escolher arquivo JSON" e "Admitir catálogo": é por ele que um catálogo entra no servidor. Embaixo, na aba "Instaladas", o administrador de cada empresa liga um guia para a própria equipe no interruptor "Ativa no CRM" e depois em "Salvar configuração". Aqui os dois aparecem "Desativada". O módulo "Extensões" ensina cada ação.

---

<a id="m-admin-modulos"></a>

## Módulos (Admin)

**Tela:** `/admin/modulos`  
**Resumo:** Onde quem instalou o sistema acrescenta partes extras ao servidor, como Comandas e Honorários, que passam a valer para todas as empresas dele.

**Lições:** [Conhecendo a tela de Módulos](#l-admin-modulos--conhecendo-a-tela) · [Instalando um módulo](#l-admin-modulos--instalar-um-modulo)

<a id="l-admin-modulos--conhecendo-a-tela"></a>

### Conhecendo a tela de Módulos

- **Objetivo:** Achar a tela de Módulos no Admin e reconhecer um módulo ainda não instalado e um já instalado.
- **Papel mínimo:** Administrador
- **Busca no curso:** módulos do sistema; módulos da instalação; instalar comandas; instalar honorários; partes extras do sistema; admin módulos

1. **Onde fica a tela** — `/admin/modulos`  
   No Admin, o item "Módulos" do menu abre os "Módulos da instalação". Um módulo é uma parte extra do sistema, com lugar próprio para guardar os dados dele. Ele só ocupa espaço no servidor depois de instalado. E a instalação vale para todas as empresas deste servidor, não só para a sua clínica.
   > 💡 Só quem administra o servidor inteiro vê esta tela. Para os outros usuários, o endereço abre a página "Acesso negado". A faixa amarela "Sem SMTP configurado", no alto, é um aviso geral do Admin: o envio de e-mails ainda não está configurado. O item "E-mail" do menu leva ao ajuste.
2. **Um módulo ainda não instalado**  
   Cada módulo aparece num cartão com o nome e uma frase sobre o que ele faz. "Honorários (advocacia)" guarda o contrato de cobrança de cada caso e o calendário de parcelas: serve para escritórios de advocacia. Enquanto o módulo não está instalado, o cartão mostra o botão "Instalar" à direita.
3. **Um módulo já instalado**  
   "Comandas" guarda a comanda de cada atendimento: os itens, a forma de pagamento, as comissões e os pontos de fidelidade. Neste servidor ele já foi instalado, por isso o cartão mostra o selo verde "Instalado" e não tem mais o botão. O caixa da clínica funciona com ou sem este módulo.

<a id="l-admin-modulos--instalar-um-modulo"></a>

### Instalando um módulo

- **Objetivo:** Saber o que acontece ao clicar em "Instalar" e onde o módulo aparece para a equipe depois.
- **Papel mínimo:** Administrador
- **Busca no curso:** como instalar um módulo; ativar comandas no sistema; onde aparece o módulo instalado; módulo suspenso; desinstalar módulo; honorários advocacia

1. **O botão Instalar** — `/admin/modulos`  
   Para instalar, clique em "Instalar" no cartão do módulo. Enquanto o servidor prepara o espaço do módulo, o botão troca para "Instalando…" por alguns segundos (na foto ele ainda está parado). Não há versão para escolher nem empresa para marcar: um clique instala para o servidor inteiro. Instale só o que alguma empresa deste servidor vai usar. Esta tela não tem botão para desinstalar.
   > 💡 Se algo der errado, a mensagem aparece em vermelho no alto da lista e o botão volta a ficar disponível.
2. **Depois de instalar**  
   Quando a instalação termina, a lista se atualiza sozinha: o cartão ganha o selo "Instalado" e o botão some, como aconteceu aqui com "Comandas". Se um dia uma atualização do sistema não conseguir refazer o módulo, o selo vira "Suspenso", em vermelho, e as telas dele somem das empresas até a próxima atualização dar certo. Logo abaixo da descrição aparece o motivo, num texto técnico: copie e mande para quem cuida do seu servidor. Esta tela não tem botão para tentar de novo.
3. **Onde a equipe encontra o módulo** — `/app/crm`  
   Instalado, o módulo ganha uma tela dentro de cada empresa. A de "Comandas" fica no CRM: abra "Ver tudo em CRM" e procure a parte "O dia a dia da venda". Antes de instalar, esse cartão não aparece. O de "Honorários" aparece em "Ver tudo em Análise", na parte "Dinheiro". Se uma empresa escolheu um por um os itens do menu, a tela nova só aparece depois que alguém dela a marcar em Configurações, no "Menu lateral".

---

<a id="m-admin-cobranca"></a>

## Cobrança (Admin)

**Tela:** `/admin/cobranca`  
**Resumo:** Onde quem revende o sistema cobra as empresas clientes: conecta a conta de pagamento, cria os planos, define quantos dias de atraso tolerar e acompanha quem está em dia.

**Lições:** [Conhecendo a tela de Cobrança](#l-admin-cobranca--conhecendo-a-tela) · [Conectando a conta de pagamento](#l-admin-cobranca--conexao) · [Criando e cuidando dos planos](#l-admin-cobranca--planos) · [A régua de atraso](#l-admin-cobranca--regua) · [Acompanhando quem paga](#l-admin-cobranca--clientes)

<a id="l-admin-cobranca--conhecendo-a-tela"></a>

### Conhecendo a tela de Cobrança

- **Objetivo:** Achar a Cobrança no Admin e ler a Visão geral: o que falta para a primeira cobrança, se a cobrança está funcionando e o que precisa de atenção.
- **Papel mínimo:** Administrador
- **Busca no curso:** cobrança dos clientes; cobrar as empresas; mensalidade dos clientes; planos e faturas; revenda do sistema; assinatura das empresas; admin cobrança

1. **Onde fica a tela** — `/admin/cobranca`  
   No Admin, o item "Cobrança" do menu abre a cobrança das empresas que usam o seu sistema. Aqui você cria os planos que vende, conecta a conta que recebe os pagamentos e acompanha quem está em dia.
   > 💡 O item só aparece depois que você liga 'Cobrança dos seus clientes' em 'Recursos opcionais', aqui no Admin. Desligado, o endereço mostra página não encontrada.
2. **A tela e as abas** — `/admin/cobranca`  
   O título é "Cobrança dos seus clientes". Empresa sem plano é isenta: não paga e não tem limites. A tela tem cinco abas: "Visão geral", "Conexão", "Régua", "Planos" e "Clientes". Ela abre na "Visão geral", que você vê nesta lição.
3. **O aviso de modo de teste**  
   Enquanto a conta de pagamento estiver conectada com a chave de teste, esta faixa de aviso, em tom de areia, aparece no alto de todas as abas. Ela avisa que as empresas reais ainda não conseguem pagar. Em modo de teste, nenhum pagamento é de verdade: serve para você conferir que tudo funciona antes de cobrar.
4. **O que falta para a primeira cobrança**  
   O cartão 'Primeira cobrança: o que falta' é a sua lista de tarefas. Passo feito aparece riscado, com um tique. Passo que falta vem com a explicação de como fazer. O próximo passo pendente ganha o link 'Fazer agora' quando há um lugar certo para resolvê-lo. Aqui falta configurar o envio de e-mail e, por último, trocar para a chave de produção. A faixa amarela "Sem SMTP configurado", no alto, é um aviso geral do Admin: o envio de e-mails ainda não está configurado. O item "E-mail" do menu leva ao ajuste.
5. **A cobrança está funcionando?**  
   O cartão 'Situação da cobrança' diz se a cobrança está viva. O selo mostra se você está em 'MODO DE TESTE' ou em 'PRODUÇÃO'. 'Último aviso do provedor' é a última vez que a empresa de pagamento mandou um aviso, como um pagamento ou uma assinatura nova. 'Última leitura bem-sucedida' é a última vez que o sistema conferiu as assinaturas sozinho, o que ele faz a cada 6 horas. Se essa leitura passar de 7 horas, a linha fica vermelha: a conferência automática parou, e quem cuida do seu servidor precisa olhar.
6. **Problemas para resolver**  
   Quando algo precisa de você, aparece o cartão "Problemas para resolver", com o que fazer em cada caso. Aqui uma empresa tem duas assinaturas ativas e pagaria em dobro: cancele uma delas no painel da empresa de pagamento. Sem problema nenhum, o cartão não aparece.

<a id="l-admin-cobranca--conexao"></a>

### Conectando a conta de pagamento

- **Objetivo:** Escolher entre Asaas e Stripe e entender o que acontece ao colar a chave e clicar em "Testar e conectar".
- **Papel mínimo:** Administrador
- **Busca no curso:** conectar stripe; conectar asaas; chave de api pagamento; receber por pix; trocar chave de teste para produção; provedor de pagamento

1. **A aba Conexão** — `/admin/cobranca?aba=conexao`  
   Na aba "Conexão" você liga o sistema à empresa que recebe os pagamentos por você. O selo ao lado de "Provedor de pagamento" mostra o modo atual. "Chave conectada" mostra só os 4 últimos caracteres da chave guardada: o resto fica escondido, por segurança.
2. **Asaas ou Stripe?**  
   No campo 'Provedor' você escolhe com quem vai receber. Com o Asaas, todo mês a empresa recebe a cobrança e paga por Pix, boleto ou cartão, informando o CPF ou CNPJ. É o recomendado se seus clientes estão no Brasil. Com a Stripe, o cartão é cobrado sozinho todo mês e não há Pix. O boleto só aparece se você ligá-lo no painel da Stripe. Ao escolher Asaas, o campo da chave passa a pedir a 'Chave de API do Asaas'.
3. **Colar a chave e conectar**  
   Com a Stripe escolhida de novo em 'Provedor', cole a chave que você copiou no painel dela (Desenvolvedores › Chaves de API) e clique em 'Testar e conectar'. O sistema confere a chave com o provedor antes de guardar qualquer coisa. Se ela for aceita, ele cadastra o aviso de pagamento e guarda a chave protegida. Comece pela chave de teste. Trocar para a chave de produção é o que faz a cobrança valer de verdade: se alguma empresa assinou em teste, o sistema pede confirmação no botão 'Publicar mesmo assim', porque ela volta para o teste grátis.
   > 💡 O botão só acende com a chave colada e com o sistema num endereço https: sem https, a tela avisa e o botão fica travado. No Asaas, às vezes o aviso de pagamento precisa ser cadastrado à mão: a tela mostra a URL, o token e os eventos para copiar.

<a id="l-admin-cobranca--planos"></a>

### Criando e cuidando dos planos

- **Objetivo:** Ler a lista de planos, montar um plano novo e usar os botões de cada plano.
- **Papel mínimo:** Administrador
- **Busca no curso:** criar plano; preço do plano; teste grátis; plano do cadastro; plano negociado com desconto; arquivar plano; limite de usuários do plano

1. **A lista de planos** — `/admin/cobranca?aba=planos`  
   A aba "Planos" lista o que você vende. Cada plano mostra o preço, os dias de teste grátis e os limites: pessoas, números conectados e gasto com IA por mês. O selo "Plano do cadastro" marca o plano que quem se cadastra sozinho ganha, com teste grátis. O selo "Só você atribui" marca um plano negociado: as empresas não o veem, só você o coloca nelas.
2. **Montando um plano novo**  
   No formulário 'Novo plano', dê um nome, o preço e o 'Intervalo de cobrança' ('Mensal' ou 'Anual'). Em 'Dias de teste grátis', 0 quer dizer entrada paga: a empresa fica suspensa até o primeiro pagamento. Os limites são opcionais e campo vazio é sem limite. O teto de IA é em dólar. Ao clicar em 'Salvar plano', ele entra na lista e aparece 'Plano salvo.'.
   > 💡 O preço mínimo é R$ 5,00 e o teste grátis vai de 0 a 90 dias.
3. **Os botões de cada plano** — `/admin/cobranca?aba=planos`  
   Cada plano tem os seus botões. 'Usar no cadastro' faz dele o plano de quem se cadastra. Só um plano tem esse papel: antes, clique em 'Tirar do cadastro' no plano atual. 'Esconder das empresas' o transforma em plano negociado. 'Arquivar' tira o plano do cadastro e da troca, mas quem já assina continua nele. Depois que alguém assina, o preço e o intervalo não mudam mais: o sistema recusa ao salvar. Para mudar, arquive e crie outro.
4. **Editando um plano**  
   "Editar" leva o plano para o formulário, que vira "Editar plano". Nome, limites e dias de teste podem mudar sempre, e o limite novo já vale para quem assina. Clique em "Salvar alterações" para gravar, ou em "Cancelar edição" para desistir.

<a id="l-admin-cobranca--regua"></a>

### A régua de atraso

- **Objetivo:** Definir quantos dias de atraso tolerar antes de suspender uma empresa, e ler o calendário de avisos.
- **Papel mínimo:** Administrador
- **Busca no curso:** dias de tolerância; suspender empresa que não pagou; cliente atrasado; aviso de pagamento atrasado; régua de cobrança; prazo para pagar

1. **O calendário do atraso** — `/admin/cobranca?aba=regua`  
   A aba 'Régua' diz o que acontece com uma empresa que não pagou. 'Dias de tolerância' é quanto tempo ela tem antes de ser suspensa. A lista abaixo mostra o calendário: no dia 0 sai o primeiro aviso com o link para pagar, depois vem o aviso final e, por fim, a suspensão. Os avisos aparecem dentro do sistema da empresa e, se o envio de e-mail estiver configurado, chegam também por e-mail. Quando o pagamento é confirmado, a empresa volta a funcionar sozinha.
2. **Mudando a tolerância**  
   Troque o número e o calendário se ajusta na hora, antes mesmo de salvar. Com 10 dias, o aviso final sai no dia 8 e a suspensão vem no dia 10. Vale de 5 a 30 dias. Clique em "Salvar régua" para gravar. A tolerância vale para pagamento atrasado: o teste grátis que acaba sem pagamento suspende a empresa 48 horas depois do aviso final.

<a id="l-admin-cobranca--clientes"></a>

### Acompanhando quem paga

- **Objetivo:** Ler a situação de cada empresa na aba Clientes, mandar o link de pagamento a quem atrasou e abrir o painel da empresa.
- **Papel mínimo:** Administrador
- **Busca no curso:** empresa em atraso; quem não pagou; link de pagamento; próximo vencimento; situação da assinatura; dar prazo para pagar; tornar empresa isenta

1. **A lista de clientes** — `/admin/cobranca?aba=clientes`  
   A aba 'Clientes' lista as empresas que têm plano. Para cada uma você vê o plano, a 'Situação' ('Teste grátis', 'Em dia', 'Em atraso' ou 'Cancelada') e o 'Próximo vencimento' (no teste grátis, o dia em que o teste acaba). A 'Última leitura' é a última vez que o sistema conferiu o pagamento, e a coluna 'Problema' mostra o que deu errado nessa conferência. Empresa sem plano não aparece aqui: ela é isenta.
2. **Uma empresa em atraso**  
   A FisioVida está "Em atraso": a coluna "Em atraso desde" mostra, em vermelho, desde quando ela deve. O botão "Copiar link de pagamento" copia o link da cobrança em aberto para você mandar pelo WhatsApp. Assim você recupera o pagamento sem esperar a régua.
3. **Troca de plano agendada**  
   Quando a coluna "Plano" mostra uma seta, como "Essencial → Profissional", a empresa vai trocar de plano. O novo plano vale a partir da próxima cobrança paga.
4. **Abrir o painel da empresa**  
   'Abrir' leva ao painel da empresa, em Tenants. No cartão 'Cobrança' você troca o plano dela, dá um prazo de até 60 dias ('Dar prazo') ou a deixa sem cobrança ('Tornar isenta'). Para isentar quem ainda tem assinatura no provedor, cancele a assinatura lá antes. Para empresa que não está em dia, 'Gerar link de pagamento' cria um link novo para você mandar a ela. Se ela foi suspensa por falta de pagamento, dar prazo a reativa na hora.
   > 💡 Para dar prazo, escolha a data primeiro: o botão "Dar prazo" só acende depois.

---

<a id="m-atualizacao"></a>

## Atualização do sistema

**Tela:** `/app/settings/atualizacao`  
**Resumo:** Onde quem instalou o sistema vê a versão em uso, descobre que saiu uma versão nova, lê o que muda e pede a atualização sem abrir o servidor.

**Lições:** [Atualizando para a versão nova](#l-atualizacao--atualizando)

<a id="l-atualizacao--atualizando"></a>

### Atualizando para a versão nova

- **Objetivo:** Reconhecer o aviso de versão nova, ler o que muda e pedir a atualização pela tela.
- **Papel mínimo:** Administrador
- **Busca no curso:** atualizar o sistema; versão nova; nova versão disponível; qual versão estou usando; o que mudou na versão; atualizar agora

1. **O aviso de versão nova** — `/app/inbox`  
   No rodapé do menu fica a versão em uso. Quando sai uma versão nova, aparece logo abaixo o aviso "Nova versão", com o número dela. Só quem administra a instalação vê esse aviso, porque só essa pessoa pode atualizar. Clique nele.
2. **A versão instalada e a nova** — `/app/settings/atualizacao`  
   A tela abre com o número da versão nova no título. No quadro logo abaixo ficam a "Versão instalada", a última versão oficial publicada e a data em que o servidor confirmou o que está rodando. A "Revisão" é o código exato da versão, útil se for pedir ajuda.
3. **O que muda**  
   Mais abaixo, "O que muda" lista as novidades da versão nova, como o próprio projeto as publicou. Se alguma delas pedir uma ação sua, um quadro amarelo "Requer atenção" aparece antes do botão, e aí vale ler antes de atualizar.
4. **O botão Atualizar agora**  
   Ao lado de "Atualizar agora", a tela avisa o que acontece: o sistema sai do ar por cerca de 2 minutos e volta sozinho, e antes disso é feita uma cópia de segurança dos dados. Escolha um horário de pouco movimento e clique.
5. **Pedido enviado**  
   O pedido fica anotado e o servidor confere de poucos em poucos minutos se há algo a fazer: a atualização pode levar uns cinco minutos para começar, e a tela parada nesse tempo é normal. O relógio mostra há quanto tempo o pedido espera. Pode fechar a página: o pedido não se perde, e a tela acompanha sozinha cada etapa até o sistema voltar.
