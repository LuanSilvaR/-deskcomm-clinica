"use client";
/**
 * FORK (card #159; origem upstream `PlanosDaInstalacao`) — criar, editar,
 * arquivar e marcar o plano do cadastro. Quem recusa de verdade é a rota (e o
 * CHECK); o formulário só evita a ida e volta no erro óbvio. Preço nunca é
 * fixo no código: os planos de referência são cadastrados aqui.
 */
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { Intervalo } from "@/lib/cobranca/vocabulario";
import { useIdioma } from "@/lib/i18n/IdiomaProvider";
import { novoPlanoSchema, type PlanoDeCobranca } from "@/lib/schemas/cobranca-plano";

interface Campos {
  nome: string;
  preco: string;
  intervalo: Intervalo;
  trial_dias: string;
  max_assentos: string;
  max_canais: string;
  teto_ia: string;
}

const VAZIO: Campos = { nome: "", preco: "", intervalo: "mes", trial_dias: "14", max_assentos: "", max_canais: "", teto_ia: "" };
const AVISO_DE_CAMPOS =
  "Confira os campos do plano: preço a partir de R$ 5,00, teste grátis de 0 a 90 dias e limites a partir de 1.";

const centavos = (v: string) => Math.round(Number(v.replace(/\./g, "").replace(",", ".")) * 100);
const inteiroOuNulo = (v: string) => (v.trim() === "" ? null : Number(v));
const decimal = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

/** O corpo que as rotas de plano recebem. Limite vazio = sem limite (null). */
function corpoDoPlano(c: Campos) {
  return {
    nome: c.nome.trim(),
    preco_cents: centavos(c.preco),
    intervalo: c.intervalo,
    trial_dias: Number(c.trial_dias),
    max_assentos: inteiroOuNulo(c.max_assentos),
    max_canais: inteiroOuNulo(c.max_canais),
    teto_ia_usd_cents: c.teto_ia.trim() === "" ? null : centavos(c.teto_ia),
  };
}

function camposDe(p: PlanoDeCobranca): Campos {
  return {
    nome: p.nome,
    preco: decimal(p.preco_cents),
    intervalo: p.intervalo,
    trial_dias: String(p.trial_dias),
    max_assentos: p.max_assentos === null ? "" : String(p.max_assentos),
    max_canais: p.max_canais === null ? "" : String(p.max_canais),
    teto_ia: p.teto_ia_usd_cents === null ? "" : decimal(p.teto_ia_usd_cents),
  };
}

export function PlanosDaPlataforma({ planos }: { planos: readonly PlanoDeCobranca[] }) {
  const t = useT();
  const idioma = useIdioma();
  const router = useRouter();
  const [campos, setCampos] = useState<Campos>(VAZIO);
  const [editando, setEditando] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const brl = new Intl.NumberFormat(idioma, { style: "currency", currency: "BRL" });
  const usd = new Intl.NumberFormat(idioma, { style: "currency", currency: "USD" });
  const campo = (k: Exclude<keyof Campos, "intervalo">) => ({
    value: campos[k],
    onChange: (e: ChangeEvent<HTMLInputElement>) => setCampos({ ...campos, [k]: e.target.value }),
  });
  const limite = (n: number | null) => (n === null ? t("sem limite") : String(n));

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const corpo = corpoDoPlano(campos);
    if (!novoPlanoSchema.safeParse(corpo).success) {
      toast.error(t(AVISO_DE_CAMPOS));
      return;
    }
    setSalvando(true);
    try {
      if (editando) await apiClient.patch(`/api/v1/admin/cobranca/planos/${editando}`, corpo);
      else await apiClient.post("/api/v1/admin/cobranca/planos", corpo);
      toast.success(t("Plano salvo."));
      setCampos(VAZIO);
      setEditando(null);
      router.refresh();
    } catch (err) {
      showApiError(err);
    } finally {
      setSalvando(false);
    }
  }

  async function mudar(id: string, corpo: Record<string, unknown>) {
    try {
      await apiClient.patch(`/api/v1/admin/cobranca/planos/${id}`, corpo);
      router.refresh();
    } catch (err) {
      showApiError(err);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]" data-testid="planos-da-plataforma">
      <form
        onSubmit={salvar}
        className="space-y-3 rounded-lg border p-4"
        aria-label={editando ? t("Editar plano") : t("Novo plano")}
      >
        <h2 className="text-sm font-semibold">{editando ? t("Editar plano") : t("Novo plano")}</h2>
        <div className="space-y-1">
          <Label htmlFor="plano-nome">{t("Nome do plano")}</Label>
          <Input id="plano-nome" maxLength={60} {...campo("nome")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="plano-preco">{t("Preço (R$)")}</Label>
            <Input id="plano-preco" inputMode="decimal" {...campo("preco")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="plano-intervalo">{t("Intervalo de cobrança")}</Label>
            <select
              id="plano-intervalo"
              className="min-h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={campos.intervalo}
              onChange={(e) => setCampos({ ...campos, intervalo: e.target.value as Intervalo })}
            >
              <option value="mes">{t("Mensal")}</option>
              <option value="ano">{t("Anual")}</option>
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="plano-trial">{t("Dias de teste grátis")}</Label>
          <Input id="plano-trial" inputMode="numeric" aria-describedby="plano-trial-dica" {...campo("trial_dias")} />
          <p id="plano-trial-dica" className="text-xs text-muted-foreground">
            {t("0 = entrada paga: a clínica que entra neste plano fica com o primeiro pagamento pendente.")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="plano-assentos">{t("Máximo de pessoas")}</Label>
            <Input id="plano-assentos" inputMode="numeric" {...campo("max_assentos")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="plano-canais">{t("Máximo de números conectados")}</Label>
            <Input id="plano-canais" inputMode="numeric" {...campo("max_canais")} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="plano-ia">{t("Teto de uso de IA por mês (US$)")}</Label>
          <Input id="plano-ia" inputMode="decimal" {...campo("teto_ia")} />
        </div>
        <p className="text-xs text-muted-foreground">
          {t("Deixe um limite vazio para não limitar. Os limites passam a valer numa etapa seguinte.")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={salvando}>
            {editando ? t("Salvar alterações") : t("Salvar plano")}
          </Button>
          {editando && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditando(null);
                setCampos(VAZIO);
              }}
            >
              {t("Cancelar edição")}
            </Button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {t("O preço e o intervalo de um plano travam quando alguém o assina: para mudar, arquive e crie outro.")}
        </p>
        {planos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("Nenhum plano ainda. Crie o primeiro no formulário: nome, preço, dias de teste grátis e, se quiser, os limites.")}
          </p>
        ) : (
          <ul className="space-y-2" data-testid="lista-de-planos">
            {planos.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                data-testid="plano-de-cobranca"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium">
                    {p.nome}
                    {p.padrao_no_cadastro && (
                      <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-xs">{t("Plano do cadastro")}</span>
                    )}
                    {p.arquivado_em && (
                      <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-xs">{t("Arquivado")}</span>
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    {brl.format(p.preco_cents / 100)} {p.intervalo === "mes" ? t("por mês") : t("por ano")} ·{" "}
                    {p.trial_dias} {t("dias de teste")}
                  </p>
                  <p className="text-muted-foreground">
                    {t("Pessoas")}: {limite(p.max_assentos)} · {t("Números conectados")}: {limite(p.max_canais)} ·{" "}
                    {t("IA")}: {p.teto_ia_usd_cents === null ? t("sem limite") : usd.format(p.teto_ia_usd_cents / 100)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditando(p.id);
                      setCampos(camposDe(p));
                    }}
                  >
                    {t("Editar")}
                  </Button>
                  {!p.arquivado_em && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => mudar(p.id, { padrao_no_cadastro: !p.padrao_no_cadastro })}
                    >
                      {p.padrao_no_cadastro ? t("Tirar do cadastro") : t("Usar no cadastro")}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => mudar(p.id, { arquivado: !p.arquivado_em })}>
                    {p.arquivado_em ? t("Desarquivar") : t("Arquivar")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
