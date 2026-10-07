---
name: headroom
description: 'Guia do Headroom (headroomlabs-ai/headroom, Apache-2.0): compressão LOCAL do contexto que o Claude Code manda ao modelo, para gastar menos tokens. Use quando alguém quiser economizar tokens ou custo do Claude Code, perguntar "como gasto menos", "o contexto estourou", "headroom wrap", ou quiser ligar o MCP do Headroom. Liga sempre com a telemetria desligada e nunca com dado real de paciente.'
metadata:
  publico: quem desenvolve o projeto com Claude Code
  escopo: ferramenta da máquina de quem desenvolve; não faz parte do app nem da instalação da clínica
---

# Headroom — gastar menos tokens no Claude Code

O Headroom fica entre o Claude Code e o provedor do modelo e **comprime o contexto na sua máquina**
(JSON grande, saídas de ferramenta, código) antes de enviar. Não é skill de conteúdo nem parte do CRM:
é uma ferramenta de quem desenvolve. Projeto: https://github.com/headroomlabs-ai/headroom (Apache-2.0).

## Regras deste projeto (valem antes de qualquer comando)
1. **Telemetria sempre desligada.** O Headroom manda um "beacon" anônimo por padrão (taxas de compressão,
   modelo, sistema — sem prompt nem código). Aqui ele fica desligado:
   `export HEADROOM_BEACON=off` e `export DO_NOT_TRACK=1` (ou a flag `--offline`).
2. **Nunca com dado real de paciente.** A compressão é local, mas TODO o tráfego do Claude Code passa pelo
   proxy. Não abra dump de banco, exportação de prontuário ou planilha de paciente numa sessão com o
   Headroom (nem sem ele — regra 8 do CLAUDE.md).
3. **Chave de API só no ambiente**, nunca em arquivo versionado.
4. **Revisões sem compressão.** Em `security-lgpd`, `health-compliance` e revisão de migration o contexto
   completo importa: rode o Claude Code sem o Headroom (`headroom unwrap claude`). Se uma resposta parecer
   ter "perdido" um trecho de arquivo ou de log, repita sem o proxy antes de confiar nela.

## Instalar (uma vez por máquina, Python 3.10+)
```bash
uv tool install --python 3.13 "headroom-ai[all]"   # isolado (recomendado)
# ou
pip install "headroom-ai[all]"
headroom update --check                             # confere se há versão nova
```

## Usar com o Claude Code
```bash
export HEADROOM_BEACON=off DO_NOT_TRACK=1
headroom wrap claude          # sobe o proxy local e passa o Claude Code por ele
```
Opções úteis (conforme a documentação do Headroom):
- `--mode cache` — não injeta memória automática; preserva o cache de prompt do provedor (bom padrão aqui);
- `--code-memory none` — não cria a memória de código;
- `--1m` — mantém o seletor de contexto de 1M do Claude;
- `--memory`, `--code-graph`, `--tool-search` — recursos extras; ligue um de cada vez e compare.

Desligar: `headroom unwrap claude`. Parar o proxy avulso: `Ctrl+C`.

## MCP opcional (só na sua máquina)
O servidor MCP expõe `headroom_compress`, `headroom_retrieve` e `headroom_stats`. Ele **não** está ligado
no repositório — cada pessoa liga se quiser:
```bash
headroom mcp install
```
ou copie `assets/mcp.exemplo.json` para a configuração MCP do SEU usuário (não para um `.mcp.json` na raiz
do repositório, que ligaria para todo mundo). Se o cliente não achar o comando, troque `"headroom"` pelo
caminho de `command -v headroom`.

## Conferir se está valendo a pena
`headroom_stats` (pelo MCP) ou o resumo que o `wrap` mostra ao sair. Se a economia for pequena no seu
fluxo, desligue — menos peças no caminho é menos coisa para dar errado.
