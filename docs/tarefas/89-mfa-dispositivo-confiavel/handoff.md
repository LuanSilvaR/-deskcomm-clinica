# #89 — Confiar neste dispositivo por 30 dias (verificação em duas etapas)

Issue: https://github.com/LuanSilvaR/-deskcomm-clinica/issues/89 · Épico #78 · Upstream #3200 (porte manual)

## O que a clínica ganha
O computador fixo da recepção não precisa digitar o código do autenticador a cada login. Ao digitar o código, a pessoa
marca **"Confiar neste dispositivo por 30 dias"**. Naquele navegador o código não é pedido de novo por 30 dias.

**Desligado por padrão.** O admin liga em **Configurações › Segurança › Confiar no dispositivo**. Ligar exige ter
digitado o código nesta sessão.

## Como funciona (e por que é seguro)
- O navegador recebe um cookie `httpOnly` com um token aleatório; o banco guarda só o **hash** (`mfa_trusted_devices`).
  A tabela é fechada para o app: só o servidor (service_role) grava.
- No login com senha, se o cookie bate com uma linha **do mesmo usuário e do mesmo fator, no prazo**, a sessão nova é
  marcada e o banco (`fn_session_mfa_proven`) passa a considerá-la provada.
- **Fator removido** (por qualquer caminho) derruba a confiança. **Prazo vencido** não prova nada.
- **Admin da plataforma nunca** usa dispositivo confiável, nem no banco nem no app. As rotas `/api/v1/admin/**` exigem
  o código (`mfaEmDividaEstrita`).
- Quem participa de **várias empresas** só pode confiar se **todas** permitirem.
- **Desligar** a opção na empresa apaga na hora os dispositivos dos membros.
- **Trocar a senha** e **"Sair de todas as sessões"** apagam os dispositivos da pessoa.
- Em **Segurança › Dispositivos confiáveis** a pessoa vê os navegadores confiáveis e pode **esquecer todos**.
- Qualquer erro ao perguntar ao banco = **pede o código** (falha fechado).

## Migration
**8022** (upstream 0747): a tabela e o `fn_session_mfa_proven` com a cláusula do dispositivo, executável por
`authenticated`. A parte do upstream que mexia em `fn_lgpd_anonymize_contact` **ficou de fora**, porque o fork tem a
própria versão.

## Testes
- Banco: `tests/invariants/mfa-dispositivo-confiavel.test.ts`, 8 casos:
  - os 7 do upstream: tabela fechada, sessão amarrada, fator removido, prazo vencido, outra pessoa, quem executa;
  - mais o do fork: o admin da plataforma não fica provado.
- Unit: `lib/auth/dispositivo-confiavel.test.ts` (7). Os 33 arquivos de login, MFA e segurança estão verdes; contagens
  de `rpc` e mocks foram atualizados onde o `mfaEmDivida` passou a perguntar ao banco.

## Como validar na 3001
1. Entre como admin, com a verificação em duas etapas já ativa.
2. Vá a **Configurações › Segurança** e marque **"Permitir confiar no dispositivo"**. Se o sistema pedir, digite o código
   antes.
3. Saia e entre de novo. Na tela do código aparece a caixa **"Confiar neste dispositivo por 30 dias"**. Marque **antes**
   de digitar, porque o código envia sozinho no 6º dígito.
4. Saia e entre de novo: **o código não é pedido**.
5. Em **Segurança › Dispositivos confiáveis** aparece o navegador. Clique em **"Esquecer todos os dispositivos"**, saia e
   entre: o código volta a ser pedido.
6. Desmarque **"Permitir confiar no dispositivo"**: os dispositivos somem e o código volta a ser pedido para todos.
