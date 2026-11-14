# Curso DeskComm — Nichos e jornadas

> Gerado a partir do [curso oficial do DeskComm](https://www.deskcomm.com.br/curso) — versão 1.94.0, gerado em 2026-10-29. Conteúdo do **núcleo do DeskcommCRM (upstream)**; o que o fork de clínicas acrescenta está em [`docs/funcionalidades.md`](../funcionalidades.md). As capturas de tela de cada passo ficam no curso online.

[← Índice do curso](README.md)

Roteiros demonstrativos por segmento, com empresas, pessoas e mensagens fictícias. Cada jornada diz o que precisa estar configurado (dependências), quais lições montam o cenário e as cenas do atendimento.

| Nicho | Resumo | Jornadas |
|---|---|---|
| [Advocacia](#n-advocacia) | Triagem administrativa, consulta e documentos sem aconselhamento jurídico automático. | 3 |
| [Clínicas](#n-clinicas) | Recepção, horários e continuidade do cuidado com decisões clínicas reservadas aos profissionais. | 3 |
| [Consórcio](#n-consorcio) | Intenção de compra, análise de informações e encaminhamento sem promessa de contemplação ou crédito. | 3 |
| [Contabilidade](#n-contabilidade) | Documentos, conferências e atendimento de empresas com análise fiscal reservada aos profissionais. | 3 |
| [E-commerce](#n-e-commerce) | Pedidos, trocas e venda consultiva com leitura externa condicionada à integração disponível. | 3 |
| [Escolas e cursos](#n-educacao) | Visita, matrícula em análise e apoio ao aluno com atendimento administrativo organizado. | 3 |
| [Imobiliárias](#n-imobiliarias) | Preferências de imóvel, visita e acompanhamento documental sem prometer disponibilidade ou aprovação. | 3 |
| [Infoprodutos](#n-infoprodutos) | Acesso, adequação da oferta e suporte com passagem à equipe quando a base não resolve. | 3 |
| [Seguros](#n-seguros) | Cotação, renovação e sinistro com decisões de cobertura e aceitação atribuídas aos responsáveis. | 3 |
| [Oficinas e assistência técnica](#n-servicos) | Recepção de equipamento, diagnóstico humano e continuidade de orçamento ou reparo. | 3 |

---

<a id="n-advocacia"></a>

## Advocacia

Triagem administrativa, consulta e documentos sem aconselhamento jurídico automático.

### Consulta jurídica com contexto administrativo

- **Empresa (fictícia):** Lago Advocacia (fictícia)
- **Contexto:** Zeca busca orientação sobre um contrato e quer agendar conversa reservada.
- **Resultado:** Consulta registrada com profissional e demanda administrativa resumida.
- **Dependências:** Agenda, expediente e profissional responsável. O atendimento não oferece parecer, estratégia, prazo processual ou estimativa de êxito; conteúdo sensível segue o canal definido pelo escritório.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Inbox › Recados para a equipe com a nota interna](atendimento.md#l-inbox--nota-interna) — Guardar contexto visível somente para a equipe.
- [Agenda › Marcar um novo agendamento](atendimento.md#l-agenda--novo-agendamento) — Registrar o compromisso com o contato e quem atende.
- [Agenda › A lista de compromissos](atendimento.md#l-agenda--lista-de-compromissos) — Acompanhar a situação do compromisso na lista.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Uma dúvida contratual | Zeca pergunta se pode conversar sobre um contrato. | A recepção identifica a área do pedido sem interpretar cláusulas pelo chat. | A triagem organiza o atendimento sem aconselhamento jurídico. |
| Contexto suficiente | Zeca informa que o assunto envolve um contrato de prestação de serviços. | Uma nota interna resume o motivo da consulta, evitando transcrever documentos sensíveis desnecessários. | O profissional pode preparar o acolhimento. |
| Um encontro reservado | Zeca aceita um horário com o profissional disponível. | A equipe registra o compromisso com o tipo de atendimento e o responsável corretos. | O pedido vira uma consulta combinada. |
| Conferir a situação | Zeca pergunta se está tudo certo para comparecer. | A recepção confere o registro e sua situação antes de responder; conteúdo jurídico fica para o profissional. | A confirmação administrativa não sugere parecer prévio. |

### Documentos para revisão com próximo passo

- **Empresa (fictícia):** Rios Escritório Jurídico (fictícia)
- **Contexto:** Alba já tem atendimento em curso e pergunta quais documentos precisa organizar.
- **Resultado:** Conferência documental atribuída à equipe, sem análise jurídica automática.
- **Dependências:** Processo documental e canal seguro definidos pelo escritório, acesso a tarefas e equipe responsável. Não determinar documentos obrigatórios, prazo legal ou estratégia sem revisão profissional.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Inbox › Pausar o robô, passar adiante e encerrar](atendimento.md#l-inbox--passar-pausar-encerrar) — Transferir a conversa para quem pode continuar.
- [Tarefas › Criar uma tarefa](crm.md#l-tarefas--tarefas-criar-uma-tarefa) — Criar um próximo passo explícito para a equipe.
- [Tarefas › Concluir, editar e apagar](crm.md#l-tarefas--tarefas-concluir-editar-apagar) — Concluir ou atualizar a tarefa após a ação real.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Continuidade de um atendimento | Alba retoma a conversa sobre sua demanda. | O atendente recupera o histórico e identifica o assunto correto antes de orientar qualquer envio. | Diminui o risco de misturar solicitações. |
| Pergunta para quem acompanha | Alba quer saber qual versão do contrato deve encaminhar. | A recepção transfere a conversa à pessoa que acompanha o atendimento. | A orientação vem de quem conhece o contexto. |
| Conferir a relação de documentos | Alba diz que já separou parte do material. | A equipe cria tarefa para o profissional conferir os itens recebidos no canal adotado pelo escritório. | A pendência tem responsável sem prazo jurídico inventado. |
| Registrar a conferência | Alba recebe a orientação revisada. | A tarefa é concluída após a conferência real, mantendo no histórico apenas o contexto administrativo necessário. | A conclusão representa trabalho feito, sem parecer sobre o contrato. |

### Pergunta sobre andamento com resposta profissional

- **Empresa (fictícia):** Praça Advocacia (fictícia)
- **Contexto:** Joel quer entender uma atualização de seu atendimento e pede uma previsão de resultado.
- **Resultado:** Dúvida encaminhada com contexto para resposta do responsável.
- **Dependências:** Agente com casos habilitados e equipe jurídica responsável. Não consulta tribunais automaticamente, não interpreta movimentações, fixa prazo legal nem prevê resultado judicial.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Agentes › Instruções, capacidades e conhecimento](agente-de-ia.md#l-agentes--instrucoes-e-capacidades) — Configurar e publicar somente as capacidades necessárias ao agente do roteiro.
- [Agentes › Quando ele responde e quando chama a equipe](agente-de-ia.md#l-agentes--quando-responder-e-passar) — Definir os limites e as situações em que a equipe continua o atendimento.
- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Casos › Abrindo um caso](agente-de-ia.md#l-casos--abrindo-um-caso) — Ler a demanda que precisa de decisão da equipe.
- [Casos › Respondendo um caso](agente-de-ia.md#l-casos--respondendo-um-caso) — Pedir informação, registrar a decisão ou passar ao humano.
- [Inbox › Assumir um cliente e preparar a resposta](atendimento.md#l-inbox--assumir-e-responder) — Assumir o atendimento e responder pela equipe.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Uma atualização esperada | Joel pergunta se já existe resultado para seu assunto. | O agente do roteiro evita inferir andamento ou prazo a partir de mensagens anteriores. | A ausência de informação não vira notícia inventada. |
| Pergunta para o responsável | Joel explica qual atendimento está acompanhando. | O roteiro abre caso com a pergunta concreta e o vínculo administrativo que a equipe precisa conferir. | A solicitação chega com contexto identificável. |
| Interpretação exige revisão | Joel pergunta o significado de uma comunicação recebida. | A equipe seleciona a passagem ao humano, deixando a interpretação para o profissional. | O fluxo respeita o limite entre recepção e orientação jurídica. |
| Resposta situada | Joel conversa com a pessoa responsável. | O profissional confere a fonte aplicável e explica o que pode ser informado, sem o roteiro antecipar teor ou resultado. | O histórico sustenta uma resposta com responsabilidade definida. |

---

<a id="n-clinicas"></a>

## Clínicas

Recepção, horários e continuidade do cuidado com decisões clínicas reservadas aos profissionais.

### Da pergunta ao horário combinado

- **Empresa (fictícia):** Clínica Bem Viver (fictícia)
- **Contexto:** Marina Exemplo pede avaliação postural em 27 de outubro de 2026, às 9h30.
- **Resultado:** Avaliação postural registrada e resposta de confirmação conferida na bancada local.
- **Dependências:** Requer canal conectado, agente publicado com capacidades de agenda, tipo de atendimento, profissional e expediente configurados. O roteiro não faz triagem clínica nem diagnóstico; só confirma a marcação após retorno da ferramenta, respeitando eventual aprovação da equipe.
- **Nota:** Telas reais com estados reconstituídos. Motor e ferramentas de agenda foram validados na bancada local; envio externo simulado. As fotos desta sequência são reconstituições com dados fictícios, não a gravação da execução.

**Como montar (lições do curso):**

- [Agentes › Instruções, capacidades e conhecimento](agente-de-ia.md#l-agentes--instrucoes-e-capacidades) — Configurar e publicar somente as capacidades necessárias ao agente do roteiro.
- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Agenda › A agenda de cada pessoa da equipe](atendimento.md#l-agenda--agenda-de-cada-pessoa) — Conferir a agenda de um profissional.
- [Agenda › Marcar um novo agendamento](atendimento.md#l-agenda--novo-agendamento) — Registrar o compromisso com o contato e quem atende.
- [Agenda › A lista de compromissos](atendimento.md#l-agenda--lista-de-compromissos) — Acompanhar a situação do compromisso na lista.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Uma primeira consulta | Marina Exemplo pergunta se pode marcar uma consulta inicial. | O roteiro começa com a recepção identificando o serviço desejado, sem pedir um relato clínico detalhado no chat. | A conversa começa pelo que é necessário para organizar a visita. |
| Disponibilidade compatível | Marina solicita 27 de outubro às 9h30, se houver disponibilidade. | O piloto consultou a disponibilidade antes de marcar. A foto reconstitui a leitura do compromisso na agenda local. | Preferência e agenda são consideradas juntas. |
| Escolha explícita | Marina autoriza a marcação para o horário pedido, se estiver livre. | No piloto validado, a ferramenta de agenda gravou o compromisso. A foto reconstitui seus detalhes com dados fictícios. | Escolher um horário não se confunde com garantir uma vaga sem registro. |
| A recepção acompanha | Marina Exemplo quer saber se precisa de outra confirmação. | A recepção confere o compromisso na lista e esclarece a situação registrada; orientações clínicas ficam com o profissional. | A equipe consegue continuar a partir do compromisso, sem refazer a conversa. |

### Remarcar sem perder o compromisso

- **Empresa (fictícia):** Movimento Fisioterapia (fictícia)
- **Contexto:** Rui precisa trocar a sessão já combinada, sem criar uma segunda reserva.
- **Resultado:** A sessão existente é remarcada e a equipe acompanha o novo horário.
- **Dependências:** Agenda e acesso da recepção necessários. O roteiro mostra ação da equipe; não muda plano terapêutico, frequência de sessões nem avaliação do profissional.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Agenda › A agenda de cada pessoa da equipe](atendimento.md#l-agenda--agenda-de-cada-pessoa) — Conferir a agenda de um profissional.
- [Agenda › Remarcar e cancelar](atendimento.md#l-agenda--remarcar-e-cancelar) — Alterar o compromisso existente em vez de duplicá-lo.
- [Inbox › Recados para a equipe com a nota interna](atendimento.md#l-inbox--nota-interna) — Guardar contexto visível somente para a equipe.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| O horário deixou de servir | Rui avisa que não consegue ir à sessão marcada. | A recepção localiza a conversa e identifica qual compromisso ele quer alterar. | Evita mexer em outra sessão do mesmo paciente. |
| Mesmo profissional | Rui prefere continuar com a mesma fisioterapeuta. | A recepção filtra a agenda dela e confere alternativas antes de oferecer a troca. | Preserva a preferência sem prometer encaixe. |
| Trocar, sem duplicar | Rui aceita uma alternativa disponível. | A equipe remarca o compromisso existente, conferindo data, hora e responsável. | O histórico conserva a mudança e a agenda não ganha uma reserva paralela. |
| Contexto para quem recebe | Rui pergunta se precisa recomeçar o atendimento. | Uma nota interna registra apenas o motivo administrativo da troca; dúvidas sobre tratamento são encaminhadas ao profissional. | Quem recebe o paciente entende a alteração sem orientação clínica improvisada. |

### Quando o preparo exige decisão profissional

- **Empresa (fictícia):** Clínica Vereda (fictícia)
- **Contexto:** Nina pergunta se deve alterar um medicamento antes de um exame.
- **Resultado:** A questão sai da resposta automática e chega à pessoa habilitada.
- **Dependências:** Requer agente publicado, capacidade de abrir caso e equipe responsável. Instruções de medicamentos, diagnóstico e preparo individualizado não são decididos pelo agente. A resposta posterior depende da equipe, IA e canal ativos.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Agentes › Instruções, capacidades e conhecimento](agente-de-ia.md#l-agentes--instrucoes-e-capacidades) — Configurar e publicar somente as capacidades necessárias ao agente do roteiro.
- [Agentes › Quando ele responde e quando chama a equipe](agente-de-ia.md#l-agentes--quando-responder-e-passar) — Definir os limites e as situações em que a equipe continua o atendimento.
- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Casos › Abrindo um caso](agente-de-ia.md#l-casos--abrindo-um-caso) — Ler a demanda que precisa de decisão da equipe.
- [Casos › Respondendo um caso](agente-de-ia.md#l-casos--respondendo-um-caso) — Pedir informação, registrar a decisão ou passar ao humano.
- [Inbox › Assumir um cliente e preparar a resposta](atendimento.md#l-inbox--assumir-e-responder) — Assumir o atendimento e responder pela equipe.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Uma pergunta sensível | Nina pergunta se deve suspender o medicamento que usa. | O agente do roteiro reconhece que uma orientação individual precisa de avaliação profissional. | A recepção não transforma uma pergunta clínica em resposta genérica. |
| A dúvida ganha contexto | Nina informa qual exame foi agendado. | O roteiro abre um caso com a pergunta e o contexto administrativo, evitando espalhar detalhes sensíveis desnecessários. | A pessoa habilitada recebe uma demanda identificável. |
| Responsabilidade definida | Nina pede para falar com alguém da clínica. | A equipe escolhe passar para atendimento humano, com recado sobre a dúvida que precisa ser tratada. | A decisão sobre medicamento permanece com o profissional. |
| Continuidade pela equipe | Nina retoma a conversa quando a equipe assume. | A pessoa responsável atende pelo canal e registra o encaminhamento cabível, sem o roteiro antecipar uma orientação médica. | O histórico sustenta a continuidade sem prometer resultado clínico. |

---

<a id="n-consorcio"></a>

## Consórcio

Intenção de compra, análise de informações e encaminhamento sem promessa de contemplação ou crédito.

### Do objetivo à conversa com o consultor

- **Empresa (fictícia):** Ciclo Consórcios (fictícia)
- **Contexto:** Caio considera um consórcio para imóvel, mas ainda compara possibilidades.
- **Resultado:** Oportunidade com objetivo declarado e reunião com consultor.
- **Dependências:** Funil, agenda e consultor disponíveis. Condições devem vir de material vigente da administradora; não há aprovação de crédito, rentabilidade ou contemplação garantida.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Funis › Criando um negócio novo](crm.md#l-funis--novo-negocio) — Criar uma oportunidade ligada ao contato.
- [Agenda › Marcar um novo agendamento](atendimento.md#l-agenda--novo-agendamento) — Registrar o compromisso com o contato e quem atende.
- [Funis › A ficha do negócio](crm.md#l-funis--ficha-do-negocio) — Reunir contexto e tarefas na ficha do negócio.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Começar pelo objetivo | Caio quer entender se consórcio faz sentido para comprar um imóvel. | O atendimento pergunta o objetivo e se existe necessidade imediata, sem recomendar um contrato por conta própria. | O consultor sabe o que precisa discutir. |
| Interesse sem adesão | Caio diz que está apenas comparando alternativas. | A equipe cria oportunidade ligada ao contato e registra o estágio de pesquisa, sem marcar adesão. | O funil representa intenção, não contratação. |
| Conversa com responsável | Caio aceita esclarecer as condições com o consultor. | A equipe confere e registra uma reunião na Agenda, com horário aceito pelo interessado. | Há um próximo passo combinado. |
| Preparação da reunião | Caio quer levar dúvidas sobre taxas e reajustes. | A pessoa responsável anota essas perguntas na ficha para a reunião com informações vigentes da administradora. | A conversa comercial começa por dúvidas reais. |

### Pergunta sobre lance vira caso para análise

- **Empresa (fictícia):** Elo Administradora Comercial (fictícia)
- **Contexto:** Téo pergunta se um lance específico garantiria sua contemplação.
- **Resultado:** Dúvida examinada pelo consultor sem promessa de resultado.
- **Dependências:** Agente com casos habilitados, equipe responsável e regras vigentes da administradora. Não calcular probabilidade, recomendar valor de lance ou prometer contemplação; o roteiro não envia lance.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Agentes › Instruções, capacidades e conhecimento](agente-de-ia.md#l-agentes--instrucoes-e-capacidades) — Configurar e publicar somente as capacidades necessárias ao agente do roteiro.
- [Agentes › Quando ele responde e quando chama a equipe](agente-de-ia.md#l-agentes--quando-responder-e-passar) — Definir os limites e as situações em que a equipe continua o atendimento.
- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Casos › Abrindo um caso](agente-de-ia.md#l-casos--abrindo-um-caso) — Ler a demanda que precisa de decisão da equipe.
- [Casos › Respondendo um caso](agente-de-ia.md#l-casos--respondendo-um-caso) — Pedir informação, registrar a decisão ou passar ao humano.
- [Inbox › Assumir um cliente e preparar a resposta](atendimento.md#l-inbox--assumir-e-responder) — Assumir o atendimento e responder pela equipe.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Uma expectativa de garantia | Téo pergunta se determinado lance seria suficiente. | O agente do roteiro esclarece que não pode assegurar resultado e identifica a dúvida a encaminhar. | Evita converter hipótese em promessa comercial. |
| Contexto para análise | Téo informa a qual grupo e cota se refere. | O roteiro abre caso com os dados necessários para o responsável consultar as regras aplicáveis. | A dúvida não fica diluída numa conversa de venda genérica. |
| Decisão de quem conhece o contrato | Téo pergunta como funciona o procedimento. | O consultor registra que seguirá por atendimento humano para explicar regras e limitações da administradora. | A explicação se apoia no contrato correto. |
| Continuidade sem submissão automática | Téo quer decidir depois de entender os riscos. | O consultor assume e explica o procedimento real; enviar ou alterar um lance fora do CRM é ação separada. | A decisão permanece informada e com o interessado. |

### Pendência cadastral com responsável

- **Empresa (fictícia):** Roda Planejamento (fictícia)
- **Contexto:** Sol já iniciou um processo com a equipe e precisa saber o que falta no cadastro.
- **Resultado:** Pendência organizada em tarefa, sem confundir entrega de documentos com aprovação.
- **Dependências:** Processo e canal documental definidos pela empresa, equipe e tarefas disponíveis. Não analisa crédito, não aprova cadastro nem modifica dados da administradora automaticamente.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Inbox › Recados para a equipe com a nota interna](atendimento.md#l-inbox--nota-interna) — Guardar contexto visível somente para a equipe.
- [Tarefas › Criar uma tarefa](crm.md#l-tarefas--tarefas-criar-uma-tarefa) — Criar um próximo passo explícito para a equipe.
- [Tarefas › Concluir, editar e apagar](crm.md#l-tarefas--tarefas-concluir-editar-apagar) — Concluir ou atualizar a tarefa após a ação real.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Uma solicitação em andamento | Sol pergunta se a equipe já conferiu o cadastro. | O atendente recupera o histórico antes de pedir novamente os mesmos itens. | A pessoa não precisa recontar todo o processo. |
| Conferência mínima | Sol diz quais documentos já enviou pelo canal combinado. | A equipe registra uma nota administrativa sobre a conferência, sem copiar conteúdo sensível desnecessário. | O contexto circula dentro da equipe com menos exposição. |
| Item que falta conferir | Sol quer saber qual providência depende da equipe. | O responsável cria tarefa para conferir a pendência com a administradora e atualiza os detalhes conforme a resposta real. | A pendência ganha dono, sem prazo padrão inventado. |
| Conferência encerrada | Sol recebe a orientação sobre o item pendente. | A equipe conclui a tarefa apenas após a conferência; deixa claro que isso não equivale à aprovação de crédito ou de cadastro. | A lista distingue trabalho feito de decisão externa. |

---

<a id="n-contabilidade"></a>

## Contabilidade

Documentos, conferências e atendimento de empresas com análise fiscal reservada aos profissionais.

### Fechamento com pendência visível

- **Empresa (fictícia):** Conta Clara (fictícia)
- **Contexto:** Mara pergunta se os documentos enviados para a contabilidade estão completos.
- **Resultado:** Conferência administrativa registrada em tarefa com responsável.
- **Dependências:** Rotina documental e canal de envio definidos pelo escritório, tarefas e equipe disponíveis. Não fixa calendário fiscal, garante entrega de obrigação ou afirma que documentos recebidos estão corretos.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Inbox › Recados para a equipe com a nota interna](atendimento.md#l-inbox--nota-interna) — Guardar contexto visível somente para a equipe.
- [Tarefas › Criar uma tarefa](crm.md#l-tarefas--tarefas-criar-uma-tarefa) — Criar um próximo passo explícito para a equipe.
- [Tarefas › Concluir, editar e apagar](crm.md#l-tarefas--tarefas-concluir-editar-apagar) — Concluir ou atualizar a tarefa após a ação real.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Material enviado | Mara quer saber se faltou algum documento da empresa. | O atendimento identifica qual período ela está perguntando e qual rotina está em andamento. | A pergunta deixa de ser uma pendência vaga. |
| O que precisa conferir | Mara lista os tipos de arquivo enviados pelo canal combinado. | A equipe registra uma nota administrativa sobre a solicitação, sem copiar dados financeiros no chat desnecessariamente. | A pessoa que confere recebe o contexto necessário. |
| Conferência com dono | Mara pede uma checagem do material. | A equipe cria tarefa para o responsável comparar o recebido com a rotina acordada para aquela empresa. | Existe uma ação visível sem prazo fiscal presumido. |
| A checagem terminou | Mara recebe a relação de pendências verificada. | O responsável conclui a tarefa de conferência e registra o que ainda depende da cliente, sem declarar obrigação fiscal entregue. | O histórico distingue conferir documentos e cumprir obrigações. |

### Consultar registro de uma guia com fonte definida

- **Empresa (fictícia):** Escritório Soma (fictícia)
- **Contexto:** Nilo quer saber qual situação consta para uma guia no cadastro do escritório.
- **Resultado:** Leitura do registro disponível ou encaminhamento para conferência profissional.
- **Dependências:** Conexão externa ativa com campos liberados, identificação da empresa e do solicitante verificada pela equipe e capacidade de leitura habilitada. Não consulta universalmente portais fiscais nem confirma quitação legal, prazo ou compensação.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado. A tela de Dados externos ilustra preparação; a conferência da origem fica com a equipe.

**Como montar (lições do curso):**

- [Agentes › Instruções, capacidades e conhecimento](agente-de-ia.md#l-agentes--instrucoes-e-capacidades) — Configurar e publicar somente as capacidades necessárias ao agente do roteiro.
- [Dados externos › Cadastrar uma conexão nova](configuracoes.md#l-dados-externos--cadastrar-conexao) — Cadastrar a fonte externa com credenciais de leitura e testar o acesso antes do atendimento.
- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Dados externos › Escolher o que o assistente pode ver](configuracoes.md#l-dados-externos--o-que-o-assistente-ve) — Entender a leitura externa e o recorte autorizado.
- [Dados externos › Testar, editar e remover uma conexão](configuracoes.md#l-dados-externos--testar-editar-remover) — Testar a conexão e reconhecer indisponibilidade.
- [Tarefas › Criar uma tarefa](crm.md#l-tarefas--tarefas-criar-uma-tarefa) — Criar um próximo passo explícito para a equipe.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Uma guia específica | Nilo pergunta sobre uma guia de sua empresa. | A equipe identifica a empresa e o documento antes de consultar qualquer registro. | Evita devolver informação de outro cliente. |
| Preparar a fonte autorizada | Nilo pede a situação que o escritório tem registrada. | A tela mostra a preparação de uma conexão de leitura. Nesta história, a equipe confere manualmente o registro no sistema de origem; não há consulta automatizada demonstrada. | Expõe a dependência da fonte e evita apresentar uma informação não conferida como resposta do agente. |
| Conferência atribuída à equipe | Nilo pergunta se a consulta pode ser confirmada mesmo assim. | A equipe registra uma tarefa para conferir a guia no sistema de origem autorizado. A conexão mostrada na cena anterior ainda era preparação, sem consulta automatizada demonstrada. | Há um responsável pelo próximo passo, sem afirmar situação fiscal que não foi conferida. |
| Conferência complementar | Nilo precisa esclarecer uma divergência com seu comprovante. | A equipe abre tarefa para o contador verificar nos canais adequados e devolver a situação apurada. | A divergência ganha responsável sem afirmar quitação. |

### Nova empresa com conversa de enquadramento

- **Empresa (fictícia):** Balanço Vivo (fictícia)
- **Contexto:** Íris quer contratar apoio para uma empresa que está organizando.
- **Resultado:** Oportunidade preparada para reunião de avaliação profissional.
- **Dependências:** Funil, agenda e profissional disponíveis. O roteiro não escolhe regime tributário, calcula economia, emite parecer ou garante prazo de abertura de empresa.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Funis › Criando um negócio novo](crm.md#l-funis--novo-negocio) — Criar uma oportunidade ligada ao contato.
- [Agenda › Marcar um novo agendamento](atendimento.md#l-agenda--novo-agendamento) — Registrar o compromisso com o contato e quem atende.
- [Funis › A ficha do negócio](crm.md#l-funis--ficha-do-negocio) — Reunir contexto e tarefas na ficha do negócio.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Uma empresa em planejamento | Íris pergunta qual plano contábil deve contratar. | O atendimento pergunta a atividade pretendida e o tipo de apoio que ela busca, sem indicar regime tributário. | A equipe identifica o objetivo da conversa. |
| Uma oportunidade de serviço | Íris explica que ainda está estruturando a operação. | A equipe registra o interesse e as perguntas na oportunidade, sem tratar abertura como concluída. | O funil conserva o estágio real da decisão. |
| Avaliação com o contador | Íris quer conversar sobre as particularidades da atividade. | O atendente confere disponibilidade e marca uma reunião com o profissional. | Questões de enquadramento chegam a quem pode analisá-las. |
| Contexto para a reunião | Íris pede para incluir uma dúvida sobre contratação de pessoas. | A equipe registra a pergunta na ficha do negócio para revisão do contador, sem antecipar orientação trabalhista ou fiscal. | A reunião aproveita o contexto já compartilhado. |

---

<a id="n-e-commerce"></a>

## E-commerce

Pedidos, trocas e venda consultiva com leitura externa condicionada à integração disponível.

### Onde está meu pedido?

- **Empresa (fictícia):** Casa das Trilhas (fictícia)
- **Contexto:** Bia Exemplo pede a situação e o rastreio do pedido CT-4729, uma Mochila Horizonte.
- **Resultado:** Pedido consultado na fonte autorizada: Despachado, com rastreio RASTREIO-EXEMPLO-4729.
- **Dependências:** Requer conexão externa ativa, tabelas e colunas autorizadas, capacidades de leitura no agente e regra da loja para conferir identidade e vínculo com o pedido. Não consulta qualquer loja por padrão, não altera pedido e não garante entrega.
- **Nota:** Telas reais com dados fictícios e estados reconstituídos. Motor e leitura do pedido foram validados com a ferramenta direta, que retornou a mesma linha. Transporte externo simulado; as fotos não são uma gravação da execução.

**Como montar (lições do curso):**

- [Agentes › Instruções, capacidades e conhecimento](agente-de-ia.md#l-agentes--instrucoes-e-capacidades) — Configurar e publicar somente as capacidades necessárias ao agente do roteiro.
- [Dados externos › Cadastrar uma conexão nova](configuracoes.md#l-dados-externos--cadastrar-conexao) — Cadastrar a fonte externa com credenciais de leitura e testar o acesso antes do atendimento.
- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Inbox › Recados para a equipe com a nota interna](atendimento.md#l-inbox--nota-interna) — Guardar contexto visível somente para a equipe.
- [Dados externos › Escolher o que o assistente pode ver](configuracoes.md#l-dados-externos--o-que-o-assistente-ve) — Entender a leitura externa e o recorte autorizado.
- [Tarefas › Criar uma tarefa](crm.md#l-tarefas--tarefas-criar-uma-tarefa) — Criar um próximo passo explícito para a equipe.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Uma compra anterior | Bia Exemplo pergunta se a mochila do pedido CT-4729 já foi despachada. | O roteiro identifica que é pós-venda, sem criar uma nova oportunidade de compra para responder ao pedido. | A demanda segue pelo contexto correto. |
| Conferir antes de expor | Bia informa o pedido CT-4729. | O piloto associa a consulta ao contato. A fonte aplica o filtro do cliente e mantém outro pedido de controle fora da resposta. | A consulta não deve expor compras de outra pessoa. |
| Ler a fonte disponível | Bia pede a situação e o rastreio. | O piloto leu uma linha da fonte autorizada: Mochila Horizonte, Despachado, RASTREIO-EXEMPLO-4729. A foto mostra a fonte fictícia real e destaca esse pedido; o administrador também enxerga o pedido de controle. | A resposta depende da fonte, sem inventar transportadora ou previsão. |
| Resposta com a fonte conferida | Bia recebe a situação e o código de rastreio. | A conversa reconstitui a resposta observada do agente. O transporte externo foi simulado; não houve envio a cliente real. | A equipe vê qual pedido e rastreio sustentaram a resposta. |

### Troca de tamanho com conferência humana

- **Empresa (fictícia):** Veste Aurora (fictícia)
- **Contexto:** Cris recebeu um calçado e precisa de outro tamanho.
- **Resultado:** Solicitação contextualizada e encaminhada à equipe que decide a troca.
- **Dependências:** Política de trocas cadastrada e equipe responsável; caso via agente exige capacidade habilitada. Nenhuma foto comprova concessão de troca, estoque, frete ou reembolso. Alterações na plataforma de venda são feitas fora deste fluxo.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Agentes › Instruções, capacidades e conhecimento](agente-de-ia.md#l-agentes--instrucoes-e-capacidades) — Configurar e publicar somente as capacidades necessárias ao agente do roteiro.
- [Agentes › Quando ele responde e quando chama a equipe](agente-de-ia.md#l-agentes--quando-responder-e-passar) — Definir os limites e as situações em que a equipe continua o atendimento.
- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Casos › Abrindo um caso](agente-de-ia.md#l-casos--abrindo-um-caso) — Ler a demanda que precisa de decisão da equipe.
- [Casos › Respondendo um caso](agente-de-ia.md#l-casos--respondendo-um-caso) — Pedir informação, registrar a decisão ou passar ao humano.
- [Inbox › Assumir um cliente e preparar a resposta](atendimento.md#l-inbox--assumir-e-responder) — Assumir o atendimento e responder pela equipe.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| O produto chegou | Cris explica que o calçado ficou apertado. | A conversa registra que se trata de troca, e não de uma nova venda. | A equipe consegue ler o motivo desde a primeira mensagem. |
| Detalhar a solicitação | Cris indica o pedido e o tamanho desejado. | No roteiro, o agente reúne a demanda em um caso para conferência da política e da compra pela equipe. | A exceção tem um lugar de acompanhamento. |
| Falta uma informação | Cris ainda não informou se o produto foi usado. | A equipe usa a opção de pedir informação ao cliente, especificando o que falta para analisar, sem aprovar a troca antecipadamente. | A análise avança com uma pergunta concreta. |
| A loja decide | Cris responde e pede as orientações de envio. | A pessoa responsável assume a conversa e comunica somente a decisão efetiva; eventual troca no sistema da loja é uma ação separada. | Atendimento e execução logística ficam distinguíveis. |

### Escolher um kit sem perder o próximo passo

- **Empresa (fictícia):** Ateliê Semente (fictícia)
- **Contexto:** Davi busca um presente e ainda não decidiu qual kit faz sentido.
- **Resultado:** Oportunidade organizada com preferência e tarefa de atendimento.
- **Dependências:** Funil configurado, contato e equipe com permissão de edição. Preço, estoque, desconto e prazo dependem da loja; o CRM não garante disponibilidade nem pagamento.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Funis › Criando um negócio novo](crm.md#l-funis--novo-negocio) — Criar uma oportunidade ligada ao contato.
- [Tarefas › Criar uma tarefa](crm.md#l-tarefas--tarefas-criar-uma-tarefa) — Criar um próximo passo explícito para a equipe.
- [Funis › Andar com o negócio: mover, ganhar e perder](crm.md#l-funis--mover-e-fechar) — Mover o negócio conforme o avanço real do atendimento.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Um presente com intenção | Davi quer presentear alguém que gosta de jardinagem. | A equipe pergunta sobre o uso pretendido e as preferências antes de sugerir um kit. | A sugestão começa pela necessidade do comprador. |
| Preferência registrada | Davi prefere um kit para varanda pequena. | O atendente cria um negócio ligado ao contato e registra o interesse, sem atribuir receita a uma intenção de compra. | A oportunidade permanece identificada para outro atendente. |
| Conferir a composição | Davi pergunta se pode incluir uma ferramenta diferente. | A equipe cria uma tarefa para conferir a composição com quem monta os kits. | Uma pergunta que exige conferência não fica perdida no chat. |
| Avançar com evidência | Davi recebe as opções e pede para avaliar. | A equipe move o negócio à etapa configurada que corresponde à análise e deixa o próximo passo registrado, sem marcar venda como ganha. | O quadro reflete a decisão real do comprador. |

---

<a id="n-educacao"></a>

## Escolas e cursos

Visita, matrícula em análise e apoio ao aluno com atendimento administrativo organizado.

### Conhecer a escola antes da matrícula

- **Empresa (fictícia):** Escola Jardim Azul (fictícia)
- **Contexto:** Noa quer conhecer a proposta pedagógica e os espaços para um estudante da família.
- **Resultado:** Visita registrada e interesse acompanhado pela secretaria.
- **Dependências:** Agenda, equipe e informações oficiais da escola; atendimento de responsáveis conforme política da instituição. Não garante vaga, bolsa, adaptação ou resultado pedagógico.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Funis › Criando um negócio novo](crm.md#l-funis--novo-negocio) — Criar uma oportunidade ligada ao contato.
- [Agenda › Marcar um novo agendamento](atendimento.md#l-agenda--novo-agendamento) — Registrar o compromisso com o contato e quem atende.
- [Tarefas › Criar uma tarefa](crm.md#l-tarefas--tarefas-criar-uma-tarefa) — Criar um próximo passo explícito para a equipe.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Antes da matrícula | Noa pergunta como pode conhecer a escola. | A secretaria pergunta a etapa de ensino de interesse e o que a família quer conhecer. | A visita tem um propósito definido. |
| Interesse da família | Noa informa que quer entender a rotina do período pretendido. | A equipe registra uma oportunidade com as preferências, sem incluir dados sensíveis do estudante desnecessariamente. | A secretaria acompanha o interesse sem prometer vaga. |
| Visita combinada | Noa escolhe uma opção oferecida pela secretaria. | A equipe confere quem recebe a família e registra o compromisso na Agenda. | Recepção e família partem do mesmo horário. |
| Depois de conhecer | Noa pede uma conversa sobre a proposta pedagógica. | A secretaria cria tarefa para a equipe responsável retomar a dúvida após a visita. | A continuidade respeita o interesse expresso pela família. |

### Matrícula com pendências distintas de aprovação

- **Empresa (fictícia):** Centro de Idiomas Ponte (fictícia)
- **Contexto:** Eli decidiu buscar uma turma, mas precisa conferir documentação e disponibilidade.
- **Resultado:** Matrícula acompanhada no funil com tarefa para a secretaria.
- **Dependências:** Turmas e condições conferidas pela escola, funil e tarefas habilitados. Não realiza teste de nível, garante vaga, aprova bolsa ou efetiva matrícula em plataforma externa automaticamente.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Funis › A ficha do negócio](crm.md#l-funis--ficha-do-negocio) — Reunir contexto e tarefas na ficha do negócio.
- [Tarefas › Criar uma tarefa](crm.md#l-tarefas--tarefas-criar-uma-tarefa) — Criar um próximo passo explícito para a equipe.
- [Funis › Andar com o negócio: mover, ganhar e perder](crm.md#l-funis--mover-e-fechar) — Mover o negócio conforme o avanço real do atendimento.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Uma turma desejada | Eli pergunta se pode começar numa turma específica. | A secretaria identifica o curso e a preferência de horário antes de confirmar qualquer disponibilidade. | A intenção fica ligada à turma correta. |
| O contexto da matrícula | Eli diz que já conversou com outra pessoa da escola. | A equipe recupera a ficha do negócio e as anotações existentes. | O atendimento continua sem recomeçar do zero. |
| Conferência da secretaria | Eli pergunta o que falta para avançar. | Uma tarefa reúne a conferência de documentos e da vaga com o responsável, segundo as regras da escola. | Recebimento de documento não equivale a matrícula efetivada. |
| Avanço real no quadro | Eli ainda aguarda a confirmação da secretaria. | A equipe mantém ou move o negócio conforme a situação realmente verificada, sem fechar como ganho antes da efetivação. | O quadro evita uma confirmação de matrícula prematura. |

### Mudança de turma com decisão da escola

- **Empresa (fictícia):** Curso Horizonte (fictícia)
- **Contexto:** Uli precisa mudar o horário das aulas e pede uma exceção à secretaria.
- **Resultado:** Solicitação levada à equipe responsável e acompanhada na conversa.
- **Dependências:** Agente com abertura de casos, secretaria e regras de mudança definidas. Não altera turma em sistema acadêmico nem garante equivalência pedagógica, reposição ou deferimento.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Agentes › Instruções, capacidades e conhecimento](agente-de-ia.md#l-agentes--instrucoes-e-capacidades) — Configurar e publicar somente as capacidades necessárias ao agente do roteiro.
- [Agentes › Quando ele responde e quando chama a equipe](agente-de-ia.md#l-agentes--quando-responder-e-passar) — Definir os limites e as situações em que a equipe continua o atendimento.
- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Casos › Abrindo um caso](agente-de-ia.md#l-casos--abrindo-um-caso) — Ler a demanda que precisa de decisão da equipe.
- [Casos › Respondendo um caso](agente-de-ia.md#l-casos--respondendo-um-caso) — Pedir informação, registrar a decisão ou passar ao humano.
- [Inbox › Assumir um cliente e preparar a resposta](atendimento.md#l-inbox--assumir-e-responder) — Assumir o atendimento e responder pela equipe.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| A rotina mudou | Uli conta que o horário da turma ficou incompatível com o trabalho. | O agente do roteiro identifica o pedido de mudança, sem cancelar a matrícula existente. | A solicitação não produz alteração precipitada. |
| Uma exceção com contexto | Uli explica quais períodos consegue frequentar. | O roteiro abre caso com o pedido e a preferência de horário para a secretaria analisar. | A equipe recebe uma demanda específica. |
| A escola precisa decidir | Uli pergunta se a mudança já está valendo. | A secretaria seleciona atendimento humano para conferir vagas e regras acadêmicas antes de responder. | A análise não é apresentada como deferimento. |
| Comunicar o que foi decidido | Uli aguarda as opções verificadas. | A pessoa responsável assume, informa a decisão real e orienta eventuais passos no sistema acadêmico fora deste roteiro. | A conversa mantém o vínculo entre pedido e resposta. |

---

<a id="n-imobiliarias"></a>

## Imobiliárias

Preferências de imóvel, visita e acompanhamento documental sem prometer disponibilidade ou aprovação.

### Da busca à visita acompanhada

- **Empresa (fictícia):** Horizonte Imóveis (fictícia)
- **Contexto:** Eva procura apartamento com acesso por elevador e quer visitar antes de decidir.
- **Resultado:** Visita registrada com corretor e preferências disponíveis no histórico.
- **Dependências:** Requer imóveis conferidos pela imobiliária, funil, agenda e expediente do corretor. O roteiro não consulta portais automaticamente nem garante reserva, acessibilidade técnica ou disponibilidade de imóvel.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Funis › Criando um negócio novo](crm.md#l-funis--novo-negocio) — Criar uma oportunidade ligada ao contato.
- [Agenda › Marcar um novo agendamento](atendimento.md#l-agenda--novo-agendamento) — Registrar o compromisso com o contato e quem atende.
- [Tarefas › Criar uma tarefa](crm.md#l-tarefas--tarefas-criar-uma-tarefa) — Criar um próximo passo explícito para a equipe.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Necessidade específica | Eva procura apartamento com elevador e espaço para trabalhar. | O atendimento pergunta região e características indispensáveis, distinguindo preferência de requisito obrigatório. | A busca ganha critérios úteis para o corretor. |
| Uma oportunidade ligada à pessoa | Eva informa quais opções gostaria de conhecer. | A equipe registra um negócio com as preferências e os imóveis a conferir, ligados ao contato. | O corretor encontra contexto antes de telefonar. |
| Combinar a visita | Eva aceita visitar uma das opções conferidas. | Depois de checar acesso ao imóvel e disponibilidade do corretor, a equipe registra o compromisso na Agenda. | O horário representa uma combinação, sem prometer reserva do imóvel. |
| Depois da visita | Eva quer comparar iluminação e ruído antes de decidir. | O corretor cria uma tarefa para retomar essas questões e atualizar o negócio após a conversa. | O acompanhamento considera os critérios da visita. |

### Locação com pendências organizadas

- **Empresa (fictícia):** Chave Aberta (fictícia)
- **Contexto:** Ivo gostou de um imóvel e quer saber como avançar na locação.
- **Resultado:** Documentos pendentes e responsável identificados sem antecipar a análise cadastral.
- **Dependências:** Processo documental definido pela imobiliária, tarefa e funil habilitados. Dados sensíveis seguem o canal seguro adotado pela empresa. Não há análise de crédito, aprovação de cadastro ou contrato automático neste roteiro.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Funis › A ficha do negócio](crm.md#l-funis--ficha-do-negocio) — Reunir contexto e tarefas na ficha do negócio.
- [Tarefas › Criar uma tarefa](crm.md#l-tarefas--tarefas-criar-uma-tarefa) — Criar um próximo passo explícito para a equipe.
- [Funis › Andar com o negócio: mover, ganhar e perder](crm.md#l-funis--mover-e-fechar) — Mover o negócio conforme o avanço real do atendimento.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Intenção de alugar | Ivo pergunta qual é o próximo passo após conhecer o imóvel. | A equipe localiza o histórico e explica o processo documental adotado pela imobiliária. | O atendimento parte de uma visita já realizada. |
| O que já foi combinado | Ivo confirma qual imóvel deseja seguir avaliando. | A pessoa responsável abre a ficha do negócio e confere preferências e anotações da visita. | Não se mistura a candidatura com outros imóveis. |
| Pendência com dono | Ivo pergunta quais itens ainda faltam. | A equipe cria uma tarefa de conferência documental com responsável, sem pedir envio indiscriminado de documentos pelo chat. | Existe um próximo passo verificável para a análise. |
| Análise ainda aberta | Ivo quer saber se a locação já está aprovada. | A equipe mantém o negócio na etapa real de análise e esclarece que a decisão depende dos responsáveis externos ao roteiro. | O funil não transforma documentação recebida em aprovação. |

### Captação de imóvel com avaliação humana

- **Empresa (fictícia):** Pátio Imobiliária (fictícia)
- **Contexto:** Luz quer anunciar sua casa e pergunta por qual preço poderia vender.
- **Resultado:** Conversa chega ao corretor com visita de avaliação registrada.
- **Dependências:** Equipe e distribuição de atendimento configuradas; agenda para visita de avaliação. O roteiro não estima preço de mercado, prazo de venda ou valorização garantida.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Inbox › Recados para a equipe com a nota interna](atendimento.md#l-inbox--nota-interna) — Guardar contexto visível somente para a equipe.
- [Inbox › Pausar o robô, passar adiante e encerrar](atendimento.md#l-inbox--passar-pausar-encerrar) — Transferir a conversa para quem pode continuar.
- [Agenda › Marcar um novo agendamento](atendimento.md#l-agenda--novo-agendamento) — Registrar o compromisso com o contato e quem atende.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Um novo proprietário | Luz pergunta quanto vale sua casa. | A recepção identifica que é captação de imóvel, sem tratar a proprietária como compradora. | A conversa segue para quem atende esse tipo de demanda. |
| Características para a visita | Luz descreve localização e situação de ocupação. | Uma nota interna reúne os dados úteis e as dúvidas, sem produzir avaliação financeira. | O corretor prepara a visita a partir de contexto concreto. |
| Pessoa responsável | Luz quer entender o processo de anúncio. | A conversa é transferida ao corretor que cuida da captação, com o motivo da transferência. | A proprietária encontra uma pessoa responsável. |
| Avaliar antes de precificar | Luz aceita conversar no imóvel. | O corretor combina e registra uma visita de avaliação; preço e estratégia serão definidos por ele com a proprietária. | O próximo passo é uma avaliação real, sem estimativa inventada. |

---

<a id="n-infoprodutos"></a>

## Infoprodutos

Acesso, adequação da oferta e suporte com passagem à equipe quando a base não resolve.

### Acesso que precisa da equipe

- **Empresa (fictícia):** Escola Digital Farol (fictícia)
- **Contexto:** Pati Exemplo não consegue abrir a aula 3 de Fotografia na Prática: aparece erro 403, mesmo após sair e entrar novamente e trocar de navegador.
- **Resultado:** Caso aberto para a equipe, pedido de informação registrado e pergunta enviada na retomada do agente; acesso ainda não resolvido.
- **Dependências:** Canal conectado, agente publicado com regras de suporte e passagem à equipe, material oficial e atendentes disponíveis. O roteiro não redefine senha nem comprova integração com plataforma de cursos; nunca pedir senha ao aluno.
- **Nota:** Telas reais com dados fictícios e estados reconstituídos. O motor abriu um caso e retomou a conversa após a equipe pedir informação. Transporte externo simulado; acesso à plataforma de aulas não foi resolvido.

**Como montar (lições do curso):**

- [Agentes › Instruções, capacidades e conhecimento](agente-de-ia.md#l-agentes--instrucoes-e-capacidades) — Configurar e publicar somente as capacidades necessárias ao agente do roteiro.
- [Agentes › Quando ele responde e quando chama a equipe](agente-de-ia.md#l-agentes--quando-responder-e-passar) — Definir os limites e as situações em que a equipe continua o atendimento.
- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Casos › Abrindo um caso](agente-de-ia.md#l-casos--abrindo-um-caso) — Conferir a pergunta, o contexto e o bloqueio que exigem a equipe.
- [Casos › Respondendo um caso](agente-de-ia.md#l-casos--respondendo-um-caso) — Pedir informação ao cliente e acompanhar a situação do caso.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Aula com erro 403 | Pati relata erro 403 na aula 3 e informa as tentativas já feitas. | O piloto recebe a descrição sem pedir senha ou prometer acesso à plataforma de aulas. | A equipe começa pelo erro concreto e pelas tentativas já realizadas. |
| Caso com contexto | Pati informa que as outras aulas funcionam. | No piloto, o motor abriu Erro 403 na aula 3 — Fotografia na Prática, com o bloqueio de acesso à plataforma. A foto reconstitui o caso aguardando a equipe. | A demanda permanece identificada, sem uma solução improvisada. |
| A equipe pede uma informação | Falta saber o título completo que aparece na aula 3. | A equipe escolhe Preciso de info do cliente e pede o título completo da aula. A foto reconstitui essa escolha antes do envio. | A pessoa responsável define o dado necessário para continuar a investigação. |
| Pergunta na retomada | Pati recebe a pergunta sobre o título completo da aula. | O motor retomou a conversa e fez a pergunta solicitada. O caso ficou aguardando a cliente; não houve correção do acesso à plataforma. | A conversa continua a partir da decisão humana, com a pendência visível. |

### Escolher uma formação pelo objetivo

- **Empresa (fictícia):** Oficina Digital Rumo (fictícia)
- **Contexto:** Guto quer aprender uma habilidade, mas não sabe qual formação atende ao seu nível.
- **Resultado:** Interesse qualificado e próximo passo comercial registrado.
- **Dependências:** Catálogo e pré-requisitos atualizados pela escola, funil e tarefas habilitados. Não prometer renda, emprego, certificação não prevista ou resultados de aprendizagem garantidos.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Funis › Criando um negócio novo](crm.md#l-funis--novo-negocio) — Criar uma oportunidade ligada ao contato.
- [Tarefas › Criar uma tarefa](crm.md#l-tarefas--tarefas-criar-uma-tarefa) — Criar um próximo passo explícito para a equipe.
- [Funis › Andar com o negócio: mover, ganhar e perder](crm.md#l-funis--mover-e-fechar) — Mover o negócio conforme o avanço real do atendimento.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Um objetivo de estudo | Guto quer aprender a editar vídeos para o próprio negócio. | A equipe pergunta experiência e tipo de projeto antes de apresentar uma formação. | A recomendação considera o ponto de partida. |
| Pré-requisito importa | Guto diz que ainda não domina as ferramentas básicas. | O atendente registra o interesse no funil e a necessidade de conferir os pré-requisitos no catálogo oficial. | A venda não apaga uma possível incompatibilidade. |
| Comparar programas | Guto pede a diferença entre a formação básica e a avançada. | Uma tarefa é atribuída à equipe pedagógica ou comercial para comparar os programas vigentes. | A resposta depende do conteúdo real dos cursos. |
| Dar tempo para decidir | Guto pede para analisar a comparação. | A equipe atualiza a etapa do negócio conforme essa decisão e registra o próximo contato combinado, sem marcar matrícula. | O quadro distingue pesquisa e compra efetiva. |

### Pedido de reembolso com análise humana

- **Empresa (fictícia):** Ateliê de Aprender (fictícia)
- **Contexto:** Pati quer cancelar uma compra e pergunta como funciona o reembolso.
- **Resultado:** Solicitação reunida em caso e tratada pela equipe responsável.
- **Dependências:** Política aplicável e equipe responsável, agente com abertura de casos se usado. Não conceder ou negar direito, prometer prazo de estorno nem executar reembolso na plataforma externa neste roteiro.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Agentes › Instruções, capacidades e conhecimento](agente-de-ia.md#l-agentes--instrucoes-e-capacidades) — Configurar e publicar somente as capacidades necessárias ao agente do roteiro.
- [Agentes › Quando ele responde e quando chama a equipe](agente-de-ia.md#l-agentes--quando-responder-e-passar) — Definir os limites e as situações em que a equipe continua o atendimento.
- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Casos › Abrindo um caso](agente-de-ia.md#l-casos--abrindo-um-caso) — Ler a demanda que precisa de decisão da equipe.
- [Casos › Respondendo um caso](agente-de-ia.md#l-casos--respondendo-um-caso) — Pedir informação, registrar a decisão ou passar ao humano.
- [Inbox › Assumir um cliente e preparar a resposta](atendimento.md#l-inbox--assumir-e-responder) — Assumir o atendimento e responder pela equipe.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Pedido de cancelamento | Pati diz que quer cancelar o curso. | O atendimento identifica o produto e a solicitação sem tentar transformar o pedido em nova oferta. | A demanda é tratada pelo que foi pedido. |
| Uma análise identificável | Pati informa a referência da compra. | O agente do roteiro abre caso para a equipe conferir a transação e a política aplicável, com o mínimo de dados necessário. | A solicitação fica organizada para análise. |
| Resposta depende da conferência | Pati pergunta se o dinheiro já foi devolvido. | A equipe escolhe atendimento humano e registra o que precisa verificar na plataforma, sem confirmar um estorno não realizado. | Evita confundir registro do pedido e execução financeira. |
| Comunicar a situação real | Pati aguarda a confirmação do suporte. | A pessoa responsável informa a decisão e os procedimentos efetivos; eventual reembolso é executado no sistema próprio. | A resposta acompanha o fato apurado pela equipe. |

---

<a id="n-seguros"></a>

## Seguros

Cotação, renovação e sinistro com decisões de cobertura e aceitação atribuídas aos responsáveis.

### Cotação que chega preparada ao corretor

- **Empresa (fictícia):** Vento Corretora (fictícia)
- **Contexto:** Mila busca seguro para o carro e quer entender as diferenças entre opções.
- **Resultado:** Demanda registrada para cotação humana com necessidades do cliente.
- **Dependências:** Corretor responsável, funil e tarefas configurados. Nenhuma consulta automática a seguradoras, cálculo de prêmio, aceitação de risco ou garantia de cobertura é demonstrada.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Funis › Criando um negócio novo](crm.md#l-funis--novo-negocio) — Criar uma oportunidade ligada ao contato.
- [Tarefas › Criar uma tarefa](crm.md#l-tarefas--tarefas-criar-uma-tarefa) — Criar um próximo passo explícito para a equipe.
- [Inbox › Pausar o robô, passar adiante e encerrar](atendimento.md#l-inbox--passar-pausar-encerrar) — Transferir a conversa para quem pode continuar.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Antes de falar em preço | Mila pergunta quanto custa um seguro para o carro. | O atendimento pergunta o que ela quer proteger e se já possui apólice, sem calcular um prêmio genérico. | A conversa identifica a necessidade antes da proposta. |
| Contexto da cotação | Mila explica que usa o carro para deslocamentos ao trabalho. | A equipe abre um negócio para cotação e registra as informações declaradas, sem substituir o questionário da seguradora. | O corretor encontra o contexto do pedido. |
| Cotação é trabalho do responsável | Mila pede comparação entre opções. | Uma tarefa é atribuída ao corretor para levantar propostas pelos canais que ele utiliza e conferir os dados necessários. | Existe uma ação concreta sem fingir integração com seguradoras. |
| Explicar as diferenças | Mila quer entender franquia e exclusões. | A conversa é transferida ao corretor, que explica os termos das propostas reais antes de qualquer aceite. | Decisões contratuais ficam com quem pode esclarecê-las. |

### Renovação com conferência da apólice

- **Empresa (fictícia):** Porto do Sol Seguros (fictícia)
- **Contexto:** Otto pergunta se sua apólice está perto do fim e se precisa mudar algo.
- **Resultado:** Conferência externa limitada à fonte autorizada e revisão humana das condições.
- **Dependências:** Conexão de leitura com cadastro de apólices, campos liberados e identificação validada pela corretora. Não implica integração com toda seguradora; não renova contrato, cobra prêmio ou altera cobertura.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado. A tela de Dados externos ilustra preparação; a conferência da origem fica com a equipe.

**Como montar (lições do curso):**

- [Agentes › Instruções, capacidades e conhecimento](agente-de-ia.md#l-agentes--instrucoes-e-capacidades) — Configurar e publicar somente as capacidades necessárias ao agente do roteiro.
- [Dados externos › Cadastrar uma conexão nova](configuracoes.md#l-dados-externos--cadastrar-conexao) — Cadastrar a fonte externa com credenciais de leitura e testar o acesso antes do atendimento.
- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Dados externos › Escolher o que o assistente pode ver](configuracoes.md#l-dados-externos--o-que-o-assistente-ve) — Entender a leitura externa e o recorte autorizado.
- [Tarefas › Criar uma tarefa](crm.md#l-tarefas--tarefas-criar-uma-tarefa) — Criar um próximo passo explícito para a equipe.
- [Inbox › Assumir um cliente e preparar a resposta](atendimento.md#l-inbox--assumir-e-responder) — Assumir o atendimento e responder pela equipe.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Uma apólice existente | Otto quer saber se já é hora de revisar seu seguro. | A equipe identifica a apólice em questão e aplica o procedimento da corretora para validar o solicitante. | O atendimento não confunde contratos de clientes diferentes. |
| Preparar a fonte autorizada | Otto pergunta qual vigência consta no cadastro. | A tela mostra a preparação de uma conexão de leitura. Nesta história, a equipe confere manualmente o registro no sistema de origem; não há consulta automatizada demonstrada. | Expõe a dependência da fonte e evita apresentar uma informação não conferida como resposta do agente. |
| Revisar mudanças de uso | Otto conta que passou a usar o carro em outra atividade. | A equipe cria uma tarefa para o corretor revisar essa mudança com a seguradora. | Uma alteração relevante não vira renovação silenciosa. |
| Condições antes do aceite | Otto quer saber se pode manter as mesmas condições. | O corretor assume e confere propostas e condições atualizadas; nenhuma renovação é dada como concluída pelo roteiro. | A continuidade depende da análise contratual efetiva. |

### Aviso de sinistro sem promessa de cobertura

- **Empresa (fictícia):** Estação Corretora (fictícia)
- **Contexto:** Yara relata um dano e pergunta se o seguro cobre o ocorrido.
- **Resultado:** Relato encaminhado para orientação humana e análise pelos responsáveis.
- **Dependências:** Equipe habilitada e agente com abertura de caso, se usado. Não atende emergência, não decide cobertura, indenização ou prazo de regulação; procedimentos são os da seguradora responsável.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Agentes › Instruções, capacidades e conhecimento](agente-de-ia.md#l-agentes--instrucoes-e-capacidades) — Configurar e publicar somente as capacidades necessárias ao agente do roteiro.
- [Agentes › Quando ele responde e quando chama a equipe](agente-de-ia.md#l-agentes--quando-responder-e-passar) — Definir os limites e as situações em que a equipe continua o atendimento.
- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Casos › Abrindo um caso](agente-de-ia.md#l-casos--abrindo-um-caso) — Ler a demanda que precisa de decisão da equipe.
- [Casos › Respondendo um caso](agente-de-ia.md#l-casos--respondendo-um-caso) — Pedir informação, registrar a decisão ou passar ao humano.
- [Inbox › Assumir um cliente e preparar a resposta](atendimento.md#l-inbox--assumir-e-responder) — Assumir o atendimento e responder pela equipe.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Relato de um dano | Yara pergunta se o ocorrido está coberto. | O agente do roteiro acolhe a solicitação e evita confirmar cobertura com base em uma frase. | O atendimento não antecipa a decisão da seguradora. |
| Registrar a dúvida certa | Yara explica a que apólice se refere. | O roteiro abre caso com a pergunta sobre o procedimento e o contexto informado, sem laudo ou conclusão sobre o evento. | A equipe recebe uma demanda delimitada. |
| Passar para atendimento humano | Yara pede ajuda para saber por onde começar. | A equipe seleciona a passagem ao humano e registra quais orientações precisam ser conferidas. | A continuidade fica com um responsável. |
| Procedimento conferido | Yara volta à conversa com os dados solicitados pelo corretor. | A pessoa responsável explica os canais e os próximos passos aplicáveis, sem prometer indenização ou prazo de análise. | O cliente recebe orientação operacional situada no contrato real. |

---

<a id="n-servicos"></a>

## Oficinas e assistência técnica

Recepção de equipamento, diagnóstico humano e continuidade de orçamento ou reparo.

### Da descrição do defeito à avaliação técnica

- **Empresa (fictícia):** Oficina Ponto Certo (fictícia)
- **Contexto:** Vera quer levar um equipamento que parou de funcionar para uma avaliação.
- **Resultado:** Recebimento combinado e contexto administrativo para o técnico.
- **Dependências:** Agenda, tipos de atendimento e equipe configurados. O roteiro não diagnostica falha, promete conserto, define custo de peça ou tempo de reparo.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Inbox › Recados para a equipe com a nota interna](atendimento.md#l-inbox--nota-interna) — Guardar contexto visível somente para a equipe.
- [Agenda › Marcar um novo agendamento](atendimento.md#l-agenda--novo-agendamento) — Registrar o compromisso com o contato e quem atende.
- [Tarefas › Criar uma tarefa](crm.md#l-tarefas--tarefas-criar-uma-tarefa) — Criar um próximo passo explícito para a equipe.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Um equipamento parou | Vera conta que o equipamento não liga. | O atendimento pergunta o tipo e o modelo informado, sem diagnosticar pela descrição. | A recepção identifica o objeto do atendimento. |
| Relato para o técnico | Vera explica quando percebeu o problema. | A equipe anota o relato em nota interna como informação da cliente, sem apresentar causa técnica. | O técnico recebe o que foi relatado, não uma conclusão inventada. |
| Combinar o recebimento | Vera quer saber quando pode levar o equipamento. | A equipe confere disponibilidade e registra um compromisso de recebimento ou avaliação conforme o serviço configurado. | O horário reserva atendimento, sem prometer reparo na mesma visita. |
| Avaliação com responsável | Vera deixa o equipamento para análise. | A equipe cria tarefa de avaliação para a pessoa responsável e mantém o contexto disponível. | Existe próximo passo sem estimativa de conserto automática. |

### Orçamento depende de avaliação e aceite

- **Empresa (fictícia):** Assistência Girassol (fictícia)
- **Contexto:** Wes quer saber se vale a pena reparar um aparelho já recebido pela assistência.
- **Resultado:** Dúvida técnica encaminhada e aceite distinguido da execução do reparo.
- **Dependências:** Agente com casos habilitados, técnico e processo de orçamento definidos. Valores só podem vir de orçamento real aprovado pela assistência; não autoriza reparo, compra peças ou altera ordem externa automaticamente.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado.

**Como montar (lições do curso):**

- [Agentes › Instruções, capacidades e conhecimento](agente-de-ia.md#l-agentes--instrucoes-e-capacidades) — Configurar e publicar somente as capacidades necessárias ao agente do roteiro.
- [Agentes › Quando ele responde e quando chama a equipe](agente-de-ia.md#l-agentes--quando-responder-e-passar) — Definir os limites e as situações em que a equipe continua o atendimento.
- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Casos › Abrindo um caso](agente-de-ia.md#l-casos--abrindo-um-caso) — Ler a demanda que precisa de decisão da equipe.
- [Casos › Respondendo um caso](agente-de-ia.md#l-casos--respondendo-um-caso) — Pedir informação, registrar a decisão ou passar ao humano.
- [Inbox › Assumir um cliente e preparar a resposta](atendimento.md#l-inbox--assumir-e-responder) — Assumir o atendimento e responder pela equipe.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Antes de autorizar | Wes pergunta se o reparo compensaria. | O agente do roteiro reconhece que a comparação depende da avaliação técnica e do orçamento real. | O cliente não recebe um preço estimado sem base. |
| Dúvida para o técnico | Wes pede uma explicação sobre o que seria substituído. | O roteiro abre caso com a pergunta sobre o orçamento, sem criar laudo ou sugerir peça. | A avaliação chega ao responsável técnico. |
| Responder com responsabilidade | Wes quer decidir depois de entender as alternativas. | A equipe seleciona passagem ao humano e registra que a explicação precisa vir do técnico. | A decisão é sustentada pelo trabalho de quem examinou o aparelho. |
| Aceite é uma etapa própria | Wes recebe a explicação e ainda vai avaliar. | A pessoa responsável atende e registra a posição do cliente; autorizar o serviço depende do processo real da assistência. | Atendimento não se confunde com autorização automática de reparo. |

### Situação da ordem e retirada combinada

- **Empresa (fictícia):** Garagem do Bairro (fictícia)
- **Contexto:** Ada pergunta se o veículo está liberado e como combinar a retirada.
- **Resultado:** Situação consultada na fonte disponível e confirmação final com a oficina.
- **Dependências:** Conexão externa de leitura de ordens, campos autorizados, solicitante identificado e equipe responsável. Não atualiza ordem de serviço, confirma segurança do veículo, quitação ou garantia pelo simples estado do cadastro.
- **Nota:** Roteiro demonstrativo com empresas, pessoas e mensagens fictícias. As fotos são telas reais com estados semeados para esta história; a sequência não comprova execução do motor de IA. O transporte de mensagens é simulado. A tela de Dados externos ilustra preparação; a conferência da origem fica com a equipe.

**Como montar (lições do curso):**

- [Agentes › Instruções, capacidades e conhecimento](agente-de-ia.md#l-agentes--instrucoes-e-capacidades) — Configurar e publicar somente as capacidades necessárias ao agente do roteiro.
- [Dados externos › Cadastrar uma conexão nova](configuracoes.md#l-dados-externos--cadastrar-conexao) — Cadastrar a fonte externa com credenciais de leitura e testar o acesso antes do atendimento.
- [Agentes › Quando ele responde e quando chama a equipe](agente-de-ia.md#l-agentes--quando-responder-e-passar) — Definir os limites e as situações em que a equipe continua o atendimento.
- [Inbox › Conhecendo a Inbox](atendimento.md#l-inbox--conhecendo-a-tela) — Reconhecer a conversa e a ficha do contato.
- [Dados externos › Escolher o que o assistente pode ver](configuracoes.md#l-dados-externos--o-que-o-assistente-ve) — Entender a leitura externa e o recorte autorizado.
- [Inbox › Pausar o robô, passar adiante e encerrar](atendimento.md#l-inbox--passar-pausar-encerrar) — Transferir a conversa para quem pode continuar.
- [Agenda › Marcar um novo agendamento](atendimento.md#l-agenda--novo-agendamento) — Registrar o compromisso com o contato e quem atende.

**Cenas:**

| Cena | Cliente | Operação | Valor |
|---|---|---|---|
| Uma ordem em andamento | Ada pergunta se já pode buscar o veículo. | O atendimento identifica a ordem e aplica a conferência de identidade adotada pela oficina. | A consulta se refere ao veículo e à pessoa corretos. |
| Preparar a fonte autorizada | Ada quer saber o estado que consta na ordem. | A tela mostra a preparação de uma conexão de leitura. Nesta história, a equipe confere manualmente o registro no sistema de origem; não há consulta automatizada demonstrada. | Expõe a dependência da fonte e evita apresentar uma informação não conferida como resposta do agente. |
| Liberação exige conferência | Ada pergunta se pode sair com o veículo imediatamente. | A conversa passa à equipe da oficina para conferir liberação técnica e condições de retirada. | Um estado cadastral não substitui a verificação da oficina. |
| Retirada combinada | Ada aceita um horário depois da confirmação da equipe. | A oficina registra o compromisso de retirada com o responsável, sem modificar automaticamente a ordem no sistema externo. | Cliente e oficina conseguem se organizar para a entrega. |
