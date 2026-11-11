# #83 — Lembrete pela Meta com reserva pelo QR code — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** com a chave da clínica ligada, o lembrete de consulta tenta primeiro os números da Meta (texto na janela de 24 h, modelo aprovado fora dela) e, quando a Meta não puder ou avisar depois que falhou, sai pelos números do QR code, com no máximo 3 tentativas e o motivo visível para a equipe.

**Architecture:** regra pura em `lib/clinic/lembrete-com-reserva/` (ordem dos caminhos, decisão por caminho, classificação do resultado), uma orquestração com I/O chamada pelo cron `agenda-reminder` só quando a chave está ligada (desligada = código de hoje intacto), e uma varredura no mesmo cron que reenvia pelo QR o lembrete que a Meta aceitou e depois recusou. O helper de modelo vem do upstream #3891 (`91ce60dec`). O aviso reaproveita o selo da 9006.

**Tech Stack:** Next.js 16 (route handlers), TypeScript estrito, Supabase (Postgres + RLS), Vitest, Playwright, pnpm 9.

**Spec:** `docs/tarefas/83-lembrete-meta-com-reserva/design.md` (aprovado pelo dono em 2026-11-11). Leia antes de cada tarefa.

## Global Constraints
- Pasta: `D:\Projeto_claude_estudos\wt-lembrete-83`, branch `feature/upstream-lembrete-por-modelo-aprovado`, a partir de `origin/develop`.
- Chave: `organizations.settings.clinic.lembrete_com_reserva` (boolean), **nasce desligada**; desligada = comportamento de hoje, byte a byte.
- Ordem dos caminhos: `meta_cloud` primeiro, depois `waha`; só sessões `status = 'WORKING'`, `archived_at is null`, `metadata->>'disabled'` diferente de `true`; dentro do mesmo provider, `created_at` crescente. Outros providers ficam fora.
- `MAX_TENTATIVAS_DO_LEMBRETE = 3` por degrau.
- Modelo: variáveis do corpo posicionais `{{1}}` primeiro nome, `{{2}}` dia e hora, `{{3}}` título, `{{4}}` endereço.
- Opt-out = `contacts.is_blocked`; não tenta reserva e não abre tarefa "ligar". Recusa de marketing não barra lembrete.
- Erro ambíguo nunca reenvia (nem na reserva nem na rodada seguinte).
- Nenhum teste chama Meta, WAHA ou LLM de verdade.
- Migration **8023**, TRIPLA (arquivo + `supabase/migrations/MANIFEST.md` + apêndice idempotente no fim de `supabase/baseline.sql`). Função nova em `public`: `revoke execute ... from public, anon`.
- `organization_id` sempre da linha do compromisso, nunca de input externo. Zod em todo input. Respostas `ok()`/`fail()`.
- Textos de tela em pt-BR, com entrada no `lib/i18n/dicionario.ts` (espanhol) como as vizinhas.
- Sem `console.log`. Conventional Commits terminando com `Refs #83` e `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Saída longa de teste: redirecione para `../wt-lembrete-83-<etapa>.log` e filtre; o exit code manda.

## Review Focus
1. **Duas mensagens para o paciente**: Meta devolve `queued`/`sending` ou erro sem código conhecido e o código cai para o QR — deve parar (Task 3 testa `classificarEnvio` com `queued`, `sending`, `failed` sem código; Task 5 testa que a rodada seguinte não reenvia degrau marcado como ambíguo).
2. **Corrida varredura × 9006**: a Meta falha depois e a 9006 abre "ligar" antes da reserva tentar — deve esperar a reserva (Task 6 testa `marcarLembretesQueFalharam` pulando a mensagem com `metadata.lembrete.reserva` ainda nula numa org com a chave ligada).
3. **Modelo de outro número** escolhido no tipo enquanto o lembrete tenta um número da Meta diferente — o caminho não pode mandar modelo alheio (Task 4 testa: modelo de `canal-A`, caminho `canal-B` com janela fechada → pula para o próximo).
4. **Consulta que já começou** quando a falha da Meta chega — não reenvia (Task 6 testa `starts_at <= agora`).
5. **Chave desligada** numa org com Meta e WAHA — nada muda: o mesmo `channel_sessions ... limit(1)` e texto (Task 5 testa que `enviarLembreteComReserva` não é chamado e que a consulta antiga continua sendo feita).

---

### Task 1: Banco — migration 8023, tipos e invariantes

**Files:**
- Create: `supabase/migrations/20261111120000_8023_clinic_lembrete_meta_com_reserva.sql`
- Modify: `supabase/migrations/MANIFEST.md` (uma linha, no formato das 8016/8017)
- Modify: `supabase/baseline.sql` (apêndice idempotente no fim, mesmo SQL)
- Modify: `lib/database.types.ts` (colunas novas em `calendar_event_types` e `calendar_appointments`; a função nova em `Functions`)
- Test: `tests/invariants/clinic-lembrete-meta-com-reserva.test.ts`

**Interfaces:**
- Produces (banco):
  - `meta_templates`: `unique (organization_id, id)` (constraint `meta_templates_org_id_key`).
  - `calendar_event_types.reminder_meta_template_id uuid null` + FK `calendar_event_types_reminder_meta_template_fk` `(organization_id, reminder_meta_template_id) references meta_templates(organization_id, id) on delete set null (reminder_meta_template_id) deferrable initially deferred`.
  - `calendar_appointments.reminder_tentativas jsonb not null default '{}'` (mapa degrau em minutos → nº de tentativas).
  - `calendar_appointments.reminder_falha text null` com check `in ('sem_caminho','fora_do_horario','meta_sem_modelo','erro_apos_tentativas','envio_nao_confirmado')`.
  - `calendar_appointments.reminder_falha_at timestamptz null`.
  - `public.fn_clinic_definir_lembrete_com_reserva(p_org uuid, p_ligado boolean) returns jsonb` — mesmo corpo/guardas de `fn_clinic_definir_confirmacao_automatica` (baseline linha ~37144), gravando `settings.clinic.lembrete_com_reserva`; `revoke ... from public, anon`, `grant ... to authenticated`.

- [ ] **Step 1: Escrever o teste de banco que falha**, no formato de `tests/invariants/clinic-confirmacao-de-consulta.test.ts`, com os casos:
  - `fk composta recusa modelo de outra org` (insert do tipo da org A com `reminder_meta_template_id` de um modelo da org B → erro `23503` no commit);
  - `apagar o modelo zera só o reminder_meta_template_id` (o tipo continua com `organization_id`);
  - `reminder_falha recusa valor fora do vocabulário` (`'qualquer'` → `23514`);
  - `fn_clinic_definir_lembrete_com_reserva liga e desliga` (`settings->'clinic'->>'lembrete_com_reserva'` = `'true'` e depois `'false'`);
  - `fn_clinic_definir_lembrete_com_reserva recusa quem não é admin da org` (mesma recusa da confirmação automática);
  - `anon não executa a função` (`42501`).
- [ ] **Step 2: Rodar e ver falhar**: `pnpm test:db > ../wt-lembrete-83-db1.log 2>&1; echo $?` → exit ≠ 0, falha em `clinic-lembrete-meta-com-reserva`.
- [ ] **Step 3: Escrever a migration** (tudo com `if not exists` / `drop ... if exists` antes de `add constraint`), a linha no MANIFEST e o apêndice no `baseline.sql`; atualizar `lib/database.types.ts`.
- [ ] **Step 4: Rodar e ver passar**: `pnpm test:db > ../wt-lembrete-83-db2.log 2>&1; echo $?` → `0`.
- [ ] **Step 5: Aplicar no banco local** (para a 3001): `docker exec -i supabase_db_deskcomm-crm psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/migrations/20261111120000_8023_clinic_lembrete_meta_com_reserva.sql` → sem `ERROR`; depois `notify pgrst, 'reload schema'`.
- [ ] **Step 6: Commit** `feat(agenda): banco do lembrete com reserva (8023, #83)`.

### Task 2: Modelo aprovado do lembrete (porte do upstream)

**Files:**
- Create: `lib/agenda/lembrete-por-modelo.ts` (porte de `git show 91ce60dec:lib/agenda/lembrete-por-modelo.ts`)
- Create: `lib/agenda/lembrete-por-modelo.test.ts` (porte de `git show 91ce60dec:lib/agenda/lembrete-por-modelo.test.ts`)

**Interfaces:**
- Consumes: `deriveTemplateContract` (`lib/channels/meta/template-contract.ts`), `isStatusSendable` (`template-binding.ts`), `renderTemplateBody` (`render-template.ts`), `slotKey` (`build-components.ts`) — todos já existem no fork.
- Produces (mesmos nomes do upstream):
  - `ORDEM_DAS_VARIAVEIS_DO_LEMBRETE = ["primeiro_nome","quando","titulo","endereco"] as const`
  - `interface ModeloDoLembrete { id; name; language; status; channel_session_id: string|null; parameter_format: string|null; components: unknown }`
  - `variaveisQueOLembretePreenche(m) : number | null`
  - `modeloServeAoLembrete(m: ModeloDoLembrete): boolean`
  - `valoresDoModeloDoLembrete(m, pecas: Record<string,string>): { valores: Record<string,string>; texto: string } | null`
  - `lerModeloDoLembrete(admin, org, modeloId, canalId): Promise<ModeloDoLembrete|null>`
  - `modelosQueOLembreteEnvia(db, org): Promise<ModeloDoLembrete[]>`
  - `valorParaParametro(v: string): string` — **local** (o fork não tem `lib/channels/meta/variaveis-do-fluxo.ts`): troca `\r`, `\n`, `\t` por espaço, colapsa 4+ espaços seguidos em 1 (regra da Meta para parâmetro) e faz `trim`.

- [ ] **Step 1: Portar o teste do upstream** e acrescentar `valorParaParametro tira quebra de linha e tabulação` (`"Rua A\n\t 12"` → `"Rua A 12"`).
- [ ] **Step 2: Rodar e ver falhar**: `pnpm exec vitest run lib/agenda/lembrete-por-modelo.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3: Portar o módulo**, trocando o import de `valorParaParametro` pela versão local. Cabeçalho: uma linha `FORK clinic (#83): porte de upstream #3891 (91ce60dec)`.
- [ ] **Step 4: Rodar e ver passar**: mesmo comando → PASS.
- [ ] **Step 5: Commit** `feat(agenda): modelo aprovado do lembrete (porte de upstream #3891, #83)`.

### Task 3: Regra pura dos caminhos

**Files:**
- Create: `lib/clinic/lembrete-com-reserva/regra.ts`
- Test: `lib/clinic/lembrete-com-reserva/regra.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const MAX_TENTATIVAS_DO_LEMBRETE = 3;
  export const PROVIDERS_DO_LEMBRETE = ["meta_cloud", "waha"] as const;
  export type ProviderDoLembrete = (typeof PROVIDERS_DO_LEMBRETE)[number];
  export interface CanalCandidato { id: string; provider: string | null; status: string; archived_at: string | null; metadata: { disabled?: boolean } | null; created_at: string }
  export type FalhaDoLembreteComReserva = "sem_caminho" | "fora_do_horario" | "meta_sem_modelo" | "erro_apos_tentativas" | "envio_nao_confirmado";
  export type Passo = { tipo: "texto" } | { tipo: "modelo"; modeloId: string } | { tipo: "pular"; motivo: "fora_do_horario" | "meta_sem_modelo" };
  export type DesfechoDoEnvio = "enviado" | "nao_saiu" | "ambiguo";
  export const CODIGOS_QUE_GARANTEM_NAO_ENTREGA: Record<ProviderDoLembrete, readonly string[]>;
  export function ordenarCaminhos(canais: CanalCandidato[]): (CanalCandidato & { provider: ProviderDoLembrete })[];
  export function decidirPasso(i: { provider: ProviderDoLembrete; foraDoHorario: boolean; janelaAberta: boolean; modeloDoCanalId: string | null }): Passo;
  export function classificarEnvio(provider: ProviderDoLembrete, m: { status: string; error_code: string | null } | { excecao: true }): DesfechoDoEnvio;
  export function lembreteComReservaLigado(settings: unknown): boolean; // mesmo formato de confirmacaoAutomaticaLigada
  ```
  - `CODIGOS_QUE_GARANTEM_NAO_ENTREGA.meta_cloud` inclui `"131026"`, `"131049"`, `"131047"`, `"132001"`, `"132015"`, `"132016"` e os códigos síncronos de recusa que `lib/channels/adapters/meta-cloud.ts` grava em `error_code` quando a chamada nem é aceita (o builder lê o adaptador e lista; cada um com um comentário de uma linha). `waha`: os códigos de `lib/channels/adapters/waha.ts` que significam "não saiu" (sessão não WORKING, número sem WhatsApp, recusa antes do envio). Nada que signifique tempo esgotado.
  - `classificarEnvio`: `sent`/`delivered`/`read` → `enviado`; `failed` com `error_code` na lista do provider → `nao_saiu`; qualquer outra coisa (`queued`, `sending`, `failed` sem código ou com código fora da lista, `{ excecao: true }`) → `ambiguo`.
  - `decidirPasso`: `foraDoHorario` → `pular/fora_do_horario`; `waha` → `texto`; `meta_cloud` com `janelaAberta` → `texto`; `meta_cloud` fechada com `modeloDoCanalId` → `modelo`; senão `pular/meta_sem_modelo`.

- [ ] **Step 1: Testes que falham**:
  - `ordenarCaminhos põe meta antes de waha e respeita created_at` (entrada `[waha 2026-01-02, meta 2026-01-03, waha 2026-01-01]` → `[meta, waha 01-01, waha 01-02]`);
  - `ordenarCaminhos tira arquivado, desligado, não WORKING e provider fora da lista` (`zernio`, `datafy` somem);
  - `decidirPasso` — os cinco ramos acima, um `it` cada;
  - `classificarEnvio` — `sent`→enviado; `failed`+`"131026"` meta→nao_saiu; `failed`+`"131026"` waha→ambiguo; `queued`→ambiguo; `sending`→ambiguo; `failed`+`null`→ambiguo; `{excecao:true}`→ambiguo;
  - `lembreteComReservaLigado` — `{clinic:{lembrete_com_reserva:true}}`→true; `{}`/`null`/`"x"`→false.
- [ ] **Step 2: Rodar e ver falhar**: `pnpm exec vitest run lib/clinic/lembrete-com-reserva/regra.test.ts` → FAIL.
- [ ] **Step 3: Implementar `regra.ts`** (puro, sem import de Supabase).
- [ ] **Step 4: Rodar e ver passar**.
- [ ] **Step 5: Commit** `feat(agenda): regra dos caminhos do lembrete com reserva (#83)`.

### Task 4: Orquestração do envio

**Files:**
- Create: `lib/clinic/lembrete-com-reserva/enviar.ts`
- Test: `lib/clinic/lembrete-com-reserva/enviar.test.ts`

**Interfaces:**
- Consumes: Task 2 (`lerModeloDoLembrete`, `valoresDoModeloDoLembrete`), Task 3 (tudo), `sendMessageHandler` (`app/api/v1/messages/_handler.ts`), `ensureConversation` (`lib/automation/start-conversation.ts`), `adiarAteAJanelaAbrir` (`lib/automation/janela-do-canal.ts`), `espacarEnvio` (`lib/automation/throttle.ts`), `isWindowOpen` (`lib/agent-engine/guardrails/messaging-window.ts`).
- Produces:
  ```ts
  export interface EntradaDoLembrete {
    org: string; appointmentId: string; contatoId: string;
    degraus: number[];            // os pendentes desta rodada
    textoLivre: string;           // corpo já montado (com o pedido SIM/NÃO quando for o caso)
    pecasDoModelo: Record<string, string>; // primeiro_nome, quando, titulo, endereco
    modeloDoTipoId: string | null;
    excluirCanalIds?: string[];   // usado pela reserva (Task 6) para não voltar à Meta
    tentativa: number;            // 1..3
  }
  export type ResultadoDoLembrete =
    | { desfecho: "enviado"; canalId: string; provider: ProviderDoLembrete; mensagemId: string; via: "texto" | "modelo" }
    | { desfecho: "ambiguo"; canalId: string; mensagemId: string | null }
    | { desfecho: "nao_saiu"; motivo: FalhaDoLembreteComReserva };
  export async function enviarLembreteComReserva(admin: SupabaseClient, e: EntradaDoLembrete): Promise<ResultadoDoLembrete>;
  ```
  - Para cada caminho de `ordenarCaminhos` (menos `excluirCanalIds`): `adiarAteAJanelaAbrir` → `foraDoHorario`; conversa do contato naquele canal via `ensureConversation`, `janelaAberta = isWindowOpen(agora, conversa.last_inbound_at)`; `modeloDoCanalId` = `modeloDoTipoId` só se `lerModeloDoLembrete(admin, org, modeloDoTipoId, canal.id)` não for `null`; `decidirPasso`; `pular` → próximo; senão `espacarEnvio(canal.id)` e `sendMessageHandler` com `actor: { type: "webhook_source", id: appointmentId }`, `requestId: \`agenda-reminder:${appointmentId}:${canal.id}\``, `metadata: { lembrete: { appointment_id, degraus, tentativa, reserva: null } }`; texto → `{ type: "text", body: textoLivre }`; modelo → `{ type: "template", template_name, template_language, template_values: valores }` com `body` = `texto` renderizado; `classificarEnvio` → `enviado` devolve; `ambiguo` devolve **e para**; `nao_saiu` → próximo.
  - Acabaram os caminhos: `nao_saiu` com motivo `sem_caminho` se nenhum existia, `fora_do_horario` se todos foram pulados por horário, `meta_sem_modelo` se o único pulo foi esse, senão `erro_apos_tentativas` (o cron decide se ainda há tentativa).

- [ ] **Step 1: Testes que falham** (Supabase e `sendMessageHandler` em `vi.mock`, como `app/api/v1/cron/agenda-reminder/route.test.ts`):
  - `só QR: manda texto pelo waha`;
  - `Meta janela aberta: texto pela Meta, não toca no waha`;
  - `Meta janela fechada com modelo do número: manda modelo com {{1}}..{{4}} e body renderizado`;
  - `Meta janela fechada sem modelo: cai para o waha`;
  - `modelo de outro número da Meta: cai para o waha` (Review Focus 3);
  - `Meta failed 131026 síncrono: cai para o waha`;
  - `Meta queued: para e devolve ambiguo, waha não é chamado` (Review Focus 1);
  - `excluirCanalIds pula a Meta`;
  - `todos fora do horário: nao_saiu/fora_do_horario`;
  - `nenhum canal: nao_saiu/sem_caminho`;
  - `metadata.lembrete leva appointment_id, degraus e tentativa`.
- [ ] **Step 2: Rodar e ver falhar**: `pnpm exec vitest run lib/clinic/lembrete-com-reserva/enviar.test.ts` → FAIL.
- [ ] **Step 3: Implementar `enviar.ts`**.
- [ ] **Step 4: Rodar e ver passar**.
- [ ] **Step 5: Commit** `feat(agenda): envio do lembrete pela Meta com reserva pelo QR (#83)`.

### Task 5: Cron `agenda-reminder` usa a orquestração quando a chave está ligada

**Files:**
- Modify: `app/api/v1/cron/agenda-reminder/route.ts` (o laço `for (const linha of linhas)`, a partir da leitura de `channel_sessions`; o `select` ganha `reminder_tentativas` e `calendar_event_types.reminder_meta_template_id`)
- Test: `app/api/v1/cron/agenda-reminder/route.test.ts`

**Interfaces:**
- Consumes: Task 3 (`lembreteComReservaLigado`, `MAX_TENTATIVAS_DO_LEMBRETE`), Task 4 (`enviarLembreteComReserva`).
- Produces: compromisso com `reminder_tentativas`, `reminder_falha`, `reminder_falha_at` gravados conforme abaixo (Task 6 e Task 8 leem).

Regras com a chave ligada (ler `organizations.settings` **antes** do canal; desligada = caminho de hoje sem nenhuma linha mudada):
- `contato.is_blocked` → `pular("contato_bloqueado")` como hoje, sem gravar falha.
- `tentativa = max(reminder_tentativas[degrau] dos pendentes) + 1`.
- `enviado` → carimba os degraus (`reminder_sent_at`, `reminder_sent_offsets_minutes` como hoje), `reminder_falha = null`, `reminder_falha_at = null`, e `registrarPedido` com `reminderMessageId` quando `pedeConfirmacao` (como hoje).
- `ambiguo` → carimba os degraus (não reenvia), `reminder_falha = 'envio_nao_confirmado'`.
- `nao_saiu` com `fora_do_horario` → não carimba, não conta tentativa (como hoje: `pular("fora_da_janela")`).
- `nao_saiu` outro motivo → `reminder_tentativas[degrau] = tentativa` para cada pendente, `reminder_falha = motivo`; se `tentativa >= 3` → carimba os degraus e `reminder_falha = 'erro_apos_tentativas'` (a 9006 `marcarLembretesQueNaoSairam` abre a tarefa "ligar" no prazo dela).

- [ ] **Step 1: Testes que falham**, acrescentando em `route.test.ts`:
  - `chave desligada: não chama enviarLembreteComReserva e lê channel_sessions com limit(1)` (Review Focus 5);
  - `chave ligada e enviado: carimba e limpa reminder_falha`;
  - `chave ligada e ambiguo: carimba e grava envio_nao_confirmado; rodada seguinte não chama de novo` (Review Focus 1);
  - `chave ligada e nao_saiu na 1ª: não carimba, tentativas {"1440":1}`;
  - `chave ligada e nao_saiu na 3ª: carimba e grava erro_apos_tentativas`;
  - `chave ligada e fora_do_horario: não carimba nem conta tentativa`;
  - `chave ligada e is_blocked: não chama o envio nem grava falha`.
- [ ] **Step 2: Rodar e ver falhar**: `pnpm exec vitest run app/api/v1/cron/agenda-reminder/route.test.ts` → FAIL nos novos.
- [ ] **Step 3: Implementar** o ramo no cron (extrair o ramo ligado para uma função local `lembrarComReserva(...)` para o laço continuar legível).
- [ ] **Step 4: Rodar e ver passar**, incluindo os testes antigos do arquivo (sem mudar nenhum).
- [ ] **Step 5: Commit** `feat(agenda): cron do lembrete usa a reserva quando a clínica liga (#83)`.

### Task 6: Reserva quando a Meta avisa depois + carência na 9006

**Files:**
- Create: `lib/clinic/lembrete-com-reserva/reserva-depois.ts`
- Test: `lib/clinic/lembrete-com-reserva/reserva-depois.test.ts`
- Modify: `app/api/v1/cron/agenda-reminder/route.ts` (chamar a varredura **antes** do laço de lembretes, contando em `metadata.reservas`)
- Modify: `lib/clinic/confirmacao/servidor.ts` (`marcarLembretesQueFalharam`)
- Test: `lib/clinic/confirmacao/servidor.test.ts`

**Interfaces:**
- Consumes: Task 3 (`classificarEnvio`, `MAX_TENTATIVAS_DO_LEMBRETE`, `lembreteComReservaLigado`), Task 4 (`enviarLembreteComReserva` com `excluirCanalIds`).
- Produces: `export async function reenviarLembretesQueAMetaRecusou(admin: SupabaseClient, agora: Date, limite = 100): Promise<{ reenviados: number; semReserva: number; ignorados: number }>`

Comportamento:
- Lê `messages` com `status = 'failed'`, `metadata->'lembrete' is not null`, `metadata->'lembrete'->>'reserva' is null`, `created_at > agora - 2 dias`, canal `meta_cloud`, da org com a chave ligada.
- Compromisso (`metadata.lembrete.appointment_id`) com `starts_at <= agora` ou status fora de `pending/confirmed` → marca `reserva = 'consulta_passou'` e ignora (Review Focus 4).
- `classificarEnvio` ≠ `nao_saiu` → marca `reserva = 'ambiguo'` e ignora.
- `tentativa >= 3` → marca `reserva = 'esgotado'`.
- Senão `enviarLembreteComReserva` com `excluirCanalIds` = todos os `meta_cloud` da org e `tentativa + 1`; marca `reserva = 'feita'` (enviado/ambíguo) ou `'sem_reserva'` (nao_saiu) na mensagem **original**; se enviado e houver pedido de confirmação aberto, atualiza `clinic_confirmation_requests.reminder_message_id` para a mensagem nova.
- Marcar `reserva` é `update messages set metadata = jsonb_set(...)` filtrando `organization_id` e `id`.

Carência na 9006: em `marcarLembretesQueFalharam`, numa org com a chave ligada, ignorar o pedido cuja mensagem tem `metadata.lembrete` e `metadata.lembrete.reserva` nulo (a reserva ainda não decidiu). Com `'sem_reserva'`, `'esgotado'` ou `'ambiguo'`, abre a tarefa como hoje. Org com a chave desligada: nenhuma mudança.

- [ ] **Step 1: Testes que falham**:
  - `Meta 131026 depois: reenvia pelo waha e marca feita`;
  - `consulta já começou: não reenvia, marca consulta_passou`;
  - `código desconhecido: não reenvia, marca ambiguo`;
  - `sem waha: marca sem_reserva`;
  - `tentativa 3: marca esgotado`;
  - `org com a chave desligada: não lê nada`;
  - `reenvio atualiza reminder_message_id do pedido aberto`;
  - em `servidor.test.ts`: `9006 espera a reserva quando a chave está ligada` (Review Focus 2) e `9006 abre a tarefa depois de sem_reserva`; `9006 igual a hoje com a chave desligada`.
- [ ] **Step 2: Rodar e ver falhar**: `pnpm exec vitest run lib/clinic/lembrete-com-reserva/reserva-depois.test.ts lib/clinic/confirmacao/servidor.test.ts` → FAIL nos novos.
- [ ] **Step 3: Implementar** `reserva-depois.ts`, a chamada no cron e a carência na 9006.
- [ ] **Step 4: Rodar e ver passar** (incluindo `route.test.ts` da Task 5).
- [ ] **Step 5: Commit** `feat(agenda): reserva pelo QR quando a Meta recusa depois de aceitar (#83)`.

### Task 7: Chave da clínica e seletor do modelo na tela

**Files:**
- Modify: `app/api/v1/clinic/config/route.ts` (`lembrete_com_reserva` no GET, no `patchSchema`, em `FUNCAO_DA_OPCAO` → `"fn_clinic_definir_lembrete_com_reserva"` e na lista do laço da linha ~224)
- Modify: `app/app/settings/tenant/profissionais/_client.tsx` (interruptor ao lado de "confirmação automática", texto: **"Lembrete pelo número oficial, com reserva pelo QR code"** / ajuda: "O lembrete sai primeiro pelo número oficial da Meta. Se ele não puder enviar, sai pelo número conectado por QR code.")
- Modify: `app/api/v1/agenda/tipos/route.ts` (aceitar `reminder_meta_template_id: z.string().uuid().nullable().optional()`; recusar com `fail("validation_error", "Esse modelo não pode ser usado no lembrete.", 422)` se não estiver em `modelosQueOLembreteEnvia(db, org)`)
- Modify: `app/app/settings/tenant/agenda/page.tsx` e `_client.tsx` (seletor **"Se a janela de 24 h já tiver fechado, mandar este modelo aprovado"**, opções = `modelosQueOLembreteEnvia`, "Nenhum" + a frase "Crie um em Conexões → Modelos" quando vazio; ajuda quando a confirmação automática está ligada: "Pelo modelo, o pedido de SIM/NÃO não é acrescentado: escreva o modelo já pedindo a confirmação."; **só aparece com a chave ligada**)
- Modify: `lib/i18n/dicionario.ts` (as frases novas)
- Test: `app/api/v1/clinic/config/route.test.ts` (ou o teste existente da rota), `app/api/v1/agenda/tipos/route.test.ts`

**Interfaces:**
- Consumes: Task 1 (função e coluna), Task 2 (`modelosQueOLembreteEnvia`), Task 3 (`lembreteComReservaLigado`).

- [ ] **Step 1: Testes que falham**:
  - config: `PATCH lembrete_com_reserva chama fn_clinic_definir_lembrete_com_reserva` e `GET devolve lembrete_com_reserva false por padrão`;
  - tipos: `aceita modelo utilizável da org`, `recusa modelo de outra org ou não aprovado com 422`, `aceita null para limpar`.
- [ ] **Step 2: Rodar e ver falhar**: `pnpm exec vitest run app/api/v1/clinic/config app/api/v1/agenda/tipos` → FAIL nos novos.
- [ ] **Step 3: Implementar** rotas e telas.
- [ ] **Step 4: Rodar e ver passar**.
- [ ] **Step 5: Commit** `feat(agenda): chave e modelo aprovado do lembrete com reserva na tela (#83)`.

### Task 8: Um aviso só — o selo mostra o motivo

**Files:**
- Modify: `components/clinic/SeloDaConfirmacao.tsx` (prop opcional `falhaDoLembrete?: string | null`: quando `status` não é status de confirmação e `falhaDoLembrete` é do vocabulário da Task 1, mostra pílula de alerta com o rótulo; quando há `status`, a falha da 9006 continua vencendo)
- Modify: `lib/clinic/confirmacao/status.ts` (`ROTULO_DA_FALHA_COM_RESERVA: Record<FalhaDoLembreteComReserva, string>` = `sem_caminho`: "Lembrete não saiu: nenhum número conectado — ligar"; `fora_do_horario`: "Lembrete aguardando o horário de envio"; `meta_sem_modelo`: "Lembrete não saiu: janela fechada e sem modelo aprovado — ligar"; `erro_apos_tentativas`: "Lembrete não saiu após 3 tentativas — ligar"; `envio_nao_confirmado`: "Lembrete com envio não confirmado — conferir")
- Modify: `app/api/v1/clinic/agenda-info/route.ts` e `app/api/v1/clinic/visitas/route.ts` (devolver `lembrete_falha` = `reminder_falha` só com a chave ligada) e quem renderiza o selo: `components/clinic/agenda/InfoDaClinicaNaAgenda.tsx`, `app/app/recepcao/_client.tsx`
- Modify: `lib/i18n/dicionario.ts`
- Test: `components/clinic/SeloDaConfirmacao.test.tsx` (criar se não existir) e o teste da rota `agenda-info`

- [ ] **Step 1: Testes que falham**: `selo mostra o motivo do lembrete sem pedido de confirmação`; `falha da 9006 vence quando há pedido`; `agenda-info não devolve lembrete_falha com a chave desligada`.
- [ ] **Step 2: Rodar e ver falhar**.
- [ ] **Step 3: Implementar**.
- [ ] **Step 4: Rodar e ver passar**.
- [ ] **Step 5: Commit** `feat(agenda): o selo da consulta diz por que o lembrete não saiu (#83)`.

### Task 9: Prova pela tela, registro do fork e Verify

**Files:**
- Create: `tests/e2e/agenda-lembrete-com-reserva.spec.ts`
- Create: `evidence/83-lembrete-com-reserva/*.png` (citadas no handoff)
- Create: `docs/tarefas/83-lembrete-meta-com-reserva/handoff.md`
- Modify: `UPSTREAM.md` (linha na tabela de arquivos do core tocados: cron `agenda-reminder`, `clinic/config`, `agenda/tipos`, `servidor.ts`; e em "Absorções seletivas", lote 2: upstream #3891 por adaptação, sem `remetente-do-lembrete`)

- [ ] **Step 1: Subir a branch na 3001**: desligar o que estiver na 3001, `cp ../desenvolvimento/.env.local .`, `pnpm install --frozen-lockfile`, `pnpm exec next dev -p 3001` em segundo plano; `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/login` → `200`.
- [ ] **Step 2: Spec Playwright** contra a 3001, org de teste local (sem dado real): chave desligada → seletor some; liga a chave → seletor aparece com "Nenhum" e a frase de onde criar; compromisso com `reminder_falha = 'meta_sem_modelo'` (inserido pelo seed do teste) → o selo mostra o rótulo. Screenshots em `evidence/83-lembrete-com-reserva/`.
- [ ] **Step 3: Rodar** `pnpm test:e2e -- tests/e2e/agenda-lembrete-com-reserva.spec.ts` → PASS.
- [ ] **Step 4: Verify** (cada um redirecionado para `../wt-lembrete-83-<nome>.log`): `pnpm lint` → 0; `pnpm typecheck` → 0; `pnpm test:db` → 0; `pnpm test:unit` → falhas só em arquivos que também falham num checkout limpo de `origin/develop` sem `.env` (conferir arquivo a arquivo e anotar no handoff).
- [ ] **Step 5: Handoff e UPSTREAM.md**, com o roteiro "como validar na 3001" em linguagem simples para o dono.
- [ ] **Step 6: Commit** `test(agenda): prova pela tela e handoff do lembrete com reserva (#83)`; `git push -u origin feature/upstream-lembrete-por-modelo-aprovado`; abrir PR para `develop` com a saída do Verify no corpo e `Refs #83`; `gh pr checks <n>` com `verify-parte (3)` verde antes de mover o cartão para "Teste".
