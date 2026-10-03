"use client";

/**
 * FORK clinic (estoque E8) — relatórios do estoque.
 *
 * Consumo nos atendimentos (por procedimento, profissional ou produto), perdas
 * por motivo e sugestão de compra — sem paciente; custo só para quem vê custos.
 * O rastreio de lote (recall: quais pacientes receberam um lote) só aparece
 * para quem tem a chave clínica `estoque.rastreio_lote`, e cada consulta fica
 * registrada.
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Input } from "@/components/ui/input";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { usePermissoes } from "@/lib/clinic/acesso/use-permissoes";

import { quantidade } from "./tipos";

type Agrupar = "procedimento" | "profissional" | "produto";
interface LinhaConsumo {
  grupo_id: string | null;
  grupo: string | null;
  produto: string;
  unidade: string;
  quantidade: number;
  atendimentos: number;
  custo_cents: number | null;
}
interface LinhaPerda {
  produto: string;
  unidade: string;
  motivo: string;
  quantidade: number;
  ocorrencias: number;
  custo_cents: number | null;
}
interface LinhaCompra {
  produto: string;
  unidade_aplicacao: string;
  unidade_estoque: string;
  disponivel: number;
  nivel: number;
  sugerido: number;
}
interface Rastreio {
  lote: { codigo: string | null; validade: string | null; produto: string };
  pacientes: Array<{ contact_id: string; paciente: string | null; data: string; profissional: string | null; quantidade: number }>;
}

const SELECT = "h-11 rounded-md border bg-surface px-2 text-sm md:h-9";
const dataIso = (d: Date) => d.toISOString().slice(0, 10);

function useRelatorio<T>(caminho: string | null) {
  return useQuery({
    queryKey: ["clinic", "estoque", "relatorio", caminho],
    enabled: Boolean(caminho),
    queryFn: async () => (await apiClient.get<{ data: { linhas: T[] } }>(caminho!)).data.linhas,
  });
}

export function RelatoriosDoEstoque() {
  const t = useT();
  const tag = useTagDeIdioma();
  const { can } = usePermissoes();
  // período inicial: os últimos 30 dias (calculado uma vez, fora da renderização)
  const [de, setDe] = useState(() => dataIso(new Date(new Date().getTime() - 30 * 86_400_000)));
  const [ate, setAte] = useState(() => dataIso(new Date()));
  const [agrupar, setAgrupar] = useState<Agrupar>("procedimento");
  const periodo = `de=${de}&ate=${ate}`;
  const consumo = useRelatorio<LinhaConsumo>(`/api/v1/clinic/estoque/relatorios/consumo?${periodo}&agrupar=${agrupar}`);
  const perdas = useRelatorio<LinhaPerda>(`/api/v1/clinic/estoque/relatorios/perdas?${periodo}`);
  const compra = useRelatorio<LinhaCompra>("/api/v1/clinic/estoque/relatorios/compra");
  const reais = (c: number | null) => (c === null ? "—" : (c / 100).toLocaleString(tag, { style: "currency", currency: "BRL" }));
  const grafico = (consumo.data ?? []).some((l) => l.custo_cents !== null)
    ? Object.values(
        (consumo.data ?? []).reduce<Record<string, { nome: string; custo: number }>>((acc, l) => {
          const nome = (agrupar === "produto" ? l.produto : l.grupo) ?? t("Sem informação");
          acc[nome] = { nome, custo: (acc[nome]?.custo ?? 0) + (l.custo_cents ?? 0) / 100 };
          return acc;
        }, {}),
      )
    : [];

  return (
    <div className="space-y-6" data-testid="estoque-relatorios">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs">
          {t("De")}
          <Input type="date" className="h-11 md:h-9" value={de} onChange={(e) => setDe(e.target.value)} />
        </label>
        <label className="grid gap-1 text-xs">
          {t("Até")}
          <Input type="date" className="h-11 md:h-9" value={ate} onChange={(e) => setAte(e.target.value)} />
        </label>
      </div>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t("Consumo nos atendimentos")}</h2>
          <select className={SELECT} value={agrupar} onChange={(e) => setAgrupar(e.target.value as Agrupar)} aria-label={t("Agrupar por")} data-testid="relatorio-agrupar">
            <option value="procedimento">{t("Por procedimento")}</option>
            <option value="profissional">{t("Por profissional")}</option>
            <option value="produto">{t("Por produto")}</option>
          </select>
        </div>
        {grafico.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={grafico} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="nome" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
              <Tooltip
                formatter={(v) => [Number(v).toLocaleString(tag, { style: "currency", currency: "BRL" }), t("Custo")]}
                contentStyle={{ borderRadius: "8px", fontSize: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))" }}
              />
              <Bar dataKey="custo" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : null}
        <Tabela
          vazio={t("Nenhum consumo no período.")}
          carregando={consumo.isLoading}
          cabecalho={[agrupar === "produto" ? null : t(agrupar === "procedimento" ? "Procedimento" : "Profissional"), t("Produto"), t("Quantidade"), t("Atendimentos"), t("Custo")]}
          linhas={(consumo.data ?? []).map((l) => [
            agrupar === "produto" ? null : (l.grupo ?? t("Sem informação")),
            l.produto,
            `${quantidade(l.quantidade, tag)} ${l.unidade}`,
            String(l.atendimentos),
            reais(l.custo_cents),
          ])}
          testid="relatorio-consumo"
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("Perdas")}</h2>
        <Tabela
          vazio={t("Nenhuma perda no período.")}
          carregando={perdas.isLoading}
          cabecalho={[t("Produto"), t("Motivo"), t("Quantidade"), t("Vezes"), t("Custo")]}
          linhas={(perdas.data ?? []).map((l) => [l.produto, t(l.motivo), `${quantidade(l.quantidade, tag)} ${l.unidade}`, String(l.ocorrencias), reais(l.custo_cents)])}
          testid="relatorio-perdas"
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("Sugestão de compra")}</h2>
        <p className="text-xs text-text-muted">{t("Produtos no ponto de pedido ou abaixo do mínimo; a sugestão repõe até o dobro do nível de alerta.")}</p>
        <Tabela
          vazio={t("Nada a comprar agora.")}
          carregando={compra.isLoading}
          cabecalho={[t("Produto"), t("Disponível"), t("Nível de alerta"), t("Comprar")]}
          linhas={(compra.data ?? []).map((l) => [
            l.produto,
            `${quantidade(l.disponivel, tag)} ${l.unidade_aplicacao}`,
            `${quantidade(l.nivel, tag)} ${l.unidade_aplicacao}`,
            `${l.sugerido} ${l.unidade_estoque}`,
          ])}
          testid="relatorio-compra"
        />
      </section>

      {can("estoque.rastreio_lote") ? <RastreioDeLote /> : null}
    </div>
  );
}

function Tabela({
  cabecalho,
  linhas,
  vazio,
  carregando,
  testid,
}: {
  cabecalho: Array<string | null>;
  linhas: Array<Array<string | null>>;
  vazio: string;
  carregando: boolean;
  testid: string;
}) {
  const t = useT();
  if (carregando) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (linhas.length === 0) return <p className="text-sm text-text-muted">{vazio}</p>;
  const visiveis = cabecalho.map((c) => c !== null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid={testid}>
        <thead className="text-left text-xs text-text-muted">
          <tr>{cabecalho.map((c, i) => (visiveis[i] ? <th key={i} className="py-1 pr-2">{c}</th> : null))}</tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-t">
              {l.map((c, j) => (visiveis[j] ? <td key={j} className="py-1 pr-2">{c}</td> : null))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RastreioDeLote() {
  const t = useT();
  const tag = useTagDeIdioma();
  const [lote, setLote] = useState("");
  const todos = useQuery({
    queryKey: ["clinic", "estoque", "lotes"],
    queryFn: async () =>
      (await apiClient.get<{ data: { lotes: Array<{ id: string; codigo: string; validade: string | null; produto: string }> } }>("/api/v1/clinic/estoque/lotes")).data.lotes,
  });
  const lotes = (todos.data ?? []).map((l) => ({
    id: l.id,
    rotulo: `${l.produto} · ${t("lote")} ${l.codigo}${l.validade ? ` · ${new Date(`${l.validade}T12:00:00`).toLocaleDateString(tag)}` : ""}`,
  }));
  const q = useQuery({
    queryKey: ["clinic", "estoque", "rastreio", lote],
    enabled: Boolean(lote),
    queryFn: async () => (await apiClient.get<{ data: Rastreio }>(`/api/v1/clinic/estoque/relatorios/rastreio?lote=${lote}`)).data,
  });
  return (
    <section className="space-y-2 rounded-lg border p-3" data-testid="relatorio-rastreio">
      <h2 className="text-base font-semibold">{t("Rastreio de lote (recall)")}</h2>
      <p className="text-xs text-text-muted">{t("Mostra quais pacientes receberam o lote. Cada consulta fica registrada.")}</p>
      <select className={SELECT} value={lote} onChange={(e) => setLote(e.target.value)} aria-label={t("Lote")} data-testid="relatorio-rastreio-lote">
        <option value="">{t("Escolha o lote…")}</option>
        {lotes.map((l) => (
          <option key={l.id} value={l.id}>
            {l.rotulo}
          </option>
        ))}
      </select>
      {q.data ? (
        q.data.pacientes.length === 0 ? (
          <p className="text-sm text-text-muted">{t("Nenhum paciente recebeu este lote.")}</p>
        ) : (
          <ul className="divide-y text-sm">
            {q.data.pacientes.map((p, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-1">
                <span>{p.paciente ?? "—"}</span>
                <span className="text-xs text-text-muted">
                  {new Date(p.data).toLocaleDateString(tag)} · {p.profissional ?? "—"} · {quantidade(p.quantidade, tag)}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
