# Curso DeskComm — CRM

> Gerado a partir do [curso oficial do DeskComm](https://www.deskcomm.com.br/curso) — versão 1.94.0, gerado em 2026-10-29. Conteúdo do **núcleo do DeskcommCRM (upstream)**; o que o fork de clínicas acrescenta está em [`docs/funcionalidades.md`](../funcionalidades.md). As capturas de tela de cada passo ficam no curso online.

[← Índice do curso](README.md)

## Módulos deste grupo

| Módulo | Tela | Lições | Para que serve |
|---|---|---|---|
| [Prospecção](#m-prospeccao) | `/app/prospecting` | 4 | Busque empresas e conduza abordagens graduais com IA. |
| [Funis](#m-funis) | `/app/kanban` | 7 | Seus funis de venda — clique em um para abrir o quadro de clientes. |
| [Campanhas](#m-campanhas) | `/app/campaigns` | 4 | Fale com uma lista de contatos que você escolhe, no ritmo do número. |
| [Contatos](#m-contatos) | `/app/contacts` | 7 | As pessoas do outro lado da conversa e seu histórico. |
| [Empresas](#m-empresas) | `/app/companies` | 2 | Cadastro B2B — razão social, CNPJ e decisores. |
| [Pessoas](#m-pessoas) | `/app/people` | 2 | Decisores e contatos ligados a empresas, com vários telefones. |
| [Tarefas](#m-tarefas) | `/app/tasks` | 6 | O que ficou combinado, com prazo — e o que já venceu sem ninguém fazer. |
| [Planos de tarefa](#m-planos-de-tarefa) | `/app/tasks/planos` | 4 | Sequências reutilizáveis de tarefas — montar uma vez e aplicar a cada negócio. |
| [Chamadas](#m-chamadas) | `/app/calls` | 2 | Histórico de ligações (voz por IA) com transcrição. |
| [Produtos](#m-produtos) | `/app/products` | 4 | O catálogo da loja, com o preço que o atendente de IA responde. |
| [Importações](#m-importacoes) | `/app/imports` | 2 | Lotes CSV/XLSX de empresas, pessoas e telefones. |
| [Propostas do dia a dia](#m-propostas-do-crm) | `/app/proposals` | 3 | Rascunhe, revise e envie propostas comerciais — do orçamento ao aceite. |
| [Comandas](#m-comandas) | `/app/comandas` | 3 | O que foi feito, por quem, e quanto o cliente paga. |
| [Etapas do funil](#m-etapas-do-funil) | `/app/settings/tenant/pipelines` | 4 | As colunas de cada funil, o vocabulário do negócio e os motivos de perda. |

---

<a id="m-prospeccao"></a>

## Prospecção

**Tela:** `/app/prospecting`  
**Resumo:** Onde você procura empresas no Google Maps, escolhe quais abordar e deixa um agente de IA começar a conversa com elas pelo WhatsApp, aos poucos, acompanhando quem responde.

**Lições:** [Conhecendo a tela de Prospecção](#l-prospeccao--conhecendo-a-prospeccao) · [Configurar e fazer uma busca](#l-prospeccao--configurar-e-buscar) · [Escolher as empresas que serão abordadas](#l-prospeccao--escolher-as-empresas) · [Preparar a abordagem, iniciar e ajustar o ritmo](#l-prospeccao--preparar-e-iniciar)

<a id="l-prospeccao--conhecendo-a-prospeccao"></a>

### Conhecendo a tela de Prospecção

- **Objetivo:** Encontrar a Prospecção dentro de Ver tudo em CRM e entender as campanhas, os números e a tabela de empresas.
- **Papel mínimo:** Administrador
- **Busca no curso:** onde fica prospecção; encontrar empresas; prospectar clientes; abordar empresas no whatsapp; lista de empresas para vender; campanha de prospecção; captar clientes novos

1. **Prospecção mora em Ver tudo em CRM** — `/app/crm`  
   Abra "Ver tudo em CRM", no grupo "CRM" do menu lateral. Na parte "O dia a dia da venda" fica o cartão "Prospecção". O caminho é CRM › Ver tudo em CRM › Prospecção: ela não tem atalho próprio no menu lateral.
   > 💡 Só o administrador da empresa vê este cartão e abre a tela. Para gerente e atendente o cartão não aparece, e o endereço da tela leva de volta ao Inbox.
2. **Para que serve** — `/app/prospecting`  
   A Prospecção serve para achar empresas e começar uma conversa com elas pelo WhatsApp, com a ajuda de um agente de IA. A tela segue três etapas: "1. Encontrar empresas" é a busca; "2. Preparar a abordagem" define quem conversa e como; "3. Acompanhar resultados", mais abaixo, mostra cada empresa. Ao abrir, a tela mostra a campanha mais recente.
   > 💡 Quem responde segue a conversa no Inbox, como qualquer outro contato.
3. **Suas campanhas**  
   Cada busca vira uma campanha na lista "Suas campanhas", com o segmento e a região no nome. Embaixo do nome aparecem a situação e quantas empresas a busca trouxe: "Preparar campanha" (nada foi enviado ainda), "Em andamento" (enviando), "Pausada" ou "Abordagens concluídas". A campanha aberta fica com a borda colorida. Clique na campanha dos escritórios de contabilidade para abri-la.
4. **Os números da campanha**  
   O quadro do alto mostra a situação da busca, quanto ela custou na Apify e a situação da campanha ("Pausada"). Os números contam empresas: "Encontrados" é tudo o que a busca trouxe e "Na fila" espera a vez da primeira mensagem. "Responderam" já escreveram de volta. "Pediram para parar" estão bloqueados para novas mensagens. "Qualificados" chegaram à etapa do funil que você marcou como de qualificados. "Score médio" é a média do Score das empresas, que você vai conhecer na lição sobre escolher as empresas.
5. **A tabela de empresas**  
   Em "3. Acompanhar resultados", cada linha é uma empresa: nome, segmento e telefone; endereço, site, nota e avaliações no Google; a situação em "Progresso"; e a análise em "Auditoria". Em "Progresso" a empresa passa por "Encontrado", "Na fila", "Preparando abordagem" e "Abordado" e, depois, "Respondeu" e "Qualificado". Quando aparece "Não abordado", o motivo vem logo abaixo, como "Sem telefone brasileiro válido.".
   > 💡 Quando a empresa já tem conversa, a última coluna, "Conversa", mostra o link "Abrir no Inbox". Numa tela do tamanho desta foto ela fica escondida à direita: role a tabela para o lado.

<a id="l-prospeccao--configurar-e-buscar"></a>

### Configurar e fazer uma busca

- **Objetivo:** Salvar a chave da Apify, dizer quem assina as mensagens e pedir uma busca de empresas por segmento e região.
- **Papel mínimo:** Administrador
- **Busca no curso:** chave da apify; configurar prospecção; buscar empresas no google maps; quanto custa a busca; nome nas mensagens da prospecção; vocabulário por nicho; nova busca de empresas

1. **A busca precisa de uma chave** — `/app/prospecting`  
   Na instalação padrão, as empresas vêm da Apify, um serviço de fora que procura negócios no Google Maps e cobra cada busca do seu saldo lá. Por isso a Prospecção precisa da chave da sua conta na Apify. Na primeira vez, sem chave salva, os quadros de configuração já aparecem abertos e o botão "Buscar empresas" fica apagado. Depois, eles ficam atrás do botão "Configurar busca".
2. **A chave da Apify**  
   Em "Chave da Apify", cole a chave da sua conta na Apify. No site da Apify ela fica em Configurações e aparece com o nome "API token". Depois clique em "Salvar chave". Antes de gravar, o sistema confere a chave com a Apify: se ela não for aceita, nada é salvo e aparece o aviso. Aceita, ela fica cifrada no servidor, os quadros se fecham e aparece "Chave de busca salva.". A chave salva não volta a aparecer; para trocar, cole a nova e salve de novo.
   > 💡 O campo mostra só pontinhos enquanto você digita, para a chave não aparecer na tela.
3. **Quem assina as mensagens**  
   No quadro "Voz e vocabulário", preencha "Seu nome", "O que você faz" e "Diferencial": a IA escreve a primeira mensagem na voz dessa pessoa. Em "Vocabulário por nicho", escreva uma linha por segmento no formato "termo: valor". Quando o segmento da busca contém o termo, a estratégia de abordagem usa o seu valor para falar do que aquele tipo de empresa quer ganhar. Clique em "Salvar personalização": vale para todas as campanhas.
4. **O que e onde procurar** — `/app/prospecting`  
   No quadro "1. Encontrar empresas", escreva em "Público ou segmento" o tipo de empresa e em "Cidade ou região" onde ela fica, do jeito que você pesquisaria no Google Maps. "Até quantas empresas" é o máximo que a busca traz, de 1 a 100. "Teto da busca (US$)" é o máximo que esta busca pode gastar do seu saldo na Apify, de US$ 0,50 a US$ 10.
5. **As opções e o botão de buscar**  
   As três opções vêm marcadas. "Enriquecer com e-mails comerciais e redes encontradas no site" pede à busca os contatos publicados no site de cada empresa. "Avaliar o site de cada empresa automaticamente" faz o sistema abrir cada site e anotar o que encontrou, sem gastar IA. "Gerar a prévia da mensagem automaticamente" faz a IA escrever um rascunho da primeira mensagem para cada empresa marcada e consome crédito de IA; ela só funciona com a avaliação do site ligada. Clique em "Buscar empresas".
   > 💡 Nenhuma mensagem sai nesta etapa. A busca aparece em "Suas campanhas" como uma campanha nova; enquanto ela roda, a tela se atualiza sozinha, e no fim a campanha mostra "Busca concluída" e as empresas encontradas. Se nenhuma campanha anterior tem agente, a prévia automática espera a campanha ter um, e a linha mostra "Prévia: escolha o agente na etapa 2".

<a id="l-prospeccao--escolher-as-empresas"></a>

### Escolher as empresas que serão abordadas

- **Objetivo:** Ler o Score, a auditoria do site e a prévia de cada empresa e deixar de fora quem não deve receber mensagem.
- **Papel mínimo:** Administrador
- **Busca no curso:** score da prospecção; auditoria do site; prévia da mensagem; desmarcar empresa; tirar empresa da lista; escolher quem abordar

1. **Leia cada empresa** — `/app/prospecting`  
   Com a busca concluída, a campanha fica em "Preparar campanha" e cada empresa aparece como "Encontrado". Na coluna "Auditoria", o "Score" soma três sinais: a nota no Google, o número de avaliações e a situação do site. Embaixo vem o resumo do site, como "Site com problemas", "Sem site próprio" ou "Site em ordem", e, por último, o começo da prévia: o rascunho da primeira mensagem que a IA preparou. No alto da tabela, o seletor "Ordenar" com a opção "Score" põe primeiro as empresas com mais pontos.
   > 💡 O Score foi pensado para quem vende site ou automação. Com a oferta "Site profissional", empresa sem site ou com site ruim ganha mais pontos do que empresa com o site em ordem. Se a sua oferta é outra, use o Score só como uma pista.
2. **A auditoria completa**  
   Clique em "Ver detalhes" para abrir a "Auditoria do site" da empresa: os problemas encontrados, o que o site já tem, o que falta e uma sugestão de estratégia de abordagem, pensada para quem vende site ou automação. "Reanalisar site" abre o site de novo na hora. "Prévia da abordagem" pede à IA uma prévia nova, que fica guardada no lugar da anterior e consome crédito de IA. Para fechar, aperte Esc ou clique fora da janela.
3. **Deixe de fora quem não abordar** — `/app/prospecting`  
   Na coluna "Abordar", todas as empresas vêm marcadas, e só as marcadas entram na fila quando você iniciar as abordagens. Para deixar uma de fora, desmarque a caixa dela. Aqui a clínica tira o "Castro Lima Advogados Associados", que tem só 6 avaliações.
4. **As empresas desmarcadas**  
   A empresa desmarcada sai da lista na hora, e o botão "Mostrar desmarcadas" passa a contar 2. Clique nele para ver quem ficou de fora; marcar a caixa de novo traz a empresa de volta. "Marcar todas" e "Desmarcar todas" mudam a lista inteira de uma vez. "Excluir desmarcadas" apaga essas empresas da campanha depois de pedir confirmação; numa busca futura, elas podem aparecer de novo.

<a id="l-prospeccao--preparar-e-iniciar"></a>

### Preparar a abordagem, iniciar e ajustar o ritmo

- **Objetivo:** Escolher o agente, a conexão e o funil da campanha, definir o ritmo e as regras da primeira mensagem, iniciar as abordagens e ajustar o ritmo de uma campanha pausada.
- **Papel mínimo:** Administrador
- **Busca no curso:** iniciar abordagens com ia; agente da prospecção; ritmo de envio da prospecção; pausar campanha de prospecção; retomar fila; legítimo interesse; opção de parar de receber

1. **Quem vai conversar** — `/app/prospecting`  
   Em "2. Preparar a abordagem" você escolhe o agente de IA que manda a primeira mensagem e atende as respostas. Há dois caminhos. "Configurar por conversa" abre um assistente que pergunta o que você oferece e o que quer descobrir, monta um agente novo e deixa você testá-lo em "Testar como cliente" antes de publicar. "Usar agente existente / configurar manualmente" usa um agente que você já publicou. A clínica vai usar a Bia, que já atende o WhatsApp.
   > 💡 Atenção: ao clicar em "Publicar e usar agente", o agente novo passa a poder atender as mensagens que chegam nesse número, não só as da prospecção.
2. **Agente, conexão e funil**  
   Em "Agente de IA", escolha o agente: a lista só mostra agentes publicados, em modo automático e sem pausa. Em "Conexão de saída", escolha o número que envia as mensagens. Só aparecem conexões ativas, e ele precisa ser um número conectado pelo QR Code: o número oficial da Meta ainda não serve para a Prospecção. Em "Funil", o funil em que as empresas entram. "Etapa inicial" é onde elas começam e "Etapa de qualificados" é a etapa que marca quem se qualificou na conversa. As duas etapas precisam ser diferentes.
3. **A oferta e quando qualificar**  
   Em "O que a IA deve oferecer e como iniciar", explique a oferta e o objetivo da primeira conversa; o texto se soma às instruções do agente nas conversas desta campanha. Em "Quando considerar o cliente qualificado", diga o que precisa ficar confirmado. "O que esta campanha vende" tem três opções fixas: site profissional, automação do atendimento e automações com N8N. Elas mudam o Score e a estratégia sugerida, e pelo menos uma fica marcada; como nenhuma é a oferta da clínica, ela deixa a que já vem.
4. **Ritmo e entrada no funil**  
   "Máximo em 24 horas" (de 1 a 50) e "Intervalo mínimo (minutos)" (de 5 a 1440) são o ritmo da campanha: no máximo tantas abordagens a cada 24 horas, com pelo menos tantos minutos entre uma e outra. Aqui a clínica usa 10 por dia, com 30 minutos de intervalo. Em "Quando a empresa entra no funil", a opção recomendada só cria o contato, o negócio e a conversa quando a empresa recebe a primeira mensagem; "Todas ao iniciar" cria tudo para a fila inteira assim que você inicia.
5. **A saída, a base legal e o início**  
   Em "Quando oferecer a opção de parar de receber", a recomendada já põe na primeira mensagem como parar de receber. A clínica escolhe "Atrasar para a 2ª mensagem": a primeira só cumprimenta e confirma se é a empresa certa, sem oferta, e a instrução para parar vai na seguinte. Em "Referência da avaliação de legítimo interesse", informe o documento real que justifica abordar essas empresas; ele não é o consentimento delas. Clique em "Iniciar abordagens com IA".
   > 💡 Antes de começar, o sistema confere o agente (publicado no número escolhido, com a ferramenta de mover negócios e acesso ao funil), a conexão e as etapas; se algo faltar, aparece o aviso e nada começa. Só uma campanha fica em andamento por vez, e a primeira abordagem é preparada depois de um minuto.
6. **Pausar e retomar** — `/app/prospecting`  
   Depois de iniciada, a campanha mostra o ritmo e os botões de controle. Enquanto envia ("Em andamento"), aparece "Pausar abordagens". Pausada, como esta, ela mostra "Editar ritmo" e "Retomar fila". Com a campanha pausada, você também pode marcar e desmarcar na tabela as empresas que ainda estão na fila. Clique em "Editar ritmo".
   > 💡 Uma mensagem que já estava saindo no momento da pausa ainda pode ser enviada.
7. **Ajustar o ritmo**  
   Mude "Máximo em 24 horas" e "Intervalo mínimo (minutos)" e clique em "Salvar ritmo". A campanha continua pausada, a linha "Ritmo" passa a mostrar os números novos e aparece "Ritmo atualizado. A campanha continua pausada.". O ritmo é a única parte da configuração que muda depois de iniciada. Para voltar a enviar, clique em "Retomar fila": o próximo envio já usa o ritmo novo.

---

<a id="m-funis"></a>

## Funis

**Tela:** `/app/kanban`  
**Resumo:** Onde você acompanha cada negócio da empresa num quadro: cada cliente é um cartão que anda pelas etapas, do primeiro contato até ganhar ou perder.

**Lições:** [Conhecendo a tela de Funis](#l-funis--conhecendo-os-funis) · [Lendo o quadro do funil](#l-funis--lendo-o-quadro) · [Achando o negócio certo](#l-funis--achando-um-negocio) · [Criando um negócio novo](#l-funis--novo-negocio) · [Andar com o negócio: mover, ganhar e perder](#l-funis--mover-e-fechar) · [A ficha do negócio](#l-funis--ficha-do-negocio) · [Criar, renomear e arquivar funis](#l-funis--organizar-funis)

<a id="l-funis--conhecendo-os-funis"></a>

### Conhecendo a tela de Funis

- **Objetivo:** Reconhecer a lista de funis, os botões do topo e abrir o quadro de um funil.
- **Papel mínimo:** Administrador
- **Busca no curso:** funis; funil de vendas; kanban; quadro de clientes; pipeline; onde ficam os negócios

1. **A lista de funis** — `/app/kanban`  
   Um funil é o caminho que um cliente percorre até fechar com você, dividido em etapas. Esta tela lista os funis da empresa. A Clínica Bem Viver tem um: "Pacientes". O selo "Padrão" marca o funil onde entra, sozinho, quem manda a primeira mensagem pelo WhatsApp da clínica (com o WhatsApp conectado).
2. **Os botões do topo**  
   "Novo funil" cria outro funil, por exemplo um só para pilates ou para odontologia. "Importar planilha" traz de uma vez uma lista de clientes que você já tem, num arquivo CSV: cada linha vira um cartão na primeira etapa do funil escolhido. Ao lado de cada funil ficam "Renomear" e "Arquivar"; você usa esses botões na última lição.
   > 💡 Só quem é gerente ou administrador vê "Novo funil", "Renomear" e "Arquivar". O atendente vê a lista e importa planilhas.
3. **A janela de importar planilha**  
   Escolha em "Funil de destino" para onde os clientes vão e clique em "Escolher o arquivo CSV". CSV é um formato de planilha: no Excel, use Arquivo › Salvar como › CSV; no Google Planilhas, Arquivo › Fazer download › CSV. "Baixar planilha modelo" baixa um exemplo com as colunas certas. No fim, a janela mostra quantos cartões foram criados, as colunas que ela não reconheceu e as linhas recusadas, com o motivo.
4. **Abrindo o quadro do funil**  
   Feche a janela e clique no nome do funil para abrir o quadro dele. É no quadro que você trabalha no dia a dia: ele mostra todos os clientes do funil, etapa por etapa.
   > 💡 O texto miúdo embaixo da lista lembra que, hoje, todo contato novo entra pelo funil padrão. Para mandar quem já é cliente para um funil separado, ligue "Clientes pela agenda" em Configurações › Tipos de agendamento. O link "Abrir Tipos de agendamento", ali mesmo, leva até lá.

<a id="l-funis--lendo-o-quadro"></a>

### Lendo o quadro do funil

- **Objetivo:** Entender as colunas, os números do topo de cada etapa e o que cada cartão mostra.
- **Papel mínimo:** Administrador
- **Busca no curso:** quadro; colunas do funil; etapas; cartão do cliente; valor do negócio; quanto tenho em cada etapa

1. **Cada coluna é uma etapa** — `/app/kanban`  
   O quadro tem uma coluna para cada etapa do funil, na ordem em que o cliente avança. Cada cartão é um negócio com um cliente. No topo da coluna aparecem o nome da etapa, quantos cartões ela tem e a soma do valor desses cartões.
   > 💡 Gerentes e administradores renomeiam uma etapa clicando no nome dela, no topo da coluna.
2. **O que o cartão mostra**  
   Em cima fica o título do negócio e, logo abaixo, o valor. A linha com o balão é a última mensagem da conversa com esse cliente: clicar nela abre a conversa na Inbox. O número verde no fim dessa linha conta as mensagens que ninguém leu ainda. Depois vêm o telefone do contato, quem é o responsável e há quanto tempo o cartão está nesta etapa ("3h" são três horas).
3. **Quem cuida de cada negócio**  
   O círculo com iniciais mostra o responsável. Círculo cheio é uma pessoa da equipe, como Ana Ribeiro. Círculo vazado, só com o contorno, é um agente de IA, como a Bia. O círculo tracejado com "Sem responsável", como no cartão da Mariana, avisa que ninguém está cuidando daquele negócio.
4. **Negócio esfriando**  
   Quando um negócio fica parado, sem conversa nem mudança, por mais tempo que o normal da etapa (sem ajuste, um dia), o cartão ganha uma faixa laranja do lado esquerdo e o aviso "Sem resposta há…" logo abaixo do valor. O rodapé deixa de mostrar o tempo na etapa. É o mesmo aviso da tela Radar. Se já existe um retorno agendado com o cliente, o cartão não ganha o aviso. Aqui, a avaliação do Sérgio está parada há quatro dias: é hora de procurar esse cliente.
5. **As etapas de ganho e de perda**  
   Role o quadro para o lado para ver as outras etapas. Neste funil, "Em tratamento", a terceira coluna, é a etapa de ganho: o cartão que chega nela conta como negócio fechado. "Cancelado", a última coluna, é a etapa de perda. As colunas que dizem "vazio" ainda não têm nenhum cartão. No topo das etapas de ganho e de perda aparece também o valor "ponderado": na de ganho ele é igual à soma, porque o negócio já fechou; na de perda é zero.
6. **Quadro ou calendário**  
   No alto, "Quadro" e "Calendário" trocam o jeito de ver o mesmo funil. O calendário espalha os cartões pelos dias de um campo de data que você cria no funil, como a data da avaliação (a data de fechamento previsto não entra). Este funil ainda não tem campo de data, então o calendário avisa isso. Os campos se criam em CRM › "Ver tudo em CRM" › "Etapas do funil".

<a id="l-funis--achando-um-negocio"></a>

### Achando o negócio certo

- **Objetivo:** Usar a busca e os filtros do quadro para ver só os cartões que interessam.
- **Papel mínimo:** Administrador
- **Busca no curso:** buscar cliente no funil; filtro; filtrar por responsável; negócios perdidos; atrasados; etiqueta

1. **A barra de filtros** — `/app/kanban`  
   Acima das colunas fica a barra de filtros. A caixa de busca procura no título e na descrição dos negócios. Os botões ao lado filtram por responsável, por situação ("Status") e por etiqueta ("Tag"). "Apenas atrasados" mostra só os negócios abertos com data de fechamento prevista que já passou.
2. **Buscando pelo nome**  
   Digite parte do título, por exemplo "pilates". O quadro passa a mostrar só os cartões que combinam com o que você digitou. O botão "Limpar filtros" aparece no fim da barra e desfaz tudo de uma vez.
3. **Filtrando por responsável**  
   Limpe a busca e abra "Responsável". "Sem responsável" mostra os negócios que ninguém pegou; "Eu" mostra os seus. Abaixo vêm as outras pessoas da equipe e os agentes de IA. Escolha "Ana Ribeiro" para ver só a carteira dela.
4. **Só a carteira da Ana**  
   Agora o quadro mostra só os negócios da Ana, e o botão passa a dizer "Responsável: Ana Ribeiro". O número no topo de cada coluna e a soma do valor também passam a contar só o que está visível.
5. **Vendo os negócios perdidos**  
   Em "Status", "Perdidos" mostra só os negócios que não fecharam; eles ficam na etapa de perda, "Cancelado", no fim do quadro. Com esse filtro ligado aparece o botão "Motivo", que separa as perdas pelo motivo escolhido na hora de perder, como "Preço". Ao lado pode aparecer "Categoria", que agrupa as perdas por quem causou: o cliente, a própria clínica ("Nós"), a concorrência ou a falta de resposta. É um jeito rápido de ver por que os clientes desistem.
6. **Negócios atrasados**  
   Marque "Apenas atrasados" para ver os negócios abertos cuja data de fechamento prevista já passou. Aqui aparece a avaliação do Sérgio, que ficou de confirmar a data e sumiu: é o cliente para procurar hoje.
   > 💡 Os filtros ficam guardados no endereço da página. Se você copiar o endereço e mandar para alguém da equipe, a pessoa abre o quadro já filtrado.

<a id="l-funis--novo-negocio"></a>

### Criando um negócio novo

- **Objetivo:** Pôr um cliente no funil à mão, ligado ao contato dele.
- **Papel mínimo:** Administrador
- **Busca no curso:** novo lead; criar negócio; adicionar cliente no funil; novo cartão; cadastrar oportunidade

1. **O botão "Novo Lead"** — `/app/kanban`  
   Quando um cliente chega por telefone ou no balcão, você mesmo cria o cartão dele. Clique em "Novo Lead", no alto do quadro. O sistema chama cada negócio de "lead".
2. **Escolha o contato**  
   Comece pelo contato: digite o nome ou o telefone e clique na pessoa certa. Se ela ainda não está cadastrada, "Criar contato" cadastra ali mesmo. Um negócio sem contato não recebe WhatsApp nem entra nas automações.
3. **Preencha o negócio**  
   Ao escolher o contato, o título vem com o nome dele; troque por algo que diga o que está sendo negociado. Em "Etapa" já vem a primeira etapa do funil. Preencha o "Valor" e, se quiser, a data de "Fechamento previsto" e etiquetas em "Tags", separadas por vírgula. Se quiser falar com o cliente logo depois, "Salvar e iniciar conversa" cria o negócio e abre a conversa com o contato.
4. **O cartão novo no quadro**  
   Clique em "Criar lead". O cartão aparece na etapa escolhida, com o valor, o telefone e a última conversa do contato. O quadro desce sozinho até o cartão novo; os outros continuam lá em cima. Como a Beatriz ainda não tem ninguém fixo cuidando dela, ele nasce "Sem responsável". Para escolher quem cuida, use o menu do cartão, que você conhece na próxima lição.
   > 💡 Se o contato já tem um negócio aberto neste funil, ao clicar em "Criar lead" a janela avisa e mostra o link para o que já existe. Aí você escolhe entre "Não criar" e "Criar mesmo assim".

<a id="l-funis--mover-e-fechar"></a>

### Andar com o negócio: mover, ganhar e perder

- **Objetivo:** Mudar o cartão de etapa, trocar o responsável e fechar o negócio como ganho ou perdido, um por um ou vários de uma vez.
- **Papel mínimo:** Administrador
- **Busca no curso:** mover cartão de etapa; arrastar; marcar como ganho; marcar como perdido; motivo da perda; trocar responsável; selecionar vários

1. **Arrastar muda a etapa** — `/app/kanban`  
   Para mudar um negócio de etapa, segure o cartão e arraste até a coluna nova. Para os outros comandos, passe o mouse no cartão: aparecem os três pontinhos no canto de cima. Clique neles para abrir o menu do cartão.
2. **O menu do cartão**  
   "Editar" muda título, valor, descrição e data prevista. "Responsável" passa o negócio para outra pessoa ou para um agente de IA. "Marcar como ganho" e "Marcar como perdido" fecham o negócio. "Levar para outro funil" recria o negócio em outro funil e fecha este como perdido; com um funil só, a janela avisa que não há para onde levar. "Excluir" apaga o cartão, mas o contato e as conversas continuam.
3. **Perder com motivo**  
   "Marcar como perdido" sempre pede o motivo. Escolha o que aconteceu, aqui "Sem resposta do cliente", e clique em "Confirmar". O cartão vai para a etapa de perda do funil. Os motivos ficam guardados e depois aparecem no filtro "Motivo".
   > 💡 A lista que vem pronta traz motivos de loja, como "Produto indisponível". Para usar motivos com as palavras da sua clínica, cadastre a lista na tela "Etapas do funil".
4. **Ganhar o negócio**  
   Quando o cliente fecha, abra o menu do cartão (aqui, o da Juliana) e clique em "Marcar como ganho". O cartão vai para a etapa de ganho do funil, aqui "Em tratamento", e conta como negócio fechado. Sem ajuste no funil, se depois ele voltar para uma etapa aberta, o negócio é reaberto.
5. **O cartão foi para a etapa de ganho**  
   O cartão da Juliana saiu de "Consulta agendada" e agora está em "Em tratamento", a etapa de ganho. O da avaliação do Roberto, que você marcou como perdido, foi para "Cancelado", no fim do quadro.
6. **Selecionar vários cartões**  
   Para mexer em vários negócios de uma vez, passe o mouse no cartão e marque a caixinha ao lado do título. Para marcar a etapa inteira, use a caixinha que aparece no topo da coluna. Segurar Ctrl (Cmd no Mac) e clicar no cartão também marca.
7. **A barra de ações em grupo**  
   Com cartões marcados, aparece uma barra embaixo. "Mover para…" muda todos de etapa, "Responsável…" passa todos para alguém, "Tag…" põe uma etiqueta, "Marcar como perdido…" fecha todos com um motivo e "Excluir" apaga. "Cancelar", ou a tecla Esc, desmarca tudo.
   > 💡 "Responsável…" só aparece para gerentes e administradores.

<a id="l-funis--ficha-do-negocio"></a>

### A ficha do negócio

- **Objetivo:** Abrir um cartão e usar a ficha: conversa, contato, dados do negócio, tarefas e histórico.
- **Papel mínimo:** Administrador
- **Busca no curso:** abrir cartão; detalhes do negócio; ficha do lead; histórico do negócio; editar valor; tarefas do cliente

1. **Clique no cartão** — `/app/kanban`  
   Clique no título do cartão para abrir a ficha do negócio, que desliza pela direita. Vamos abrir a avaliação do Roberto.
2. **O topo da ficha**  
   No topo ficam o título, o valor, a etapa e o responsável. Logo abaixo, "Abrir conversa no Inbox" leva direto para a conversa com esse cliente, com a última mensagem à mostra. "Editar campos" pula para os dados do negócio.
3. **Os dados do contato**  
   A parte "Contato" mostra telefone e e-mail de quem está negociando; a aba "Links" guarda Instagram, site e outros endereços. "Abrir no WhatsApp" abre o WhatsApp do seu computador ou celular, fora do sistema: para a conversa ficar guardada aqui, prefira "Abrir conversa no Inbox". "Ver ficha completa do contato" leva para a tela do contato. Em "Pessoas relacionadas", "Adicionar participante" liga outras pessoas ao negócio, como quem paga.
4. **Editar os dados do negócio**  
   Em "Dados do negócio" você corrige título, descrição, valor, data de fechamento prevista e etiquetas. Troque o valor e clique em "Salvar". A ficha continua aberta, para você ver a mudança entrar no histórico.
5. **Tarefas e histórico**  
   Em "Tarefas", "Nova tarefa" anota o próximo passo combinado com o cliente, com prazo e responsável. A "Linha do tempo", no fim da ficha, registra tudo o que aconteceu com o negócio: aqui já aparece "Dados do negócio alterados", avisando que o valor mudou agora há pouco.

<a id="l-funis--organizar-funis"></a>

### Criar, renomear e arquivar funis

- **Objetivo:** Criar um funil novo, mudar o nome dele, arquivar e excluir um funil que não serve mais.
- **Papel mínimo:** Administrador
- **Busca no curso:** criar funil; novo funil; renomear funil; arquivar funil; excluir funil; funis arquivados

1. **Dê um nome ao funil** — `/app/kanban`  
   Clique em "Novo funil" e escreva o nome, por exemplo "Pilates". Depois clique em "Criar funil". O funil novo já nasce com quatro etapas: "Novo", "Em andamento", "Ganho" e "Perdido". Você troca os nomes delas na tela "Etapas do funil".
2. **O funil novo na lista**  
   O funil aparece no fim da lista. As setinhas à esquerda mudam a ordem dos funis. "Tornar padrão" faz quem escreve pela primeira vez no WhatsApp da clínica entrar por este funil, no lugar do atual; só use quando quiser mesmo trocar.
3. **Renomear**  
   Clique em "Renomear" na linha do funil, mude o nome e aperte Enter (ou clique em "Salvar"). O nome muda na lista e no quadro.
4. **Arquivar**  
   "Arquivar" tira o funil da lista e ele para de receber negócios novos, mas nada é apagado. A pergunta aparece logo abaixo do funil. "Excluir de vez" só funciona em funil que não tem nenhum negócio, nem aberto nem encerrado; se tiver, o sistema recusa e explica por quê.
   > 💡 Não dá para arquivar o funil padrão, nem um funil que é o único da lista. Para arquivar o padrão, antes torne outro funil padrão.
5. **A gaveta dos arquivados**  
   O funil arquivado vai para "Funis arquivados", embaixo da lista. Clique para abrir a gaveta. "Tirar do arquivo" traz o funil de volta para a lista; "Excluir de vez" apaga e libera o nome.
6. **Excluir de vez**  
   Antes de apagar, o sistema pergunta de novo, porque não tem volta: o funil e as etapas dele somem. Clique em "Excluir de vez" para confirmar, ou "Cancelar" para desistir.
7. **De volta ao começo**  
   Pronto: o funil de teste sumiu e a lista voltou a ter só "Pacientes". Quando não sobra nenhum funil arquivado, a gaveta "Funis arquivados" também some.

---

<a id="m-campanhas"></a>

## Campanhas

**Tela:** `/app/campaigns`  
**Resumo:** Mande uma mensagem de WhatsApp para uma lista de contatos que você escolhe, no ritmo do número, e acompanhe quem recebeu e quem respondeu.

**Lições:** [Conhecendo a tela de Campanhas](#l-campanhas--campanhas-conhecendo-a-tela) · [Criar uma campanha](#l-campanhas--campanhas-criar) · [Preparar a lista e iniciar o envio](#l-campanhas--campanhas-preparar-e-iniciar) · [Acompanhar, pausar e repetir uma campanha](#l-campanhas--campanhas-acompanhar)

<a id="l-campanhas--campanhas-conhecendo-a-tela"></a>

### Conhecendo a tela de Campanhas

- **Objetivo:** Achar a tela, entender o que é uma campanha e ler a lista: em que situação cada uma está e para quantas pessoas ela fala.
- **Papel mínimo:** Administrador
- **Busca no curso:** campanhas; mandar mensagem para vários; disparo em massa; lista de transmissão; mensagem para todos os pacientes; whatsapp em massa; onde ficam as campanhas

1. **Onde fica a tela** — `/app/crm`  
   Campanhas não aparece direto no menu lateral. No grupo "CRM" do menu, clique em "Ver tudo em CRM". Na parte "O dia a dia da venda" está o cartão "Campanhas". O caminho completo é: CRM › Ver tudo em CRM › Campanhas.
   > 💡 Só gerente ou administrador consegue usar as campanhas. Se o cartão não aparecer, a empresa pode estar usando o "Perfil de interface" "Simplificada", que mostra menos áreas: quem administra muda isso em Configurações › Organização.
2. **O que é uma campanha** — `/app/campaigns`  
   Uma campanha manda a mesma mensagem de WhatsApp para uma lista de contatos que você escolhe, como "os pacientes do pilates". Num número conectado pelo QR Code, as mensagens saem aos poucos, no máximo uma por minuto: é isso que protege o número de ser bloqueado pelo WhatsApp. Cada linha é uma campanha. Embaixo do nome aparece para quantos contatos ela fala e quantos ficaram de fora. À direita vem uma data, que muda com a situação: quando a campanha foi criada, quando começou ou quando terminou.
3. **A situação de cada campanha**  
   O selo à direita diz em que pé a campanha está. "Rascunho": foi criada, mas a lista de quem recebe ainda não foi montada. Depois que você prepara a lista, ela fica "Pronta para iniciar". "Enviando": as mensagens estão saindo. "Pausada": o envio parou e espera alguém retomar. "Concluída": a campanha terminou de enviar. "Cancelada": alguém desistiu dela, e quem ainda não tinha recebido não recebe mais.
4. **Filtrar pela situação**  
   Quando a lista crescer, use o seletor "Situação" para ver só as campanhas de um tipo. Aqui escolhemos "Concluída": sobram só as campanhas que já terminaram. Para ver todas de novo, escolha "Todas".
5. **Os botões do alto**  
   "Nova campanha" abre o formulário para montar uma campanha; a lição "Criar uma campanha" mostra o passo a passo. "Configuração" guarda o que vale para todas as campanhas da empresa: até quando uma resposta conta para a campanha e a lista de números que nenhuma campanha alcança.
6. **Até quando uma resposta conta**  
   A tela "Configuração de campanhas" começa por "Padrões desta organização". O campo "Contar como resposta até (horas depois do envio)" diz por quanto tempo uma mensagem do contato conta como resposta à campanha. Ele vem com 72 horas, ou seja, três dias. O que chega depois disso é tratado como conversa nova. A mudança vale para as respostas que chegarem dali em diante, inclusive de campanhas que já foram enviadas. Para gravar, clique em "Salvar padrões".
   > 💡 Os campos de ritmo desta parte ficam guardados, mas por enquanto a tela "Nova campanha" não os preenche sozinha: ajuste o ritmo em cada campanha, na parte "Ritmo desta campanha".
7. **Números que nenhuma campanha alcança**  
   No fim da tela fica a "Lista de exclusão": os números que nenhuma campanha alcança, como o de um laboratório parceiro ou o de um paciente que prefere ser avisado por ligação. Digite o número em "Telefone com DDI e DDD" (o 55 do Brasil, depois o DDD), escreva o motivo se quiser e clique em "Excluir das campanhas". Isso não bloqueia a pessoa: se ela escrever, o atendimento responde normalmente. A lista mostra só os quatro últimos dígitos de cada número. Para devolver um número às campanhas, clique em "Tirar da lista" na linha dele.
   > 💡 Mais acima, "Textos salvos" guarda com um nome as mensagens que a equipe costuma usar. Por enquanto, a tela "Nova campanha" não oferece escolher um texto salvo.

<a id="l-campanhas--campanhas-criar"></a>

### Criar uma campanha

- **Objetivo:** Montar uma campanha do começo, com nome, número, público, mensagem e ritmo, e salvar como rascunho sem enviar nada.
- **Papel mínimo:** Administrador
- **Busca no curso:** criar campanha; nova campanha; mensagem para um grupo de pacientes; escolher quem recebe; campanha por etiqueta; mensagem com o nome do paciente; quantas pessoas vão receber

1. **Começar uma campanha** — `/app/campaigns`  
   Clique em "Nova campanha", no canto de cima, à direita. Nada é enviado nesta etapa: o formulário só cria um rascunho, que você ainda vai conferir antes de qualquer mensagem sair.
2. **Nome, número e base legal**  
   Em "Nome da campanha", escreva um nome que ajude a equipe a reconhecê-la; o paciente não vê esse nome. Em "Enviar pelo número", escolha o WhatsApp da clínica que vai mandar as mensagens: a lista traz os números cadastrados em Conexões. Em "Base legal do envio", diga por que a clínica pode escrever para essas pessoas, como pede a LGPD, a lei de proteção de dados. "Consentimento" serve quando elas pediram para receber. "Interesse legítimo" serve quando a clínica tem uma avaliação por escrito que justifica o contato; nesse caso a tela pede a referência dessa avaliação.
   > 💡 Se você escolher o número oficial do WhatsApp (o da Meta), a parte "Mensagem" muda: em vez de escrever o texto, você escolhe um modelo já aprovado pela Meta. A lição mostra o número conectado pelo QR Code.
3. **Quem vai receber**  
   Em "Público" você escolhe quem entra na campanha, com pelo menos um critério. Aqui usamos "Com alguma destas etiquetas" e escrevemos convenio: entram os contatos que têm essa etiqueta. Escreva a etiqueta igual ao cadastro e separe várias por vírgula. Também dá para deixar de fora quem tem uma etiqueta ("Sem nenhuma destas etiquetas"), pegar quem não fala com a clínica há alguns dias ("Sem falar com a gente há (dias)") ou quem tem negócio num funil ("Com negócio no funil"). O campo "Máximo de contatos nesta campanha" já vem com 100.
4. **Quantas pessoas a campanha pega**  
   Clique em "Ver quantas pessoas" para contar antes de salvar. A conta mostra quantos podem receber e quantos ficam de fora, com o motivo de cada grupo. Aqui, 1 pode receber e 1 fica de fora por "Já está em outra campanha ainda não concluída": a Fernanda já está na lista de uma campanha que ainda está enviando, e ninguém entra em duas campanhas ao mesmo tempo. Outros motivos comuns são o contato sem telefone, quem pediu para não receber mensagens e os números da lista de exclusão.
5. **A mensagem**  
   Em "Mensagem", escreva como se falasse com uma pessoa só. Os botões logo abaixo põem, no fim do texto, um campo que muda para cada contato: {{nome}} é o nome do cadastro, {{primeiro_nome}} é só o primeiro nome e {{saudacao}} vira "Bom dia", "Boa tarde" ou "Boa noite", conforme a hora do envio. Quem não tiver o dado que a mensagem usa fica de fora da lista, com o motivo anotado. Para não perder ninguém por falta de dado, ponha um texto de reserva entre aspas: {{primeiro_nome\|"paciente"}} usa "paciente" quando o cadastro não tem o nome.
6. **Quem atende e o ritmo**  
   Em "Quem responder" dá para escolher em que funil nasce o negócio de quem responder a esta campanha e qual agente de IA atende essa resposta. Em branco, vale o de sempre: o negócio nasce no funil do número e quem atende é o agente publicado nele. Em "Ritmo desta campanha", deixe em branco para usar o ritmo do número, que fica em Conexões › Proteção de envio. O que você puser aqui só pode deixar a campanha mais devagar. Com tudo pronto, clique em "Salvar rascunho".
7. **O rascunho está salvo**  
   Ao salvar, a tela abre a campanha nova com o selo "Rascunho". Nenhuma mensagem saiu. Enquanto for rascunho, "Editar" muda o que você escreveu. O próximo passo é "Preparar lista", que monta a lista de quem vai receber: é a lição "Preparar a lista e iniciar o envio".

<a id="l-campanhas--campanhas-preparar-e-iniciar"></a>

### Preparar a lista e iniciar o envio

- **Objetivo:** Transformar um rascunho em lista de verdade, conferir quem ficou de fora e por quê, mandar um teste e só então começar o envio.
- **Papel mínimo:** Administrador
- **Busca no curso:** preparar lista; iniciar campanha; começar o envio; enviar teste; quem ficou de fora; por que não recebeu; disparar campanha

1. **Abrir o rascunho** — `/app/campaigns`  
   Na lista, clique na campanha em "Rascunho" que você quer enviar. Aqui é o "Convite para a avaliação odontológica", que a clínica montou para os contatos sem a etiqueta convenio.
2. **O rascunho por dentro**  
   No alto ficam o nome, o selo da situação e só os botões que fazem sentido agora. Num rascunho são "Editar", "Preparar lista", "Cancelar campanha" e "Duplicar". Os números "Na lista", "Enviadas", "Entregues" e "Responderam" ainda estão zerados, porque a lista de quem recebe ainda não existe. Ela só é montada quando você clica em "Preparar lista".
3. **A lista pronta**  
   Ao clicar em "Preparar lista", o sistema procura os contatos do público e confere, um por um, quem pode receber. A campanha passa a "Pronta para iniciar", e "Na lista" mostra quantos vão receber: aqui, 3. Nenhuma mensagem saiu ainda. Os botões também mudaram: agora aparecem "Enviar teste" e "Iniciar envio".
4. **Quem ficou de fora, e por quê**  
   Em "Quem está na lista" aparece cada contato do público. "Na fila" quer dizer que a pessoa vai receber. Nos outros aparece o motivo de ter ficado de fora, como "Sem telefone no cadastro", "Pediu para não receber mensagens", "Está na lista de exclusão de campanhas" ou "Já está em outra campanha ainda não concluída". Para ver só quem ficou de fora, escolha "Fora da lista" no seletor ao lado do título.
   > 💡 Depois de preparada, a campanha não volta a ser editada pela tela. Se a lista ou a mensagem estiverem erradas, clique em "Cancelar campanha", confirme e depois clique em "Duplicar": a cópia nasce como rascunho, pronta para corrigir.
5. **Mandar um teste antes**  
   Antes de começar, mande um teste para ver como a mensagem chega. Clique em "Enviar teste" e busque quem vai receber, de preferência você mesmo, cadastrado como contato. O teste sai pelo mesmo número e com o mesmo texto do envio de verdade, e não entra nos números da campanha. Atenção: "Enviar para este" manda a mensagem na hora, sem pedir confirmação. Por isso, não escolha um paciente.
6. **Começar o envio**  
   Quando estiver tudo certo, clique em "Iniciar envio". A tela pergunta antes quantas pessoas vão receber e avisa que o envio segue o ritmo do número e pode levar horas. Só ao clicar em "Confirmar" as mensagens começam a sair, e a campanha passa a "Enviando". "Voltar" desiste sem enviar nada.

<a id="l-campanhas--campanhas-acompanhar"></a>

### Acompanhar, pausar e repetir uma campanha

- **Objetivo:** Ler os números de uma campanha em andamento, ver quem respondeu, ajustar o ritmo, pausar e mandar de novo com "Duplicar".
- **Papel mínimo:** Administrador
- **Busca no curso:** acompanhar campanha; quem respondeu; pausar campanha; parar o envio; resultado da campanha; repetir campanha; duplicar campanha; mensagens entregues

1. **Abrir a campanha que está enviando** — `/app/campaigns`  
   Clique na campanha com o selo "Enviando". Aqui é a "Avaliação nutricional de outubro", que começou a sair há algumas horas.
2. **Os números da campanha**  
   Os quatro quadros resumem o envio. "Na lista": quantos vão receber. "Enviadas": quantas já saíram. "Entregues": quantas chegaram ao celular da pessoa. "Responderam": quantos responderam dentro do prazo definido em "Configuração" (72 horas, se ninguém mudou). Em "Progresso", a barra mostra quanto da lista já foi feito; embaixo aparecem quantas mensagens ainda não foram enviadas, quantas falharam e quantos pediram para parar. Enquanto a campanha está enviando, os números se atualizam sozinhos a cada 10 segundos.
3. **Quem respondeu**  
   Em "Quem está na lista", cada pessoa aparece com a situação dela: "Na fila" (ainda vai receber), "Enviada", "Entregue", "Lida", "Respondeu" ou o motivo de ter ficado de fora. O seletor ao lado do título filtra a lista. Aqui escolhemos "Responderam" e sobrou o Pedro. A resposta dele chega na Inbox, como qualquer mensagem.
4. **Deixar o envio mais devagar**  
   Em "Ritmo desta campanha" dá para deixar o envio mais devagar mesmo com ele em andamento. Esta campanha espera pelo menos 120 segundos entre uma mensagem e outra, manda no máximo 40 por dia e só envia das 8h às 19h. Campo em branco usa o ritmo do número. Depois de mudar, clique em "Salvar ritmo".
5. **Pausar e retomar**  
   Para parar o envio por um tempo, clique em "Pausar", no alto. A campanha fica "Pausada" e ninguém mais recebe até alguém clicar em "Retomar". Uma mensagem que já estava saindo na hora da pausa ainda pode chegar. Para desistir de vez, use "Cancelar campanha": a tela pede confirmação, e depois quem ainda não recebeu não recebe mais e a campanha não volta a rodar. A campanha também pode ficar "Pausada" sozinha, quando o envio inteiro falha. Nesse caso aparece "Último problema" embaixo do nome, dizendo o que houve: corrija a causa e clique em "Retomar".
6. **Mandar de novo com Duplicar** — `/app/campaigns`  
   Uma campanha "Concluída" não envia de novo. Para repetir a ideia, abra a campanha e clique em "Duplicar". A cópia nasce como "Rascunho", com a mesma mensagem, o mesmo público e o mesmo ritmo, mas sem a lista e sem os números da campanha antiga. O que estava em "Quem responder" (funil e agente) e os números extras não vêm junto: abra "Editar" e escolha de novo.
7. **A cópia na lista**  
   Depois de clicar em "Duplicar", a tela continua na campanha antiga, sem aviso. A cópia aparece na lista de Campanhas, com "(cópia)" no fim do nome e o selo "Rascunho". Abra a cópia, use "Editar" para trocar o nome e revisar a mensagem, e siga a lição "Preparar a lista e iniciar o envio".

---

<a id="m-contatos"></a>

## Contatos

**Tela:** `/app/contacts`  
**Resumo:** A lista de todos os clientes da empresa: achar, cadastrar, corrigir, juntar repetidos e trazer contatos de planilha ou do celular.

**Lições:** [Conhecendo a lista de contatos](#l-contatos--conhecendo-a-lista) · [Achando um contato](#l-contatos--achando-um-contato) · [Cadastrando um contato](#l-contatos--cadastrando-um-contato) · [Editando e excluindo pela lista](#l-contatos--editar-e-excluir) · [A ficha do contato](#l-contatos--a-ficha-do-contato) · [Mexendo em vários contatos de uma vez](#l-contatos--varios-de-uma-vez) · [Repetidos, planilhas e agenda do celular](#l-contatos--trazer-e-levar)

<a id="l-contatos--conhecendo-a-lista"></a>

### Conhecendo a lista de contatos

- **Objetivo:** Reconhecer as partes da tela de Contatos e ler o que cada linha da lista conta sobre o cliente.
- **Papel mínimo:** Administrador
- **Busca no curso:** contatos; lista de clientes; cadastro de clientes; pacientes; telefone do cliente; status do contato; bloqueado; última atividade

1. **As três partes da tela** — `/app/contacts`  
   Em Contatos ficam todas as pessoas que a sua empresa atende, mesmo as que ainda não mandaram mensagem. No alto ficam os botões para cadastrar, juntar repetidos, trazer e levar contatos. Logo abaixo fica a barra de busca e filtros. Embaixo fica a lista, com um cliente por linha.
   > 💡 Quem escreve para o número de WhatsApp conectado em "Conexões" entra aqui sozinho. Você só cadastra à mão quem ainda não falou com a empresa.
2. **O que cada coluna mostra**  
   Cada linha mostra o nome, o e-mail, o telefone e as etiquetas do cliente (aqui chamadas de "Tags"). "Última atividade" diz quando houve o último movimento com ele, como uma mensagem: hoje e ontem aparecem com a hora, os dias mais antigos com a data. A coluna "Status" usa selos: "Ativo" é o cliente normal e "Bloqueado" é quem pediu para não receber mais mensagens.
   > 💡 Outros selos que podem aparecer: "Anonimizado" (dados apagados a pedido do cliente, pela LGPD), "Cliente" (quando a empresa usa a regra de clientes pela agenda) e "Pessoal" (contato da vida pessoal, que só aparece com o filtro "Pessoais" ligado).
3. **Os atalhos no fim da linha**  
   No fim de cada linha ficam até três atalhos. O balão abre a conversa desse cliente na Inbox. Quando o cliente tem telefone mas nunca conversou, o balão começa uma conversa nova na Inbox, para você escrever primeiro. Isso precisa de um número de WhatsApp conectado em "Conexões". Sem telefone e sem conversa, o balão não aparece. O lápis edita o cadastro sem sair da lista, e a lixeira exclui o contato. Clicar no nome abre a ficha completa do cliente.
4. **Quantos contatos há**  
   No pé da lista aparece quantos contatos estão na tela. A lista mostra 25 de cada vez. Quando há mais, aparece "carregados — há mais resultados" e o botão "Carregar mais", que traz os próximos.
   > 💡 Você pode mostrar 25, 50 ou 100 de cada vez no botão "25 por página", na barra de filtros.

<a id="l-contatos--achando-um-contato"></a>

### Achando um contato

- **Objetivo:** Encontrar um cliente pela busca e pelos filtros de etiqueta, origem e pessoais, e colocar a lista na ordem que você quiser.
- **Papel mínimo:** Administrador
- **Busca no curso:** buscar contato; procurar cliente; pesquisar telefone; filtro; etiqueta; tag; origem do contato; pessoais; ordenar por nome; limpar filtros

1. **Buscar pelo nome** — `/app/contacts`  
   Digite parte do nome, do e-mail ou do telefone na busca. Aqui digitamos "Fern" e a lista já mostra a Fernanda Oliveira. A lista filtra logo depois que você para de digitar.
   > 💡 Digite pelo menos 2 letras. Não precisa acertar o acento: "Joao" também acha "João".
2. **Filtrar por etiqueta**  
   Clique em "Limpar filtros" para apagar a busca. Depois clique no botão "Tag: todas" e marque uma etiqueta, como "convenio", para ver só os clientes marcados com ela. O menu fica aberto enquanto você marca.
   > 💡 As etiquetas do menu são as dos contatos que já estão na lista.
3. **Duas etiquetas: todas ou qualquer uma**  
   Marcamos "convenio" e "retorno". Com duas ou mais etiquetas marcadas, aparecem duas opções: "Todas (E)" mostra só quem tem todas as etiquetas, e "Qualquer uma (OU)" mostra quem tem pelo menos uma.
   > 💡 Depois que você marca uma etiqueta, o menu passa a mostrar só as etiquetas dos contatos que sobraram na lista.
4. **O resultado do filtro**  
   Fechamos o menu. O botão agora diz "Tag: convenio +1": a primeira etiqueta escolhida e quantas mais. Com "Todas (E)", só a Fernanda Oliveira tem as duas etiquetas.
5. **Filtrar pela origem**  
   O botão "Todas as origens" mostra de onde o contato veio: cadastro à mão ("Manual"), WhatsApp, site, planilha ("Importado (CSV)"), agenda do celular ou anúncio. Aqui escolhemos "Importado (CSV)" e a lista mostra só quem entrou por planilha.
6. **Os contatos pessoais**  
   Contatos marcados como pessoais, como um parente, ficam fora da lista normal. Ligue o botão "Pessoais" para ver só eles. Ligado, ele fica colorido.
   > 💡 Para tirar a marca de pessoal, abra a ficha do contato e clique em "Desmarcar pessoal". Só gerentes e administradores veem esse botão.
7. **Quem está parado há mais tempo**  
   A lista começa pelos contatos com movimento mais recente. Os títulos de coluna com setinhas mudam a ordem: clicando de novo no mesmo título, a ordem inverte. Aqui desligamos "Pessoais" e clicamos em "Última atividade": agora quem está há mais tempo sem movimento aparece primeiro, bom para lembrar de chamar de volta.
   > 💡 Contatos sem nenhuma atividade ficam sempre no fim, em qualquer ordem.

<a id="l-contatos--cadastrando-um-contato"></a>

### Cadastrando um contato

- **Objetivo:** Cadastrar à mão um cliente que ainda não falou com a empresa.
- **Papel mínimo:** Administrador
- **Busca no curso:** novo contato; cadastrar cliente; adicionar paciente; criar contato; incluir telefone; cadastro manual

1. **O botão Novo contato** — `/app/contacts`  
   Para cadastrar alguém que ainda não escreveu para a empresa, clique em "Novo contato", no canto de cima.
2. **Preencher o cadastro**  
   Preencha o nome e pelo menos o e-mail ou o telefone. O telefone vai com DDD; não precisa digitar o +55. Em "Tags", escolha as etiquetas sugeridas ou digite uma por vez e aperte Enter. Se abrir a escolha de cor, confira e clique em "Adicionar tag" para confirmar. O CPF é opcional. Para cadastrar e já falar com a pessoa, use "Salvar e iniciar conversa": o contato é salvo e a conversa com ele abre em seguida.
   > 💡 Se o telefone, o e-mail ou o CPF já pertencer a outro contato, o cadastro é recusado com um aviso.
3. **O contato na lista**  
   Clicamos em "Criar contato". A janela fecha e o contato entra na lista, com as etiquetas que você digitou. Ele fica registrado com a origem "Manual", e dá para achá-lo no filtro de origem. Aqui buscamos "Carolina" para encontrá-la.

<a id="l-contatos--editar-e-excluir"></a>

### Editando e excluindo pela lista

- **Objetivo:** Corrigir o cadastro de um cliente e saber o que acontece ao excluir, sem sair da lista.
- **Papel mínimo:** Administrador
- **Busca no curso:** editar contato; corrigir telefone; mudar nome do cliente; data de nascimento; adicionar etiqueta; excluir contato; apagar cliente

1. **O lápis da linha** — `/app/contacts`  
   O lápis no fim da linha abre o cadastro para editar, sem sair da lista. Vamos completar o cadastro da Gabriela Duarte.
2. **Mudar os dados**  
   Na janela "Editar contato" você muda nome, e-mail, telefone e data de nascimento. Para pôr uma etiqueta, digite no campo de baixo e aperte Enter, ou clique numa sugestão. Se abrir a escolha de cor, confirme em "Adicionar tag". Para tirar uma etiqueta, clique no X dela. Aqui pusemos a etiqueta "nutricao". No fim, clique em "Salvar".
3. **O cadastro atualizado**  
   Clicamos em "Salvar". A janela fecha e a linha já mostra a etiqueta nova.
4. **Excluir pede confirmação**  
   A lixeira pergunta antes de apagar. Excluir apaga o contato, as conversas e as mensagens dele, e não tem como desfazer. Os negócios dele no funil continuam, mas ficam sem cliente. Se o cliente tem ou já teve compromisso na Agenda, mesmo cancelado, a janela avisa e a exclusão não acontece. Aqui clicamos em "Cancelar".

<a id="l-contatos--a-ficha-do-contato"></a>

### A ficha do contato

- **Objetivo:** Abrir a ficha de um cliente, achar a conversa e os dados dele, escolher o vendedor dono e ver o histórico.
- **Papel mínimo:** Administrador
- **Busca no curso:** ficha do cliente; detalhes do contato; histórico do cliente; timeline; carteira; vendedor dono; marcar como pessoal; sempre humano; LGPD; anonimizar

1. **Abrir a ficha** — `/app/contacts`  
   Clique no nome de um cliente na lista para abrir a ficha completa dele. Vamos abrir a da Fernanda Oliveira.
2. **O topo da ficha**  
   No topo ficam o nome, o e-mail, o telefone e as etiquetas. "Marcar como pessoal" tira o contato do atendimento: as conversas fecham e param a IA, as mensagens automáticas de retomada, as campanhas e os envios. "Marcar como sempre humano" faz a IA parar de responder este cliente até alguém clicar em "Remover marca de humano". Os dois pedem confirmação antes. "Editar" abre a janela de edição, com os campos personalizados a mais.
   > 💡 Só gerentes e administradores veem os dois botões de marcar.
3. **A conversa e os dados**  
   Se o cliente já conversou com a empresa, logo abaixo aparece a última mensagem. Clique ali para abrir a conversa na Inbox. A aba "Visão geral" mostra os dados do cadastro: nome, nome no WhatsApp, e-mail, telefone, data de nascimento, origem, última atividade, data do cadastro e etiquetas.
4. **O vendedor dono**  
   O quadro "Carteira" diz qual pessoa da equipe é dona deste cliente. Com um dono, os negócios novos do cliente já nascem no nome dessa pessoa. Se o cliente escrever numa conversa que está com outra pessoa, o dono recebe uma tarefa avisando. Escolha o nome na lista e clique em "Salvar carteira". Sem dono, o atendimento segue como sempre.
   > 💡 Só gerentes e administradores escolhem o dono.
5. **O histórico do cliente**  
   A aba "Timeline" conta o que aconteceu com este cliente, do mais novo para o mais antigo, separado por dia. Entram aqui os movimentos dos negócios dele, como a entrada no funil ("Entrou no funil") e a troca de etapa ("Mudou de estágio"), e as anotações da equipe. Ao lado de cada linha aparece quem fez.
6. **Apagar os dados a pedido do cliente**  
   A aba "LGPD" serve para quando o cliente pede que a empresa apague os dados dele. "Anonimizar contato" troca o nome por "Cliente Anonimizado" seguido de um número e apaga e-mail, telefone e documento. Antes, a janela pede o motivo e que você digite ANONIMIZAR. Não tem como desfazer: use só com o pedido formal do cliente ou ordem judicial.
   > 💡 Só administradores veem a aba LGPD.

<a id="l-contatos--varios-de-uma-vez"></a>

### Mexendo em vários contatos de uma vez

- **Objetivo:** Marcar vários contatos e pôr uma etiqueta em todos com um clique só.
- **Papel mínimo:** Administrador
- **Busca no curso:** vários contatos; em massa; selecionar todos; etiqueta em lote; mudar responsável; marcar contatos; ação em lote

1. **Marcar os contatos** — `/app/contacts`  
   A caixinha no começo de cada linha marca o contato. Marcamos a Mariana Souza e a Gabriela Duarte. Assim que um contato é marcado, aparece uma barra acima da lista dizendo quantos estão marcados.
   > 💡 A caixinha do título da lista marca de uma vez todos os contatos que estão na tela. Para desmarcar todos, use o X no fim da barra.
2. **O que dá para fazer**  
   Clique em "Mais ações". Dá para adicionar ou remover uma etiqueta, mudar o vendedor dono de todos ("Mudar responsável") e preencher um campo personalizado. O X no fim da barra desmarca todos.
   > 💡 "Mudar responsável" só aparece para gerentes e administradores.
3. **Escolher a etiqueta**  
   Em "Adicionar etiqueta", digite a etiqueta e clique em "Adicionar". Aqui digitamos "nutricao". Ela entra em todos os contatos marcados, e a etiqueta que eles já tinham continua.
4. **Pronto para todos**  
   Clicamos em "Adicionar". A etiqueta "nutricao" já aparece nas duas linhas, e a marcação some sozinha.

<a id="l-contatos--trazer-e-levar"></a>

### Repetidos, planilhas e agenda do celular

- **Objetivo:** Juntar contatos repetidos, trazer clientes de uma planilha ou da agenda do celular e baixar a lista.
- **Papel mínimo:** Administrador
- **Busca no curso:** contato duplicado; juntar contatos; importar planilha; importar csv; excel; agenda do celular; sincronizar contatos; exportar contatos; baixar lista

1. **Contatos repetidos** — `/app/contacts`  
   O botão "Duplicados" procura a mesma pessoa cadastrada duas vezes, pelo mesmo telefone ou e-mail. Aqui a Juliana Castro foi cadastrada de novo por uma planilha, com o mesmo celular. Escolha qual cadastro fica: o outro é absorvido por ele. O sistema já deixa marcado o cadastro com movimento mais recente.
2. **Juntar não tem volta**  
   "Juntar" pede confirmação e diz quem fica e quem é absorvido. Conversas, mensagens, negócios e histórico passam para o cadastro que fica, e o outro sai da lista. Não tem como desfazer. Aqui clicamos em "Cancelar".
   > 💡 Só gerentes e administradores conseguem juntar contatos.
3. **Trazer de uma planilha** — `/app/contacts`  
   "Importar CSV" traz contatos de uma planilha. O arquivo precisa ter uma linha de títulos com colunas como nome, telefone, email, cpf, nascimento e tags. No Excel, use "Salvar como" e escolha "CSV UTF-8". Cabem até 500 linhas por arquivo. No fim, a janela mostra quantos entraram, quantos já existiam e quais linhas deram problema.
4. **Trazer da agenda do celular**  
   "Sincronizar agenda" traz os contatos salvos na agenda do celular conectado ao número da empresa, só os que têm WhatsApp. Quem já está cadastrado não é repetido. No fim, a janela mostra quantos entraram e quantos foram deixados de fora. Atenção ao aviso com o triângulo: vêm também os contatos pessoais do celular, e só pode receber campanha quem autorizou.
   > 💡 Sem um número de WhatsApp conectado em "Conexões", a janela avisa e o botão "Sincronizar" fica desligado. Se o celular tiver muitos contatos, clique em "Continuar de onde parou" para seguir do próximo.
5. **Baixar a lista**  
   "Exportar" baixa os contatos num arquivo. "Exportar CSV" é uma planilha, que pode ser aberta no Excel ou no Google Planilhas. "Exportar vCard" é o formato que o celular importa. Sai a lista inteira com os filtros que estiverem ligados na tela, não só a página que você está vendo, até 10.000 contatos.
   > 💡 Só gerentes e administradores veem o botão "Exportar".

---

<a id="m-empresas"></a>

## Empresas

**Tela:** `/app/companies`  
**Resumo:** O cadastro das empresas para quem a clínica vende: razão social, CNPJ, endereço e as pessoas que decidem lá dentro, com os telefones de cada uma.

**Lições:** [Conhecendo a tela de Empresas](#l-empresas--empresas-conhecendo-a-tela) · [Cadastrar e corrigir uma empresa](#l-empresas--empresas-cadastrar-e-corrigir)

<a id="l-empresas--empresas-conhecendo-a-tela"></a>

### Conhecendo a tela de Empresas

- **Objetivo:** Achar a tela, ler a lista de empresas, procurar uma delas e entender o que a ficha mostra.
- **Papel mínimo:** Atendente
- **Busca no curso:** empresas; cadastro de empresa; cnpj; razão social; venda para empresas; b2b; decisores; cliente pessoa jurídica

1. **Onde fica a tela** — `/app/crm`  
   Empresas não aparece direto no menu lateral. No grupo "CRM" do menu, clique em "Ver tudo em CRM". Na parte "O dia a dia da venda" está o cartão "Empresas". O caminho completo é: CRM › Ver tudo em CRM › Empresas.
   > 💡 O cartão só existe quando quem administra o servidor liga o módulo, em Administração › Sistema › Módulos opcionais › "Empresas e pessoas (venda para empresas)". Desligado, o cartão some e o endereço da tela leva à página "404 — Página não encontrada".
2. **A lista de empresas** — `/app/companies`  
   Cada linha é uma empresa. "Nome fantasia" é o nome que todo mundo conhece; "Razão social" é o nome oficial, o do contrato e da nota fiscal. Depois vêm o CNPJ, a cidade e a data da última mudança. As empresas que foram mexidas por último aparecem em cima.
   > 💡 Quando o CNPJ é consultado, os nomes passam a ser os da Receita Federal, em letras maiúsculas e sem acento. Para deixar do jeito que a clínica chama a empresa, use "Editar empresa" na ficha.
3. **O que a coluna Situação diz**  
   Com CNPJ, a empresa é consultada nos dados públicos da Receita (pela BrasilAPI). Deu certo: a coluna mostra a situação do cadastro, como "ATIVA". "failed" quer dizer que a consulta não achou o CNPJ ou não respondeu. "pending" quer dizer que ainda não houve consulta, e é o que fica para sempre numa empresa sem CNPJ, porque não há o que consultar.
   > 💡 "ATIVA" é a situação na Receita, não quer dizer que a empresa é cliente da clínica.
4. **Procurar uma empresa**  
   A caixa de busca procura pelo nome fantasia, pela razão social ou pelo CNPJ, com ou sem pontos. Escreva "Horizonte" e a lista fica só com a construtora. Clique no nome para abrir a ficha.
5. **A ficha da empresa** — `/app/companies/f1a01002-0000-4000-8000-000000000002`  
   Em "Dados cadastrais" ficam a razão social, a situação na Receita, o porte, a atividade principal (o CNAE) e o endereço. A linha "Enriquecimento" conta como foi a consulta do CNPJ: "completed" é consulta feita; quando falha, o motivo aparece ao lado.
6. **Quem decide e os telefones**  
   "Pessoas / decisores" lista quem trabalha na empresa e fala com a clínica, com o cargo de cada um. "Telefones" junta os números dessas pessoas: o Marcos tem dois, o celular e o fixo do RH. Clique num nome para abrir a ficha da pessoa, ou num número para abrir aquele contato.
   > 💡 Um telefone só aparece aqui se estiver ligado a uma pessoa da empresa. Quem liga telefone a pessoa é a importação de planilha, em Importações.

<a id="l-empresas--empresas-cadastrar-e-corrigir"></a>

### Cadastrar e corrigir uma empresa

- **Objetivo:** Cadastrar uma empresa nova, entender a consulta do CNPJ e saber onde corrigir, consultar de novo ou excluir.
- **Papel mínimo:** Gerente
- **Busca no curso:** nova empresa; cadastrar empresa; consultar cnpj; editar empresa; excluir empresa; enriquecer cnpj; cnpj não encontrado

1. **Abrir o cadastro** — `/app/companies`  
   Clique em "Nova empresa", no alto da tela.
   > 💡 Só gerente ou administrador consegue criar, consultar o CNPJ e excluir. Quem é atendente vê o botão, mas o cadastro é recusado.
2. **Preencher os nomes**  
   Basta um campo: a razão social, o nome fantasia ou o CNPJ. Aqui a farmácia entra só com os nomes. Quando você tem o CNPJ, digite e clique em "Consultar CNPJ": os dados públicos da Receita preenchem o formulário, e nada é gravado até você clicar em "Criar". Se o CNPJ já está cadastrado, a tela avisa antes.
   > 💡 Consultar o CNPJ manda o número para a BrasilAPI, um serviço público na internet. Ao criar uma empresa com CNPJ, essa consulta também roda sozinha.
3. **A empresa entrou na lista**  
   Depois de "Criar", a farmácia aparece no alto da lista. Sem CNPJ, a situação fica "pending": não há o que consultar. Para completar, abra a ficha e use "Editar empresa".
4. **Quando a consulta do CNPJ falha** — `/app/companies/f1a01004-0000-4000-8000-000000000004`  
   A Rota Sul veio de uma planilha e a consulta não achou o CNPJ: o motivo está na linha "Enriquecimento". Confira o número em "Editar empresa" e depois clique em "Enriquecer CNPJ" para consultar de novo.
   > 💡 Um CNPJ recém-aberto pode demorar alguns dias para aparecer nos dados públicos. Nesse caso o número está certo: é só tentar de novo mais tarde.
5. **Excluir só sem pessoas ligadas**  
   "Excluir empresa" apaga o cadastro. Se ainda há pessoas ligadas à empresa, como o Paulo aqui na Rota Sul, a exclusão é recusada, a tela mostra o motivo e nada é apagado.

---

<a id="m-pessoas"></a>

## Pessoas

**Tela:** `/app/people`  
**Resumo:** As pessoas que decidem dentro das empresas clientes: em que empresa trabalham, com que cargo, e por quais telefones se fala com elas.

**Lições:** [Conhecendo a tela de Pessoas](#l-pessoas--pessoas-conhecendo-a-tela) · [Cadastrar uma pessoa](#l-pessoas--pessoas-cadastrar-uma-pessoa)

<a id="l-pessoas--pessoas-conhecendo-a-tela"></a>

### Conhecendo a tela de Pessoas

- **Objetivo:** Entender a diferença entre pessoa e contato, procurar alguém e ler a ficha da pessoa.
- **Papel mínimo:** Atendente
- **Busca no curso:** pessoas; decisor; quem decide na empresa; contato da empresa; cargo; pessoa com vários telefones; b2b

1. **Onde fica a tela** — `/app/crm`  
   Pessoas não aparece direto no menu lateral. No grupo "CRM" do menu, clique em "Ver tudo em CRM". Na parte "O dia a dia da venda" está o cartão "Pessoas". O caminho completo é: CRM › Ver tudo em CRM › Pessoas.
   > 💡 O cartão só existe quando quem administra o servidor liga o módulo "Empresas e pessoas (venda para empresas)", em Administração › Sistema › Módulos opcionais. É o mesmo módulo da tela de Empresas.
2. **Pessoa não é contato** — `/app/people`  
   Uma pessoa é alguém que trabalha numa empresa cliente, como o gerente de RH que contrata o programa de saúde. Um contato é um número de telefone, aquele que conversa no WhatsApp. Uma pessoa pode ter vários telefones, e cada telefone é um contato ligado a ela. Por isso a lista mostra o nome, o e-mail e quando o cadastro mudou, mas não o telefone: os números ficam em Contatos.
3. **Procurar uma pessoa**  
   A caixa de busca procura pelo nome ou pelo e-mail. Escreva "Marcos" e clique no nome para abrir a ficha.
4. **A ficha da pessoa** — `/app/people/f1a02003-0000-4000-8000-000000000003`  
   "Empresas" mostra onde a pessoa trabalha e o cargo dela. "Telefones (contacts)" lista os números ligados a ela: o Marcos tem o celular e o fixo do RH. Clique na empresa para abrir a ficha dela, ou num número para abrir aquele contato.
5. **Pessoa sem empresa e sem telefone** — `/app/people/f1a02008-0000-4000-8000-000000000008`  
   A Beatriz foi cadastrada à mão, com nome e e-mail. Por isso a ficha avisa "Sem vínculo empresarial." e "Nenhum telefone vinculado.". Quem liga uma pessoa a uma empresa e a um telefone é a importação de planilha, em Importações.

<a id="l-pessoas--pessoas-cadastrar-uma-pessoa"></a>

### Cadastrar uma pessoa

- **Objetivo:** Cadastrar uma pessoa pela tela e saber quando é melhor trazê-la por planilha.
- **Papel mínimo:** Gerente
- **Busca no curso:** nova pessoa; cadastrar pessoa; cadastrar decisor; adicionar contato da empresa; ligar pessoa à empresa

1. **Abrir o cadastro** — `/app/people`  
   Clique em "Nova pessoa", no alto da tela.
   > 💡 Só gerente ou administrador consegue cadastrar. Quem é atendente vê o botão, mas o cadastro é recusado.
2. **Nome e e-mail**  
   O formulário pede o nome completo, que é obrigatório, e o e-mail. Preencha e clique em "Criar".
3. **A pessoa entrou, ainda sem empresa**  
   A Patrícia aparece no alto da lista. Este formulário não liga a pessoa a uma empresa nem a um telefone: a ficha dela vai dizer "Sem vínculo empresarial.". Para isso, traga a pessoa numa planilha em Importações, com a empresa, o cargo e o telefone na mesma linha.
   > 💡 A importação não reaproveita uma pessoa cadastrada aqui: ela cria outra com o mesmo nome. Se a pessoa vai entrar por planilha, cadastre-a só por lá.

---

<a id="m-tarefas"></a>

## Tarefas

**Tela:** `/app/tasks`  
**Resumo:** A lista do que a equipe combinou de fazer, com prazo e responsável: anotar, concluir, filtrar e ver tudo num calendário.

**Lições:** [Conhecendo a tela de Tarefas](#l-tarefas--tarefas-conhecendo-a-tela) · [Criar uma tarefa](#l-tarefas--tarefas-criar-uma-tarefa) · [Concluir, editar e apagar](#l-tarefas--tarefas-concluir-editar-apagar) · [Ver as tarefas concluídas e as em andamento](#l-tarefas--tarefas-filtrar-por-situacao) · [Ver as tarefas no calendário](#l-tarefas--tarefas-calendario) · [Tarefas ligadas a um negócio](#l-tarefas--tarefas-ligadas-a-negocio)

<a id="l-tarefas--tarefas-conhecendo-a-tela"></a>

### Conhecendo a tela de Tarefas

- **Objetivo:** Entender como as tarefas da equipe ficam organizadas por prazo e o que cada linha mostra.
- **Papel mínimo:** Administrador
- **Busca no curso:** tarefas; lista de tarefas; o que fazer; pendências da equipe; tarefas atrasadas; prazo das tarefas; lembretes

1. **As tarefas, separadas por prazo** — `/app/tasks`  
   Tarefas é a lista do que a equipe combinou de fazer, como "ligar de volta na terça". A tela separa as tarefas em grupos pelo prazo. "Atrasadas" vem primeiro, em vermelho, porque pede ação agora: são as tarefas com prazo num dia que já passou. Depois vêm "Hoje", "Esta semana" (os próximos 7 dias), "Mais tarde" e, no fim, "Sem prazo". Uma tarefa de hoje cujo horário já passou continua em "Hoje", com a hora em vermelho. Um grupo sem nenhuma tarefa nem aparece.
   > 💡 A tela abre mostrando só as tarefas em aberto. As já feitas ficam escondidas; você aprende a vê-las na lição sobre filtros.
2. **O que cada linha mostra**  
   Cada linha é uma tarefa. Embaixo do título aparecem os detalhes, quando alguém escreveu. Depois vêm a prioridade (Baixa, Média, Alta ou Urgente), o dia e a hora do prazo (em vermelho quando já passou) e quem é o responsável. Quando a tarefa está ligada a um negócio do funil, o nome do negócio aparece no fim da linha.
3. **Os botões do alto da tela**  
   No alto da tela ficam os comandos. O seletor "Em aberto" escolhe quais tarefas aparecem. "Lista" e "Calendário" trocam o jeito de ver as tarefas. "Atualizar" busca a lista de novo, para você ver o que um colega acabou de mudar. "Nova tarefa" abre o formulário para anotar uma tarefa.
   > 💡 Quem só tem permissão de leitura vê as tarefas, mas não vê o botão "Nova tarefa".

<a id="l-tarefas--tarefas-criar-uma-tarefa"></a>

### Criar uma tarefa

- **Objetivo:** Anotar uma tarefa nova com detalhes, prioridade e responsável.
- **Papel mínimo:** Administrador
- **Busca no curso:** criar tarefa; nova tarefa; anotar tarefa; lembrete para equipe; responsável pela tarefa; prioridade; passar tarefa para colega

1. **Abrir o formulário** — `/app/tasks`  
   Para anotar uma tarefa nova, clique em "Nova tarefa", no canto de cima, à direita.
2. **O que precisa ser feito**  
   No primeiro campo, "O que precisa ser feito", escreva a tarefa numa frase curta. Ele é o único campo obrigatório. Em "Detalhes", anote o que você vai querer lembrar quando chegar a hora.
3. **Prazo, prioridade e situação**  
   Em "Prazo" você escolhe o dia e em "Horário" a hora. O prazo é opcional: sem ele, a tarefa vai para o grupo "Sem prazo". A hora só fica liberada depois que você escolhe o dia. "Prioridade" vai de Baixa a Urgente e já vem como Média; aqui escolhemos Alta. "Situação" já vem como Pendente.
   > 💡 Para criar a tarefa já com o dia preenchido, use o calendário: é a lição "Ver as tarefas no calendário".
4. **Quem vai fazer**  
   Em "Responsável", escolha quem vai cumprir a tarefa. A lista traz as pessoas da equipe, menos quem só tem permissão de leitura; você aparece como "Eu". "Ninguém" deixa a tarefa sem dono.
5. **Salvar**  
   Com tudo preenchido, clique em "Salvar". "Cancelar" fecha o formulário sem guardar nada.
6. **A tarefa entrou na lista**  
   A tarefa aparece na lista na hora. Como ficou sem prazo, ela entrou no grupo "Sem prazo", com a prioridade Alta e a Ana Ribeiro como responsável.

<a id="l-tarefas--tarefas-concluir-editar-apagar"></a>

### Concluir, editar e apagar

- **Objetivo:** Marcar uma tarefa como feita, mudar uma tarefa e apagar a que não serve mais.
- **Papel mínimo:** Administrador
- **Busca no curso:** concluir tarefa; marcar como feita; editar tarefa; apagar tarefa; excluir tarefa; mudar prioridade; riscar tarefa

1. **Os comandos de cada linha** — `/app/tasks`  
   A caixinha à esquerda de cada tarefa marca a tarefa como concluída. Quando você passa o mouse sobre a linha, aparecem dois botões à direita: o lápis, para editar, e a lixeira, para apagar.
2. **Tarefa concluída**  
   Ao clicar na caixinha, a tarefa do Roberto foi marcada como concluída e saiu da lista, que mostra só o que está em aberto. Agora só a tarefa da Mariana está atrasada. Para rever as concluídas, troque o filtro para "Concluída" (próxima lição).
   > 💡 Se a tarefa estiver ligada a um negócio, a conclusão fica registrada na "Linha do tempo" da ficha do negócio.
3. **Editar uma tarefa**  
   Clique no lápis para abrir a tarefa no formulário "Editar tarefa". Ele traz tudo o que já estava preenchido. Aqui vamos subir a prioridade da tarefa da Fernanda para Urgente.
4. **Salvar a mudança**  
   Clique em "Salvar". A linha da tarefa mostra a prioridade nova na hora.
5. **Apagar em dois cliques**  
   Para apagar, clique na lixeira. No lugar dela aparece o botão vermelho "Confirmar": só ao clicar nele a tarefa é apagada. Tarefa apagada não volta. Se ela só não vai mais ser feita, prefira editar e mudar a situação para "Cancelada".

<a id="l-tarefas--tarefas-filtrar-por-situacao"></a>

### Ver as tarefas concluídas e as em andamento

- **Objetivo:** Usar o filtro de situação para ver as tarefas concluídas, canceladas ou em andamento, e reabrir uma tarefa.
- **Papel mínimo:** Administrador
- **Busca no curso:** tarefas concluídas; ver tarefas feitas; filtro de tarefas; tarefas canceladas; reabrir tarefa; em andamento

1. **O filtro de situação** — `/app/tasks`  
   O seletor no alto começa em "Em aberto", que junta as tarefas pendentes e as em andamento. Clique nele para escolher outra situação: "Pendente", "Em andamento", "Concluída" ou "Cancelada".
2. **As tarefas concluídas**  
   Com "Concluída", a lista mostra o grupo "Encerradas": as tarefas aparecem riscadas e com a caixinha marcada. Para reabrir uma tarefa, clique na caixinha marcada: ela volta a ser pendente e reaparece em "Em aberto".
3. **As tarefas em andamento**  
   Com "Em andamento", aparecem só as tarefas que alguém marcou como "Em andamento". Essa marcação é feita à mão, no formulário da tarefa, no campo "Situação".
   > 💡 Para voltar à lista normal, escolha "Em aberto" no mesmo seletor.

<a id="l-tarefas--tarefas-calendario"></a>

### Ver as tarefas no calendário

- **Objetivo:** Ver as tarefas do mês num calendário, abrir uma tarefa e criar outra já com o dia escolhido.
- **Papel mínimo:** Administrador
- **Busca no curso:** calendário de tarefas; tarefas do mês; ver por data; agenda de tarefas; tarefa no dia; criar tarefa no calendário

1. **Trocar para o calendário** — `/app/tasks`  
   Clique em "Calendário" para ver as tarefas do mês, cada uma no dia do seu prazo. O dia de hoje fica marcado com um círculo colorido. As tarefas atrasadas aparecem em vermelho. As setas dos lados do nome do mês passam para o mês anterior e para o próximo.
   > 💡 Num dia com mais de três tarefas, aparece "+1 mais", "+2 mais"… Esse aviso não abre nada; para ver todas, volte para "Lista". O calendário mostra as mesmas tarefas do seletor de situação (com "Em aberto", as concluídas ficam de fora), e as tarefas sem prazo não aparecem nele.
2. **Abrir uma tarefa pelo calendário**  
   Clique no nome de uma tarefa para abrir o formulário "Editar tarefa" com tudo o que já foi preenchido.
3. **Criar uma tarefa num dia**  
   Clique num espaço vazio de um dia para abrir "Nova tarefa" com aquele dia já em "Prazo". O horário começa às 9h e pode ser trocado. Escreva o que precisa ser feito e clique em "Salvar".
4. **A tarefa no dia**  
   Depois de "Salvar", a tarefa aparece no dia escolhido.

<a id="l-tarefas--tarefas-ligadas-a-negocio"></a>

### Tarefas ligadas a um negócio

- **Objetivo:** Ir da tarefa para o negócio do funil e ver as tarefas daquele negócio.
- **Papel mínimo:** Administrador
- **Busca no curso:** tarefa do negócio; tarefa do lead; abrir negócio da tarefa; funil e tarefas; tarefas do cliente

1. **O nome do negócio é um atalho** — `/app/tasks`  
   Quando uma tarefa está ligada a um negócio do funil, o nome do negócio aparece no fim da linha. Clique nele para abrir o negócio.
2. **As tarefas dentro do negócio**  
   O funil abre com a ficha do negócio por cima. Na seção "Tarefas" da ficha aparecem só as tarefas deste negócio, inclusive as já concluídas, e, ao lado do título, a conta de quantas estão abertas e quantas estão atrasadas. Dali também dá para criar uma tarefa em "Nova tarefa": ela já nasce ligada ao negócio.
3. **Criar uma tarefa pelo negócio**  
   Clique em "Nova tarefa", na seção "Tarefas" da ficha. O formulário é o mesmo da tela de Tarefas, com duas diferenças: a tarefa já nasce ligada a este negócio, e o campo "Responsável" já vem com você ("Eu"), porque quem anota o próximo passo do negócio quase sempre é quem vai cumpri-lo.

---

<a id="m-planos-de-tarefa"></a>

## Planos de tarefa

**Tela:** `/app/tasks/planos`  
**Resumo:** Sequências de tarefas que se repetem, montadas uma vez só: uma automação aplica o plano a cada negócio e ninguém esquece o próximo passo.

**Lições:** [Conhecendo a tela de Planos de tarefa](#l-planos-de-tarefa--planos-conhecendo-a-tela) · [Criar um plano](#l-planos-de-tarefa--planos-criar-um-plano) · [Editar e excluir um plano](#l-planos-de-tarefa--planos-editar-e-excluir) · [Aplicar o plano com uma automação](#l-planos-de-tarefa--planos-aplicar-com-automacao)

<a id="l-planos-de-tarefa--planos-conhecendo-a-tela"></a>

### Conhecendo a tela de Planos de tarefa

- **Objetivo:** Achar a tela, entender o que é um plano de tarefa e o que cada cartão mostra.
- **Papel mínimo:** Administrador
- **Busca no curso:** planos de tarefa; sequência de tarefas; modelo de tarefas; tarefas que se repetem; roteiro de acompanhamento; passos depois da avaliação; checklist do negócio

1. **Onde fica a tela** — `/app/crm`  
   Planos de tarefa não aparece direto no menu lateral. No grupo "CRM" do menu, clique em "Ver tudo em CRM". Na parte "O dia a dia da venda" está o cartão "Planos de tarefa". O caminho completo é: CRM › Ver tudo em CRM › Planos de tarefa.
   > 💡 Se o cartão não aparecer, a interface da empresa ou a sua foi enxugada: com o "Perfil de interface" "Simplificada", ele some. Quem administra muda isso em Configurações › Organização (para a empresa toda) ou em Equipe (só para uma pessoa).
2. **Para que serve um plano** — `/app/tasks/planos`  
   Muitos atendimentos pedem sempre os mesmos passos. Na clínica, depois da avaliação de fisioterapia, alguém liga no dia seguinte, manda os horários livres e, dias depois, pergunta se o paciente quer fechar o pacote. Um plano de tarefa guarda essa sequência uma vez só. Quando o plano é aplicado a um negócio do funil, cada passo vira uma tarefa na tela "Tarefas", com prazo e responsável.
   > 💡 Esta tela só monta os planos. Quem aplica um plano a um negócio é uma automação, com a ação "Aplicar um plano de tarefas ao negócio". Isso está na última lição.
3. **O que cada cartão mostra**  
   Cada plano salvo vira um cartão: o nome em cima, a descrição logo abaixo e os passos numerados, na ordem em que as tarefas serão criadas. "Vence em (dias)" é o prazo de cada tarefa, contado a partir do momento em que o plano é aplicado: 1 quer dizer um dia depois, no mesmo horário; 0 quer dizer na mesma hora.
   > 💡 Os códigos entre chaves, como {{contact.name}}, são trocados pelo nome do paciente quando a tarefa é criada. O cartão não mostra a prioridade nem a pessoa de cada passo: para ver, clique em "Editar".
4. **Editar e Excluir**  
   Cada cartão tem dois botões. "Editar" abre o plano no formulário, para mudar o que for preciso. "Excluir" apaga o plano. Os dois aparecem na lição "Editar e excluir um plano".
   > 💡 Qualquer pessoa da equipe abre esta tela e vê os planos, mas só gerente ou administrador consegue salvar ou excluir. Para os outros, os botões aparecem, mas a gravação é recusada com o aviso "Permissão insuficiente".

<a id="l-planos-de-tarefa--planos-criar-um-plano"></a>

### Criar um plano

- **Objetivo:** Montar um plano novo, passo a passo, e salvá-lo para as automações usarem.
- **Papel mínimo:** Administrador
- **Busca no curso:** criar plano de tarefa; novo plano; montar sequência de tarefas; adicionar passo; prazo da tarefa em dias; responsável pela tarefa; nome do paciente na tarefa

1. **Abrir o formulário** — `/app/tasks/planos`  
   Clique em "Novo plano", no alto, à direita. O formulário abre logo abaixo do título da tela, em cima da lista de planos.
2. **Nome e descrição**  
   Em "Nome do plano", escreva um nome que a equipe reconheça: é ele que aparece na lista de planos das automações. A "Descrição (opcional)" conta quando usar o plano. O contador embaixo mostra quantos dos 300 caracteres você já usou.
3. **O primeiro passo**  
   Cada passo vira uma tarefa. Em "Título", escreva o que precisa ser feito. Dá para usar dois códigos, que o sistema troca na hora de criar a tarefa: {{contact.name}} vira o nome do contato (o paciente) e {{lead.title}} vira o nome do negócio. Assim a tarefa já nasce dizendo com quem falar.
4. **Prazo, prioridade e responsável**  
   "Vence em (dias)" diz quantos dias depois da aplicação a tarefa vence; aqui, 25. "Prioridade" vai de Baixa a Urgente e começa em Média; escolhemos Alta. Em "Atribuir a", "Dono do negócio" entrega a tarefa a quem for o responsável pelo negócio quando o plano for aplicado. Também dá para escolher uma pessoa fixa da equipe.
   > 💡 Se um passo usa "Dono do negócio" e o negócio está sem responsável, o plano inteiro não é aplicado e nenhuma tarefa é criada. Quem só tem permissão de leitura não aparece na lista de pessoas.
5. **Mais um passo**  
   Clique em "Adicionar passo" para pôr outra tarefa na sequência. Aqui, o passo 2 é conferir se o paciente confirmou o retorno, três dias depois do passo 1, e ele vai sempre para a Ana Ribeiro, da recepção. Um plano pode ter até 30 passos. "Remover passo" tira um passo da lista.
6. **Salvar**  
   Confira e clique em "Salvar plano". Se faltar o nome do plano ou o título de algum passo, nada é salvo e aparece um aviso vermelho no alto da tela, acima do formulário. "Cancelar" fecha o formulário sem guardar nada.
   > 💡 Num plano comprido, a tela fica rolada para baixo e o aviso não aparece na hora: se nada parecer acontecer depois de "Salvar plano", suba a tela para ler o aviso.
7. **O plano entrou na lista**  
   O formulário fecha e o plano novo aparece no fim da lista, com os dois passos e os seus prazos. A partir de agora ele já pode ser escolhido nas automações.

<a id="l-planos-de-tarefa--planos-editar-e-excluir"></a>

### Editar e excluir um plano

- **Objetivo:** Mudar um plano que já existe e apagar um que não serve mais.
- **Papel mínimo:** Administrador
- **Busca no curso:** editar plano de tarefa; mudar prazo do plano; remover passo; excluir plano; apagar plano de tarefa; trocar responsável do passo

1. **Abrir o plano** — `/app/tasks/planos`  
   Para mudar um plano, clique em "Editar" no cartão dele. Vamos editar o "Pós-avaliação de fisioterapia".
2. **O formulário já vem preenchido**  
   O mesmo formulário de "Novo plano" abre no alto da tela, com tudo o que o plano já tem, inclusive a prioridade e a pessoa de cada passo. Aqui mudamos o prazo do passo 2, o de enviar os horários livres, de 2 para 3 dias.
3. **Tirar um passo**  
   "Remover passo" tira o passo da sequência. Vamos tirar o passo 3. Se ele estiver no meio, os passos de baixo sobem e são numerados de novo.
4. **Salvar a mudança**  
   O passo 3 saiu do formulário. Clique em "Salvar plano". A mudança vale para as próximas vezes que o plano for aplicado; as tarefas que ele já criou continuam como estão.
   > 💡 Um negócio que já recebeu este plano não recebe de novo, nem depois da mudança: o sistema aplica cada plano uma vez só em cada negócio.
5. **O cartão mudou**  
   O formulário fecha e o cartão mostra o plano com dois passos. O passo 2 agora vence em 3 dias.
6. **Excluir um plano**  
   Para apagar um plano, clique em "Excluir" no cartão dele. Atenção: não há pergunta de confirmação, o plano some na hora e não volta.
   > 💡 Uma automação que usava o plano apagado deixa de criar tarefas. Cada vez que ela rodar, a aba "Atividade" de Webhooks avisa que o plano escolhido não existe mais.
7. **O plano saiu da lista**  
   O cartão "Boas-vindas ao paciente novo" sumiu e só ficou o outro plano. As tarefas que o plano apagado já tinha criado continuam na tela "Tarefas".

<a id="l-planos-de-tarefa--planos-aplicar-com-automacao"></a>

### Aplicar o plano com uma automação

- **Objetivo:** Fazer o plano virar tarefas sozinho, quando algo acontece com o negócio.
- **Papel mínimo:** Administrador
- **Busca no curso:** aplicar plano de tarefa; automação de tarefas; criar tarefas automaticamente; quando o negócio for ganho; regra de automação; usar o plano no negócio

1. **Onde o plano é aplicado** — `/app/webhooks?aba=automacoes`  
   O plano vira tarefas por meio de uma automação: uma regra do tipo "quando acontecer isto, faça aquilo". As automações ficam no menu "Webhooks", aba "Automações". Clique em "Nova automação".
   > 💡 Só gerente ou administrador vê o menu "Webhooks".
2. **Quando aplicar**  
   Dê um nome à automação. Em "QUANDO", escolha o que dispara a regra. Aqui, "Quando um negócio for ganho": quando o paciente fecha o tratamento e o negócio é marcado como ganho no funil, a regra roda.
3. **Escolher o plano**  
   Em "ENTÃO", abra "Adicionar ação" e escolha "Aplicar um plano de tarefas ao negócio". No campo "Plano de tarefa" aparece a lista dos planos salvos na tela Planos de tarefa. Escolha "Boas-vindas ao paciente novo".
4. **O que acontece quando a regra roda**  
   A cada negócio ganho, o plano cria as suas tarefas na ordem dos passos, com os prazos contados a partir daquele momento. O mesmo plano não é aplicado duas vezes no mesmo negócio, e a linha do tempo do negócio registra que o plano foi aplicado. A automação nasce pausada: depois de "Criar automação", ligue a chave dela na lista de automações.
   > 💡 Se algum passo usa "Dono do negócio" e o negócio não tem responsável, o plano não é aplicado e nenhuma tarefa é criada. O resultado de cada vez que a regra roda aparece na aba "Atividade" de Webhooks.

---

<a id="m-chamadas"></a>

## Chamadas

**Tela:** `/app/calls`  
**Resumo:** O histórico das ligações por telefone que a IA de voz fez e recebeu, com a conversa escrita de cada uma.

**Lições:** [Conhecendo a tela de Chamadas](#l-chamadas--chamadas-conhecendo-a-tela) · [Ler o que foi conversado](#l-chamadas--chamadas-ler-a-conversa)

<a id="l-chamadas--chamadas-conhecendo-a-tela"></a>

### Conhecendo a tela de Chamadas

- **Objetivo:** Saber onde fica o histórico de ligações, o que cada linha mostra e para que serve o botão Nova ligação.
- **Papel mínimo:** Gerente
- **Busca no curso:** chamadas; ligações; histórico de ligações; ligação perdida; ligação não atendida; telefone; voz por ia; ia que liga

1. **Onde fica a tela** — `/app/crm`  
   Chamadas não aparece direto no menu lateral. No grupo "CRM" do menu, clique em "Ver tudo em CRM". Na parte "O dia a dia da venda" está o cartão "Chamadas". O caminho completo é: CRM › Ver tudo em CRM › Chamadas.
   > 💡 Só gerente ou administrador vê este cartão. As ligações só acontecem se quem cuida do servidor ligou a telefonia e a linha do provedor foi cadastrada em Configurações › Trunk SIP. Sem isso, a tela abre, mas fica vazia.
2. **Uma linha para cada ligação** — `/app/calls`  
   Aqui ficam as ligações por telefone da clínica, a mais recente em cima. Cada linha é uma ligação: o dia e a hora, a direção ("Entrada" quando o paciente ligou, "Saída" quando a clínica ligou), o número do paciente em "Quem é", como terminou, quem atendeu e quanto tempo durou. Em "Atendido por", "IA" quer dizer que a IA de voz conduziu a conversa sozinha.
3. **Como cada ligação terminou**  
   A coluna "Status" diz o que aconteceu. "Concluída" é uma conversa que foi até o fim. "Não atendida" é uma ligação que tocou e ninguém atendeu: vale retornar para esse paciente. "Ocupado" quer dizer que a linha do outro lado estava em uso. Quando ninguém conversou, a duração aparece como "—".
4. **Pedir para a IA ligar**  
   "Nova ligação", no alto da tela, abre esta janela. Digite o número em "Número" e clique em "Ligar com IA": a IA de voz liga para o paciente e conduz a conversa. O botão só acende depois de pelo menos 8 dígitos. Por enquanto não dá para você mesmo falar na ligação, só a IA. Para desistir, aperte Esc ou clique fora da janela.
   > 💡 Não clique em "Ligar com IA" só para testar: a ligação é de verdade, toca no telefone da pessoa e é cobrada pelo provedor da linha.

<a id="l-chamadas--chamadas-ler-a-conversa"></a>

### Ler o que foi conversado

- **Objetivo:** Abrir uma ligação e ler, por escrito, o que a IA e o paciente disseram.
- **Papel mínimo:** Gerente
- **Busca no curso:** transcrição da ligação; o que a ia falou no telefone; conversa da ligação; gravação da ligação; sem transcrição

1. **Abrir uma ligação** — `/app/calls`  
   Para ver o que foi conversado numa ligação, clique na linha dela. Esta foi uma ligação recebida que a IA atendeu e que terminou com uma consulta marcada.
2. **A conversa por escrito**  
   A janela mostra, no alto, com quem foi a ligação, o dia, a direção e como terminou. Embaixo vem a conversa inteira, por escrito, na ordem em que foi falada. Os balões cinza, à esquerda, são a IA; os coloridos, à direita, são o paciente. É assim que você confere o que a IA prometeu sem ter de ouvir nada. Para fechar, aperte Esc ou clique fora da janela.
3. **Ligação sem conversa**  
   Uma ligação que ninguém atendeu, ou que deu ocupado, não tem conversa para mostrar. A janela avisa "Sem transcrição pra esta chamada.". Nesse caso, o que vale é o horário e o número: use-os para retornar a ligação.

---

<a id="m-produtos"></a>

## Produtos

**Tela:** `/app/products`  
**Resumo:** A lista do que a empresa vende, com preço e estoque: é nela que o atendente de IA procura o valor quando um cliente pergunta quanto custa.

**Lições:** [Conhecendo a tela de Produtos](#l-produtos--produtos-conhecendo-a-tela) · [Cadastrar um produto](#l-produtos--produtos-cadastrar) · [Corrigir um produto e tirá-lo de venda](#l-produtos--produtos-editar-e-desativar) · [Fotos e planilha](#l-produtos--produtos-fotos-e-planilha)

<a id="l-produtos--produtos-conhecendo-a-tela"></a>

### Conhecendo a tela de Produtos

- **Objetivo:** Achar o catálogo, entender para que ele serve e o que cada linha mostra.
- **Papel mínimo:** Administrador
- **Busca no curso:** produtos; catálogo; lista de preços; tabela de preços; cadastro de produtos; estoque; preço que a IA responde

1. **Onde fica a tela** — `/app/crm`  
   Produtos não aparece direto no menu lateral. No grupo "CRM" do menu, clique em "Ver tudo em CRM". Na parte "Preparar a venda" está o cartão "Produtos". O caminho completo é: CRM › Ver tudo em CRM › Produtos.
   > 💡 Com o "Perfil de interface" "Simplificada", o cartão não aparece; quem administra escolhe as áreas visíveis em Configurações › Organização. Quem é atendente ou só tem permissão de leitura vê o catálogo, mas não consegue alterar.
2. **Para que serve o catálogo** — `/app/products`  
   Produtos é a lista do que a clínica vende, cada um com o seu preço. Entram aqui serviços, como uma consulta ou um pacote de sessões, e itens de prateleira, como um suplemento. Quando um cliente pergunta "quanto custa?" no WhatsApp, o atendente de IA procura o produto nesta lista e responde com o preço cadastrado, em vez de chutar um valor.
   > 💡 O atendente de IA só consulta esta lista quando a ferramenta "Procurar produto na loja" está ligada no agente, em "Agentes". Com o catálogo vazio, ele responde que não encontrou o produto.
3. **O que cada linha mostra**  
   Cada linha é um produto. Em cima vem o nome. Embaixo vêm o código, a marca (quando tem) e o estoque. "12 em estoque" é quantas unidades a clínica tem. "Sem controle de estoque" quer dizer que ninguém conta unidades daquele item, como num pacote de sessões: ele sempre conta como disponível. À direita fica o preço de venda. Se o produto tem foto, a primeira aparece pequena no começo da linha.
   > 💡 Com "0 em estoque", o produto continua na lista, mas o atendente de IA é avisado de que ele está em falta.
4. **Os comandos do alto da tela**  
   No alto ficam os comandos. A caixa de busca procura um produto. "Novo produto" abre o formulário para cadastrar um item. "Importar planilha" traz vários produtos de uma vez, de um arquivo. "Baixar planilha modelo" baixa um exemplo de planilha com as colunas certas.
   > 💡 Os botões de cadastrar e alterar só aparecem para gerente ou administrador. Quem é atendente vê a lista e a busca, sem os botões.
5. **Procurar um produto** — `/app/products?busca=nutri`  
   Digite um pedaço do nome, do código, da marca ou da categoria. Aqui, "nutri" achou a consulta nutricional pelo nome e os dois suplementos pela marca NutriVida. Embaixo da lista, "1–3 de 3" diz quantos produtos a busca achou. A tela mostra 50 produtos por vez; quando há mais, aparecem os botões "Página anterior" e "Próxima página".
   > 💡 Com uma letra só, a tela não mostra nada: a busca começa a partir de 2. Para voltar a ver tudo, apague o que escreveu.

<a id="l-produtos--produtos-cadastrar"></a>

### Cadastrar um produto

- **Objetivo:** Pôr um produto novo no catálogo, com preço e estoque, para o atendente de IA poder responder o valor.
- **Papel mínimo:** Administrador
- **Busca no curso:** cadastrar produto; novo produto; adicionar produto; colocar preço; controlar estoque; código do produto; preço de custo

1. **Abrir o formulário** — `/app/products`  
   A clínica começou a vender faixas elásticas para os exercícios da fisioterapia. Para pôr um produto novo no catálogo, clique em "Novo produto". O formulário abre logo abaixo, em cima da lista.
   > 💡 Só gerente ou administrador vê o botão "Novo produto".
2. **Código e nome**  
   "Código" é a identificação do produto na clínica, como a etiqueta da prateleira. Ele não pode se repetir: se já existir um produto com o mesmo código, a tela avisa e não salva. "Nome" é como o produto aparece na lista e para o atendente de IA. Escreva do jeito que um cliente pediria. Código e Nome são obrigatórios: sem eles a tela avisa e não salva.
3. **Marca, categoria e preço**  
   "Marca" e "Categoria" são opcionais e ajudam a achar o produto na busca. Em "Preço de venda", escreva o valor do jeito que você já escreve, como 39,90 ou 1.299,90. Esse campo é obrigatório: sem um preço que dê para ler, a tela avisa "Preço inválido" e não salva. "Custo" é quanto o produto custa para a clínica. Ele é opcional e não aparece para o cliente.
4. **Estoque**  
   A caixa "Controlar estoque deste produto" já vem marcada. Deixe marcada para itens de prateleira e escreva em "Quantidade" quantas unidades a clínica tem; aqui são 15. Desmarque para serviços e itens feitos sob encomenda, como uma consulta ou uma palmilha sob medida. Desmarcada, o campo "Quantidade" some e o produto sempre conta como disponível para o atendente de IA.
5. **Salvar**  
   Confira tudo e clique em "Salvar produto". Repare que o botão que antes dizia "Novo produto" agora diz "Cancelar": ele fecha o formulário sem salvar.
6. **O produto entrou na lista**  
   O formulário fecha e a faixa elástica aparece na lista, em ordem alfabética, com o código, a marca, as 15 unidades em estoque e o preço. A partir de agora, o atendente de IA já consegue encontrá-la quando um cliente perguntar.

<a id="l-produtos--produtos-editar-e-desativar"></a>

### Corrigir um produto e tirá-lo de venda

- **Objetivo:** Mudar o preço, o estoque ou a descrição de um produto e desativar o que a clínica parou de vender.
- **Papel mínimo:** Administrador
- **Busca no curso:** mudar preço; alterar preço; editar produto; atualizar estoque; descrição do produto; desativar produto; parar de vender; reativar produto

1. **Abrir a edição** — `/app/products`  
   Chegou um lote novo de escovas ortodônticas, e o fornecedor aumentou o preço. Para atualizar o produto, clique em "Editar" na linha dele.
2. **Trocar o preço e o estoque**  
   O formulário abre embaixo da linha, já preenchido com o que está cadastrado. Troque o que mudou: aqui, o preço passou para 27,90 e a quantidade para 50. A edição tem um campo que o cadastro não tem, a "Descrição". Escreva nela o que os clientes costumam perguntar. O atendente de IA recebe a descrição junto com o preço quando procura o produto.
3. **Salvar as alterações**  
   Clique em "Salvar alterações". Se você não mudou nada, a tela avisa "Nada para alterar." e não grava. "Cancelar" fecha o formulário sem gravar.
4. **Produto atualizado**  
   O formulário fecha e a linha já mostra o preço novo e as 50 unidades em estoque. Na próxima vez que um cliente perguntar, o atendente de IA responde com o preço novo.
5. **Desativar o que saiu de venda**  
   O fornecedor parou de fabricar o ômega 3 que a clínica vendia. A tela não tem botão de apagar produto: clique em "Desativar". O produto continua guardado, mas sai da venda, porque o atendente de IA só procura entre os produtos ativos.
6. **Riscado, no fim da lista**  
   O nome fica riscado e o produto vai para o fim da lista, junto com os outros desativados. O botão da linha passa a dizer "Reativar": é por ele que o produto volta a ser vendido.

<a id="l-produtos--produtos-fotos-e-planilha"></a>

### Fotos e planilha

- **Objetivo:** Pôr fotos num produto e trazer o catálogo inteiro de uma planilha.
- **Papel mínimo:** Administrador
- **Busca no curso:** foto do produto; imagem do produto; importar planilha; importar produtos; planilha modelo; excel; csv; atualizar preços de uma vez

1. **Abrir as fotos de um produto** — `/app/products`  
   O número entre parênteses no botão "Fotos" diz quantas fotos o produto tem. Clique em "Fotos (2)" na linha do whey para ver as dele.
2. **A primeira foto é a capa**  
   As fotos abrem embaixo da linha. A primeira é a capa: é ela que aparece pequena na lista. Quando o atendente de IA apresenta um produto com foto, ele pode mandar as fotos junto, e elas vão nesta ordem. As setas mudam a foto de lugar e o "✕" remove a foto.
3. **Adicionar uma foto**  
   "Adicionar foto" abre o seu computador para você escolher a imagem. Vale foto JPG ou PNG de até 5 MB. Cada produto guarda no máximo 5 fotos; com 5, o botão fica apagado.
4. **Trazer os produtos de uma planilha** — `/app/products`  
   Se a clínica já tem os produtos numa planilha, não precisa cadastrar um por um. Clique em "Baixar planilha modelo" para ver as colunas que a tela entende: código, nome, marca, categoria, preço, custo e estoque. Só nome e preço são obrigatórios. A tela também reconhece nomes parecidos, como "SKU", "valor" ou "qtd". No Excel, use "Salvar como" e escolha "CSV UTF-8". Depois clique em "Importar planilha" e escolha o arquivo.
5. **Importar de novo atualiza**  
   O código liga cada linha da planilha a um produto. Importar de novo um código que já existe atualiza aquele produto, sem criar outro. Se a planilha não tem coluna de código, o nome faz esse papel. A importação não mexe na descrição, nas fotos nem em quem está desativado. Todo o resto do produto passa a ser o que está na planilha: coluna que falta ou célula vazia apaga a marca, a categoria e o custo, e sem a coluna de estoque o produto deixa de controlar estoque. Para corrigir só os preços, baixe a planilha completa, troque os preços e importe de volta com todas as colunas.
   > 💡 No fim, a tela mostra um resumo: quantos produtos entraram, quantos foram atualizados e quais linhas não entraram, com o motivo.

---

<a id="m-importacoes"></a>

## Importações

**Tela:** `/app/imports`  
**Resumo:** Traz de uma planilha, de uma vez, as empresas, as pessoas que decidem nelas e os telefones de cada uma, e mostra linha por linha o que entrou e o que não entrou.

**Lições:** [Conhecendo a tela de Importações](#l-importacoes--importacoes-conhecendo-a-tela) · [Revisar um lote](#l-importacoes--importacoes-revisar-um-lote)

<a id="l-importacoes--importacoes-conhecendo-a-tela"></a>

### Conhecendo a tela de Importações

- **Objetivo:** Achar a tela, montar a planilha com as colunas certas e saber como enviá-la.
- **Papel mínimo:** Gerente
- **Busca no curso:** importar planilha; importar empresas; importar contatos de empresas; csv; excel; xlsx; subir lista de clientes; colunas da planilha

1. **Onde fica a tela** — `/app/crm`  
   Importações não aparece direto no menu lateral. No grupo "CRM" do menu, clique em "Ver tudo em CRM". Na parte "Preparar a venda" está o cartão "Importações". O caminho completo é: CRM › Ver tudo em CRM › Importações.
   > 💡 Só gerente ou administrador vê este cartão. Ele também depende do módulo "Empresas e pessoas (venda para empresas)", ligado por quem administra o servidor em Administração › Sistema › Módulos opcionais.
2. **Cada envio vira um lote** — `/app/imports`  
   Cada planilha enviada vira uma linha desta lista, chamada lote. Ela mostra o nome do arquivo, quantas linhas tinha e quantas deram certo ("Sucesso"), entraram com um conflito ("Conflitos") ou não entraram ("Falhas"). "completed" na coluna "Status" quer dizer que a planilha inteira já foi lida.
3. **Como montar a planilha**  
   Cada linha da planilha é uma pessoa de uma empresa, com um telefone. A primeira linha leva os nomes das colunas, e a tela reconhece estes: "empresa", "cnpj", "pessoa", "cargo", "telefone" e "email". Também valem "nome" ou "contato" (para a pessoa), "e-mail", "razão social", "nome fantasia", "celular" e "whatsapp". Coluna com outro nome é ignorada. Uma pessoa com dois telefones ocupa duas linhas, repetindo a empresa e o nome.
   > 💡 Não há uma etapa para escolher qual coluna é qual: a tela casa sozinha pelos nomes da primeira linha, sem ligar para maiúsculas. Se a sua coluna se chama "Fone do cliente", renomeie para "telefone" antes de enviar.
4. **Enviar o arquivo**  
   Clique no campo "Arquivo" e escolha a planilha no computador: vale CSV ou Excel (.xlsx), com até 2 MB e 2.000 linhas. Depois clique em "Importar". A tela lê tudo na hora, mostra um resumo como "Lote processado: 5 ok, 1 conflitos, 2 falhas." e o lote novo aparece no alto da lista.
   > 💡 Empresa com CNPJ válido é consultada sozinha nos dados públicos da Receita (pela BrasilAPI) logo depois da importação. A importação não cria negócio no funil: ela só cadastra empresas, pessoas e telefones.

<a id="l-importacoes--importacoes-revisar-um-lote"></a>

### Revisar um lote

- **Objetivo:** Abrir um lote, entender cada linha que deu certo, que entrou com conflito e que falhou, e saber como corrigir.
- **Papel mínimo:** Gerente
- **Busca no curso:** conflito na importação; linha com erro; telefone já vinculado a outra pessoa; cnpj inválido; telefone inválido; corrigir importação; importar de novo

1. **Abrir o lote** — `/app/imports`  
   Clique no nome do arquivo para ver o que aconteceu com cada linha da planilha.
2. **Linha por linha** — `/app/imports/f1a05001-0000-4000-8000-000000000001`  
   O número de cada linha é o mesmo da planilha: a linha 1 é a dos nomes das colunas, então os dados começam na 2. "success" é linha que entrou inteira. "conflict" entrou em parte, e "failed" não entrou. A coluna "Erro" diz o porquê. As três últimas colunas mostram o começo do código da empresa, da pessoa e do contato que a linha criou ou encontrou.
3. **Ver só os conflitos**  
   Marque "Só conflitos" para a lista ficar só com as linhas que pedem uma decisão sua. Aqui, o Paulo da Rota Sul veio com o mesmo telefone do Marcos, da construtora. A pessoa e a empresa entraram, mas o telefone continua do Marcos: a importação nunca troca o dono de um número. Confira em Contatos de quem é o número e corrija a planilha, se foi erro de digitação.
4. **Corrigir as falhas**  
   Desmarque "Só conflitos" para ver tudo de novo. "CNPJ inválido." é um CNPJ digitado errado: os números não fecham. "Telefone inválido." é um número curto demais ou sem DDD. Corrija essas linhas na planilha e envie um arquivo só com elas.
   > 💡 Não mande a planilha inteira de novo: a empresa com o mesmo CNPJ é reaproveitada, mas cada pessoa é criada outra vez, e o telefone dela vira conflito, porque já tem dono.

---

<a id="m-propostas-do-crm"></a>

## Propostas do dia a dia

**Tela:** `/app/proposals`  
**Resumo:** Onde a equipe cria, revisa e envia as propostas para os pacientes, confere os rascunhos que a IA preparou e registra se o paciente aceitou ou recusou.

**Lições:** [Conhecendo a lista de propostas](#l-propostas-do-crm--propostas-do-crm-conhecendo-a-lista) · [Criar uma proposta](#l-propostas-do-crm--propostas-do-crm-criar) · [Revisar, enviar e acompanhar](#l-propostas-do-crm--propostas-do-crm-revisar-e-acompanhar)

<a id="l-propostas-do-crm--propostas-do-crm-conhecendo-a-lista"></a>

### Conhecendo a lista de propostas

- **Objetivo:** Saber onde ficam as propostas da clínica e ler, em cada linha, o número, a situação e o valor.
- **Papel mínimo:** Atendente
- **Busca no curso:** propostas; lista de propostas; orçamento para o paciente; proposta comercial; aguardando revisão; proposta que a ia fez; proposta aceita; proposta recusada

1. **Onde fica a tela** — `/app/crm`  
   Propostas não aparece direto no menu lateral. No grupo "CRM" do menu, clique em "Ver tudo em CRM". Na parte "Fechar a venda" está o cartão "Propostas". O caminho completo é: CRM › Ver tudo em CRM › Propostas.
   > 💡 O cartão só aparece depois que a clínica liga as propostas em Configurações › Propostas. Isso é ensinado no módulo "Propostas", das Configurações.
2. **Primeiro o que espera por você** — `/app/proposals`  
   Cada linha é uma proposta para um paciente. As que a IA preparou sozinha durante o atendimento vêm primeiro, com o selo "Aguardando revisão": ninguém da equipe olhou ainda, e nada foi enviado ao paciente. Depois vêm as outras, da mais nova para a mais antiga. Clique no título para abrir a proposta.
3. **Número, situação e valor**  
   Em "Número", o rascunho aparece só como "Rascunho". A proposta ganha número quando é enviada, como "0007/2026 v1": o número, o ano e a versão. Em "Status" você vê em que pé ela está: "Enviada" espera a resposta do paciente, "Aceita" e "Recusada" já foram respondidas. "Valor" é o total da proposta.
   > 💡 A versão muda quando alguém revisa uma proposta já enviada: nasce uma "v2" com o mesmo número, e a anterior fica guardada como "Substituída".

<a id="l-propostas-do-crm--propostas-do-crm-criar"></a>

### Criar uma proposta

- **Objetivo:** Começar uma proposta nova a partir de um negócio do funil, com título, validade e condições.
- **Papel mínimo:** Atendente
- **Busca no curso:** nova proposta; criar proposta; fazer orçamento; proposta para um negócio; validade da proposta; nenhum negócio elegível

1. **O botão Nova proposta** — `/app/proposals`  
   Para começar uma proposta, clique em "Nova proposta", no alto da tela.
   > 💡 Quem só tem permissão de leitura vê a lista, mas o botão não aparece para ele.
2. **Escolher o negócio**  
   Toda proposta nasce de um negócio do funil que tenha um paciente ligado a ele. Em "Negócio (Lead)", a lista mostra cada negócio assim: o nome do negócio e, depois do traço, o paciente. A proposta fica guardada nesse negócio e vai para esse paciente. Se a lista estiver vazia, a tela avisa "Nenhum negócio elegível encontrado": antes, crie o negócio do paciente no funil.
3. **O título**  
   Escolhido o negócio da Fernanda, escreva em "Título da proposta" um nome que o paciente entenda. O título aparece para ele e na lista de propostas da clínica.
4. **Validade e condições**  
   "Validade da proposta" já vem com 15 dias a partir de hoje: é até quando o preço e as condições valem. Mude a data se quiser outro prazo. Em "Condições de pagamento / Observações", escreva como o paciente pode pagar e qualquer aviso importante. Este campo é opcional.
5. **Criar o rascunho**  
   Clique em "Criar e abrir editor". A proposta nasce como rascunho, sem nada enviado ao paciente, e o editor abre em seguida: é lá que você coloca os itens, os valores e o modelo do documento. Para desistir, clique em "Cancelar".
   > 💡 Cada negócio só pode ter um rascunho aberto de cada vez. Se o negócio já tiver um, abra o que existe na lista em vez de criar outro.

<a id="l-propostas-do-crm--propostas-do-crm-revisar-e-acompanhar"></a>

### Revisar, enviar e acompanhar

- **Objetivo:** Revisar o rascunho que a IA preparou, entender o que falta para enviar e registrar a resposta do paciente.
- **Papel mínimo:** Atendente
- **Busca no curso:** revisar proposta da ia; confirmar modelo da proposta; enviar proposta ao cliente; enviar proposta pelo whatsapp; itens da proposta; marcar proposta como aceita; paciente recusou a proposta; revisar proposta enviada

1. **O modelo sugerido pela IA** — `/app/proposals/f1b00002-0000-4000-8000-000000000001`  
   Este é o rascunho que a IA preparou para a Mariana. No alto fica o título, que você pode mudar. Logo abaixo, o documento que o paciente vai receber depende de um modelo: a IA sugeriu um, mas quem decide é você. Clique em "Usar este modelo" para aceitar a sugestão, ou escolha outro na lista "Ou escolha outro modelo".
   > 💡 Os modelos da clínica são criados e ajustados em Configurações › Modelos de proposta.
2. **Os itens e o total**  
   Na tabela ficam os itens: a descrição, a quantidade ("Qtd"), o preço de cada um, o desconto e o subtotal. Aqui a IA colocou três consultas com a nutricionista. "+ Item à mão" acrescenta uma linha para você preencher. Em "Buscar produto no catálogo…" você procura um produto já cadastrado, que entra com o preço do catálogo. Item sem preço aparece como "A definir". O total, embaixo, soma tudo.
3. **Salvar e enviar**  
   Mudou alguma coisa? Clique em "Salvar", no fim da página. "Enviar ao cliente" manda a proposta pelo WhatsApp, na conversa do paciente. Ele fica apagado enquanto o modelo não for confirmado, e a tela avisa: "Escolha e confirme o modelo da proposta antes de enviar.". "Ver como o cliente recebe" mostra o documento como o paciente vai ver, sem enviar nada.
   > 💡 Enviar e descartar um rascunho são tarefas de gerente ou administrador: os botões aparecem para todos, mas para quem atende o sistema recusa com um aviso de permissão. No quadro "Assistente", você escreve o que quer mudar e clica em "Gerar": a IA sugere as mudanças e você escolhe se aplica. Ele usa a IA e gasta crédito do provedor.
4. **Registrar a resposta do paciente** — `/app/proposals/f1b00002-0000-4000-8000-000000000002`  
   Depois de enviada, a proposta não muda mais: os campos ficam travados. Quando o paciente responder, registre aqui. "Marcar como aceita" e "Marcar como recusada" guardam a resposta. Na recusa, o sistema pergunta o motivo, que é opcional. Se o paciente pedir uma mudança, "Revisar esta proposta" cria uma versão nova para você editar e enviar de novo.

---

<a id="m-comandas"></a>

## Comandas

**Tela:** `/app/comandas`  
**Resumo:** O balcão da clínica: cada comanda junta o que foi feito no atendimento, quanto o paciente paga e como pagou.

**Lições:** [Conhecendo o balcão](#l-comandas--comandas-conhecendo-o-balcao) · [Lançar itens e fechar a comanda](#l-comandas--comandas-lancar-e-fechar) · [Cobrar os atendimentos que ficaram sem comanda](#l-comandas--comandas-atendimentos-sem-comanda)

<a id="l-comandas--comandas-conhecendo-o-balcao"></a>

### Conhecendo o balcão

- **Objetivo:** Saber onde ficam as comandas, ler a lista e abrir uma comanda para ver o que foi cobrado.
- **Papel mínimo:** Atendente
- **Busca no curso:** comanda; comandas; balcão; conta do paciente; o que o paciente pagou; comanda finalizada; comanda cancelada

1. **Onde fica a tela** — `/app/crm`  
   Comandas não aparece direto no menu lateral. No grupo "CRM" do menu, clique em "Ver tudo em CRM". Na parte "O dia a dia da venda" está o cartão "Comandas". O caminho completo é: CRM › Ver tudo em CRM › Comandas.
   > 💡 O cartão só aparece se quem administra o servidor instalou o módulo "Comandas" (Admin › Módulos). Quem só tem permissão de leitura abre a tela para conferir, mas não lança nada.
2. **A lista do balcão** — `/app/comandas`  
   À esquerda fica a lista de comandas, a mais nova em cima. Cada linha mostra o número, a situação e o valor. "Aberta" ainda está recebendo itens. "Finalizada" já foi paga. "Cancelada" foi desfeita antes de ser paga. À direita aparece a comanda que você escolher na lista. Para começar uma comanda do zero, use "Nova comanda".
3. **Por dentro de uma comanda**  
   Clique numa comanda para abri-la. No alto vêm o número e a situação. Embaixo, cada linha é um item cobrado, com o valor, e no fim vem o total. Esta já foi finalizada: ninguém muda mais os itens, e o dinheiro já entrou na conta da forma de pagamento escolhida.
   > 💡 Se uma comanda finalizada saiu errada, um gerente ou administrador a estorna: aparece para ele o campo "Motivo do estorno" e o botão "Estornar". O motivo é obrigatório.

<a id="l-comandas--comandas-lancar-e-fechar"></a>

### Lançar itens e fechar a comanda

- **Objetivo:** Acrescentar um serviço a uma comanda aberta, conferir o total e fechar com a forma de pagamento.
- **Papel mínimo:** Atendente
- **Busca no curso:** lançar na comanda; incluir item na comanda; fechar comanda; finalizar comanda; forma de pagamento; cancelar comanda; forma de pagamento sem conta de destino

1. **Abrir a comanda do atendimento** — `/app/comandas`  
   A comanda #43 está aberta: o paciente fez a sessão de fisioterapia e ainda está no balcão. Clique nela para abrir.
2. **O que já foi lançado**  
   A comanda mostra o que já foi lançado e o total até agora. Como ela ainda está aberta, aparecem embaixo os campos para lançar mais um item. Em "Serviço", escolha um serviço da clínica, ou deixe "Avulso" para lançar algo que não é um serviço cadastrado, como um produto vendido no balcão.
3. **Lançar um serviço**  
   Escolhendo "Aula de pilates", a "Descrição" e o "Valor" se preenchem sozinhos com o nome e o preço do serviço. Os dois podem ser mudados antes de incluir, por exemplo para dar um desconto. Com "Avulso", você escreve os dois. Depois, clique em "Incluir".
4. **O total muda na hora**  
   A aula de pilates entrou na lista e o total já soma os dois itens. Lançou errado? Enquanto a comanda estiver aberta, o "×" no fim da linha tira o item.
5. **Fechar a comanda**  
   Na hora de pagar, escolha em "Forma de pagamento" como o paciente pagou e clique em "Finalizar". O dinheiro entra na conta ligada a essa forma (o Pix cai na conta do banco) e a comanda não muda mais. Se a forma escolhida ainda não tiver conta, aparece em vermelho: "Esta forma de pagamento ainda não tem conta de destino. Defina em Configurações › Financeiro.", e a comanda não fecha até você definir.
   > 💡 "Cancelar comanda" desfaz uma comanda aberta que não vai ser paga, por exemplo uma lançada em dobro. Atenção: vale na hora, sem pergunta de confirmação.

<a id="l-comandas--comandas-atendimentos-sem-comanda"></a>

### Cobrar os atendimentos que ficaram sem comanda

- **Objetivo:** Conferir os atendimentos da agenda que já aconteceram e ninguém cobrou, e faturar vários de uma vez.
- **Papel mínimo:** Atendente
- **Busca no curso:** atendimentos sem comanda; faturar atendimentos; faturar em lote; esqueceram de cobrar; sem preço no serviço; cobrar sessões da agenda

1. **O que ninguém cobrou** — `/app/comandas`  
   Embaixo da lista fica "Atendimentos sem comanda": os atendimentos da agenda dos últimos 30 dias que já aconteceram, não foram cancelados nem tiveram falta, e ainda não viraram comanda. Nada vem marcado: você confere e marca o que vai cobrar. O atendimento de um serviço sem preço aparece com o aviso "sem preço no serviço" e não pode ser marcado. Abra uma comanda à mão para ele, ou ponha o preço no serviço em Configurações › Tipos de agendamento.
2. **Faturar de uma vez**  
   Marque os atendimentos que vai cobrar e escolha a forma de pagamento. O botão "Faturar" mostra a soma do que está marcado. Ao clicar, o sistema abre e fecha uma comanda para cada atendimento, com o preço do serviço. Confira antes: não dá para desfazer tudo de uma vez. Cada comanda errada precisa ser estornada, uma por uma, por um gerente.

---

<a id="m-etapas-do-funil"></a>

## Etapas do funil

**Tela:** `/app/settings/tenant/pipelines`  
**Resumo:** Onde você monta as colunas de cada funil, do primeiro contato até a venda ou a desistência, e decide os motivos de perda.

**Lições:** [Conhecendo a tela de Etapas do funil](#l-etapas-do-funil--etapas-do-funil-conhecendo) · [Renomear, criar e reordenar etapas](#l-etapas-do-funil--etapas-do-funil-criar-e-organizar) · [Mudar o papel de uma coluna e arquivar uma etapa](#l-etapas-do-funil--etapas-do-funil-papel-e-arquivar) · [Cadastrar os motivos de perda](#l-etapas-do-funil--etapas-do-funil-motivos-de-perda)

<a id="l-etapas-do-funil--etapas-do-funil-conhecendo"></a>

### Conhecendo a tela de Etapas do funil

- **Objetivo:** Achar a tela, entender o que é cada coluna do funil e reconhecer os ajustes de cada etapa.
- **Papel mínimo:** Administrador
- **Busca no curso:** etapas do funil; colunas do funil; configurar funil; etapas do quadro; chance de fechamento; esfriando; onde mudo as etapas

1. **Onde fica a tela** — `/app/crm`  
   Etapas do funil é onde você monta as colunas de cada funil, ou seja, os passos que o cliente percorre até fechar com você. Ela não aparece direto no menu. No grupo "CRM" do menu, clique em "Ver tudo em CRM". Na parte "Preparar a venda" está o cartão "Etapas do funil". O caminho completo é: CRM › Ver tudo em CRM › Etapas do funil.
   > 💡 Só gerente ou administrador vê este cartão. Para um atendente, ele não aparece, e o endereço da tela leva a uma página de acesso negado.
2. **Um cartão para cada funil** — `/app/settings/tenant/pipelines`  
   Um funil é o caminho que o cliente faz até fechar, dividido em etapas. Cada etapa vira uma coluna no quadro do funil. Esta tela mostra um cartão para cada funil ativo da empresa. A Clínica Bem Viver tem dois: "Pacientes", aqui no alto, e "Pilates", que aparece quando você rola a tela. Nas próximas lições você mexe no "Pilates", para não mudar o funil principal.
   > 💡 Funil arquivado não aparece aqui. Para criar ou arquivar um funil inteiro, use a tela Funis, no menu CRM.
3. **Cada linha é uma coluna do quadro**  
   Em "Etapas deste funil", cada linha é uma coluna do quadro, na ordem em que o cliente avança: a linha 1 é a primeira coluna, à esquerda. Em cada linha você vê o nome da coluna, a chance de fechamento, as setas de ordem, o papel da coluna e o botão "Arquivar".
4. **A coluna de fechamento e a de perda**  
   Duas colunas têm papel especial. A de fechamento, marcada "Aqui o cliente fecha", é onde o negócio vira venda: no Pilates, "Matrícula feita". A de perda, "Aqui o cliente desiste", é onde ele se perde: "Não seguiu". O negócio que chega nelas é dado como ganho ou como perdido. Todo funil precisa de uma de cada. As outras colunas ficam em "Nada especial".
5. **A chance de fechamento**  
   "Chance de fechamento" é um número de 0 a 100: de cada 100 negócios nesta coluna, quantos costumam fechar. A tela Desempenho usa esse número no quadro "Previsão", que estima quanto deve entrar. Embaixo do campo, o sistema conta o que já aconteceu no último ano: 13 negócios encerrados passaram por "Aula experimental marcada" e 8 foram ganhos (62%). Com 10 casos ou mais aparece o botão "Usar 62%?", que grava o número para você. Com menos, a tela avisa "Poucos casos para sugerir".
   > 💡 Nas colunas de fechamento e de perda o campo fica travado: elas valem 100 e 0. A frase "nesta etapa agora" mostra quantos negócios estão na coluna hoje e, pela mediana, há quantas horas eles entraram nela.
6. **Esfriando e aviso para a equipe**  
   Embaixo de cada etapa ficam mais dois ajustes. "Janela de esfriando" é quanto tempo um negócio pode ficar parado na coluna, sem conversa nem mudança, antes de aparecer como esfriando no quadro e no Radar. Vazio vale 24 horas; em "Aula experimental feita" são 2 dias. Com a chave "Avisar a equipe na Central" ligada, todo negócio que entra na coluna abre um aviso na Central de avisos, o sino do alto da tela.
   > 💡 Os dois ajustes são gravados quando você sai do campo ou clica na chave. Não há botão de salvar.
7. **Para onde o agente leva o cartão**  
   Mais abaixo, "Para onde o card vai em cada passo" liga o agente de IA às suas colunas. Cada linha é um momento do atendimento, como "Em negociação" ou "Ganho". Quando o agente chega nesse momento, o cartão do cliente anda sozinho para a etapa escolhida. "Não mover o card" também vale: o cartão fica onde está. Depois de mudar, clique em "Salvar estas escolhas".
   > 💡 Na lista de etapas, a frase "O assistente usa esta etapa para…" mostra o mesmo vínculo, e "Mudar isso" desce até aqui.

<a id="l-etapas-do-funil--etapas-do-funil-criar-e-organizar"></a>

### Renomear, criar e reordenar etapas

- **Objetivo:** Trocar o nome de uma coluna, acrescentar uma etapa nova e colocá-la no lugar certo do funil.
- **Papel mínimo:** Administrador
- **Busca no curso:** renomear etapa; criar etapa; nova coluna no funil; mudar ordem das etapas; acrescentar etapa; trocar nome da coluna

1. **Trocar o nome de uma coluna** — `/app/settings/tenant/pipelines`  
   O funil Pilates começa com uma coluna chamada "Novo". Para trocar o nome, clique no nome, apague e escreva o novo. Aqui escrevemos "Pediu informação".
2. **Gravar o nome**  
   Aperte Enter ou clique fora do campo: o nome é gravado na hora, sem botão de salvar. Se mudar de ideia antes disso, aperte Esc e o nome antigo volta. O nome novo vale em todo lugar: no quadro do funil e também aqui embaixo, em "Para onde o card vai em cada passo", onde "Novo lead" já aponta para "Pediu informação".
   > 💡 Duas colunas do mesmo funil não podem ter o mesmo nome. Se tentar, a tela avisa e não grava.
3. **Acrescentar uma etapa**  
   A clínica quer uma coluna para quem já escolheu o plano, mas ainda não pagou. No fim da lista de etapas do Pilates, clique em "Acrescentar etapa ao fim".
4. **O nome da etapa nova**  
   Escreva o nome da coluna, aqui "Aguardando pagamento", e clique em "Criar" (ou aperte Enter). "Cancelar" fecha sem criar nada.
5. **A etapa entra no fim**  
   A etapa nova sempre entra no fim do funil, depois até da coluna de perda. Para levá-la para o lugar certo, use a seta para cima: cada clique sobe a etapa uma posição, ou seja, uma coluna para a esquerda no quadro.
6. **No lugar certo**  
   Com dois cliques na seta para cima, "Aguardando pagamento" ficou entre "Aula experimental feita" e "Matrícula feita". É nessa posição que a coluna aparece no quadro do funil. A seta para baixo faz o caminho contrário.

<a id="l-etapas-do-funil--etapas-do-funil-papel-e-arquivar"></a>

### Mudar o papel de uma coluna e arquivar uma etapa

- **Objetivo:** Entender como a coluna de fechamento muda de lugar e tirar do funil uma etapa que não serve mais, sem perder os negócios dela.
- **Papel mínimo:** Administrador
- **Busca no curso:** arquivar etapa; apagar coluna do funil; excluir etapa; etapa de ganho; etapa de perda; mudar etapa de fechamento

1. **Escolher o papel da coluna** — `/app/settings/tenant/pipelines`  
   O seletor "O que acontece nesta coluna" tem três escolhas: "Nada especial", "Aqui o cliente fecha" (a coluna de fechamento) e "Aqui o cliente desiste" (a coluna de perda). Veja o que acontece quando você abre o seletor de "Aula experimental feita" e escolhe "Aqui o cliente fecha".
2. **A marcação muda de lugar**  
   Só uma coluna pode ser a de fechamento. Por isso a tela pede confirmação e diz qual coluna perde a marcação: aqui, "Matrícula feita". "Marcar mesmo assim" muda a marcação de lugar. Na clínica, quem fecha a venda é a matrícula, então clique em "Cancelar" e nada muda.
   > 💡 Para tirar a marcação de uma coluna, marque outra no lugar: o funil nunca fica sem coluna de fechamento nem sem coluna de perda. Se a coluna for usada pelo agente de IA para outro passo, a tela recusa e mostra o caminho para mudar o agente antes.
3. **Arquivar uma etapa**  
   A clínica não usa mais a coluna "Lista de espera". Arquivar é o jeito de tirar uma etapa do funil. Clique em "Arquivar" na linha dela. A tela explica antes: a coluna sai do quadro e para de receber negócios novos, nada é apagado, mas não dá para trazer a coluna de volta por esta tela.
   > 💡 A coluna de fechamento e a de perda não podem ser arquivadas: marque outra coluna no lugar antes.
4. **Para onde vão os negócios**  
   Quando a coluna tem negócios, a tela pergunta para onde eles vão. Aqui são 2 alunos na lista de espera. Clique em "Escolha a etapa" e escolha "Novo". A lista só oferece colunas comuns: a de fechamento e a de perda ficam de fora, porque mandar os negócios para lá os daria como ganhos ou perdidos.
5. **Mover e arquivar**  
   O botão "Mover os negócios e arquivar" fica apagado até você escolher o destino. Depois de escolher, clique nele: os negócios mudam de coluna primeiro, e só depois a etapa sai do funil.
6. **A etapa saiu do funil**  
   "Lista de espera" sumiu da lista e do quadro, e os 2 negócios dela foram para "Novo". A mudança fica registrada no histórico de cada negócio. A conta de negócios que aparece embaixo de cada etapa só se atualiza quando você recarrega a página.

<a id="l-etapas-do-funil--etapas-do-funil-motivos-de-perda"></a>

### Cadastrar os motivos de perda

- **Objetivo:** Trocar a lista pronta de motivos de perda pelos motivos da sua clínica, com uma categoria para cada um.
- **Papel mínimo:** Administrador
- **Busca no curso:** motivos de perda; por que perdi o cliente; cadastrar motivo de perda; categoria de perda; vocabulário do funil; marcar como perdido; campos do negócio

1. **Abrir o editor do funil** — `/app/settings/tenant/pipelines`  
   No fim do cartão de cada funil fica o botão "Editar vocabulário e campos deste funil". Ele abre os ajustes do funil que só o administrador muda, como os motivos de perda. Clique nele no cartão do Pilates.
   > 💡 O gerente também entra nesta tela, mas não vê este botão.
2. **Escrever os motivos**  
   Motivo de perda é a resposta para "por que este negócio não fechou?". Sem nada cadastrado, a janela "Marcar como perdido" mostra uma lista pronta, com motivos de loja como "Produto indisponível". Em "Motivos de perda (separados por vírgula)", escreva os motivos da sua clínica, separados por vírgula. Para cada motivo escrito aparece uma linha com o seletor de categoria.
   > 💡 Os quatro campos do alto ("Lead", "Deal", "Won" e "Lost") guardam como este funil chama o cliente, o negócio, o ganho e a perda.
3. **A categoria e salvar**  
   Ao lado de cada motivo, escolha a categoria: "Cliente", "Concorrência", "Mérito", "Nós" ou "Ausência". Ela junta motivos parecidos no relatório "Perdas" da tela Desempenho e no filtro "Categoria" que o quadro mostra quando você filtra os perdidos. Pense em quem fez o negócio se perder: "Achou caro" vai em "Nós", porque quem define o preço é a clínica; "Preferiu outro estúdio" vai em "Concorrência". "Sem categoria" também vale. Depois clique em "Salvar vocabulário e campos", no fim do editor: nada do editor vale antes disso.
   > 💡 O relatório "Perdas" aparece para gerente e administrador. O mesmo editor guarda outros ajustes do funil, como os motivos de ganho e os campos extras do negócio.
4. **Os seus motivos na hora de perder**  
   Depois de salvar, abra o quadro do Pilates (menu "Funis" › "Pilates"), passe o mouse num cartão, clique nos três pontinhos e em "Marcar como perdido". A janela agora mostra os motivos da clínica no lugar da lista pronta, mais "Outro motivo" para o caso que não está na lista.
   > 💡 Os motivos valem só para este funil. Cada funil tem a sua lista.
