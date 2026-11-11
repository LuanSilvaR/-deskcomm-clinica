# #85 — Pacientes: a ficha guarda vários telefones (upstream #3671)

## O que entrou
- **Banco — migration 8018** (9043 do upstream renumerada):
  - tabela `contact_phones` (tenant-aware, RLS: leitura por organização, escrita a partir de `agent`);
  - `contacts.phone_type` e `contacts.phone_whatsapp`, preenchidos nas fichas existentes sem mexer em `updated_at`;
  - regra "um número, uma ficha viva" por gatilho: o extra que repete o principal ou o extra de outra ficha volta 23505.
- **As três funções centrais** foram remontadas por merge de 3 vias sobre a ÚLTIMA definição do fork (não a do upstream):
  - `fn_upsert_wa_contact`: a mensagem que chega procura também nos extras (`lid` → principal → extra);
  - `fn_mesclar_contatos`: ao juntar fichas, o principal da absorvida vira extra da que fica, e os `custom_fields` são herdados;
  - `fn_lgpd_cascade_redact_contact` (sobre a 8001): anonimizar apaga os extras e inclui as variantes deles na supressão.
- **O que ficou de fora do upstream** e por quê:
  - fica de fora: `contact.phone_added` (#3315), `social_identity`, a rota `messages/[id]`, a agenda do celular, a importação B2B e o watchdog de org parada;
  - motivo: o fork não tem nenhuma dessas partes;
  - `fn_redigir_conversas_ao_anonimizar` (8002) não muda, porque o fork não tem o braço das mensagens de grupo.
- **Código vindo do upstream:**
  - a busca por telefone (`contato-por-telefone`) e a listagem de contatos enxergam o extra;
  - a resposta, o "digitando…" e o reenvio do watchdog saem pelo número que o paciente usou ("última recebida");
  - o export LGPD e a ferramenta MCP da ficha trazem os extras;
  - a prospecção não cria contato sobre ficha que tem o número como extra;
  - a ficha mostra o bloco "Telefones" quando há extra.

## Acréscimos do fork
- **Opção da clínica** `settings.clinic.varios_telefones` — migration **8019**, nasce desligada, com interruptor em Configurações › Profissionais.
  - Ligada: a ficha ganha "Adicionar telefone" (número, tipo, WhatsApp e rótulo) e "Remover" em cada extra.
  - Rota: `POST/DELETE /api/v1/clinic/pacientes/{id}/telefones`.
  - Exige `agent`, o escopo de pacientes e a opção ligada.
  - Número de outra ficha ou o próprio principal → 409.
  - Desligada: só MOSTRA os extras que já existem (ex.: vindos da junção de fichas).
- **Busca da agenda e da recepção** ("Quem será atendido", Agenda do dia, info da agenda): acha o paciente pelo número extra (`idsPorTelefoneExtra` em `lib/clinic/pacientes/busca-no-banco.ts`).

## Prova
- Banco local: 8018 e 8019 aplicadas e reaplicadas sem erro (idempotentes).
- `ficha-com-varios-telefones` (21 casos): verde.
- `clinic-varios-telefones-opcao`: verde.
- 11 suítes de banco do fork que tocam as mesmas funções (juntar fichas, LGPD/cascata/8001/8002, `telefone-do-lid`): 65/65 verdes.
- Varredura de definers: só acusa funções de outras branches presentes no banco local (#87, #90, financeiro) — nenhuma da #85.
- Unit: `contato-por-telefone-extras`, `ficha-mostra-os-telefones-extras`, `lgpd-export-telefones-extras`, `mcp-ficha-com-telefones-extras`, `ultima-recebida`, `clinic-telefones-extras-rota` (8), `busca-no-banco` (5); typecheck 0 erros.
- Suíte unit inteira: 14098 verdes, 40 falhas em 19 arquivos — nenhuma da #85:
  - 16 arquivos falham igual num checkout limpo de `origin/develop` (release, PDF LGPD, tema, varreduras, timeouts);
  - os 3 de cron falhavam por uma pasta vazia `app/api/v1/cron/task-reminder/` que sobrou de outra branch; apagada a pasta, 49/49 verdes.
- Tela (3001, recepção da clínica demo, paciente fictícia):
  - opção desligada: a ficha não oferece "Adicionar telefone" — `evidence/85-varios-telefones/tel-1-desligada.png`;
  - ligada: o extra entra com tipo e rótulo, ao lado do principal — `evidence/85-varios-telefones/tel-2-extra-adicionado.png`;
  - o próprio principal como extra é recusado com o recado — `evidence/85-varios-telefones/tel-3-principal-recusado.png`;
  - "Quem será atendido" acha a paciente pelo número extra — `evidence/85-varios-telefones/tel-4-agenda-acha-pelo-extra.png`;
  - "Remover" tira o extra (0 linhas em `contact_phones`) — `evidence/85-varios-telefones/tel-5-removido.png`.

## Pendências
- O #3700 (pessoa relacionada acha o negócio no funil) fica para uma entrega separada.
- "Tornar principal" (trocar o principal por um extra) não entrou: o principal continua sendo editado pelo "Editar contato".
