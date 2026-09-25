"use client";

/**
 * FORK clinic (prontuário F2) — desenha os campos de um modelo de formulário
 * clínico (lib/clinic/formularios/campos.ts). Cada tipo tem um controle
 * acessível: rótulo ligado ao campo, ajuda por `aria-describedby`, grupos com
 * `fieldset/legend`, alvos de toque de 44 px no tablet. Somente leitura mostra
 * os valores como texto (atendimento finalizado, linha do tempo).
 */
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/i18n/useT";
import type { Campo, Respostas } from "@/lib/clinic/formularios/campos";
import { cn } from "@/lib/utils";

const OPCAO =
  "min-h-11 rounded-md border px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:min-h-9";

export function valorLegivel(campo: Campo, valor: unknown, t: (s: string) => string): string {
  if (valor === null || valor === undefined || valor === "" || (Array.isArray(valor) && valor.length === 0)) return "—";
  const rotulo = (v: unknown) => campo.opcoes?.find((o) => o.valor === v)?.rotulo ?? String(v);
  switch (campo.tipo) {
    case "sim_nao":
      return valor === true ? t("Sim") : t("Não");
    case "escolha":
      return t(rotulo(valor));
    case "multipla":
      return (valor as unknown[]).map((v) => t(rotulo(v))).join(", ");
    case "data":
      return String(valor).split("-").reverse().join("/");
    default:
      return String(valor);
  }
}

export function RespostasLidas({ campos, respostas }: { campos: readonly Campo[]; respostas: Respostas }) {
  const t = useT();
  const preenchidos = campos.filter((c) => valorLegivel(c, respostas[c.chave], t) !== "—");
  if (preenchidos.length === 0) return <p className="text-sm text-text-muted">{t("Nada registrado.")}</p>;
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      {preenchidos.map((c) => (
        <div key={c.chave} className={c.tipo === "texto_longo" ? "sm:col-span-2" : undefined}>
          <dt className="text-xs text-text-muted">{t(c.rotulo)}</dt>
          <dd className="whitespace-pre-wrap">{valorLegivel(c, respostas[c.chave], t)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RenderizadorDeFormulario({
  idBase,
  campos,
  respostas,
  aoMudar,
  pendentes,
}: {
  idBase: string;
  campos: readonly Campo[];
  respostas: Respostas;
  aoMudar: (chave: string, valor: unknown) => void;
  pendentes: ReadonlySet<string>;
}) {
  const t = useT();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {campos.map((c) => {
        const id = `${idBase}-${c.chave}`;
        const ajudaId = c.ajuda ? `${id}-ajuda` : undefined;
        const valor = respostas[c.chave];
        const pendente = pendentes.has(c.chave);
        const largo = c.tipo === "texto_longo" || c.tipo === "multipla" || c.tipo === "escala";
        const titulo = (
          <>
            {t(c.rotulo)}
            {c.obrigatorio ? <span className="text-destructive"> *</span> : null}
          </>
        );
        const ajuda = c.ajuda ? (
          <p id={ajudaId} className="text-xs text-text-muted">
            {t(c.ajuda)}
          </p>
        ) : null;
        const aviso = pendente ? <p className="text-xs text-destructive">{t("Obrigatório para finalizar.")}</p> : null;

        if (c.tipo === "sim_nao" || c.tipo === "escolha" || c.tipo === "multipla" || c.tipo === "escala") {
          const opcoes =
            c.tipo === "sim_nao"
              ? [
                  { valor: true, rotulo: t("Sim") },
                  { valor: false, rotulo: t("Não") },
                ]
              : c.tipo === "escala"
                ? Array.from({ length: (c.max ?? 10) - (c.min ?? 0) + 1 }, (_, i) => ({ valor: (c.min ?? 0) + i, rotulo: String((c.min ?? 0) + i) }))
                : (c.opcoes ?? []).map((o) => ({ valor: o.valor as unknown, rotulo: t(o.rotulo) }));
          const multipla = c.tipo === "multipla";
          const lista = Array.isArray(valor) ? (valor as unknown[]) : [];
          return (
            <fieldset key={c.chave} className={cn("space-y-2", largo && "sm:col-span-2")} aria-describedby={ajudaId}>
              <legend className="text-sm font-medium">{titulo}</legend>
              {ajuda}
              <div className="flex flex-wrap gap-2" role={multipla ? "group" : "radiogroup"}>
                {opcoes.map((o) => {
                  const marcado = multipla ? lista.includes(o.valor) : valor === o.valor;
                  return (
                    <button
                      key={String(o.valor)}
                      type="button"
                      role={multipla ? "checkbox" : "radio"}
                      aria-checked={marcado}
                      className={cn(OPCAO, marcado ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent/50")}
                      onClick={() => {
                        if (multipla) aoMudar(c.chave, marcado ? lista.filter((v) => v !== o.valor) : [...lista, o.valor]);
                        else aoMudar(c.chave, marcado ? null : o.valor);
                      }}
                    >
                      {o.rotulo}
                    </button>
                  );
                })}
              </div>
              {aviso}
            </fieldset>
          );
        }

        return (
          <div key={c.chave} className={cn("space-y-1", largo && "sm:col-span-2")}>
            <label htmlFor={id} className="text-sm font-medium">
              {titulo}
            </label>
            {ajuda}
            {c.tipo === "texto_longo" ? (
              <Textarea
                id={id}
                rows={3}
                maxLength={5000}
                aria-describedby={ajudaId}
                aria-invalid={pendente || undefined}
                value={typeof valor === "string" ? valor : ""}
                onChange={(e) => aoMudar(c.chave, e.target.value)}
              />
            ) : (
              <Input
                id={id}
                type={c.tipo === "numero" ? "number" : c.tipo === "data" ? "date" : "text"}
                inputMode={c.tipo === "numero" ? "decimal" : undefined}
                min={c.min}
                max={c.max}
                maxLength={c.tipo === "texto" ? 500 : undefined}
                aria-describedby={ajudaId}
                aria-invalid={pendente || undefined}
                className="h-11 md:h-9"
                value={valor === null || valor === undefined ? "" : String(valor)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (c.tipo === "numero") aoMudar(c.chave, v === "" ? null : Number(v));
                  else aoMudar(c.chave, v);
                }}
              />
            )}
            {aviso}
          </div>
        );
      })}
    </div>
  );
}
