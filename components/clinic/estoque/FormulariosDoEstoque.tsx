"use client";

/**
 * FORK clinic (estoque E0) — os formulários da posição: dar entrada,
 * transferir / registrar perda / ajustar um lote num local, e configurar o
 * produto para o estoque. Tudo vai para o banco, que confere de novo
 * (permissão, lote vencido, saldo nunca negativo).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { LocalDeEstoque, ProdutoNaPosicao } from "@/lib/clinic/estoque/posicao";
import { CATEGORIAS_DE_PERDA, CONSELHOS } from "@/lib/clinic/estoque/schemas";

import { CHAVE_DO_ESTOQUE } from "./tipos";

const ROTULO_DA_CATEGORIA: Record<(typeof CATEGORIAS_DE_PERDA)[number], string> = {
  vencimento: "Vencimento",
  quebra: "Quebra",
  contaminacao: "Contaminação",
  pos_abertura: "Prazo após aberto",
  recolhimento: "Recolhimento (recall)",
  outro: "Outro",
};

export type AcaoDoLote = "transferencia" | "perda" | "ajuste";

const SELECT = "h-11 w-full rounded-md border bg-surface px-2 text-sm md:h-9";
const CAIXA = "space-y-3 rounded-lg border bg-muted/30 p-3";
const numero = (s: string): number => Number(s.replace(",", "."));

function useRecarregar() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: [...CHAVE_DO_ESTOQUE] });
    void qc.invalidateQueries({ queryKey: ["clinic", "estoque", "movimentos"] });
  };
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-xs">
      <span className="block font-medium">{rotulo}</span>
      {children}
    </label>
  );
}

export function FormularioDeEntrada({
  produto,
  locais,
  fechar,
}: {
  produto: ProdutoNaPosicao;
  locais: LocalDeEstoque[];
  fechar: () => void;
}) {
  const t = useT();
  const recarregar = useRecarregar();
  const cfg = produto.config;
  const ativos = locais.filter((l) => l.ativo);
  const [localId, setLocalId] = useState(ativos.find((l) => l.padrao)?.id ?? ativos[0]?.id ?? "");
  const [qtd, setQtd] = useState("");
  const [emEstoque, setEmEstoque] = useState(!!cfg && cfg.fator_conversao !== 1);
  const [lote, setLote] = useState("");
  const [validade, setValidade] = useState("");
  const [custo, setCusto] = useState("");
  const [motivo, setMotivo] = useState("");

  const salvar = useMutation({
    mutationFn: () =>
      apiClient.post("/api/v1/clinic/estoque/movimentos", {
        acao: "entrada",
        product_id: produto.product_id,
        local_id: localId,
        quantidade: numero(qtd),
        em_unidade_estoque: emEstoque,
        lote: lote.trim() || null,
        validade: validade || null,
        custo_unitario_cents: custo.trim() ? Math.round(numero(custo) * 100 * 10000) / 10000 : null,
        motivo: motivo.trim() || null,
      }),
    onSuccess: () => {
      recarregar();
      fechar();
    },
    onError: showApiError,
  });

  const unidade = emEstoque ? (cfg?.unidade_estoque ?? "un") : (cfg?.unidade_aplicacao ?? "un");
  return (
    <form
      className={CAIXA}
      data-testid="estoque-form-entrada"
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
    >
      <p className="text-sm font-medium">{t("Dar entrada")}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo rotulo={t("Local")}>
          <select
            className={SELECT}
            value={localId}
            onChange={(e) => setLocalId(e.target.value)}
            required
          >
            {ativos.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo={`${t("Quantidade")} (${unidade})`}>
          <Input
            inputMode="decimal"
            value={qtd}
            onChange={(e) => setQtd(e.target.value)}
            required
            data-testid="estoque-entrada-qtd"
          />
        </Campo>
        {cfg && cfg.fator_conversao !== 1 ? (
          <Campo rotulo={t("Contar em")}>
            <select
              className={SELECT}
              value={emEstoque ? "estoque" : "aplicacao"}
              onChange={(e) => setEmEstoque(e.target.value === "estoque")}
            >
              <option value="estoque">
                {cfg.unidade_estoque} (= {cfg.fator_conversao} {cfg.unidade_aplicacao})
              </option>
              <option value="aplicacao">{cfg.unidade_aplicacao}</option>
            </select>
          </Campo>
        ) : null}
        <Campo rotulo={cfg?.rastreado ? t("Lote (obrigatório)") : t("Lote")}>
          <Input
            value={lote}
            maxLength={60}
            onChange={(e) => setLote(e.target.value)}
            required={!!cfg?.rastreado}
            data-testid="estoque-entrada-lote"
          />
        </Campo>
        <Campo rotulo={cfg?.rastreado ? t("Validade (obrigatória)") : t("Validade")}>
          <Input
            type="date"
            value={validade}
            onChange={(e) => setValidade(e.target.value)}
            required={!!cfg?.rastreado}
          />
        </Campo>
        <Campo rotulo={`${t("Custo por")} ${unidade} (R$)`}>
          <Input inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)} />
        </Campo>
      </div>
      <Campo rotulo={t("Observação")}>
        <Input value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
      </Campo>
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={salvar.isPending || !localId || !(numero(qtd) > 0)}
          data-testid="estoque-entrada-salvar"
        >
          {salvar.isPending ? t("Salvando…") : t("Registrar entrada")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={fechar}>
          {t("Cancelar")}
        </Button>
      </div>
    </form>
  );
}

export function FormularioDoLote({
  acao,
  produto,
  loteId,
  localId,
  locais,
  fechar,
}: {
  acao: AcaoDoLote;
  produto: ProdutoNaPosicao;
  loteId: string;
  localId: string;
  locais: LocalDeEstoque[];
  fechar: () => void;
}) {
  const t = useT();
  const recarregar = useRecarregar();
  const destinos = locais.filter((l) => l.ativo && l.id !== localId);
  const [destino, setDestino] = useState(destinos[0]?.id ?? "");
  const [qtd, setQtd] = useState("");
  const [motivo, setMotivo] = useState("");
  const [categoria, setCategoria] = useState<(typeof CATEGORIAS_DE_PERDA)[number]>("outro");
  const unidade = produto.config?.unidade_aplicacao ?? "un";

  const corpo = () =>
    acao === "transferencia"
      ? {
          acao,
          lote_id: loteId,
          origem_id: localId,
          destino_id: destino,
          quantidade: numero(qtd),
          motivo: motivo.trim() || null,
        }
      : acao === "perda"
        ? {
            acao,
            lote_id: loteId,
            local_id: localId,
            quantidade: numero(qtd),
            motivo: motivo.trim(),
            categoria,
          }
        : {
            acao,
            lote_id: loteId,
            local_id: localId,
            saldo_correto: numero(qtd),
            motivo: motivo.trim(),
          };
  const salvar = useMutation({
    mutationFn: () => apiClient.post("/api/v1/clinic/estoque/movimentos", corpo()),
    onSuccess: () => {
      recarregar();
      fechar();
    },
    onError: showApiError,
  });

  const titulo =
    acao === "transferencia"
      ? "Transferir para outro local"
      : acao === "perda"
        ? "Registrar perda"
        : "Ajustar para o saldo contado";
  const exigeMotivo = acao !== "transferencia";
  return (
    <form
      className={CAIXA}
      data-testid={`estoque-form-${acao}`}
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
    >
      <p className="text-sm font-medium">{t(titulo)}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {acao === "transferencia" ? (
          <Campo rotulo={t("Para")}>
            <select
              className={SELECT}
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              required
            >
              {destinos.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
          </Campo>
        ) : null}
        <Campo rotulo={`${t(acao === "ajuste" ? "Saldo contado" : "Quantidade")} (${unidade})`}>
          <Input
            inputMode="decimal"
            value={qtd}
            onChange={(e) => setQtd(e.target.value)}
            required
            data-testid={`estoque-${acao}-qtd`}
          />
        </Campo>
        {acao === "perda" ? (
          <Campo rotulo={t("Categoria")}>
            <select
              className={SELECT}
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as (typeof CATEGORIAS_DE_PERDA)[number])}
              data-testid="estoque-perda-categoria"
            >
              {CATEGORIAS_DE_PERDA.map((c) => (
                <option key={c} value={c}>
                  {t(ROTULO_DA_CATEGORIA[c])}
                </option>
              ))}
            </select>
          </Campo>
        ) : null}
        <Campo rotulo={exigeMotivo ? t("Motivo (obrigatório)") : t("Observação")}>
          <Input
            value={motivo}
            maxLength={300}
            onChange={(e) => setMotivo(e.target.value)}
            required={exigeMotivo}
            minLength={exigeMotivo ? 3 : undefined}
          />
        </Campo>
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={salvar.isPending || (acao === "transferencia" && !destino) || qtd.trim() === ""}
          data-testid={`estoque-${acao}-salvar`}
        >
          {salvar.isPending ? t("Salvando…") : t("Confirmar")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={fechar}>
          {t("Cancelar")}
        </Button>
      </div>
    </form>
  );
}

export function ConfigDoProduto({
  produto,
  fechar,
}: {
  produto: ProdutoNaPosicao;
  fechar: () => void;
}) {
  const t = useT();
  const recarregar = useRecarregar();
  const c = produto.config;
  const [f, setF] = useState({
    ean: c?.ean ?? "",
    ncm: c?.ncm ?? "",
    registro_anvisa: c?.registro_anvisa ?? "",
    unidade_estoque: c?.unidade_estoque ?? "un",
    unidade_aplicacao: c?.unidade_aplicacao ?? "un",
    fator_conversao: String(c?.fator_conversao ?? 1),
    fracionavel: c?.fracionavel ?? false,
    validade_pos_abertura_horas: c?.validade_pos_abertura_horas
      ? String(c.validade_pos_abertura_horas)
      : "",
    rastreado: c?.rastreado ?? false,
    controlado: c?.controlado ?? false,
    conselhos_permitidos: c?.conselhos_permitidos ?? [],
    estoque_minimo: String(c?.estoque_minimo ?? 0),
    ponto_pedido:
      c?.ponto_pedido !== null && c?.ponto_pedido !== undefined ? String(c.ponto_pedido) : "",
    gerenciado: c?.gerenciado ?? true,
  });
  const mudar = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  const salvar = useMutation({
    mutationFn: () =>
      apiClient.put(`/api/v1/clinic/estoque/produtos/${produto.product_id}`, {
        ean: f.ean.trim() || null,
        ncm: f.ncm.trim() || null,
        registro_anvisa: f.registro_anvisa.trim() || null,
        unidade_estoque: f.unidade_estoque.trim() || "un",
        unidade_aplicacao: f.unidade_aplicacao.trim() || "un",
        fator_conversao: numero(f.fator_conversao) || 1,
        fracionavel: f.fracionavel,
        validade_pos_abertura_horas: f.validade_pos_abertura_horas
          ? Math.round(numero(f.validade_pos_abertura_horas))
          : null,
        rastreado: f.rastreado,
        controlado: f.controlado,
        conselhos_permitidos: f.controlado ? f.conselhos_permitidos.filter((x) => x !== "outro") : [],
        estoque_minimo: numero(f.estoque_minimo) || 0,
        ponto_pedido: f.ponto_pedido.trim() ? numero(f.ponto_pedido) : null,
        gerenciado: f.gerenciado,
        versao: c?.versao ?? null,
      }),
    onSuccess: () => {
      recarregar();
      fechar();
    },
    onError: showApiError,
  });

  const marca = (
    rotulo: string,
    chave: "fracionavel" | "rastreado" | "controlado" | "gerenciado",
    ajuda: string,
  ) => (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-1"
        checked={f[chave]}
        onChange={(e) => mudar({ [chave]: e.target.checked })}
      />
      <span>
        {rotulo}
        <span className="block text-xs text-text-muted">{ajuda}</span>
      </span>
    </label>
  );

  return (
    <form
      className={CAIXA}
      data-testid="estoque-form-config"
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
    >
      <p className="text-sm font-medium">{t("Configurar produto para o estoque")}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo rotulo={t("Unidade de compra/estoque")}>
          <Input
            value={f.unidade_estoque}
            maxLength={20}
            onChange={(e) => mudar({ unidade_estoque: e.target.value })}
            placeholder="frasco"
          />
        </Campo>
        <Campo rotulo={t("Unidade de aplicação")}>
          <Input
            value={f.unidade_aplicacao}
            maxLength={20}
            onChange={(e) => mudar({ unidade_aplicacao: e.target.value })}
            placeholder="U"
          />
        </Campo>
        <Campo rotulo={t("Quantas unidades de aplicação em 1 de estoque")}>
          <Input
            inputMode="decimal"
            value={f.fator_conversao}
            onChange={(e) => mudar({ fator_conversao: e.target.value })}
          />
        </Campo>
        <Campo rotulo={t("Estoque mínimo (unidade de aplicação)")}>
          <Input
            inputMode="decimal"
            value={f.estoque_minimo}
            onChange={(e) => mudar({ estoque_minimo: e.target.value })}
          />
        </Campo>
        <Campo rotulo={t("Ponto de pedido")}>
          <Input
            inputMode="decimal"
            value={f.ponto_pedido}
            onChange={(e) => mudar({ ponto_pedido: e.target.value })}
          />
        </Campo>
        <Campo rotulo={f.fracionavel ? t("Validade depois de aberto (horas, obrigatório)") : t("Validade depois de aberto (horas)")}>
          <Input
            inputMode="numeric"
            value={f.validade_pos_abertura_horas}
            onChange={(e) => mudar({ validade_pos_abertura_horas: e.target.value })}
            required={f.fracionavel}
          />
        </Campo>
        <Campo rotulo="EAN">
          <Input
            inputMode="numeric"
            value={f.ean}
            maxLength={14}
            onChange={(e) => mudar({ ean: e.target.value })}
          />
        </Campo>
        <Campo rotulo="NCM">
          <Input
            inputMode="numeric"
            value={f.ncm}
            maxLength={8}
            onChange={(e) => mudar({ ncm: e.target.value })}
          />
        </Campo>
        <Campo rotulo={t("Registro na ANVISA")}>
          <Input
            value={f.registro_anvisa}
            maxLength={40}
            onChange={(e) => mudar({ registro_anvisa: e.target.value })}
          />
        </Campo>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {marca(t("Rastreado por lote"), "rastreado", t("Toda entrada exige lote e validade."))}
        {marca(t("Fracionável"), "fracionavel", t("Um frasco atende vários pacientes (ex.: toxina)."))}
        {marca(t("Controlado"), "controlado", t("Só profissionais dos conselhos marcados podem usar."))}
        {marca(t("Controlar a quantidade pelo estoque"), "gerenciado", t("A quantidade do cadastro de produtos passa a vir do estoque."))}
      </div>
      {f.controlado ? (
        <fieldset className="flex flex-wrap gap-3 text-sm">
          <legend className="mb-1 text-xs font-medium">{t("Conselhos que podem usar")}</legend>
          {/* "outro" não identifica a habilitação: não vale para produto controlado */}
          {CONSELHOS.filter((cons) => cons !== "outro").map((cons) => (
            <label key={cons} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={f.conselhos_permitidos.includes(cons)}
                onChange={(e) =>
                  mudar({
                    conselhos_permitidos: e.target.checked
                      ? [...f.conselhos_permitidos, cons]
                      : f.conselhos_permitidos.filter((x) => x !== cons),
                  })
                }
              />
              {cons}
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={salvar.isPending}
          data-testid="estoque-config-salvar"
        >
          {salvar.isPending ? t("Salvando…") : t("Salvar")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={fechar}>
          {t("Cancelar")}
        </Button>
      </div>
    </form>
  );
}

/**
 * Estoque E10 — bloquear (recall, quarentena) ou desbloquear um lote, com
 * motivo. Lote bloqueado sai da FEFO: o sistema não o escolhe para paciente.
 */
export function FormularioDeBloqueio({
  loteId,
  bloqueado,
  fechar,
}: {
  loteId: string;
  bloqueado: boolean;
  fechar: () => void;
}) {
  const t = useT();
  const recarregar = useRecarregar();
  const [motivo, setMotivo] = useState("");
  const salvar = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/v1/clinic/estoque/lotes/${loteId}/bloqueio`, { bloquear: !bloqueado, motivo: motivo.trim() }),
    onSuccess: () => {
      recarregar();
      fechar();
    },
    onError: showApiError,
  });
  return (
    <form
      className={CAIXA}
      data-testid="estoque-form-bloqueio"
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
    >
      <p className="text-sm font-medium">{t(bloqueado ? "Desbloquear lote" : "Bloquear lote")}</p>
      {bloqueado ? null : (
        <p className="text-xs text-text-muted">
          {t("O lote bloqueado não é escolhido automaticamente para nenhum paciente (recall ou quarentena).")}
        </p>
      )}
      <Campo rotulo={t("Motivo (obrigatório)")}>
        <Input
          value={motivo}
          maxLength={300}
          minLength={3}
          required
          onChange={(e) => setMotivo(e.target.value)}
          data-testid="estoque-bloqueio-motivo"
        />
      </Campo>
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={salvar.isPending || motivo.trim().length < 3}
          data-testid="estoque-bloqueio-salvar"
        >
          {salvar.isPending ? t("Salvando…") : t("Confirmar")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={fechar}>
          {t("Cancelar")}
        </Button>
      </div>
    </form>
  );
}
