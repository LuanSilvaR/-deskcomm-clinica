# Telefone e endereço da empresa (com CEP) em Configurações › Organização

## Contexto
Hoje a tela **Configurações › Organização** (`app/app/settings/tenant`) guarda só o nome de exibição, a razão social, o CNPJ, o DPO, o fuso, o idioma, a moeda, o país, a retenção e a URL de privacidade. A clínica **não tem onde cadastrar telefone de contato nem endereço**. Esses dados também são o que falta para a cláusula "CNPJ e responsável técnico" do contrato (revisão do #111) e para a nota fiscal (código IBGE).

O pedido:
- incluir **telefone de contato** e **endereço completo com CEP** no cartão "Dados da empresa";
- ao digitar o CEP, o endereço se completa sozinho, **igual à ficha do paciente** (#86/#102).

Decisões tomadas:
- os dados ficam em **colunas novas em `organizations`**: mudança no núcleo, registrada no `UPSTREAM.md`;
- o plano vai para o git como **branch + commit + PR de documentação**.

## Branches
- **Plano:** `feature/empresa-endereco-plano` a partir de `origin/develop`, numa worktree própria (`../wt-empresa-endereco`). Commit de `docs/tarefas/empresa-endereco/plano.md` (este plano), push e PR de docs para a `develop`, no padrão do #106.
- **Implementação:** `feature/empresa-endereco` a partir de `origin/develop`, na mesma worktree, com um PR próprio.
- **Migration nº 8011.** As 8006–8010 já estão reservadas pelos PRs empilhados #107–#111. Antes de criar, conferir de novo o maior 8xxx da develop e dos PRs abertos.

## Banco: migration tripla 8011
Arquivo `supabase/migrations/<ts>_8011_clinic_empresa_endereco.sql`, mais a linha no `MANIFEST.md` e o apêndice idempotente no fim de `supabase/baseline.sql`.

Colunas **aditivas e anuláveis** (`add column if not exists`) em `public.organizations`:
- `contact_phone text`: só dígitos;
- `address_cep text`: CHECK de 8 dígitos;
- `address_street`, `address_number`, `address_complement`, `address_district`, `address_city`;
- `address_uf text`: CHECK `^[A-Z]{2}$`;
- `address_city_ibge_code text`: CHECK de 7 dígitos.

Os nomes seguem os campos da ficha do paciente (`street`, `number`, `complement`, `district`, `city`, `uf`, `city_ibge_code`).
- Os CHECKs só valem quando há valor: `col is null or col ~ ...`. Colunas novas e vazias não quebram o `update.sh`.
- Nenhuma policy nova. A leitura já está coberta pela RLS de `organizations`, e a escrita continua pelo admin client do `updateTenant`, com o gate de papel admin.

## Aplicação (núcleo, registrar no UPSTREAM.md)
1. **`lib/schemas/settings.ts` › `tenantSchema`:**
   - campos opcionais e anuláveis, com `""` virando `null` (mesmo padrão do `cnpj`);
   - telefone normalizado para dígitos, de 10 a 13;
   - CEP normalizado com `normalizarCep` (`lib/clinic/pacientes/cep.ts`);
   - UF em maiúsculas.
2. **`app/actions/settings/updateTenant.ts`:** grava as novas colunas no mesmo `update`. A auditoria segue o padrão atual.
3. **`app/app/settings/tenant/page.tsx`:** acrescenta as colunas no `select` e no `initial`.
4. **`app/app/settings/tenant/_form.tsx`:** nova seção "Contato e endereço" no mesmo cartão, salva pelo mesmo botão **Salvar**:
   - telefone, CEP, logradouro, número, complemento, bairro, cidade e UF;
   - código IBGE oculto, preenchido pelo CEP.

## Refatoração: reaproveitar o CEP da ficha do paciente
- Extrair a lógica `aoMudarCep` de `components/clinic/FichaDoPaciente.tsx` (linhas ~137–222) para um hook `hooks/clinic/useEnderecoPeloCep.ts`. O hook mantém o que existe hoje:
  - `ultimoCep` evita repetir a consulta e descarta resposta velha;
  - "só substitui o que o serviço trouxe";
  - avisos de "não encontrado" e "indisponível";
  - foco no campo número.
- A ficha do paciente e o formulário da organização passam a usar o mesmo hook.
- A rota `GET /api/v1/clinic/cep/[cep]` e `consultarCep` são **reaproveitadas sem mudança**. O admin já tem `pacientes.editar_ficha`, então não há rota nova.
- Textos novos em `lib/i18n/dicionario.ts`, como no #102.

## Testes
- **Unit:**
  - `tenantSchema`: telefone e CEP normalizados, UF inválida recusada, vazio vira `null`;
  - `tests/unit/organizacao-preenche-endereco-pelo-cep.test.tsx`, no modelo de `tests/unit/ficha-preenche-endereco-pelo-cep.test.tsx`.
- **A regressão da ficha** é guardada pelo teste que já existe (`ficha-preenche-endereco-pelo-cep.test.tsx`), que deve continuar verde depois da extração do hook.
- **`pnpm test:db`:** invariante que confere as colunas e os CHECKs no baseline, em install e em update.
- **e2e:** `tests/e2e/settings-organizacao-endereco.spec.ts`, contra a 3001. Faz login como admin, digita o CEP com a rota de CEP simulada por `page.route` (sem internet), confere o endereço preenchido, salva, recarrega e confere que ficou gravado. Tira prints para `evidence/` (citados no handoff).

## Arquivos críticos
`supabase/migrations/…_8011_…sql`, `supabase/MANIFEST.md`, `supabase/baseline.sql`, `lib/schemas/settings.ts`, `app/actions/settings/updateTenant.ts`, `app/app/settings/tenant/{page,_form}.tsx`, `hooks/clinic/useEnderecoPeloCep.ts` (novo), `components/clinic/FichaDoPaciente.tsx`, `lib/i18n/dicionario.ts`, `UPSTREAM.md`, `docs/tarefas/empresa-endereco/{plano,handoff}.md`.

## Fora do escopo (próximo passo sugerido)
- Marcadores `clinica.telefone` e `clinica.endereco` no texto do contrato e dos documentos. Eles completam a cláusula "CNPJ e responsável técnico" do #111.

## Verificação
1. `pnpm lint`, `pnpm typecheck` e `pnpm test:unit`. Falha só conta como "sem regressão" se o mesmo arquivo falhar na develop limpa.
2. `pnpm test:db` (Docker ligado).
3. Aplicar a 8011 no Supabase local, depois de um backup com `pg_dump`. Subir `pnpm dev -p 3001` na worktree e rodar a spec e2e.
4. **Validação manual:** entrar como `dono@clinica-demo.test` › Configurações › Organização, digitar o CEP `01310-100`, ver a Av. Paulista se preencher, completar o número, salvar e recarregar.
5. **Git:**
   - PR de docs (plano) para a `develop`;
   - depois, PR de implementação com o exit code e o resumo no corpo;
   - conferir `gh pr checks` (o job `verify-parte (3)` cobre o `cercas`).
