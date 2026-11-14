---
impacto: nada_mudou
secao: adicionado
titulo: Clínica de demonstração para testar o sistema
---

Quem desenvolve ou avalia o sistema pode criar, num banco LOCAL, uma clínica de demonstração com pacientes fictícios, agenda, atendimentos já finalizados, estoque com lotes e sete usuários de perfis diferentes (dono, médica, dentista, biomédica, enfermeiro, recepção e compras): `npx tsx scripts/seed-demo-clinica.ts`. Nada muda numa instalação em uso — o script não roda sozinho e recusa banco remoto sem confirmação. Guia em `docs/demo-clinica.md`.
