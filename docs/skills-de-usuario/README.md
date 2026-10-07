# Skills de usuário (ferramentas de quem desenvolve)

As skills desta pasta NÃO são carregadas pelo projeto: `.agents/skills` (espelhada em `.claude/skills`) é
reservada aos guias do produto, e `tests/unit/skills-embutidas.test.ts` cuida disso. Estas são ferramentas da
máquina de quem desenvolve — cada pessoa instala no próprio perfil do Claude Code, se quiser.

| Skill | Para quê | Instalar |
|---|---|---|
| `headroom` | Gastar menos tokens no Claude Code com o Headroom (compressão local), com telemetria desligada e sem dado de paciente | `mkdir -p ~/.claude/skills && cp -r docs/skills-de-usuario/headroom ~/.claude/skills/` |

Depois de copiar, abra uma sessão nova do Claude Code: a skill aparece na lista e aciona sozinha quando o
assunto for economia de tokens (ou chame com `/headroom`).
