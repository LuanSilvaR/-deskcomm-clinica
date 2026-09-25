# Prontuário — entrega (F0 a F10)

Módulo de atendimento clínico, prontuário e jornada do paciente, em 11 PRs empilhados.
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
| F8 | #34 | 9025 | Reabrir atendimento, exportação imprimível, limites de leitura, cerca do audit |
| F9 | #35 | 9026 | Cabeçalho clínico (alergias/alertas com histórico, plano ativo, último/próximo), anular atendimento aberto por engano, filtros da linha do tempo, PDF gerado no servidor, link do termo pelo WhatsApp |
| F10 | (este) | 9027 | Correções das revisões de segurança/LGPD e de conformidade de saúde (abaixo) |

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
git checkout feature/prontuario-f10  # contém F0–F10
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
5. Gerência clínica: **Reabrir atendimento** (motivo), **Exportar / imprimir prontuário** e **Baixar PDF**.
6. No topo do atendimento e do Prontuário: **Editar alergias e alertas** (cada mudança fica no histórico);
   filtros **De / Até / Profissional / Plano** na linha do tempo.
7. Atendimento iniciado por engano (ainda sem registros): **Anular atendimento** com motivo; a visita volta
   para "pronto". Com qualquer registro, o banco recusa — finalize e corrija por adendo.
8. Termo: **Gerar link** → **Enviar pelo WhatsApp** abre o WhatsApp do aparelho com uma mensagem genérica.
9. Abrir o link do termo numa janela anônima, responder cada opção e aceitar; o link não abre de novo.

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
- Desempenho: `tests/invariants/clinic-linha-do-tempo-indices.test.ts` roda EXPLAIN (com `enable_seqscan =
  off`) em cada consulta da linha do tempo e reprova se alguma não tiver índice que a atenda.
- PDF: gerado no servidor com `@react-pdf/renderer` (já era dependência), só texto, fuso da clínica,
  `Cache-Control: private, no-store`, mesmo limite e auditoria da exportação imprimível.
- WhatsApp: `wa.me` no aparelho de quem atende (sem integração nova); a mensagem não leva nome do termo nem
  conteúdo clínico.

## Revisões (security-lgpd e health-compliance) — o que foi corrigido na F10

Nenhum bloqueante de segurança. Um bloqueante de conformidade. Tudo abaixo foi corrigido e provado em
`tests/invariants/clinic-revisao-conformidade.test.ts` (e nos testes das fases que o achado tocava).

| Achado | Correção |
|---|---|
| Prontuário, impressão e PDF sem o registro do profissional no conselho (CFM 1.638/2002) | Cada atendimento e cada adendo mostram "Nome — CRM 12345/SP" (`lib/clinic/profissionais/conselho.ts`). **Complete o conselho de cada profissional em Profissionais.** |
| Suporte (impersonação) via termos com dado de saúde | Suporte não recebe mais `documentos.*` |
| Termo de imagem vencido continuava marcando a foto | A leitura revalida (`fn_clinic_divulgacao_vigente`); vencida aparece como "só uso clínico" |
| Canal de divulgação não conferido | A foto guarda os canais; o banco confere finalidade E canal no termo aceito |
| Termo de imagem com opção obrigatória | Recusado (consentimento livre, LGPD art. 8º) |
| DELETE direto apagava atendimento em cascata | Recusado até para o superusuário; service_role sem DELETE; exclusão da empresa continua |
| Leituras de cabeçalho, termos, planos e fotos sem limite nem auditoria | Mesmo limite por pessoa e `clinic.prontuario_visto` com a área |
| Upload antes de conferir paciente e cota | Confere antes de subir |
| IP e origem do link lidos da requisição | IP pela régua do repo (`lib/http/ip-do-cliente.ts`); link com `NEXT_PUBLIC_APP_URL` |
| Motivo da anulação visível à recepção | Visita recebe motivo fixo; o texto fica só no evento clínico |
| Insumo sem registro ANVISA | Campo opcional "Reg. ANVISA" no insumo, na impressão e no PDF |
| Anonimização × guarda de 20 anos | Provado: anonimizar preserva prontuário, fotos e termos; apagar o contato é recusado |

**Decisões da clínica (não são código):** revisar com advogado(a) o texto dos termos e contratos;
definir qual conselho pode executar qual procedimento (o sistema mostra o conselho, não trava);
avaliar assinatura mais forte (Lei 14.063, nível avançado) para contratos de valor alto. Administrador e
recepção continuam vendo os termos (recepção emite e colhe aceite).
