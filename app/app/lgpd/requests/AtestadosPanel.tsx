"use client";
import { useState } from "react";
import { format } from "date-fns";
import { useMutation } from "@tanstack/react-query";

import { useT } from "@/hooks/i18n/useT";
import { useLocaleDeData } from "@/hooks/i18n/useLocaleDeData";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { baixarAtestado, useAtestadoLigado, useAtestados } from "@/components/clinic/lgpd/atestados";

interface Conferido {
  data:
    | { encontrado: false }
    | {
        encontrado: true;
        atestado: { id: string; anonimizado_em: string; emitido_em: string; executor_nome: string | null; algoritmo: string };
      };
}

/** FORK clinic (#87): conferir código e atestados emitidos. Some quando a chave está desligada. */
export function AtestadosPanel() {
  const t = useT();
  const locale = useLocaleDeData();
  const ligado = useAtestadoLigado().data === true;
  const lista = useAtestados(ligado);
  const [codigo, setCodigo] = useState("");

  const conferir = useMutation({
    mutationFn: () => apiClient.post<Conferido>("/api/v1/clinic/lgpd/atestados/conferir", { codigo }),
    onError: showApiError,
  });

  if (!ligado) return null;
  const dia = (iso: string) => format(new Date(iso), "dd/MM/yyyy HH:mm", { locale });
  const r = conferir.data?.data;

  return (
    <div className="space-y-6" data-testid="atestados-panel">
      <Card className="space-y-3 p-4" data-testid="atestado-conferir">
        <h2 className="text-lg font-semibold">{t("Conferir código")}</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="atestado-codigo">{t("Código do atestado")}</Label>
            <Input
              id="atestado-codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="0000-0000-0000-0000"
              autoComplete="off"
            />
          </div>
          <Button data-testid="atestado-conferir-botao" disabled={codigo.trim() === "" || conferir.isPending} onClick={() => conferir.mutate()}>
            {t("Conferir")}
          </Button>
        </div>
        {r ? (
          <p className="text-sm" role="status" data-testid="atestado-conferir-resultado">
            {r.encontrado
              ? `${t("Atestado encontrado")}: ${t("anonimizado em")} ${dia(r.atestado.anonimizado_em)}, ${t("emitido em")} ${dia(r.atestado.emitido_em)}${r.atestado.executor_nome ? `, ${t("por")} ${r.atestado.executor_nome}` : ""}.`
              : t("Nenhum atestado com este código")}
          </p>
        ) : null}
      </Card>

      <Card className="space-y-3 p-4" data-testid="atestados-emitidos">
        <h2 className="text-lg font-semibold">{t("Atestados emitidos")}</h2>
        {lista.data && lista.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Data")}</TableHead>
                <TableHead>{t("Código")}</TableHead>
                <TableHead>{t("Responsável")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{dia(a.emitido_em)}</TableCell>
                  <TableCell className="font-mono">{a.codigo_curto}</TableCell>
                  <TableCell>{a.executor_nome ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => void baixarAtestado(a.id)}>
                      {t("Baixar atestado")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">
            {lista.isLoading ? t("Carregando…") : t("Nenhum atestado emitido ainda.")}
          </p>
        )}
      </Card>
    </div>
  );
}
