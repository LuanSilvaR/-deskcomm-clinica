# #87 — Atestado de Anonimização (clínica no Brasil) — design

Issue: LuanSilvaR/-deskcomm-clinica#87 · Épico #78 (lote 2) · Referência upstream: melgarafael/DeskcommCRM#3321
(`417326e6`). **Não é cherry-pick**: o upstream só emite fora do Brasil e não diz o que foi retido. Aqui é uma
história própria do fork, reaproveitando a ideia (linha canônica + HMAC + código curto).

O dono pediu para começar sem perguntas ("pode começar"). Tudo marcado **[decisão minha]** pode ser mudado.

## Por quê
Quando um paciente pede para apagar os dados dele, a clínica anonimiza pelo botão **Anonimizar** da ficha do
contato. Hoje isso acontece sem deixar um papel. A clínica precisa de uma prova formal para mostrar ao paciente e
a um auditor (dever de prestar contas, LGPD art. 37). Essa prova diz:
- quando foi feito, por quem e de qual IP;
- o que foi apagado;
- **o que ficou guardado e por quê**, porque o prontuário tem guarda legal de 20 anos (CFM 1.821/2007);
- e traz um código para conferir que o papel é verdadeiro.

## Onde entra (o caminho real da clínica)
Os pedidos em `lgpd_requests` só são criados pelos webhooks da Nuvemshop, que a clínica não usa. Na clínica, a
exclusão é o botão **Anonimizar** (`POST /api/v1/lgpd/anonymize`, `components/contacts/AnonymizeDialog.tsx`).
**[decisão minha]** O atestado nasce desse ato. O worker de `lgpd_requests` fica como está (fora do escopo).

## Objetivos
1. **Chave da clínica, desligada por padrão:** `organizations.settings.clinic.atestado_anonimizacao`. Ela fica
   num cartão em **Configurações › Profissionais**, onde estão as outras chaves da clínica, pela rota
   `/api/v1/clinic/config`. Com ela desligada, nada muda.
2. **Emissão:** com a chave ligada, a anonimização de um contato emite **um** atestado em PDF no papel timbrado
   (`lib/documentos`). O atestado traz:
   - o protocolo (id do atestado);
   - data e hora local da clínica, com o fuso;
   - autor (nome, e-mail, papel) e IP de quem clicou;
   - a lista do que foi anonimizado;
   - a lista do que foi **retido**, com a contagem e o motivo legal;
   - o código de autenticidade.
3. **Download:** a ficha do contato anonimizado mostra **"Baixar atestado"**. A tela **LGPD** ganha a lista
   "Atestados emitidos", cada um com o botão de download.
4. **Conferir:** a tela **LGPD** ganha a caixa **"Conferir código"**. Quem digita o código curto vê se o atestado
   existe nesta clínica e os dados dele (data, autor, protocolo). **[decisão minha]** A conferência é só dentro do
   sistema, para quem é admin. Não há página pública.
5. **Gerar depois:** se o contato foi anonimizado sem atestado (chave desligada na hora, ou falha na emissão), um
   admin com a chave ligada pode clicar em **"Gerar atestado"** na ficha. O documento diz então que foi emitido
   depois do ato e traz as duas datas. Cada contato tem no máximo um atestado.

## O que o atestado lista
**Anonimizado** (o que os gatilhos de hoje fazem na virada de `is_anonymized`):
- dados de contato (nome, telefones, e-mail, documento);
- a ficha do paciente (`clinic_patient_profiles`);
- as conversas, as mensagens e o resumo da IA;
- a agenda (títulos e notas);
- os orçamentos (observações e motivos);
- as tarefas, as propostas e as campanhas.

O redator confere essa lista nos gatilhos e escreve o texto do fato, não do código.

**Retido** (contagem por categoria, só as categorias que tiverem pelo menos 1 registro):

| Categoria | Tabelas | Motivo impresso |
|---|---|---|
| Prontuário e atendimentos | `clinic_prontuarios`, `clinic_atendimentos` (evoluções, condutas, adendos, procedimentos e formulários vão dentro do atendimento) | guarda mínima de 20 anos do prontuário (CFM 1.821/2007; Lei 13.787/2018); exceção da LGPD art. 16, I |
| Fotos e anexos clínicos | `clinic_anexos` | idem: fazem parte do prontuário |
| Documentos emitidos e termos | `clinic_documentos_emitidos` | prova do consentimento e do contrato (LGPD art. 16, I e art. 7º, VI) |
| Planos de tratamento | `clinic_planos_tratamento` | parte do prontuário |

Os registros retidos continuam ligados ao contato anonimizado, sem nome nem contato. Isso é o que já acontece
hoje. O atestado só **declara** isso, não muda nada no banco. **[decisão minha]** Os textos jurídicos passam
por uma revisão `health-compliance` (papel da fábrica) antes do PR.

## Minimização (igual ao upstream)
O PDF **não** traz o nome, o documento nem o contato do paciente, nem mascarados. O paciente é identificado
pelo protocolo. A clínica pode anotar o protocolo no atendimento do pedido. O controlador (razão social e CNPJ)
sai inteiro.

## Código de autenticidade
- Calculado como `HMAC-SHA256(linha canônica, LGPD_SIGNING_KEY)`. A linha canônica tem:
  - a versão do formato;
  - o protocolo e a organização;
  - a razão social e o CNPJ;
  - o executor, o papel e o IP;
  - o instante do ato e o instante da emissão;
  - as contagens retidas.
- **Sem a chave:** cai para SHA-256 e o papel diz "código de integridade" em vez de "autenticidade". Mesma
  regra do upstream.
- **No papel e na tela:** o código curto, 16 hex em 4 blocos (`ABCD-EF01-...`). O código completo fica no banco.
- **Conferir:** buscar pelo código curto na organização ativa.

## Dados
- **Migration 8024** (TRIPLA). O número segue as 8018–8023, já usadas pelos PRs abertos #146–#149.
- **Tabela nova `clinic_atestados_anonimizacao`:**
  - colunas:
    - `id`, `organization_id` (padrão da regra 3);
    - `contact_id` (referencia `contacts`);
    - `anonimizado_em`, `emitido_em`;
    - o snapshot do `executor` (jsonb: user_id, nome, email, papel);
    - `ip`, `retidos` (jsonb), `codigo`, `codigo_curto`, `algoritmo`;
    - `pdf_path`, `pdf_sha256`, `pades` (bool), `versao`;
  - `unique (organization_id, contact_id)` e índice em `(organization_id, codigo_curto)`;
  - RLS: `tenant_isolation_..._all` para leitura de admin. **Imutável**: sem update nem delete para
    `authenticated`, e a escrita é só pelo service role na rota.
- **PDF** no bucket `lgpd-exports`, em `{org}/atestados/{id}/atestado.pdf`. É o mesmo bucket e o mesmo prefixo
  de organização do relatório LGPD. Download por URL assinada de 15 min.
- **A chave** é gravada por uma função `fn_clinic_definir_atestado_anonimizacao(p_org, p_ligado)`, no mesmo
  padrão das outras chaves `clinic`, com auditoria.

## Falhas
- **A anonimização nunca falha por causa do atestado.** Se o PDF ou o upload falhar, o contato fica
  anonimizado, a resposta traz `atestado: { erro }`, a tela avisa e oferece "Gerar atestado".
- Um clique repetido ou uma retomada (`resumed` / `already_anonymized`) **não** gera um segundo atestado: a
  `unique` garante isso.

## Fora do escopo
- Atestado para pedidos `lgpd_requests` (Nuvemshop / worker).
- Envio automático ao paciente: a clínica baixa e repassa pelo canal do pedido.
- Página pública de conferência.
- Aviso do art. 12 do RGPD.

## Critérios de pronto
- Os critérios 1 a 5 da issue.
- Unit tests para:
  - a linha canônica, o código e o código curto;
  - a degradação sem chave;
  - as contagens retidas;
  - a rota com a chave ligada e desligada;
  - "não emite duas vezes";
  - "falha no PDF não derruba a anonimização".
- Teste de isolamento entre 2 orgs (`tests/invariants`).
- Playwright na 3001: ligar a chave, anonimizar um contato de teste, baixar o atestado, conferir o código e
  desligar a chave.
- Registro em `UPSTREAM.md` (adaptação da ideia do #3321).
