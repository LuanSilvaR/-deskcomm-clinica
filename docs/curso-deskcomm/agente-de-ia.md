# Curso DeskComm — Agente de IA

> Gerado a partir do [curso oficial do DeskComm](https://www.deskcomm.com.br/curso) — versão 1.94.0, gerado em 2026-10-29. Conteúdo do **núcleo do DeskcommCRM (upstream)**; o que o fork de clínicas acrescenta está em [`docs/funcionalidades.md`](../funcionalidades.md). As capturas de tela de cada passo ficam no curso online.

[← Índice do curso](README.md)

## Módulos deste grupo

| Módulo | Tela | Lições | Para que serve |
|---|---|---|---|
| [Agentes](#m-agentes) | `/app/ai/agents` | 7 | Quem atende por você: instruções, modelo, ferramentas e publicação. |
| [Follow-ups](#m-follow-ups) | `/app/ai/followups` | 7 | Como o agente retoma uma conversa que esfriou, para nenhuma morrer no silêncio. |
| [Fluxos de atendimento](#m-fluxos-de-atendimento) | `/app/ai/atendimento` | 3 | Perguntas que a IA conduz durante a conversa, com as respostas guardadas na ficha do cliente. |
| [Roteadores](#m-roteadores) | `/app/ai/routers` | 4 | Qual agente pega qual conversa, e quando o humano assume. |
| [Credenciais](#m-credenciais) | `/app/ai/credentials` | 4 | A chave do provedor de IA que os agentes usam para pensar. |
| [Provedores](#m-provedores) | `/app/ai/providers` | 3 | Ligue o Jev para decisões rápidas e escolha qual inteligência atende cada parte do sistema. |
| [Conhecimento](#m-conhecimento) | `/app/ai/knowledge/sources` | 4 | Os materiais que o agente consulta antes de responder sobre o seu negócio. |
| [Memória](#m-memoria) | `/app/ai/memory` | 4 | O que o agente já aprendeu sobre a sua operação e reaproveita. |
| [Skills](#m-skills) | `/app/ai/skills` | 4 | As ações que o agente pode executar sozinho durante o atendimento. |
| [Casos](#m-casos) | `/app/ai/cases` | 6 | Os atendimentos que o agente conduziu, do início ao desfecho. |
| [Alertas](#m-alertas-da-ia) | `/app/ai/inbox` | 3 | O que a IA encontrou e precisa de uma decisão sua. |
| [Aviso no WhatsApp](#m-aviso-no-whatsapp) | `/app/ai/cases/avisos` | 3 | Receber no WhatsApp quando o assistente abrir um caso. |
| [Propostas da IA](#m-propostas-da-ia) | `/app/ai/proposals` | 2 | Melhorias que a IA sugere para si mesma, esperando sua decisão. |
| [Execuções](#m-execucoes) | `/app/ai/runs` | 2 | O que a IA fez — e, quando falhou, o que aconteceu e o que fazer. |
| [Uso e orçamento](#m-uso-e-orcamento) | `/app/ai/usage` | 3 | Quanto a IA consumiu e qual é o teto de gasto do mês. |

---

<a id="m-agentes"></a>

## Agentes

**Tela:** `/app/ai/agents`  
**Resumo:** Onde você monta os atendentes virtuais que respondem seus clientes no WhatsApp: as instruções, o que eles podem fazer, o material que consultam e a hora de entrar no ar.

**Lições:** [Conhecendo a tela de Agentes](#l-agentes--conhecendo-os-agentes) · [O menu de ações do cartão](#l-agentes--menu-do-cartao) · [Por dentro de um agente](#l-agentes--abrindo-um-agente) · [Nome, inteligência, número e limites](#l-agentes--identidade-e-inteligencia) · [Instruções, capacidades e conhecimento](#l-agentes--instrucoes-e-capacidades) · [Quando ele responde e quando chama a equipe](#l-agentes--quando-responder-e-passar) · [Os bastidores: organizar, conferir, testar e acompanhar](#l-agentes--bastidores-e-abas)

<a id="l-agentes--conhecendo-os-agentes"></a>

### Conhecendo a tela de Agentes

- **Objetivo:** Reconhecer o cartão de cada agente, entender o que dizem os selos e achar um agente pela busca.
- **Papel mínimo:** Administrador
- **Busca no curso:** agentes; agente de ia; robô; atendente virtual; lista de agentes; publicado; rascunho; buscar agente; criar agente

1. **Um cartão para cada agente** — `/app/ai/agents`  
   A tela Agentes, no grupo "Agente de IA" do menu, reúne os atendentes virtuais que respondem seus clientes no WhatsApp. Cada agente aparece num cartão. Nesta clínica de exemplo existe um só: a Bia, que faz a recepção. Para montar outro agente, clique em "Criar novo".
   > 💡 Só o administrador vê "Criar novo" e o menu de ações do cartão. O gerente entra na tela, mas só consegue olhar: o botão do cartão vira "Visualizar".
2. **O que o cartão mostra**  
   O selo "Publicado" quer dizer que o agente está no ar: as mensagens novas do WhatsApp vão para ele. Quando aparece "Rascunho", ele não está atendendo, porque ainda não foi publicado ou foi pausado. O selo "default" marca o agente padrão da empresa. Abaixo do nome aparecem a empresa de inteligência artificial e o modelo que estão valendo. Em "Prioridade" fica a ordem de preferência, que só importa quando há mais de um agente. Em "Tipo" aparece um código interno do sistema: é só informativo, você não precisa mexer.
3. **Achar um agente**  
   Quando a lista crescer, digite parte do nome no campo de busca. Se nenhum agente tiver aquele nome, aparece o aviso "Nenhum agente corresponde aos filtros atuais.". Na caixa "Todos", ao lado, escolha "Publicado" para ver só os que estão no ar. Os agentes arquivados ficam escondidos: marque "Incluir arquivados" para vê-los.
4. **Abrir um agente**  
   Apague o que digitou na busca e o cartão da Bia volta. Para abrir a configuração de um agente, clique em "Editar" no cartão dele.

<a id="l-agentes--menu-do-cartao"></a>

### O menu de ações do cartão

- **Objetivo:** Saber o que fazem Duplicar, Renomear, Pausar e Arquivar, e trocar o nome de um agente.
- **Papel mínimo:** Administrador
- **Busca no curso:** duplicar agente; copiar agente; renomear agente; trocar nome; pausar agente; despausar; arquivar agente; desligar robô

1. **Editar, duplicar e renomear** — `/app/ai/agents`  
   O botão de três pontinhos, no canto do cartão, abre o menu de ações. "Editar" abre a configuração, igual ao botão do cartão. "Duplicar" cria uma cópia do agente com as mesmas instruções e ajustes, como rascunho: a cópia não entra no ar sozinha. "Renomear" troca só o nome.
2. **Pausar e arquivar**  
   "Pausar" faz o agente parar de responder os clientes, sem perder nada do que foi configurado. Depois disso, o item vira "Despausar", que põe o agente de volta no ar. "Arquivar" tira o agente do ar e da lista, e não dá para desarquivar pela tela. Aqui ele aparece apagado porque a Bia é o agente padrão, e o agente padrão não pode ser arquivado.
   > 💡 Pausar pelo menu é o mesmo que o botão "Pausar automático" dentro da página do agente.
3. **Trocar o nome**  
   Em "Renomear", digite o novo nome e clique em "Salvar". Só o nome muda: as versões publicadas e o histórico continuam iguais. Para desistir, clique em "Cancelar".

<a id="l-agentes--abrindo-um-agente"></a>

### Por dentro de um agente

- **Objetivo:** Entender o topo da página do agente: o modo de operação, as abas, o selo da versão no ar e as três partes da configuração.
- **Papel mínimo:** Administrador
- **Busca no curso:** configurar agente; modo assistido; modo automático; pausar automático; retomar automático; versão publicada; rascunho; publicar agente

1. **Automático ou assistido** — `/app/ai/agents`  
   No alto da página do agente fica a "Operação do agente". No modo automático, ele responde sozinho, seguindo as regras que você configurou. No modo assistido, ele só prepara sugestões dentro da conversa, e nada é enviado sem a aprovação de uma pessoa. O botão "Pausar automático" para na hora as respostas que ele manda sozinho: a configuração fica guardada, as sugestões do modo assistido continuam e o botão vira "Retomar automático".
   > 💡 A troca de modo e a pausa valem assim que você clica. Não precisa salvar.
2. **As abas do agente**  
   Logo abaixo ficam as abas do agente. Você começa em "Configuração", onde monta o agente. "Teste" mostra como ele responderia, sem mandar nada ao cliente. "Capacidades" conta o que ele usou, "Execuções" lista cada vez que ele trabalhou, "Histórico" guarda as versões e "Propostas" traz as melhorias que ele sugere. A última lição mostra o Teste, o Histórico, as Execuções e as Propostas.
3. **A versão no ar e os botões**  
   Ao lado do nome, o selo "Publicado v1" diz que a versão 1 é a que está atendendo. As instruções, a inteligência, o número e as regras de atendimento viram um rascunho: os clientes só veem essas mudanças depois que você publica. Nome, descrição e ordem de preferência mudam assim que você salva o rascunho. Enquanto não há nada para salvar, os botões ficam apagados, e a frase embaixo diz o que falta para publicar.
4. **As três partes da configuração**  
   A configuração tem três partes. "Conversa com o cliente" é como ele atende. "Organiza o sistema" é o que ele registra por dentro depois da conversa. "Confere antes de enviar" mostra as verificações de cada mensagem. As duas primeiras partes formam um rascunho só, salvo pelo mesmo botão. As escolhas da terceira valem na hora, para a empresa toda.

<a id="l-agentes--identidade-e-inteligencia"></a>

### Nome, inteligência, número e limites

- **Objetivo:** Preencher quem é o agente, entender a escolha da inteligência artificial e da chave, ligar o número de WhatsApp e conhecer os limites de cada atendimento.
- **Papel mínimo:** Administrador
- **Busca no curso:** nome do agente; chave de acesso; credencial; anthropic; modelo de ia; número do whatsapp; limite de custo; esperar antes de responder

1. **Quem é este agente** — `/app/ai/agents`  
   Na parte "Conversa com o cliente", o primeiro bloco é "Quem é este agente". O "Nome" é o que aparece na lista de agentes, e a "Descrição" é uma anotação sua sobre o que ele faz. A "Ordem de preferência" só importa quando mais de um agente pode atender a mesma conversa: o de número maior tenta primeiro. Com um agente só, deixe como está. Atenção: estes três campos valem assim que você salva o rascunho, sem precisar publicar.
2. **A inteligência e a chave**  
   Em "A inteligência que ele usa" você escolhe a empresa de inteligência artificial, o modelo e a "Chave de acesso", que é o código da sua conta nessa empresa. Nesta instalação de exemplo nenhuma chave foi cadastrada. Por isso aparecem o aviso em vermelho e o link "Cadastrar credencial anthropic", que leva à tela onde você cola a chave. Sem chave, o agente não consegue salvar mudanças.
   > 💡 Se a chave foi colocada durante a instalação do sistema, ela aparece na lista como "A chave desta instalação".
3. **Por qual número ele atende**  
   "Por qual número ele atende" liga o agente a um número de WhatsApp da empresa. Aqui está escolhido o "Recepção Bem Viver", que aparece como "Conectado". Sem um número escolhido, o rascunho até salva, mas o agente não pode ser publicado.
   > 💡 Se a empresa ainda não tiver nenhum número de WhatsApp, aparece o link "Conectar WhatsApp", que leva à tela de Conexões. Um número que caiu continua na lista com a situação ao lado, mas o agente só pode ser publicado com um número "Conectado".
4. **Freios de segurança**  
   Os "Freios de segurança" limitam cada atendimento. Em "Ações por atendimento" você define quantas ações o agente pode fazer numa resposta, e em "Mensagens anteriores que ele lê", quanto da conversa ele relê antes de responder. Em "Esperar antes de responder", as mensagens que o cliente manda em sequência, dentro desse tempo, viram uma resposta só. Deixando vazio, vale o padrão da instalação.

<a id="l-agentes--instrucoes-e-capacidades"></a>

### Instruções, capacidades e conhecimento

- **Objetivo:** Escrever as instruções do agente, entender como salvar e publicar, e escolher o que ele pode fazer e o material que ele consulta.
- **Papel mínimo:** Administrador
- **Busca no curso:** instruções do agente; prompt; salvar rascunho; publicar versão; descartar alterações; capacidades; o que o agente pode fazer; base de conhecimento; material da clínica

1. **As instruções dele** — `/app/ai/agents`  
   Em "As instruções dele" você escreve, com suas palavras, quem o agente é e como deve atender: o tom, o que ele pode responder e o que deve passar para a equipe. No canto, o número com barra, como "57/20.000", mostra quantos caracteres você já usou, de no máximo 20.000. O outro número, ao lado, é uma estimativa técnica e pode ser ignorado.
2. **Mudou? Salve e publique**  
   Assim que você muda algo, o botão "Descartar alterações" acende, para voltar ao que estava. Aqui "Salvar rascunho" continua apagado porque falta a chave de acesso da lição anterior. Com a chave, ele guarda a mudança como "Rascunho v2" e o botão de publicar vira "Publicar v2". Ao publicar, uma janela resume o que muda e pede confirmação. A versão anterior fica guardada no Histórico. Para desfazer a mudança, clique em "Descartar alterações".
3. **Respostas em mensagens curtas**  
   Em "Estilo de resposta", ligar "Responder em várias mensagens curtas" faz o agente mandar a resposta em várias bolhas, como uma pessoa digitando, em vez de um bloco único. Ligado, aparece o campo do tamanho máximo de cada bolha.
4. **O que o agente pode fazer**  
   "O que o agente pode fazer" define o que ele faz sozinho durante o atendimento. As capacidades vêm em pacotes por tarefa, como "Atender e responder" e "Vender e mover o funil": ligar um pacote liga as capacidades dele de uma vez. As que têm "Efeito que não dá para desfazer" ficam no quadro vermelho e só se ligam uma a uma. O contador mostra quantas estão ligadas. O limite é 27: acima disso o agente se confunde na hora de escolher o que usar, então ligue só os pacotes de que o seu negócio precisa.
   > 💡 "Escolher uma a uma (modo avançado)", no fim da lista, mostra todas as capacidades separadas.
5. **O que ele consulta antes de responder**  
   "O que ele consulta antes de responder" é o material da sua clínica que o agente pode ler, como perguntas frequentes, preços e preparo de exames. Ele procura ali antes de responder e cita de onde tirou. Nesta clínica ainda não há material, e o link leva à tela onde você cadastra. Sem material marcado, ele responde só com o que a inteligência artificial já sabe.

<a id="l-agentes--quando-responder-e-passar"></a>

### Quando ele responde e quando chama a equipe

- **Objetivo:** Definir quando o agente entra em ação, o horário de atendimento e as situações em que ele passa a conversa para uma pessoa.
- **Papel mínimo:** Administrador
- **Busca no curso:** horário de funcionamento; fora do horário; não responder grupos; passar para humano; chamar atendente; palavras-chave; sentimento; follow-up; comandos #on #off

1. **Quando ele entra em ação** — `/app/ai/agents`  
   "Quando ele entra em ação" diz o que faz o agente responder: uma mensagem nova do cliente. Ele nunca responde em grupos nem às mensagens que saem do seu próprio número. Se você preencher "Só responder quando a mensagem falar de algo específico", ele só entra quando a mensagem tiver uma das palavras, separadas por barra vertical (\|).
2. **Horário de funcionamento**  
   Ligando "Só atender em horário de funcionamento", aparecem o fuso horário, o início, o fim e os dias da semana do atendimento. Ele já vem das 8h às 20h, de segunda a sexta (na tela aparece como 08:00 AM e 08:00 PM), e você ajusta como quiser. Em "Mensagem fora do horário" você escreve o aviso para quem chamar com a clínica fechada (o texto cinza no campo é só um exemplo): ele vai uma vez por cliente em cada período fechado, e nunca para quem pediu para não receber mensagens. Para valer, salve o rascunho e publique.
3. **Passar para uma pessoa**  
   "Passar para uma pessoa" tem duas chaves. A primeira deixa o agente chamar alguém da equipe quando percebe que o caso não é dele. A segunda, que só funciona com a primeira ligada, passa a conversa quando o cliente fala de assunto jurídico, como Procon ou advogado. Em "Palavras que chamam uma pessoa na hora" ficam as expressões, como "atendente", que passam a conversa direto para a equipe.
   > 💡 Quem pede para falar com uma pessoa é sempre passado, mesmo com a chave do assunto jurídico desligada.
4. **O clima da conversa**  
   O "Limiar de sentimento" é uma nota do clima da conversa, de 0 a 1. Abaixo dela, o clima é considerado fechado e a conversa passa para uma pessoa. Nota mais alta manda mais conversas para a equipe. Numa clínica, contar o problema de saúde não é irritação: o que conta é hostilidade com o atendimento.
   > 💡 Este campo salva sozinho quando você sai dele, sem passar pelo rascunho.
5. **Pedir ajuda, propostas e follow-up**  
   Com "Deixar o agente pedir uma tarefa a alguém", ele abre um pedido interno, como aprovar um desconto, e continua atendendo até alguém responder. A chave de "Propostas comerciais" deixa ele rascunhar uma proposta quando o cliente pede orçamento. Em "Follow-up", ele retoma sozinho quem parou de responder: a primeira chave deixa ele marcar novos retornos, e a segunda liga os fluxos automáticos criados na tela Follow-ups.
6. **Comandos pelo celular**  
   Com "Aceitar #on/#off enviados pelo celular" ligado, qualquer mensagem que alguém da equipe mandar pelo WhatsApp do celular pausa a IA naquela conversa até alguém mandar #on ou clicar em "devolver ao automático". O #off pausa sem responder o cliente. Desligado, como na foto, #on e #off são texto comum e responder pelo celular pausa a IA só por um tempo. Atenção: o comando é digitado no chat do cliente e pode aparecer para ele.
   > 💡 Esta chave salva na hora, sem passar pelo rascunho.

<a id="l-agentes--bastidores-e-abas"></a>

### Os bastidores: organizar, conferir, testar e acompanhar

- **Objetivo:** Conhecer as partes que trabalham por trás da conversa e as abas que mostram testes, versões e o trabalho do agente.
- **Papel mínimo:** Administrador
- **Busca no curso:** organizar o sistema; funis do agente; verificações; afirmação clínica; testar agente; histórico de versões; reverter versão; execuções; propostas de melhoria

1. **Organiza o sistema** — `/app/ai/agents`  
   "Organiza o sistema" é a parte que trabalha depois da conversa. Ligando a chave e marcando em "O que ele pode mexer no sistema" o que ele pode fazer, o agente também abre chamados, distribui para a pessoa certa e organiza marcadores e etapas. Desligada, ele continua atendendo e o básico continua registrado sozinho. Em "Em que negócios ele pode mexer", marque os funis que ele cuida: sem nenhum marcado, ele conversa normalmente, mas não mexe em negócio nenhum.
2. **Confere antes de enviar**  
   "Confere antes de enviar" mostra as verificações que o sistema faz em cada mensagem do agente antes de ela sair. São 14, nesta ordem: se uma barra a mensagem, o agente recebe o motivo e reescreve. A maioria não se desliga, como "Respeitar quem pediu para parar". No alto, "Estilo de resposta" é um ajuste à parte, para todos os agentes da empresa, que troca o travessão (—) por vírgula nas mensagens; aqui ele está desligado.
3. **Verificações que você escolhe**  
   Algumas verificações têm chave. "Não fazer afirmação clínica" foi feita para a área da saúde: barra a mensagem em que o agente diz o que a pessoa tem, indica remédio ou dose ou garante resultado. Aqui ela aparece desligada; numa clínica, vale ligar. Essas chaves valem na hora e para a empresa toda, sem passar pelo rascunho.
4. **Testar sem mandar nada**  
   A aba "Teste" mostra como o agente responderia a uma mensagem de exemplo, sem mandar nada pelo WhatsApp. No alto aparecem a versão que será testada (aqui, a v1 publicada) e o modelo de IA. Você escreve a mensagem e clica em "Executar teste". O aviso em laranja lembra que o teste gasta créditos da empresa de inteligência artificial. Como esta instalação de exemplo não tem chave de acesso, não vamos executar o teste aqui.
5. **Histórico de versões**  
   A aba "Histórico" lista as versões do agente e mostra qual está publicada. "Diff" compara uma versão com outra. "Reverter" cria uma versão nova igual àquela e a publica na hora; a versão que estava no ar continua guardada.
6. **Execuções**  
   A aba "Execuções" ganha uma linha cada vez que o agente trabalha: quando começou, se deu certo, se foi teste ou atendimento de verdade, quanto custou e quanto demorou. Em cada linha, "Detalhes" abre esses mesmos números num painel. Como a Bia ainda não atendeu ninguém, a lista está vazia.
7. **Propostas de melhoria**  
   Na aba "Propostas", o agente sugere melhorias que aprendeu com as conversas reais. Nada é aplicado sozinho: cada proposta tem um botão para você aplicar, se concordar. Atenção: "Aplicar como versão nova" publica a mudança na hora, sem passar pelo rascunho, e a versão anterior fica no Histórico. As propostas dependem da chave de acesso da inteligência artificial; por enquanto não há nenhuma.

---

<a id="m-follow-ups"></a>

## Follow-ups

**Tela:** `/app/ai/followups`  
**Resumo:** Mensagens de retorno que saem sozinhas para o paciente que parou de responder: os fluxos prontos, o construtor e a fila de quem está sendo acompanhado.

**Lições:** [Conhecendo os Follow-ups](#l-follow-ups--conhecendo-a-tela) · [Começar por um modelo pronto](#l-follow-ups--instalar-um-modelo) · [Lendo um fluxo no construtor](#l-follow-ups--o-construtor) · [Quando o fluxo começa e quando ele pausa](#l-follow-ups--quando-comeca) · [Publicar e ligar no agente](#l-follow-ups--publicar) · [A Fila: quem está sendo acompanhado](#l-follow-ups--a-fila) · [O histórico de um paciente no fluxo](#l-follow-ups--o-dossie)

<a id="l-follow-ups--conhecendo-a-tela"></a>

### Conhecendo os Follow-ups

- **Objetivo:** Saber o que é um fluxo de follow-up, ler o cartão de cada fluxo e reconhecer os três estados: Ativo, Rascunho e Desativado.
- **Papel mínimo:** Administrador
- **Busca no curso:** follow-up; retorno automático; paciente sumiu; parou de responder; fluxos; mensagem automática; reengajar cliente

1. **Fluxos e Fila** — `/app/ai/followups`  
   Um follow-up é uma sequência de mensagens que sai sozinha para o paciente que parou de responder. A aba "Fluxos" mostra os fluxos da clínica. A aba "Fila" mostra quem está ou já passou por um fluxo, quando sai a próxima mensagem e os retornos que a IA combinou com o paciente. Para criar um fluxo, use "Começar de um modelo" (textos prontos para clínica), "Novo fluxo" (desenhar do zero) ou "Importar fluxo" (trazer um arquivo exportado).
   > 💡 Só quem é gerente ou administrador vê os botões de criar, mexer e cancelar. As outras pessoas da equipe veem os fluxos e a Fila, mas não mudam nada.
2. **O cartão de um fluxo**  
   Cada fluxo é um cartão. No alto ficam o nome e a situação. "Versão: publicada" quer dizer que o fluxo já foi publicado ao menos uma vez. "Handoff" diz o que o fluxo faz quando uma pessoa da equipe assume a conversa do paciente: "Pausar" (espera a pessoa), "Cancelar" (encerra o fluxo) ou "Permitir" (continua mandando). Embaixo aparece a data da última alteração.
3. **Ativo, Rascunho e Desativado**  
   O selo no canto do cartão diz a situação do fluxo. "Ativo": publicado e pronto para receber pacientes. "Rascunho": ainda não foi publicado e não manda mensagem para ninguém. "Desativado": foi publicado, mas alguém o desligou. Ele não recebe pacientes novos, mas quem já estava dentro segue até o fim. Para parar alguém, cancele o fluxo dessa pessoa na Fila.
4. **Os botões do cartão**  
   "Renomear" troca o nome do fluxo. "Duplicar" cria uma cópia com "(cópia)" no nome, sempre como rascunho. "Exportar" baixa o fluxo num arquivo que o botão "Importar fluxo" aceita, aqui ou em outra conta. "Excluir" pede confirmação e apaga o fluxo junto com o histórico de quem passou por ele; não dá para desfazer. Para abrir o fluxo, clique no nome dele.

<a id="l-follow-ups--instalar-um-modelo"></a>

### Começar por um modelo pronto

- **Objetivo:** Instalar um fluxo de modelo, com os textos já escritos, sem mandar mensagem para ninguém.
- **Papel mínimo:** Administrador
- **Busca no curso:** modelo pronto; começar de um modelo; instalar fluxo; follow-up pronto; exame; consulta; falta; cirurgia

1. **Os modelos prontos** — `/app/ai/followups`  
   Clique em "Começar de um modelo". Abre a lista de modelos prontos, com os textos já escritos para as quatro vezes em que um paciente costuma sumir: consulta, exame, cirurgia e falta. Instalar não manda mensagem para ninguém: o fluxo nasce como rascunho para você revisar. O selo "Já instalado" marca os modelos que a clínica já tem.
2. **O que cada modelo diz**  
   Cada modelo mostra a etapa do paciente (aqui, "Exame"), o nome, para que serve, quantas mensagens o paciente recebe se nunca responder, por quanto tempo o fluxo acompanha e o que faz o fluxo começar ("Dispara quando"). Este começa quando o negócio do paciente entra numa etapa do funil, por isso pede que você escolha a etapa.
3. **Escolher a etapa do funil**  
   A lista mostra as etapas dos seus funis, com o nome do funil depois do ponto. Escolha a etapa em que o paciente fica quando o exame foi pedido. Aqui escolhemos "Em tratamento", do funil "Pacientes".
4. **Instalar**  
   Com a etapa escolhida, o botão "Instalar" fica liberado. Sem a etapa, ele continua apagado. Ao clicar, o fluxo é criado como rascunho e o construtor abre em seguida.
   > 💡 No fim da lista há um lembrete: revisar os textos no construtor, clicar em "Publicar" e ligar o fluxo num agente. A lição "Publicar e ligar no agente" mostra quando ligar no agente é mesmo necessário.
5. **O rascunho no construtor**  
   O fluxo foi criado com o nome do modelo e o selo "Rascunho", e o construtor já abriu nele. Ali você lê as mensagens, ajusta para o jeito da sua clínica e publica. Enquanto for rascunho, ele não manda mensagem para ninguém.

<a id="l-follow-ups--o-construtor"></a>

### Lendo um fluxo no construtor

- **Objetivo:** Entender o desenho de um fluxo: as peças, a ordem em que acontecem e onde fica o texto de cada mensagem.
- **Papel mínimo:** Administrador
- **Busca no curso:** construtor; editar fluxo; desenho do fluxo; mensagem do follow-up; mudar texto; peças; aguardar resposta

1. **O construtor** — `/app/ai/followups/be300000-0000-4000-8000-000000000001`  
   Ao abrir um fluxo, aparece o construtor. À esquerda, em "Adicionar nó", ficam as peças que você pode pôr no fluxo, como "Aguardar", "Ação" (mandar uma mensagem) e "Fim". Clique numa peça para adicioná-la. No meio fica o desenho do fluxo, que começa no "Início" e segue pelas linhas.
2. **A ordem das mensagens**  
   Este fluxo segue da esquerda para a direita. Do "Início" ele manda a primeira mensagem ("Retoma a marcação") e espera a resposta. Se o paciente não responde no prazo, ele aguarda mais um pouco e manda a próxima mensagem. O desenho continua para a direita, com mais esperas e mensagens; para ver o resto, arraste o fundo do desenho para o lado.
   > 💡 Use os botões de mais e menos, no canto de baixo do desenho, para aproximar ou afastar. O botão "Organizar", no alto, alinha as peças.
3. **O texto da mensagem**  
   Clique numa peça para abrir os detalhes dela à direita. Nesta, "Como escrever a mensagem" está em "Texto fixo": o paciente recebe exatamente o texto do campo "Texto enviado ao contato", sem IA. As outras opções são "Mensagem escrita pela IA" e "Modelo de mensagem pronto". O que você muda vale para o rascunho; para guardar, use "Salvar" na barra de cima.
   > 💡 No WhatsApp conectado por QR code, o texto fixo sai a qualquer hora. No WhatsApp oficial (API da Meta), depois de 24 horas sem o paciente escrever, só chega um "Modelo de mensagem pronto" aprovado.
4. **Esperar a resposta**  
   A peça "Espera a resposta" segura o fluxo até o paciente responder ou o prazo acabar. Em "Esperar a resposta por (minutos)" fica o prazo: aqui, 2880 minutos, ou dois dias. Se o prazo acaba sem resposta, o fluxo segue pelo caminho "Sem resposta", até a próxima mensagem. Em "Regras de texto" fica uma palavra (aqui, "quero") que leva a um caminho próprio, mas ela só é usada quando "Cancelar se o lead responder", no gatilho do fluxo, está desligado.
   > 💡 Nos modelos prontos, "Cancelar se o lead responder" vem ligado: qualquer resposta do paciente encerra o fluxo dele, e quem continua a conversa é o atendimento.

<a id="l-follow-ups--quando-comeca"></a>

### Quando o fluxo começa e quando ele pausa

- **Objetivo:** Ler e ajustar o gatilho que coloca o paciente no fluxo, e escolher o que acontece quando uma pessoa da equipe assume a conversa.
- **Papel mínimo:** Administrador
- **Busca no curso:** gatilho; quando começa; silêncio; minutos sem responder; etapa do funil; cancelar se responder; pausar handoff

1. **A barra do fluxo** — `/app/ai/followups/be300000-0000-4000-8000-000000000001`  
   No alto do construtor ficam o nome do fluxo, a situação e os botões. O botão do gatilho diz o que coloca o paciente no fluxo. Aqui é "Gatilho: Silêncio (1440 min)": o paciente entra 1440 minutos (um dia inteiro) depois da última mensagem que ele mandou, mesmo que a clínica não tenha respondido. Ao lado fica a escolha do que fazer quando uma pessoa assume a conversa.
2. **Ajustar o gatilho**  
   Clique no botão do gatilho para ver os detalhes. "Tipo de gatilho" escolhe o que faz o fluxo começar. Em "Minutos de silêncio" fica quanto tempo depois da última mensagem do paciente conta como sumiço (aqui, 1440). Os campos de baixo limitam quem entra e quantas vezes. Preencha "Silêncio máximo" e "Quantas vezes no máximo, por contato", e ligue "Só começar se a equipe já respondeu a última mensagem do cliente". Sem isso, o fluxo pode chegar a pacientes sumidos há meses e se repetir sem fim.
3. **Os tipos de gatilho**  
   Além de "Silêncio", o fluxo pode começar por "Etapa do funil" (o negócio entra numa etapa), "Falta confirmada pela equipe" (a equipe marca na agenda que o paciente faltou), "Agente pediu ajuda", "Cliente voltou" (volta a falar depois de um tempo), "Lead criado" (um negócio novo é criado), "Automação (Webhooks)" ou só à mão ("Manual").
4. **Quem entra, quem sai e salvar**  
   Mais abaixo, com "Só começar se a equipe já respondeu a última mensagem do cliente" ligado, quem está esperando a clínica não entra no fluxo. Com "Cancelar se o lead responder" ligado, qualquer resposta do paciente tira ele do fluxo. Mudou algo no gatilho? Clique em "Salvar gatilho". O botão só fica liberado quando há alguma mudança.
5. **Quando uma pessoa assume a conversa**  
   Esta lista escolhe o que o fluxo faz quando alguém da equipe assume a conversa do paciente. "Pausar durante handoff" para o fluxo enquanto a pessoa atende. "Cancelar durante handoff" encerra o fluxo. "Permitir durante handoff" deixa as mensagens continuarem. A escolha vale assim que você clica, sem precisar salvar.

<a id="l-follow-ups--publicar"></a>

### Publicar e ligar no agente

- **Objetivo:** Publicar um rascunho, saber para que servem Desativar e Rollback, e ligar o fluxo no agente para as mensagens saírem sozinhas.
- **Papel mínimo:** Administrador
- **Busca no curso:** publicar fluxo; ativar follow-up; desativar; rollback; voltar versão; ligar no agente; fluxo não dispara

1. **Um rascunho pronto para publicar** — `/app/ai/followups/be300000-0000-4000-8000-000000000002`  
   Este fluxo, "Falta · remarcar quem não veio", está como "Rascunho". Depois de revisar as mensagens, clique em "Publicar". O "Salvar" só guarda o rascunho, e fica liberado quando há alterações não salvas.
2. **Publicado**  
   Ao publicar, o sistema confere o fluxo inteiro. Se faltar algo, a peça com problema fica com borda vermelha e o fluxo não é publicado. Deu certo: o selo vira "Ativo". Num fluxo de silêncio, podem aparecer avisos amarelos sobre limites que faltam preencher no gatilho. Leia e ajuste. "Desativar" para de receber pacientes novos, e quem já estava dentro segue até o fim. "Rollback" volta para a versão publicada anterior; por isso só fica liberado depois da segunda publicação.
3. **Quando é preciso ligar no agente** — `/app/ai/agents`  
   Alguns fluxos só colocam pacientes sozinhos se estiverem ligados num agente publicado: os que usam a IA ("Mensagem escrita pela IA", "Classificar (IA)" ou uma espera em que a IA escolhe a hora) e os que começam por "Falta confirmada pela equipe", como o "Falta · remarcar quem não veio". Para ligar, abra Agentes, clique em "Editar" e role até o bloco "Follow-up". Ligue "Habilitar gatilhos automáticos de follow-up" e marque o fluxo em "Fluxos publicados".
   > 💡 Fluxos só com texto fixo e outros gatilhos, como o de silêncio, começam sozinhos mesmo sem agente. Só fluxos com o selo "Ativo" aparecem na lista do agente.
4. **Salvar e publicar o agente**  
   Ligou e marcou? Volte ao alto da tela do agente. Enquanto a mudança não for salva, aparece "Sem rascunho para publicar." e o "Publicar" fica apagado. Clique em "Salvar rascunho" e depois em "Publicar". Enquanto o agente não for publicado de novo, a mudança não vale para os pacientes.

<a id="l-follow-ups--a-fila"></a>

### A Fila: quem está sendo acompanhado

- **Objetivo:** Ler a Fila, entender cada situação, achar um paciente e cancelar um retorno quando ele não faz mais sentido.
- **Papel mínimo:** Administrador
- **Busca no curso:** fila de follow-up; quem vai receber mensagem; próximo disparo; retorno agendado; promessa da IA; cancelar follow-up; pausado

1. **Quem está ou passou por um fluxo** — `/app/ai/followups`  
   A aba "Fila" lista cada paciente que está ou passou por um fluxo, e os retornos que a IA combinou. Cada linha mostra o paciente, o fluxo (e o agente que cuida dele), o passo em que ele está (ou o motivo do retorno), quando sai a próxima mensagem e a situação. O passo aparece como um código curto, como "resposta-2"; o nome completo aparece quando você abre o histórico do paciente. Quem tem a próxima mensagem mais cedo aparece primeiro.
2. **As situações**  
   "Aguardando resposta": a mensagem já saiu e o fluxo espera o paciente. "Pausado (atendimento humano)": alguém da equipe assumiu a conversa. "Pausado por uma pessoa": alguém segurou o fluxo de propósito. "Cancelado": o fluxo terminou antes do fim, por exemplo, quando o paciente responde. Na linha do Pedro aparece "Promessa" e "Agendada": é um retorno que a IA combinou com ele na conversa.
3. **Achar um paciente**  
   Digite o nome ou o telefone em "Buscar contato…" para achar alguém na Fila. Aqui digitamos "Lucas". Os dois filtros ao lado mostram só uma situação ("Todos os status") ou só um fluxo ("Todos os fluxos").
   > 💡 Com um filtro de situação ou de fluxo escolhido, os retornos combinados pela IA saem da lista, porque eles não pertencem a nenhum fluxo.
4. **Cancelar um retorno**  
   O botão "Cancelar" aparece, para gerente e administrador, nas linhas que ainda não terminaram, inclusive as pausadas. Ele sempre pede confirmação. Num retorno combinado pela IA, a pergunta é "Cancelar este retorno?": o agente não volta a falar com a pessoa no horário combinado. Num fluxo, a pergunta é "Cancelar este follow-up?" e não dá para desfazer. "Voltar" fecha a pergunta sem cancelar nada.

<a id="l-follow-ups--o-dossie"></a>

### O histórico de um paciente no fluxo

- **Objetivo:** Abrir o histórico de um paciente no fluxo, ver onde ele está e o que já aconteceu, e pausar, adiar ou pular um passo.
- **Papel mínimo:** Administrador
- **Busca no curso:** histórico do follow-up; o que aconteceu; pausar follow-up; adiar mensagem; pular passo; onde está o paciente; dossiê

1. **Abrir pelo nome** — `/app/ai/followups`  
   Na Fila, o nome do paciente é um link. Clique nele para abrir o histórico daquele paciente no fluxo. Os retornos combinados pela IA não têm link, porque são um aviso só, com dia e motivo.
2. **Onde ele está agora**  
   No alto aparecem o nome, a situação, o fluxo, o agente, quando começou e quantos passos já deu. O quadro "Onde está agora" diz o passo atual e quando o fluxo volta a andar. O Antônio já recebeu duas mensagens e o fluxo espera a resposta da segunda.
3. **Mexer no fluxo de um paciente**  
   "Pausar" segura o fluxo até alguém clicar em "Retomar". "Adiar" escolhe um novo dia e hora para o próximo passo. "Pular este passo" segue em frente sem esperar. "Cancelar follow-up" tira o paciente do fluxo de vez e não dá para desfazer.
4. **Pular para qual caminho**  
   Quando o passo tem mais de um caminho, o sistema pergunta "Por onde seguir?" em vez de escolher sozinho. Cada opção mostra para onde o fluxo vai e em que caso esse caminho é usado. Para desistir sem mudar nada, feche no X.
5. **O que já aconteceu**  
   Mais abaixo, "O que já aconteceu" conta, em ordem, cada passo do fluxo: as mensagens enviadas, as esperas e quando o paciente não respondeu no prazo. Cada linha mostra também o passo e a hora.

---

<a id="m-fluxos-de-atendimento"></a>

## Fluxos de atendimento

**Tela:** `/app/ai/atendimento`  
**Resumo:** Roteiros de perguntas que a IA faz durante a conversa, uma de cada vez, guardando cada resposta na ficha do cliente.

**Lições:** [Conhecendo os Fluxos de atendimento](#l-fluxos-de-atendimento--fluxos-conhecendo-a-tela) · [Lendo um roteiro no construtor](#l-fluxos-de-atendimento--fluxos-lendo-um-roteiro) · [Criar e publicar um roteiro](#l-fluxos-de-atendimento--fluxos-criar-e-publicar)

<a id="l-fluxos-de-atendimento--fluxos-conhecendo-a-tela"></a>

### Conhecendo os Fluxos de atendimento

- **Objetivo:** Achar a tela, entender o que é um roteiro de perguntas e ler o cartão de cada um.
- **Papel mínimo:** Gerente
- **Busca no curso:** fluxo de atendimento; roteiro de perguntas; cadastro pelo whatsapp; ia fazer perguntas ao cliente; coletar cpf; perguntas da primeira consulta

1. **Onde fica a tela** — `/app/ai`  
   Fluxos de atendimento não aparece direto no menu lateral. No grupo "Agente de IA" do menu, clique em "Ver tudo em IA". Na parte "Montar o agente" está o cartão "Fluxos de atendimento". O caminho completo é: Agente de IA › Ver tudo em IA › Fluxos de atendimento.
   > 💡 O cartão só aparece quando quem administra o servidor liga o recurso "Fluxos de atendimento" em Administração › Sistema. Desligado, a tela não existe. Ligado, gerente e administrador veem o cartão.
2. **Para que serve um fluxo de atendimento** — `/app/ai/atendimento`  
   Um fluxo de atendimento é um roteiro de perguntas que a IA segue durante a conversa no WhatsApp. Ela pergunta uma coisa por vez, entende a resposta e guarda o dado na ficha do cliente. Na Clínica Bem Viver, um roteiro faz o cadastro de quem vai à primeira consulta, e outro confere a carteirinha do convênio.
3. **O cartão de um roteiro**  
   Cada roteiro é um cartão. No alto ficam o nome e o selo da situação. "Ativo" quer dizer publicado: a IA já usa o roteiro nas conversas. "Rascunho" quer dizer que ele ainda não foi publicado e não faz pergunta nenhuma. "Versão: publicada" aparece quando o roteiro já foi publicado ao menos uma vez.
4. **O guia rápido**  
   Em dúvida, clique em "Como usar os fluxos de atendimento (guia rápido)". Ele explica, em poucas linhas, como montar o roteiro e como a IA se comporta: ela só grava o que o cliente escreveu, não pergunta de novo o que ele já respondeu e para quando uma pessoa da equipe assume a conversa.

<a id="l-fluxos-de-atendimento--fluxos-lendo-um-roteiro"></a>

### Lendo um roteiro no construtor

- **Objetivo:** Abrir um roteiro e entender o Início, as Perguntas e o Fim.
- **Papel mínimo:** Gerente
- **Busca no curso:** palavra-gatilho; pergunta do roteiro; tipo da resposta; o que fazer ao concluir; construtor do fluxo de atendimento

1. **O construtor** — `/app/ai/atendimento/f1c00100-0000-4000-8000-000000000001`  
   Clique no cartão de um roteiro para abrir o construtor. À esquerda, em "Adicionar nó", ficam as quatro peças de um roteiro: "Gatilho" (o Início), "Pergunta", "Skill" (um procedimento da clínica que a IA usa naquele passo) e "Fim". No meio fica o roteiro, lido da esquerda para a direita.
2. **O Início e as palavras-gatilho**  
   Clique no "Início" para ver quando o roteiro começa. Em "Palavras-gatilho" ficam as palavras que ligam o roteiro sozinho: quando a mensagem do cliente tem uma delas, como "primeira consulta", a IA começa a perguntar. Ele também pode começar quando o card do cliente entra numa etapa do funil escolhida logo abaixo, ou por um roteador em IA › Roteadores.
3. **Quanto tempo o roteiro espera**  
   Mais abaixo, "Máximo de tentativas por pergunta" diz quantas vezes a IA repete uma pergunta sem resposta antes de desistir dela. Desistir de uma pergunta não trava o roteiro. "Encerrar o roteiro depois de quantas horas sem resposta" fecha o roteiro de quem sumiu: aqui, 48 horas. Em branco, são 72 horas.
4. **Uma pergunta**  
   Clique numa "Pergunta". Em "Pergunta" fica o que a IA deve perguntar. Em "Chave do campo" fica o nome curto onde a resposta é guardada na ficha do cliente. Em "Tipo da resposta" você diz o que esperar: texto, número, data, sim ou não, uma escolha numa lista, ou CPF, que já confere se o número é válido.
5. **Uma pergunta com opções**  
   Na pergunta do convênio, o tipo é "Escolha numa lista". Em "Opções" ficam as respostas aceitas, separadas por vírgula. A IA só grava uma resposta que esteja na lista.
6. **O Fim**  
   Clique no "Fim". Em "Ao concluir, o que fazer" você escolhe o que acontece quando o cliente responde tudo: nada, devolver à IA com uma orientação, chamar uma skill ou começar outro roteiro. Aqui, a IA agradece e oferece os horários livres da semana.

<a id="l-fluxos-de-atendimento--fluxos-criar-e-publicar"></a>

### Criar e publicar um roteiro

- **Objetivo:** Dar nome a um roteiro novo e publicar um rascunho para a IA começar a usá-lo.
- **Papel mínimo:** Gerente
- **Busca no curso:** criar fluxo de atendimento; novo roteiro; publicar roteiro; rascunho do fluxo

1. **Dar nome ao roteiro** — `/app/ai/atendimento`  
   Clique em "Novo fluxo de atendimento" e escreva um nome em "Nome" que diga para que o roteiro serve. Clique em "Criar fluxo". Ele nasce como rascunho, e o cartão dele aparece na lista. No construtor, você põe as peças e liga cada uma na próxima, do Início ao Fim.
2. **Um rascunho pronto para publicar** — `/app/ai/atendimento/f1c00100-0000-4000-8000-000000000002`  
   Este roteiro, "Convênio · conferir a carteirinha", está como "Rascunho". Ele pergunta o número e a validade da carteirinha. "Salvar" guarda as mudanças sem publicar. Para a IA começar a usar o roteiro, clique em "Publicar".
3. **Publicado**  
   Ao publicar, o sistema confere o roteiro inteiro. Se faltar algo, a peça com problema fica com a borda vermelha e o roteiro não é publicado. Deu certo: o selo virou "Ativo". Na próxima conversa em que o cliente falar "carteirinha", a IA começa a perguntar. As respostas aparecem na ficha do cliente.
   > 💡 "Desativar" tira o roteiro de uso sem apagar. "Rollback" volta para a versão publicada antes desta.

---

<a id="m-roteadores"></a>

## Roteadores

**Tela:** `/app/ai/routers`  
**Resumo:** Quando um mesmo número de WhatsApp tem mais de um agente de IA, o roteador lê o que o cliente quer e entrega a conversa ao agente certo.

**Lições:** [Conhecendo a tela de Roteadores](#l-roteadores--roteadores-conhecendo-a-tela) · [Criar um roteador](#l-roteadores--roteadores-criar) · [Cadastrar as intenções](#l-roteadores--roteadores-intencoes) · [Reserva, teste e ligar o roteador](#l-roteadores--roteadores-reserva-teste-ligar)

<a id="l-roteadores--roteadores-conhecendo-a-tela"></a>

### Conhecendo a tela de Roteadores

- **Objetivo:** Entender o que um roteador faz, onde fica a tela e o que o cartão e a página de cada roteador mostram.
- **Papel mínimo:** Administrador
- **Busca no curso:** roteador; roteador de intenção; mais de um agente no mesmo número; qual agente atende; separar atendimento por assunto; triagem do whatsapp; direcionar conversa para o agente certo

1. **Onde fica a tela** — `/app/ai`  
   Roteadores não aparece direto no menu lateral. No grupo "Agente de IA" do menu, clique em "Ver tudo em IA". Na parte "Montar o agente" está o cartão "Roteadores". O caminho completo é: Agente de IA › Ver tudo em IA › Roteadores.
   > 💡 Só gerente ou administrador vê este cartão. Para um atendente, ou para quem só tem permissão de leitura, ele não aparece, e o endereço da tela leva à página "403 — Sem permissão".
2. **Para que serve um roteador** — `/app/ai/routers`  
   Um agente de IA é o atendente virtual que responde os clientes no WhatsApp. Quando a empresa tem mais de um agente, cada um cuidando de um assunto, o roteador decide quem atende. Ele lê a mensagem do cliente, entende o que a pessoa quer (a "intenção") e entrega a conversa ao agente daquele assunto. Cada roteador fica ligado a um número de WhatsApp. Aqui aparece o roteador que a Clínica Bem Viver está montando para o número da recepção.
3. **O que o cartão mostra**  
   Cada cartão é um roteador. No alto vêm o nome e o selo "ativo" ou "inativo". Ativo quer dizer que ele já decide quem atende as conversas do número. Inativo quer dizer que ele não decide nada: o número segue com o agente publicado nele, como se o roteador não existisse. Embaixo vêm o número de WhatsApp e quantas intenções ele tem. Este ainda está "inativo" e "Sem intenções configuradas": a clínica vai montar tudo antes de ligar.
   > 💡 Um número pode ter vários roteadores guardados, mas só um ativo de cada vez.
4. **Por dentro do roteador**  
   Clique no cartão para abrir o roteador. Em "Identificação" ficam o nome, o número e a chave que liga e desliga. Em "Intenções", à direita, você diz que assuntos ele reconhece e qual agente atende cada um. Mais abaixo, à esquerda, vêm "Agente por número do remetente" (para mandar certos telefones sempre para um agente, antes da IA decidir), o modelo de IA que lê as mensagens, o agente de reserva para quando nenhuma intenção serve e um teste. Nada do que você muda vale antes de clicar em "Salvar".
   > 💡 Um gerente também abre os roteadores, mas só para ver e testar: os campos ficam travados e os botões "Novo roteador", "Intenção", "Salvar" e "Excluir roteador" não aparecem. Só o administrador cria, muda e exclui roteadores.

<a id="l-roteadores--roteadores-criar"></a>

### Criar um roteador

- **Objetivo:** Criar um roteador novo e ligá-lo a um número de WhatsApp da empresa.
- **Papel mínimo:** Administrador
- **Busca no curso:** criar roteador; novo roteador; primeiro roteador; ligar roteador ao whatsapp; roteador para o meu número; este número já tem um roteador ativo

1. **O botão Novo roteador** — `/app/ai/routers`  
   Para criar um roteador, clique em "Novo roteador", no alto da tela. Quando a empresa ainda não tem nenhum, a tela mostra uma explicação no meio e o botão "Criar meu primeiro roteador", que abre a mesma janela.
2. **Nome e número**  
   Na janela "Novo roteador", dê um nome que diga para que ele serve. Em "Número de WhatsApp", você escolhe o número que ele vai atender: a lista mostra os números de WhatsApp da empresa, cada um com o seu estado. Repare no aviso embaixo: só é possível ter um roteador ativo por número.
3. **Escolher o número**  
   Clique no número que o roteador vai atender. Aqui aparece o "Recepção Bem Viver", com o estado "Conectado". Escolha com cuidado: depois de criado, o número do roteador não pode ser trocado. Para outro número, crie outro roteador.
4. **Criar**  
   Com o nome e o número escolhidos, o botão "Criar roteador" acende. O roteador novo já nasce ativo. Por isso, se o número escolhido já tiver outro roteador ativo, o sistema recusa e avisa: "Este número já tem um roteador ativo.". Nesse caso, desligue o outro antes. Para desistir, clique em "Cancelar".
5. **O roteador nasce vazio**  
   Depois de criado, a página do roteador abre sozinha, com o aviso "Roteador criado — agora escolha as intenções.". Ele já aparece como "ativo", mas ainda não tem intenções nem agente de reserva. Enquanto estiver assim, quem responde o número continua sendo o agente que já estava publicado nele. O próximo passo é cadastrar as intenções, na lição seguinte.

<a id="l-roteadores--roteadores-intencoes"></a>

### Cadastrar as intenções

- **Objetivo:** Ensinar ao roteador cada assunto que os clientes trazem e dizer qual agente atende cada um.
- **Papel mínimo:** Administrador
- **Busca no curso:** intenção do roteador; cadastrar intenção; frases de exemplo; quando escolher esta intenção; agente que atende; funil de destino; roteador não reconhece o assunto

1. **Uma intenção para cada assunto** — `/app/ai/routers/d1130000-0000-4000-8000-000000000001`  
   Uma intenção é um assunto que faz o cliente escrever, como "agendar consulta" ou "resultado de exame". O roteador compara cada mensagem com as intenções cadastradas e escolhe a que mais combina. Este roteador ainda não tem nenhuma. Para cadastrar a primeira, clique em "Intenção", com o sinal de mais.
2. **Nome e agente**  
   Em "Nome da intenção", escreva um nome curto, como "Agendar consulta". Dois assuntos do mesmo roteador não podem ter o mesmo nome. Em "Agente que atende", escolha quem assume a conversa quando o cliente quer isso. Nesta clínica de exemplo só existe a Bia. Numa operação com vários agentes, cada intenção aponta para o agente que entende daquele assunto.
   > 💡 O agente escolhido aqui não precisa de número próprio. Depois de salvar, a tela dele mostra o aviso "Este agente é acionado pelo roteador" e, sem número próprio, ele pode ser publicado usando o número do roteador.
3. **Quando escolher esta intenção**  
   Em "Quando escolher esta intenção", descreva a situação com suas palavras, como explicaria a um atendente novo. É este texto que a IA lê para decidir. Nome, agente e esta descrição são obrigatórios: enquanto faltar um deles, aparece um aviso em vermelho embaixo do bloco e o botão "Salvar" fica apagado.
4. **Frases de exemplo**  
   Em "Frases de exemplo (opcional)", escreva mensagens como um paciente escreveria e aperte Enter, ou clique em "Adicionar". Cada frase vira uma etiqueta; clicar numa etiqueta tira a frase. Cabem até 10 frases por intenção. Os exemplos ajudam a IA a reconhecer o assunto mesmo quando o cliente escreve de outro jeito.
5. **Funil de destino**  
   "Funil de destino (opcional)" serve para quem tem um funil de vendas para cada serviço. Deixando "Sem destino — só escolher o agente", o roteador só escolhe quem atende. Escolhendo um funil, quando esta intenção é reconhecida o sistema leva o negócio do cliente para esse funil antes de o agente responder. Aí aparece também o campo "Etapa de destino", que já vem em "Primeira etapa aberta".
   > 💡 Se quem administra o servidor ligou o recurso opcional "Fluxos de atendimento", cada intenção ganha ainda o campo "Fluxo de atendimento (opcional)": um roteiro de perguntas que começa quando a intenção é reconhecida.
6. **Mais intenções e salvar**  
   Para outro assunto, clique de novo em "Intenção": cada um ganha o seu bloco, e a lixeira ao lado do agente tira o bloco. Quando terminar, clique em "Salvar" e aparece o aviso "Roteador salvo.". As intenções só passam a decidir quem atende quando o roteador está ativo.

<a id="l-roteadores--roteadores-reserva-teste-ligar"></a>

### Reserva, teste e ligar o roteador

- **Objetivo:** Escolher o agente de reserva, entender o modelo que lê as mensagens, testar e ligar, desligar ou excluir o roteador.
- **Papel mínimo:** Administrador
- **Busca no curso:** agente de fallback; agente de reserva; testar roteador; testar classificação; ativar roteador; desligar roteador; excluir roteador; modelo do classificador

1. **Quando nenhuma intenção serve** — `/app/ai/routers/d1130000-0000-4000-8000-000000000001`  
   Nem toda mensagem combina com uma intenção, e a IA também pode ficar em dúvida: com menos de 60% de certeza, a escolha dela não vale. Para esses casos existe o "Agente de fallback", o agente de reserva: quando a conversa ainda não está com o agente de alguma intenção, é ele quem atende o que não foi reconhecido. Aqui é a Bia. Escolhendo "Nenhum — responde com o atendimento padrão", responde o agente publicado no número.
   > 💡 Se a IA que lê as mensagens falhar, por exemplo por falta de crédito na conta do provedor, a conversa continua com o agente da intenção que já a atendia; se ainda não estava com nenhum, vai para o agente de reserva.
2. **A IA que lê as mensagens**  
   Em "Modelo que identifica a intenção" fica a IA que lê cada mensagem e escolhe a intenção. "Automático — usa o provedor da organização" deixa o sistema usar a inteligência que a empresa já configurou. Para escolher outro modelo, só aparecem os de provedores com chave cadastrada. Nesta clínica de exemplo não há nenhuma chave de IA utilizável, por isso o campo está travado e o aviso pede para cadastrar uma em Credenciais (Agente de IA › Ver tudo em IA › Credenciais). Em "Mensagens anteriores para o roteamento", de 0 a 16, você diz quantas mensagens anteriores da conversa a IA lê junto com a atual: mais mensagens ajudam a entender o contexto, mas podem aumentar o custo e a demora.
3. **Testar antes de valer**  
   "Testar classificação" mostra o que o roteador faria com uma frase sua, sem mexer em nenhuma conversa real. Você escreve como um cliente escreveria e clica no botão. Aparecem a intenção escolhida, a certeza da IA em porcentagem e o agente que atenderia. Se a certeza ficar abaixo do mínimo, o resultado avisa que, de verdade, a conversa não seguiria aquela intenção. O teste usa a IA de verdade e gasta crédito do provedor. Ele só funciona com o roteador ativo; por isso aparece o aviso "Ative o roteador para poder testar a classificação.".
   > 💡 O gerente, que só pode ver a tela, também pode usar o teste.
4. **Ligar o roteador**  
   Depois de cadastrar as intenções, clique na chave do bloco "Identificação". O texto muda para "Ativo — está roteando as conversas deste número", e a mudança vale depois de clicar em "Salvar". A partir daí, cada mensagem nova do número passa pelo roteador. Depois que ele entrega uma conversa a um agente, ela continua com esse agente; só muda se o cliente passar a falar de outro assunto cadastrado, com certeza suficiente. Para desligar, clique na chave de novo e salve: o número volta para o agente publicado nele.
   > 💡 Se outro roteador já estiver ativo no mesmo número, o sistema recusa ao salvar, com o aviso "Este número já tem um roteador ativo.". Desligue o outro primeiro.
5. **Excluir um roteador**  
   "Excluir roteador", no canto de cima, apaga o roteador e todas as intenções dele. Antes, uma janela pede a confirmação. Depois de excluir, o número volta a ser atendido sem roteador, pelo agente publicado nele. Não dá para desfazer. Se quiser só parar o roteador por um tempo, desligue a chave em vez de excluir.

---

<a id="m-credenciais"></a>

## Credenciais

**Tela:** `/app/ai/credentials`  
**Resumo:** Onde você guarda a chave da sua conta de inteligência artificial, a que os agentes usam para pensar, e confere se ela está funcionando.

**Lições:** [Conhecendo a tela de Credenciais](#l-credenciais--credenciais-conhecendo-a-tela) · [O que o selo de cada chave quer dizer](#l-credenciais--credenciais-o-selo-de-cada-chave) · [Cadastrar uma chave nova](#l-credenciais--credenciais-cadastrar-uma-chave) · [Trocar, renomear ou excluir uma chave](#l-credenciais--credenciais-trocar-renomear-excluir)

<a id="l-credenciais--credenciais-conhecendo-a-tela"></a>

### Conhecendo a tela de Credenciais

- **Objetivo:** Entender o que é uma chave de IA, onde ela fica guardada e o que cada cartão da tela mostra.
- **Papel mínimo:** Administrador
- **Busca no curso:** credenciais; chave da ia; chave de api; onde coloco a chave; chave da anthropic; chave da openai; conta de inteligência artificial

1. **Credenciais fica no hub de IA** — `/app/ai`  
   A tela Credenciais não tem atalho próprio no menu lateral. No grupo "Agente de IA", clique em "Ver tudo em IA". Na parte "Montar o agente" está o cartão "Credenciais". É ali que você guarda a chave da sua conta de inteligência artificial (IA), a que os agentes usam para pensar e responder.
   > 💡 Só o gerente e o administrador veem este cartão e entram nesta tela.
2. **O que é uma chave de IA** — `/app/ai/credentials`  
   Os agentes usam uma inteligência artificial contratada de uma empresa, chamada provedor, como a Anthropic (Claude) ou a OpenAI (GPT). A conta nesse provedor é sua: você contrata direto com ele, e a cobrança vai para essa conta. Para o sistema usar a sua conta, o provedor entrega uma chave: um código longo, que funciona como uma senha. Você cola a chave aqui. Ela fica guardada criptografada e nunca mais aparece inteira na tela, nem para você.
   > 💡 A chave colocada durante a instalação do sistema não aparece nesta lista, mas os agentes podem usá-la: no editor do agente ela aparece como "A chave desta instalação".
3. **Um grupo para cada provedor**  
   As chaves aparecem agrupadas por provedor, com o nome dele em cima de cada grupo. Cada cartão é uma chave. No alto do cartão fica o nome que você deu a ela e, logo abaixo, só os quatro últimos caracteres da chave, para você reconhecer qual é. No canto, um selo diz se a chave está funcionando; a próxima lição explica cada selo. "Adicionar credencial" cadastra mais uma chave.
4. **Modelos, uso e os botões do cartão**  
   "Modelos" conta quantos modelos de IA o provedor liberou para essa chave na última conferência. "Em uso por" conta quantas versões de agente estão ligadas a ela, contando rascunhos e versões antigas; o agente escolhe a chave no campo "Chave de acesso" do editor dele. Embaixo ficam três botões: o lápis edita a chave, as setas em círculo testam a chave de novo e a lixeira exclui.
   > 💡 O gerente vê esta tela só para consultar: para ele não aparecem "Adicionar credencial" nem os botões dos cartões. Cadastrar, editar, testar de novo e excluir são tarefas do administrador.

<a id="l-credenciais--credenciais-o-selo-de-cada-chave"></a>

### O que o selo de cada chave quer dizer

- **Objetivo:** Saber se uma chave está funcionando e o que fazer quando ela é recusada ou ainda não foi conferida.
- **Papel mínimo:** Administrador
- **Busca no curso:** chave inválida; chave validada; não validada; chave recusada; testar a chave; revalidar credencial; ia parou de responder

1. **Validada: a chave funciona** — `/app/ai/credentials`  
   Toda chave cadastrada passa por uma conferência: o sistema pergunta ao provedor se ela vale. "Validada", em verde, quer dizer que o provedor aceitou a chave. A IA só usa chave validada.
2. **Inválida: a conferência falhou**  
   "Inválida", em vermelho, quer dizer que a conferência falhou. A frase vermelha embaixo do nome diz o motivo. Aqui o provedor recusou a chave: por exemplo, ela foi copiada pela metade ou apagada no site do provedor. O link "Onde pegar a chave" abre a página do provedor onde se cria uma chave nova. Depois, troque a chave pelo lápis, como mostra a lição "Trocar, renomear ou excluir uma chave".
   > 💡 Nem sempre a culpa é da chave. Se o provedor estiver fora do ar, ou se este servidor não conseguir falar com ele, a frase diz isso e pede para testar de novo mais tarde.
3. **Não validada: a conferência não terminou**  
   Logo depois de salva, a chave aparece como "Validando…" enquanto o sistema confere com o provedor, e a tela se atualiza sozinha. Se o resultado não chega em dois minutos, o selo vira "Não validada": a conferência foi interrompida no meio. Clique nas setas em círculo, "Revalidar credencial", para testar a chave de novo na hora. O resultado aparece no selo.

<a id="l-credenciais--credenciais-cadastrar-uma-chave"></a>

### Cadastrar uma chave nova

- **Objetivo:** Escolher o provedor, colar a chave e guardá-la para os agentes usarem.
- **Papel mínimo:** Administrador
- **Busca no curso:** cadastrar chave; adicionar credencial; colar a chave; nova chave de ia; onde pegar a chave; configurar a ia; escolher provedor

1. **Abrir o formulário** — `/app/ai/credentials`  
   Antes, entre no site do provedor que você contratou, crie uma chave e copie-a inteira. Depois, volte aqui e clique em "Adicionar credencial".
2. **Escolher o provedor**  
   Em "Provedor", escolha a empresa de IA que você contratou. O formulário já abre com a Anthropic (Claude). Embaixo do campo aparece uma frase curta dizendo quando vale a pena escolher aquele provedor.
3. **Os provedores da lista**  
   A lista traz todos os provedores que o sistema sabe usar. Os de cima podem conversar com o cliente. O último, "Jev (TypeSafe AI)", não conversa: só toma decisões rápidas, como perceber se o cliente está irritado. Aqui escolhemos a Anthropic (Claude).
   > 💡 "Provedor personalizado (compatível com OpenAI)" é para quem tem um servidor próprio que fala como a OpenAI: o formulário pede também o "Endereço (base URL)" e testa a conexão antes de salvar. "OpenAI pela assinatura (ChatGPT)" não aceita chave colada: a conta se conecta por um painel de login próprio, que só aparece nesta tela quando quem administra o servidor liga "Login do Codex por assinatura" em Admin › Recursos opcionais.
4. **Nome e chave**  
   Em "Nome", escreva um nome que ajude a reconhecer a chave depois. Ele é opcional: em branco, a chave recebe o nome do provedor. Em "Chave", cole a chave que você copiou; ela aparece como bolinhas. Se ainda não tem a chave, "Onde pegar a chave" abre a página do provedor onde ela é criada.
   > 💡 Duas chaves do mesmo provedor não podem ter o mesmo nome.
5. **Salvar e conferir**  
   Clique em "Salvar e validar". A chave é guardada criptografada e o formulário fecha. Em seguida o sistema confere a chave com o provedor, sem você precisar esperar: o cartão novo aparece com "Validando…" e, em alguns segundos, passa para "Validada" ou "Inválida". "Cancelar" fecha o formulário sem guardar nada.

<a id="l-credenciais--credenciais-trocar-renomear-excluir"></a>

### Trocar, renomear ou excluir uma chave

- **Objetivo:** Trocar uma chave recusada sem desligar os agentes, dar outro nome a uma chave e apagar a que não serve mais.
- **Papel mínimo:** Administrador
- **Busca no curso:** trocar a chave; editar credencial; renomear chave; excluir chave; apagar credencial; chave vazou; chave nova no lugar da antiga

1. **Abrir a edição** — `/app/ai/credentials`  
   A chave antiga da recepção foi recusada pelo provedor. Para trocá-la, clique no lápis, "Editar credencial", no cartão dela.
2. **Colar a chave nova**  
   Cole a chave nova em "Nova chave (opcional)" e clique em "Salvar". Trocar a chave por aqui mantém os agentes ligados a ela. Depois de salvar, o sistema confere a chave nova com o provedor: assim que o selo mostrar "Validada", os agentes já usam a chave nova. Se o selo mostrar "Inválida", eles ficam sem chave até você corrigir.
   > 💡 Se uma chave vazou, crie outra no site do provedor, troque aqui e depois apague a antiga lá no provedor.
3. **Mudar só o nome** — `/app/ai/credentials`  
   Para mudar só o nome, abra a edição pelo lápis, troque o "Nome" e deixe "Nova chave (opcional)" em branco. Assim a chave continua a mesma e nada é conferido de novo. Aqui a "Chave de testes" ganha um nome que diz para que ela serve. O botão "Salvar" só fica disponível quando algo mudou.
4. **O nome novo na lista**  
   O cartão já aparece com o nome novo. Os quatro últimos caracteres e o selo continuam iguais, porque a chave não mudou.
5. **Excluir uma chave**  
   A lixeira, "Excluir credencial", apaga a chave do sistema. Antes, uma janela pede confirmação: "Remover" apaga de vez, e "Cancelar" desiste. Não dá para desfazer.
   > 💡 Uma chave ligada a alguma versão de agente não pode ser excluída: com "Em uso por" maior que zero, a lixeira fica apagada, e passar o mouse sobre ela mostra o motivo. Para trocar essa chave, use o lápis.

---

<a id="m-provedores"></a>

## Provedores

**Tela:** `/app/ai/providers`  
**Resumo:** Onde você vê qual inteligência artificial atende cada parte do sistema, troca o modelo de uma parte e liga o Jev, a IA das decisões rápidas.

**Lições:** [Conhecendo a tela de Provedores](#l-provedores--provedores-conhecendo-a-tela) · [Trocar a IA de uma parte do sistema](#l-provedores--provedores-trocar-a-ia-de-uma-parte) · [Ligar o Jev, a IA das decisões rápidas](#l-provedores--provedores-ligar-o-jev)

<a id="l-provedores--provedores-conhecendo-a-tela"></a>

### Conhecendo a tela de Provedores

- **Objetivo:** Achar a tela, entender o que é o modelo padrão e como a tela agrupa as partes do sistema que usam IA.
- **Papel mínimo:** Gerente
- **Busca no curso:** provedor de ia; qual ia o sistema usa; trocar o modelo; modelo padrão; claude ou gpt; onde configuro a inteligência artificial

1. **Onde fica a tela** — `/app/ai`  
   Provedores não aparece direto no menu lateral. No grupo "Agente de IA" do menu, clique em "Ver tudo em IA". Na parte "Montar o agente" está o cartão "Provedores". O caminho completo é: Agente de IA › Ver tudo em IA › Provedores.
   > 💡 Só gerente ou administrador vê este cartão. Para os outros papéis, o endereço da tela leva à página "403 — Sem permissão".
2. **Para que serve a tela** — `/app/ai/providers`  
   O sistema usa inteligência artificial em vários lugares: para responder o cliente, para perceber se ele está irritado, para resumir uma conversa longa e outros. Cada empresa de IA é um provedor, como a Anthropic (Claude) ou a OpenAI (GPT). Esta tela mostra qual provedor e qual modelo atende cada lugar, e deixa trocar.
   > 💡 Se aparecer um aviso amarelo no alto, a empresa ainda não cadastrou a chave da própria IA. O link "Cadastrar uma chave" leva à tela Credenciais.
3. **O modelo padrão**  
   O "Modelo padrão" vale para toda parte que ninguém configurou à parte. A frase do cartão diz quantas partes seguem o padrão hoje. Em "Provedor" fica a empresa de IA, e em "Modelo", qual modelo dela. Trocar aqui muda todas essas partes de uma vez.
   > 💡 Só o administrador vê o botão "Salvar padrão". O gerente vê o que está em uso, mas não troca.
4. **As partes, agrupadas pelo que fazem**  
   Mais abaixo, as partes que usam IA vêm em grupos, pelo que cada uma faz: "Atender o cliente", "Entender a conversa", "Proteger a operação" e outros. Cada grupo diz, em "Usando:", quais modelos atendem as partes dele. Se uma parte precisa de atenção, aparece uma frase em amarelo. "Configuração avançada" abre o grupo para ver cada parte sozinha.

<a id="l-provedores--provedores-trocar-a-ia-de-uma-parte"></a>

### Trocar a IA de uma parte do sistema

- **Objetivo:** Abrir uma parte, entender o que acontece se ela falhar e escolher outro provedor, modelo e chave só para ela.
- **Papel mínimo:** Administrador
- **Busca no curso:** modelo diferente para uma tarefa; trocar o modelo de uma parte; configuração avançada da ia; se falhar; modelo mais barato

1. **Abrir uma parte** — `/app/ai/providers`  
   No grupo "Entender a conversa", clique em "Configuração avançada". Cada parte vira um cartão. Este é "Medir o clima da conversa", a parte que percebe se o cliente está satisfeito ou irritado. À direita ficam o modelo que atende hoje e de onde veio essa escolha.
2. **O que acontece se falhar**  
   A faixa cinza "Se falhar:" conta o que você vai notar no dia a dia se esta parte parar. Aqui: cliente irritado deixa de ser passado para uma pessoa. É o que ajuda a decidir se vale pôr um modelo mais forte ou se um mais barato dá conta.
3. **Escolher provedor, modelo e chave**  
   Em "Provedor", escolha a empresa de IA. Em "Modelo", o modelo dela. Em "Chave", qual das chaves cadastradas em Credenciais paga esta parte: em branco, vale a chave da instalação. Depois, clique em "Salvar". A troca vale só para esta parte; as outras continuam como estavam.
   > 💡 Se a lista de modelos daquele provedor ainda não foi baixada, "Modelo" vira um campo de texto: escreva o nome do modelo como o provedor o chama.
4. **A resposta ao cliente vem do agente**  
   No grupo "Atender o cliente", a parte "Responder o cliente" não tem os campos de troca. Ela usa o modelo escolhido no próprio agente, na versão publicada dele. Para trocar, clique em "Configurar no agente".

<a id="l-provedores--provedores-ligar-o-jev"></a>

### Ligar o Jev, a IA das decisões rápidas

- **Objetivo:** Entender o que o Jev faz, de onde pegar a chave dele e como colá-la no sistema.
- **Papel mínimo:** Administrador
- **Busca no curso:** jev; typesafe; cliente irritado; decisões rápidas; chave do jev; ligar o jev

1. **O cartão do Jev** — `/app/ai/providers`  
   O Jev não conversa com o cliente. Ele só toma decisões pequenas e rápidas, como perceber se o cliente está irritado, geralmente em menos de um segundo, e trabalha junto com a sua IA principal. O selo no canto diz a situação: aqui, "Desligado". O aviso amarelo vale para clínicas: as mensagens que o Jev lê podem ter dado de saúde, que a LGPD trata como sensível.
2. **De onde o Jev responde**  
   Em "De onde o Jev responde", escolha o caminho. "TypeSafe AI (chave própria)" usa uma conta só para o Jev, na TypeSafe. "OpenRouter" reaproveita a chave da OpenRouter que a empresa já usa na conversa, sem segunda conta. A frase embaixo explica o caminho escolhido.
3. **Pegar a chave**  
   O Jev é pago à parte, numa conta da TypeSafe AI: cada mensagem medida custa uma fração de centavo de dólar, cobrada lá. Clique em "Pegar a chave na TypeSafe", crie a conta, ponha crédito e copie a chave. Ela começa com "apikey_".
4. **Colar a chave**  
   De volta aqui, clique em "Colar a chave". Abre o mesmo formulário da tela Credenciais, já com "Jev (TypeSafe AI)" escolhido em "Provedor". Dê um nome e cole a chave em "Chave"; ela aparece como bolinhas. Clique em "Salvar e validar": o sistema guarda a chave e confere com a TypeSafe se ela vale.
   > 💡 Com a chave conferida, aparece "Ligar o Jev". Ele começa só observando: a sua IA de sempre continua decidindo, e o cartão mostra quantas vezes os dois concordaram antes de você deixar o Jev decidir.

---

<a id="m-conhecimento"></a>

## Conhecimento

**Tela:** `/app/ai/knowledge/sources`  
**Resumo:** O material da sua empresa que o agente de IA lê antes de responder: perguntas frequentes, preparos, políticas. Aqui você ensina, confere e tira do ar.

**Lições:** [Conhecendo a tela de Conhecimento](#l-conhecimento--conhecimento-conhecendo-a-tela) · [Cadastrar a chave que prepara o material](#l-conhecimento--conhecimento-cadastrar-a-chave) · [Ensinar algo novo ao agente](#l-conhecimento--conhecimento-ensinar-algo-novo) · [Conferir, corrigir e arquivar](#l-conhecimento--conhecimento-conferir-corrigir-arquivar)

<a id="l-conhecimento--conhecimento-conhecendo-a-tela"></a>

### Conhecendo a tela de Conhecimento

- **Objetivo:** Entender o que é o acervo do agente, o que o aviso da chave quer dizer e o que cada cartão de material mostra.
- **Papel mínimo:** Administrador
- **Busca no curso:** base de conhecimento; o que o agente sabe; ensinar o agente; material do agente; perguntas frequentes do agente; agente responde errado; acervo

1. **Onde fica a tela** — `/app/ai`  
   Conhecimento não aparece direto no menu lateral. No grupo "Agente de IA" do menu, clique em "Ver tudo em IA". Na parte "Ensinar o agente" está o cartão "Conhecimento". O caminho completo é: Agente de IA › Ver tudo em IA › Conhecimento.
   > 💡 Só gerente ou administrador vê este cartão. Para um atendente, ou para quem só tem permissão de leitura, ele não aparece, e o endereço da tela leva a uma página de acesso negado.
2. **O que o agente sabe** — `/app/ai/knowledge/sources`  
   O agente de IA é o atendente virtual que responde os pacientes no WhatsApp. Esta tela, "O que o agente sabe", guarda o material da clínica que ele lê antes de responder: perguntas frequentes, preparo de exames, valores. Com o material, ele procura a resposta certa em vez de improvisar. A tela é da empresa toda: cada assistente escolhe, na tela dele, quais destes materiais pode ler.
3. **O aviso da chave**  
   Para o agente conseguir procurar no material, o sistema prepara o texto com a ajuda de um serviço de inteligência artificial: a OpenAI, a OpenRouter ou o Google. Isso pede uma chave desse serviço, chamada "chave de embedding". Quando a chave está valendo, no lugar deste aviso aparece a frase "Pronto para preparar material." e qual chave está em uso. Nesta clínica o material foi preparado pela OpenAI, e a chave da OpenAI não está mais utilizável. Por isso o aviso com o triângulo: enquanto isso não for resolvido, o agente não consegue consultar o material.
   > 💡 Uma chave deixa de ser utilizável quando é apagada, desativada ou recusada na conferência com o serviço. Como cadastrar a chave está na lição "Cadastrar a chave que prepara o material".
4. **O estado da base**  
   O quadro "Estado da base de conhecimento" faz a conta dos materiais do acervo, sem os arquivados. "Prontos" são os que o agente já encontra. "Com erro" são os que falharam ao preparar. Quando algum está sendo preparado naquele momento, aparece também "preparando". O material que está esperando a chave entra no total, mas não em "prontos" nem em "com erro". Quando há falha, a linha de baixo, com o triângulo, diz onde ver o motivo.
   > 💡 Com chave valendo e tudo preparado, o quadro mostra "tudo pronto", em verde. Sem nenhum material, o quadro nem aparece.
5. **A linha de comandos**  
   À esquerda, a tela diz quantos materiais estão no acervo, sem contar os arquivados. "Adicionar material" abre o formulário para ensinar algo novo ao agente. "Preparar tudo de novo" manda o sistema preparar de novo todos os materiais; o que já estava pronto e não mudou é pulado. Esse botão fica apagado enquanto não houver uma chave valendo.
   > 💡 A lista se atualiza sozinha: quando o sistema termina de preparar um material, o cartão muda sem você recarregar a página.
6. **O que cada cartão mostra**  
   Cada cartão é um material. No alto vêm o nome e, embaixo, o tipo, como "Perguntas e respostas". "Preparado" diz há quanto tempo o sistema preparou o material pela última vez, ou "nunca". "Trechos que o agente encontra" é em quantos pedaços o texto foi dividido para a busca. "Consultado por" lista os assistentes que leem este material.
   > 💡 "Nenhum assistente ainda", em laranja, quer dizer que nenhum assistente marcou este material. Para ligar, abra "Agentes", entre no assistente, marque o material em "O que ele consulta antes de responder" e publique. Só conta a versão publicada.
7. **O selo de cada material**  
   O selo colorido no canto do cartão diz em que pé está o material. "O agente já sabe", em verde: está preparado e o agente encontra. "Não entrou", em vermelho: a preparação falhou, e o motivo está em "Por que não entrou". "Esperando a chave", em laranja: o material foi guardado, mas só será preparado quando houver uma chave valendo. Existe ainda "Entrou pela metade", em laranja: só parte do material foi preparada. Ele entra na conta "com erro" do quadro de cima. Clique em "Preparar de novo" para tentar completar.
   > 💡 Dois selos não aparecem aqui. "Ainda não preparado", em cinza, é o do material que ainda não passou pela preparação, como um recém-cadastrado. "Preparando…", em azul, aparece enquanto o sistema prepara.

<a id="l-conhecimento--conhecimento-cadastrar-a-chave"></a>

### Cadastrar a chave que prepara o material

- **Objetivo:** Saber de onde vem a chave de embedding e cadastrá-la sem sair da tela de Conhecimento.
- **Papel mínimo:** Administrador
- **Busca no curso:** chave de embedding; chave da openai; falta uma chave; material não prepara; esperando a chave; openrouter; chave do google

1. **Quem prepara a base** — `/app/ai/knowledge/sources`  
   Dentro do aviso, a linha "Quem prepara a base" diz qual serviço preparou o material desta clínica: aqui, a OpenAI. Para resolver sem sair da tela, clique em "Cadastrar a chave aqui". O link "IA › Credenciais" leva à tela com todas as chaves de IA da empresa.
   > 💡 O material já preparado só é encontrado com o mesmo serviço que o preparou. Por isso uma chave de outro serviço não é usada sozinha.
2. **Escolher o serviço**  
   Em "Provedor da chave de embedding", escolha de qual serviço é a chave: OpenAI, OpenRouter ou Google. Como esta base é preparada pela OpenAI, a chave precisa ser da OpenAI ou da OpenRouter. O texto dos materiais é enviado ao serviço escolhido para preparar a busca. Em "Como você quer chamar esta chave" dê um nome para reconhecê-la depois; se deixar em branco, ela fica com o nome sugerido, como "Chave da OpenAI".
   > 💡 Se você cadastrar uma chave do Google, ela não é usada sozinha: aparece o botão "Trocar para o Google", e a troca prepara toda a base de novo.
3. **Colar a chave e salvar**  
   No campo "Chave da OpenAI", cole a chave que você criou no site do serviço; o endereço aparece logo abaixo do campo, como platform.openai.com/api-keys. A chave é guardada cifrada e nunca aparece de volta na tela. Clique em "Salvar chave". O sistema confere a chave com o serviço, o que leva alguns segundos. Quando ela for aceita, o aviso dá lugar a "Pronto para preparar material.", com o nome da chave.
   > 💡 Com a chave valendo, clique em "Preparar tudo de novo" para preparar o material que ficou para trás. "Cancelar" fecha o formulário sem guardar nada. Só o administrador consegue salvar a chave. Um gerente vê o aviso e o formulário, mas ao clicar em "Salvar chave" recebe uma mensagem de que não tem permissão.

<a id="l-conhecimento--conhecimento-ensinar-algo-novo"></a>

### Ensinar algo novo ao agente

- **Objetivo:** Cadastrar um material novo: escolher o tipo, escrever perguntas e respostas no formato certo e guardar no acervo.
- **Papel mínimo:** Administrador
- **Busca no curso:** adicionar material; cadastrar perguntas frequentes; ensinar o agente; subir pdf para o agente; colar texto para o agente; faq do agente

1. **Abrir o formulário** — `/app/ai/knowledge/sources`  
   Para ensinar algo novo ao agente, clique em "Adicionar material", à direita, acima dos cartões.
2. **Que tipo de material é**  
   Primeiro escolha o tipo. "Perguntas e respostas" já vem marcado: são as dúvidas que se repetem, com a resposta pronta. É o formato que o agente usa melhor, porque cada resposta chega inteira. "Documento" é um texto corrido, como uma política ou um manual. "Conversas anteriores" e "Catálogo de produtos" ficam apagados: o sistema os preenche sozinho, e não dá para digitar nada neles.
3. **Um documento: arquivo ou texto**  
   Com "Documento", você envia um arquivo ou cola o texto. Em "Arquivo (opcional)" vão PDF, Markdown, CSV ou texto, até 20 MB. Se não tiver o arquivo, cole o texto no campo "…ou cole o texto aqui". O PDF precisa ter texto que dê para selecionar: um PDF só de imagens escaneadas não tem letra nenhuma para o sistema ler.
   > 💡 Planilha do Excel não entra direto: salve como CSV antes de enviar.
4. **Escrever perguntas e respostas**  
   Agora vamos cadastrar perguntas e respostas. Clique de novo em "Perguntas e respostas". Em "Nome do material" dê um nome que você reconheça depois. Em "Conteúdo", escreva cada item em duas linhas: uma começando com "## Pergunta:" e outra com "## Resposta:". Deixe uma linha em branco entre um item e outro.
   > 💡 As marcas "## Pergunta:" e "## Resposta:" são escritas em português, mesmo com a tela em outro idioma. Sem elas, o sistema não acha nenhum par e não guarda o material.
5. **Guardar no acervo**  
   Antes do botão, o formulário avisa, em letras cor de laranja, quando não há chave valendo: o material fica guardado e esperando, e o agente só passa a conhecê-lo depois que a chave for cadastrada. Clique em "Adicionar ao acervo". "Cancelar" fecha o formulário sem guardar nada.
6. **O material entrou no acervo**  
   O material novo aparece primeiro na grade, com o selo "Ainda não preparado". Com uma chave valendo, o sistema começa a preparar em instantes: o selo passa para "Preparando…" e depois para "O agente já sabe". Sem chave, como nesta clínica, o selo passa para "Esperando a chave".
   > 💡 Material novo ainda não é lido por nenhum assistente. Marque-o na tela do assistente, em "O que ele consulta antes de responder", e publique.

<a id="l-conhecimento--conhecimento-conferir-corrigir-arquivar"></a>

### Conferir, corrigir e arquivar

- **Objetivo:** Ler o que está guardado num material, ver o que o agente aprendeu dele, corrigir o conteúdo, entender por que um material não entrou e tirar um material do ar.
- **Papel mínimo:** Administrador
- **Busca no curso:** ler o material; o que o agente aprendeu; editar perguntas frequentes; material não entrou; preparar de novo; arquivar material; agente responde errado

1. **Ler o material** — `/app/ai/knowledge/sources`  
   Para ver o que está guardado num material, clique em "Ler o material", no pé do cartão. Clicar no nome do material faz o mesmo.
2. **O conteúdo guardado**  
   A página mostra o material como ele foi cadastrado. Num material de perguntas e respostas, cada item aparece com a "Pergunta" em cima e a "Resposta" embaixo. Num documento, aparece o texto inteiro. Para voltar à lista, clique em "Voltar ao acervo".
3. **O que o agente aprendeu** — `/app/ai/knowledge/sources`  
   "Ver o que ele aprendeu" mostra os trechos que o agente procura antes de responder: os pedaços em que o sistema dividiu o material. Quando o agente erra sobre um assunto, é aqui que se vê o porquê. Ao lado de cada trecho aparece o tamanho dele em tokens, a medida de texto que os serviços de IA usam. O botão só aparece quando o material já tem trechos.
4. **Corrigir o conteúdo** — `/app/ai/knowledge/sources`  
   "Editar conteúdo" abre o texto atual do material, no mesmo formato de "## Pergunta:" e "## Resposta:". Mude o que precisar e clique em "Salvar conteúdo". O que você salvar substitui o conteúdo de antes, e o sistema prepara o material de novo.
   > 💡 "Editar conteúdo" só existe nos materiais de perguntas e respostas. Um documento não se edita aqui: para trocar, arquive o antigo e cadastre a versão nova.
5. **Por que não entrou** — `/app/ai/knowledge/sources`  
   Num material com o selo "Não entrou", clique em "Por que não entrou" para ver o motivo. Ele vem como o serviço respondeu, às vezes em inglês. Aqui, "Incorrect API key provided" quer dizer que a OpenAI recusou a chave. Depois de resolver o motivo, por exemplo cadastrando uma chave que funcione, clique em "Preparar de novo" para o sistema tentar outra vez.
   > 💡 Quando um material não entra, a Central de avisos também recebe um aviso.
6. **Arquivar um material** — `/app/ai/knowledge/sources`  
   Para tirar um material do ar, clique em "Arquivar". Não há pergunta de confirmação: o clique arquiva na hora, e nenhum assistente consulta mais aquele material. Antes, olhe "Consultado por": os assistentes listados ali deixam de saber daquele assunto.
7. **Os arquivados**  
   O material sai da grade e entra na lista de arquivados, no fim da tela. Clique nela para ver os nomes. Material arquivado não é apagado, mas também não tem botão para voltar: para usar o conteúdo de novo, cadastre-o outra vez. Você pode usar o mesmo nome do material arquivado. Dois materiais em uso, porém, não podem ter o mesmo nome.

---

<a id="m-memoria"></a>

## Memória

**Tela:** `/app/ai/memory`  
**Resumo:** As regras da casa e os aprendizados que todos os agentes de IA da empresa seguem em qualquer conversa: escrever, publicar, voltar a uma versão antiga e arquivar o que não vale mais.

**Lições:** [Conhecendo a tela de Memória](#l-memoria--memoria-conhecendo-a-tela) · [Escrever e publicar as regras da casa](#l-memoria--memoria-publicar-o-documento) · [Voltar a uma versão anterior](#l-memoria--memoria-voltar-versao) · [Ensinar, arquivar e reativar aprendizados](#l-memoria--memoria-aprendizados)

<a id="l-memoria--memoria-conhecendo-a-tela"></a>

### Conhecendo a tela de Memória

- **Objetivo:** Entender o que a Memória da IA guarda, onde ela fica e de onde vem cada aprendizado.
- **Papel mínimo:** Administrador
- **Busca no curso:** memória da ia; regras da casa; regras para todos os agentes; o que o agente aprendeu; política da clínica para o agente; ensinar o agente; aprendizados do agente

1. **Onde fica a tela** — `/app/ai`  
   Memória não aparece direto no menu lateral. No grupo "Agente de IA" do menu, clique em "Ver tudo em IA". Na parte "Ensinar o agente" está o cartão "Memória". O caminho completo é: Agente de IA › Ver tudo em IA › Memória.
   > 💡 Só gerente ou administrador vê este cartão. Para um atendente, ou para quem só tem permissão de leitura, ele não aparece, e o endereço da tela leva a uma página de acesso negado.
2. **Para que serve** — `/app/ai/memory`  
   O agente de IA é o atendente virtual que conversa com os pacientes. A "Memória da IA" guarda as regras e os aprendizados que TODOS os agentes de IA da clínica seguem. Ela não é a configuração de um agente só: o que está aqui vale para todos de uma vez. Antes de cada resposta, o agente lê o que está em vigor nesta tela.
   > 💡 O que vale para um agente só, como o jeito de falar da recepção, fica na tela daquele agente, em "Agentes". Aqui ficam as regras comuns, escritas uma vez só.
3. **O documento da organização**  
   O primeiro quadro, "Documento da organização", é o texto-base com as regras gerais da clínica: endereço, horário, o que o agente nunca deve fazer. Escreva como você explicaria a um atendente novo. O selo "v2 ativa" diz que os agentes estão lendo a versão 2 deste texto.
   > 💡 Se, na configuração inicial do sistema, você preencheu "As regras da casa (opcional)", esse texto já aparece aqui como a primeira versão. Antes de qualquer publicação, o selo diz "Nenhuma versão publicada ainda".
4. **O histórico de versões**  
   Cada vez que alguém publica o documento, nasce uma versão nova, com número, data e hora. A anterior não é apagada: fica guardada em "Histórico de versões". O selo "ativa" marca a versão que os agentes estão lendo. Clicar numa versão mostra o texto dela.
   > 💡 Como voltar a um texto antigo está na lição "Voltar a uma versão anterior".
5. **Os aprendizados**  
   O segundo quadro, "Aprendizados", guarda fatos e correções pontuais, um por item, como o estacionamento conveniado. Cada item tem um título, um selo de origem, a data em que entrou e, embaixo, o texto que o agente lê. Os agentes levam em conta todos os aprendizados ativos, junto com o documento.
6. **De onde veio cada aprendizado**  
   O selo ao lado do título diz quem escreveu o aprendizado. "manual": alguém da equipe escreveu nesta tela. "aprendido automaticamente": o sistema revisou conversas reais, sugeriu o aprendizado, e um administrador aprovou a sugestão. "anotado pelo agente": um agente de IA anotou sozinho, durante o trabalho.
   > 💡 As sugestões automáticas não aparecem nesta tela: elas esperam na aba "Propostas" da tela de um agente e só viram aprendizado quando um administrador clica em "Aplicar como memória da org". Nesse caso, o título é o começo do próprio texto. O agente só anota sozinho quando tem ligada a ferramenta "Anotar uma regra aprendida".

<a id="l-memoria--memoria-publicar-o-documento"></a>

### Escrever e publicar as regras da casa

- **Objetivo:** Mudar o texto-base que todos os agentes seguem e colocar a versão nova em vigor.
- **Papel mínimo:** Administrador
- **Busca no curso:** publicar regras; mudar as regras do agente; editar memória; regra nova para o agente; agente não segue regra; publicar versão; política da casa

1. **O que escrever aqui** — `/app/ai/memory`  
   Tudo o que está neste quadro vai junto em cada resposta do agente. Por isso, guarde aqui só regras curtas que valem para qualquer atendimento: endereço, horário, o que nunca prometer. Uma regra por linha, em frases diretas. Material longo, como perguntas frequentes ou o preparo de exames, fica melhor em "Conhecimento", onde o agente procura o trecho que tem a ver com a pergunta.
   > 💡 Só o administrador publica. Um gerente também abre esta tela e consegue escrever no quadro, mas o botão "Publicar versão" fica apagado, com o aviso "Somente admins podem publicar uma nova versão.".
2. **Escrever a regra nova**  
   Clique no quadro e escreva. Aqui, a clínica acrescentou no fim uma regra sobre remarcação. Embaixo, o contador mostra quantos caracteres o texto tem. Enquanto você escreve, nada muda para os agentes. O botão "Publicar versão" só acende quando o texto está diferente da versão ativa e não está vazio.
   > 💡 O texto só fica guardado quando você publica. Se sair da tela antes, o que escreveu se perde.
3. **A versão nova vale para todos**  
   Depois do clique, o texto vira a versão 3, e o selo passa a dizer "v3 ativa". Um aviso rápido confirma a publicação. Na próxima resposta, todos os agentes já seguem o texto novo. A versão 2 continua guardada no histórico, logo abaixo.

<a id="l-memoria--memoria-voltar-versao"></a>

### Voltar a uma versão anterior

- **Objetivo:** Recuperar o texto de uma versão antiga do documento sem apagar nenhuma versão.
- **Papel mínimo:** Administrador
- **Busca no curso:** voltar versão; desfazer regra; versão anterior da memória; restaurar regras; histórico de versões; regra nova deu problema

1. **Abrir uma versão antiga** — `/app/ai/memory`  
   Se uma regra nova deu problema, dá para voltar a um texto antigo. Em "Histórico de versões", clique na versão que você quer ver. Aqui, a v1.
2. **Ler o texto da versão**  
   Abre uma janela com o título "Versão v1", a data em que ela foi publicada e o texto exato daquela versão. Para fechar sem mudar nada, clique no X. Para voltar a esse texto, clique em "Restaurar como nova versão".
3. **Conferir e publicar**  
   O texto da v1 é copiado para o quadro, e a janela fecha. Por enquanto nada mudou para os agentes: o selo ainda diz "v2 ativa", e um aviso rápido lembra de clicar em "Publicar versão" para confirmar. Confira o texto, ajuste se quiser e publique. Ele entra como uma versão nova, a v3. A v2 continua no histórico: nenhuma versão é apagada.
   > 💡 Restaurar a versão que já está ativa só traz de volta o texto dela. Como ele é igual ao que já vale, o botão "Publicar versão" fica apagado.

<a id="l-memoria--memoria-aprendizados"></a>

### Ensinar, arquivar e reativar aprendizados

- **Objetivo:** Ensinar aos agentes um fato pontual e tirar de uso o que não vale mais, sem perder nada.
- **Papel mínimo:** Administrador
- **Busca no curso:** novo aprendizado; ensinar um fato ao agente; corrigir o agente; arquivar aprendizado; reativar aprendizado; apagar aprendizado; o que o agente anotou

1. **Abrir o formulário** — `/app/ai/memory`  
   Um aprendizado é um fato ou uma correção pontual, como "o retorno em até 30 dias não é cobrado". Ao contrário do documento, ele não tem versão nem precisa ser publicado. Para ensinar um, clique em "Novo aprendizado", no quadro "Aprendizados".
   > 💡 Gerente também cria, arquiva e reativa aprendizados.
2. **Escrever o aprendizado**  
   Em "Título", escreva um resumo curto, de até 200 caracteres. Em "O que o agente deve saber", escreva a regra em texto simples, do jeito que você explicaria a um colega. Os dois campos são obrigatórios. Depois, clique em "Salvar aprendizado". "Cancelar" fecha o formulário sem guardar.
3. **O aprendizado já vale**  
   O aprendizado novo aparece no topo da lista, com o selo "manual" e a data de hoje. Ele já vale: na próxima resposta, todos os agentes o levam em conta.
4. **Arquivar o que não vale mais**  
   Quando um aprendizado deixa de valer, ou quando você não concorda com algo que um agente anotou, clique em "Arquivar", no pé do item. Aqui, vamos arquivar a anotação do agente sobre o pilates.
   > 💡 Não existe botão de apagar. Arquivar tira o aprendizado de uso sem perder o texto.
5. **Onde ficam os arquivados**  
   O item sai da lista, e os agentes deixam de considerá-lo a partir da próxima resposta. Ele não foi apagado: fica entre os arquivados. Para vê-los, clique em "Ver aprendizados arquivados". Essa opção só aparece quando existe pelo menos um aprendizado arquivado.
6. **Reativar um aprendizado**  
   Agora a lista mostra só os arquivados, cada um com o botão "Reativar". Reativar devolve o aprendizado à lista dos ativos, e os agentes voltam a levá-lo em conta. Para voltar à lista dos ativos, clique em "Ver aprendizados ativos".

---

<a id="m-skills"></a>

## Skills

**Tela:** `/app/ai/skills`  
**Resumo:** Manuais curtos de como agir em situações específicas, que o agente de IA consulta quando o assunto aparece na conversa: instalar do catálogo, editar e manter atualizados.

**Lições:** [Conhecendo a tela de Skills](#l-skills--skills-conhecendo-a-tela) · [Instalar e desinstalar uma skill do catálogo](#l-skills--skills-instalar-e-desinstalar) · [Editar uma skill](#l-skills--skills-editar-uma-skill) · [Adotar a versão nova de uma skill do catálogo](#l-skills--skills-versao-nova-do-catalogo)

<a id="l-skills--skills-conhecendo-a-tela"></a>

### Conhecendo a tela de Skills

- **Objetivo:** Entender o que é uma skill, quando o agente usa uma e o que cada parte da tela mostra.
- **Papel mínimo:** Administrador
- **Busca no curso:** skills; habilidades da IA; ensinar procedimento ao agente; playbook do agente; o que a IA sabe fazer; skills instaladas; catálogo de skills

1. **Onde fica a tela** — `/app/ai`  
   Skills não aparece direto no menu lateral. No grupo "Agente de IA" do menu, clique em "Ver tudo em IA". Na parte "Ensinar o agente" está o cartão "Skills". O caminho completo é: Agente de IA › Ver tudo em IA › Skills.
   > 💡 Só gerente ou administrador vê este cartão. Para um atendente, ou para quem só tem permissão de leitura, ele não aparece, e o endereço da tela leva à página "403 — Sem permissão".
2. **O que é uma skill** — `/app/ai/skills`  
   Uma skill é um manual curto de como agir numa situação específica, como marcar um horário ou explicar o preparo para a primeira consulta. O agente de IA sempre sabe que a skill existe, pelo nome e pela descrição. O passo a passo completo entra na conversa quando o assunto aparece: quando o cliente escreve uma das palavras-chave da skill, ou quando a conversa ou o contato tem uma etiqueta escolhida. Assim o agente não precisa carregar todos os manuais em toda resposta. A tela tem duas partes: "Skills instaladas", as que a sua empresa instalou ou enviou, e "Catálogo", as prontas da plataforma.
   > 💡 Uma skill vale para todos os agentes de IA da empresa. Esta tela não tem como ligar uma skill só para um agente.
3. **O que cada skill instalada mostra**  
   Cada skill instalada mostra o nome, um selo de origem e, à direita, a data da última mudança, em "atualizada em". O selo "manual" quer dizer que a sua equipe enviou a skill num arquivo .zip. O selo "do catálogo" quer dizer que ela foi instalada do Catálogo. Embaixo vem a descrição, a frase que o agente lê para saber para que a skill serve. "Editar" abre o texto da skill e "Desinstalar" tira a cópia da sua empresa.
4. **Enviar uma skill da sua equipe**  
   "Enviar skill (.zip)" instala uma skill escrita pela sua equipe. O arquivo .zip precisa ter, na raiz, um arquivo chamado SKILL.md, com o nome, a descrição e as palavras-chave no começo e o passo a passo logo abaixo. Ele também pode trazer as pastas "references" e "assets", com material de apoio. Se você enviar um .zip com o nome de uma skill que já existe, a sua versão passa a valer no lugar dela.
   > 💡 O pacote aceita até 64 arquivos e 5 MB depois de descompactado. O passo a passo pode ter no máximo 200 linhas. O nome da skill não pode ter acento nem ç.
5. **O Catálogo**  
   No "Catálogo" ficam as skills prontas que a plataforma mantém e que a sua empresa ainda não instalou. Aqui sobrou a "objecao-preco", que ensina o agente a lidar com o cliente que acha caro, sem dar desconto que não foi autorizado. Atenção: mesmo sem instalar, uma skill do catálogo já vale para os seus agentes. "Instalar" cria uma cópia da sua empresa, que você pode editar.

<a id="l-skills--skills-instalar-e-desinstalar"></a>

### Instalar e desinstalar uma skill do catálogo

- **Objetivo:** Instalar uma skill pronta da plataforma e saber o que acontece quando ela é desinstalada.
- **Papel mínimo:** Administrador
- **Busca no curso:** instalar skill; skill do catálogo; cliente achou caro; objeção de preço; desinstalar skill; remover skill; copiar skill pronta

1. **Instalar** — `/app/ai/skills`  
   Para instalar uma skill do catálogo, clique em "Instalar" na linha dela. Vamos instalar a "objecao-preco".
2. **A skill passou para Skills instaladas**  
   Pronto: a "objecao-preco" entrou em "Skills instaladas", com o selo "do catálogo", e aparece por alguns segundos uma mensagem confirmando. O "Catálogo" ficou vazio, porque a sua empresa já instalou tudo o que a plataforma oferece hoje. A cópia é da sua empresa: dá para editar sem mexer no catálogo.
3. **Desinstalar**  
   "Desinstalar" apaga na hora a cópia da sua empresa, sem pedir confirmação. Numa skill "do catálogo", como esta, a versão da plataforma volta a valer para os agentes, como antes de instalar. Numa skill "manual", o agente deixa de usá-la, a não ser que ela tenha o mesmo nome de uma skill do catálogo: aí volta a valer a do catálogo.
   > 💡 As versões da cópia não são apagadas: se você instalar a mesma skill de novo, elas voltam a aparecer no "Histórico de versões", em "Editar".
4. **De volta ao Catálogo**  
   A "objecao-preco" saiu de "Skills instaladas" e voltou para o "Catálogo", com o botão "Instalar". Os agentes seguem usando a versão da plataforma.

<a id="l-skills--skills-editar-uma-skill"></a>

### Editar uma skill

- **Objetivo:** Mudar quando uma skill entra na conversa e o que ela manda o agente fazer, sem perder a versão anterior.
- **Papel mínimo:** Administrador
- **Busca no curso:** editar skill; palavras-chave da skill; quando a skill entra; etiqueta que ativa skill; mudar procedimento do agente; voltar versão da skill; histórico de versões

1. **Abrir a skill** — `/app/ai/skills`  
   Vamos ajustar a "preparo-primeira-consulta", que a clínica escreveu para orientar quem vem pela primeira vez. Clique em "Editar", na linha dela.
2. **Descrição e palavras-chave**  
   A janela "Editar skill" mostra a skill em partes. "Descrição" é a frase curta que o agente sempre lê, para saber que a skill existe e para que serve; ela ocupa uma linha só, com até 500 caracteres. "Palavras-chave de ativação" são as palavras que fazem o passo a passo entrar na conversa: basta uma delas aparecer nas mensagens mais recentes do cliente. Maiúsculas e acentos não fazem diferença. Separe as palavras por vírgula; é preciso ter pelo menos uma.
3. **Acrescentar uma palavra e usar etiquetas**  
   Os pacientes perguntam muito se precisam ir em jejum. O passo a passo já responde isso, mas a palavra "jejum" não estava na lista: acrescentamos no fim, depois de uma vírgula. "Etiquetas que ativam" é opcional: se a conversa ou o contato tiver uma dessas etiquetas, a skill entra mesmo sem nenhuma palavra-chave. Aqui, quem tem a etiqueta "primeira-consulta" recebe este preparo mesmo que só diga "oi". Escreva a etiqueta igual à usada nas conversas e nos contatos: ela precisa ser a mesma palavra, não vale só um pedaço.
4. **O passo a passo e o histórico**  
   "Corpo" é o passo a passo que o agente segue quando a skill entra na conversa. Ele cabe em até 200 linhas: o contador ao lado mostra quantas já foram usadas e fica vermelho quando passa do limite, e aí o botão "Salvar" fica desligado. Embaixo, "Histórico de versões" lista cada versão guardada, com dia e hora; "em uso" marca a que vale agora.
5. **Salvar**  
   Clique em "Salvar". Salvar não apaga nada: cria uma versão nova, e a anterior fica guardada no histórico. "Cancelar" fecha a janela sem guardar.
6. **Voltar a uma versão anterior**  
   A janela fecha e aparece por alguns segundos a mensagem de que a skill foi atualizada e já vale para os agentes. Abrindo "Editar" de novo, a palavra "jejum" está na lista e o "Histórico de versões" tem duas linhas: a versão nova, "em uso", e a anterior. Se a mudança não ficou boa, clique em "Restaurar" ao lado da versão anterior: ela volta a valer na hora, sem precisar salvar.

<a id="l-skills--skills-versao-nova-do-catalogo"></a>

### Adotar a versão nova de uma skill do catálogo

- **Objetivo:** Entender o aviso de versão nova, conferir o que muda e decidir se adota.
- **Papel mínimo:** Administrador
- **Busca no curso:** versão nova da skill; atualizar skill; adotar versão nova; skill desatualizada; o que mudou na skill; perdi minha edição da skill

1. **O aviso de versão nova** — `/app/ai/skills`  
   A clínica instalou a "agendamento" do catálogo há dois meses e depois acrescentou duas palavras-chave. Desde então, a plataforma publicou uma versão nova dessa skill. Por isso a linha dela ganhou este aviso. A cópia da sua empresa não muda sozinha: ela continua valendo até você decidir.
2. **O que muda se você adotar**  
   O aviso resume o que muda se você adotar a versão do catálogo: aqui, a "Descrição", as "Palavras-chave de ativação" e o "Procedimento (corpo)", com quantas linhas entram (+) e quantas saem (−). Palavras-chave que entram aparecem com o sinal +; as que saem ficam em vermelho, com o sinal −. Aqui saem "avaliação" e "encaixe": a clínica acrescentou essas palavras, e elas não existem na versão do catálogo.
3. **Adotar**  
   Se quiser a versão nova, clique em "Adotar versão nova". A versão do catálogo passa a valer, e o que a clínica editou sai de uso, mas fica guardado no "Histórico de versões". Para não perder as palavras da clínica, você pode acrescentá-las de novo depois, em "Editar".
4. **A versão nova já vale**  
   O aviso sumiu, a descrição já é a da versão nova e a data em "atualizada em" passou a ser a de agora. Também aparece por alguns segundos uma mensagem confirmando. O selo continua "do catálogo": quando a plataforma publicar outra versão, o aviso volta.
5. **Nada se perdeu**  
   Em "Editar", o "Histórico de versões" agora tem três linhas: a versão que você acabou de adotar, "em uso", a que a clínica editou e a primeira cópia instalada. Para voltar às palavras-chave da clínica, clique em "Restaurar" ao lado da versão editada. Ao voltar para ela, o aviso de versão nova aparece de novo.

---

<a id="m-casos"></a>

## Casos

**Tela:** `/app/ai/cases`  
**Resumo:** Os pedidos que a IA não consegue resolver sozinha e deixa para a equipe decidir, enquanto continua falando com o cliente.

**Lições:** [Conhecendo a tela de Casos](#l-casos--conhecendo-a-tela) · [Abrindo um caso](#l-casos--abrindo-um-caso) · [Respondendo um caso](#l-casos--respondendo-um-caso) · [Tirando dúvidas com a IA antes de decidir](#l-casos--conversar-sobre-o-caso) · [Casos esperando o cliente ou abertos pelo sistema](#l-casos--outras-situacoes) · [Consultando casos encerrados](#l-casos--historico)

<a id="l-casos--conhecendo-a-tela"></a>

### Conhecendo a tela de Casos

- **Objetivo:** Entender o que é um caso, onde fica a lista e como ler cada linha.
- **Papel mínimo:** Administrador
- **Busca no curso:** casos; o que é um caso; IA travou; IA pediu ajuda; pendências da IA; fila de casos

1. **O que aparece aqui** — `/app/ai/cases`  
   Às vezes a IA recebe um pedido que só alguém da equipe resolve: um desconto, um horário fora da agenda, uma dúvida do convênio. Nesses momentos ela abre um caso nesta tela e continua conversando com o cliente enquanto espera a sua resposta. À esquerda fica a lista de casos. À direita aparecem os detalhes do caso que você abrir.
   > 💡 A lista se atualiza sozinha a cada minuto. O número ao lado de "Casos" no menu conta só os casos que estão esperando a equipe. Quem é atendente só vê os casos das conversas a que tem acesso.
2. **Lendo uma linha da lista**  
   Cada linha mostra o assunto do caso, escrito pela IA, e um selo com a situação. "Aguardando você" quer dizer que a IA está esperando uma decisão da equipe. "Aguardando o cliente" quer dizer que a equipe já pediu uma informação e agora é o cliente que precisa responder. Embaixo vêm o tipo do pedido (como "Pagamento" ou "Horário"), o nome do cliente e há quanto tempo o caso foi aberto. Os casos mais novos ficam no alto.
3. **Abertos e Concluídos**  
   A aba "Abertos" mostra os casos que ainda não terminaram, e o número entre parênteses diz quantos são. A aba "Concluídos" guarda os que já acabaram, com três desfechos possíveis: "Concluído" (a equipe ou a IA resolveu), "Virou atendimento humano" (a conversa passou para uma pessoa da equipe) e "Cancelado" (o pedido deixou de existir).

<a id="l-casos--abrindo-um-caso"></a>

### Abrindo um caso

- **Objetivo:** Abrir um caso e entender o que o cliente pediu, por que a IA travou e o que já aconteceu.
- **Papel mínimo:** Administrador
- **Busca no curso:** abrir caso; detalhes do caso; por que a IA travou; o que o cliente precisa; linha do tempo; ver conversa do caso

1. **Quem é o cliente** — `/app/ai/cases`  
   Clique numa linha da lista para ver o caso à direita. No alto aparecem o nome e o telefone do cliente e o selo com a situação do caso. O link "Ver conversa" abre a conversa desse cliente na Inbox, para você ler tudo o que ele e a IA já falaram.
2. **O pedido e o motivo**  
   Dois quadros resumem o caso. "O que o cliente precisa" conta o pedido com as palavras da IA. "Por que a IA travou" explica o que impediu a IA de resolver sozinha. Aqui, o Pedro quer desconto no Pix, e a IA não pode prometer um preço diferente sem a equipe confirmar.
3. **A linha do tempo**  
   No fim do caso fica a "Linha do tempo": tudo o que aconteceu, do mais antigo para o mais novo, com há quanto tempo foi. Aqui ela mostra que a IA abriu o caso e depois registrou que avisou o Pedro de que a recepção confirma o valor. Quando alguém da equipe responde, a resposta também entra nesta lista.

<a id="l-casos--respondendo-um-caso"></a>

### Respondendo um caso

- **Objetivo:** Escolher o que fazer com um caso que espera a equipe e mandar a decisão para a IA.
- **Papel mínimo:** Administrador
- **Busca no curso:** responder caso; resolver caso; concluir caso; passar para humano; pedir informação ao cliente; decisão da equipe

1. **Três caminhos** — `/app/ai/cases`  
   No quadro "O que você quer fazer?" você escolhe o que acontece com o caso. "Concluí": você resolveu, e a IA avisa o cliente e encerra o assunto. "Preciso de info do cliente": a IA pergunta ao cliente o que faltou, e o caso volta para você quando ele responder. "Não consigo — passar pra humano": a IA sai da conversa e o cliente passa a ser atendido por uma pessoa da equipe.
   > 💡 Nenhuma opção vem marcada, de propósito: "Concluí" e "Não consigo" encerram o caso, e não dá para desfazer.
2. **Escolha e escreva**  
   Clique na opção e escreva no campo abaixo o que foi decidido. Com "Concluí" ou "Preciso de info do cliente", quem lê o que você escreve é a IA, e é com isso que ela responde o cliente. Então escreva a decisão de forma clara, com valores e horários. Com "Não consigo — passar pra humano", o texto vira um recado para a pessoa da equipe que vai assumir a conversa. Aqui, a recepção liberou 5% de desconto no Pix.
3. **Enviar a decisão**  
   O botão "Enviar" só funciona com uma opção marcada e o campo preenchido. Ao enviar, aparece o aviso "Resposta registrada para processamento.". Com "Concluí", o caso vai para a aba "Concluídos" e a IA escreve para o cliente (para isso, a IA e o WhatsApp precisam estar ligados). Com "Não consigo — passar pra humano", ele também vai para "Concluídos" e a conversa passa para a equipe. Com "Preciso de info do cliente", ele continua em "Abertos", agora como "Aguardando o cliente".
   > 💡 Se outra pessoa da equipe já respondeu o mesmo caso, aparece o aviso "Este caso já foi respondido ou fechado." e nada muda.

<a id="l-casos--conversar-sobre-o-caso"></a>

### Tirando dúvidas com a IA antes de decidir

- **Objetivo:** Conhecer a conversa interna com a IA sobre um caso e saber o que fazer quando ela ainda não está ligada.
- **Papel mínimo:** Administrador
- **Busca no curso:** perguntar para a IA sobre o caso; conversar sobre o caso; conversa interna; nenhum provedor de IA configurado; IA não responde no caso; configurar provedor de IA

1. **Conversar sobre o caso** — `/app/ai/cases`  
   Abaixo do quadro de resposta fica "Conversar sobre o caso". Ali a equipe faz perguntas à IA que abriu o caso antes de decidir, como "Por que a IA não resolveu sozinha?" ou "O que o cliente já tentou?". É uma conversa interna: o cliente não vê nada, e a IA ali não manda mensagem nem muda o caso. As perguntas dos colegas também aparecem nesse quadro, em alguns segundos. Enquanto a IA não estiver ligada, esse quadro mostra um aviso no lugar do campo de pergunta, e o próximo passo explica o porquê.
2. **Quando a IA ainda não está ligada**  
   Enquanto nenhuma chave de IA estiver cadastrada, no lugar do campo de pergunta aparece o aviso "Nenhum provedor de IA está configurado" e o link "Abrir IA › Provedores", que leva para a tela onde quem administra liga a IA.
   > 💡 Com a IA ligada, aparecem o campo "Sua pergunta para a IA" e o botão "Perguntar", e, enquanto ninguém perguntou nada, algumas sugestões de pergunta. Clicar numa sugestão só preenche o campo. Ctrl + Enter (Cmd + Enter no Mac) também envia. Cada pergunta é cobrada na conta da sua chave de IA.
3. **A tela de provedores**  
   O link abre a tela "Provedores de IA", onde quem administra escolhe qual IA atende cada parte do sistema. Enquanto falta a chave, ela avisa que você ainda não cadastrou a chave da IA principal, e o link "Cadastrar uma chave" leva para onde se cadastra. Só gerentes e administradores entram nela. Depois que a IA estiver ligada, volte em "Casos" e o campo de pergunta aparece no lugar do aviso.
   > 💡 O resto da tela ("Modelo padrão" e os quadros abaixo dele) pode ficar como está por enquanto: o primeiro passo é só cadastrar a chave.

<a id="l-casos--outras-situacoes"></a>

### Casos esperando o cliente ou abertos pelo sistema

- **Objetivo:** Reconhecer um caso que espera o cliente e um caso que o sistema abriu sozinho.
- **Papel mínimo:** Administrador
- **Busca no curso:** aguardando o cliente; caso parado; aberto automaticamente; sistema abriu caso; não consigo responder caso; botões desativados no caso

1. **Caso aguardando o cliente** — `/app/ai/cases`  
   Quando a equipe escolhe "Preciso de info do cliente", o caso fica com o selo "Aguardando o cliente". Nessa situação as opções ficam apagadas e não dá para responder: a vez é do cliente. Quando ele responder, a IA leva a resposta para o caso e ele volta a ficar "Aguardando você".
2. **O que a equipe pediu**  
   A linha do tempo mostra o pedido da equipe ("Você pediu uma informação ao cliente") com o texto que foi escrito, e logo depois "A IA perguntou ao cliente". Assim qualquer pessoa da equipe sabe em que pé está o caso sem precisar perguntar. Atenção: a tela escreve "Você" para qualquer pessoa da equipe que decidiu, mesmo que não tenha sido você.
3. **Caso aberto automaticamente**  
   Alguns casos trazem o selo "Aberto automaticamente". Isso acontece quando a IA disse ao cliente que ia chamar alguém da equipe, mas não abriu o caso. O sistema percebe e abre o caso por ela, para o cliente não ficar esperando à toa. Você responde esse caso do mesmo jeito que os outros.

<a id="l-casos--historico"></a>

### Consultando casos encerrados

- **Objetivo:** Ver como cada caso terminou e o que a equipe decidiu.
- **Papel mínimo:** Administrador
- **Busca no curso:** casos concluídos; histórico de casos; caso cancelado; virou atendimento humano; como o caso foi resolvido; casos antigos

1. **Abrindo um caso encerrado** — `/app/ai/cases`  
   Na aba "Concluídos", clique num caso para ver como ele terminou. O selo no alto diz o desfecho, e o quadro "O que você quer fazer?" explica por que não aceita mais resposta. Neste caso, que foi concluído, aparece "Este caso já foi concluído.". As opções ficam apagadas, porque não há mais o que decidir.
2. **Como o caso foi resolvido**  
   A linha do tempo conta a história do caso. Aqui a IA abriu o caso, a equipe resolveu ("Você concluiu o caso", com o que foi escrito para a IA) e o caso ficou "Concluído". O texto da equipe é o que a IA recebe para responder o Lucas. A tela escreve "Você" para qualquer pessoa da equipe que decidiu.
3. **Um caso que virou atendimento humano**  
   Este caso terminou com "Não consigo — passar pra humano". A linha do tempo mostra "Você decidiu passar para atendimento humano" (a tela diz "Você" para quem da equipe tomou a decisão) com o motivo, e depois "Virou atendimento humano". A partir daí a conversa com a Fernanda segue na Inbox, com uma pessoa da equipe.
4. **Um caso cancelado pela IA**  
   A própria IA também encerra um caso quando o pedido deixa de existir. Aqui o Roberto achou o recibo sozinho: a IA anotou o motivo ("A IA registrou o que aconteceu") e o caso ficou "Cancelado", sem ninguém da equipe precisar mexer.

---

<a id="m-alertas-da-ia"></a>

## Alertas

**Tela:** `/app/ai/inbox`  
**Resumo:** A Central de avisos reúne o que a IA percebeu e precisa de uma pessoa da equipe: uma resposta que não chegou, um cliente que pediu para falar com gente, um gasto que passou do limite.

**Lições:** [Conhecendo a Central de avisos](#l-alertas-da-ia--alertas-conhecendo-a-tela) · [Resolvendo um aviso](#l-alertas-da-ia--alertas-resolvendo-um-aviso) · [O lembrete de caso parado](#l-alertas-da-ia--alertas-lembrete-de-caso-parado)

<a id="l-alertas-da-ia--alertas-conhecendo-a-tela"></a>

### Conhecendo a Central de avisos

- **Objetivo:** Saber onde fica a Central de avisos, como ler cada aviso e reconhecer os avisos que são assunto do gerente.
- **Papel mínimo:** Atendente
- **Busca no curso:** alertas; central de avisos; sino; avisos da ia; o que a ia precisa de mim; resposta que não chegou; aviso crítico

1. **Onde fica a tela** — `/app/ai`  
   Alertas não aparece direto no menu lateral. No grupo "Agente de IA" do menu, clique em "Ver tudo em IA". Na parte "Acompanhar o agente" está o cartão "Alertas". O caminho completo é: Agente de IA › Ver tudo em IA › Alertas.
   > 💡 O sino no alto da tela leva à mesma Central, de qualquer lugar do sistema. Quem tem só permissão de leitura não vê o cartão nem o sino.
2. **A Central de avisos** — `/app/ai/inbox`  
   A tela se chama "Central de avisos". Cada linha é um assunto que a Bia, a IA da clínica, não conseguiu resolver sozinha e deixou para a equipe: uma resposta que não chegou ao cliente, um cliente que pediu para falar com uma pessoa, um retorno prometido que ficou sem dono. A lista mostra primeiro os avisos mais graves e, entre os de mesma gravidade, os mais recentes.
3. **Lendo um aviso**  
   À esquerda, o selo diz a gravidade: "crítico", "atenção" ou "informativo". Ao lado vem o título e, logo embaixo, o tipo do assunto e há quanto tempo o aviso chegou. Depois vem o que aconteceu e uma orientação do que fazer. Neste aviso crítico, uma resposta da Bia ficou presa e não chegou ao cliente. O link no fim, "Abrir uma conversa afetada", leva direto à conversa desse cliente.
4. **Um aviso que é do gerente**  
   Alguns avisos são assunto do gerente ou de quem administra. O aviso de gasto de IA, por exemplo, aparece para toda a equipe, mas quem atende não recebe o botão que leva a resolver o problema: no lugar dele vem "Peça ao gestor para revisar este contexto.". O "Marcar resolvido" continua lá para todos. Assim todo mundo sabe o que está acontecendo, e quem resolve é o gerente, na tela de uso de IA.
5. **Abertos, Resolvidos e o sino**  
   A aba "Abertos" mostra o que ainda espera alguém, com o total entre parênteses. A aba "Resolvidos" guarda os avisos que alguém da equipe já marcou como resolvidos. O sino no alto da tela traz você para cá de qualquer lugar do sistema, e o número vermelho nele é o total de avisos em aberto.

<a id="l-alertas-da-ia--alertas-resolvendo-um-aviso"></a>

### Resolvendo um aviso

- **Objetivo:** Ir até o assunto de um aviso, marcá-lo como resolvido e reabri-lo se for preciso.
- **Papel mínimo:** Atendente
- **Busca no curso:** marcar resolvido; resolver aviso; reabrir aviso; marcar todos resolvidos; limpar alertas; abrir conversa do aviso

1. **Ir até o assunto** — `/app/ai/inbox`  
   O link no fim de cada aviso leva direto ao que precisa de atenção. Em "Abrir uma conversa afetada" você abre a conversa do cliente que não recebeu a resposta, confere o que faltou e responde você mesmo, se for o caso. No aviso da Mariana Souza, que pediu para falar com uma pessoa, o botão é "Abrir conversa".
2. **Marcar como resolvido**  
   Depois de cuidar do assunto, clique em "Marcar resolvido" na linha do aviso. Ele sai da aba "Abertos" e o número do sino diminui. Marcar como resolvido não muda nada na conversa nem avisa o cliente: só conta para a equipe que alguém já cuidou disso.
3. **Na aba Resolvidos**  
   O aviso passa para a aba "Resolvidos", junto com os que já tinham sido resolvidos antes. Ali ele ganha o botão "Reabrir": use se marcou o aviso por engano ou se o problema voltou, e ele volta para "Abertos".
4. **Resolver todos de uma vez**  
   De volta à aba "Abertos", o botão "Marcar todos resolvidos" resolve de uma vez todos os avisos em aberto da clínica, inclusive os que não aparecem na tela. Use só depois de conferir a lista: um aviso resolvido sem ninguém olhar continua sendo um problema, só que escondido.

<a id="l-alertas-da-ia--alertas-lembrete-de-caso-parado"></a>

### O lembrete de caso parado

- **Objetivo:** Ligar, desligar e ajustar de quanto em quanto tempo a Central volta a avisar sobre um caso que espera a equipe.
- **Papel mínimo:** Administrador
- **Busca no curso:** lembrete de caso parado; caso parado; lembrar a equipe; avisar de novo; caso esperando decisão; frequência do lembrete

1. **O cartão do lembrete** — `/app/ai/inbox`  
   Quem administra vê, no alto da Central, o cartão "Lembrete de caso parado". Ele cuida dos casos que a IA abre para a equipe decidir: enquanto ninguém responde, a Central volta a avisar de tempos em tempos, com o aviso "Um atendimento espera decisão da equipe". O relógio começa quando o caso chega à equipe e recomeça quando o cliente responde.
   > 💡 Só quem administra a empresa vê este cartão. Atendentes e gerentes veem apenas a lista de avisos.
2. **Ligar e escolher o ritmo**  
   A caixa "Lembrar a equipe dos casos parados" liga e desliga o lembrete. Em "Lembrar a cada" você escolhe de quanto em quanto tempo a Central volta a avisar, de 1 hora a 3 dias. Em "Avisos por espera" você escolhe quantas vezes ela avisa sobre o mesmo caso antes de parar, para a lista não encher de repetição. Com a caixa desmarcada, as duas escolhas ficam apagadas.
3. **Salvar o lembrete**  
   Aqui o intervalo foi trocado para 12 horas: um caso parado volta a aparecer na Central duas vezes por dia. Nada muda até você clicar em "Salvar lembrete". Ao salvar, aparece por alguns segundos a confirmação "Lembrete de caso parado salvo.".

---

<a id="m-aviso-no-whatsapp"></a>

## Aviso no WhatsApp

**Tela:** `/app/ai/cases/avisos`  
**Resumo:** Toda vez que a IA trava e abre um caso para a equipe, um celular de plantão recebe na hora uma mensagem de WhatsApp com o resumo e o link do caso.

**Lições:** [Conhecendo o Aviso no WhatsApp](#l-aviso-no-whatsapp--aviso-conhecendo-a-tela) · [Conferindo se os avisos chegaram](#l-aviso-no-whatsapp--aviso-conferindo-as-entregas) · [Responder pelo WhatsApp e remover o destinatário](#l-aviso-no-whatsapp--aviso-responder-e-remover)

<a id="l-aviso-no-whatsapp--aviso-conhecendo-a-tela"></a>

### Conhecendo o Aviso no WhatsApp

- **Objetivo:** Entender para que serve o aviso, ler os alertas do alto da tela e saber o que cada campo da configuração decide.
- **Papel mínimo:** Administrador
- **Busca no curso:** aviso no whatsapp; aviso de caso; receber aviso no celular; plantão; avisar a equipe quando a ia travar; número que recebe os avisos; aviso de teste

1. **Onde fica a tela** — `/app/ai`  
   Aviso no WhatsApp não aparece direto no menu lateral. No grupo "Agente de IA" do menu, clique em "Ver tudo em IA". Na parte "Acompanhar o agente" está o cartão "Aviso no WhatsApp". O caminho completo é: Agente de IA › Ver tudo em IA › Aviso no WhatsApp.
   > 💡 Só quem administra a empresa vê este cartão, porque a tela escolhe um número da clínica e manda dados de cliente para um celular. Para os outros papéis, o endereço da tela leva à página "403 — Sem permissão".
2. **Para que serve** — `/app/ai/cases/avisos`  
   Quando a IA não consegue resolver um pedido, ela abre um caso para a equipe decidir (é o que a tela Casos mostra). Esta tela faz esse caso chegar no WhatsApp de alguém da equipe na mesma hora, com o resumo e o link para abrir o caso. Assim ninguém precisa ficar de olho no sistema para saber que um cliente está esperando. Aqui a clínica já configurou o aviso para o celular do plantão da recepção.
3. **Os quadros do alto**  
   Antes do formulário, a tela avisa quando o aviso não vai funcionar como você espera. Um quadro com borda vermelha impede o aviso de sair até ser resolvido; os outros são alertas. Aqui aparece "Nenhum assistente está autorizado a abrir casos": enquanto nenhum agente puder abrir caso, nenhum aviso sai, e o link "Ir para os assistentes" leva aonde isso se liga. E "Este é o mesmo número que fala com seus clientes": funciona, mas os avisos contam no mesmo limite diário de mensagens desse número. No alto pode aparecer também "Este sistema ainda não tem um endereço na internet": o aviso leva um link para o caso, e sem o endereço do sistema (o domínio) esse link não abriria nada. Instalações feitas pelo guia já têm domínio; esta foto é de um sistema de testes, sem ele.
4. **Quem envia e quem recebe**  
   Em "Conexão que envia os avisos" você escolhe qual número de WhatsApp da clínica manda a mensagem. Só aparecem os números que conseguem mandar mensagem a qualquer hora. Em "Número que recebe os avisos" vai o celular da pessoa da equipe, começando por +55 e o DDD. "Como chamar esse número" é opcional: é só um apelido para a equipe reconhecer o número.
   > 💡 O número que recebe passa a ser só da equipe: o que ele mandar para a clínica deixa de virar atendimento. Se você digitar o celular de um cliente, a tela pergunta antes de salvar.
5. **Ligar, salvar e testar**  
   A chave "Receber avisos no WhatsApp" liga e desliga o envio. O aviso sai na hora, inclusive de noite e no fim de semana, porque quem recebe é a equipe, não um cliente. Nada muda até você clicar em "Salvar". Depois de salvo, "Enviar aviso de teste" manda uma mensagem de verdade para o número, para você conferir se chegou. Essa mensagem conta no limite diário do número que envia.

<a id="l-aviso-no-whatsapp--aviso-conferindo-as-entregas"></a>

### Conferindo se os avisos chegaram

- **Objetivo:** Ler a lista dos últimos avisos, entender por que um aviso não saiu e saber se o aviso está ajudando a equipe.
- **Papel mínimo:** Administrador
- **Busca no curso:** últimos avisos enviados; aviso não saiu; aviso não chegou; tentando enviar; histórico de avisos; o aviso está funcionando

1. **A lista dos últimos avisos** — `/app/ai/cases/avisos`  
   Mais abaixo fica "Últimos avisos enviados". Cada linha é um aviso que o sistema tentou mandar, do mais novo para o mais antigo: o dia e a hora, a situação, o número que recebeu (só com os 4 últimos dígitos, para proteger o celular de quem está de plantão) e o link "Abrir o atendimento", que abre o caso na tela Casos. Esta lista não some quando alguém resolve um alerta: ela é o registro do que saiu.
2. **Entregue, tentando ou não saiu**  
   "Entregue" quer dizer que a mensagem saiu. "Tentando enviar" quer dizer que o sistema ainda está insistindo: se a conexão estiver fora do ar, ele tenta de novo por até 24 horas. "Não saiu" quer dizer que ele desistiu, e uma frase logo abaixo explica o motivo.
3. **Por que não saiu**  
   Aqui um aviso não saiu porque "A conexão de WhatsApp escolhida para os avisos está fora do ar.". O caso não se perde por isso: ele continua esperando na tela Casos, e a falha também aparece na Central de alertas. Clique em "Abrir o atendimento" nessa linha para responder o caso direto por lá.
4. **O aviso está ajudando?**  
   No fim do quadro, a tela compara os casos dos últimos 30 dias: quanto tempo a equipe leva para agir quando o aviso chegou e quando não chegou. É assim que você sabe se o aviso está adiantando o atendimento. Enquanto não houver casos suficientes para comparar, aparece "Ainda não há casos suficientes nos últimos 30 dias para comparar.", e a comparação aparece sozinha depois.

<a id="l-aviso-no-whatsapp--aviso-responder-e-remover"></a>

### Responder pelo WhatsApp e remover o destinatário

- **Objetivo:** Saber quando ligar a resposta de casos pelo WhatsApp e a diferença entre desligar o aviso e remover o destinatário.
- **Papel mínimo:** Administrador
- **Busca no curso:** responder caso pelo whatsapp; responder perguntar; remover destinatário; parar de receber avisos; desligar aviso de caso; trocar o número do plantão

1. **Responder casos pelo WhatsApp** — `/app/ai/cases/avisos`  
   Com a chave "Responder casos por este WhatsApp" ligada, quem está de plantão responde o caso sem abrir o sistema: basta responder o aviso com RESPONDER, o código do caso e a orientação para a IA, ou com PERGUNTAR, o código do caso e a pergunta que a IA deve fazer ao cliente. Desligada, que é o padrão, tudo o que esse número mandar é ignorado. Para valer, clique em "Salvar".
2. **Desligar não é remover**  
   Para parar os avisos por um tempo, desligue a chave "Receber avisos no WhatsApp" e salve: o número continua guardado e continua sendo só da equipe. "Remover destinatário", no fim do quadro, é outra coisa: apaga a configuração, e o número volta a ser um número comum.
3. **A tela pergunta antes**  
   Antes de remover, a tela pergunta "Remover o destinatário dos avisos?" e explica o que acontece: a configuração é apagada, o que esse número mandar volta a virar atendimento na Inbox, e também param de sair os avisos da Agenda que usam o mesmo número e as automações com a ação "Mensagem para a equipe". O histórico de entregas continua na tela. "Remover destinatário" confirma; "Manter" desiste.

---

<a id="m-propostas-da-ia"></a>

## Propostas da IA

**Tela:** `/app/ai/proposals`  
**Resumo:** Os próximos passos que a IA sugere para cada negócio aberto, numa lista só, esperando alguém da equipe aprovar ou ignorar.

**Lições:** [Conhecendo as Propostas da IA](#l-propostas-da-ia--propostas-da-ia-conhecendo-a-tela) · [Aprovando ou ignorando uma sugestão](#l-propostas-da-ia--propostas-da-ia-decidindo)

<a id="l-propostas-da-ia--propostas-da-ia-conhecendo-a-tela"></a>

### Conhecendo as Propostas da IA

- **Objetivo:** Saber onde ficam as sugestões de próximo passo da IA e o que cada linha da lista mostra.
- **Papel mínimo:** Atendente
- **Busca no curso:** propostas da ia; próximo passo sugerido; sugestão da ia; próxima ação; o que a ia sugere fazer; aguardando decisão

1. **Onde fica a tela** — `/app/ai`  
   Propostas da IA não aparece direto no menu lateral. No grupo "Agente de IA" do menu, clique em "Ver tudo em IA". Na parte "Acompanhar o agente" está o cartão "Propostas". O caminho completo é: Agente de IA › Ver tudo em IA › Propostas.
   > 💡 Não confunda com as propostas comerciais (orçamentos enviados ao cliente), que ficam no CRM. Aqui são sugestões de próximo passo que a IA faz para a equipe.
2. **Para que serve** — `/app/ai/proposals`  
   Enquanto conversa com os clientes, a Bia, a IA da clínica, anota qual deveria ser o próximo passo de cada negócio: ligar, pedir um documento, confirmar um horário. Ela não faz isso sozinha; sugere, e alguém da equipe decide. A mesma sugestão aparece no cartão do negócio no funil, mas aqui ficam todas juntas, para nenhuma ficar esquecida. A aba "Aguardando decisão" mostra quantas esperam, e as mais antigas vêm primeiro.
3. **Lendo uma sugestão**  
   Cada linha começa pelo nome do negócio, seguido do cliente, da etapa do funil em que ele está e de há quanto tempo a IA fez a sugestão. Logo abaixo vem o próximo passo, com as palavras da IA. Aqui a Bia sugere confirmar com a Fernanda o retorno de quinta com o Dr. Paulo.

<a id="l-propostas-da-ia--propostas-da-ia-decidindo"></a>

### Aprovando ou ignorando uma sugestão

- **Objetivo:** Decidir uma sugestão da IA e conferir a decisão no histórico.
- **Papel mínimo:** Atendente
- **Busca no curso:** aprovar proposta da ia; ignorar sugestão; recusar sugestão da ia; já decididas; histórico de decisões

1. **Aprovar ou Ignorar** — `/app/ai/proposals`  
   Embaixo de cada sugestão há dois botões. "Aprovar" diz que a equipe concorda com o próximo passo. "Ignorar" diz que ele não serve. Os dois ficam registrados no histórico do negócio: ignorar também é uma decisão, não um esquecimento. Quem tem só permissão de leitura vê a lista, mas os botões ficam apagados.
2. **A sugestão sai da lista**  
   Ao aprovar, a sugestão da Fernanda sai da lista e o número da aba "Aguardando decisão" diminui. Ela também some do cartão do negócio no funil. Aprovar não manda nada ao cliente: quem faz o que foi combinado é a equipe. Para ver o que já foi decidido, abra a aba "Já decididas".
3. **As decisões ficam registradas**  
   A aba "Já decididas" mostra cada decisão, da mais nova para a mais antiga, com o selo "Aprovada" ou "Ignorada", o negócio, quem decidiu e quando. No topo está a que você acabou de aprovar. Mais abaixo, uma sugestão que a Ana ignorou: oferecer à Juliana o pacote de 10 sessões.

---

<a id="m-execucoes"></a>

## Execuções

**Tela:** `/app/ai/runs`  
**Resumo:** Tudo o que a IA fez, uma linha por vez — e, quando algo falhou, o que o cliente viveu, o que fazer e a mensagem original do provedor.

**Lições:** [Conhecendo a tela de Execuções](#l-execucoes--execucoes-conhecendo-a-tela) · [Entendendo uma falha](#l-execucoes--execucoes-entendendo-uma-falha)

<a id="l-execucoes--execucoes-conhecendo-a-tela"></a>

### Conhecendo a tela de Execuções

- **Objetivo:** Saber onde fica a tela, ler o resumo que responde se está tudo bem e entender uma execução que deu certo.
- **Papel mínimo:** Gerente
- **Busca no curso:** execuções; execuções de ia; o que a ia fez; a ia parou de responder; falha da ia; log da ia; tokens e custo por resposta

1. **Onde fica a tela** — `/app/ai`  
   Execuções não aparece direto no menu lateral. No grupo "Agente de IA" do menu, clique em "Ver tudo em IA". Na parte "Acompanhar o agente" está o cartão "Execuções". O caminho completo é: Agente de IA › Ver tudo em IA › Execuções.
   > 💡 Só gerente ou administrador vê este cartão. Para um atendente, o endereço da tela leva à página "403 — Sem permissão".
2. **O resumo responde primeiro** — `/app/ai/runs`  
   Cada vez que a IA trabalha (responde um cliente, identifica a etapa de um negócio) vira uma linha nesta tela. Ela existe para responder uma pergunta: "a IA parou de responder, o que aconteceu?". Por isso abre pelo resumo. Quando nada falhou, ele diz "Nenhuma falha". Aqui ele diz quantas das últimas execuções falharam e, embaixo, o que fazer para cada motivo, com quantas vezes cada um aconteceu.
3. **Uma execução que deu certo**  
   Logo abaixo vem a lista, da mais nova para a mais antiga. No alto de cada cartão está o que a IA fez (aqui, "Responder o cliente") e, à direita, o provedor e o modelo usados. Embaixo, quantos tokens (pedaços de texto) a IA leu e escreveu, quanto tempo levou e quanto custou, em dólar. Na última linha, a data e por que esse modelo foi o escolhido.

<a id="l-execucoes--execucoes-entendendo-uma-falha"></a>

### Entendendo uma falha

- **Objetivo:** Ler o que aconteceu numa execução que falhou, o que fazer a respeito, e filtrar só as falhas.
- **Papel mínimo:** Gerente
- **Busca no curso:** execução falhou; chave recusada; provedor fora do ar; mensagem técnica do provedor; ver só as falhas; por que a ia não respondeu

1. **Um cartão de falha** — `/app/ai/runs`  
   Uma execução que falhou ganha borda vermelha e o selo "falhou". O cartão conta três coisas, nesta ordem. "O que aconteceu" diz o que o cliente viveu: aqui, ele mandou mensagem e ninguém respondeu. "O que fazer" diz o caminho: neste caso, o provedor não aceitou a chave da IA, e é preciso conferir em Credenciais se ela ainda vale.
2. **A mensagem técnica**  
   Só no fim vem "Mensagem técnica do provedor", fechada. Clique para abrir: é o texto original que o provedor de IA devolveu, com o código do erro. Você não precisa entender essa parte; ela serve para quem for investigar, como o suporte de quem instalou o sistema.
3. **Ver só as falhas**  
   O botão "Ver só as falhas" esconde o que deu certo e deixa na lista apenas as execuções que falharam. Ligado, ele passa a dizer "Mostrando só as falhas"; clique de novo para ver tudo. Aqui ficam três: duas vezes o provedor esteve fora do ar ou demorou demais (costuma se resolver sozinho) e uma vez a chave foi recusada.

---

<a id="m-uso-e-orcamento"></a>

## Uso e orçamento

**Tela:** `/app/ai/usage`  
**Resumo:** Quanto a inteligência artificial custou, quantas vezes trabalhou, quanto demorou e qual é o teto de gasto do mês.

**Lições:** [Conhecendo a tela de Uso e orçamento](#l-uso-e-orcamento--uso-conhecendo-a-tela) · [Filtrar por agente, tipo de uso e período](#l-uso-e-orcamento--uso-filtrar) · [Definir o limite de gasto do mês](#l-uso-e-orcamento--uso-definir-o-limite)

<a id="l-uso-e-orcamento--uso-conhecendo-a-tela"></a>

### Conhecendo a tela de Uso e orçamento

- **Objetivo:** Achar a tela e ler o orçamento do mês, os seis números do período e os gráficos por dia.
- **Papel mínimo:** Gerente
- **Busca no curso:** quanto a ia gastou; custo da ia; gasto com inteligência artificial; orçamento de ia; consumo da ia; quantas vezes a ia respondeu

1. **Onde fica a tela** — `/app/ai`  
   Uso e orçamento não aparece direto no menu lateral. No grupo "Agente de IA" do menu, clique em "Ver tudo em IA". Na parte "Acompanhar o agente" está o cartão "Uso e orçamento". O caminho completo é: Agente de IA › Ver tudo em IA › Uso e orçamento.
   > 💡 Só gerente ou administrador vê este cartão. Para os outros papéis, o endereço da tela leva à página "403 — Sem permissão".
2. **O orçamento do mês** — `/app/ai/usage`  
   No alto fica o "Orçamento mensal de IA": quanto a IA já gastou neste mês e quanto falta para o limite. A barra enche conforme o gasto: fica amarela quando passa do ponto de aviso e vermelha quando chega no limite. Ao lado, a frase diz o que acontece no limite. Os valores são em dólar, porque é a moeda em que o provedor de IA cobra.
   > 💡 Aqui a Clínica Bem Viver pediu um aviso ao passar de 80% de US$ 15,00 por mês. A IA não para sozinha: ela só avisa.
3. **Custo, chamadas e turnos**  
   Embaixo vêm seis números dos últimos 30 dias. "Custo no período" é quanto a IA custou. "Chamadas de IA" conta cada vez que o sistema perguntou algo a uma IA. "Turnos do agente" conta as respostas que o agente deu ao cliente. Uma resposta pode fazer várias chamadas, como responder e, junto, medir o clima da conversa. Por isso há mais chamadas que turnos.
4. **Cache, passagem para uma pessoa e tempo**  
   "Taxa de cache" diz quanto do texto enviado à IA já estava guardado de antes, o que custa bem menos. "Passaram para uma pessoa" mostra quantas vezes a IA chamou alguém da equipe; quanto mais alto, mais ela precisou de ajuda. "Tempo de uma chamada à IA" é o pior caso comum, e a frase embaixo diz em quanto tempo a maioria responde.
5. **Os gráficos por dia**  
   Mais abaixo, os mesmos números aparecem dia a dia: quanto gastou, quanto texto a IA leu e escreveu, quanto demorou e quanto foi para uma pessoa. Passe o mouse sobre um dia para ver o valor exato. Um dia muito acima dos outros é o primeiro lugar para olhar.

<a id="l-uso-e-orcamento--uso-filtrar"></a>

### Filtrar por agente, tipo de uso e período

- **Objetivo:** Ver só uma parte do gasto: um agente, um tipo de uso ou um intervalo de datas.
- **Papel mínimo:** Gerente
- **Busca no curso:** filtrar o uso da ia; gasto de um agente; gasto por período; tipo de uso; uso do mês passado

1. **Os filtros** — `/app/ai/usage`  
   Acima dos números ficam os filtros. "Agente" mostra só o uso de um agente. "Tipo de uso" mostra só um tipo de trabalho da IA. "De" e "Até" escolhem as datas; em branco, valem os últimos 30 dias. O período vai até 90 dias.
2. **Os tipos de uso**  
   Clique em "Tipo de uso". A lista mostra só os tipos que aconteceram no período. Na Clínica Bem Viver são quatro: "Responder o cliente", "Medir o clima da conversa", "Identificar a etapa do lead" e "Fechar o atendimento".
3. **Os números do filtro**  
   Escolhemos "Responder o cliente". Os números e os gráficos passam a contar só as respostas ao cliente, que são a maior parte do custo. Para voltar a ver tudo, escolha "Todas" em "Tipo de uso".
   > 💡 O endereço da página guarda os filtros. Dá para salvar o link nos favoritos e abrir a mesma visão depois.

<a id="l-uso-e-orcamento--uso-definir-o-limite"></a>

### Definir o limite de gasto do mês

- **Objetivo:** Escolher o que acontece quando o gasto chega no limite: só acompanhar, avisar ou parar a IA.
- **Papel mínimo:** Administrador
- **Busca no curso:** limite de gasto da ia; teto do mês; parar a ia por gasto; aviso de gasto; editar limite

1. **Editar o limite** — `/app/ai/usage`  
   Só o administrador muda o orçamento. No cartão "Orçamento mensal de IA", clique em "Editar limite".
2. **Três jeitos de cuidar do gasto**  
   "Só acompanhar": a IA nunca para por gasto, e você só vê o número. "Me avisar": ao passar da porcentagem escolhida, chega um aviso na Central de avisos, e a IA continua respondendo. "Parar a IA": ao chegar no limite, as conversas vão para a fila de atendimento humano. Ninguém fica sem resposta, mas alguém da equipe precisa responder.
   > 💡 "Parar a IA" só fica liberado depois de salvar "Me avisar" uma vez.
3. **O valor e o ponto de aviso**  
   Em "Limite mensal (US$)", escreva o teto do mês em dólar. Aqui a clínica sobe de US$ 15 para US$ 25. Em "Avisar ao chegar em (% do limite)", escolha quando o aviso chega, de 50% a 99%. O texto das opções acima muda junto com o valor.
4. **Parar a IA no limite**  
   Ao escolher "Parar a IA", aparece um quadro amarelo: a parada só começa a valer 72 horas depois de salvar. É o tempo de o aviso chegar antes que alguma conversa pare. Quem precisa da parada já pode marcar "Começar a valer agora, sem esperar as 72 horas". Por fim, clique em "Salvar".
