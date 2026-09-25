# Plano — Módulo de Atendimento Clínico, Prontuário e Jornada do Paciente

## Contexto
A clínica já agenda, recebe o paciente (painel da Recepção) e marca "Finalizar atendimento", mas **nada clínico
é registrado**: não existe atendimento como entidade, prontuário, anamnese, evolução, plano, procedimento
realizado, termo ou contrato. Este plano cria o módulo clínico em fases pequenas, atrás de flag, reaproveitando
agenda, status da visita (9003), profissionais/especialidades (9001), ACL (9009–9013), auditoria e padrões de API.

Decisões do dono (respondidas):
- **Clínico separado da administração**: Administrador NÃO recebe permissões clínicas automaticamente.
- **Escopo**: toda a clínica (sem "só meus pacientes" por ora; campo de escopo reservado para unidade/próprios).
- **Templates**: motor de formulário por JSON versionado + modelos prontos + editor simples.
- **Aceite**: eletrônico simples (tela/tablet ou link) com versão, hash, data, IP/dispositivo.

Aprovado em 2026-09-25. Uma fase por PR; F0 na branch `feature/prontuario-f0`.

---

## 1. Estado atual encontrado (reutilizável)
| Área | O que existe | Onde |
|---|---|---|
| Paciente | `contacts` (CPF cifrado `cpf_encrypted/hash`, nascimento) + ficha cadastral `clinic_patient_profiles` (9002, sem dado clínico) | `app/api/v1/clinic/pacientes/[contactId]/ficha/route.ts`, `lib/clinic/pacientes/*`, `components/clinic/FichaDoPaciente.tsx` |
| Profissional | `clinic_professionals` (1:1 `user_id`, conselho), `clinic_specialties`, N especialidades por profissional, exigência por tipo | migration 9001, `lib/clinic/profissionais/habilitacao.ts` |
| Serviço | **`calendar_event_types` é o catálogo de serviços** (duração, categoria consulta/procedimento/retorno, preço 0358); `catalog_products` = produtos/insumos (estoque é só um número) | baseline :15042, :17170 |
| Agenda | `calendar_appointments` (status core pending/confirmed/cancelled/completed/no_show; profissional = `owner_user_id`; paciente = `contact_id`) | baseline :15149 |
| Check-in | **Já existe** (9003): `clinic_appointment_visits` (agendado→na_recepcao→pronto→em_atendimento→finalizado, com `arrived_at/ready_at/started_at/finished_at`, quem mudou) + `clinic_appointment_visit_events` append-only com correção+motivo; `fn_clinic_mudar_status_visita`; Realtime ligado | `lib/clinic/visitas/*`, `/app/recepcao`, `app/api/v1/clinic/agendamentos/[id]/visita` |
| Dia por profissional | colunas por profissional, jornada, bloqueios | `/app/agenda/profissionais` |
| Financeiro | comanda `sales` com `appointment_id`, itens por `event_type_id`, comissões | `lib/financeiro/comanda.ts` |
| ACL | catálogo `modulo.acao` (`lib/clinic/acesso/catalogo.ts`) espelhado em `clinic_permissions`; papéis por empresa; `requirePermission`; `fn_has_permission`; `fn_acesso_exigir` (suporte+MFA+permissão); policies RESTRITIVAS `acesso_*` (9013); teste de sincronia código×banco | `lib/clinic/acesso/*`, 9009–9013 |
| Auth/tenant | `getUser()`, org do cookie validada (`resolveActiveOrg`), `requireSupportWrite`, MFA (`mfaEmDivida`, `fn_session_mfa_proven`), `fn_user_org_ids()` | `lib/auth/*` |
| Auditoria | `audit()` → `api_audit_log` append-only; vocabulário `lib/audit/actions.ts`; `event_log` para efeitos colaterais | `lib/audit/*`, `lib/event-log/*` |
| Testes-cerca | `rls-completude-varredura` obriga toda tabela com `organization_id` a ter prova de isolamento; `hardening-definer-varredura`; sincronia do catálogo ACL; i18n espanhol obrigatório | `tests/invariants/*`, `tests/unit/i18n-*` |
| Arquivos | bucket privado + rota que confere acesso e redireciona para signed URL | `app/api/v1/messages/[id]/media/route.ts`, bucket `ai-policy` como molde de policy |
| UI | tabs, sheet, dialog, card, badge, skeleton, textarea, select, switch, toast; tabs do detalhe do paciente; `customFieldSchema` + `CustomFieldsEditor` (base do motor de formulário) | `components/ui/*`, `app/app/contacts/[id]/_client.tsx`, `lib/schemas/settings.ts:149` |
| Anonimização LGPD | trigger que apaga a ficha ao anonimizar; fila de redação de storage | 9002, `lib/lgpd/storage-redaction-queue.ts` |

## 2. Problemas e gaps
1. Não há entidade **Atendimento**; "Iniciar/Finalizar" só mudam o status da visita.
2. Nenhum registro clínico, template, plano, procedimento realizado, documento, anexo clínico ou foto.
3. **Administrador e suporte recebem todas as permissões** (`fn_member_permissions`, 9011) e `fn_is_platform_admin()` passa por cima das policies `acesso_*` → incompatível com acesso clínico separado.
4. **Leituras não são auditadas** (só escritas e negações).
5. Sem controle de concorrência (last-write-wins) e sem autosave.
6. Sem bucket para documentos do paciente.
7. Sem unidades/filiais (escopo "unidade" fica reservado).
8. Estoque é um inteiro em `catalog_products`, sem movimentos (regra do repo: estoque = soma de movimentos).
9. Faltam componentes: accordion, checkbox, radio-group, stepper, date picker.
10. `no-console` é só aviso; logger não redige PII; nenhuma rota clínica tem rate limit.
11. Tela do paciente decide `podeEditar` por papel, não por permissão (corrigir ao tocar).

## 3. Arquitetura proposta
Domínios (pastas `lib/clinic/<dominio>`, tabelas `clinic_*`), dependências só "para baixo":
```
agenda/visitas (existe) ──► atendimento ──► prontuario (leitura/timeline)
                                 │
          formularios (motor de templates) ◄── anamnese/avaliação usam
                                 │
      plano (plano + sessões) ◄──┤──► procedimentos ──► porta de estoque (interface; implementação futura)
                                 │
      documentos (modelos versionados + emitidos + aceites)      anexos/fotos (storage privado)
                     acesso (ACL)  ·  auditoria  ·  event_log  (transversais)
```
- **Atendimento orquestra; não conhece tabelas de estoque, financeiro ou documentos.** Comunicação por ids e por eventos em `event_log` (`clinic.procedimento_confirmado`, `clinic.atendimento_finalizado`).
- **Regras de negócio críticas no banco** (funções `fn_clinic_*` security definer com `fn_acesso_exigir`, triggers de imutabilidade), rotas finas (`requirePermission` + zod + `ok/fail` + `audit`).
- **Nada de `if especialidade == ...`**: comportamento por especialidade/tipo vem de configuração (modelos vinculados a especialidade/tipo; requisitos de finalização por tipo/especialidade).
- Feature nasce desligada: `settings.clinic.prontuario` (função `fn_clinic_definir_prontuario`, padrão das outras flags).

## 4. Fluxo do paciente
| Etapa | Estado visita (existe) | Estado core | O que nasce |
|---|---|---|---|
| Agendado | `agendado` | pending/confirmed | — |
| Chegou / check-in | `na_recepcao` | — | evento de visita (quem, quando) |
| Aguardando profissional | `pronto` | — | aparece na fila do profissional |
| Em atendimento | `em_atendimento` | — | **`clinic_atendimentos`** criado por "Iniciar" |
| Finalizado | `finalizado` | completed | atendimento `finalizado` (imutável) |
| Cancelado / Faltou | — | cancelled / no_show | sem atendimento |

Nomes: **manter o vocabulário existente em português** (9003); não criar um segundo enum. Check-in = transição `agendado→na_recepcao`, já registra usuário, data/hora, tenant, paciente, profissional (via agendamento) e agendamento. Unidade: coluna reservada quando existir filial. Correções já exigem motivo e ficam no log append-only.

## 5. Fluxo do profissional
1. **Meus atendimentos** (`/app/atendimentos`): hoje, agrupado por *Aguardando* (com tempo de espera desde `ready_at`/`arrived_at`) → *Em atendimento* → *Próximos* → *Finalizados*; serviço, horário, alertas permitidos. Realtime em `clinic_appointment_visits` (já publicado) + aviso "Paciente chegou".
2. **Iniciar atendimento** → `fn_clinic_iniciar_atendimento(appointment)`: muda visita para `em_atendimento` e cria (ou reabre o existente, idempotente) o atendimento vinculado ao agendamento, profissional = usuário, especialidade = a exigida pelo tipo ∩ especialidades do profissional (escolha se ambíguo).
3. **Área do atendimento** (`/app/atendimentos/[id]`): seções com autosave; pendências visíveis.
4. **Finalizar** → valida requisitos configurados → trava registros → visita `finalizado` + agendamento `completed` → evento para comanda/estoque.
5. Adendo quando precisar corrigir; reabrir só com permissão e motivo.

## 6. Modelo de domínio
- **Paciente** (`contacts`) 1—1 **Prontuário** (`clinic_prontuarios`: cabeçalho longitudinal — alertas, alergias informadas, observações fixas; criado na 1ª necessidade).
- Prontuário 1—N **Atendimento** (`clinic_atendimentos`, 0..1 agendamento).
- Atendimento 1—N **Formulário preenchido** (`tipo` anamnese | avaliacao), 0..1 **Conduta**, 0—N **Procedimento realizado** (→ N **Insumo**), 1—N **Evolução**.
- Paciente 1—N **Plano de tratamento** → N **Sessões** (planejada → agendada → realizada/cancelada; liga agendamento e procedimento realizado). PLANEJADO ≠ AGENDADO ≠ REALIZADO por construção (colunas distintas).
- **Protocolo** = conduta técnica: na conduta (texto/estrutura) e, no futuro, catálogo de protocolos por tipo de serviço.
- **Adendo** (genérico, append-only) aponta para evolução/formulário/procedimento finalizado.
- **Modelo de formulário** → **versões** imutáveis (schema JSON); preenchimento guarda a versão usada.
- **Modelo de documento** → versões imutáveis; **Documento emitido** (texto renderizado + hash) → **Aceites** append-only.
- **Anexo** (arquivo privado) e **Foto clínica** (anexo + metadados + finalidade clínica ≠ marketing).

## 7. Banco de dados (migrations 9015+, cada uma TRIPLA: arquivo + MANIFEST + apêndice idempotente no baseline antes da varredura anon)
Todas as tabelas: `organization_id not null references organizations on delete cascade`, RLS ligada, `created_at/created_by/updated_at/updated_by`, `versao int` nas editáveis, índices `(organization_id, contact_id, <data> desc)`, FK composta `(organization_id, id)` quando referencia outra tabela clínica (impede apontar para linha de outra org), prova de isolamento 2 orgs em `tests/invariants`.

| Migration | Conteúdo |
|---|---|
| 9015 `clinic_acesso_clinico` | coluna `clinica boolean` em `clinic_permissions`; `fn_member_permissions` passa a: (a) no modo legado, conceder chave clínica só a quem é `clinic_professionals` ativo; (b) no modo por papéis, só via papel explícito; (c) **nunca** a suporte; Administrador-modelo deixa de receber chaves clínicas automaticamente; novas chaves (seção 10); flag `prontuario` + `fn_clinic_definir_prontuario`; `fn_clinic_permissao_clinica(org, chave)` (sem bypass de platform admin) |
| 9016 `clinic_atendimentos` | `clinic_prontuarios`, `clinic_atendimentos` (status `em_andamento/finalizado/anulado`, `appointment_id` unique, `professional_user_id`, `specialty_id`, `event_type_id`, `started_at`, `finished_at`, `finalizado_por`, `versao`), `clinic_atendimento_eventos` append-only (iniciado/finalizado/reaberto/anulado + motivo + estado antes/depois); `fn_clinic_iniciar_atendimento`, `fn_clinic_finalizar_atendimento`, `fn_clinic_reabrir_atendimento` |
| 9017 `clinic_formularios` | `clinic_modelos_formulario` (tipo, nome, especialidades[], tipos de serviço[], ativo, padrão), `clinic_modelos_formulario_versoes` (schema jsonb, n, imutável), `clinic_formularios_preenchidos` (atendimento, tipo, versão do modelo, `respostas jsonb`, `rascunho/finalizado`, versao); seeds dos modelos padrão por org (Geral, Facial, Corporal, Capilar) |
| 9018 `clinic_evolucoes_e_adendos` | `clinic_condutas`, `clinic_evolucoes` (resposta, observações, intercorrências, orientações, próxima conduta, versao), `clinic_adendos` (alvo_tipo+alvo_id, texto, motivo, autor) append-only; **trigger de imutabilidade**: UPDATE/DELETE recusados em registro de atendimento finalizado (erro `prontuario_imutavel`) |
| 9019 `clinic_requisitos_finalizacao` | `clinic_requisitos_finalizacao` (event_type_id? , specialty_id?, secao, obrigatório) + padrão da org em settings |
| 9020 `clinic_planos` | `clinic_planos_tratamento` (objetivo, avaliação origem, profissional, especialidade, início, previsão, status DRAFT/ACTIVE/PAUSED/COMPLETED/CANCELLED → `rascunho/ativo/pausado/concluido/cancelado`), `clinic_plano_sessoes` (n, event_type_id, previsão, `appointment_id`, `procedimento_id`, status `planejada/agendada/realizada/cancelada`) |
| 9021 `clinic_procedimentos` | `clinic_procedimentos_realizados` (atendimento, event_type_id, executor, especialidade, região, protocolo, parâmetros jsonb, intercorrências, sessão do plano), `clinic_procedimento_insumos` (product_id?, descrição, quantidade, unidade, lote, validade, `movimento_estoque_id` nulo por ora); `event_log` `clinic.procedimento_confirmado` |
| 9022 `clinic_documentos` | `clinic_modelos_documento` (tipo contrato/consentimento/autorizacao/uso_imagem/ciencia) + versões imutáveis (conteúdo, hash), `clinic_documentos_emitidos` (contact, versão, conteúdo renderizado congelado, sha256, vínculos plano/atendimento/procedimento, status emitido/aceito/revogado/cancelado), `clinic_documento_aceites` append-only (nome digitado, canal presencial/link, IP, user-agent, aceito_em), `clinic_documento_links` (token **hash**, expira, uso único) |
| 9023 `clinic_anexos_e_fotos` | bucket privado `clinical-files` **no Storage que a instalação já tem** (ver "Custo de armazenamento" abaixo), policies por org no path `orgId/contactId/...`, sem leitura direta por `authenticated` — só via rota; `clinic_anexos` (storage_key, mime, tamanho, classificação, atendimento?, anulado_em), `clinic_fotos` (anexo, miniatura, plano?, sessão?, região, capturada_em, `finalidade clinica`; uso em divulgação só com termo `uso_imagem` aceito, na finalidade marcada e não revogado); cota por organização em settings; entra na fila de redação LGPD |

### Custo de armazenamento das imagens (solução simples, sem serviço novo)
- **Não contratar nada novo.** O instalador já sobe o Supabase com Storage: na VPS própria (`STORAGE_BACKEND=file`) os arquivos ficam no **disco da VPS** e o `hostgator-setup-kit/backup.sh` já os inclui no backup; no Supabase Cloud entram na cota do plano (1 GB grátis / 100 GB no Pro). Custo extra ≈ zero até o disco encher.
- **Compressão no navegador antes do envio**: foto redimensionada para no máx. 1600 px no maior lado, WebP qualidade ~0,8 (≈150–300 KB em vez de 3–8 MB do celular) + miniatura de 320 px (≈20 KB) para a timeline e a comparação. Metadados EXIF (GPS, aparelho) removidos por padrão — também é proteção de privacidade.
- **Limites**: 10 MB por arquivo antes da compressão, tipos permitidos (jpeg/png/webp/heic→webp, pdf), **cota por clínica** configurável (ex.: 5 GB) com aviso em 80 %.
- Conta de bolso: 250 KB × 6 fotos × 400 sessões/mês ≈ **0,6 GB/mês** → um disco de 40 GB comporta anos.
- **Nunca** guardar imagem no banco (bytea incha backup e deixa tudo lento).
- Porta `lib/clinic/anexos/armazenamento.ts` (`salvar/ler/urlTemporaria/apagar`) com implementação Supabase Storage; trocar para um S3 barato (Cloudflare R2 / Backblaze B2) no futuro é uma implementação nova, sem mexer nas telas.

### Termo de uso de imagem (e o que a LGPD já cobre)
*Orientação técnica, não parecer jurídico — o texto final deve ser revisado por advogado(a) da clínica.*
- A LGPD **não traz um termo pronto**. Ela diz quando a clínica pode tratar o dado: foto do paciente num contexto de saúde é **dado pessoal sensível**.
  - **Foto clínica no prontuário** (acompanhar o tratamento): permitida pela base "tutela da saúde, em procedimento realizado por profissionais de saúde" (art. 11, II, "f") — **não depende de termo de uso de imagem**; o paciente deve ser **informado** da finalidade (aviso na ficha/consentimento do procedimento).
  - **Divulgação** (Instagram, site, antes-e-depois, material de venda) ou **aula/congresso**: exige **consentimento específico e destacado** (art. 11, I), além do **direito de imagem** (Constituição art. 5º, X; Código Civil art. 20) e das regras de publicidade do conselho profissional de quem atende (ex.: CFM para médicos). Pode ser revogado a qualquer momento (art. 8º, §5º).
- O sistema entrega o modelo **"Autorização de uso de imagem" V1** (editável e versionado como os outros documentos, fase F6), com **opções marcadas uma a uma** — nenhuma vem marcada:
  1. uso em prontuário e acompanhamento (informativo — já coberto pela assistência);
  2. ensino/eventos científicos **sem identificação**;
  3. divulgação **sem identificar o rosto/tatuagens**;
  4. divulgação **com identificação**;
  5. canais autorizados (redes sociais, site, material impresso) e **prazo** (ex.: 12 meses);
  6. gratuidade, direito de **revogar** a qualquer momento pelo canal X, o que acontece após revogar (novas publicações param; retirada das publicações da clínica em até N dias), contato do encarregado (DPO) e tempo de guarda.
- **Regra no sistema**: cada foto guarda a finalidade; botão "usar em divulgação/exportar para marketing" só aparece se houver autorização aceita **para aquela opção**, dentro do prazo e não revogada; ao revogar, as fotos marcadas para divulgação voltam a "só clínico" e isso fica auditado. Uso clínico nunca depende desse termo.

Anonimização (padrão 9002): ao anonimizar paciente, registros clínicos NÃO são apagados (guarda legal CFM: 20 anos) — documentar exceção de retenção; arquivos seguem política de retenção. Decisão explícita no PR da 9023 com `health-compliance`.

## 8. Backend
- `lib/clinic/atendimento/` (casos de uso: iniciar, salvar seção, finalizar, reabrir; validação de requisitos), `lib/clinic/prontuario/` (timeline paginada por cursor `(started_at, id)`; resumo do cabeçalho), `lib/clinic/formularios/` (schema zod do modelo; validação das respostas contra a versão), `lib/clinic/planos/`, `lib/clinic/procedimentos/`, `lib/clinic/estoque/porta.ts` (interface `PortaDeEstoque { registrarConsumo(insumos) }` + implementação `SemEstoque`), `lib/clinic/documentos/` (render com placeholders, sha256, token), `lib/clinic/anexos/`.
- Rotas (padrão `app/api/v1/clinic/*`, `force-dynamic`, `requestId`, `requireSupportWrite` em escrita, `requirePermission`, zod `.strict()` (anti mass-assignment), `organization_id` sempre do contexto, `idsSaoDaOrg` para ids referenciados, `falhaDoBanco`, `audit`):
  - `GET /clinic/atendimentos/fila?dia=` · `POST /clinic/agendamentos/[id]/atendimento` (iniciar) · `GET /clinic/atendimentos/[id]`
  - `PUT /clinic/atendimentos/[id]/formularios/[tipo]` · `PUT .../conduta` · `POST/PUT .../evolucoes` · `POST/PUT .../procedimentos` — todas com `versao` esperada → 409 `conflict`
  - `POST /clinic/atendimentos/[id]/finalizar` · `POST .../reabrir` (motivo obrigatório) · `POST /clinic/adendos`
  - `GET /clinic/pacientes/[contactId]/prontuario?antes=&limite=&profissional=&plano=` (timeline paginada) · `GET .../prontuario/resumo`
  - `GET/POST /clinic/planos`, `PATCH /clinic/planos/[id]`, sessões
  - `GET/POST /clinic/modelos/formularios` (+ nova versão), `/clinic/modelos/documentos`
  - `POST /clinic/documentos` (emitir), `POST /clinic/documentos/[id]/aceite` (presencial), `GET/POST /api/v1/publico/documentos/[token]` (link; rate limit; token de uso único)
  - `POST /clinic/anexos` (multipart; mime/tamanho), `GET /clinic/anexos/[id]` (confere permissão → audita → 302 signed URL 60 s)
- Rate limit (`checkRateLimit`) em leitura de prontuário, download, exportação e link público.

## 9. Frontend
- **`/app/atendimentos`** (Meus atendimentos) — colunas/lista por estado; tablet-first; "Iniciar atendimento".
- **`/app/atendimentos/[id]`** — layout em 3 zonas: cabeçalho fixo (paciente, idade, alertas, alergias informadas, plano ativo, último/próximo atendimento) · navegação lateral de seções (Resumo, Anamnese, Avaliação, Conduta, Plano, Procedimentos, Documentos, Evolução, Anexos, Histórico) com marcador ✓/pendente/obrigatório · painel da seção. Em tablet a navegação vira abas roláveis no topo. Botão "Finalizar" mostra checklist do que falta.
- **Autosave**: hook `useAutosave` (debounce 1,5 s, uma requisição em voo por seção, envia `versao`, estados "Salvando… / Salvo às 15:42 / Erro ao salvar — tentar de novo", 409 abre diálogo "outra pessoa alterou" com recarregar/ver diferenças; nunca sobrescreve).
- **Renderizador de formulário** (`components/clinic/formularios/`) a partir do schema: texto, textarea, número, data, boolean, seleção única/múltipla, escala, arquivo/foto (via anexos), assinatura (fase de documentos); tipos extensíveis por registro.
- **Prontuário** — nova aba "Prontuário" no detalhe do paciente (só com permissão), timeline paginada com filtros (período, profissional, plano) e carregamento progressivo; o item de menu "Prontuário (Em breve)" do módulo Pacientes passa a existir.
- **Configurações** — "Modelos clínicos" (duplicar/editar campos, publicar nova versão) e "Documentos e termos" (versões).
- **Aceite** — tela de apresentação do documento (tablet) e página pública do link.
- Componentes novos em `components/ui`: accordion, checkbox, radio-group, date-picker leve. i18n espanhol em tudo; acessibilidade: labels, foco, teclado, erros descritivos, estados de carregamento/vazio/erro.

## 10. ACL (padrão existente `modulo.acao`, português)
Chaves novas (marcadas `clinica: true` = não vêm do papel legado nem do Administrador automático):
| Chave | Nível base | Clínica | Para |
|---|---|---|---|
| `atendimento.ver_fila` | agent | não | ver fila/estado (recepção vê só status, sem conteúdo) |
| `atendimento.iniciar` / `atendimento.registrar` / `atendimento.finalizar` | agent | **sim** | profissional |
| `atendimento.reabrir` | manager | **sim** | coordenação |
| `prontuario.ver` / `prontuario.adendo` | agent | **sim** | ler histórico, adendos |
| `prontuario.exportar` | manager | **sim** | exportação (rate limit + auditoria) |
| `plano.ver` / `plano.gerenciar` | agent | **sim** | planos e sessões |
| `fotos.ver` / `fotos.enviar` / `anexos.baixar` | agent | **sim** | imagens e arquivos |
| `documentos.ver` / `documentos.emitir` / `documentos.colher_aceite` | agent | não* | recepção pode emitir e colher aceite (conteúdo é o termo, não o prontuário) |
| `documentos.revogar` | manager | não | |
| `modelos_clinicos.gerenciar` / `documentos.modelos` | admin | não | administração configura modelos sem ver pacientes |
| `auditoria.ver` (existe) | — | — | auditor |

Regras: **escopo = toda a clínica** (decisão), mas `fn_clinic_pode(org, chave, contact?)` recebe o paciente desde já — ponto único para plugar escopo "próprios"/"unidade" depois sem mudar rotas. Recepcionista típico: pacientes, agenda, recepcao.*, `atendimento.ver_fila`, documentos → não vê anamnese/avaliação/evolução/fotos. Profissional: chaves clínicas + `atendimento.*`. Administrador: configura papéis, profissionais, modelos; **só vê conteúdo clínico se atribuir a si um papel clínico** (auditado `acesso.papel_clinico_atribuido`). Suporte/platform admin: sem acesso clínico (break-glass futuro, auditado).

## 11. Multi-tenant
- `organization_id` em toda tabela; FKs compostas entre tabelas clínicas; RLS de leitura `organization_id in fn_user_org_ids()` **E** policy restritiva `fn_clinic_permissao_clinica(org, chave)` (sem `or fn_is_platform_admin()`).
- Escrita só por funções definer que chamam `fn_acesso_exigir` e resolvem org do registro (nunca do payload); `insert/update/delete` revogados de `authenticated` nas tabelas append-only.
- Rotas: org de `requirePermission` (cookie validado); ids do path conferidos com `.eq("organization_id", org)`; payload `.strict()` sem `organization_id/contact_id` editáveis.
- Cercas automáticas: `rls-completude-varredura` (toda tabela listada), `hardening-definer-varredura`, `definer-membership-varredura`, sincronia do catálogo.

## 12. Segurança e LGPD
- Base legal: tratamento de saúde para **tutela da saúde/assistência** (art. 11, II, f) e cumprimento de obrigação legal (guarda de prontuário) — não "consentimento genérico". Consentimento específico só onde é a base certa (uso de imagem em divulgação, contato de marketing). Finalidade registrada por tipo de documento.
- Minimização: modelos padrão só com campos pertinentes; recepção não vê conteúdo clínico; cabeçalho mostra só alertas autorizados.
- Controles: autorização server-side e no banco; anti-IDOR (ids conferidos por org + permissão); zod strict; storage privado + signed URL 60 s; rate limit; MFA exigido para finalizar/reabrir/exportar (padrão `fn_session_mfa_proven`); logs sem conteúdo (teste genérico que proíbe texto livre nos metadados de ações `clinic.prontuario_*`/`clinic.atendimento_*`); lint: `no-console` vira **erro** em `lib/clinic/**` e `app/**/clinic/**`; backups/retenção documentados; criptografia em trânsito (TLS) e em repouso (disco do Postgres/Storage) — criptografia por coluna fica fora da v1 (impede busca) e registrada como decisão.

## 13. Auditoria (em `api_audit_log`, metadados sem conteúdo clínico)
`clinic.atendimento_iniciado|finalizado|reaberto|anulado`, `clinic.prontuario_visto` (leitura do prontuário/atendimento — 1 por sessão/paciente/10 min para não inundar), `clinic.registro_salvo` (seção, versão), `clinic.adendo_criado`, `clinic.plano_*`, `clinic.procedimento_registrado`, `clinic.anexo_visto|baixado|enviado|anulado`, `clinic.foto_*`, `clinic.documento_emitido|aceito|revogado|cancelado`, `clinic.prontuario_exportado`, `authz.denied` (existe). Campos: ator, org, paciente (resourceId), recurso, ação, requestId, IP/user-agent onde já é padrão, resultado. Leitura do log: `auditoria.ver`.

## 14. Estratégia de prontuário
- Rascunho editável (autosave com `versao`) enquanto o atendimento está `em_andamento`.
- **Finalizar congela**: trigger recusa UPDATE/DELETE em conteúdo de atendimento finalizado.
- Correção = **adendo** (original + texto + motivo + autor + data), exibido junto do original na timeline.
- **Reabrir** (permissão + MFA + motivo): permite acrescentar registros novos e adendos; o que já foi finalizado continua imutável; evento com estado anterior/posterior.
- Sem hard delete: `anulado` com motivo (auditado) para atendimento aberto por engano; anexos `anulado_em`.

## 15. Documentos e consentimentos
Tipos separados: contrato, termo de consentimento, autorização, uso de imagem, ciência de orientações. Modelo → versões imutáveis (V1, V2...). Emissão congela o texto renderizado (paciente, clínica, procedimento/plano) + sha256; o aceite aponta para o emitido (portanto para a versão). Mudar o modelo cria versão nova; nada retroage. Revogação (ex.: uso de imagem) é novo registro, não apaga o aceite. Documento vive fora do prontuário (tabela e tela próprias), ligado a paciente/plano/atendimento/procedimento; a timeline mostra só "Termo X aceito em ...".

## 16. Integrações futuras (portas deixadas prontas)
- **Estoque**: `PortaDeEstoque` + evento `clinic.procedimento_confirmado` com insumos (produto, quantidade, lote, validade); módulo de estoque futuro consome, grava `movimentos` e devolve `movimento_estoque_id` (rastreável).
- **Assinatura certificada** (ICP-Brasil/gov.br): tabela de aceites já tem `canal`/`evidencias`; novo provedor = novo canal.
- **Financeiro/comanda**: evento `clinic.atendimento_finalizado` sugere itens da comanda (procedimentos realizados); pacotes consomem sessões do plano.
- Prescrição, portal do paciente, exportação, WhatsApp (envio do link de aceite pelo canal existente), teleatendimento, convênios, comissões por procedimento realizado: entram sem mudar o núcleo.

## 17. Testes
- **Unit**: transições de atendimento, validação de respostas vs. versão do modelo, requisitos de finalização por tipo/especialidade, render e hash de documento, `useAutosave` (debounce, 409), projeção da timeline.
- **Banco (`pnpm test:db`)**: isolamento 2 orgs por tabela; recepcionista não lê anamnese/evolução; Administrador sem papel clínico não lê; suporte não lê; profissional lê; trigger de imutabilidade; adendo append-only; reabertura exige permissão; FK composta impede cruzar org; sincronia do catálogo.
- **API/unit de rota**: tentativa de trocar `contact_id/organization_id` no payload → 422; id de outra org → 404; 409 em versão velha; auditoria sem texto livre.
- **E2E (Playwright)**: recepção faz check-in → profissional vê na fila → inicia → preenche anamnese (autosave) → evolução → finaliza → timeline mostra; adendo; aceite de termo em tablet 1024 px e 390 px.

## 18. Plano de implementação (1 PR por fase, cada uma atrás da flag `prontuario`, gates lint+tipos+unit+db+e2e)
| Fase | Entrega | Migrations |
|---|---|---|
| F0 Fundação | chaves ACL clínicas + separação admin/suporte + flag + auditoria de leitura + regra lint | 9015 |
| F1 Fila e início | `clinic_atendimentos` + eventos; Meus atendimentos; iniciar (reusa visita) | 9016 |
| F2 Atendimento mínimo | workspace, anamnese/avaliação (motor + modelos padrão), evolução, finalizar, adendo, imutabilidade, autosave+versão, aba Prontuário (timeline) | 9017, 9018 |
| F3 Requisitos e modelos | requisitos de finalização configuráveis; editor simples de modelos | 9019 |
| F4 Conduta e plano | conduta → plano → sessões (planejada/agendada/realizada), agendar sessão pela agenda | 9020 |
| F5 Procedimentos | registro de execução + insumos + porta de estoque + evento | 9021 |
| F6 Documentos | modelos versionados, emissão, aceite presencial e por link | 9022 |
| F7 Anexos e fotos | Storage já existente (disco da VPS), compressão WebP + miniatura no navegador, cota por clínica, URL temporária, comparação antes/depois, finalidade clínica × divulgação amarrada ao termo de uso de imagem (modelo V1 entregue na F6) | 9023 |
| F8 Hardening | exportação do prontuário, rate limits, revisão `security-lgpd` + `health-compliance`, performance (EXPLAIN nos índices da timeline), testes de segurança adicionais | — |

## 19. Arquivos existentes afetados (principais)
`lib/clinic/acesso/catalogo.ts` (+ testes), `lib/clinic/flags.ts`, `app/api/v1/clinic/config/route.ts`, `lib/clinic/visitas/mudar-status.ts` (iniciar/finalizar delegam ao atendimento com a flag), `app/app/recepcao/*` (recepção continua igual; botão "Iniciar" some para quem não é profissional), `app/app/contacts/[id]/_client.tsx` (aba Prontuário; `podeEditar` por permissão), `lib/navigation/catalogo.ts` + `lib/clinic/navegacao/modulos.ts` (portas Atendimentos, Prontuário, Modelos clínicos, Documentos), `lib/audit/actions.ts`, `lib/api/errors.ts` (`prontuario_imutavel`, `requisitos_pendentes`), `lib/i18n/dicionario.ts`, `eslint.config.mjs`, `supabase/baseline.sql`, `supabase/migrations/MANIFEST.md`, `tests/invariants/{rls-completude-varredura,rls-isolation,hardening-definer-varredura,clinic-papeis-de-acesso}.test.ts`, `.github/workflows/e2e.yml`, `UPSTREAM.md`.

## 20. Novos arquivos (previstos)
`supabase/migrations/*_9015..9023_clinic_*.sql`; `lib/clinic/{atendimento,prontuario,formularios,planos,procedimentos,estoque,documentos,anexos}/*`; `app/api/v1/clinic/{atendimentos,adendos,planos,modelos,documentos,anexos}/**`, `app/api/v1/publico/documentos/[token]/route.ts`; `app/app/atendimentos/{page,_client}.tsx`, `app/app/atendimentos/[id]/*`, `app/app/settings/tenant/{modelos-clinicos,documentos}/*`; `components/clinic/{atendimento,formularios,prontuario,documentos}/*`; `hooks/clinic/useAutosave.ts`; `components/ui/{accordion,checkbox,radio-group,date-picker}.tsx`; `tests/invariants/clinic-{acesso-clinico,atendimentos,formularios,evolucoes,planos,procedimentos,documentos,anexos}.test.ts`; `tests/e2e/clinic-{atendimento,prontuario,documentos}.spec.ts`; `docs/tarefas/prontuario/*`.

## 21. Riscos
1. Mudar `fn_member_permissions` afeta todo o ACL → mudança mínima, só para chaves `clinica`, com teste de equivalência para as chaves atuais.
2. Profissional sem cadastro em `clinic_professionals` perde acesso clínico no modo legado → tela de Profissionais avisa; flag desligada por padrão.
3. Admin "se trancar fora" do clínico é esperado; precisa UX clara em Papéis de acesso.
4. Retenção legal × anonimização LGPD conflitam → decisão documentada com `health-compliance` na F7.
5. JSON de respostas cresce/varia → validação por versão de modelo; índices só em colunas estruturais.
6. Autosave pode gerar muitas escritas → debounce + uma em voo + auditoria agregada por seção.
7. Link público de aceite é superfície de ataque → token forte hasheado, uso único, expira, rate limit, sem dados clínicos na página.
8. Trigger de imutabilidade pode bloquear migrações futuras → exceção explícita só para `service_role` em migração, registrada.
9. Tamanho do baseline e cadeia de migrations: seguir a tripla e a ordem antes da varredura anon.

## 22. Critérios de aceite (verificáveis)
- Recepcionista faz check-in e **não** consegue ler anamnese/avaliação/evolução/fotos (teste db + e2e).
- Profissional vê o paciente em "Aguardando" em até 2 s após o check-in (Realtime) e inicia o atendimento com 1 clique; o atendimento fica ligado ao agendamento.
- Anamnese salva sozinha (indicador "Salvo às hh:mm"); duas abas editando → a segunda recebe 409 e nada é sobrescrito.
- Finalizar com requisito pendente → bloqueado com lista do que falta; finalizado → UPDATE direto no banco recusado; correção só por adendo visível na timeline.
- Reabrir sem `atendimento.reabrir` → 403; com → evento com motivo, antes/depois.
- Plano mostra sessões realizadas/agendadas/planejadas corretamente.
- Procedimento com insumos gera evento `clinic.procedimento_confirmado` com lote/validade.
- Termo aceito continua ligado à versão V1 após publicar V2; hash confere.
- Anexo só abre por rota autenticada (URL assinada expira); acesso auditado.
- Org A não lê/escreve nada da org B (todas as tabelas); payload com `organization_id`/`contact_id` alheio → recusado.
- Administrador sem papel clínico e suporte não leem prontuário.
- Nenhuma entrada de auditoria contém texto clínico (teste).
- Lint/tipos/unit/db/e2e verdes por fase; telas testadas em 1280, 1024 (tablet) e 390 px; espanhol completo.

## Respostas às 20 perguntas
1. Check-in na Recepção (`agendado→na_recepcao`), "Pronto" = fila. 2. Fila "Meus atendimentos" com Realtime e aviso. 3. "Iniciar" cria o atendimento ligado ao agendamento. 4. Aba Prontuário no paciente + área do atendimento. 5–6. Formulários por modelo versionado (tipo anamnese/avaliação), escolhidos por especialidade/serviço. 7. Seção Conduta no atendimento. 8. "Gerar plano" a partir da conduta. 9. Sessões do plano, agendadas pela agenda existente. 10. Procedimento realizado (tabela própria). 11. Insumos com lote/validade + porta/evento de estoque. 12. Modelos de documento versionados → emissão → aceite. 13. Evolução por atendimento. 14. Imutabilidade por trigger + adendo + reabertura controlada. 15. `api_audit_log` incluindo leituras. 16. Matriz da seção 10 (clínico separado da administração). 17. `organization_id` + RLS + FKs compostas + rotas sem confiar no payload + cercas de teste. 18. Bases legais corretas, minimização, logs sem conteúdo, retenção. 19. Fila única, área de atendimento com seções e autosave, tablet-first. 20. Domínios desacoplados, configuração por especialidade/serviço, portas e eventos para estoque, assinatura e financeiro.

## Verificação do plano
- O menu da clínica já está no PR https://github.com/LuanSilvaR/-deskcomm-clinica/pull/23 (branch `claude/clinic-admin-panel-reorganization-6u6dgv`). **O módulo clínico não entra nesse PR**: vai em branch própria a partir de `develop` (`feature/prontuario-f0`, depois uma por fase), para o PR #23 ser revisado e mesclado sozinho. Única dependência: F1+ reaproveita a porta "Prontuário (Em breve)" do menu — se o #23 ainda não estiver na develop, a fase acrescenta a porta no catálogo antigo e reconcilia no merge.
- A primeira ação após aprovação é salvar este plano em `docs/tarefas/prontuario/plano.md` junto com a F0.
- Por fase: `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:db`, e2e da fase (roda no CI; neste ambiente o Supabase completo não sobe por limite de download de imagens), revisão `security-lgpd` + `health-compliance` antes de cada PR.
