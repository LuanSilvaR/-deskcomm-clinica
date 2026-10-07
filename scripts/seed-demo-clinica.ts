/**
 * Clínica de DEMONSTRAÇÃO — cria uma empresa com dados 100% fictícios e sete
 * usuários (dono, médica, dentista, biomédica, enfermeiro, recepção, compras)
 * para testar o sistema pela tela: agenda, atendimento, prontuário, estoque,
 * NF-e, alertas e relatórios.
 *
 * NÃO é migration: migration roda em toda instalação (inclusive produção) e
 * levaria usuários com senha conhecida e pacientes falsos para lá. Este script
 * só roda quando chamado e, se o banco não for local, exige confirmação.
 *
 * Uso (no banco LOCAL, com .env.local apontando para o Supabase local):
 *   npx tsx scripts/seed-demo-clinica.ts
 *   DEMO_SENHA='SuaSenhaForte#2026' npx tsx scripts/seed-demo-clinica.ts   (senha escolhida)
 *
 * Banco remoto de TESTE (nunca o de produção):
 *   npx tsx scripts/seed-demo-clinica.ts --confirmo-que-nao-e-producao
 *
 * Sem DEMO_SENHA, gera uma senha forte nova a cada execução (a mesma para os
 * sete usuários). As credenciais vão para a tela e para `.demo-clinica-creds.json`
 * (fora do git). Idempotente: rodar de novo só troca a senha.
 */
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import { createClient } from "@supabase/supabase-js";
import pg from "pg";

import { anunciarDestino, credenciaisSupabaseDeTeste, destinoEhLocal } from "./lib/env-de-teste";
import { PESSOAS_DEMO, roteiroDemo, scriptDoPasso, SLUG_DEMO, type IdsDasPessoas } from "./seed-demo-clinica/roteiro";

const credenciais = credenciaisSupabaseDeTeste();
anunciarDestino("seed-demo-clinica", credenciais);

const local = destinoEhLocal(credenciais.url) && destinoEhLocal(credenciais.dbUrl);
if (!local && !process.argv.includes("--confirmo-que-nao-e-producao")) {
  console.error(
    "[seed-demo-clinica] RECUSADO: o destino não é local. Este seed cria usuários de teste e pacientes " +
      "fictícios. Se o banco é de TESTE (nunca produção), rode de novo com --confirmo-que-nao-e-producao.",
  );
  process.exit(1);
}
if (!credenciais.dbUrl) {
  console.error("[seed-demo-clinica] Falta SUPABASE_DB_URL (conexão direta ao Postgres) no ambiente ou no .env.local.");
  process.exit(1);
}

const SENHA = process.env.DEMO_SENHA ?? `Demo-${crypto.randomBytes(9).toString("base64url")}#1`;
if (SENHA.length < 12) {
  console.error("[seed-demo-clinica] DEMO_SENHA precisa ter ao menos 12 caracteres.");
  process.exit(1);
}

const admin = createClient(credenciais.url, credenciais.serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function garantirUsuario(email: string, nome: string): Promise<string> {
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw new Error(`listar usuários: ${error.message}`);
    const achado = data.users.find((u) => u.email === email);
    if (achado) {
      const { error: e } = await admin.auth.admin.updateUserById(achado.id, { password: SENHA });
      if (e) throw new Error(`trocar senha de ${email}: ${e.message}`);
      return achado.id;
    }
    if (data.users.length < 200) break;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SENHA,
    email_confirm: true,
    user_metadata: { full_name: nome },
  });
  if (error || !data?.user) throw new Error(`criar ${email}: ${error?.message}`);
  return data.user.id;
}

async function main(): Promise<void> {
  const ids = {} as IdsDasPessoas;
  for (const p of PESSOAS_DEMO) ids[p.chave] = await garantirUsuario(p.email, p.nome);
  console.info(`[seed-demo-clinica] ${PESSOAS_DEMO.length} usuários prontos`);

  for (const passo of roteiroDemo(ids)) {
    const cliente = new pg.Client({ connectionString: credenciais.dbUrl });
    await cliente.connect();
    try {
      await cliente.query(scriptDoPasso(passo));
      console.info(`[seed-demo-clinica] ok: ${passo.titulo}`);
    } catch (e) {
      await cliente.query("rollback").catch(() => undefined);
      throw new Error(`passo "${passo.titulo}": ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      await cliente.end();
    }
  }

  const credenciaisDemo = {
    empresa: SLUG_DEMO,
    app: credenciais.appUrl,
    senha: SENHA,
    usuarios: PESSOAS_DEMO.map((p) => ({ email: p.email, funcao: p.funcao, acesso: p.acesso })),
  };
  fs.writeFileSync(path.join(process.cwd(), ".demo-clinica-creds.json"), JSON.stringify(credenciaisDemo, null, 2), {
    mode: 0o600,
  });
  console.info(`\nClínica de demonstração pronta em ${credenciais.appUrl}. Senha de todos: ${SENHA}\n`);
  for (const p of PESSOAS_DEMO) console.info(`  ${p.email.padEnd(36)} ${p.funcao}`);
  console.info("Credenciais salvas em .demo-clinica-creds.json (fora do git).");
}

main().catch((erro) => {
  console.error(`[seed-demo-clinica] falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
  process.exit(1);
});
