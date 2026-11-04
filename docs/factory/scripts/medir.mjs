#!/usr/bin/env node
// Mede uma sessão `claude -p --output-format stream-json --verbose` gravada em .jsonl.
// Uso: node docs/factory/scripts/medir.mjs <arquivo.jsonl> [mais.jsonl...]
// Saída: uma linha JSON por arquivo. Só lê; não grava nada.
import { readFileSync } from "node:fs";
import { basename } from "node:path";

for (const arquivo of process.argv.slice(2)) {
  const ferramentas = {};
  const subagentes = [];
  const leituras = {};
  let resultado = null;
  for (const linha of readFileSync(arquivo, "utf8").split("\n")) {
    if (!linha.trim().startsWith("{")) continue;
    let ev;
    try {
      ev = JSON.parse(linha);
    } catch {
      continue;
    }
    if (ev.type === "result") resultado = ev;
    if (ev.type !== "assistant") continue;
    for (const bloco of ev.message?.content ?? []) {
      if (bloco.type !== "tool_use") continue;
      ferramentas[bloco.name] = (ferramentas[bloco.name] ?? 0) + 1;
      if (bloco.name === "Agent" || bloco.name === "Task")
        subagentes.push(bloco.input?.subagent_type ?? "general-purpose");
      if (bloco.name === "Read" && bloco.input?.file_path) {
        const k = `${bloco.input.file_path}#${bloco.input.offset ?? 0}`;
        leituras[k] = (leituras[k] ?? 0) + 1;
      }
    }
  }
  const u = resultado?.usage ?? {};
  process.stdout.write(
    JSON.stringify({
      arquivo: basename(arquivo),
      ok: resultado ? !resultado.is_error : false,
      custo_usd: resultado?.total_cost_usd ?? null,
      duracao_s: resultado ? Math.round(resultado.duration_ms / 1000) : null,
      turnos: resultado?.num_turns ?? null,
      tokens_entrada: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
      tokens_saida: u.output_tokens ?? 0,
      modelos: Object.keys(resultado?.modelUsage ?? {}),
      chamadas: Object.values(ferramentas).reduce((a, b) => a + b, 0),
      ferramentas,
      subagentes,
      leituras_repetidas: Object.values(leituras).filter((n) => n > 1).length,
    }) + "\n",
  );
}
