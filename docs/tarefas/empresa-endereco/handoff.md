# Handoff — telefone e endereço da empresa (Configurações › Organização)

Plano: [`plano.md`](plano.md) (PR #112). Branch: `feature/empresa-endereco`.

## O que entrou
- **Migration 8011 (tripla):**
  - `supabase/migrations/20261107220000_8011_clinic_empresa_endereco.sql`;
  - linha no `MANIFEST.md`;
  - apêndice no `baseline.sql`, logo depois da 8005.
  - **Colunas** (9, aditivas e anuláveis em `organizations`): `contact_phone`, `address_cep`, `address_street`, `address_number`, `address_complement`, `address_district`, `address_city`, `address_uf`, `address_city_ibge_code`.
  - **CHECKs**, que só valem com valor: telefone com 10 a 13 dígitos, CEP com 8, UF com 2 letras maiúsculas, IBGE com 7.
- **Tela:** seção **Contato e endereço** no cartão "Dados da empresa", salva pelo mesmo **Salvar**. O CEP completo preenche logradouro, bairro, cidade, UF e IBGE (oculto) e leva o foco ao Número.
- **Validação (`tenantSchema`):**
  - telefone e CEP viram só dígitos;
  - UF vai para maiúsculas;
  - vazio vira `null`;
  - os erros têm mensagem própria ("Telefone com DDD.").
- **`updateTenant`:** grava só as chaves que vieram. Quem não conhece os campos não apaga o endereço.
- **Refatoração:**
  - a consulta de CEP saiu da `FichaDoPaciente` para o hook `hooks/clinic/useEnderecoPeloCep.ts`, usado pelas duas telas;
  - a rota `/api/v1/clinic/cep/[cep]` não mudou.
- **Espanhol** dos textos novos em `lib/i18n/dicionario.ts`.
- **Núcleo** registrado no `UPSTREAM.md`.

## Testes
- `tests/unit/tenant-schema-contato-endereco.test.ts`: normalização e recusas.
- `tests/unit/organizacao-preenche-endereco-pelo-cep.test.tsx`: o CEP preenche, o aviso de não encontrado e o Salvar normalizado.
- `tests/unit/ficha-preenche-endereco-pelo-cep.test.tsx` (já existia): verde depois da extração do hook.
- `tests/invariants/clinic-empresa-endereco.test.ts`: colunas e CHECKs no baseline (install e update).
- `tests/e2e/settings-organizacao-endereco.spec.ts`: pela tela, com a rota de CEP simulada. Está no `e2e.yml`, PARTE_3, ao lado da `moeda-da-organizacao`.

## Evidência (spec e2e)
- `evidence/empresa-endereco/1-cep-preenche-endereco.png`
- `evidence/empresa-endereco/2-salvo-e-recarregado.png`
- `evidence/empresa-endereco/3-cep-nao-encontrado.png`

## Próximo passo sugerido
Marcadores `clinica.telefone`, `clinica.endereco` e `clinica.cnpj` no texto do contrato e dos documentos. Eles completam a cláusula "CNPJ e responsável técnico" pedida na revisão do #111.
