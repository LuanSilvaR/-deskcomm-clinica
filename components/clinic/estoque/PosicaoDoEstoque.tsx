"use client";

/**
 * FORK clinic (estoque E0) — a posição: cada produto com o saldo total (na
 * unidade de aplicação), a próxima validade e avisos (abaixo do mínimo, lote
 * vencido). Abrir o produto mostra os lotes (FEFO: o que vence antes primeiro)
 * com o saldo em cada local e as ações: entrada, transferência, perda, ajuste
 * e a configuração do produto (unidades, lote, mínimo, controlado).
 * Estoque E4: produto fracionável ganha "Abrir frasco" e a lista de frascos
 * abertos (com o vencido em destaque e "Encerrar").
 */
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import type { ProdutoNaPosicao } from "@/lib/clinic/estoque/posicao";

import { BotaoAbrirFrasco, FrascosDoProduto } from "./Frascos";
import {
  ConfigDoProduto,
  FormularioDeBloqueio,
  FormularioDeEntrada,
  FormularioDoLote,
  type AcaoDoLote,
} from "./FormulariosDoEstoque";
import { quantidade, type DadosDoEstoque } from "./tipos";

type Painel =
  | { tipo: "entrada" }
  | { tipo: "config" }
  | { tipo: "lote"; acao: AcaoDoLote; loteId: string; localId: string }
  | { tipo: "bloqueio"; loteId: string; bloqueado: boolean }
  | null;

export function PosicaoDoEstoque({ dados }: { dados: DadosDoEstoque }) {
  const t = useT();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const termo = busca.trim().toLowerCase();
  const produtos = dados.produtos.filter(
    (p) => !termo || p.nome.toLowerCase().includes(termo) || p.codigo.toLowerCase().includes(termo),
  );

  return (
    <div className="space-y-3">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder={t("Buscar produto por nome ou código")}
        aria-label={t("Buscar produto")}
        className="h-11 max-w-md md:h-9"
      />
      {produtos.length === 0 ? (
        <p className="text-sm text-text-muted">
          {dados.produtos.length === 0
            ? t(
                "Nenhum produto cadastrado. Cadastre em Financeiro › Catálogo e volte aqui para dar entrada.",
              )
            : t("Nenhum produto encontrado.")}
        </p>
      ) : null}
      <ul className="divide-y rounded-xl border" data-testid="estoque-produtos">
        {produtos.map((p) => (
          <LinhaDoProduto
            key={p.product_id}
            produto={p}
            dados={dados}
            aberto={aberto === p.product_id}
            alternar={() => setAberto((a) => (a === p.product_id ? null : p.product_id))}
          />
        ))}
      </ul>
    </div>
  );
}

function LinhaDoProduto({
  produto: p,
  dados,
  aberto,
  alternar,
}: {
  produto: ProdutoNaPosicao;
  dados: DadosDoEstoque;
  aberto: boolean;
  alternar: () => void;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const [painel, setPainel] = useState<Painel>(null);
  const unidade = p.config?.unidade_aplicacao ?? "un";
  const nomeDoLocal = new Map(dados.locais.map((l) => [l.id, l.nome]));
  const dia = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(tag);
  const vencidos = p.lotes.filter((l) => l.vencido).length;
  const frascos = (dados.frascos ?? []).filter((f) => f.product_id === p.product_id);
  const fracionavel = Boolean(p.config?.fracionavel);
  const fator = p.config?.fator_conversao ?? 1;

  return (
    <li className="p-3" data-testid="estoque-produto">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
      >
        <span>
          <span className="font-medium">{p.nome}</span>
          <span className="ml-2 text-xs text-text-muted">{p.codigo}</span>
        </span>
        <span className="flex flex-wrap items-center gap-2 text-sm">
          {p.abaixo_do_minimo ? <Badge variant="warning">{t("Abaixo do mínimo")}</Badge> : null}
          {vencidos > 0 ? <Badge variant="error">{t("Lote vencido")}</Badge> : null}
          {p.config?.controlado ? <Badge variant="info">{t("Controlado")}</Badge> : null}
          {frascos.some((f) => f.vencido) ? <Badge variant="error">{t("Frasco vencido")}</Badge> : null}
          {p.proxima_validade ? (
            <span className="text-xs text-text-muted">
              {t("vence")} {dia(p.proxima_validade)}
            </span>
          ) : null}
          <span className="font-medium" data-testid="estoque-saldo">
            {quantidade(p.saldo, tag)} {unidade}
          </span>
        </span>
      </button>

      {aberto ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {dados.pode.movimentar ? (
              <Button
                size="sm"
                onClick={() => setPainel({ tipo: "entrada" })}
                data-testid="estoque-dar-entrada"
              >
                {t("Dar entrada")}
              </Button>
            ) : null}
            {dados.pode.configurar ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPainel({ tipo: "config" })}
                data-testid="estoque-configurar"
              >
                {t("Configurar produto")}
              </Button>
            ) : null}
          </div>

          {p.lotes.length === 0 ? (
            <p className="text-sm text-text-muted">{t("Sem saldo. Dê entrada para começar.")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="estoque-lotes">
                <thead className="text-left text-xs text-text-muted">
                  <tr>
                    <th className="py-1 pr-2">{t("Lote")}</th>
                    <th className="py-1 pr-2">{t("Validade")}</th>
                    <th className="py-1 pr-2">{t("Local")}</th>
                    <th className="py-1 pr-2 text-right">{t("Saldo")}</th>
                    {dados.pode.custos ? (
                      <th className="py-1 pr-2 text-right">{t("Custo unitário")}</th>
                    ) : null}
                    <th className="py-1" />
                  </tr>
                </thead>
                <tbody>
                  {p.lotes.flatMap((l) =>
                    l.por_local.map((pl) => (
                      <tr key={`${l.lote_id}-${pl.local_id}`} className="border-t">
                        <td className="py-1 pr-2">{l.codigo ?? t("sem lote")}</td>
                        <td className="py-1 pr-2">
                          {l.validade ? dia(l.validade) : "—"}
                          {l.vencido ? (
                            <Badge variant="error" className="ml-1">
                              {t("vencido")}
                            </Badge>
                          ) : null}
                          {l.bloqueado ? (
                            <Badge variant="warning" className="ml-1" data-testid="estoque-lote-bloqueado">
                              {t("bloqueado")}
                            </Badge>
                          ) : null}
                        </td>
                        <td className="py-1 pr-2">{nomeDoLocal.get(pl.local_id) ?? "—"}</td>
                        <td className="py-1 pr-2 text-right">
                          {quantidade(pl.saldo, tag)} {unidade}
                        </td>
                        {dados.pode.custos ? (
                          <td className="py-1 pr-2 text-right">
                            {l.custo_unitario_cents === null
                              ? "—"
                              : (l.custo_unitario_cents / 100).toLocaleString(tag, {
                                  style: "currency",
                                  currency: "BRL",
                                  maximumFractionDigits: 4,
                                })}
                          </td>
                        ) : null}
                        <td className="py-1 text-right">
                          <span className="inline-flex flex-wrap justify-end gap-1">
                            {dados.pode.movimentar ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setPainel({
                                      tipo: "lote",
                                      acao: "transferencia",
                                      loteId: l.lote_id,
                                      localId: pl.local_id,
                                    })
                                  }
                                >
                                  {t("Transferir")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setPainel({
                                      tipo: "lote",
                                      acao: "perda",
                                      loteId: l.lote_id,
                                      localId: pl.local_id,
                                    })
                                  }
                                >
                                  {t("Perda")}
                                </Button>
                                {fracionavel && !l.vencido && pl.saldo >= fator ? (
                                  <BotaoAbrirFrasco loteId={l.lote_id} localId={pl.local_id} />
                                ) : null}
                              </>
                            ) : null}
                            {dados.pode.configurar ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setPainel({ tipo: "bloqueio", loteId: l.lote_id, bloqueado: l.bloqueado })}
                                data-testid="estoque-lote-bloquear"
                              >
                                {t(l.bloqueado ? "Desbloquear" : "Bloquear")}
                              </Button>
                            ) : null}
                            {dados.pode.inventariar ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setPainel({
                                    tipo: "lote",
                                    acao: "ajuste",
                                    loteId: l.lote_id,
                                    localId: pl.local_id,
                                  })
                                }
                              >
                                {t("Ajustar")}
                              </Button>
                            ) : null}
                          </span>
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          )}

          <FrascosDoProduto
            frascos={frascos}
            unidade={unidade}
            codigoDoLote={(id) => p.lotes.find((l) => l.lote_id === id)?.codigo ?? null}
            nomeDoLocal={(id) => nomeDoLocal.get(id) ?? "—"}
            podeMovimentar={dados.pode.movimentar}
          />

          {painel?.tipo === "entrada" ? (
            <FormularioDeEntrada produto={p} locais={dados.locais} fechar={() => setPainel(null)} />
          ) : null}
          {painel?.tipo === "config" ? (
            <ConfigDoProduto produto={p} fechar={() => setPainel(null)} />
          ) : null}
          {painel?.tipo === "bloqueio" ? (
            <FormularioDeBloqueio loteId={painel.loteId} bloqueado={painel.bloqueado} fechar={() => setPainel(null)} />
          ) : null}
          {painel?.tipo === "lote" ? (
            <FormularioDoLote
              acao={painel.acao}
              produto={p}
              loteId={painel.loteId}
              localId={painel.localId}
              locais={dados.locais}
              fechar={() => setPainel(null)}
            />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
