# upstream-paciente-endereco — handoff (#86, upstream #3670)

O fork já guarda o endereço do paciente em `clinic_patient_profiles` (9002), com tela e anonimização; as colunas do upstream em `contacts` não foram absorvidas (duplicariam a fonte).

| Critério | Como ficou | Prova |
|---|---|---|
| 1 | Ficha com endereço (CEP, logradouro, número, complemento, bairro, cidade, UF, IBGE) | já existia (9002) |
| 1 (comentário do dono, 2026-11-05) | CEP completo preenche logradouro, bairro, cidade, UF e IBGE sozinho, sem clique; foco vai para o Número | `tests/unit/ficha-preenche-endereco-pelo-cep.test.tsx`, `lib/clinic/pacientes/cep.test.ts` + tela |
| 1 (comentário) | CEP não encontrado ou serviço fora do ar → aviso, e o endereço continua editável à mão | mesmos testes + tela |
| 2 | Campos opcionais para agendar | sem mudança |
| 3 | Endereço no export LGPD (seção "Ficha do paciente", RG mascarado) | `tests/unit/clinic-lgpd-export-ficha.test.ts` |

Consulta do CEP: `GET /api/v1/clinic/cep/:cep` (`pacientes.editar_ficha`), no servidor — ViaCEP e, se falhar, BrasilAPI (tempo-limite 4 s cada). Só o CEP sai para o serviço externo.

Medido na 3001 (2026-11-05, paciente fictício, sem salvar):
```
ANTES:  {"log":"","bairro":"","cidade":"","uf":""}
DEPOIS: {"log":"Avenida Paulista","bairro":"Bela Vista","cidade":"São Paulo","uf":"SP","ibge":"3550308"}
foco no Número: ficha-numero
aviso (99999999): CEP não encontrado. Confira o número ou preencha o endereço à mão.
```
Sabotagem: sem o `onChange` do CEP, `ficha-preenche-endereco-pelo-cep.test.tsx` fica 3/3 vermelho.

### Evidências de tela
- CEP 01310-100 preencheu o endereço — `evidence/upstream-lote2/86-1-cep-preenche-endereco.png`
- CEP inexistente: aviso e preenchimento à mão — `evidence/upstream-lote2/86-2-cep-nao-encontrado.png`
