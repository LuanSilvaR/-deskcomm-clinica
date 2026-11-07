"use client";
/**
 * Tabela de preços (FORK clinic, orçamento O1, migration 8006).
 *
 * Um preço por item: procedimento OU tipo de serviço × nº de sessões (1 =
 * avulso; mais de 1 = pacote). Mudar um preço PUBLICA uma vigência nova — o
 * antigo fica no histórico e orçamento já enviado não muda. "Tirar da tabela"
 * também é uma vigência (inativa). Sem dado de paciente.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { formatarReais, precoPorSessao, reaisParaCentavos, type ItemDaTabela } from "@/lib/clinic/orcamentos/precos";

type Opcao = { id: string; name: string; is_active: boolean; default_price_cents?: number | null };
type Dados = { ligado: boolean; desconto_max_pct: number; itens: ItemDaTabela[]; procedimentos: Opcao[]; servicos: Opcao[] };

const CHAVE = ["clinic", "precos"] as const;

function limiteValido(texto: string): boolean {
  const n = Number(texto.replace(",", "."));
  return texto.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100;
}

export function TabelaDePrecosClient({ podeEditar, podeConfigurar = false }: { podeEditar: boolean; podeConfigurar?: boolean }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const dataCurta = (iso: string) => new Date(iso).toLocaleDateString(tag);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: CHAVE,
    queryFn: async () => (await apiClient.get<{ data: Dados }>("/api/v1/clinic/precos")).data,
  });

  const [item, setItem] = useState("");
  const [sessoes, setSessoes] = useState("1");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [novoValor, setNovoValor] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [limite, setLimite] = useState<string | null>(null);

  // FORK clinic (orçamento O2, 8007): o desconto que dispensa aprovação.
  const salvarLimite = useMutation({
    mutationFn: (pct: number) => apiClient.patch("/api/v1/clinic/config", { orcamentos_desconto_max_pct: pct }),
    onSuccess: () => {
      setLimite(null);
      void qc.invalidateQueries({ queryKey: CHAVE });
    },
  });

  const publicar = useMutation({
    mutationFn: (corpo: Record<string, unknown>) => apiClient.post("/api/v1/clinic/precos", corpo),
    onSuccess: () => {
      setValor("");
      setDescricao("");
      setEditando(null);
      setNovoValor("");
      void qc.invalidateQueries({ queryKey: CHAVE });
    },
  });

  const dados = q.data;
  const nomeDo = (it: Pick<ItemDaTabela, "tipo" | "item_id">) => {
    const lista = it.tipo === "procedimento" ? dados?.procedimentos : dados?.servicos;
    return lista?.find((o) => o.id === it.item_id)?.name ?? t("Item removido");
  };
  const alvoDo = (it: Pick<ItemDaTabela, "tipo" | "item_id">) =>
    it.tipo === "procedimento" ? { procedure_id: it.item_id } : { event_type_id: it.item_id };

  const centavos = reaisParaCentavos(valor);
  const nSessoes = Number(sessoes);
  const sessoesValidas = Number.isInteger(nSessoes) && nSessoes >= 1 && nSessoes <= 100;
  const [tipoEscolhido, idEscolhido] = item.split(":");
  const podeAdicionar = !!idEscolhido && centavos !== null && sessoesValidas && !publicar.isPending;
  const centavosNovos = reaisParaCentavos(novoValor);

  if (q.isLoading) return <p className="text-sm text-text-muted">{t("Carregando...")}</p>;
  if (q.isError || !dados) {
    return <p className="text-sm text-danger">{t("Não foi possível carregar a tabela de preços.")}</p>;
  }

  const itens = [...dados.itens].sort(
    (a, b) => nomeDo(a).localeCompare(nomeDo(b), "pt-BR") || a.sessoes - b.sessoes,
  );

  return (
    <div className="space-y-6">
      {!dados.ligado ? (
        <p className="rounded-xl border bg-muted p-4 text-sm" data-testid="precos-desligado">
          {t("Os orçamentos estão desligados nesta clínica. Ligue em Configurações › Profissionais.")}
        </p>
      ) : null}

      {podeConfigurar && dados.ligado ? (
        <section className="space-y-2 rounded-xl border p-4" data-testid="precos-limite-desconto">
          <h2 className="font-semibold">{t("Desconto sem aprovação")}</h2>
          <p className="text-sm text-text-muted">
            {t("Até este percentual, quem monta o orçamento dá o desconto sozinho. Acima, um gerente precisa aprovar.")}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <input
              aria-label={t("Desconto sem aprovação (%)")}
              className="min-h-11 w-24 rounded-md border p-2"
              inputMode="decimal"
              value={limite ?? String(dados.desconto_max_pct).replace(".", ",")}
              onChange={(e) => setLimite(e.target.value)}
            />
            <Button
              className="min-h-11"
              disabled={limite === null || salvarLimite.isPending || !limiteValido(limite)}
              onClick={() => limite !== null && salvarLimite.mutate(Number(limite.replace(",", ".")))}
            >
              {t("Salvar limite")}
            </Button>
          </div>
          {salvarLimite.isError ? <p className="text-xs text-danger">{(salvarLimite.error as Error).message}</p> : null}
        </section>
      ) : null}

      {podeEditar && dados.ligado ? (
        <section className="space-y-3 rounded-xl border p-4" data-testid="precos-novo">
          <h2 className="font-semibold">{t("Novo preço")}</h2>
          <p className="text-sm text-text-muted">
            {t("Use 1 sessão para o preço avulso e mais sessões para um pacote. O mesmo procedimento pode ter os dois.")}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <select
              aria-label={t("Procedimento ou serviço")}
              className="min-h-11 rounded-md border p-2"
              value={item}
              onChange={(e) => setItem(e.target.value)}
            >
              <option value="">{t("Escolha o procedimento ou serviço")}</option>
              {dados.procedimentos.some((p) => p.is_active) ? (
                <optgroup label={t("Procedimentos")}>
                  {dados.procedimentos
                    .filter((p) => p.is_active)
                    .map((p) => (
                      <option key={p.id} value={`procedimento:${p.id}`}>
                        {p.name}
                      </option>
                    ))}
                </optgroup>
              ) : null}
              {dados.servicos.some((s) => s.is_active) ? (
                <optgroup label={t("Tipos de serviço da agenda")}>
                  {dados.servicos
                    .filter((s) => s.is_active)
                    .map((s) => (
                      <option key={s.id} value={`servico:${s.id}`}>
                        {s.name}
                      </option>
                    ))}
                </optgroup>
              ) : null}
            </select>
            <input
              aria-label={t("Sessões")}
              className="min-h-11 w-24 rounded-md border p-2"
              inputMode="numeric"
              value={sessoes}
              onChange={(e) => setSessoes(e.target.value)}
            />
            <input
              aria-label={t("Preço (R$)")}
              className="min-h-11 w-32 rounded-md border p-2"
              placeholder="150,00"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
            <input
              aria-label={t("Descrição (opcional)")}
              className="min-h-11 min-w-48 flex-1 rounded-md border p-2"
              placeholder={t("Ex.: Pacote 10 sessões")}
              maxLength={120}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
            <Button
              className="min-h-11"
              data-testid="precos-adicionar"
              disabled={!podeAdicionar}
              onClick={() =>
                publicar.mutate({
                  ...(tipoEscolhido === "procedimento" ? { procedure_id: idEscolhido } : { event_type_id: idEscolhido }),
                  sessoes: nSessoes,
                  preco_cents: centavos,
                  ...(descricao.trim() ? { descricao: descricao.trim() } : {}),
                })
              }
            >
              {t("Publicar preço")}
            </Button>
          </div>
          {valor !== "" && centavos === null ? (
            <p className="text-xs text-danger">{t("Preço inválido. Use o formato 150,00.")}</p>
          ) : null}
          {!sessoesValidas ? <p className="text-xs text-danger">{t("Sessões de 1 a 100.")}</p> : null}
          {publicar.isError ? (
            <p className="text-xs text-danger">{(publicar.error as Error).message}</p>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-semibold">{t("Preços vigentes")}</h2>
        {itens.length === 0 ? (
          <p className="text-sm text-text-muted">{t("Nenhum preço cadastrado ainda.")}</p>
        ) : (
          <ul className="space-y-2" data-testid="precos-lista">
            {itens.map((it) => (
              <li key={it.chave} className="rounded-md border p-3 text-sm" data-testid="precos-item">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {nomeDo(it)}
                      {it.sessoes > 1 ? ` · ${it.sessoes} ${t("sessões")}` : ` · ${t("avulso")}`}
                    </p>
                    {it.descricao ? <p className="text-text-muted">{it.descricao}</p> : null}
                    <p className="text-xs text-text-muted">
                      {t("Desde")} {dataCurta(it.vigente_desde)}
                      {it.sessoes > 1 ? ` · ${formatarReais(precoPorSessao(it))} ${t("por sessão")}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold" data-testid="precos-valor">
                      {formatarReais(it.preco_cents)}
                    </span>
                    {podeEditar && dados.ligado ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditando(editando === it.chave ? null : it.chave);
                            setNovoValor("");
                          }}
                        >
                          {t("Mudar preço")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={publicar.isPending}
                          onClick={() =>
                            publicar.mutate({
                              ...alvoDo(it),
                              sessoes: it.sessoes,
                              preco_cents: it.preco_cents,
                              ...(it.descricao ? { descricao: it.descricao } : {}),
                              ativo: false,
                            })
                          }
                        >
                          {t("Tirar da tabela")}
                        </Button>
                      </>
                    ) : null}
                    {it.historico.length > 0 ? (
                      <Button size="sm" variant="ghost" onClick={() => setAberto(aberto === it.chave ? null : it.chave)}>
                        {t("Histórico")}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {editando === it.chave ? (
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <input
                      aria-label={t("Novo preço (R$)")}
                      className="min-h-11 w-32 rounded-md border p-2"
                      placeholder="150,00"
                      inputMode="decimal"
                      value={novoValor}
                      onChange={(e) => setNovoValor(e.target.value)}
                    />
                    <Button
                      className="min-h-11"
                      disabled={centavosNovos === null || publicar.isPending}
                      onClick={() =>
                        publicar.mutate({
                          ...alvoDo(it),
                          sessoes: it.sessoes,
                          preco_cents: centavosNovos,
                          ...(it.descricao ? { descricao: it.descricao } : {}),
                        })
                      }
                    >
                      {t("Publicar novo preço")}
                    </Button>
                    <p className="w-full text-xs text-text-muted">
                      {t("O preço atual vai para o histórico. Orçamentos já enviados não mudam.")}
                    </p>
                  </div>
                ) : null}
                {aberto === it.chave ? (
                  <ul className="mt-2 space-y-1 border-t pt-2 text-xs text-text-muted">
                    {it.historico.map((h) => (
                      <li key={h.id}>
                        {dataCurta(h.vigente_desde)} · {h.ativo ? formatarReais(h.preco_cents) : t("fora da tabela")}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
