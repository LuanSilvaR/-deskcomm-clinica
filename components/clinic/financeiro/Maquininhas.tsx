"use client";

/**
 * FORK clinic (financeiro FN1) — Configurações › Maquininhas.
 *
 * Cadastro das adquirentes (prazos, tarifa, antecipação), as tabelas de taxa
 * por VIGÊNCIA (publicar de novo nunca muda o que já foi vendido), o tipo de
 * cada forma de pagamento e o simulador de recebimento líquido.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { MODELOS_DE_ADQUIRENTE } from "@/lib/clinic/financeiro/modelos";
import { TIPOS_DE_FORMA } from "@/lib/clinic/financeiro/schemas";
import type { AdquirenteNaTela, FormaNaTela, Simulacao } from "@/lib/clinic/financeiro/servidor";
import { BANDEIRAS, type Bandeira, type LinhaDeTaxa, type Modalidade } from "@/lib/clinic/financeiro/taxas";
import { formatCentsBRL, parseReaisToCents } from "@/lib/money";

const CHAVE = ["clinic", "financeiro", "maquininhas"] as const;
const SELECT = "h-11 rounded-md border bg-surface px-2 text-sm md:h-9";

const ROTULO_DA_MODALIDADE: Record<Modalidade, string> = { pix: "Pix", debito: "Débito", credito: "Crédito" };
const ROTULO_DO_TIPO: Record<(typeof TIPOS_DE_FORMA)[number], string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  debito: "Débito",
  credito: "Crédito",
  boleto: "Boleto",
  transferencia: "Transferência",
  outro: "Outro",
};
const ROTULO_DA_BANDEIRA: Record<Bandeira, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  elo: "Elo",
  amex: "Amex",
  hipercard: "Hipercard",
  outras: "Outras",
};

interface Dados {
  ligado: boolean;
  adquirentes: AdquirenteNaTela[];
  formas: FormaNaTela[];
}

const pct = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
const hojeLocal = () => new Intl.DateTimeFormat("en-CA").format(new Date());
const amanhaLocal = () => new Intl.DateTimeFormat("en-CA").format(new Date(Date.now() + 86_400_000));

export function Maquininhas({ podeConfigurar }: { podeConfigurar: boolean }) {
  const t = useT();
  const q = useQuery({
    queryKey: [...CHAVE],
    queryFn: async () => (await apiClient.get<{ data: Dados }>("/api/v1/clinic/financeiro/maquininhas")).data,
  });
  if (q.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (!q.data) return <p className="text-sm text-text-muted">{t("Não foi possível carregar as maquininhas.")}</p>;
  const d = q.data;
  const editar = podeConfigurar && d.ligado;

  return (
    <div className="space-y-8">
      {!d.ligado ? (
        <p className="rounded-xl border bg-muted p-4 text-sm" data-testid="fin-desligado">
          {t("O financeiro da clínica está desligado. Quem administra liga em Configurações › Profissionais.")}
        </p>
      ) : null}

      <section className="space-y-3" aria-labelledby="fin-maq-titulo">
        <h2 id="fin-maq-titulo" className="text-lg font-semibold">
          {t("Maquininhas")}
        </h2>
        {d.adquirentes.length === 0 ? (
          <p className="text-sm text-text-muted">{t("Nenhuma maquininha cadastrada ainda.")}</p>
        ) : (
          <ul className="space-y-3" data-testid="fin-adquirentes">
            {d.adquirentes.map((a) => (
              <CartaoDaAdquirente key={a.id} a={a} editar={editar} />
            ))}
          </ul>
        )}
        {editar ? <NovaAdquirente /> : null}
      </section>

      <section className="space-y-3" aria-labelledby="fin-formas-titulo">
        <h2 id="fin-formas-titulo" className="text-lg font-semibold">
          {t("Formas de pagamento")}
        </h2>
        <p className="text-sm text-text-muted">
          {t("Diga o tipo de cada forma e por qual maquininha ela passa. É isso que permite calcular a taxa no fechamento da comanda.")}
        </p>
        <ul className="divide-y rounded-xl border" data-testid="fin-formas">
          {d.formas.map((f) => (
            <LinhaDaForma key={f.id} f={f} adquirentes={d.adquirentes} editar={editar} />
          ))}
          {d.formas.length === 0 ? (
            <li className="p-3 text-sm text-text-muted">
              {t("Cadastre as formas de pagamento em Configurações › Financeiro.")}
            </li>
          ) : null}
        </ul>
      </section>

      {d.adquirentes.some((a) => a.tabelas.length > 0) ? <Simulador adquirentes={d.adquirentes} /> : null}
    </div>
  );
}

function useRecarregar() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: [...CHAVE] });
}

function CartaoDaAdquirente({ a, editar }: { a: AdquirenteNaTela; editar: boolean }) {
  const t = useT();
  const [editando, setEditando] = useState<"nada" | "prazos" | "taxas">("nada");
  const vigente = a.tabelas.find((x) => x.vigente_desde <= hojeLocal()) ?? null;
  const futura = a.tabelas.find((x) => x.vigente_desde > hojeLocal()) ?? null;
  return (
    <li className="rounded-xl border p-4" data-testid="fin-adquirente">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {a.nome}
            {!a.ativo ? <Badge variant="secondary">{t("inativa")}</Badge> : null}
          </p>
          <p className="text-xs text-text-muted">
            {t("Recebe")}: Pix D+{a.prazo_pix_dias} · {t("débito")} D+{a.prazo_debito_dias} · {t("crédito")} D+
            {a.prazo_credito_dias}
            {a.tarifa_fixa_cents > 0 ? ` · ${t("tarifa")} ${formatCentsBRL(a.tarifa_fixa_cents)}` : ""}
            {a.antecipacao_pct > 0
              ? ` · ${t("antecipação")} ${pct(a.antecipacao_pct)}${a.antecipacao_modo === "por_mes" ? ` ${t("ao mês")}` : ""}`
              : ""}
          </p>
        </div>
        {editar ? (
          <span className="flex flex-wrap gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditando(editando === "prazos" ? "nada" : "prazos")}>
              {t("Prazos e antecipação")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              data-testid="fin-editar-taxas"
              onClick={() => setEditando(editando === "taxas" ? "nada" : "taxas")}
            >
              {t("Editar taxas")}
            </Button>
          </span>
        ) : null}
      </div>

      {vigente ? (
        <TabelaDeLinhas linhas={vigente.linhas} titulo={`${t("Valendo desde")} ${vigente.vigente_desde}`} />
      ) : (
        <p className="mt-2 text-sm text-text-muted">{t("Sem tabela de taxas ainda.")}</p>
      )}
      {futura ? (
        <TabelaDeLinhas linhas={futura.linhas} titulo={`${t("Programada para")} ${futura.vigente_desde}`} />
      ) : null}

      {editando === "prazos" ? <FormularioDePrazos a={a} aoSalvar={() => setEditando("nada")} /> : null}
      {editando === "taxas" ? (
        <EditorDeTaxas
          adquirenteId={a.id}
          linhasIniciais={(futura ?? vigente)?.linhas ?? []}
          primeira={a.tabelas.length === 0}
          aoPublicar={() => setEditando("nada")}
        />
      ) : null}
    </li>
  );
}

function TabelaDeLinhas({ linhas, titulo }: { linhas: LinhaDeTaxa[]; titulo: string }) {
  const t = useT();
  return (
    <div className="mt-3 overflow-x-auto">
      <p className="mb-1 text-xs font-medium text-text-muted">{titulo}</p>
      <table className="w-full min-w-[22rem] text-sm">
        <thead>
          <tr className="text-left text-xs text-text-muted">
            <th className="py-1 pr-2 font-medium">{t("Forma")}</th>
            <th className="py-1 pr-2 font-medium">{t("Parcelas")}</th>
            <th className="py-1 pr-2 font-medium">{t("Bandeira")}</th>
            <th className="py-1 text-right font-medium">{t("Taxa")}</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-t">
              <td className="py-1 pr-2">{t(ROTULO_DA_MODALIDADE[l.modalidade])}</td>
              <td className="py-1 pr-2">
                {l.parcelas_de === l.parcelas_ate ? `${l.parcelas_de}x` : `${l.parcelas_de}x–${l.parcelas_ate}x`}
              </td>
              <td className="py-1 pr-2">{l.bandeira ? ROTULO_DA_BANDEIRA[l.bandeira] : t("Todas")}</td>
              <td className="py-1 text-right tabular-nums">{pct(l.mdr_pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NovaAdquirente() {
  const t = useT();
  const recarregar = useRecarregar();
  const [nome, setNome] = useState("");
  const [modelo, setModelo] = useState<string>("");
  const criar = useMutation({
    mutationFn: async () => {
      const m = MODELOS_DE_ADQUIRENTE.find((x) => x.chave === modelo);
      const r = await apiClient.post<{ data: { id: string } }>("/api/v1/clinic/financeiro/adquirentes", {
        nome: nome.trim() || m?.nome || "",
        ...(m ? { modelo: m.chave, ...m.adquirente } : {}),
      });
      if (m) {
        await apiClient.post(`/api/v1/clinic/financeiro/adquirentes/${r.data.id}/tabelas`, {
          vigente_desde: hojeLocal(),
          linhas: m.linhas,
        });
      }
    },
    onSuccess: () => {
      setNome("");
      setModelo("");
      recarregar();
    },
    onError: showApiError,
  });
  const escolhido = MODELOS_DE_ADQUIRENTE.find((x) => x.chave === modelo);
  return (
    <form
      className="space-y-2 rounded-xl border border-dashed p-4"
      onSubmit={(e) => {
        e.preventDefault();
        criar.mutate();
      }}
    >
      <p className="text-sm font-medium">{t("Nova maquininha")}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-xs">
          <span className="block font-medium">{t("Começar de um modelo")}</span>
          <select className={SELECT} value={modelo} onChange={(e) => setModelo(e.target.value)} data-testid="fin-modelo">
            <option value="">{t("Em branco")}</option>
            {MODELOS_DE_ADQUIRENTE.map((m) => (
              <option key={m.chave} value={m.chave}>
                {m.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="block font-medium">{t("Nome")}</span>
          <Input
            value={nome}
            maxLength={80}
            onChange={(e) => setNome(e.target.value)}
            placeholder={escolhido?.nome ?? t("Ex.: Stone da recepção")}
            className="h-11 w-64 md:h-9"
            data-testid="fin-adquirente-nome"
          />
        </label>
        <Button
          type="submit"
          size="sm"
          disabled={criar.isPending || (!nome.trim() && !escolhido)}
          data-testid="fin-adquirente-criar"
        >
          {t("Adicionar")}
        </Button>
      </div>
      {escolhido ? (
        <p className="text-xs text-text-muted" data-testid="fin-modelo-aviso">
          {t("Taxas de referência pública — ajuste ao seu contrato antes de usar.")} {t(escolhido.observacao)}
        </p>
      ) : null}
    </form>
  );
}

function FormularioDePrazos({ a, aoSalvar }: { a: AdquirenteNaTela; aoSalvar: () => void }) {
  const t = useT();
  const recarregar = useRecarregar();
  const [v, setV] = useState({
    prazo_pix_dias: a.prazo_pix_dias,
    prazo_debito_dias: a.prazo_debito_dias,
    prazo_credito_dias: a.prazo_credito_dias,
    tarifa: (a.tarifa_fixa_cents / 100).toFixed(2).replace(".", ","),
    antecipacao_pct: String(a.antecipacao_pct).replace(".", ","),
    antecipacao_modo: a.antecipacao_modo,
    ativo: a.ativo,
  });
  const salvar = useMutation({
    mutationFn: () =>
      apiClient.patch(`/api/v1/clinic/financeiro/adquirentes/${a.id}`, {
        prazo_pix_dias: Number(v.prazo_pix_dias),
        prazo_debito_dias: Number(v.prazo_debito_dias),
        prazo_credito_dias: Number(v.prazo_credito_dias),
        tarifa_fixa_cents: parseReaisToCents(v.tarifa) ?? 0,
        antecipacao_pct: Number(v.antecipacao_pct.replace(",", ".")) || 0,
        antecipacao_modo: v.antecipacao_modo,
        ativo: v.ativo,
      }),
    onSuccess: () => {
      recarregar();
      aoSalvar();
    },
    onError: showApiError,
  });
  const dia = (k: "prazo_pix_dias" | "prazo_debito_dias" | "prazo_credito_dias", rotulo: string) => (
    <label className="space-y-1 text-xs">
      <span className="block font-medium">{rotulo}</span>
      <Input
        type="number"
        min={0}
        max={400}
        value={v[k]}
        onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })}
        className="h-11 w-24 md:h-9"
      />
    </label>
  );
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
    >
      {dia("prazo_pix_dias", t("Pix (dias)"))}
      {dia("prazo_debito_dias", t("Débito (dias)"))}
      {dia("prazo_credito_dias", t("Crédito 1ª parcela (dias)"))}
      <label className="space-y-1 text-xs">
        <span className="block font-medium">{t("Tarifa por venda (R$)")}</span>
        <Input value={v.tarifa} onChange={(e) => setV({ ...v, tarifa: e.target.value })} className="h-11 w-28 md:h-9" />
      </label>
      <label className="space-y-1 text-xs">
        <span className="block font-medium">{t("Antecipação (%)")}</span>
        <Input
          value={v.antecipacao_pct}
          onChange={(e) => setV({ ...v, antecipacao_pct: e.target.value })}
          className="h-11 w-24 md:h-9"
        />
      </label>
      <label className="space-y-1 text-xs">
        <span className="block font-medium">{t("Como cobra a antecipação")}</span>
        <select
          className={SELECT}
          value={v.antecipacao_modo}
          onChange={(e) => setV({ ...v, antecipacao_modo: e.target.value as typeof v.antecipacao_modo })}
        >
          <option value="por_mes">{t("% por mês antecipado")}</option>
          <option value="fixa">{t("% fixo sobre o valor")}</option>
        </select>
      </label>
      <label className="flex h-11 items-center gap-2 text-sm md:h-9">
        <input type="checkbox" checked={v.ativo} onChange={(e) => setV({ ...v, ativo: e.target.checked })} />
        {t("Ativa")}
      </label>
      <Button type="submit" size="sm" disabled={salvar.isPending}>
        {t("Salvar")}
      </Button>
    </form>
  );
}

type LinhaEditavel = { bandeira: Bandeira | ""; modalidade: Modalidade; parcelas_de: string; parcelas_ate: string; mdr: string };

function EditorDeTaxas({
  adquirenteId,
  linhasIniciais,
  primeira,
  aoPublicar,
}: {
  adquirenteId: string;
  linhasIniciais: LinhaDeTaxa[];
  primeira: boolean;
  aoPublicar: () => void;
}) {
  const t = useT();
  const recarregar = useRecarregar();
  const [desde, setDesde] = useState(primeira ? hojeLocal() : amanhaLocal());
  const [linhas, setLinhas] = useState<LinhaEditavel[]>(
    linhasIniciais.length > 0
      ? linhasIniciais.map((l) => ({
          bandeira: l.bandeira ?? "",
          modalidade: l.modalidade,
          parcelas_de: String(l.parcelas_de),
          parcelas_ate: String(l.parcelas_ate),
          mdr: String(l.mdr_pct).replace(".", ","),
        }))
      : [{ bandeira: "", modalidade: "debito", parcelas_de: "1", parcelas_ate: "1", mdr: "" }],
  );
  const publicar = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/v1/clinic/financeiro/adquirentes/${adquirenteId}/tabelas`, {
        vigente_desde: desde,
        linhas: linhas.map((l) => {
          const umaVez = l.modalidade !== "credito";
          return {
            bandeira: l.bandeira || null,
            modalidade: l.modalidade,
            parcelas_de: umaVez ? 1 : Number(l.parcelas_de),
            parcelas_ate: umaVez ? 1 : Number(l.parcelas_ate),
            mdr_pct: Number(l.mdr.replace(",", ".")),
          };
        }),
      }),
    onSuccess: () => {
      recarregar();
      aoPublicar();
    },
    onError: showApiError,
  });
  const mudar = (i: number, p: Partial<LinhaEditavel>) => setLinhas(linhas.map((l, j) => (j === i ? { ...l, ...p } : l)));
  return (
    <form
      className="mt-3 space-y-2 border-t pt-3"
      data-testid="fin-editor-taxas"
      onSubmit={(e) => {
        e.preventDefault();
        publicar.mutate();
      }}
    >
      <p className="text-xs text-text-muted">
        {t("Publicar cria uma tabela nova a partir da data escolhida. O que já foi vendido continua com a taxa da época.")}
      </p>
      <label className="space-y-1 text-xs">
        <span className="block font-medium">{t("Vale a partir de")}</span>
        <Input
          type="date"
          value={desde}
          min={primeira ? undefined : hojeLocal()}
          onChange={(e) => setDesde(e.target.value)}
          className="h-11 w-44 md:h-9"
        />
      </label>
      <ul className="space-y-2">
        {linhas.map((l, i) => (
          <li key={i} className="flex flex-wrap items-end gap-2" data-testid="fin-linha-taxa">
            <select
              aria-label={t("Forma")}
              className={SELECT}
              value={l.modalidade}
              onChange={(e) => mudar(i, { modalidade: e.target.value as Modalidade })}
            >
              {(Object.keys(ROTULO_DA_MODALIDADE) as Modalidade[]).map((m) => (
                <option key={m} value={m}>
                  {t(ROTULO_DA_MODALIDADE[m])}
                </option>
              ))}
            </select>
            {l.modalidade === "credito" ? (
              <>
                <Input
                  aria-label={t("De (parcelas)")}
                  type="number"
                  min={1}
                  max={24}
                  value={l.parcelas_de}
                  onChange={(e) => mudar(i, { parcelas_de: e.target.value })}
                  className="h-11 w-20 md:h-9"
                />
                <span className="pb-2 text-xs text-text-muted">{t("até")}</span>
                <Input
                  aria-label={t("Até (parcelas)")}
                  type="number"
                  min={1}
                  max={24}
                  value={l.parcelas_ate}
                  onChange={(e) => mudar(i, { parcelas_ate: e.target.value })}
                  className="h-11 w-20 md:h-9"
                />
              </>
            ) : null}
            <select
              aria-label={t("Bandeira")}
              className={SELECT}
              value={l.bandeira}
              onChange={(e) => mudar(i, { bandeira: e.target.value as Bandeira | "" })}
            >
              <option value="">{t("Todas")}</option>
              {BANDEIRAS.map((b) => (
                <option key={b} value={b}>
                  {ROTULO_DA_BANDEIRA[b]}
                </option>
              ))}
            </select>
            <Input
              aria-label={t("Taxa (%)")}
              placeholder="0,00"
              value={l.mdr}
              onChange={(e) => mudar(i, { mdr: e.target.value })}
              className="h-11 w-24 md:h-9"
              data-testid="fin-linha-mdr"
            />
            <Button type="button" size="sm" variant="ghost" onClick={() => setLinhas(linhas.filter((_, j) => j !== i))}>
              {t("Remover")}
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setLinhas([...linhas, { bandeira: "", modalidade: "credito", parcelas_de: "2", parcelas_ate: "2", mdr: "" }])
          }
        >
          {t("Adicionar linha")}
        </Button>
        <Button type="submit" size="sm" disabled={publicar.isPending || linhas.length === 0} data-testid="fin-publicar-taxas">
          {t("Publicar tabela")}
        </Button>
      </div>
    </form>
  );
}

function LinhaDaForma({ f, adquirentes, editar }: { f: FormaNaTela; adquirentes: AdquirenteNaTela[]; editar: boolean }) {
  const t = useT();
  const recarregar = useRecarregar();
  const [tipo, setTipo] = useState(f.tipo ?? "");
  const [adq, setAdq] = useState(f.adquirente_id ?? "");
  const passaNaMaquina = tipo === "pix" || tipo === "debito" || tipo === "credito";
  const salvar = useMutation({
    mutationFn: () =>
      apiClient.put(`/api/v1/clinic/financeiro/formas/${f.id}`, {
        tipo,
        adquirente_id: passaNaMaquina && adq ? adq : null,
      }),
    onSuccess: recarregar,
    onError: showApiError,
  });
  const mudou = tipo !== (f.tipo ?? "") || (passaNaMaquina ? adq : "") !== (f.adquirente_id ?? "");
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm" data-testid="fin-forma">
      <span className="flex items-center gap-2">
        <span className="font-medium">{f.nome}</span>
        {!f.ativa ? <Badge variant="secondary">{t("inativa")}</Badge> : null}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <select
          aria-label={t("Tipo")}
          className={SELECT}
          value={tipo}
          disabled={!editar}
          onChange={(e) => setTipo(e.target.value)}
          data-testid="fin-forma-tipo"
        >
          <option value="" disabled>
            {t("Tipo…")}
          </option>
          {TIPOS_DE_FORMA.map((x) => (
            <option key={x} value={x}>
              {t(ROTULO_DO_TIPO[x])}
            </option>
          ))}
        </select>
        {passaNaMaquina ? (
          <select
            aria-label={t("Maquininha")}
            className={SELECT}
            value={adq}
            disabled={!editar}
            onChange={(e) => setAdq(e.target.value)}
            data-testid="fin-forma-adquirente"
          >
            <option value="">{t("Sem maquininha (sem taxa)")}</option>
            {adquirentes
              .filter((a) => a.ativo || a.id === adq)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
          </select>
        ) : null}
        {editar ? (
          <Button size="sm" disabled={!tipo || !mudou || salvar.isPending} onClick={() => salvar.mutate()} data-testid="fin-forma-salvar">
            {t("Salvar")}
          </Button>
        ) : null}
      </span>
    </li>
  );
}

function Simulador({ adquirentes }: { adquirentes: AdquirenteNaTela[] }) {
  const t = useT();
  const comTabela = adquirentes.filter((a) => a.tabelas.length > 0);
  const [adq, setAdq] = useState(comTabela[0]?.id ?? "");
  const [valor, setValor] = useState("3.500,00");
  const [modalidade, setModalidade] = useState<Modalidade>("credito");
  const [parcelas, setParcelas] = useState(6);
  const [bandeira, setBandeira] = useState<Bandeira | "">("");
  const [antecipar, setAntecipar] = useState(false);
  const [custo, setCusto] = useState("");
  const [margem, setMargem] = useState("30");
  const simular = useMutation({
    mutationFn: async () => {
      const q = new URLSearchParams({
        adquirente_id: adq,
        modalidade,
        parcelas: String(modalidade === "credito" ? parcelas : 1),
        bruto_cents: String(parseReaisToCents(valor) ?? 0),
        antecipar: String(antecipar),
        margem_pct: String(Number(margem.replace(",", ".")) || 0),
      });
      if (bandeira) q.set("bandeira", bandeira);
      if (custo.trim()) q.set("custo_cents", String(parseReaisToCents(custo) ?? 0));
      return (await apiClient.get<{ data: Simulacao }>(`/api/v1/clinic/financeiro/simular?${q.toString()}`)).data;
    },
    onError: showApiError,
  });
  const r = simular.data;
  const linha = (rotulo: string, valorCents: number, destaque = false, testid?: string) => (
    <div className={`flex justify-between gap-4 ${destaque ? "font-semibold" : ""}`} data-testid={testid}>
      <dt>{rotulo}</dt>
      <dd className="tabular-nums">{formatCentsBRL(valorCents)}</dd>
    </div>
  );
  return (
    <section className="space-y-3" aria-labelledby="fin-sim-titulo" data-testid="fin-simulador">
      <h2 id="fin-sim-titulo" className="text-lg font-semibold">
        {t("Simulador de recebimento")}
      </h2>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          simular.mutate();
        }}
      >
        <label className="space-y-1 text-xs">
          <span className="block font-medium">{t("Maquininha")}</span>
          <select className={SELECT} value={adq} onChange={(e) => setAdq(e.target.value)}>
            {comTabela.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="block font-medium">{t("Valor (R$)")}</span>
          <Input value={valor} onChange={(e) => setValor(e.target.value)} className="h-11 w-32 md:h-9" data-testid="fin-sim-valor" />
        </label>
        <label className="space-y-1 text-xs">
          <span className="block font-medium">{t("Forma")}</span>
          <select className={SELECT} value={modalidade} onChange={(e) => setModalidade(e.target.value as Modalidade)}>
            {(Object.keys(ROTULO_DA_MODALIDADE) as Modalidade[]).map((m) => (
              <option key={m} value={m}>
                {t(ROTULO_DA_MODALIDADE[m])}
              </option>
            ))}
          </select>
        </label>
        {modalidade === "credito" ? (
          <label className="space-y-1 text-xs">
            <span className="block font-medium">{t("Parcelas")}</span>
            <select
              className={SELECT}
              value={parcelas}
              onChange={(e) => setParcelas(Number(e.target.value))}
              data-testid="fin-sim-parcelas"
            >
              {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}x
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="space-y-1 text-xs">
          <span className="block font-medium">{t("Bandeira")}</span>
          <select className={SELECT} value={bandeira} onChange={(e) => setBandeira(e.target.value as Bandeira | "")}>
            <option value="">{t("Qualquer")}</option>
            {BANDEIRAS.map((b) => (
              <option key={b} value={b}>
                {ROTULO_DA_BANDEIRA[b]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="block font-medium">{t("Custo direto (R$, opcional)")}</span>
          <Input
            value={custo}
            placeholder={t("insumos + comissão")}
            onChange={(e) => setCusto(e.target.value)}
            className="h-11 w-36 md:h-9"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="block font-medium">{t("Margem mínima (%)")}</span>
          <Input value={margem} onChange={(e) => setMargem(e.target.value)} className="h-11 w-20 md:h-9" />
        </label>
        <label className="flex h-11 items-center gap-2 text-sm md:h-9">
          <input type="checkbox" checked={antecipar} onChange={(e) => setAntecipar(e.target.checked)} />
          {t("Antecipar")}
        </label>
        <Button type="submit" size="sm" disabled={!adq || simular.isPending} data-testid="fin-sim-calcular">
          {t("Calcular")}
        </Button>
      </form>

      {r?.erro ? (
        <p className="rounded-xl border bg-muted p-3 text-sm" data-testid="fin-sim-erro">
          {r.erro === "fin_taxa_ausente"
            ? t("Esta maquininha não tem taxa para essa forma e número de parcelas. Complete a tabela.")
            : r.erro === "fin_taxa_maior_que_valor"
              ? t("A taxa ficaria maior que o valor cobrado.")
              : t("Valores inválidos.")}
        </p>
      ) : null}
      {r?.recebimento ? (
        <div className="grid gap-4 md:grid-cols-2" data-testid="fin-sim-resultado">
          <dl className="space-y-1 rounded-xl border p-4 text-sm">
            {linha(t("Valor cobrado"), r.recebimento.bruto_cents)}
            {linha(`${t("Taxa da maquininha")} (${pct(r.recebimento.mdr_pct)})`, -r.recebimento.mdr_cents, false, "fin-sim-mdr")}
            {r.recebimento.tarifa_cents > 0 ? linha(t("Tarifa por venda"), -r.recebimento.tarifa_cents) : null}
            {linha(t("Líquido recebido"), r.recebimento.liquido_cents, true, "fin-sim-liquido")}
            {antecipar ? linha(t("Custo da antecipação"), -r.recebimento.antecipacao_cents) : null}
            {antecipar ? linha(t("Líquido se antecipar"), r.recebimento.liquido_antecipado_cents, true) : null}
            <div className="flex justify-between gap-4 border-t pt-1 text-text-muted">
              <dt>{t("Custo total para a clínica")}</dt>
              <dd className="tabular-nums" data-testid="fin-sim-custo-total">
                {formatCentsBRL(r.recebimento.custo_total_cents)} ({pct(r.recebimento.custo_total_pct)})
              </dd>
            </div>
            {r.margem_pct !== null ? (
              <p className={`pt-1 ${r.alerta_margem ? "font-medium text-destructive" : ""}`} data-testid="fin-sim-margem">
                {r.alerta_margem
                  ? t("Atenção: a margem fica abaixo do mínimo:")
                  : t("Margem depois da taxa e do custo:")}{" "}
                {pct(r.margem_pct)}
              </p>
            ) : null}
            {r.preco_sugerido_cents !== null ? (
              <p className="text-text-muted" data-testid="fin-sim-preco">
                {t("Preço para manter a margem nesta forma:")} {formatCentsBRL(r.preco_sugerido_cents)}
              </p>
            ) : null}
            {modalidade === "credito" && parcelas > 1 ? (
              <p className="pt-1 text-xs text-text-muted">
                {t("Parcelado \"sem juros\" é custo da clínica: o paciente não paga juros, mas a taxa maior sai da sua margem.")}
              </p>
            ) : null}
          </dl>
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-xl border p-4">
              <p className="mb-1 text-sm font-medium">{t("Quando entra")}</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-text-muted">
                    <th className="py-1 font-medium">{t("Parcela")}</th>
                    <th className="py-1 font-medium">{t("Data")}</th>
                    <th className="py-1 text-right font-medium">{t("Líquido")}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.recebimento.parcelas.map((p) => (
                    <tr key={p.n} className="border-t">
                      <td className="py-1">{p.n}</td>
                      <td className="py-1">{p.vencimento}</td>
                      <td className="py-1 text-right tabular-nums">
                        {formatCentsBRL(antecipar ? p.liquido_antecipado_cents : p.liquido_cents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {r.comparativo.length > 1 ? (
              <div className="rounded-xl border p-4" data-testid="fin-sim-comparativo">
                <p className="mb-1 text-sm font-medium">{t("A mesma venda em cada maquininha")}</p>
                <ul className="space-y-1 text-sm">
                  {r.comparativo.map((c) => (
                    <li key={c.adquirente_id} className="flex justify-between gap-4">
                      <span>{c.nome}</span>
                      <span className="tabular-nums">
                        {c.sem_taxa.length > 0 ? t("sem taxa para esta forma") : `${formatCentsBRL(c.taxa_cents)} (${pct(c.taxa_pct)})`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
