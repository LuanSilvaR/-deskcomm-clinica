# Atestado de Anonimização (#87) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** With a per-clinic flag turned on, anonymizing a contact issues one PDF certificate on the clinic letterhead. The certificate covers when, who, from which IP, what was anonymized, and what was retained and why. It carries a short code that the clinic can verify inside the system.

**Architecture:**
- **Pure core.** `lib/clinic/lgpd/atestado.ts` holds the canonical line, HMAC, short code, retained-record table and declaration texts.
- **I/O boundary.** `lib/clinic/lgpd/emitir-atestado.ts` counts the retained records, renders through `lib/documentos`, signs through `pades-signer`, uploads to `lgpd-exports` and inserts a row in `clinic_atestados_anonimizacao`.
- **Wiring.** The anonymize route calls it only when the flag is on. New clinic routes handle download, late generation, listing and verification.

**Tech Stack:** Next.js 16 route handlers, Supabase (Postgres + RLS + Storage), `@react-pdf` via `lib/documentos/renderizar.tsx`, Vitest, Playwright.

**Spec:** `docs/tarefas/87-atestado-anonimizacao/design.md`

## Global Constraints
- **CLAUDE.md rules apply in full:**
  - triple migration in the 8xxx range;
  - `organization_id` from a trusted source only;
  - Zod on every input;
  - `ok()`/`fail()`;
  - no `console.log`;
  - no real patient data;
  - the feature is born off.
- **Migration number: 8024.** 8018–8023 are taken by open PRs. The file is `supabase/migrations/20261111140000_8024_clinic_atestado_anonimizacao.sql`.
- **Flag:** `organizations.settings.clinic.atestado_anonimizacao`. Only `true` turns it on. It is set by `fn_clinic_definir_atestado_anonimizacao(p_org uuid, p_ligado boolean)`, a copy of the `fn_clinic_definir_titulo_livre` pattern in migration 8003, with the same guards (admin, support write, MFA).
- **No patient identity in the PDF or in the canonical line.** That means no name, no document, no phone or email, not even masked. The patient is identified only by the protocol (the atestado `id`).
- **Anonymization never fails because of the atestado.** If emission fails, the route returns 200 with `atestado: { erro: string }`.
- **One certificate per contact:** `unique (organization_id, contact_id)`.
- **Code:** HMAC-SHA256 with `process.env.LGPD_SIGNING_KEY` when the key has more than 10 chars. Otherwise SHA-256, `algoritmo: "sha256"`, and the printed label reads "Código de integridade" instead of "Código de autenticidade".
- **Short code:** the first 16 hex characters, uppercase, in 4 blocks joined by `-`.
- **Storage:** bucket `lgpd-exports`, path `{org}/atestados/{atestadoId}/atestado.pdf`. The signed URL lives 900 s.
- **Language:** all UI and PDF copy is pt-BR, and every UI string goes through `t()` / the dictionary as the neighbouring screens do.

## Review Focus
1. **Repeated click or resumed anonymization** (`resumed` / `already_anonymized`) must not create a second certificate or fail. Test in Task 4.
2. **Flag off** must give a byte-identical response shape: no `atestado` key, no queries to the new table. Test in Task 4.
3. **Verifying a code from another clinic** must answer "not found", never another org's data. Tests in Task 2 (RLS) and Task 5 (route).
4. **Short-code input with lowercase letters, spaces or no dashes** (`abcd ef01 2345 6789`) must still be found. Test in Task 1 (`normalizarCodigoCurto`).
5. **A contact with zero clinical records** must print "Nenhum registro clínico foi retido." instead of an empty table. Test in Task 1.

---

### Task 1: Pure core — canonical line, code, retained table, texts

**Files:**
- Create: `lib/clinic/lgpd/atestado.ts`
- Test: `lib/clinic/lgpd/atestado.test.ts`

**Interfaces — Produces:**
```ts
export const VERSAO_DO_ATESTADO = "clinic-atestado-anonimizacao.v1";
export type CategoriaRetida = "prontuario" | "anexos" | "documentos" | "planos";
export const CATEGORIAS_RETIDAS: Record<CategoriaRetida, { tabelas: string[]; rotulo: string; motivo: string }>;
export type Retidos = Partial<Record<CategoriaRetida, number>>; // only > 0 kept
export interface ExecutorDoAtestado { user_id: string; nome: string; email: string | null; papel: string }
export interface DadosDoAtestado {
  atestado_id: string; organization_id: string; organization_name: string; organization_document: string | null;
  executor: ExecutorDoAtestado; ip: string | null; anonimizado_em: string; emitido_em: string;
  retidos: Retidos; fuso: string;
}
export function linhaCanonica(d: DadosDoAtestado): string;
export function codigoDoAtestado(d: DadosDoAtestado, chave: string | null | undefined): { codigo: string; algoritmo: "hmac-sha256" | "sha256" };
export function codigoCurto(codigo: string): string;              // "ABCD-EF01-2345-6789"
export function normalizarCodigoCurto(entrada: string): string | null; // null when not 16 hex after cleanup
export function dataHoraNoFuso(iso: string, fuso: string): string; // "dd/mm/aaaa hh:mm:ss (America/Sao_Paulo)", invalid fuso → UTC
export function itensAnonimizados(): string[];                     // fixed pt-BR list from design "Anonimizado"
export function linhasRetidas(r: Retidos): { rotulo: string; quantidade: number; motivo: string }[];
export function textoDaDeclaracao(d: DadosDoAtestado): string;
```
- **`CATEGORIAS_RETIDAS` values:**
  - `prontuario`: tables `clinic_prontuarios`, `clinic_atendimentos`;
  - `anexos`: `clinic_anexos`;
  - `documentos`: `clinic_documentos_emitidos`;
  - `planos`: `clinic_planos_tratamento`.
  - The `motivo` texts come from the design table, verbatim.
- **Canonical line order**, joined by `|`, absent fields written as `-`:
  1. `VERSAO_DO_ATESTADO`
  2. `atestado_id`
  3. `organization_id`
  4. `organization_name`
  5. `organization_document`
  6. `executor.nome`
  7. `executor.email`
  8. `executor.papel`
  9. `ip`
  10. `anonimizado_em`
  11. `emitido_em`
  12. the retained counts, as `categoria=n` sorted by key and joined by `,` (or `-` when empty)
- **Declaration:** when `emitido_em` and `anonimizado_em` differ by more than 5 minutes, it says the certificate was issued later and gives both dates.

- [ ] **Step 1: Write the failing tests**
  - `linhaCanonica` has exactly 12 `|`-separated fields and never contains `""` between separators.
  - The same data plus the same key gives the same code; changing one char of `organization_name` changes the code.
  - A key with more than 10 chars gives `algoritmo: "hmac-sha256"`; `null`, `""` or `"curta"` give `"sha256"`.
  - `codigoCurto("abcdef0123456789ffff")` returns `"ABCD-EF01-2345-6789"`.
  - `normalizarCodigoCurto(" abcd ef01-2345 6789 ")` returns `"ABCD-EF01-2345-6789"`, and `normalizarCodigoCurto("xyz")` returns `null`.
  - `dataHoraNoFuso("2026-11-11T15:00:00Z","America/Sao_Paulo")` returns `"11/11/2026 12:00:00 (America/Sao_Paulo)"`, and an invalid fuso ends with `"(UTC)"`.
  - `linhasRetidas({})` returns `[]`, and `linhasRetidas({ prontuario: 2, anexos: 0 })` has 1 row with `quantidade: 2`.
  - `textoDaDeclaracao` contains the `atestado_id` and does not contain any value passed as patient data. Use a fixture with `organization_name: "Clínica Fictícia Ltda"` and assert that the output has no `@` other than the executor email.
  - The "issued later" wording appears only when the gap is more than 5 minutes.
- [ ] **Step 2:** Run `pnpm vitest run lib/clinic/lgpd/atestado.test.ts`. Expected: FAIL, the module is not found.
- [ ] **Step 3:** Implement with `node:crypto` (`createHmac`, `createHash`) and `Intl.DateTimeFormat("pt-BR", …, hourCycle "h23")`.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(lgpd): núcleo do atestado de anonimização (#87)`.

### Task 2: Migration 8024 — table, flag function, RLS, invariants

**Files:**
- Create: `supabase/migrations/20261111140000_8024_clinic_atestado_anonimizacao.sql`
- Modify: `supabase/MANIFEST.md` (one line, same format as 8017)
- Modify: append an idempotent copy to the end of `supabase/baseline.sql`
- Modify: `lib/supabase/database.types.ts` (the new table and function, in alphabetical position)
- Modify: `lib/clinic/flags.ts`: add `atestadoAnonimizacaoLigadoNaConfig(settings: unknown): boolean`, modelled on `tituloLivreLigadoNaConfig`
- Test: `tests/invariants/clinic-atestado-anonimizacao.test.ts`

**Interfaces — Produces:**
- **Table `public.clinic_atestados_anonimizacao`:**
  - `id uuid pk default gen_random_uuid()`;
  - `organization_id uuid not null references organizations(id) on delete cascade`;
  - `contact_id uuid not null references contacts(id)`;
  - `anonimizado_em timestamptz not null`, `emitido_em timestamptz not null default now()`;
  - `executor jsonb not null`, `ip text`, `retidos jsonb not null default '{}'`;
  - `codigo text not null`, `codigo_curto text not null`;
  - `algoritmo text not null check (algoritmo in ('hmac-sha256','sha256'))`;
  - `pdf_path text not null`, `pdf_sha256 text not null`, `pades boolean not null default false`, `versao text not null`;
  - `unique (organization_id, contact_id)`, plus an index on `(organization_id, codigo_curto)`.
- **RLS:**
  - enabled;
  - policy `tenant_isolation_clinic_atestados_anonimizacao_select` FOR SELECT `using (organization_id in (select fn_user_org_ids()) and fn_role_at_least(organization_id,'admin'))`;
  - no insert, update or delete policy. The service role writes, and rows are immutable for `authenticated`.
  - `revoke all ... from anon`.
- **Function:** `fn_clinic_definir_atestado_anonimizacao(uuid, boolean) returns jsonb { ligado, mudou }`. Revoke from public and anon; grant to authenticated.

- [ ] **Step 1: Write the failing invariant test.** Copy the shape of `tests/invariants/clinic-titulo-livre-opcao.test.ts`. It must check that:
  - the flag function toggles and returns `mudou`;
  - a non-admin gets `42501`;
  - org A's admin can read org A's row and sees 0 rows of org B;
  - `authenticated` cannot insert, update or delete;
  - a second insert for the same `(org, contact)` violates the unique constraint (`23505`).
  - The test cleans up its fixtures in `afterAll`.
- [ ] **Step 2:** Run `pnpm test:db tests/invariants/clinic-atestado-anonimizacao.test.ts`. Expected: FAIL, the relation does not exist.
- [ ] **Step 3:** Write the migration, the MANIFEST line, the baseline appendix (`create table if not exists`, `create or replace function`, `drop policy if exists` then `create`), the types and the flags helper.
- [ ] **Step 4:** Run the same command. Expected: PASS. Also run `pnpm typecheck`, which must exit 0.
- [ ] **Step 5: Commit** with `feat(lgpd): tabela e chave do atestado de anonimização (migration 8024, #87)`.

### Task 3: Emission — count retained, render PDF, store, insert

**Files:**
- Create: `lib/clinic/lgpd/emitir-atestado.ts`
- Create: `lib/clinic/lgpd/atestado-pdf.ts`, the PDF document built as a `DocumentoTimbrado` for `renderizarDocumento`
- Test: `lib/clinic/lgpd/emitir-atestado.test.ts`

**Interfaces:**
- **Consumes:**
  - everything from Task 1;
  - `renderizarDocumento(doc, contexto)` and `resolverContextoDaMarca(leitor, orgId)` from `lib/documentos`;
  - `signPdfPades(buffer)` from `lib/lgpd/pades-signer`;
  - the table from Task 2.
- **Produces:**
```ts
export const BUCKET_DO_ATESTADO = "lgpd-exports";
export async function contarRetidos(admin: SupabaseClient, orgId: string, contactId: string): Promise<Retidos>;
export interface PedidoDeEmissao { orgId: string; contactId: string; anonimizadoEm: string; executor: ExecutorDoAtestado; ip: string | null }
export type ResultadoDaEmissao =
  | { ok: true; atestado: { id: string; codigo_curto: string; algoritmo: "hmac-sha256" | "sha256"; emitido_em: string } }
  | { ok: false; erro: string; jaExistia?: boolean };
export async function emitirAtestado(admin: SupabaseClient, p: PedidoDeEmissao): Promise<ResultadoDaEmissao>;
export function montarDocumentoDoAtestado(d: DadosDoAtestado, codigo: { curto: string; algoritmo: "hmac-sha256" | "sha256" }): DocumentoTimbrado;
```
- **`emitirAtestado` steps:**
  1. If a row already exists for `(org, contact)`, return `{ ok: false, erro: "ja_emitido", jaExistia: true }`.
  2. Read the org's `legal_name` / `name`, `document` and `timezone` (default `America/Sao_Paulo`).
  3. Count the retained records.
  4. Generate the `id` with `randomUUID()`.
  5. Build the data and compute the code.
  6. Render, sign and upload with `upsert: true`.
  7. Insert the row. If the insert fails with `23505`, remove the uploaded object and return `jaExistia`.
- It never throws. Every failure returns `{ ok: false, erro }`.
- **PDF content, in order:**
  - title "Atestado de Anonimização";
  - protocol;
  - declaration;
  - the section "O que foi anonimizado" (`itensAnonimizados`);
  - the section "O que foi retido e por quê" (`linhasRetidas`, or "Nenhum registro clínico foi retido.");
  - the section "Execução": responsible person (name, email, role), IP (or "não registrado"), date of the act, date of issue;
  - the code label ("Código de autenticidade" or "Código de integridade") plus the short code;
  - the note "Confira este código em LGPD › Conferir código, no sistema da clínica."

- [ ] **Step 1: Write the failing tests.** Use a stub admin client, as `tests/unit/atestado-de-anonimizacao-emissao.test.ts` does in upstream commit `417326e6`.
  - `contarRetidos` returns only categories with more than 0 records and queries each table filtered by `organization_id` and `contact_id`.
  - Success: a row is inserted with `codigo_curto` matching `/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/`; the path is `${org}/atestados/${id}/atestado.pdf`; the result is `ok: true`.
  - When a row already exists: no upload, and the result is `jaExistia: true`.
  - When the upload fails: `ok: false`, an `erro` that contains the storage message, and no insert.
  - `montarDocumentoDoAtestado` does not contain a patient name passed in a decoy field of the stub contact (`"Paciente Fictício"`).
- [ ] **Step 2:** Run `pnpm vitest run lib/clinic/lgpd/emitir-atestado.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Read `lib/documentos/renderizar.tsx` (the `DocumentoTimbrado` shape) and one existing caller, such as the POP or prontuário PDF route, to build the document the same way.
- [ ] **Step 4:** Run the same command. Expected: PASS. `pnpm typecheck` must exit 0.
- [ ] **Step 5: Commit** with `feat(lgpd): emissão do atestado no papel timbrado (#87)`.

### Task 4: Wire the anonymize route + flag in config

**Files:**
- Modify: `app/api/v1/lgpd/anonymize/route.ts`. After the audit, if the flag is on, call `emitirAtestado`. This is a core change: record it in `UPSTREAM.md` in Task 7.
- Modify: `app/api/v1/clinic/config/route.ts`:
  - add `atestado_anonimizacao` to the read options;
  - add it to the Zod schema;
  - add it to the RPC map `fn_clinic_definir_atestado_anonimizacao`;
  - add it to the boolean options loop.
- Test: `tests/unit/lgpd-anonymize-atestado.test.ts`, mocking like the existing anonymize route tests (`grep -rl "lgpd/anonymize/route" tests lib`).

**Interfaces:**
- Consumes `emitirAtestado` and `atestadoAnonimizacaoLigadoNaConfig`.
- Produces: the response gains `atestado?: { id, codigo_curto, algoritmo, emitido_em } | { erro: string }`, and **only** when the flag is on.
- **The executor:**
  - `user_id` comes from the auth user;
  - `nome` and `email` from `authz.user`;
  - `papel` is the pt-BR role label of `authz.org.role`.
- **The IP** is the first value of `x-forwarded-for`, else `x-real-ip`, else `null`.
- **`anonimizadoEm`** is `step.data.anonymized_at ?? new Date().toISOString()`.
- **The flag** is read with the admin client from `organizations.settings` of `existing.organization_id`.
- **When to emit:**
  - `desfecho === "anonymized"`: emit;
  - `resumed` / `already_anonymized`: call `emitirAtestado` too, since `jaExistia` makes it idempotent and it covers a failed first emission;
  - `jaExistia` maps to an `atestado` with the existing row's public fields (select by org + contact).

- [ ] **Step 1: Write the failing tests:**
  - with the flag off, the response has no `atestado` key and `emitirAtestado` is not called;
  - with the flag on, `anonymized` returns `atestado.codigo_curto`;
  - when emission returns `{ ok:false, erro }`, the status is 200 and `atestado.erro` is set;
  - a second call (`already_anonymized`) returns the same `atestado.id` and does not insert a second time;
  - the config PATCH with `{ atestado_anonimizacao: true }` calls the right RPC, and the GET returns the key.
- [ ] **Step 2:** Run `pnpm vitest run tests/unit/lgpd-anonymize-atestado.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the same command. Expected: PASS. Also run the existing anonymize and config tests (`pnpm vitest run $(grep -rlE "lgpd/anonymize|clinic/config" tests lib app --include=*.test.ts)`), which must all pass.
- [ ] **Step 5: Commit** with `feat(lgpd): anonimizar emite o atestado quando a chave está ligada (#87)`.

### Task 5: Clinic routes — download, generate later, list, verify

**Files:**
- Create: `app/api/v1/clinic/lgpd/atestados/route.ts`:
  - `GET` lists the org's certificates: `id, contact_id, anonimizado_em, emitido_em, codigo_curto, executor->>nome`, ordered by `emitido_em desc`, limit 200;
  - `POST { contact_id }` generates later.
- Create: `app/api/v1/clinic/lgpd/atestados/[id]/route.ts`. `GET` returns `{ url, expira_em_segundos: 900, codigo_curto }` through `createSignedUrl`.
- Create: `app/api/v1/clinic/lgpd/atestados/conferir/route.ts`. `POST { codigo }` uses `normalizarCodigoCurto` and finds the row by `(org, codigo_curto)`. It returns `{ encontrado: true, atestado: { id, anonimizado_em, emitido_em, executor_nome, algoritmo } }` or `{ encontrado: false }`. Not-found is a 200 with `encontrado: false`.
- Test: `tests/unit/clinic-lgpd-atestados-rotas.test.ts`

**Rules:**
- **Every route** uses `requireRole("admin", { resource: "clinic_atestados_anonimizacao", permiteOrgSuspensa: true })`, takes `orgId` from `authz.org.orgId` only, and uses Zod for the body.
- **All four routes** answer `403` with `fail("feature_disabled", …)` when the flag is off, except `GET [id]`, so certificates already issued stay downloadable after the flag is turned off.
- **The POST:**
  - requires the contact to belong to the org and to be `is_anonymized = true`, else `409 not_anonymized`;
  - uses the contact's `anonymized_at` as `anonimizadoEm`;
  - answers `409 ja_emitido` with the existing id when the certificate already exists.

- [ ] **Step 1: Write the failing tests:**
  - every route answers 403 when the flag is off (except `GET [id]`);
  - the list is filtered by org;
  - verifying a code of another org gives `encontrado: false`;
  - verifying `"abcd ef01 2345 6789"` normalizes and finds the row;
  - an invalid code gives 422;
  - the POST on a non-anonymized contact gives 409;
  - `GET [id]` from another org gives 404.
- [ ] **Step 2:** Run `pnpm vitest run tests/unit/clinic-lgpd-atestados-rotas.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the same command. Expected: PASS. `pnpm typecheck` must exit 0.
- [ ] **Step 5: Commit** with `feat(lgpd): baixar, gerar depois, listar e conferir atestados (#87)`.

### Task 6: UI — flag card, contact page, LGPD page

**Files:**
- Modify: `app/app/settings/tenant/profissionais/_client.tsx` and its `page.tsx`. Add the card "Atestado de anonimização", copying the `tituloLivre` card. Description: "Ao anonimizar um paciente, o sistema gera um atestado em PDF com data, responsável, IP, o que foi apagado e o que foi guardado por lei (prontuário)."
- Modify: `components/contacts/AnonymizeDialog.tsx`. When the response has `atestado.codigo_curto`, show "Atestado gerado — código XXXX-…" with a **Baixar atestado** button. When it has `atestado.erro`, show "Anonimizado. O atestado não foi gerado: <erro>. Gere de novo pela ficha."
- Modify: the contact detail (`app/app/contacts/[id]/_client.tsx`). For an anonymized contact with the flag on, show **Baixar atestado** (if one exists) or **Gerar atestado**. Fetch the existence via `GET /api/v1/clinic/lgpd/atestados?contact_id=` (add that optional filter to the Task 5 GET).
- Modify: `app/app/lgpd/requests/page.tsx`. With the flag on, add two sections above the request table:
  - **Conferir código**: an input plus a button, showing the result;
  - **Atestados emitidos**: a table with date, short code, responsible person and a download button.
- Modify: `lib/i18n/dicionario.ts` with every new string (es/en like the neighbours).
- Test: the Playwright spec `tests/e2e/lgpd-atestado-anonimizacao.spec.ts` against 3001, plus its registration in the CI spec list that `e2e-cobertura-completa` checks.

- [ ] **Step 1:** Write the e2e spec. It must:
  1. log in as the e2e admin;
  2. turn the flag on in Profissionais;
  3. create a fictitious contact through the API ("Contato Teste Atestado");
  4. anonymize it through the dialog;
  5. see the short code;
  6. click download (assert the response is `application/pdf` or a signed URL that returns 200);
  7. open LGPD, paste the code with lowercase and spaces, and see "Atestado encontrado";
  8. paste `0000-0000-0000-0000` and see "Nenhum atestado com este código";
  9. turn the flag off;
  10. save screenshots `evidence/87-atestado-anonimizacao/01..06-*.png`.
- [ ] **Step 2:** Implement the UI.
- [ ] **Step 3:** Run `pnpm typecheck` and `pnpm lint` (exit 0), then `pnpm exec playwright test tests/e2e/lgpd-atestado-anonimizacao.spec.ts` with the 3001 base URL from the existing e2e config. Expected: 1 passed.
- [ ] **Step 4: Commit** with `feat(lgpd): telas do atestado — chave, ficha e conferência (#87)`.

### Task 7: Compliance review, handoff, UPSTREAM

**Files:**
- Create: `docs/tarefas/87-atestado-anonimizacao/handoff.md`, in the #83 handoff format:
  - what changed, in simple Portuguese;
  - how to validate on 3001;
  - the evidence table with a code span plus `<img src="../../../evidence/87-atestado-anonimizacao/NN-….png" width="480">`;
  - Verify;
  - **apply migration 8024 before deploying the code**: without it the routes return 500 only when the flag is read, so check whether `anonymize` is affected and say so plainly.
- Modify: `UPSTREAM.md`. Under the selective absorptions, add "#3321 → idea adapted (clinic in Brazil, retained section); core touched: `app/api/v1/lgpd/anonymize/route.ts`".
- [ ] **Step 1:** The controller dispatches a `health-compliance`-style reviewer over `lib/clinic/lgpd/atestado.ts` (the texts) and over a generated PDF. Apply any wording fixes it returns.
- [ ] **Step 2:** Run the full Verify (`pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:db`), each redirected to a log file. Record the results in the handoff, with the comparison against a clean develop for any failure.
- [ ] **Step 3: Commit** with `docs(lgpd): handoff do atestado de anonimização (#87)`.
