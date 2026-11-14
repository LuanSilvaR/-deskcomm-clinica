"use client";

/**
 * A tela "Papéis de acesso" (ACL-009/010):
 *   - o MODO: desligado, vale o papel de sempre (Admin/Gerente/Atendente/
 *     Visualizador); ligado, o acesso vem dos papéis desta tela;
 *   - Papéis: lista, criar, editar, duplicar, desativar, excluir; a matriz por
 *     módulo marca as dependências junto (editar exige ver) e, ao desmarcar,
 *     tira também o que dependia daquilo;
 *   - Membros: busca por nome/e-mail (sem acento), filtro por papel, convites em
 *     aberto na busca e atalho para convidar o e-mail que não existe; cada
 *     pessoa com um ou mais papéis e as permissões efetivas (união) por módulo.
 * Tudo é conferido de novo no banco (regra de concessão, último Administrador).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import {
  CATALOGO_DE_PERMISSOES,
  CHAVES_DE_PERMISSAO,
  MODULOS_DE_PERMISSAO,
  comDependencias,
  type ModuloDePermissao,
} from "@/lib/clinic/acesso/catalogo";
import { usePermissoes } from "@/lib/clinic/acesso/use-permissoes";

interface Papel {
  id: string;
  nome: string;
  descricao: string | null;
  is_system: boolean;
  system_key: string | null;
  ativo: boolean;
  permissoes: string[];
  membros: number;
}

interface Membro {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

const CHAVE_PAPEIS = ["clinic", "acesso", "papeis"];

/** Tirar uma permissão tira também as que dependem dela (transitivamente). */
function semDependentes(chaves: readonly string[], removida: string): string[] {
  const fora = new Set([removida]);
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const k of chaves) {
      if (fora.has(k)) continue;
      if ((CATALOGO_DE_PERMISSOES[k]?.dependeDe ?? []).some((d) => fora.has(d))) {
        fora.add(k);
        mudou = true;
      }
    }
  }
  return chaves.filter((k) => !fora.has(k));
}

function EditorDePapel({
  papel,
  onFechar,
}: {
  papel: { id: string | null; nome: string; descricao: string; permissoes: string[]; is_system: boolean; ativo: boolean };
  onFechar: () => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [nome, setNome] = useState(papel.nome);
  const [descricao, setDescricao] = useState(papel.descricao);
  const [marcadas, setMarcadas] = useState<string[]>(papel.permissoes);
  const [aviso, setAviso] = useState<string | null>(null);

  const salvar = useMutation({
    mutationFn: () => {
      const corpo = { nome, descricao: descricao || null, ativo: papel.ativo, permissoes: marcadas };
      return papel.id ? apiClient.patch(`/api/v1/clinic/acesso/papeis/${papel.id}`, corpo) : apiClient.post("/api/v1/clinic/acesso/papeis", corpo);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clinic", "acesso"] });
      onFechar();
    },
    onError: showApiError,
  });

  const alternar = (k: string, marcar: boolean) => {
    if (marcar) {
      const com = comDependencias([...marcadas, k]);
      const extras = com.filter((x) => x !== k && !marcadas.includes(x));
      setAviso(extras.length ? `${t("Marcadas junto, porque são necessárias")}: ${extras.map((x) => CATALOGO_DE_PERMISSOES[x]?.descricao ?? x).join("; ")}` : null);
      setMarcadas(com);
    } else {
      const sem = semDependentes(marcadas, k);
      const saiu = marcadas.filter((x) => x !== k && !sem.includes(x));
      setAviso(saiu.length ? `${t("Desmarcadas junto, porque dependiam desta")}: ${saiu.map((x) => CATALOGO_DE_PERMISSOES[x]?.descricao ?? x).join("; ")}` : null);
      setMarcadas(sem);
    }
  };

  const porModulo = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const k of CHAVES_DE_PERMISSAO) {
      const mod = CATALOGO_DE_PERMISSOES[k]!.modulo;
      m.set(mod, [...(m.get(mod) ?? []), k]);
    }
    return m;
  }, []);

  return (
    <section className="space-y-4 rounded-xl border p-4" data-testid="editor-de-papel">
      <div className="flex flex-wrap gap-3">
        <label className="block text-sm">
          <span className="block">{t("Nome")}</span>
          <input
            className="mt-1 rounded-md border bg-surface p-2"
            data-testid="papel-nome"
            value={nome}
            maxLength={60}
            disabled={papel.is_system}
            onChange={(e) => setNome(e.target.value)}
          />
        </label>
        <label className="min-w-64 flex-1 text-sm">
          <span className="block">{t("Descrição")}</span>
          <input
            className="mt-1 w-full rounded-md border bg-surface p-2"
            data-testid="papel-descricao"
            value={descricao}
            maxLength={300}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </label>
      </div>
      {papel.is_system ? (
        <p className="text-sm text-text-muted">{t("O papel Administrador é do sistema: não muda de nome e nunca perde o controle dos papéis e da equipe.")}</p>
      ) : null}
      {aviso ? (
        <p className="rounded-md bg-muted p-2 text-xs text-text-muted" data-testid="aviso-de-dependencia">
          {aviso}
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {(Object.keys(MODULOS_DE_PERMISSAO) as ModuloDePermissao[]).map((mod) => (
          <fieldset key={mod} className="rounded-md border p-3" data-testid={`modulo-${mod}`}>
            <legend className="px-1 text-sm font-medium">{t(MODULOS_DE_PERMISSAO[mod])}</legend>
            <div className="space-y-1">
              {(porModulo.get(mod) ?? []).map((k) => {
                const d = CATALOGO_DE_PERMISSOES[k]!;
                const travada = papel.is_system && !!d.critica;
                return (
                  <label key={k} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      data-testid={`perm-${k}`}
                      checked={marcadas.includes(k)}
                      disabled={travada}
                      onChange={(e) => alternar(k, e.target.checked)}
                    />
                    <span>{t(d.descricao)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="flex gap-2">
        <Button data-testid="papel-salvar" disabled={salvar.isPending || !nome.trim()} onClick={() => salvar.mutate()}>
          {t("Salvar")}
        </Button>
        <Button variant="outline" onClick={onFechar}>
          {t("Cancelar")}
        </Button>
      </div>
    </section>
  );
}

function AbaPapeis({ podeGerenciar, onVerMembros }: { podeGerenciar: boolean; onVerMembros: (papelId: string) => void }) {
  const t = useT();
  const qc = useQueryClient();
  const papeis = useQuery({
    queryKey: CHAVE_PAPEIS,
    queryFn: async () => (await apiClient.get<{ data: Papel[] }>("/api/v1/clinic/acesso/papeis")).data,
  });
  const [editando, setEditando] = useState<Parameters<typeof EditorDePapel>[0]["papel"] | null>(null);

  const alterar = useMutation({
    mutationFn: (p: Papel) =>
      apiClient.patch(`/api/v1/clinic/acesso/papeis/${p.id}`, {
        nome: p.nome,
        descricao: p.descricao,
        ativo: !p.ativo,
        permissoes: p.permissoes,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clinic", "acesso"] }),
    onError: showApiError,
  });
  const excluir = useMutation({
    mutationFn: (p: Papel) => apiClient.delete(`/api/v1/clinic/acesso/papeis/${p.id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clinic", "acesso"] }),
    onError: showApiError,
  });

  if (editando) return <EditorDePapel papel={editando} onFechar={() => setEditando(null)} />;

  return (
    <div className="space-y-3">
      {podeGerenciar ? (
        <Button
          data-testid="papel-novo"
          onClick={() => setEditando({ id: null, nome: "", descricao: "", permissoes: [], is_system: false, ativo: true })}
        >
          {t("Novo papel")}
        </Button>
      ) : null}
      {papeis.isLoading ? (
        <p className="text-sm text-text-muted">{t("Carregando…")}</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {(papeis.data ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3" data-testid="papel-linha" data-nome={p.nome}>
              <div className="min-w-0">
                <p className="font-medium">
                  {p.nome}
                  {p.is_system ? <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">{t("Sistema")}</span> : null}
                  {!p.ativo ? <span className="ml-2 text-xs text-text-muted">({t("desativado")})</span> : null}
                </p>
                <p className="text-xs text-text-muted">
                  {p.permissoes.length} {t("permissões")} ·{" "}
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:text-text"
                    data-testid="papel-ver-membros"
                    onClick={() => onVerMembros(p.id)}
                  >
                    {p.membros} {t("membros")}
                  </button>
                  {p.descricao ? ` · ${p.descricao}` : ""}
                </p>
              </div>
              {podeGerenciar ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="papel-editar"
                    onClick={() => setEditando({ id: p.id, nome: p.nome, descricao: p.descricao ?? "", permissoes: p.permissoes, is_system: p.is_system, ativo: p.ativo })}
                  >
                    {t("Editar")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="papel-duplicar"
                    onClick={() => setEditando({ id: null, nome: `${p.nome} (${t("cópia")})`, descricao: p.descricao ?? "", permissoes: p.permissoes, is_system: false, ativo: true })}
                  >
                    {t("Duplicar")}
                  </Button>
                  {!p.is_system ? (
                    <>
                      <Button size="sm" variant="outline" data-testid="papel-alternar-ativo" disabled={alterar.isPending} onClick={() => alterar.mutate(p)}>
                        {p.ativo ? t("Desativar") : t("Reativar")}
                      </Button>
                      <Button size="sm" variant="outline" data-testid="papel-excluir" disabled={excluir.isPending} onClick={() => excluir.mutate(p)}>
                        {t("Excluir")}
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Busca sem diferenciar maiúsculas nem acentos ("Joao" acha "João"). */
function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const NOME_DO_NIVEL: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  agent: "Atendente",
  viewer: "Visualizador",
};

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Convite {
  id: string;
  email: string;
  role: string;
  status: "pendente" | "expirado" | "aceito" | "revogado";
}

function iniciais(texto: string): string {
  const partes = texto.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

function PermissoesPorModulo({ chaves }: { chaves: string[] }) {
  const t = useT();
  if (chaves.length === 0) return <p className="text-xs text-text-muted">{t("Nenhuma")}</p>;
  const grupos = new Map<string, string[]>();
  for (const k of chaves) {
    const m = CATALOGO_DE_PERMISSOES[k]?.modulo ?? k.split(".")[0] ?? k;
    grupos.set(m, [...(grupos.get(m) ?? []), CATALOGO_DE_PERMISSOES[k]?.descricao ?? k]);
  }
  return (
    <dl className="grid gap-2 text-xs sm:grid-cols-2">
      {[...grupos].map(([m, itens]) => (
        <div key={m}>
          <dt className="font-medium">{t(MODULOS_DE_PERMISSAO[m as ModuloDePermissao] ?? m)}</dt>
          <dd className="text-text-muted">{itens.map((d) => t(d)).join(" · ")}</dd>
        </div>
      ))}
    </dl>
  );
}

function AbaMembros({
  podeAtribuir,
  podeConvidar,
  filtroPapel,
  onFiltroPapel,
}: {
  podeAtribuir: boolean;
  podeConvidar: boolean;
  filtroPapel: string;
  onFiltroPapel: (v: string) => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const papeis = useQuery({
    queryKey: CHAVE_PAPEIS,
    queryFn: async () => (await apiClient.get<{ data: Papel[] }>("/api/v1/clinic/acesso/papeis")).data,
  });
  const equipe = useQuery({
    queryKey: ["clinic", "acesso", "equipe"],
    queryFn: async () => (await apiClient.get<{ data: (Membro & { revoked_at: string | null })[] }>("/api/v1/team")).data,
  });
  const atribuicoes = useQuery({
    queryKey: ["clinic", "acesso", "membros"],
    queryFn: async () =>
      (await apiClient.get<{ data: { user_id: string; nivel_legado: string; papeis: string[] }[] }>("/api/v1/clinic/acesso/membros")).data,
  });
  // Convites em aberto entram na busca: "já convidei esta pessoa?" tem resposta aqui.
  const convites = useQuery({
    queryKey: ["clinic", "acesso", "convites"],
    queryFn: async () => (await apiClient.get<{ data: Convite[] }>("/api/v1/team/invites")).data,
    retry: false,
  });
  const [busca, setBusca] = useState("");
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<string[]>([]);

  const salvar = useMutation({
    mutationFn: ({ userId, ids }: { userId: string; ids: string[] }) =>
      apiClient.put(`/api/v1/clinic/acesso/membros/${userId}/papeis`, { papeis: ids }),
    onSuccess: () => {
      setAbertoId(null);
      void qc.invalidateQueries({ queryKey: ["clinic", "acesso"] });
    },
    onError: showApiError,
  });

  const porId = useMemo(() => new Map((papeis.data ?? []).map((p) => [p.id, p])), [papeis.data]);
  const membros = useMemo(() => {
    const doMembro = new Map((atribuicoes.data ?? []).map((a) => [a.user_id, a]));
    return (equipe.data ?? [])
      .filter((m) => !m.revoked_at)
      .map((m) => ({
        ...m,
        rotulo: m.full_name ?? m.email ?? "",
        papeis: doMembro.get(m.user_id)?.papeis ?? [],
        nivel: doMembro.get(m.user_id)?.nivel_legado ?? null,
      }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  }, [equipe.data, atribuicoes.data]);

  if (papeis.isLoading || equipe.isLoading || atribuicoes.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;

  const termo = normalizar(busca);
  const casaBusca = (...campos: (string | null | undefined)[]) => !termo || campos.some((c) => c && normalizar(c).includes(termo));
  const visiveis = membros.filter(
    (m) =>
      casaBusca(m.full_name, m.email) &&
      (filtroPapel === "todos" || (filtroPapel === "sem-papel" ? m.papeis.length === 0 : m.papeis.includes(filtroPapel))),
  );
  const emailsDeMembros = new Set(membros.map((m) => normalizar(m.email ?? "")));
  const convitesAbertos = (convites.data ?? []).filter(
    (c) => (c.status === "pendente" || c.status === "expirado") && !emailsDeMembros.has(normalizar(c.email)),
  );
  const convitesVisiveis = termo && filtroPapel === "todos" ? convitesAbertos.filter((c) => casaBusca(c.email)) : [];
  const buscaEhEmail = EMAIL_VALIDO.test(busca.trim());
  const emailJaExiste = emailsDeMembros.has(termo) || convitesAbertos.some((c) => normalizar(c.email) === termo);
  const semPapel = membros.filter((m) => m.papeis.length === 0).length;

  const alternar = (userId: string, atuais: string[]) => {
    setAbertoId(abertoId === userId ? null : userId);
    setRascunho(atuais);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="membros-busca" className="block text-xs text-text-muted">
            {t("Buscar colaborador")}
          </label>
          <Input
            id="membros-busca"
            data-testid="membros-busca"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={t("Nome ou e-mail")}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="membros-filtro-papel" className="block text-xs text-text-muted">
            {t("Papel")}
          </label>
          <select
            id="membros-filtro-papel"
            data-testid="membros-filtro-papel"
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
            value={filtroPapel}
            onChange={(e) => onFiltroPapel(e.target.value)}
          >
            <option value="todos">{t("Todos os papéis")}</option>
            <option value="sem-papel">{t("Sem papel")}</option>
            {(papeis.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.ativo ? p.nome : `${p.nome} (${t("desativado")})`}
              </option>
            ))}
          </select>
        </div>
        {podeConvidar ? (
          <Button asChild variant="outline">
            <Link href="/app/team/invite" data-testid="membros-convidar">
              {t("Convidar membro")}
            </Link>
          </Button>
        ) : null}
      </div>

      <p className="text-xs text-text-muted" data-testid="membros-contagem">
        {visiveis.length} {t("de")} {membros.length} {t("membros")}
        {semPapel > 0 ? ` · ${semPapel} ${t("sem papel")}` : ""}
        {convitesAbertos.length > 0 ? ` · ${convitesAbertos.length} ${t("convites em aberto")}` : ""}
      </p>

      {visiveis.length === 0 && convitesVisiveis.length === 0 ? (
        <div className="rounded-xl border border-dashed p-4 text-sm" data-testid="membros-vazio">
          <p>{termo ? t("Nenhum colaborador encontrado com esta busca.") : t("Nenhum membro com este papel.")}</p>
          {buscaEhEmail && !emailJaExiste ? (
            podeConvidar ? (
              <Button asChild size="sm" className="mt-2">
                <Link href={`/app/team/invite?email=${encodeURIComponent(busca.trim())}`} data-testid="membros-convidar-email">
                  {t("Convidar")} {busca.trim()}
                </Link>
              </Button>
            ) : (
              <p className="mt-1 text-text-muted">{t("Peça a quem administra a equipe para convidar esta pessoa.")}</p>
            )
          ) : null}
        </div>
      ) : (
        <ul className="divide-y rounded-xl border">
          {visiveis.map((m) => {
            const aberto = abertoId === m.user_id;
            const atuais = aberto ? rascunho : m.papeis;
            const efetivas = [...new Set(atuais.flatMap((id) => (porId.get(id)?.ativo ? porId.get(id)!.permissoes : [])))].sort();
            const mudou = aberto && [...rascunho].sort().join() !== [...m.papeis].sort().join();
            return (
              <li key={m.user_id} className="p-3" data-testid="membro-linha" data-user={m.user_id}>
                <div className="flex flex-wrap items-center gap-3">
                  <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {iniciais(m.rotulo)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.full_name ?? m.email ?? t("Membro")}</p>
                    {m.email && m.full_name ? <p className="truncate text-xs text-text-muted">{m.email}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-1" data-testid="membro-papeis">
                    {m.papeis.length === 0 ? (
                      <Badge variant="warning">{t("Sem papel")}</Badge>
                    ) : (
                      m.papeis.map((id) => (
                        <Badge key={id} variant={porId.get(id)?.ativo ? "default" : "neutral"}>
                          {porId.get(id)?.nome ?? "?"}
                        </Badge>
                      ))
                    )}
                  </div>
                  {m.nivel ? (
                    <span className="text-xs text-text-muted" title={t("Nível usado pelas telas que ainda não perguntam a permissão")}>
                      {t("Nível")}: {t(NOME_DO_NIVEL[m.nivel] ?? m.nivel)}
                    </span>
                  ) : null}
                  <Button size="sm" variant="outline" data-testid="membro-editar" aria-expanded={aberto} onClick={() => alternar(m.user_id, m.papeis)}>
                    {aberto ? t("Fechar") : podeAtribuir ? t("Alterar papéis") : t("Ver permissões")}
                  </Button>
                </div>

                {aberto ? (
                  <div className="mt-3 space-y-3 rounded-lg bg-muted p-3" data-testid="membro-editor">
                    <fieldset>
                      <legend className="mb-1 text-xs font-medium">{t("Papéis deste membro")}</legend>
                      <div className="flex flex-wrap gap-3">
                        {(papeis.data ?? [])
                          .filter((p) => p.ativo || rascunho.includes(p.id))
                          .map((p) => (
                            <label key={p.id} className="flex items-center gap-1 text-sm">
                              <input
                                type="checkbox"
                                data-testid={`membro-papel-${p.nome}`}
                                disabled={!podeAtribuir || salvar.isPending}
                                checked={rascunho.includes(p.id)}
                                onChange={(e) => setRascunho((r) => (e.target.checked ? [...r, p.id] : r.filter((x) => x !== p.id)))}
                              />
                              {p.nome}
                            </label>
                          ))}
                      </div>
                    </fieldset>
                    <div>
                      <p className="mb-1 text-xs font-medium">
                        {t("Permissões efetivas")}: {efetivas.length}
                      </p>
                      <PermissoesPorModulo chaves={efetivas} />
                    </div>
                    {podeAtribuir ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          data-testid="membro-salvar"
                          disabled={!mudou || salvar.isPending}
                          onClick={() => salvar.mutate({ userId: m.user_id, ids: rascunho })}
                        >
                          {t("Salvar papéis")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAbertoId(null)}>
                          {t("Cancelar")}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
          {convitesVisiveis.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 p-3" data-testid="convite-linha" data-email={c.email}>
              <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed text-xs">
                {iniciais(c.email)}
              </span>
              <p className="min-w-0 flex-1 truncate">{c.email}</p>
              <Badge variant={c.status === "pendente" ? "info" : "warning"}>
                {c.status === "pendente" ? t("Convite pendente") : t("Convite expirado")}
              </Badge>
              <span className="text-xs text-text-muted">
                {t("Entra como")} {t(NOME_DO_NIVEL[c.role] ?? c.role)}
              </span>
              <Button asChild size="sm" variant="outline">
                <Link href="/app/team">{t("Ver na Equipe")}</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PapeisDeAcesso() {
  const t = useT();
  const qc = useQueryClient();
  const { can, modoLigado, carregando } = usePermissoes();
  const [aba, setAba] = useState("papeis");
  const [filtroPapel, setFiltroPapel] = useState("todos");

  const alternarModo = useMutation({
    mutationFn: (ligar: boolean) => apiClient.patch("/api/v1/clinic/config", { acesso_por_permissoes: ligar }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clinic"] });
      window.location.reload();
    },
    onError: showApiError,
  });

  return (
    <div className="space-y-4">
      <section
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${modoLigado ? "" : "bg-muted"}`}
        data-testid="acesso-modo"
        data-estado={carregando ? "carregando" : modoLigado ? "ligado" : "desligado"}
      >
        {/* Sem o estado ainda, não diz nada: "papel de sempre" piscando antes do "ligado" engana. */}
        {carregando ? (
          <p className="text-sm text-text-muted">{t("Carregando…")}</p>
        ) : (
        <>
        <div>
          <p className="font-medium">{modoLigado ? t("Acesso pelos papéis desta tela") : t("Acesso pelo papel de sempre")}</p>
          <p className="text-sm text-text-muted">
            {modoLigado
              ? t("Cada membro pode exatamente o que os papéis dele permitem. O papel antigo passa a ser calculado sozinho.")
              : t("Hoje vale Administrador, Gerente, Atendente ou Visualizador, escolhido na Equipe. Prepare os papéis e ligue quando estiver pronto — ninguém perde acesso ao ligar.")}
          </p>
        </div>
        {can("papeis.gerenciar") ? (
          <Button
            data-testid="acesso-modo-alternar"
            variant={modoLigado ? "outline" : "default"}
            disabled={alternarModo.isPending}
            onClick={() => alternarModo.mutate(!modoLigado)}
          >
            {modoLigado ? t("Desligar") : t("Ligar")}
          </Button>
        ) : null}
        </>
        )}
      </section>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="papeis">{t("Papéis")}</TabsTrigger>
          <TabsTrigger value="membros">{t("Membros")}</TabsTrigger>
        </TabsList>
        <TabsContent value="papeis">
          <AbaPapeis
            podeGerenciar={can("papeis.gerenciar")}
            onVerMembros={(id) => {
              setFiltroPapel(id);
              setAba("membros");
            }}
          />
        </TabsContent>
        <TabsContent value="membros">
          <AbaMembros
            podeAtribuir={can("equipe.atribuir_papeis")}
            podeConvidar={can("equipe.convidar")}
            filtroPapel={filtroPapel}
            onFiltroPapel={setFiltroPapel}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
