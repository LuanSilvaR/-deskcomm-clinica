# Handoff — tamanho ideal do logo e favicon da empresa (Configurações › Marca)

Branch: `feature/marca-favicon`. Migration **8012**.

## Pedido
- Melhorar a apresentação das informações do logo, com o tamanho ideal para colocar no sistema.
- Acrescentar o upload do favicon.

## O que entrou

### Logo: tamanho ideal (`components/branding/CampoDeLogo.tsx`, `lib/clinic/marca/logo-ideal.ts`)
- **Caixa "Tamanho ideal":** 640 × 112 px, horizontal, PNG com fundo transparente. A regra vem do lugar onde o logo aparece: a barra lateral desenha com 28 px de altura e até 160 px de largura, e o arquivo ideal é 4× isso.
- **Prévia "Tamanho real no menu lateral":** mostra o arquivo em vigor no tamanho exato da barra.
- **Avisos pelo tamanho REAL do arquivo,** lido pelo navegador:
  - baixo demais fica borrado;
  - largo demais encolhe;
  - quadrado ou vertical sugere a versão horizontal e o campo Favicon.
- **Só orientação:** não bloqueia o envio.

### Favicon
- **Migration 8012 (tripla):** `fn_clinic_definir_favicon(uuid, uuid, text)`.
  - Definer volátil, executada só pelo `service_role`.
  - Grava ou apaga `settings.clinic.favicon_path`.
  - Recusas: fora do prefixo da organização ou não-PNG dá 22023; quem não é admin dá 42501.
  - **Fora de `settings.branding` de propósito:** `fn_definir_marca_da_organizacao` regrava aquele objeto preservando só `logo_path`, então o favicon sumiria a cada "Salvar".
- **Rota `POST/DELETE /api/v1/clinic/marca/favicon`:**
  - mesmos gates da rota do logo: suporte de escrita, sessão, organização ativa, admin, MFA e teto de trocas;
  - mesmo bucket `brand-logos`, com caminho `<org>/<uuid>.png` não-enumerável;
  - SVG é recusado.
- **Régua do arquivo (`lib/clinic/marca/favicon.ts`):**
  - só PNG, quadrado, de 32 a 1024 px, até 256 KB;
  - o tamanho é lido do cabeçalho IHDR, sem decodificar a imagem;
  - a mensagem diz o tamanho enviado e o ideal, 512 × 512.
- **Tela (`components/clinic/marca/CampoDeFavicon.tsx`):**
  - cartão "Ícone da aba (favicon)" com caixa de tamanho ideal;
  - prévia que imita a aba do navegador (clara e escura, ícone em 16 px) e uma versão ampliada;
  - o envio é imediato, como o do logo;
  - o "De onde vem cada coisa" ganhou a linha Favicon.
- **Aba de verdade:** `generateMetadata` em `app/app/layout.tsx`, com `lib/clinic/marca/favicon-servidor.ts`.
  - Põe o favicon da empresa no `<head>` de todo `/app`.
  - Sem favicon próprio, vale o `/icon` da raiz.
  - Não faz requisição de saída: só monta a URL pública do Storage do próprio projeto.

## Testes
- `tests/unit/marca-favicon-e-logo-ideal.test.ts`: régua do PNG, ponteiro e avaliação do logo.
- Os testes do logo que já existiam continuam verdes:
  - `campo-de-logo-marca-hidratacao`;
  - `logo-nao-some-no-tema-escuro`;
  - `marca-previa-do-logo-sem-refresh`;
  - `marca/logo/route.test`.
- `tests/invariants/clinic-marca-favicon.test.ts`, mais `marca-logo` e `hardening-definer-varredura`.
- `tests/e2e/clinic-marca-favicon.spec.ts`: está no `e2e.yml`, PARTE_3.

## Evidência (spec e2e)
- `evidence/marca-favicon/1-favicon-na-aba-simulada.png`
- `evidence/marca-favicon/2-favicon-retangular-recusado.png`

## Limites conhecidos
- **A tela de entrada (login) segue com o ícone da instalação:** ali ainda não se sabe de qual empresa a pessoa é. É o mesmo limite do logo.
- **Lixo no Storage:** o arquivo antigo do favicon é apagado ao trocar ou remover. Se a remoção falhar, fica um órfão no bucket, com aviso no log, igual ao logo.
