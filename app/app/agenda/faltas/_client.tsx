"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

interface Item {
  contact_id: string;
  paciente: string | null;
  telefone: string | null;
  faltas: number;
  ultima_falta: string;
  proximo: { id: string; inicio: string; titulo: string } | null;
}

export function ListaDeFaltas() {
  const t = useT();
  const tag = useTagDeIdioma();
  const consulta = useQuery({
    queryKey: ["clinic", "faltas"],
    queryFn: async () => (await apiClient.get<{ data: { itens: Item[] } }>("/api/v1/clinic/faltas")).data.itens,
  });
  const data = (iso: string, comHora = false) =>
    new Date(iso).toLocaleString(tag, comHora ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit", year: "numeric" });

  if (consulta.isLoading) return <p className="text-sm text-text-muted">{t("Carregando…")}</p>;
  if (consulta.isError) return <p className="text-sm text-destructive">{t("Não foi possível carregar as faltas.")}</p>;
  const itens = consulta.data ?? [];
  if (itens.length === 0) {
    return (
      <p className="text-sm text-text-muted" data-testid="faltas-vazio">
        {t("Nenhum paciente faltou 2 vezes ou mais nos últimos 12 meses.")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm" data-testid="lista-de-faltas">
        <thead className="bg-muted text-left text-xs text-text-muted">
          <tr>
            <th className="p-2">{t("Paciente")}</th>
            <th className="p-2">{t("Faltas")}</th>
            <th className="p-2">{t("Última falta")}</th>
            <th className="p-2">{t("Próximo horário")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {itens.map((i) => (
            <tr key={i.contact_id} data-testid="faltoso">
              <td className="p-2">
                <Link href={`/app/contacts/${i.contact_id}`} className="font-medium hover:underline">
                  {i.paciente ?? t("Paciente")}
                </Link>
                {i.telefone ? <span className="block text-xs text-text-muted">{i.telefone}</span> : null}
              </td>
              <td className="p-2 font-medium text-warning" data-testid="faltas-do-paciente">
                {i.faltas}
              </td>
              <td className="p-2">{data(i.ultima_falta)}</td>
              <td className="p-2">
                {i.proximo ? (
                  <Link href={`/app/agenda?compromisso=${i.proximo.id}`} className="hover:underline">
                    {data(i.proximo.inicio, true)} · {i.proximo.titulo}
                  </Link>
                ) : (
                  <span className="text-text-muted">{t("Nenhum marcado")}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
