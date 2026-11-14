# Procedimentos e POP — entrega (etapas 1 a 5)

Catálogo de procedimentos da clínica, ligado aos profissionais e especialidades que já existem, e um
**POP (Procedimento Operacional Padrão)** por procedimento: um documento versionado, aprovado, auditável
e imprimível em A4 com a identidade da clínica. Tudo nasce **desligado** (opção "Procedimentos e POP").

## Etapas

| Etapa | PR | Migration | O que entrega |
|---|---|---|---|
| 1 | #25 | 9015 | Tabelas `clinic_procedures`, vínculos com especialidades e profissionais, `clinic_pops`, `clinic_pop_versions`, RLS, imutabilidade, RPCs e as 6 permissões |
| 2 | #27 | — | Telas e APIs de procedimentos, coerência profissional × especialidade, opção por clínica, porta no menu |
| 3 | #36 | — | Editor do POP (Tiptap), modelo padrão ou em branco, salvamento automático com trava otimista, aprovação, nova versão (1.1 ou 2.0) e histórico |
| 4 | #39 | — | PDF A4: bloco documental na 1ª página, cabeçalho compacto nas seguintes, rodapé paginado e faixa de versão não vigente |
| 5 | este | — | Editor acessível pelo teclado, modelo em espanhol, capturas e esta documentação |

## Como ligar numa clínica

1. **Configurações › Profissionais**: ligar "Procedimentos e POP" (administrador).
2. **Procedimentos** (menu): cadastrar o procedimento, as especialidades e os profissionais. Só aparece
   quem tem ao menos uma das especialidades do procedimento.
3. Aba **POP**: "Usar modelo padrão" (21 seções) ou "Documento em branco". O texto salva sozinho.
4. **Aprovar** exige `pops.aprovar` (chave crítica, separada de editar). Aprovada, a versão é imutável;
   mudança é **Nova versão** com motivo (1.0 → 1.1, ou 2.0 com "Revisão maior").
5. **Imprimir** abre o PDF da versão. Versão substituída ou rascunho sai com a faixa "NÃO VIGENTE".

## Permissões

| Chave | Nível base | Para quê |
|---|---|---|
| `procedimentos.ver` | viewer | lista e cadastro |
| `procedimentos.gerenciar` | manager | criar, editar, ativar e vincular |
| `pops.ver` | viewer | POP vigente e histórico |
| `pops.editar` | manager | criar, editar rascunho, nova versão, descartar |
| `pops.aprovar` | manager | aprovar (crítica) |
| `pops.imprimir` | viewer | PDF |

## Editor pelo teclado (etapa 5)

- **Alt+F10** leva do texto à barra de formatação; **setas**, **Home** e **End** andam entre os botões
  (só um fica no Tab); **Esc** volta ao texto. A dica aparece abaixo do texto e é lida pelo leitor de tela.
- Atalhos do texto: Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+Alt+1/2/3 (títulos), Ctrl+Alt+0 (parágrafo),
  Ctrl+Shift+8/7 (listas), Ctrl+Z / Ctrl+Shift+Z. Cada botão anuncia o seu (`aria-keyshortcuts`).
- O estado de cada botão (`aria-pressed`) acompanha o cursor; no celular os botões têm 44 px.

## Idioma

A interface segue o idioma de quem usa (português ou espanhol). O **modelo padrão** entra no idioma de
quem cria o POP; depois disso o documento é da clínica e não muda de idioma.

## Como testar

```bash
pnpm typecheck && pnpm lint
pnpm exec vitest run tests/unit/clinic-pop-documento.test.ts tests/unit/clinic-pop-impressao.test.ts tests/unit/clinic-procedimentos-coerencia.test.ts
pnpm test:db     # tests/invariants/clinic-procedimentos-e-pop.test.ts (isolamento entre empresas, imutabilidade, aprovação)
pnpm exec playwright test tests/e2e/clinic-procedimentos.spec.ts tests/e2e/clinic-pop.spec.ts
```

## Decisões registradas

- O conteúdo do POP é **um documento** (JSON do editor) de uma lista fechada de blocos, validado no
  servidor: sem HTML e sem links, então não há XSS por construção. Os metadados (código, versão, status,
  quem e quando) vêm só do banco.
- A versão aprovada nunca muda nem é apagada (trigger); a futura ligação com o atendimento vai apontar
  para a versão usada.
- O PDF usa só a marca já cadastrada (nome, razão social, CNPJ, endereço, cor e logo PNG/JPG do
  bucket da própria empresa). Telefone, site e e-mail da clínica não existem no cadastro.

## Pendências (backlog)

- Comparar duas versões do POP lado a lado.
- Telefone, site e e-mail da clínica no cadastro, para o cabeçalho do PDF.
- Ligar o POP ao procedimento realizado no atendimento (`pop_version_id`).
- Migrations 9002–9027 em produção: aplicadas pelo dono, com backup.
