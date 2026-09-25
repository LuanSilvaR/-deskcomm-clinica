# Prontuário — entrega (F0 a F8)

Módulo de atendimento clínico, prontuário e jornada do paciente, em 9 PRs empilhados.
Tudo nasce **desligado** (opção "Prontuário" por clínica); com ela desligada nada muda.

## Ordem de merge (cada PR contém os anteriores)

| Fase | PR | Migration | O que entrega |
|---|---|---|---|
| F0 | #24 | 9016 | Acesso clínico separado da administração; opção `prontuario` |
| F1 | #26 | 9017 | Fila "Meus atendimentos", iniciar e finalizar atendimento |
| F2 | #28 | 9018, 9019 | Anamnese, avaliação, evolução, autosave com versão, adendos, aba Prontuário |
| F3 | #29 | 9020 | Editor de modelos clínicos e requisitos para finalizar |
| F4 | #30 | 9021 | Conduta, plano de tratamento e sessões |
| F5 | #31 | 9022 | Procedimentos realizados, insumos (lote/validade), porta de estoque |
| F6 | #32 | 9023 | Termos e contratos, aceite presencial e por link, uso de imagem |
| F7 | #33 | 9024 | Fotos clínicas e anexos (Storage existente, WebP no navegador, cota) |
| F8 | (este) | 9025 | Reabrir atendimento, exportação imprimível, limites de leitura, cerca do audit |

Mesclar na ordem da tabela (merge, sem rebase). Cada PR, depois do anterior mesclado, mostra só o próprio diff.

## Como ligar numa clínica

1. **Configurações › Opções da clínica**: ligar "Prontuário" (admin; `PATCH /api/v1/clinic/config {"prontuario": true}`).
2. **Profissionais**: quem atende precisa ter ficha ativa em Profissionais e especialidades. No modo de
   papéis legado, só profissional ativo recebe as chaves clínicas; no modo por papéis, atribua um papel
   com as chaves `atendimento.*`, `prontuario.*`, `planos.*`, `fotos.*`, `anexos.*`.
3. **Administrador e suporte não veem conteúdo clínico** sem papel clínico — é intencional.
4. **Modelos clínicos** (Configurações): revisar os formulários e os **termos** (textos-modelo; revisar com
   advogado(a)), e definir os requisitos para finalizar.
5. **Espaço para fotos**: padrão 5 GB por clínica (`settings.clinic.cota_arquivos_mb`).

## Como testar na sua máquina

```bash
git fetch origin
git checkout feature/prontuario-f8   # contém F0–F8
pnpm install
pnpm typecheck && pnpm lint && pnpm cercas
pnpm test:unit
pnpm test:db                          # Postgres efêmero + baseline + invariantes (precisa de Docker)
pnpm test:e2e                         # Supabase local completo
```

Roteiro manual (com a opção ligada):

1. Recepção marca a chegada do paciente → ele aparece em **Meus atendimentos › Aguardando**.
2. **Iniciar atendimento** → anamnese (escolher modelo; "Salvo às…"), avaliação, conduta, plano (gerar da
   conduta, adicionar sessões, ligar uma sessão a um agendamento), procedimento com insumo e lote,
   documento (emitir, colher aceite ou gerar link), foto pela câmera, evolução.
3. **Finalizar** sem evolução → lista do que falta; com ela → finalizado. Tentar editar → só adendo.
4. Abrir o paciente › **Prontuário** (linha do tempo), **Planos**, **Documentos**, **Fotos e anexos**.
5. Gerência clínica: **Reabrir atendimento** (motivo) e **Exportar / imprimir prontuário**.
6. Abrir o link do termo numa janela anônima, responder cada opção e aceitar; o link não abre de novo.

## Decisões registradas

- Regras críticas no banco (funções `fn_clinic_*` com `fn_acesso_exigir`, triggers de imutabilidade); a
  organização vem sempre da sessão, nunca do corpo; RLS de leitura clínica sem atalho de platform admin.
- Audit só com metadados (`tests/unit/clinic-auditoria-sem-conteudo-clinico.test.ts` reprova texto clínico).
- Nada clínico é apagado: registro errado é anulado com motivo; correção é adendo; termo aceito é revogado
  com um registro novo. A anonimização LGPD não apaga prontuário (guarda legal).
- Estoque ainda não é por movimentos: procedimentos confirmados viram evento `clinic.procedimento_confirmado`
  e a porta `SemEstoque` só o marca como lido (`lib/clinic/estoque/porta.ts`).
- Arquivos no Storage que a instalação já tem (`clinical-files`, privado, sem policy); trocar para R2/B2 é
  outra implementação de `lib/clinic/anexos/armazenamento.ts`.
