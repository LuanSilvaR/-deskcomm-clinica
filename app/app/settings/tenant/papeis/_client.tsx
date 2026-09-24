"use client";

/**
 * A tela "Papéis de acesso" (ACL-009/010):
 *   - o MODO: desligado, vale o papel de sempre (Admin/Gerente/Atendente/
 *     Visualizador); ligado, o acesso vem dos papéis desta tela;
 *   - Papéis: lista, criar, editar, duplicar, desativar, excluir; a matriz por
 *     módulo marca as dependências junto (editar exige ver) e, ao desmarcar,
 *     tira também o que dependia daquilo;
 *   - Membros: um ou mais papéis por pessoa, com as permissões efetivas (união).
 * Tudo é conferido de novo no banco (regra de concessão, último Administrador).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
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

function AbaPapeis({ podeGerenciar }: { podeGerenciar: boolean }) {
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
                  {p.permissoes.length} {t("permissões")} · {p.membros} {t("membros")}
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

function AbaMembros({ podeAtribuir }: { podeAtribuir: boolean }) {
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
    queryFn: async () => (await apiClient.get<{ data: { user_id: string; papeis: string[] }[] }>("/api/v1/clinic/acesso/membros")).data,
  });
  const [rascunho, setRascunho] = useState<Record<string, string[]>>({});

  const salvar = useMutation({
    mutationFn: ({ userId, ids }: { userId: string; ids: string[] }) =>
      apiClient.put(`/api/v1/clinic/acesso/membros/${userId}/papeis`, { papeis: ids }),
    onSuccess: (_r, v) => {
      setRascunho((r) => {
        const n = { ...r };
        delete n[v.userId];
        return n;
      });
      void qc.invalidateQueries({ queryKey: ["clinic", "acesso"] });
    },
    onError: showApiError,
  });

  if (papeis.isLoading || equipe.isLoading || atribuicoes.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  const ativos = (papeis.data ?? []).filter((p) => p.ativo);
  const porId = new Map((papeis.data ?? []).map((p) => [p.id, p]));
  const doMembro = new Map((atribuicoes.data ?? []).map((a) => [a.user_id, a.papeis]));

  return (
    <ul className="divide-y rounded-xl border">
      {(equipe.data ?? [])
        .filter((m) => !m.revoked_at)
        .map((m) => {
          const atuais = rascunho[m.user_id] ?? doMembro.get(m.user_id) ?? [];
          const efetivas = [...new Set(atuais.flatMap((id) => (porId.get(id)?.ativo ? porId.get(id)!.permissoes : [])))].sort();
          const mudou = rascunho[m.user_id] !== undefined;
          return (
            <li key={m.user_id} className="space-y-2 p-3" data-testid="membro-linha" data-user={m.user_id}>
              <p className="font-medium">
                {m.full_name ?? m.email ?? t("Membro")}
                {m.email && m.full_name ? <span className="ml-2 text-xs text-text-muted">{m.email}</span> : null}
              </p>
              <div className="flex flex-wrap gap-3">
                {ativos.map((p) => (
                  <label key={p.id} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      data-testid={`membro-papel-${p.nome}`}
                      disabled={!podeAtribuir || salvar.isPending}
                      checked={atuais.includes(p.id)}
                      onChange={(e) =>
                        setRascunho((r) => ({
                          ...r,
                          [m.user_id]: e.target.checked ? [...atuais, p.id] : atuais.filter((x) => x !== p.id),
                        }))
                      }
                    />
                    {p.nome}
                  </label>
                ))}
              </div>
              <details className="text-xs text-text-muted">
                <summary>
                  {t("Permissões efetivas")}: {efetivas.length}
                </summary>
                <p className="mt-1">{efetivas.map((k) => CATALOGO_DE_PERMISSOES[k]?.descricao ?? k).join(" · ") || t("Nenhuma")}</p>
              </details>
              {podeAtribuir && mudou ? (
                <Button size="sm" data-testid="membro-salvar" disabled={salvar.isPending} onClick={() => salvar.mutate({ userId: m.user_id, ids: atuais })}>
                  {t("Salvar papéis")}
                </Button>
              ) : null}
            </li>
          );
        })}
    </ul>
  );
}

export function PapeisDeAcesso() {
  const t = useT();
  const qc = useQueryClient();
  const { can, modoLigado } = usePermissoes();

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
      >
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
      </section>

      <Tabs defaultValue="papeis">
        <TabsList>
          <TabsTrigger value="papeis">{t("Papéis")}</TabsTrigger>
          <TabsTrigger value="membros">{t("Membros")}</TabsTrigger>
        </TabsList>
        <TabsContent value="papeis">
          <AbaPapeis podeGerenciar={can("papeis.gerenciar")} />
        </TabsContent>
        <TabsContent value="membros">
          <AbaMembros podeAtribuir={can("equipe.atribuir_papeis")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
