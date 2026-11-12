# #84 — Aviso de agendamento no WhatsApp (do dono e num grupo)

Issue: https://github.com/LuanSilvaR/-deskcomm-clinica/issues/84 · Épico #78 · Upstream #3105 (base) + #3460 (grupo)

## O que a clínica ganha
Em **Agenda › Aviso de agendamento** (só admin), a clínica escolhe um número conectado que manda os avisos e:
- o **número que recebe** (por exemplo, o celular da recepção ou da dona), e/ou
- um **grupo do WhatsApp** em que esse número está (por exemplo, o grupo da equipe).

Cada horário **marcado, remarcado ou cancelado** chega como aviso, com primeiro nome do cliente, serviço, dia e hora,
quem atende e de onde veio (IA ou equipe). Às 7h chega o **resumo do dia**. Entre 22h e 7h não sai aviso: o que for
marcado nesse horário entra no resumo das 7h. Há botão de **teste**, limitado a 3 por hora.

**Nasce desligado** e só liga quando um admin salva a configuração.

## LGPD
- O texto do aviso **nunca é guardado**, só o hash (`corpo_hash`).
- No aviso vai só o **primeiro nome** do cliente e o serviço; nenhum dado clínico.
- Cliente anonimizado não gera aviso (`titular_anonimizado`).
- O histórico de entregas é apagado pelo expurgo, com o mesmo prazo e o mesmo piso de 30 dias do aviso de caso.
- O destino não pode ser um número conectado da própria clínica (um responderia ao outro sem parar). Isso é
  conferido ao salvar e de novo no envio.

## Migrations
- **8020** (upstream 0753): `config_aviso_de_agendamento`, `entregas_de_aviso_de_agendamento`, RLS (configuração
  admin, histórico manager), `fn_definir_aviso_de_agendamento` (papel, suporte, MFA), expurgo.
- **8021** (upstream 9060): `grupo_destino` na configuração e `alvo` ('numero' ou 'grupo') na entrega.

## Adaptações ao fork
- **Fica de fora:** o aviso de mudanças feitas **direto no Google Agenda**. Depende de `aviso-do-compromisso.ts`,
  que o fork não tem. Tudo o que é marcado pelo sistema (tela, IA, MCP) avisa normalmente.
- **Grupos:** o fork não tem o subsistema de grupos do upstream (ligar grupo na inbox, IA respondendo em grupo).
  Veio só a leitura: `lib/grupos/servico.ts` lista os grupos pelo WAHA (`WahaClient.listarGrupos`), e a rota
  `GET /api/v1/channel-sessions/[id]/groups` (admin) alimenta a tela.
- **Aviso de caso** (base do envio): no fork ele é anterior ao do upstream.
  - `destinoEhDaPropriaOrganizacao` foi para o adaptador do aviso de agendamento.
  - O erro `destino_da_propria_organizacao` vive num tipo local.
  - Sem a checagem de canal desativado, porque o canal do fork não tem esse campo.
- `operante.ts` (organização parada não recebe o resumo das 7h) e `useTelefoneExemplo.ts` (exemplo brasileiro)
  entram em recorte mínimo.
- O payload de `appointment.*` ganhou `autor`, usado para dizer se quem marcou foi a IA ou a equipe.

## Testes
- Unit: 15 arquivos da agenda e do aviso + `retencao-poda-em-lotes`: **164/164**.
- Banco: `aviso-de-agendamento-escrita`, `rls-completude-varredura`, `hardening-definer-varredura`: **118/118**.
  O baseline instala e reaplica sem erro.
- Verify completo: ver o corpo do PR.

## Como validar na 3001
1. Entre como admin e abra **Agenda › Aviso de agendamento** (ou procure "Aviso de agendamento" na busca).
2. Escolha a conexão do WhatsApp e informe um número seu que **não** seja o da clínica. Opcional: escolha um grupo.
3. Ligue o aviso, salve e clique em **Mandar teste**: o teste chega no número e no grupo.
4. Marque um horário na agenda: o aviso "novo agendamento" chega em até cerca de 1 minuto (o dreno do `event_log`
   precisa estar rodando).
5. Remarque e cancele: chegam "agendamento remarcado" e "agendamento cancelado".
